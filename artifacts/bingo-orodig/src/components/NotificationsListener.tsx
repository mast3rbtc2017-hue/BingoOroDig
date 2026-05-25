import { useNotifications } from "@/lib/useNotifications";

/** Escucha notificaciones del servidor y muestra toasts al ganador */
export function NotificationsListener() {
  useNotifications();
  return null;
}
