import { getStorage } from "firebase-admin/storage";

const BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? "bingoorodig.firebasestorage.app";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

/** Sube imagen de premio vía Admin SDK (sin CORS del navegador) */
export async function uploadRaffleImage(
  buffer: Buffer,
  contentType: string,
  adminUid: string,
): Promise<string> {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Tipo de imagen no permitido");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("La imagen debe pesar menos de 5 MB");
  }
  if (buffer.length < 100) {
    throw new Error("Archivo de imagen inválido");
  }

  const bucket = getStorage().bucket(BUCKET);
  const ext = extFromType(contentType);
  const path = `raffles/media/${adminUid}/${Date.now()}.${ext}`;
  const file = bucket.file(path);

  try {
    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: "public,max-age=31536000",
      },
    });

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 5,
    });
    return url;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("bucket") || msg.includes("not exist")) {
      throw new Error(
        "Firebase Storage no está activo. Actívalo en la consola de Firebase (Storage → Comenzar).",
      );
    }
    throw new Error(`No se pudo guardar la imagen: ${msg}`);
  }
}
