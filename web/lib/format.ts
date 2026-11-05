const nf = (d: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const formatNdvi = (v: number | null | undefined): string =>
  v == null ? "sem dado" : nf(2).format(v);

export const formatHa = (v: number): string => `${nf(2).format(v)} ha`;

export const formatPct = (v: number): string => `${nf(1).format(v)}%`;

export const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
