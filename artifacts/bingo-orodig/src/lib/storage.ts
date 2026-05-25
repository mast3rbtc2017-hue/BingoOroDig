import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { auth } from "./firebase";

const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadRafflePrizeImage(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión para subir imágenes");

  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se permiten imágenes");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La imagen debe pesar menos de 5 MB");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `raffles/media/${user.uid}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
