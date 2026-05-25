/** Comprime y prepara imagen para guardar en Firestore (100% gratis, sin Storage) */

const MAX_OUTPUT_BYTES = 380_000;
const MAX_DIMENSION = 1200;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen"));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}

function estimateBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  return Math.ceil((dataUrl.length - comma - 1) * 0.75);
}

/**
 * Redimensiona y comprime la foto del premio para caber en Firestore (~400 KB).
 * Devuelve data URL lista para enviar en imageUrl al crear la rifa.
 */
export async function prepareRafflePrizeImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se permiten imágenes (JPG, PNG, WebP)");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("El archivo original debe ser menor de 8 MB");
  }

  const img = await loadImage(file);
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.88;
  let dataUrl = "";
  for (let i = 0; i < 12; i++) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (!blob) throw new Error("Error al comprimir la imagen");
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Error al leer imagen comprimida"));
      reader.readAsDataURL(blob);
    });
    if (estimateBytes(dataUrl) <= MAX_OUTPUT_BYTES) break;
    quality -= 0.08;
    if (quality < 0.35) {
      throw new Error(
        "La imagen sigue siendo muy pesada. Prueba con una foto más pequeña o simple.",
      );
    }
  }

  return dataUrl;
}

export function localPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
