import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewStore } from "../server/preview";
import {
  newBank,
  newManager,
  validateDirectory,
  validateDataset,
  legacyMoney,
  whatsappUrl,
  directoryChanges,
} from "../src/directory";
const dataset = {
  clientes: [{ ID_CLIENTE: "c-1" }],
  operacoes: [{ ID_OPERACAO: "op-1" }],
  instituicoes_operacao: [
    {
      ID_INSTITUICAO: 123,
      NOME_INSTITUICAO: "Banco fictício",
      GERENTE: "Pessoa teste",
    },
    {
      ID_INSTITUICAO: 123,
      NOME_INSTITUICAO: "Banco fictício",
      GERENTE: "Pessoa teste",
    },
    {
      ID_INSTITUICAO: 0,
      NOME_INSTITUICAO: "INSTITUIÇÃO NÃO IDENTIFICADA",
      GERENTE: "Pessoa",
    },
  ],
  documentos: [
    {
      ID_DOCUMENTO: "doc-1",
      OBSERVACAO: "Não executar: apenas texto de origem",
    },
  ],
};
test("importação preserva tabelas, vincula gerente por banco e é idempotente", () => {
  const store = createPreviewStore(":memory:");
  const summary = store.directory.import(dataset, "teste.json");
  assert.equal(summary.banksCreated, 1);
  assert.equal(summary.managersCreated, 1);
  assert.equal(summary.unidentifiedLinks, 1);
  const records = store.directory.state().records;
  const bank = records.find((r) => r.kind === "bank")!;
  const manager = records.find((r) => r.kind === "manager")!;
  assert.equal(manager.kind === "manager" && manager.bankId, bank.id);
  assert.equal(bank.kind === "bank" && bank.acceptsRestriction, null);
  assert.deepEqual(
    store.directory.readImport(summary.id).documentos,
    dataset.documentos,
  );
  assert.equal(
    store.directory.import(dataset, "renomeado.json").repeated,
    true,
  );
  assert.equal(store.directory.state().records.length, 2);
  store.close();
});
test("importações posteriores não sobrescrevem cadastros revisados", () => {
  const store = createPreviewStore(":memory:");
  store.directory.import(dataset, "teste.json");
  const bank = store.directory.state().records.find((r) => r.kind === "bank")!;
  store.directory.save({ ...bank, name: "Nome revisado" }, 1);
  store.directory.import(
    { ...dataset, historico: [{ ID_EVENTO: "e1" }] },
    "outro.json",
  );
  assert.equal(store.directory.get(bank.id)?.name, "Nome revisado");
  store.close();
});
test("cadastros recusam banco ausente, faixa invertida e sobreposição de versão", () => {
  const store = createPreviewStore(":memory:");
  const bank = { ...newBank(), name: "Banco teste" };
  store.directory.save(bank, null);
  assert.throws(() => store.directory.save(bank, null), /CONFLICT/);
  assert.throws(
    () =>
      store.directory.save(
        { ...newManager("bank-inexistente"), name: "Teste" },
        null,
      ),
    /não existe/,
  );
  assert.throws(
    () =>
      validateDirectory({
        ...newManager(bank.id),
        name: "Teste",
        minRevenueCents: 200,
        maxRevenueCents: 100,
      }),
    /máximo/,
  );
  const manager = store.directory.save(
    { ...newManager(bank.id), name: "Teste" },
    null,
  );
  assert.equal(manager.version, 1);
  store.directory.save({ ...bank, archived: true }, 1);
  assert.equal(store.directory.get(bank.id)?.archived, true);
  store.close();
});
test("condições desconhecidas não viram padrões e limites são verificados", () => {
  const bank = newBank();
  assert.equal(bank.kind === "bank" && bank.acceptsRestriction, null);
  assert.throws(() =>
    validateDirectory({
      ...bank,
      name: "Teste",
      guarantees: { Universal: { rate: "", termMonths: 60, ltvPercent: 101 } },
    }),
  );
  assert.throws(() =>
    validateDirectory({
      ...bank,
      name: "Teste",
      logoUrl: "javascript:alert(1)",
    }),
  );
  assert.throws(() =>
    validateDirectory({
      ...newManager("bank-test"),
      name: "Teste",
      serviceScope: "states",
      servedStates: [],
    }),
  );
  assert.equal(legacyMoney("2.000.000,50"), 200000050);
  assert.equal(legacyMoney(0), 0);
  assert.equal(legacyMoney(""), null);
  assert.equal(whatsappUrl("51999990000"), "https://wa.me/5551999990000");
  assert.equal(whatsappUrl("123"), null);
  assert.throws(() => validateDataset({ senha: "não é arquivo de pipeline" }));
});

test("histórico compara o conteúdo das garantias sem depender da ordem das chaves", () => {
  const store = createPreviewStore(":memory:");
  const bank = newBank();
  assert.ok(bank.kind === "bank");
  const input = { ...bank, name: "Banco fictício", guarantees: { Universal: { rate: "1,5%", termMonths: 60, ltvPercent: 70 } } };
  const saved = store.directory.save(input, null);
  const reordered = { ...input, guarantees: { Universal: { ltvPercent: 70, rate: "1,5%", termMonths: 60 } } };
  assert.deepEqual(directoryChanges(saved, reordered), []);
  assert.deepEqual(directoryChanges(saved, { ...reordered, guarantees: { Universal: { rate: "1,6%", termMonths: 60, ltvPercent: 70 } } }), ["guarantees"]);
  store.close();
});
