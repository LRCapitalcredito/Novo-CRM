import { products, type Product } from "./domain";

// Condições informadas pela equipe, independentes do texto original importado.
export interface DealTerms {
  modality: Product;
  monthlyRatePercent: number | null;
  termMonths: number | null;
  creditLimitCents: number | null;
  usedLimitCents: number | null;
  period: string;
  periodVolumeCents: number | null;
  commissionPercent: number | null;
  collateralValueCents: number | null;
}
export const emptyDeal = (): DealTerms => ({ modality: "Não informado", monthlyRatePercent: null, termMonths: null, creditLimitCents: null, usedLimitCents: null, period: "", periodVolumeCents: null, commissionPercent: null, collateralValueCents: null });
export function validateDeal(d: any): asserts d is DealTerms {
  if (!d || typeof d !== "object" || Array.isArray(d) || !products.includes(d.modality)) throw new Error("Selecione uma modalidade válida para a instituição.");
  for (const key of ["creditLimitCents", "usedLimitCents", "periodVolumeCents", "collateralValueCents"]) {
    if (d[key] !== null && (!Number.isSafeInteger(d[key]) || d[key] < 0 || d[key] > 1e15)) throw new Error("Informe valores válidos nas condições da proposta.");
  }
  for (const key of ["monthlyRatePercent", "commissionPercent"]) {
    if (d[key] !== null && (typeof d[key] !== "number" || !Number.isFinite(d[key]) || d[key] < 0 || d[key] > 100)) throw new Error("Taxa e comissão devem ficar entre 0 e 100%.");
  }
  if (d.termMonths !== null && (!Number.isInteger(d.termMonths) || d.termMonths < 1 || d.termMonths > 600)) throw new Error("Informe um prazo entre 1 e 600 meses.");
  if (typeof d.period !== "string" || (d.period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.period))) throw new Error("Informe uma competência válida.");
  if (d.periodVolumeCents !== null && !d.period) throw new Error("Informe a competência do volume antecipado.");
}
export function dealMetrics(d: DealTerms, creditCents: number | null) {
  return {
    availableCents: d.creditLimitCents === null || d.usedLimitCents === null ? null : d.creditLimitCents - d.usedLimitCents,
    commissionCents: d.periodVolumeCents === null || d.commissionPercent === null || !d.period ? null : Math.round(d.periodVolumeCents * d.commissionPercent / 100),
    ltvPercent: creditCents === null || d.collateralValueCents === null || d.collateralValueCents <= 0 ? null : creditCents / d.collateralValueCents * 100,
  };
}
