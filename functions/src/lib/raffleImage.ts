/** Imágenes embebidas en Firestore (sin Firebase Storage — plan gratuito) */

export const MAX_RAFFLE_IMAGE_BYTES = 400_000;

const DATA_URL_PATTERN =
  /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

export function isDataImageUrl(value: string): boolean {
  return value.startsWith("data:image/");
}

export function isHttpsImageUrl(value: string): boolean {
  return value.startsWith("https://");
}

export function validateRaffleImageUrl(
  value: string | null | undefined,
): string | null {
  if (value == null || value === "") return null;

  if (isHttpsImageUrl(value)) {
    return value;
  }

  if (!isDataImageUrl(value)) {
    throw new Error("La imagen debe ser JPEG, PNG o WebP (formato data URL)");
  }

  if (!DATA_URL_PATTERN.test(value)) {
    throw new Error("Imagen corrupta o formato no válido");
  }

  const comma = value.indexOf(",");
  const b64 = value.slice(comma + 1);
  const bytes = Buffer.byteLength(b64, "base64");
  if (bytes > MAX_RAFFLE_IMAGE_BYTES) {
    throw new Error(
      `Imagen demasiado grande (${Math.round(bytes / 1024)} KB). Máximo ${Math.round(MAX_RAFFLE_IMAGE_BYTES / 1024)} KB.`,
    );
  }
  if (bytes < 50) {
    throw new Error("Archivo de imagen demasiado pequeño o vacío");
  }

  return value;
}

export function buildDataUrlFromPayload(
  base64OrDataUrl: string,
  contentType: string,
): string {
  const trimmed = base64OrDataUrl.trim();
  if (trimmed.startsWith("data:image/")) {
    return validateRaffleImageUrl(trimmed)!;
  }

  let b64 = trimmed;
  const comma = b64.indexOf(",");
  if (comma >= 0) b64 = b64.slice(comma + 1);

  const normalizedType =
    contentType.toLowerCase() === "image/jpg" ? "image/jpeg" : contentType.toLowerCase();

  const dataUrl = `data:${normalizedType};base64,${b64}`;
  return validateRaffleImageUrl(dataUrl)!;
}
