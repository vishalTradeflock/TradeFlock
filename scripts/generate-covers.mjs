import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { createClient } from "@supabase/supabase-js";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const COVERS_DIR = resolve(ROOT, "public/covers");
const COVER_WIDTH = 400;
const COVER_HEIGHT = 560;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function loadEnvLocal() {
  const envPath = resolve(ROOT, ".env.local");
  const text = readFileSync(envPath, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function workerSrc() {
  return pathToFileURL(resolve(ROOT, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
}

async function rasterizeCover(pdfBytes) {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBytes),
    disableAutoFetch: true,
    disableStream: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(COVER_WIDTH / base.width, COVER_HEIGHT / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(COVER_WIDTH, COVER_HEIGHT);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
    const dx = Math.floor((COVER_WIDTH - viewport.width) / 2);
    const dy = Math.floor((COVER_HEIGHT - viewport.height) / 2);
    ctx.save();
    ctx.translate(dx, dy);
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    }).promise;
    ctx.restore();
    return canvas.encodeSync("jpeg", 85);
  } finally {
    try {
      await doc.cleanup();
    } catch {
      /* worker already torn down */
    }
  }
}

async function fetchPdf(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  loadEnvLocal();
  GlobalWorkerOptions.workerSrc = workerSrc();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not set; cover_image_url updates may fail under RLS.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: magazines, error } = await supabase
    .from("magazines")
    .select("id, slug, title, pdf_url")
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!magazines?.length) {
    console.log("No magazine rows found.");
    return;
  }

  await mkdir(COVERS_DIR, { recursive: true });
  console.log(`Rasterizing page 1 for ${magazines.length} magazines…`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, magazine] of magazines.entries()) {
    const pdfUrl = String(magazine.pdf_url || "").trim();
    const label = `[${index + 1}/${magazines.length}] ${magazine.slug}`;
    if (!pdfUrl) {
      skipped += 1;
      console.log(`${label}: skip (no pdf_url)`);
      continue;
    }

    try {
      process.stdout.write(`${label}: fetching… `);
      const bytes = await fetchPdf(pdfUrl);
      process.stdout.write("render… ");
      const jpeg = await rasterizeCover(bytes);
      const relative = `/covers/${magazine.slug}.jpg`;
      await writeFile(resolve(COVERS_DIR, `${magazine.slug}.jpg`), jpeg);
      const { error: updateError } = await supabase
        .from("magazines")
        .update({ cover_image_url: relative })
        .eq("id", magazine.id);
      if (updateError) {
        console.log(
          `ok (${Math.round(jpeg.length / 1024)}kb, db: ${updateError.message})`,
        );
      } else {
        console.log(`ok (${Math.round(jpeg.length / 1024)}kb)`);
      }
      ok += 1;
    } catch (err) {
      failed += 1;
      console.log(`fail: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`Done. ok=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
