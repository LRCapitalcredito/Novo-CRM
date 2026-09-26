import { today, validDate, type Operation, type WorkspaceState } from "./domain";
import type { RecordInput, WorkspaceRecord } from "./records";

export const documentStatuses = ["A solicitar", "Solicitado", "Recebido", "Em conferência", "Conferido", "A corrigir", "Dispensado"] as const;
export const categories = ["Cadastro", "Contábil", "Faturamento", "Endividamento", "Fiscal", "Garantias", "Recebíveis", "Sócios", "Outros"] as const;
export const signatureChecks = ["Não verificada", "Conferência visual", "Validação externa registrada", "Não aplicável"] as const;
export const waitingParties = ["LR Capital", "Cliente / contador", "Instituição"] as const;
export interface DocumentFile { id: string; name: string; mime: string; size: number; sha256: string; uploadedAt: string }
export const workflowKinds = ["document", "task", "dispatch"] as const;
export const isWorkflowKind = (kind: string) => (workflowKinds as readonly string[]).includes(kind);
export function safeDocumentUrl(value: string) {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}
export const expiredDocument = (d: WorkspaceRecord, date = today()) => !!d.data.expiresOn && d.data.expiresOn < date;
export const readyDocument = (d: WorkspaceRecord, date = today()) => d.kind === "document" && !d.data.archived && d.data.status === "Conferido" && !expiredDocument(d, date) && (!!d.data.sourceUrl || d.data.files?.length > 0);
export const pendingDocument = (d: WorkspaceRecord, date = today()) => d.kind === "document" && !d.data.archived && d.data.required && d.data.status !== "Dispensado" && !readyDocument(d, date);
export const openTask = (r: WorkspaceRecord) => r.kind === "task" && r.data.status === "Aberta";
export const openDispatch = (r: WorkspaceRecord) => r.kind === "dispatch" && !["Concluído", "Cancelado"].includes(r.data.status);
export function newDocument(op: Operation) {
  return { title: "", category: "Outros", entity: op.company, period: "", requirement: "Exigência a confirmar com a instituição", templateKey: "", placementId: "", status: "A solicitar", owner: op.owner, dueDate: "", expiresOn: "", requestedOn: "", sourceUrl: "", reviewNotes: "", signatureCheck: "Não verificada", required: true, archived: false, files: [] as DocumentFile[] };
}
export function newTask(op: Operation) { return { title: "", owner: op.owner, waitingOn: "LR Capital", placementId: "", dueDate: "", status: "Aberta", notes: "", completedOn: "" }; }
export function validateWorkflow(input: RecordInput) {
  const d = input.data;
  const text = (k: string, max = 2000, required = false) => { if (typeof d[k] !== "string" || d[k].length > max || (required && !d[k].trim())) throw new Error(`Preencha corretamente o campo ${k}.`); };
  const date = (k: string, required = false) => { text(k, 10, required); if (d[k] && !validDate(d[k])) throw new Error("Informe uma data válida."); };
  if (input.kind === "document") {
    for (const k of ["title", "owner", "entity"]) text(k, 200, true);
    for (const k of ["period", "templateKey", "placementId"]) text(k, 150);
    for (const k of ["requirement", "reviewNotes", "sourceUrl"]) text(k);
    for (const k of ["dueDate", "expiresOn", "requestedOn"]) date(k);
    if (d.requestedOn > today()) throw new Error("A solicitação registrada não pode estar no futuro.");
    if (!documentStatuses.includes(d.status) || !categories.includes(d.category) || !signatureChecks.includes(d.signatureCheck) || typeof d.required !== "boolean" || typeof d.archived !== "boolean") throw new Error("Situação documental inválida.");
    if (!safeDocumentUrl(d.sourceUrl)) throw new Error("Use um link HTTPS válido, sem senha na URL.");
    if (!Array.isArray(d.files) || d.files.length > 30 || d.files.some((f: any) => !/^[-\w]{6,100}$/.test(f.id) || typeof f.name !== "string" || f.name.length > 180 || !Number.isInteger(f.size) || f.size < 1 || f.size > 10485760 || !/^[a-f0-9]{64}$/.test(f.sha256) || typeof f.mime !== "string" || typeof f.uploadedAt !== "string")) throw new Error("Versão de arquivo inválida.");
    if (["Recebido", "Em conferência", "Conferido"].includes(d.status) && !d.files.length && !d.sourceUrl) throw new Error("Anexe o arquivo ou informe onde ele está guardado.");
    if (["Conferido", "A corrigir", "Dispensado"].includes(d.status) && !d.reviewNotes.trim()) throw new Error("Registre o resultado da conferência ou a justificativa.");
    if (d.status === "Conferido" && d.expiresOn && d.expiresOn < today()) throw new Error("O documento está vencido. Solicite uma atualização.");
    if (d.signatureCheck === "Validação externa registrada" && !d.reviewNotes.trim()) throw new Error("Registre a ferramenta, a data e a evidência da validação.");
  }
  if (input.kind === "task") {
    text("title", 200, true); text("owner", 200, true); text("notes"); text("placementId", 100); date("dueDate"); date("completedOn");
    if (!["Aberta", "Concluída", "Cancelada"].includes(d.status) || !waitingParties.includes(d.waitingOn)) throw new Error("Situação da tarefa inválida.");
    if (d.status === "Concluída" && (!d.completedOn || !d.notes.trim())) throw new Error("Registre a data e o resultado da tarefa concluída.");
    if (d.completedOn > today()) throw new Error("A conclusão não pode estar no futuro.");
  }
  if (input.kind === "dispatch") {
    text("placementId", 100, true); text("recipient", 200, true); text("channel", 100, true); text("notes"); text("nextAction", 2000, true); text("owner", 200, true); date("sentOn", true); date("followUpOn", true);
    if (d.sentOn > today() || d.followUpOn < d.sentOn) throw new Error("Confira a data de envio e o prazo de retorno.");
    if (!["Aguardando retorno", "Em análise", "Pendência", "Concluído", "Cancelado"].includes(d.status)) throw new Error("Situação do envio inválida.");
    if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > 100 || new Set(d.items.map((x: any) => x.documentId)).size !== d.items.length) throw new Error("Selecione documentos conferidos, sem duplicar itens.");
    for (const item of d.items) if (!/^[-\w]{6,100}$/.test(item.documentId) || !Number.isInteger(item.version) || item.version < 1 || typeof item.title !== "string" || item.title.length > 200 || typeof item.fileId !== "string" || typeof item.sourceUrl !== "string" || !safeDocumentUrl(item.sourceUrl)) throw new Error("Documento do envio inválido.");
    if (["Concluído", "Cancelado"].includes(d.status) && !d.notes.trim()) throw new Error("Registre o resultado ou o motivo do encerramento.");
  }
}
export function validateWorkflowLinks(input: RecordInput, old: WorkspaceRecord | null, related: WorkspaceRecord[], allowNewFile = false) {
  if (!isWorkflowKind(input.kind)) return;
  const d = input.data, find = (id: string) => related.find((r) => r.id === id);
  if (d.placementId) { const placement = find(d.placementId); if (!placement || placement.kind !== "placement" || placement.operationId !== input.operationId) throw new Error("A instituição precisa estar vinculada a este cliente."); }
  if (input.kind === "document" && !allowNewFile && JSON.stringify(d.files) !== JSON.stringify(old?.data.files ?? [])) throw new Error("Os arquivos são preservados. Use o botão de anexar uma nova versão.");
  if (input.kind === "dispatch") {
    if (old) {
      for (const k of ["items", "placementId", "recipient", "channel", "sentOn"]) if (JSON.stringify(old.data[k]) !== JSON.stringify(d[k])) throw new Error("O envio registrado é preservado. Registre um novo envio para novos documentos.");
    } else {
      for (const item of d.items) {
        const doc = find(item.documentId);
        if (!doc || doc.operationId !== input.operationId || !readyDocument(doc) || doc.version !== item.version || (doc.data.placementId && doc.data.placementId !== d.placementId)) throw new Error("Um documento mudou, está pendente ou pertence a outra instituição. Revise a seleção.");
        if (item.title !== doc.data.title || item.fileId !== (doc.data.files.at(-1)?.id ?? "") || item.sourceUrl !== doc.data.sourceUrl) throw new Error("A versão do documento no envio está desatualizada.");
      }
    }
  }
}
export function documentChecklist(product: string, year = new Date().getFullYear()) {
  const base = [
    ["cadastro", "CNPJ e contrato social consolidado", "Cadastro", "Atual", "Conferir entidade, sócios e poderes de representação."],
    ["contabil", "Balanço e DRE dos exercícios encerrados", "Contábil", `${year - 2} e ${year - 1}`, "Conferir páginas, unidade, entidade, assinaturas e somatórios."],
    ["balancete", "Balancete e DRE acumulada", "Contábil", `Corte recente de ${year}`, "Confirmar a data-base exigida pela instituição."],
    ["receita", "Faturamento mensal", "Faturamento", `${year - 2} até o mês fechado mais recente`, "Uma série completa pode atender mais de um período; conferir assinaturas exigidas."],
    ["dividas", "Mapa de endividamento e contratos", "Endividamento", "Posição atual", "Saldos, parcelas, vencimentos, garantias, antecipações e coobrigação."],
    ["pedido", "Finalidade e condições pretendidas", "Outros", "Operação atual", "Valor, uso dos recursos, prazo, carência e garantias propostas."],
  ];
  const extra = product === "Home equity" ? [
    ["matricula", "Matrícula do imóvel e ônus", "Garantias", "Atualidade a confirmar", "Conferir titularidade, ônus e exigências da instituição."],
    ["avaliacao", "Avaliação e identificação do imóvel", "Garantias", "Data do laudo", "Distinguir avaliação de mercado, valor declarado e garantia disponível."],
    ["proprietarios", "Cadastro dos proprietários e intervenientes", "Sócios", "Atual", "Documentação civil e consentimentos somente quando pertinentes."],
  ] : product === "Antecipação de recebíveis" ? [
    ["carteira", "Carteira de recebíveis e concentração", "Recebíveis", "Posição atual", "Sacados, vencimentos, concentração, atrasos e duplicidades."],
    ["lastro", "Documentos de lastro", "Recebíveis", "Títulos selecionados", "Notas fiscais, duplicatas, contratos e comprovação de entrega conforme a operação."],
    ["cessoes", "Cessões, travas e antecipações existentes", "Recebíveis", "Posição atual", "Confirmar comprometimento dos títulos e coobrigação."],
  ] : [];
  return [...base, ...extra].map(([key, title, category, period, requirement]) => ({ key, title, category, period, requirement }));
}
export async function checklistId(operationId: string, key: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${operationId}:${key}`));
  return "doc-" + Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function requestDraft(op: Operation, docs: WorkspaceRecord[]) {
  return `Olá! Para avançarmos no acompanhamento de ${op.company}, precisamos dos seguintes itens:\n\n${docs.map((r) => `• ${r.data.title} — ${r.data.entity}${r.data.period ? `; período: ${r.data.period}` : ""}${r.data.dueDate ? `; prazo combinado: ${r.data.dueDate.split("-").reverse().join("/")}` : ""}. ${r.data.status === "A corrigir" ? r.data.reviewNotes : r.data.requirement}`).join("\n")}\n\nPor favor, encaminhe os arquivos pelo canal combinado com a LR Capital. Se algum item não se aplicar, nos avise para ajustarmos a solicitação. Após o recebimento, faremos a conferência e informaremos os próximos passos.`;
}
export function clientUpdateDraft(op: Operation, records: WorkspaceRecord[], date = today()) {
  const docs = records.filter((r) => r.operationId === op.id && r.kind === "document" && !r.data.archived);
  const sent = records.filter((r) => r.operationId === op.id && r.kind === "dispatch");
  const tasks = records.filter((r) => r.operationId === op.id && openTask(r));
  return `Acompanhamento LR Capital — ${op.company}\nAtualização: ${date.split("-").reverse().join("/")}\n\nEtapa registrada: ${op.stage}.\n${docs.length ? `Documentação: ${docs.filter((d) => readyDocument(d, date)).length} item(ns) conferido(s); ${docs.filter((d) => pendingDocument(d, date)).length} pendência(s) obrigatória(s).` : "Checklist documental ainda não preparado."}\nEncaminhamentos registrados: ${sent.length}.\n\nPróximos passos:\n${tasks.length ? tasks.map((r) => `• ${r.data.title}${r.data.dueDate ? ` — ${r.data.dueDate.split("-").reverse().join("/")}` : " — prazo a combinar"}.`).join("\n") : op.nextAction || "Alinhar o próximo retorno com a equipe."}\n\n${openDispatchCount(sent) ? "Há retorno(s) de instituição em acompanhamento. " : ""}As condições e a decisão de crédito dependem da análise da instituição.`;
}
const openDispatchCount = (rows: WorkspaceRecord[]) => rows.filter(openDispatch).length;
export interface FollowUp { id: string; operationId: string; company: string; title: string; owner: string; party: string; dueDate: string; type: string }
export function followUps(state: WorkspaceState, date = today()): FollowUp[] {
  const result: FollowUp[] = [];
  const byClient = new Map<string, WorkspaceRecord[]>();
  for (const record of state.records ?? []) { const rows = byClient.get(record.operationId) ?? []; rows.push(record); byClient.set(record.operationId, rows); }
  for (const op of state.operations) {
    const working = !["Parado", "Perdido", "Negado", "Sem Interesse", "Retomada", "Liberado", "Crédito na Conta", "No Show"].includes(op.stage);
    if (working) result.push({ id: op.id, operationId: op.id, company: op.company, title: op.nextAction || "Definir retorno do cliente", owner: op.owner, party: "LR Capital", dueDate: op.dueDate, type: "Cliente" });
    for (const r of byClient.get(op.id) ?? []) {
      const d = r.data;
      let row: Partial<FollowUp> | null = null;
      if (r.kind === "placement" && working && d.active && (d.dueDate || d.nextAction)) row = { title: d.nextAction || `Retorno de ${d.institution}`, dueDate: d.dueDate, party: "Instituição", type: "Instituição" };
      if (openTask(r)) row = { title: d.title, dueDate: d.dueDate, party: d.waitingOn, type: "Tarefa" };
      if (pendingDocument(r, date)) row = { title: `${expiredDocument(r, date) ? "Atualizar" : ["Recebido", "Em conferência"].includes(d.status) ? "Conferir" : "Solicitar"}: ${d.title}`, dueDate: expiredDocument(r, date) ? d.expiresOn : d.dueDate, party: !expiredDocument(r, date) && ["Recebido", "Em conferência"].includes(d.status) ? "LR Capital" : "Cliente / contador", type: "Documento" };
      if (openDispatch(r)) row = { title: d.nextAction, dueDate: d.followUpOn, party: "Instituição", type: "Envio" };
      if (row) result.push({ id: r.id, operationId: op.id, company: op.company, owner: d.owner || op.owner, title: "", party: "LR Capital", dueDate: "", type: "", ...row });
    }
  }
  return result.filter((r) => !r.dueDate || validDate(r.dueDate)).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || a.company.localeCompare(b.company, "pt-BR"));
}
