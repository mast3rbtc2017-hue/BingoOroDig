import { apiJson } from "./api-fetch";

const MAX_BYTES = 5 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer la imagen"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/** Sube imagen del premio vía API (evita CORS de Firebase Storage en el navegador) */
export async function uploadRafflePrizeImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se permiten imágenes");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La imagen debe pesar menos de 5 MB");
  }

  const dataUrl = await readFileAsBase64(file);
  const contentType =
    file.type === "image/jpg" ? "image/jpeg" : file.type || "image/jpeg";

  const { url } = await apiJson<{ url: string }>("/api/raffles/upload-image", "POST", {
    imageBase64: dataUrl,
    contentType,
  });

  return url;
}

/** Vista previa local mientras sube (no requiere red) */
export function localPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
