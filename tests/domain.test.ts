import { test } from "node:test";
import assert from "node:assert/strict";
import {
  money,
  parseMoney,
  validateOperation,
  validateProposal,
  validDate,
} from "../src/domain";
import { sampleOperations } from "../src/sample";
test("valores brasileiros, decimais e milhões preservam centavos", () => {
  assert.equal(parseMoney("R$ 2 milhões"), 200000000);
  assert.equal(parseMoney("2.000.000,00"), 200000000);
  assert.equal(parseMoney("2000000.00"), 200000000);
  assert.equal(parseMoney("1,25 milhão"), 125000000);
  assert.equal(parseMoney("850 mil"), 85000000);
  assert.equal(parseMoney("0,01"), 1);
});
test("ausência permanece nula, zero permanece zero e entradas ambíguas são recusadas", () => {
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("0"), 0);
  for (const v of [
    "-100",
    "1.2345",
    "2 mil e 500",
    "NaN",
    "Infinity",
    "100,5,5",
    "1e8",
  ])
    assert.throws(() => parseMoney(v));
});
test("datas impossíveis são recusadas", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-13-01"), false);
  assert.equal(validDate("2028-02-29"), true);
});
test("a exibição preserva valores com centavos", () => {
  assert.match(money(1), /0,01/);
  assert.match(money(12345), /123,45/);
  assert.equal(money(null), "Não informado");
});
test("proposta exige ID exato, versão atual e campos autorizados", () => {
  const ops = sampleOperations(),
    op = ops[0];
  const valid = {
    operationId: op.id,
    expectedVersion: op.version,
    reason: "Confirmado pelo responsável",
    changes: { nextAction: "Retornar amanhã" },
  };
  assert.equal(
    validateProposal(valid, ops).updated.nextAction,
    "Retornar amanhã",
  );
  assert.throws(() => validateProposal({ ...valid, operationId: "" }, ops));
  assert.throws(() =>
    validateProposal({ ...valid, operationId: "Atlas" }, ops),
  );
  assert.throws(() => validateProposal({ ...valid, expectedVersion: 0 }, ops));
  assert.throws(() =>
    validateProposal({ ...valid, changes: { company: "Outra empresa" } }, ops),
  );
  assert.throws(() =>
    validateProposal({ ...valid, changes: { requestedCents: -1 } }, ops),
  );
});
test("valor solicitado não modifica o aprovado e campos desconhecidos não são copiados", () => {
  const original = sampleOperations()[0];
  const value = validateOperation({
    ...original,
    requestedCents: 12300,
    password: "não copiar",
  });
  assert.equal(value.approvedCents, null);
  assert.equal(value.requestedCents, 12300);
  assert.equal("password" in value, false);
  assert.throws(() => validateOperation({ ...value, company: "" }));
});
