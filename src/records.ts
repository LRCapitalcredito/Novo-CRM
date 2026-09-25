import { validDate } from "./domain";
import { simulateCredit } from "./credit";
import { narrativeFields, numericFields } from "./diagnosis";
import { validateDeal } from "./deals";
export type RecordKind =
  | "profile"
  | "placement"
  | "contract"
  | "diagnosis"
  | "template"
  | "simulation";
export interface WorkspaceRecord {
  id: string;
  kind: RecordKind;
  operationId: string;
  data: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type RecordInput = Omit<
  WorkspaceRecord,
  "version" | "createdAt" | "updatedAt"
>;
export interface RecordEvent {
  id: string;
  recordId: string;
  operationId: string;
  kind: RecordKind;
  actor: string;
  at: string;
  version: number;
  changes: string[];
}
export function validateRecord(raw: any): RecordInput {
  if (
    !raw ||
    ![
      "profile",
      "placement",
      "contract",
      "diagnosis",
      "template",
      "simulation",
    ].includes(raw.kind) ||
    !/^[-\w]{6,100}$/.test(raw.id) ||
    !(
      (raw.operationId === "" && raw.kind === "template") ||
      /^[-\w]{6,80}$/.test(raw.operationId)
    ) ||
    !raw.data ||
    Array.isArray(raw.data) ||
    typeof raw.data !== "object" ||
    JSON.stringify(raw.data).length > 150000
  )
    throw new Error("Cadastro complementar inválido.");
  if (raw.kind === "placement") {
    if (raw.data.deal !== undefined) validateDeal(raw.data.deal);
    for (const key of [
      "bankId",
      "institution",
      "managerId",
      "manager",
      "status",
      "product",
      "notes",
      "nextAction",
      "dueDate",
    ])
      if (
        typeof raw.data[key] !== "string" ||
        raw.data[key].length >
          (["notes", "nextAction"].includes(key) ? 12000 : 300)
      )
        throw new Error("Campo inválido na atuação por instituição.");
    for (const key of ["requestedCents", "approvedCents"])
      if (
        raw.data[key] !== null &&
        (!Number.isSafeInteger(raw.data[key]) ||
          raw.data[key] < 0 ||
          raw.data[key] > 1e15)
      )
        throw new Error("Valor inválido na instituição.");
    if (typeof raw.data.active !== "boolean")
      throw new Error("Informe a situação da atuação.");
    if (raw.data.dueDate && !validDate(raw.data.dueDate))
      throw new Error("Prazo inválido.");
  }
  const d = raw.data;
  const text = (key: string, max = 4000) => {
    if (typeof d[key] !== "string" || d[key].length > max)
      throw new Error("Campo inválido: " + key);
  };
  const number = (v: unknown, max = 1e15) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max)
      throw new Error("Valor numérico inválido.");
  };
  if (raw.kind === "profile")
    for (const k of ["address", "city", "state", "segment"]) text(k, 500);
  if (raw.kind === "contract") {
    for (const k of [
      "company",
      "cnpj",
      "address",
      "representative",
      "cpf",
      "role",
      "email",
      "city",
      "date",
      "group",
      "purpose",
      "authorizationEnd",
      "status",
    ])
      text(k);
    number(d.setup, 1e9);
    number(d.success, 100);
    number(d.restructure, 100);
    for (const k of ["setupEnabled", "successEnabled", "restructureEnabled"])
      if (typeof d[k] !== "boolean") throw new Error("Cobrança inválida.");
    if (
      !validDate(d.date) ||
      (d.authorizationEnd &&
        (!validDate(d.authorizationEnd) || d.authorizationEnd < d.date))
    )
      throw new Error("Período da autorização inválido.");
    if (
      !Array.isArray(d.institutions) ||
      d.institutions.length > 100 ||
      d.institutions.some(
        (i: any) =>
          typeof i?.name !== "string" ||
          i.name.length > 160 ||
          typeof i?.cnpj !== "string" ||
          i.cnpj.length > 18,
      )
    )
      throw new Error("Instituições autorizadas inválidas.");
  }
  if (raw.kind === "diagnosis") {
    text("analyst", 120);
    if (!validDate(d.referenceDate)) throw new Error("Data-base inválida.");
    if (
      !d.texts ||
      !d.numbers ||
      !d.monthly ||
      Array.isArray(d.texts) ||
      Array.isArray(d.numbers) ||
      Array.isArray(d.monthly)
    )
      throw new Error("Diagnóstico inválido.");
    for (const [k, v] of Object.entries(d.texts))
      if (!(k in narrativeFields) || typeof v !== "string" || v.length > 4000)
        throw new Error("Texto inválido no diagnóstico.");
    for (const [k, v] of Object.entries(d.numbers))
      if (
        !(k in numericFields) ||
        (v !== null &&
          (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e15))
      )
        throw new Error("Número inválido no diagnóstico.");
    if (Object.keys(d.monthly).length > 120)
      throw new Error("Limite de competências excedido.");
    for (const [k, v] of Object.entries(d.monthly)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k))
        throw new Error("Competência inválida.");
      if (v !== null) number(v);
    }
  }
  if (raw.kind === "simulation") {
    text("title", 200);
    simulateCredit(d.input);
  }
  if (raw.kind === "template") {
    for (const k of [
      "issuer",
      "issuerDocument",
      "issuerAddress",
      "issuerRepresentative",
      "issuerEmail",
      "paymentDetails",
    ])
      text(k);
    if (
      !Array.isArray(d.sections) ||
      d.sections.length < 1 ||
      d.sections.length > 30 ||
      d.sections.some(
        (s: any) =>
          typeof s?.heading !== "string" ||
          typeof s?.text !== "string" ||
          s.heading.length > 200 ||
          s.text.length > 30000,
      )
    )
      throw new Error("Modelo de contrato inválido.");
  }
  return {
    id: raw.id,
    kind: raw.kind,
    operationId: raw.operationId,
    data: raw.data,
  };
}
export const findRecord = (
  records: WorkspaceRecord[],
  kind: RecordKind,
  operationId: string,
) => records.find((r) => r.kind === kind && r.operationId === operationId);
export const recordInput = (
  kind: RecordKind,
  operationId: string,
  data: Record<string, any>,
  id?: string,
): RecordInput => ({
  id: id ?? `${kind}-${operationId}`,
  kind,
  operationId,
  data,
});
export const originStatuses: Record<string, string> = {
  "101": "Questionário",
  "1": "Contrato Assinado",
  "109": "Pagamento Recebido",
  "2": "Captação de Documentos",
  "201": "Triagem e Validação",
  "3": "Diagnóstico Estratégico",
  "4": "Análise Bancos",
  "202": "Mesa de Crédito",
  "8": "Aprovado / Negado",
  "901": "Assinatura Banco",
  "902": "Crédito na Conta",
  "6": "Parado",
  "7": "Perdido",
  "100": "Novo",
  "113": "Novo Cliente",
  "105": "Reunião Agendada",
  "106": "Reunião Realizada",
  "107": "Aguardando Assinatura",
  "112": "Enviar E-mail",
  "111": "E-mail Enviado",
  "102": "WhatsApp Enviado",
  "110": "Apresentar para o gerente",
  sem_interesse: "Sem Interesse",
  email_incorreto: "E-mail Incorreto",
  no_show: "No Show",
};
export const statusLabel = (v: unknown) =>
  originStatuses[String(v)] ?? String(v || "Não informado");
export const isInactive = (s: string) =>
  /^(parado|perdido|negado|sem interesse|não enviado|nao enviado|no show|retomada)$/i.test(
    s.trim(),
  );
