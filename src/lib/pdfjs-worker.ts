type PdfJsWorkerHost = {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
};

export function installPdfJsBlobWorker(pdfjsLib: PdfJsWorkerHost) {
  if (typeof window === "undefined") return;
  if (pdfjsLib.GlobalWorkerOptions.workerSrc) return;

  // pdf.js 6 ships an ESM worker only. cdnjs has no pdf.worker.min.js for
  // 6.3.x, and a cross-origin unpkg Worker is blocked by the browser.
  // Serve the matching worker from /public so it is same-origin.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
}
