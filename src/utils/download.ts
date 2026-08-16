// Puente nativo inyectado por el WebView de Android (APK Capacitor).
type AndroidDownloader = { saveBase64File: (base64: string, filename: string, mime: string) => void };

function getAndroidDownloader(): AndroidDownloader | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { AndroidDownloader?: AndroidDownloader }).AndroidDownloader;
  return bridge && typeof bridge.saveBase64File === "function" ? bridge : null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Diferir la liberación: revocar de inmediato puede abortar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadBlob(blob: Blob, filename: string, mime: string): Promise<void> {
  // En el APK (WebView de Android) las URLs blob: no se descargan: usar el puente nativo.
  const downloader = getAndroidDownloader();
  if (downloader) {
    const base64 = await blobToBase64(blob);
    downloader.saveBase64File(base64, filename, mime);
    return;
  }

  triggerBrowserDownload(blob, filename);
}
