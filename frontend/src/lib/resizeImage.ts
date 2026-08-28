// Mirrors the backend's SupabaseStorageService (sharp: resize to MAX_WIDTH,
// webp quality 80) — doing it client-side first means the file that actually
// travels over the network and hits the server is already small, instead of
// shipping a 6-10MB phone photo just to shrink it after the fact.
const MAX_WIDTH = 800;
const WEBP_QUALITY = 0.8;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Some browsers silently ignore an unsupported `type` in toBlob() and hand
// back a PNG instead — check the result rather than trusting the request.
export async function resizeImageToWebp(file: File): Promise<File> {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_WIDTH / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    let extension = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", WEBP_QUALITY);
      extension = "jpg";
    }
    if (!blob) return file;

    return new File([blob], `${Date.now()}.${extension}`, { type: blob.type });
  } catch {
    // If anything goes wrong client-side, fall back to the original file —
    // the backend's sharp step still normalizes it either way.
    return file;
  }
}
