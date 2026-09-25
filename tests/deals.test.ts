import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDeal, validateDeal, dealMetrics } from "../src/deals";
import { validateRecord, recordInput } from "../src/records";
import { newOperation, validateOperation } from "../src/domain";
import { matchesModality, portfolioIndex, isWorking } from "../src/portfolio";
import { createPreviewStore } from "../server/preview";

test("recebíveis separam limite disponível, volume da competência e comissão", () => {
  const deal = { ...emptyDeal(), creditLimitCents: 10000000, usedLimitCents: 2000000, period: "2026-09", periodVolumeCents: 3500000, commissionPercent: 1.5 };
  validateDeal(deal);
  assert.deepEqual(dealMetrics(deal, null), { availableCents: 8000000, commissionCents: 52500, ltvPercent: null });
  assert.equal(dealMetrics({ ...deal, usedLimitCents: 12000000 }, null).availableCents, -2000000);
  assert.equal(dealMetrics({ ...deal, period: "" }, null).commissionCents, null);
  assert.throws(() => validateDeal({ ...deal, period: "" }), /competência/);
});
test("ausências não viram zero e LTV exige garantia positiva", () => {
  assert.deepEqual(dealMetrics(emptyDeal(), null), { availableCents: null, commissionCents: null, ltvPercent: null });
  assert.equal(dealMetrics({ ...emptyDeal(), collateralValueCents: 20000000 }, 10000000).ltvPercent, 50);
  assert.equal(dealMetrics({ ...emptyDeal(), collateralValueCents: 20000000 }, 0).ltvPercent, 0);
  assert.equal(dealMetrics({ ...emptyDeal(), collateralValueCents: 0 }, 10000000).ltvPercent, null);
  for (const patch of [{ monthlyRatePercent: NaN }, { commissionPercent: 101 }, { termMonths: 1.5 }, { period: "2026-13" }, { creditLimitCents: -1 }, { usedLimitCents: 1.5 }]) assert.throws(() => validateDeal({ ...emptyDeal(), ...patch }));
});
test("vínculo exige validação das condições sem invalidar registros antigos", () => {
  const placement = recordInput("placement", "client-test", { bankId: "", institution: "", managerId: "", manager: "", status: "Não enviado", product: "", requestedCents: null, approvedCents: null, notes: "", nextAction: "", dueDate: "", active: false });
  assert.doesNotThrow(() => validateRecord(placement));
  assert.doesNotThrow(() => validateRecord({ ...placement, data: { ...placement.data, deal: emptyDeal() } }));
  assert.throws(() => validateRecord({ ...placement, data: { ...placement.data, deal: { ...emptyDeal(), monthlyRatePercent: -1 } } }));
});
test("modalidades usam classificação explícita, aceitam múltiplos produtos e não inferem pelo texto legado", () => {
  const operation = { ...newOperation(), company: "Teste", owner: "Equipe", product: "Não informado" as const, version: 1, createdAt: "", updatedAt: "" };
  const oldLink = { ...recordInput("placement", operation.id, { product: "Home equity", active: true }), version: 1, createdAt: "", updatedAt: "" };
  let [row] = portfolioIndex({ operations: [operation], activities: [], records: [oldLink] });
  assert.equal(matchesModality(row, "Home equity"), false);
  assert.equal(matchesModality(row, "A classificar"), true);
  [row] = portfolioIndex({ operations: [{ ...operation, product: "Capital de giro" }], activities: [], records: [{ ...oldLink, data: { ...oldLink.data, deal: { ...emptyDeal(), modality: "Home equity" } } }] });
  assert.equal(matchesModality(row, "Captação de crédito"), true);
  assert.equal(matchesModality(row, "Home equity"), true);
  assert.equal(matchesModality(row, "A classificar"), false);
  assert.equal(isWorking({ ...operation, stage: "Negado" }), false);
});
test("alteração de status e modalidade preserva cadastro, vínculos e auditoria; versão antiga é recusada", () => {
  const store = createPreviewStore(":memory:");
  try {
    const first = store.save(validateOperation({ ...newOperation(), company: "Empresa de teste", owner: "Equipe", stage: "Aguardando Assinatura", notes: "Preservar observações", requestedCents: 1234500 }), null);
    store.records.save(recordInput("profile", first.id, { address: "Endereço de teste", city: "", state: "", segment: "" }), null);
    const second = store.save({ ...first, stage: "Contrato Assinado" }, first.version);
    const third = store.save({ ...second, product: "Crédito estruturado" }, second.version);
    assert.equal(third.stage, "Contrato Assinado");
    assert.equal(third.notes, first.notes);
    assert.equal(third.requestedCents, first.requestedCents);
    assert.equal(store.state().records?.length, 1);
    assert.equal(store.state().activities.length, 3);
    assert.ok(store.state().activities.some((a) => a.before?.stage === "Aguardando Assinatura" && a.after.stage === "Contrato Assinado"));
    assert.throws(() => store.save({ ...first, stage: "Parado" }, first.version), /CONFLICT/);
    assert.equal(store.state().operations[0].stage, "Contrato Assinado");
    assert.equal(store.state().activities.length, 3);
  } finally { store.close(); }
});
