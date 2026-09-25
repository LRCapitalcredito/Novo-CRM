import { money, parseMoney, products } from "./domain";
import { dealMetrics, emptyDeal, validateDeal, type DealTerms } from "./deals";

export type DealDraft = Record<keyof DealTerms, string>;
export function dealDraft(deal?: DealTerms): DealDraft {
  return Object.fromEntries(Object.entries(deal ?? emptyDeal()).map(([key, value]) => [key, value === null ? "" : key.endsWith("Cents") ? String(Number(value) / 100).replace(".", ",") : String(value)])) as DealDraft;
}
export function readDeal(draft: DealDraft): DealTerms {
  const d = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, key.endsWith("Cents") ? parseMoney(value) : ["modality", "period"].includes(key) ? value : value.trim() === "" ? null : Number(value)]));
  validateDeal(d);
  return d;
}
export function DealFields({ value, onChange }: { value: DealDraft; onChange: (value: DealDraft) => void }) {
  const field = (key: keyof DealTerms, label: string, numeric = false) => <label key={key}>{label}<input type={numeric ? "number" : "text"} inputMode="decimal" min={numeric ? key === "termMonths" ? 1 : 0 : undefined} max={numeric ? key === "termMonths" ? 600 : 100 : undefined} step={numeric ? key === "termMonths" ? 1 : "any" : undefined} placeholder="Não informado" value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} /></label>;
  return <section className="deal-fields">
    <h3>Condições da proposta</h3>
    <p>Registre as condições desta instituição para comparar as alternativas.</p>
    <label>Modalidade nesta instituição<select value={value.modality} onChange={(e) => onChange({ ...value, modality: e.target.value })}>{products.map((p) => <option key={p}>{p}</option>)}</select></label>
    <div className="module-grid">{field("monthlyRatePercent", "Taxa de juros (% a.m.)", true)}{field("termMonths", "Prazo (meses)", true)}</div>
    {value.modality === "Antecipação de recebíveis" && <>
      <div className="module-grid">{field("creditLimitCents", "Limite aprovado (R$)")}{field("usedLimitCents", "Limite utilizado em aberto (R$)")}</div>
      <div className="module-grid"><label>Competência do volume<input type="month" value={value.period} onChange={(e) => onChange({ ...value, period: e.target.value })} /></label>{field("periodVolumeCents", "Volume antecipado na competência (R$)")}</div>
      {field("commissionPercent", "Comissão LR sobre o volume (%)", true)}
      <small>O limite disponível considera a utilização em aberto. A comissão estimada considera o volume da competência e não representa receita recebida.</small>
    </>}
    {value.modality === "Home equity" && <>{field("collateralValueCents", "Valor de avaliação do imóvel (R$)")}<small>O LTV indica a relação entre crédito e garantia. Usa o valor aprovado; enquanto não informado, usa o solicitado. Não representa aprovação de crédito.</small></>}
  </section>;
}
const percent = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
export function DealSummary({ deal, requested, approved }: { deal?: DealTerms; requested: number | null; approved: number | null }) {
  if (!deal) return null;
  const result = dealMetrics(deal, approved ?? requested);
  return <div className="deal-summary">
    <b>{deal.modality === "Não informado" ? "Modalidade a classificar" : deal.modality}</b>
    <span>{deal.monthlyRatePercent === null ? "Taxa a informar" : `${percent(deal.monthlyRatePercent)} a.m.`} · {deal.termMonths === null ? "Prazo a informar" : `${deal.termMonths} meses`}</span>
    {deal.modality === "Antecipação de recebíveis" && <>
      <span>Limite: {money(deal.creditLimitCents)}</span>
      <span className={result.availableCents !== null && result.availableCents < 0 ? "due-overdue" : ""}>Disponível: {money(result.availableCents)}{result.availableCents !== null && result.availableCents < 0 ? " · acima do limite" : ""}</span>
      <span>Volume {deal.period ? deal.period.split("-").reverse().join("/") : "sem competência"}: {money(deal.periodVolumeCents)}</span>
      <span>Comissão estimada: {money(result.commissionCents)}</span>
    </>}
    {deal.modality === "Home equity" && <><span>Garantia: {money(deal.collateralValueCents)}</span><span>LTV {approved === null ? "solicitado" : "aprovado"}: {result.ltvPercent === null ? "Não calculado" : percent(result.ltvPercent)}</span></>}
  </div>;
}
