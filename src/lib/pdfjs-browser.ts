import { proxiedPdfUrl } from "@/lib/pdf-proxy";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;
const docCache = new Map<string, Promise<PDFDocumentProxy>>();

export async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("pdfjs is browser-only");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
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

export async function renderPdfPageToDataUrl(
  pdfUrl: string,
  pageNumber: number,
  targetWidth = 720,
) {
  const doc = await getPdfDocument(pdfUrl);
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, targetWidth / unscaled.width);
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
    dataUrl: canvas.toDataURL("image/jpeg", 0.84),
    pageCount: doc.numPages,
    width: canvas.width,
    height: canvas.height,
  };
}
