import { isInactive } from "./records";
export const stages = [
  "Novo",
  "Documentação",
  "Análise",
  "Mesa de crédito",
  "Aprovado",
  "Liberado",
  "Retomada",
  "Questionário",
  "Contrato Assinado",
  "Pagamento Recebido",
  "Captação de Documentos",
  "Triagem e Validação",
  "Diagnóstico Estratégico",
  "Análise Bancos",
  "Mesa de Crédito",
  "Aprovado / Negado",
  "Assinatura Banco",
  "Crédito na Conta",
  "Parado",
  "Perdido",
  "Sem Interesse",
  "Novo Cliente",
  "Reunião Agendada",
  "Reunião Realizada",
  "Aguardando Assinatura",
  "Enviar E-mail",
  "E-mail Enviado",
  "WhatsApp Enviado",
  "Apresentar para o gerente",
  "No Show",
  "Contrato",
  "Lead",
  "sem_restricao",
  "com_restricao",
  "Negado",
] as const;
export const products = [
  "Capital de giro",
  "Antecipação de recebíveis",
  "Home equity",
  "Financiamento",
  "Crédito estruturado",
  "Reestruturação de dívida",
  "Crédito rural",
  "Outras modalidades",
  "Não informado",
] as const;
export type Stage = (typeof stages)[number];
export type Product = (typeof products)[number];
export interface Operation {
  id: string;
  company: string;
  cnpj: string;
  contact: string;
  email: string;
  phone: string;
  product: Product;
  stage: Stage;
  owner: string;
  requestedCents: number | null;
  approvedCents: number | null;
  revenueCents: number | null;
  nextAction: string;
  dueDate: string;
  institution: string;
  notes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type OperationInput = Omit<
  Operation,
  "version" | "createdAt" | "updatedAt"
>;
export interface Activity {
  id: string;
  operationId: string;
  company: string;
  actor: string;
  at: string;
  action: string;
  before: Partial<Operation> | null;
  after: Partial<Operation>;
}
export interface WorkspaceState {
  records?: import("./records").WorkspaceRecord[];
  recordEvents?: import("./records").RecordEvent[];
  operations: Operation[];
  activities: Activity[];
  directory?: import("./directory").DirectoryState;
}
export interface Session {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "reader";
}
export function money(cents: number | null) {
  return cents === null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);
}
export function shortMoney(cents: number) {
  const reais = cents / 100;
  return reais >= 1e6
    ? `R$ ${(reais / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : money(cents);
}
export function parseMoney(input: string): number | null {
  let value = input.trim().toLocaleLowerCase("pt-BR");
  if (!value) return null;
  value = value.replace(/^r\$\s*/, "");
  const unit = value.match(/\s*(milhões|milhoes|milhão|milhao|mil)\s*$/);
  const multiplier = unit ? (unit[1] === "mil" ? 1000 : 1000000) : 1;
  if (unit) value = value.slice(0, unit.index).trim();
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value))
    normalized = value.replaceAll(".", "").replace(",", ".");
  else if (/^\d+(,\d{1,2})?$/.test(value)) normalized = value.replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value;
  else throw new Error("Informe um valor como 2.000.000,00 ou 2 milhões.");
  const result = Math.round(Number(normalized) * multiplier * 100);
  if (!Number.isSafeInteger(result) || result < 0 || result > 1e15)
    throw new Error("Valor fora do limite permitido.");
  return result;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function displayDate(value: string) {
  return value ? value.split("-").reverse().join("/") : "Sem prazo";
}
export function isLate(op: Operation) {
  return (
    !!op.dueDate &&
    op.dueDate < today() &&
    !isInactive(op.stage) &&
    !["Liberado", "Crédito na Conta"].includes(op.stage)
  );
}
export function validateOperation(value: unknown): OperationInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Operação inválida.");
  const v = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, max] of Object.entries({
    id: 80,
    company: 160,
    cnpj: 18,
    contact: 120,
    email: 180,
    phone: 40,
    owner: 100,
    nextAction: 12000,
    dueDate: 10,
    institution: 160,
    notes: 12000,
  })) {
    if (typeof v[key] !== "string" || v[key].length > max)
      throw new Error(`Campo inválido: ${key}.`);
    result[key] = v[key].trim();
  }
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(result.id as string))
    throw new Error("Identificador da operação inválido.");
  if (!(result.company as string) || !(result.owner as string))
    throw new Error("Empresa e responsável são obrigatórios.");
  if (
    result.cnpj &&
    !/^(\d{11}|\d{14})$/.test((result.cnpj as string).replace(/\D/g, ""))
  )
    throw new Error("Informe CNPJ com 14 dígitos ou CPF com 11 dígitos.");
  if (
    result.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email as string)
  )
    throw new Error("E-mail inválido.");
  if (result.dueDate && !validDate(result.dueDate as string))
    throw new Error("Data de retorno inválida.");
  if (
    !stages.includes(v.stage as Stage) ||
    !products.includes(v.product as Product)
  )
    throw new Error("Etapa ou produto inválido.");
  for (const key of ["requestedCents", "approvedCents", "revenueCents"]) {
    if (
      v[key] !== null &&
      (!Number.isSafeInteger(v[key]) ||
        Number(v[key]) < 0 ||
        Number(v[key]) > 1e15)
    )
      throw new Error(`Valor inválido: ${key}.`);
    result[key] = v[key];
  }
  return {
    ...result,
    stage: v.stage,
    product: v.product,
  } as unknown as OperationInput;
}
export function newOperation(): OperationInput {
  return {
    id: crypto.randomUUID(),
    company: "",
    cnpj: "",
    contact: "",
    email: "",
    phone: "",
    product: "Capital de giro",
    stage: "Novo",
    owner: "",
    requestedCents: null,
    approvedCents: null,
    revenueCents: null,
    nextAction: "",
    dueDate: "",
    institution: "",
    notes: "",
  };
}
export interface Proposal {
  operationId: string;
  expectedVersion: number;
  changes: Partial<
    Pick<
      Operation,
      "stage" | "nextAction" | "dueDate" | "requestedCents" | "approvedCents"
    >
  >;
  reason: string;
}
export function validateProposal(
  raw: unknown,
  operations: Operation[],
): { proposal: Proposal; operation: Operation; updated: OperationInput } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("A proposta deve ser um objeto JSON.");
  const p = raw as Proposal;
  if (typeof p.operationId !== "string" || !p.operationId)
    throw new Error("A proposta precisa do ID exato da operação.");
  const operation = operations.find((o) => o.id === p.operationId);
  if (!operation)
    throw new Error("Operação não encontrada. Use o ID do contexto exportado.");
  if (p.expectedVersion !== operation.version)
    throw new Error(
      "A operação mudou. Exporte um novo contexto e revise a proposta.",
    );
  if (
    !p.changes ||
    typeof p.changes !== "object" ||
    Array.isArray(p.changes) ||
    !Object.keys(p.changes).length
  )
    throw new Error("A proposta não contém alterações.");
  if (
    Object.keys(p.changes).some(
      (k) =>
        ![
          "stage",
          "nextAction",
          "dueDate",
          "requestedCents",
          "approvedCents",
        ].includes(k),
    )
  )
    throw new Error("A proposta contém campos não autorizados.");
  if (
    typeof p.reason !== "string" ||
    !p.reason.trim() ||
    p.reason.length > 1000
  )
    throw new Error("Inclua a justificativa da proposta.");
  return {
    proposal: p,
    operation,
    updated: validateOperation({ ...operation, ...p.changes }),
  };
}
