import { validDate } from "./domain";
export interface CreditInput {
  amount: number;
  rateMonthly: number;
  months: number;
  grace: number;
  system: "PRICE" | "SAC";
  graceMode: "capitalized" | "interest";
  startDate: string;
  iof: boolean;
  dailyIof: number;
  additionalIof: number;
  iofFinanced: boolean;
  tac: number;
  tacFinanced: boolean;
  insurance: number;
  insuranceFinanced: boolean;
  monthlyInsurance: number;
  other: number;
  otherFinanced: boolean;
}
export const defaultCredit = (): CreditInput => ({
  amount: 100000,
  rateMonthly: 1.5,
  months: 36,
  grace: 0,
  system: "PRICE",
  graceMode: "capitalized",
  startDate: new Date().toISOString().slice(0, 10),
  iof: false,
  dailyIof: 0.0082,
  additionalIof: 0.38,
  iofFinanced: false,
  tac: 0,
  tacFinanced: false,
  insurance: 0,
  insuranceFinanced: false,
  monthlyInsurance: 0,
  other: 0,
  otherFinanced: false,
});
const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function monthDate(date: string, offset: number) {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + offset + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + offset, Math.min(d, last)))
    .toISOString()
    .slice(0, 10);
}
export const daysBetween = (a: string, b: string) =>
  (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000;
export interface Payment {
  month: number;
  date: string;
  days: number;
  payment: number;
  principal: number;
  interest: number;
  insurance: number;
  balance: number;
  capitalized: number;
  iofPrincipal: number;
}
function schedule(p: number, input: CreditInput): Payment[] {
  let balance = round(p);
  const r = input.rateMonthly / 100;
  const rows: Payment[] = [];
  const n = input.months - input.grace;
  let capital = 0,
    pmt = 0,
    sac = 0;
  for (let m = 1; m <= input.months; m++) {
    const interest = round(balance * r);
    let principal = 0,
      payment = 0,
      capitalized = 0;
    if (m <= input.grace) {
      if (input.graceMode === "capitalized") {
        capitalized = interest;
        balance = round(balance + interest);
      } else payment = interest;
    } else {
      if (m === input.grace + 1) {
        capital = balance;
        sac = capital / n;
        pmt =
          r === 0
            ? capital / n
            : (capital * r) / -Math.expm1(-n * Math.log1p(r));
      }
      principal =
        m === input.months
          ? balance
          : Math.min(
              balance,
              round(input.system === "SAC" ? sac : pmt - interest),
            );
      if (principal < 0)
        throw new Error("Prazo e taxa geram amortização negativa.");
      balance = round(balance - principal);
      payment = round(principal + interest);
    }
    rows.push({
      month: m,
      date: monthDate(input.startDate, m),
      days: daysBetween(input.startDate, monthDate(input.startDate, m)),
      payment: round(payment + input.monthlyInsurance),
      principal,
      interest,
      insurance: input.monthlyInsurance,
      balance,
      capitalized,
      iofPrincipal: capital ? (principal * p) / capital : 0,
    });
  }
  return rows;
}
export function annualCost(net: number, rows: Payment[]) {
  if (net <= 0)
    throw new Error(
      "Os custos antecipados precisam ser menores que o crédito.",
    );
  const npv = (rate: number) =>
    rows.reduce((s, x) => s + x.payment / Math.pow(1 + rate, x.days / 365), 0) -
    net;
  if (Math.abs(npv(0)) < 0.000001) return 0;
  let lo = -0.999,
    hi = 1;
  while (npv(hi) > 0 && hi < 1e8) hi *= 2;
  if (npv(hi) > 0)
    throw new Error("Não foi possível calcular o custo efetivo deste cenário.");
  for (let i = 0; i < 150; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
export function simulateCredit(input: CreditInput) {
  for (const key of [
    "amount",
    "rateMonthly",
    "months",
    "grace",
    "dailyIof",
    "additionalIof",
    "tac",
    "insurance",
    "monthlyInsurance",
    "other",
  ] as const)
    if (!Number.isFinite(input[key]) || input[key] < 0)
      throw new Error("Preencha valores numéricos não negativos.");
  if (
    input.amount <= 0 ||
    input.amount > 1e12 ||
    input.rateMonthly > 20 ||
    !Number.isInteger(input.months) ||
    input.months < 1 ||
    input.months > 600 ||
    !Number.isInteger(input.grace) ||
    input.grace >= input.months ||
    input.dailyIof > 0.05 ||
    input.additionalIof > 5 ||
    !validDate(input.startDate) ||
    !["PRICE", "SAC"].includes(input.system) ||
    !["capitalized", "interest"].includes(input.graceMode)
  )
    throw new Error(
      "Confira valor, taxa, data e prazo. A carência deve ser menor que o prazo total.",
    );
  const financedFees =
    (input.tacFinanced ? input.tac : 0) +
    (input.insuranceFinanced ? input.insurance : 0) +
    (input.otherFinanced ? input.other : 0);
  const upfrontFees =
    (!input.tacFinanced ? input.tac : 0) +
    (!input.insuranceFinanced ? input.insurance : 0) +
    (!input.otherFinanced ? input.other : 0);
  const tax = (principal: number, rows: Payment[]) =>
    input.iof
      ? round(
          (principal * input.additionalIof) / 100 +
            rows.reduce(
              (s, x) =>
                s +
                (x.iofPrincipal * Math.min(365, x.days) * input.dailyIof) / 100,
              0,
            ),
        )
      : 0;
  let financed = round(input.amount + financedFees),
    iof = 0;
  for (let i = 0; i < 100; i++) {
    iof = tax(financed, schedule(financed, input));
    const next = round(
      input.amount + financedFees + (input.iofFinanced ? iof : 0),
    );
    if (next === financed) break;
    financed = next;
    if (i === 99) throw new Error("O cálculo do IOF financiado não convergiu.");
  }
  const rows = schedule(financed, input);
  iof = tax(financed, rows);
  const upfront = round(upfrontFees + (input.iofFinanced ? 0 : iof));
  const net = round(input.amount - upfront);
  const totalPayments = round(rows.reduce((s, x) => s + x.payment, 0));
  const interest = round(rows.reduce((s, x) => s + x.interest, 0));
  const cetAnnual = annualCost(net, rows);
  return {
    rows,
    financed,
    iof,
    upfront,
    net,
    totalPayments,
    totalCost: round(totalPayments - net),
    interest,
    cetAnnual,
    cetMonthly: Math.pow(1 + cetAnnual, 1 / 12) - 1,
    annualRate: Math.pow(1 + input.rateMonthly / 100, 12) - 1,
    first: rows.find((x) => x.payment > 0)?.payment ?? 0,
    last: rows.at(-1)!.payment,
  };
}
