export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const brlToCents = (s: string): number => {
  const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
};
