import { proxiedPdfUrl } from "@/lib/pdf-proxy";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

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

export async function renderPdfPageToDataUrl(
  pdfUrl: string,
  pageNumber: number,
  targetWidth = 720,
) {
  const pdfjsLib = await loadPdfJs();
  const url = proxiedPdfUrl(pdfUrl);
  if (!url) throw new Error("Invalid PDF url");

  const doc = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
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

export async function renderPdfPages(
  pdfUrl: string,
  onPage?: (index: number, total: number) => void,
) {
  const pdfjsLib = await loadPdfJs();
  const url = proxiedPdfUrl(pdfUrl);
  if (!url) throw new Error("Invalid PDF url");

  const doc = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
  const total = doc.numPages;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    onPage?.(pageNumber, total);
    const page = await doc.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(1.8, 900 / unscaled.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const canvasContext = canvas.getContext("2d", { alpha: false });
    if (!canvasContext) throw new Error("Canvas unavailable");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext, viewport }).promise;
    pages.push(canvas.toDataURL("image/jpeg", 0.8));
  }

  return pages;
}
