import { today, validDate, type Operation } from "./domain";
export interface ContractData {
  company: string;
  cnpj: string;
  address: string;
  representative: string;
  cpf: string;
  role: string;
  email: string;
  city: string;
  date: string;
  setup: number;
  success: number;
  restructure: number;
  setupEnabled: boolean;
  successEnabled: boolean;
  restructureEnabled: boolean;
  group: string;
  institutions: { name: string; cnpj: string }[];
  purpose: string;
  authorizationEnd: string;
  status: string;
}
export interface ContractTemplate {
  issuer: string;
  issuerDocument: string;
  issuerAddress: string;
  issuerRepresentative: string;
  issuerEmail: string;
  paymentDetails: string;
  sections: { heading: string; text: string }[];
}
export function newContract(op: Operation, address = ""): ContractData {
  return {
    company: op.company,
    cnpj: op.cnpj,
    address,
    representative: op.contact,
    cpf: "",
    role: "Sócio(a) administrador(a)",
    email: op.email,
    city: "Sapiranga",
    date: today(),
    setup: 750,
    success: 3,
    restructure: 10,
    setupEnabled: true,
    successEnabled: true,
    restructureEnabled: true,
    group: "",
    institutions: [],
    purpose: "Análise de crédito e assessoria financeira",
    authorizationEnd: "",
    status: "Rascunho",
  };
}
export function contractMissing(d: ContractData) {
  const issues: string[] = [];
  for (const [k, label] of Object.entries({
    company: "Razão social",
    address: "Endereço",
    representative: "Representante",
    role: "Cargo",
    email: "E-mail",
    city: "Local",
    purpose: "Finalidade da consulta",
  }))
    if (!String((d as any)[k] ?? "").trim()) issues.push(label);
  if (!/^(\d{11}|\d{14})$/.test(d.cnpj.replace(/\D/g, "")))
    issues.push("CNPJ/CPF do cliente");
  if (d.cpf.replace(/\D/g, "").length !== 11)
    issues.push("CPF do representante");
  if (!validDate(d.date)) issues.push("Data");
  if (!validDate(d.authorizationEnd) || d.authorizationEnd < d.date)
    issues.push("Fim da autorização");
  if (
    !d.institutions.length ||
    d.institutions.some(
      (i) => !i.name.trim() || i.cnpj.replace(/\D/g, "").length !== 14,
    )
  )
    issues.push("Instituições consulentes identificadas com CNPJ");
  return issues;
}
export const decimal = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function contractSections(t: ContractTemplate, d: ContractData) {
  const a = d.successEnabled ? d.success : 0,
    b = d.restructureEnabled ? d.restructure : 0;
  const tokens: Record<string, string> = {
    setup:
      decimal(d.setupEnabled ? d.setup : 0) +
      (d.setupEnabled ? "" : " (cobrança dispensada)"),
    success:
      decimal(a) + "%" + (d.successEnabled ? "" : " (cobrança dispensada)"),
    restructure:
      decimal(b) + "%" + (d.restructureEnabled ? "" : " (cobrança dispensada)"),
    halfSuccess: decimal(a / 2) + "%",
    halfRestructure: decimal(b / 2) + "%",
    exampleFull: decimal(1000 * b),
    exampleHalf: decimal(500 * b),
    payment: t.paymentDetails,
  };
  return t.sections.map((s) => ({
    ...s,
    text: s.text.replace(
      /\{\{(\w+)\}\}/g,
      (_, k) => tokens[k] ?? "Não informado",
    ),
  }));
}
