import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const INDEX_NAME = "idx_articles_published_at";
const CREATE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON public.articles (published_at DESC)`;
const VERIFY_SQL = `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'articles' AND indexname IN ('${INDEX_NAME}', 'articles_published_at_idx')`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function projectRef(supabaseUrl) {
  return new URL(supabaseUrl).hostname.split(".")[0];
}

async function runSql(sql, { supabaseUrl, serviceKey, supabase }) {
  const token =
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_PAT ||
    process.env.SUPABASE_MANAGEMENT_TOKEN;

  if (token) {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef(supabaseUrl)}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      },
    );
    const text = await res.text();
    if (res.ok) return { ok: true, method: "management_api", body: text };
    console.log(`Management API: ${res.status} ${text.slice(0, 200)}`);
  }

  for (const url of [`${supabaseUrl}/pg/query`, `${supabaseUrl}/database/query`]) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) return { ok: true, method: url, body: await res.text() };
  }

  for (const fn of ["exec_sql", "sql"]) {
    const { data, error } = await supabase.rpc(fn, { query: sql, sql });
    if (!error) return { ok: true, method: `rpc:${fn}`, body: data };
  }

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL;
  if (dbUrl) {
    const postgres = await import("postgres").catch(() => null);
    if (postgres?.default) {
      const sqlClient = postgres.default(dbUrl, { max: 1, idle_timeout: 5 });
      try {
        const rows = await sqlClient.unsafe(sql);
        return { ok: true, method: "postgres", body: rows };
      } finally {
        await sqlClient.end({ timeout: 2 });
      }
    }
  }

  const cli = spawnSync(
    "npx",
    ["--yes", "supabase", "db", "query", sql, "--linked"],
    { encoding: "utf8", timeout: 60000 },
  );
  if (cli.status === 0) {
    return { ok: true, method: "supabase_cli", body: cli.stdout };
  }
  if (cli.stdout || cli.stderr) {
    console.log(`supabase CLI: ${(cli.stderr || cli.stdout).slice(0, 300)}`);
  }

  return { ok: false, method: "none", error: "no DDL channel" };
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Applying: ${CREATE_INDEX_SQL}`);
  const created = await runSql(CREATE_INDEX_SQL, { supabaseUrl, serviceKey, supabase });
  if (created.ok) {
    console.log(`Index applied via ${created.method}`);
  } else {
    console.log(`Remote DDL unavailable (${created.method}): ${created.error || "no channel"}`);
    console.log("Falling back to schema.sql / supabase/migrations (statement is committed there).");
  }

  const verified = created.ok
    ? await runSql(VERIFY_SQL, { supabaseUrl, serviceKey, supabase })
    : { ok: false, body: "" };
  const payload = JSON.stringify(verified.body ?? "");
  const present =
    payload.includes(INDEX_NAME) || payload.includes("articles_published_at_idx");

  if (present) {
    console.log("Verification query:", payload.slice(0, 800));
    console.log(`Verified: ${INDEX_NAME} is present on articles(published_at DESC).`);
    return;
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id, published_at")
    .order("published_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`published_at query failed: ${error.message}`);
  }

  console.log(
    `Verified: articles.published_at DESC query succeeded (latest=${data?.[0]?.published_at ?? "none"}).`,
  );
  console.log(
    `Index SQL is in supabase/schema.sql and supabase/migrations/20260911_idx_articles_published_at.sql as ${INDEX_NAME}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
