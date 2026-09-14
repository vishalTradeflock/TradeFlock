import { proxiedPdfUrl } from "@/lib/pdf-proxy";
import { installPdfJsBlobWorker } from "@/lib/pdfjs-worker";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;
const docCache = new Map<string, Promise<PDFDocumentProxy>>();

let runningJobs = 0;
const waitingJobs: Array<() => void> = [];
const MAX_COVER_JOBS = 1;

export function enqueuePdfWork<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      runningJobs += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          runningJobs -= 1;
          const next = waitingJobs.shift();
          if (next) next();
        });
    };
    if (runningJobs < MAX_COVER_JOBS) start();
    else waitingJobs.push(start);
  });
}

export async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("pdfjs is browser-only");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjsLib) => {
      installPdfJsBlobWorker(pdfjsLib);
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

export async function getPdfDocument(pdfUrl: string) {
  const url = proxiedPdfUrl(pdfUrl);
  if (!url) throw new Error("Invalid PDF url");
  const cached = docCache.get(url);
  if (cached) return cached;
  const pending = loadPdfJs().then((pdfjsLib) =>
    pdfjsLib.getDocument({ url, withCredentials: false }).promise,
  );
  docCache.set(url, pending);
  return pending;
}

export async function getPdfPageCount(pdfUrl: string) {
  const doc = await getPdfDocument(pdfUrl);
  return doc.numPages;
}

export async function getPdfPageAspect(pdfUrl: string) {
  const doc = await getPdfDocument(pdfUrl);
  const page = await doc.getPage(1);
  const width = page.view[2];
  const height = page.view[3];
  return {
    ratio: height ? width / height : 0.75,
    pageCount: doc.numPages,
  };
}

export async function renderPdfPageToDataUrl(
  pdfUrl: string,
  pageNumber: number,
  options?: { scale?: number; targetHeight?: number },
) {
  const doc = await getPdfDocument(pdfUrl);
  const page = await doc.getPage(pageNumber);
  const scale = options?.targetHeight
    ? options.targetHeight / page.view[3]
    : (options?.scale ?? 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const canvasContext = canvas.getContext("2d", { alpha: false });
  if (!canvasContext) throw new Error("Canvas unavailable");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvasContext.fillStyle = "#ffffff";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext, viewport }).promise;
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
    pageCount: doc.numPages,
    width: canvas.width,
    height: canvas.height,
  };
}

const COVER_HEIGHT = 400;
const COVER_SCALE = 0.4;

export async function renderPdfCoverThumbnail(documentUrl: string) {
  if (!documentUrl) throw new Error("Invalid PDF url");
  const url = documentUrl;
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({
    url,
    withCredentials: false,
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: 65536,
  });
  let doc: PDFDocumentProxy | undefined;
  try {
    doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: COVER_SCALE });
    const renderCanvas = document.createElement("canvas");
    const renderContext = renderCanvas.getContext("2d", { alpha: false });
    if (!renderContext) throw new Error("Canvas unavailable");
    renderCanvas.width = Math.ceil(viewport.width);
    renderCanvas.height = Math.ceil(viewport.height);
    renderContext.fillStyle = "#ffffff";
    renderContext.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
    await page.render({
      canvas: renderCanvas,
      canvasContext: renderContext,
      viewport,
    }).promise;

    const out = document.createElement("canvas");
    const ratio = renderCanvas.width / Math.max(1, renderCanvas.height);
    out.height = COVER_HEIGHT;
    out.width = Math.max(1, Math.round(COVER_HEIGHT * ratio));
    const outContext = out.getContext("2d", { alpha: false });
    if (!outContext) throw new Error("Canvas unavailable");
    outContext.drawImage(renderCanvas, 0, 0, out.width, out.height);

    let dataUrl = out.toDataURL("image/webp", 0.8);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = out.toDataURL("image/jpeg", 0.8);
    }
    return dataUrl;
  } finally {
    if (doc) await doc.cleanup();
    try {
      await loadingTask.destroy();
    } catch {
      /* already torn down with the document */
    }
  }
}
