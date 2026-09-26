import { parseMoney } from "./domain";

export function reais(cents: number | null): string {
  return cents === null ? "Não informado" : new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(cents / 100);
}
export function reaisInput(cents: number | null): string {
  return cents === null ? "" : reais(cents);
}
// Preserve incomplete input so validation can explain it without silently changing its value.
export function formatReaisInput(value: string): string {
  try { return reaisInput(parseMoney(value)); } catch { return value; }
}
export function celular(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) digits = digits.slice(2);
  // Never guess a missing digit or rewrite an international or malformed number.
  if (value.trim().startsWith("+") && !value.trim().startsWith("+55")) return value;
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits[2]}.${digits.slice(3,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return value;
}
