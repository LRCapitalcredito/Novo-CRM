export const narrativeFields: Record<string, string> = {
  location: "Cidade e UF",
  history: "História e fundação",
  products: "Principais produtos",
  differentials: "Diferenciais competitivos",
  clients: "Principais clientes",
  suppliers: "Principais fornecedores",
  competitors: "Principais concorrentes",
  objective: "Objetivo do crédito",
  seasonality: "Sazonalidade e crescimento",
  guarantees: "Garantias oferecidas",
  facilities: "Instalações",
  character: "Caráter",
  capacity: "Capacidade",
  capital: "Capital",
  collateral: "Colateral",
  conditions: "Condições",
  strengths: "Pontos positivos",
  risks: "Riscos e mitigadores",
  conclusion: "Conclusão",
  solvency: "Avaliação de solvência",
  sources: "Fontes e data-base",
};
export const numericFields: Record<string, string> = {
  revenue: "Faturamento LTM",
  ebitda: "EBITDA LTM",
  netProfit: "Lucro líquido",
  grossProfit: "Lucro bruto",
  currentAssets: "Ativo circulante",
  currentLiabilities: "Passivo circulante",
  assets: "Ativo total",
  longAssets: "Realizável a longo prazo",
  longLiabilities: "Passivo não circulante",
  equity: "Patrimônio líquido",
  cash: "Disponível",
  inventory: "Estoque",
  receivables: "Recebíveis",
  otherAssets: "Outros ativos",
  shortDebt: "Dívida financeira de curto prazo",
  longDebt: "Dívida financeira de longo prazo",
  cogs: "CMV",
  tradePayables: "Fornecedores",
  employees: "Colaboradores",
  pmr: "PMR",
  pme: "PME",
  pmp: "PMP",
  currentRatio: "Liquidez corrente",
  quickRatio: "Liquidez seca",
  generalRatio: "Liquidez geral",
  netDebtEbitda: "Dívida líquida / EBITDA",
  netDebtEquity: "Dívida líquida / PL",
  debtRatio: "Endividamento geral (%)",
  debtComposition: "Composição do endividamento (%)",
  grossMargin: "Margem bruta (%)",
  ebitdaMargin: "Margem EBITDA (%)",
  roe: "ROE (%)",
  assetTurnover: "Giro do ativo",
};
export interface Diagnosis {
  referenceDate: string;
  analyst: string;
  texts: Record<string, string>;
  numbers: Record<string, number | null>;
  monthly: Record<string, number | null>;
}
export const emptyDiagnosis = (): Diagnosis => ({
  referenceDate: new Date().toISOString().slice(0, 10),
  analyst: "",
  texts: Object.fromEntries(Object.keys(narrativeFields).map((k) => [k, ""])),
  numbers: Object.fromEntries(Object.keys(numericFields).map((k) => [k, null])),
  monthly: {},
});
export function numberValue(v: string): number | null {
  if (!v.trim()) return null;
  const s = v
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/%$/, "")
    .replace(/\s/g, "");
  if (!/^-?(?:\d+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?)$/.test(s))
    throw new Error("Número inválido.");
  const n = Number(
    s.includes(",")
      ? s.replaceAll(".", "").replace(",", ".")
      : /^-?\d{1,3}(?:\.\d{3})+$/.test(s)
        ? s.replaceAll(".", "")
        : s,
  );
  if (!Number.isFinite(n) || Math.abs(n) > 1e15)
    throw new Error("Número inválido.");
  return n;
}
export function indicators(d: Diagnosis) {
  const n = d.numbers;
  const add = (a: string, b: string) =>
    n[a] != null && n[b] != null ? n[a]! + n[b]! : null;
  const div = (
    a: number | null | undefined,
    b: number | null | undefined,
    m = 1,
  ) => (a != null && b != null && b !== 0 ? (a / b) * m : null);
  const sub = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b != null ? a - b : null;
  const debt = add("shortDebt", "longDebt"),
    liabilities = add("currentLiabilities", "longLiabilities"),
    netDebt = sub(debt, n.cash),
    ccl = sub(n.currentAssets, n.currentLiabilities);
  const calculated = {
    currentRatio: div(n.currentAssets, n.currentLiabilities),
    quickRatio: div(sub(n.currentAssets, n.inventory), n.currentLiabilities),
    generalRatio: div(add("currentAssets", "longAssets"), liabilities),
    netDebtEbitda: div(netDebt, n.ebitda),
    netDebtEquity: div(netDebt, n.equity),
    debtRatio: div(liabilities, n.assets, 100),
    debtComposition: div(n.currentLiabilities, liabilities, 100),
    grossMargin: div(n.grossProfit, n.revenue, 100),
    ebitdaMargin: div(n.ebitda, n.revenue, 100),
    roe: div(n.netProfit, n.equity, 100),
    assetTurnover: div(n.revenue, n.assets),
  };
  return {
    ...Object.fromEntries(
      Object.entries(calculated).map(([k, v]) => [k, v ?? n[k] ?? null]),
    ),
    ccl,
    netDebt,
    debt,
    operatingCycle: add("pmr", "pme"),
    financialCycle:
      n.pmr != null && n.pme != null && n.pmp != null
        ? n.pmr + n.pme - n.pmp
        : null,
  } as Record<string, number | null>;
}
export interface Extraction {
  field: string;
  value: string | null;
  evidence: string;
}
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function extractLabeledText(text: string): Extraction[] {
  const labels = { ...narrativeFields, ...numericFields };
  const out: Extraction[] = [];
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = Object.keys(labels).find(
      (k) =>
        norm(k) === norm(line.slice(0, i)) ||
        norm(labels[k]) === norm(line.slice(0, i)),
    );
    if (key)
      out.push({ field: key, value: line.slice(i + 1).trim(), evidence: line });
  }
  return out;
}
export function applyExtraction(d: Diagnosis, items: Extraction[]): Diagnosis {
  const next = structuredClone(d);
  for (const item of items) {
    if (!(item.field in narrativeFields || item.field in numericFields))
      throw new Error("Campo desconhecido na extração.");
    if (item.value == null || item.value === "") continue;
    if (item.field in numericFields)
      next.numbers[item.field] = numberValue(item.value);
    else next.texts[item.field] = item.value;
  }
  return next;
}
