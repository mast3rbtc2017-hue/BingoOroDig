/** Toda la plataforma opera en pesos colombianos (COP). */
export const CURRENCY_CODE = "COP" as const;

const formatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatCOP(amount: number): string {
  if (!Number.isFinite(amount)) return formatter.format(0);
  return formatter.format(Math.round(amount));
}

export function formatCOPSigned(amount: number): string {
  const abs = formatCOP(Math.abs(amount));
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `-${abs}`;
  return abs;
}

export const CURRENCY_INPUT_HINT = "Montos en pesos colombianos (COP)";
