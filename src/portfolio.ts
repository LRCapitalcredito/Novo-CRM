import { type Operation, type WorkspaceState, today } from "./domain";
import { isInactive, type WorkspaceRecord } from "./records";
import { followUps } from "./workflow";

export const normalizeSearch = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export const isWorking = (op: Operation) => !isInactive(op.stage) && !["Liberado", "Crédito na Conta"].includes(op.stage);
export type Attention = "all" | "late" | "today" | "unscheduled";
export const modalityGroups = ["Todas as modalidades", "Captação de crédito", "Antecipação de recebíveis", "Home equity", "Outras possibilidades", "A classificar"] as const;
export type ModalityGroup = (typeof modalityGroups)[number];
export function matchesModality(row: PortfolioEntry, group: ModalityGroup) {
  const values = [row.operation.product, ...row.links.map((r) => r.data.deal?.modality)].filter((p) => p && p !== "Não informado");
  if (group === "Todas as modalidades") return true;
  if (group === "A classificar") return values.length === 0;
  if (group === "Captação de crédito") return values.some((p) => ["Capital de giro", "Crédito estruturado", "Financiamento", "Crédito rural"].includes(p));
  if (group === "Outras possibilidades") return values.some((p) => ["Reestruturação de dívida", "Outras modalidades"].includes(p));
  return values.includes(group);
}
export function portfolioIndex(state: WorkspaceState, date = today()) {
  const placements = new Map<string, WorkspaceRecord[]>();
  const datesByClient = new Map<string, string[]>();
  for (const item of followUps(state, date)) { if (item.dueDate) { const dates = datesByClient.get(item.operationId) ?? []; dates.push(item.dueDate); datesByClient.set(item.operationId, dates); } }
  for (const record of state.records ?? []) {
    if (record.kind !== "placement") continue;
    const current = placements.get(record.operationId) ?? [];
    current.push(record);
    placements.set(record.operationId, current);
  }
  return state.operations.map((operation) => {
    const links = placements.get(operation.id) ?? [];
    // Datas de atualização não representam compromissos. Somente prazos explícitos.
    const dates = isWorking(operation) ? (datesByClient.get(operation.id) ?? []).sort() : [];
    return { operation, links, nextDue: dates[0] ?? "", late: dates.some((d) => d < date), dueToday: dates.includes(date), unscheduled: isWorking(operation) && dates.length === 0,
      search: normalizeSearch([operation.company, operation.cnpj, operation.owner, operation.nextAction, operation.contact, ...links.flatMap((r) => [r.data.institution, r.data.manager])].join(" ")) };
  });
}
export type PortfolioEntry = ReturnType<typeof portfolioIndex>[number];
export function priorityOrder(a: PortfolioEntry, b: PortfolioEntry) {
  return Number(isWorking(b.operation)) - Number(isWorking(a.operation)) || Number(b.late) - Number(a.late) || (a.nextDue || "9999").localeCompare(b.nextDue || "9999");
}
export function matchesAttention(row: PortfolioEntry, filter: Attention) {
  return filter === "all" || (filter === "late" && row.late) || (filter === "today" && row.dueToday) || (filter === "unscheduled" && row.unscheduled);
}
export function stageTone(stage: string) {
  if (isInactive(stage)) return "neutral";
  const normalized = normalizeSearch(stage);
  if (/aprovado.*negado/.test(normalized)) return "purple";
  if (/aprovado|liberado|credito na conta/.test(normalized)) return "green";
  if (/mesa|assinatura|contrato/.test(normalized)) return "gold";
  if (/analise|diagnostico/.test(normalized)) return "purple";
  if (/document|triagem/.test(normalized)) return "blue";
  return "neutral";
}
