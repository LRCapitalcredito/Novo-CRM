import { test } from "node:test";
import assert from "node:assert/strict";
import { newOperation, type Operation, type WorkspaceState } from "../src/domain";
import type { WorkspaceRecord } from "../src/records";
import { portfolioIndex, matchesAttention, normalizeSearch, priorityOrder } from "../src/portfolio";

const op = (id: string, patch: Partial<Operation> = {}): Operation => ({ ...newOperation(), id, owner: "Equipe", company: "Empresa de teste", stage: "Análise", version: 1, createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-25T12:00:00Z", ...patch });
const link = (operationId: string, dueDate: string, active = true): WorkspaceRecord => ({ id: `${operationId}-${dueDate}`, kind: "placement", operationId, data: { institution: "Instituição Árvore", manager: "José", active, dueDate }, version: 1, createdAt: "2026-09-01", updatedAt: "2026-09-25" });

test("radar considera prazos ativos das instituições sem duplicar o cliente", () => {
  const state: WorkspaceState = { activities: [], operations: [op("client-a", { dueDate: "2026-09-25" })], records: [link("client-a", "2026-09-23"), link("client-a", "2026-09-22"), link("client-a", "2026-09-01", false)] };
  const [row] = portfolioIndex(state, "2026-09-25");
  assert.equal(row.nextDue, "2026-09-22");
  assert.equal(row.late, true);
  assert.equal(row.dueToday, true);
  assert.equal(row.unscheduled, false);
  assert.equal(portfolioIndex(state).length, 1);
  assert.equal(matchesAttention(row, "late"), true);
  assert.ok(row.search.includes(normalizeSearch("INSTITUICAO ARVORE")));
  assert.ok(row.search.includes("jose"));
});

test("concluídos, retomadas e datas de atualização não viram pendências de agenda", () => {
  const state: WorkspaceState = { activities: [], operations: [op("active"), op("done", { stage: "Crédito na Conta", dueDate: "2026-09-01" }), op("lost", { stage: "Perdido", dueDate: "2026-09-01" })], records: [link("done", "2026-09-23"), link("lost", "2026-09-23"), link("active", "2026-02-31")] };
  const [active, done, lost] = portfolioIndex(state, "2026-09-25");
  assert.equal(active.unscheduled, true);
  assert.equal(active.late, false);
  for (const row of [done, lost]) { assert.equal(row.late, false); assert.equal(row.unscheduled, false); assert.equal(row.nextDue, ""); }
});

test("prioridade exibe ativos com prazo vencido antes de futuras ações e retomadas", () => {
  const state: WorkspaceState = { activities: [], operations: [op("lost", { stage: "Perdido" }), op("future", { dueDate: "2026-10-01" }), op("late", { dueDate: "2026-09-01" }), op("no-date")] };
  assert.deepEqual(portfolioIndex(state, "2026-09-25").sort(priorityOrder).map((r) => r.operation.id), ["late", "future", "no-date", "lost"]);
});
