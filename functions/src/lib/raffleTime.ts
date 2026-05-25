/** Colombia no usa horario de verano — offset fijo UTC-5 */
export const RAFFLE_TIMEZONE = "America/Bogota";

export function parseScheduledDrawColombia(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) return new Date(NaN);
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  return new Date(`${normalized}-05:00`);
}

export function formatDrawColombia(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: RAFFLE_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
