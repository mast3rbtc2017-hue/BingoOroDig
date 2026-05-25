export const RAFFLE_TIMEZONE = "America/Bogota";

/** Convierte valor de input datetime-local a ISO con zona Colombia (UTC-5) */
export function datetimeLocalToColombiaISO(value: string): string {
  if (!value) return "";
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}-05:00`;
}

export function formatRaffleDrawColombia(iso: string | null | undefined): string {
  if (!iso) return "Por definir";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Por definir";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: RAFFLE_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RAFFLE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
