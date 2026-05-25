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
