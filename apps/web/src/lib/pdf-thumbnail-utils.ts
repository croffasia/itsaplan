import type { PdfEngine } from '@embedpdf/models';

// The engine binary is served by this app, never a CDN: an instance can run with
// no internet access, and the page's connect-src allows this origin only. The URL
// is absolute because the engine fetches it from a blob: worker, which has no
// base to resolve a path against.
function pdfiumWasmUrl() {
  const asset = new URL('@embedpdf/pdfium/pdfium.wasm', import.meta.url);
  return new URL(asset.href, window.location.href).href;
}

let sharedEnginePromise: Promise<PdfEngine> | null = null;

export function getPdfSourceUrl(src: string) {
  // Raw base64 must start with the encoded PDF header to distinguish it from a path.
  if (/^\s*JVBERi0/.test(src) && !/[^A-Za-z0-9+/=\s]/.test(src)) {
    return `data:application/pdf;base64,${src.replace(/\s/g, '')}`;
  }

  return src;
}

export function loadSharedPdfEngine() {
  sharedEnginePromise ??= import('@embedpdf/engines/pdfium-worker-engine').then(
    // Left unset, the engine downloads fallback fonts from a public CDN.
    ({ createPdfiumEngine }) => createPdfiumEngine(pdfiumWasmUrl(), { fontFallback: null }),
  );

  return sharedEnginePromise;
}
