import { money, type Operation } from "./domain";
import type { Bank, Manager } from "./directory";
import { warrantyKinds } from "./warrantyKinds";
import type { RecordInput, WorkspaceRecord } from "./records";

export const placementStatuses = ["Não enviado", "Em preparação", "Pendência", "Em análise", "Mesa de crédito", "Aprovado", "Contratado", "Liberado", "Negado", "Parado", "Perdido"];
export const normalizeCriterion = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
export const clientWarrantyKinds = warrantyKinds.filter(k => k !== "Universal");
export function offeredGuarantees(profile: Record<string, any>) : string[] {
  if (Array.isArray(profile.offeredGuarantees)) return profile.offeredGuarantees;
  return [...new Set<string>((Array.isArray(profile.guarantees) ? profile.guarantees : []).filter((g: any) => g.DISPONIVEL_PARA_OPERACAO !== false).map((g: any) => g.TIPO_GARANTIA).filter((s: any) => clientWarrantyKinds.includes(s)))];
}
type Issue = { key: string; level: "conflict" | "pending"; message: string };
export type InstitutionFit = ReturnType<typeof institutionFit>;
export function distanceContext(profile: Record<string, any>, manager: Manager) {
  return JSON.stringify([normalizeCriterion(profile.city || ""), profile.state || "", normalizeCriterion(manager.city), manager.state, manager.radiusKm]);
}
export function institutionFit(op: Pick<Operation, "revenueCents">, profile: Record<string, any>, bank?: Bank, manager?: Manager, placement: Record<string, any> = {}) {
  const issues: Issue[] = [];
  const add = (key: string, level: Issue["level"], message: string) => issues.push({key, level, message});
  if (!bank) add("bank", "pending", "Selecione a instituição e confira sua política.");
  else {
    if (bank.archived) add("bank", "conflict", "A instituição está arquivada.");
    const accepted = Object.keys(bank.guarantees), offered = offeredGuarantees(profile);
    const matches = offered.some(g => accepted.includes(g) || (accepted.includes("Imóveis (Geral)") && ["Imóvel Urbano", "Imóvel Rural", "Imóvel Operacional"].includes(g)));
    if (!accepted.length || accepted.includes("Universal")) add("guarantees", "pending", "Garantias aceitas ainda precisam ser especificadas pelo banco.");
    else if (!offered.length && !Array.isArray(profile.offeredGuarantees)) add("guarantees", "pending", "Confirme as garantias que o cliente disponibilizará.");
    else if (!matches) {
      if (offered.includes("Imóveis (Geral)") && accepted.some(g => g.startsWith("Imóvel "))) add("guarantees", "pending", "Especifique o tipo do imóvel do cliente antes de confirmar a aderência.");
      else add("guarantees", "conflict", `Cliente: ${offered.join(", ") || "sem garantia disponível"}. Banco aceita: ${accepted.join(", ")}. O cliente disponibilizará uma garantia aceita ou o banco alterou a política?`);
    } else if (!Array.isArray(profile.offeredGuarantees)) add("guarantees", "pending", "Há garantia compatível na base importada; confirme sua disponibilidade com o cliente.");
    if (profile.restriction === "Com restrições" && bank.acceptsRestriction === false) add("restriction", "conflict", "O cliente tem restrições e a instituição não aceita essa condição.");
    else if (bank.acceptsRestriction !== true && !["Sem restrições"].includes(profile.restriction)) add("restriction", "pending", "Confirme a situação de restrição do cliente e a política da instituição.");
  }
  if (!manager) add("manager", "pending", "Selecione o gerente para conferir faturamento e área de atendimento.");
  else {
    if (manager.archived || (bank && manager.bankId !== bank.id)) add("manager", "conflict", "O gerente está arquivado ou pertence a outra instituição.");
    const min = manager.minRevenueCents, max = manager.maxRevenueCents, revenue = op.revenueCents;
    if (revenue === null) add("revenue", "pending", "Informe o faturamento anual do cliente.");
    if (min === null && max === null) add("revenue", "pending", "O target de faturamento anual do gerente não foi informado.");
    if (revenue !== null && ((min !== null && revenue < min) || (max !== null && revenue > max))) add("revenue", "conflict", `Faturamento anual ${money(revenue)} fora do target: ${min === null ? "sem mínimo cadastrado" : "a partir de " + money(min)}; ${max === null ? "sem máximo cadastrado" : "até " + money(max)}.`);
    const city = normalizeCriterion(profile.city || ""), state = profile.state || "";
    if (!manager.serviceScope) add("region", "pending", "A área de atendimento do gerente não foi informada.");
    else if (manager.serviceScope !== "national") {
      if (!state || (manager.serviceScope !== "states" && !city)) add("region", "pending", "Complete a cidade e a UF do cliente.");
      else if (manager.serviceScope === "states" && !manager.servedStates.includes(state)) add("region", "conflict", `Cliente em ${state}; gerente atende ${manager.servedStates.join(", ")}.`);
      else if (manager.serviceScope === "city" && (!manager.city || !manager.state)) add("region", "pending", "Complete a cidade e a UF atendidas pelo gerente.");
      else if (manager.serviceScope === "city" && (state !== manager.state || city !== normalizeCriterion(manager.city))) add("region", "conflict", `Cliente em ${profile.city}/${state}; gerente atende somente ${manager.city}/${manager.state}.`);
      else if (manager.serviceScope === "radius" && (state !== manager.state || city !== normalizeCriterion(manager.city))) {
        if (placement.distanceContext !== distanceContext(profile, manager) || typeof placement.distanceKm !== "number" || !placement.distanceSource?.trim()) add("region", "pending", `Confirme a distância até ${manager.city}/${manager.state}. Raio cadastrado: ${manager.radiusKm} km.`);
        else if (manager.radiusKm !== null && placement.distanceKm > manager.radiusKm) add("region", "conflict", `Distância confirmada de ${placement.distanceKm} km excede o raio de ${manager.radiusKm} km do gerente.`);
      }
    }
    if (manager.targetSegments?.length) {
      if (!profile.segment?.trim()) add("segment", "pending", "Informe o segmento de atuação do cliente.");
      else if (!manager.targetSegments.some(s => normalizeCriterion(s) === normalizeCriterion(profile.segment))) add("segment", "conflict", `Segmento ${profile.segment} fora dos segmentos do gerente: ${manager.targetSegments.join(", ")}.`);
    }
  }
  const conflicts = issues.filter(i => i.level === "conflict"), pending = issues.filter(i => i.level === "pending");
  return {issues, conflicts, pending, status: conflicts.length ? "conflict" as const : pending.length ? "pending" as const : "compatible" as const, label: conflicts.length ? "Divergência a resolver" : pending.length ? "Dados a confirmar" : "Aderente ao cadastro"};
}
export function needsFitCheck(input: RecordInput, old: WorkspaceRecord | null) {
  return input.kind === "placement" && (!old || input.data.bankId !== old.data.bankId || input.data.managerId !== old.data.managerId || (input.data.active && !old.data.active));
}
export function assertPlacementFit(input: RecordInput, old: WorkspaceRecord | null, op: Operation, profile: Record<string, any>, bank?: Bank, manager?: Manager) {
  if (!needsFitCheck(input, old)) return;
  if (!bank) throw Error("Selecione uma instituição cadastrada antes de vincular.");
  const fit = institutionFit(op, profile, bank, manager, input.data);
  if (fit.conflicts.length) throw Error("Vínculo bloqueado. Atualize os dados antes de continuar: " + fit.conflicts.map(i => i.message).join(" "));
}
export function validateFitProfile(data: Record<string, any>) {
  if (data.offeredGuarantees !== undefined && (!Array.isArray(data.offeredGuarantees) || data.offeredGuarantees.length > 14 || data.offeredGuarantees.some((g: any) => !clientWarrantyKinds.includes(g)))) throw Error("Garantias do cliente inválidas.");
  if (data.offeredGuarantees !== undefined && (typeof data.guaranteeConfirmation !== "string" || !data.guaranteeConfirmation.trim() || data.guaranteeConfirmation.length > 2000)) throw Error("Registre quem confirmou a disponibilidade das garantias e quando.");
}
