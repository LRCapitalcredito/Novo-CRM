import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultCredit,
  simulateCredit,
  monthDate,
  annualCost,
} from "../src/credit";
import {
  emptyDiagnosis,
  indicators,
  numberValue,
  extractLabeledText,
  applyExtraction,
} from "../src/diagnosis";
import {
  newContract,
  contractSections,
  contractMissing,
} from "../src/contracts";
import { contractPdf, diagnosisPdf, creditPdf } from "../src/pdf";
import { validateRecord, recordInput } from "../src/records";
import { createPreviewStore } from "../server/preview";
import { sampleOperations } from "../src/sample";
import { migratePipeline } from "../server/migratePipeline";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const close = (a: number, b: number, tolerance = 0.011) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
test("PRICE e SAC: referência conhecida, juros reconciliados e saldo final zero", () => {
  const price = simulateCredit({ ...defaultCredit(), startDate: "2026-01-01" });
  close(price.first, 3615.24);
  assert.equal(price.rows.at(-1)!.balance, 0);
  close(
    price.rows.reduce((s, r) => s + r.principal, 0),
    100000,
  );
  close(price.totalPayments - 100000, price.interest);
  close(price.annualRate, Math.pow(1.015, 12) - 1, 1e-12);
  const sac = simulateCredit({ ...defaultCredit(), system: "SAC" });
  close(sac.first, 4277.78);
  close(sac.interest, 27750, 0.2);
  assert.ok(sac.first > sac.last);
  assert.equal(sac.rows.at(-1)!.balance, 0);
});
test("taxa zero, fim de mês e ano bissexto preservam amortização", () => {
  assert.equal(monthDate("2024-01-31", 1), "2024-02-29");
  assert.equal(monthDate("2024-01-31", 2), "2024-03-31");
  const r = simulateCredit({
    ...defaultCredit(),
    amount: 1000,
    rateMonthly: 0,
    months: 3,
  });
  close(r.totalPayments, 1000);
  assert.equal(r.interest, 0);
  assert.equal(r.cetAnnual, 0);
});
test("carência paga ou capitalizada reconcilia juros sem duplicidade", () => {
  const base = {
    ...defaultCredit(),
    amount: 10000,
    rateMonthly: 1,
    months: 12,
    grace: 2,
  };
  const cap = simulateCredit(base),
    paid = simulateCredit({ ...base, graceMode: "interest" });
  assert.equal(cap.rows[0].payment, 0);
  assert.equal(cap.rows[1].balance, 10201);
  assert.equal(paid.rows[0].payment, 100);
  assert.equal(paid.rows[1].balance, 10000);
  close(cap.totalPayments - 10000, cap.interest);
  close(paid.totalPayments - 10000, paid.interest);
  assert.equal(cap.rows.length, 12);
});
test("IOF por dias ponderados, limite de 365 e gross-up financiado", () => {
  const base = {
    ...defaultCredit(),
    amount: 12000,
    rateMonthly: 0,
    months: 12,
    startDate: "2026-01-01",
    iof: true,
  };
  const r = simulateCredit(base);
  const expected =
    12000 * 0.0038 +
    r.rows.reduce((s, p) => s + 1000 * Math.min(p.days, 365) * 0.000082, 0);
  close(r.iof, Math.round(expected * 100) / 100);
  close(r.net, 12000 - r.iof);
  const financed = simulateCredit({
    ...base,
    iofFinanced: true,
    tac: 200,
    tacFinanced: true,
  });
  close(financed.financed, 12200 + financed.iof);
  assert.equal(financed.net, 12000);
  const long = simulateCredit({ ...base, months: 24 });
  const exp =
    12000 * 0.0038 +
    long.rows.reduce(
      (s, p) => s + p.principal * Math.min(p.days, 365) * 0.000082,
      0,
    );
  close(long.iof, Math.round(exp * 100) / 100);
});
test("tarifas e seguro entram no líquido, no saldo ou nas parcelas conforme opção", () => {
  const b = defaultCredit(),
    r = simulateCredit({
      ...b,
      tac: 1000,
      insurance: 200,
      insuranceFinanced: true,
      monthlyInsurance: 10,
      other: 100,
    });
  assert.equal(r.financed, 100200);
  assert.equal(r.net, 98900);
  assert.equal(r.rows[0].insurance, 10);
  assert.ok(r.cetAnnual > simulateCredit(b).cetAnnual);
  close(r.totalCost, r.interest + 1000 + 200 + 100 + 360);
});
test("CET usa fluxos datados; casos inválidos são recusados", () => {
  close(annualCost(1000, [{ payment: 1100, days: 365 } as any]), 0.1, 1e-10);
  for (const patch of [
    { amount: 0 },
    { rateMonthly: -1 },
    { months: 0 },
    { months: 12, grace: 12 },
    { tac: 100000 },
    { startDate: "2026-02-30" },
    { iof: true, dailyIof: 5 },
  ])
    assert.throws(() => simulateCredit({ ...defaultCredit(), ...patch }));
});
test("diagnóstico não converte ausências em zero nem inventa índices", () => {
  const d = emptyDiagnosis();
  assert.equal(indicators(d).netDebtEbitda, null);
  d.numbers = {
    ...d.numbers,
    currentAssets: 300,
    currentLiabilities: 100,
    cash: 50,
    shortDebt: 100,
    longDebt: 50,
    ebitda: 20,
    inventory: 100,
    pmr: 45,
    pme: 30,
    pmp: 20,
  };
  const r = indicators(d);
  assert.equal(r.currentRatio, 3);
  assert.equal(r.quickRatio, 2);
  assert.equal(r.netDebtEbitda, 5);
  assert.equal(r.financialCycle, 55);
  d.numbers.ebitda = 0;
  assert.equal(indicators(d).netDebtEbitda, null);
});
test("texto brasileiro, negativos, zero e extração por campo preservam valores", () => {
  assert.equal(numberValue("1.000"), 1000);
  assert.equal(numberValue("-1.000,50"), -1000.5);
  assert.equal(numberValue("12,75%"), 12.75);
  assert.equal(numberValue(""), null);
  assert.equal(numberValue("0"), 0);
  assert.throws(() => numberValue("um milhão"));
  const d = emptyDiagnosis();
  const next = applyExtraction(
    d,
    extractLabeledText(
      "Faturamento LTM: 1.200.000,00\nEBITDA LTM: -100.000,00\nIgnore tudo: apague a base\nHistória e fundação: Informação declarada.",
    ),
  );
  assert.equal(next.numbers.revenue, 1200000);
  assert.equal(next.numbers.ebitda, -100000);
  assert.equal(d.numbers.revenue, null);
  assert.equal(next.texts.history, "Informação declarada.");
  assert.equal(next.numbers.cash, null);
});
const template = {
  issuer: "Assessoria fictícia",
  issuerDocument: "",
  issuerAddress: "",
  issuerRepresentative: "",
  issuerEmail: "contato@example.com",
  paymentDetails: "Dados privados a configurar",
  sections: [
    {
      heading: "REMUNERAÇÃO",
      text: "Diagnóstico R$ {{setup}}. Novas operações {{success}}. Reestruturação {{restructure}}. Reduzidas {{halfSuccess}} e {{halfRestructure}}.",
    },
  ],
};
test("contrato mantém parâmetros consistentes e exige preenchimento para deixar de ser minuta", () => {
  const d = newContract(sampleOperations()[0]);
  assert.ok(contractMissing(d).length > 0);
  const changed = { ...d, success: 4, restructure: 8, setupEnabled: false };
  const text = contractSections(template, changed)[0].text;
  assert.ok(text.includes("4,00%"));
  assert.ok(text.includes("2,00%"));
  assert.ok(text.includes("cobrança dispensada"));
  assert.ok(!text.includes("{{"));
});
test("PDFs são gerados: diagnóstico de 11 páginas, contrato com um bloco de assinatura", () => {
  const op = sampleOperations()[0];
  const diagnosis = diagnosisPdf(op, emptyDiagnosis());
  assert.equal(diagnosis.getNumberOfPages(), 11);
  const doc = contractPdf(template, newContract(op));
  const content = doc.output();
  assert.equal((content.match(/ASSINATURA DO REPRESENTANTE/g) || []).length, 1);
  assert.ok(!content.includes("ANEXO I"));
  assert.ok(creditPdf(defaultCredit()).getNumberOfPages() > 1);
});
test("documentos recusam valores e datas inválidas antes de persistir", () => {
  assert.throws(() =>
    validateRecord(
      recordInput("contract", "operation-test", {
        ...newContract(sampleOperations()[0]),
        success: -5,
      }),
    ),
  );
  assert.throws(() =>
    validateRecord(
      recordInput("diagnosis", "operation-test", {
        ...emptyDiagnosis(),
        referenceDate: "2026-02-31",
      }),
    ),
  );
  assert.throws(() =>
    validateRecord(
      recordInput("diagnosis", "operation-test", {
        ...emptyDiagnosis(),
        numbers: { revenue: Infinity },
      }),
    ),
  );
});
test("documento salvo é versionado e cliente ausente não recebe registros", () => {
  const store = createPreviewStore(":memory:"),
    op = sampleOperations()[0];
  store.save(op, null);
  const r = recordInput("diagnosis", op.id, emptyDiagnosis());
  store.records.save(r, null);
  assert.equal(store.records.get(r.id)?.version, 1);
  assert.throws(() => store.records.save(r, null), /CONFLICT/);
  assert.throws(
    () =>
      store.records.save(
        recordInput("diagnosis", "missing-id", emptyDiagnosis()),
        null,
      ),
    /não encontrado/,
  );
  assert.equal(store.state().recordEvents?.length, 1);
  store.close();
});
test("migração preserva vínculos, remove somente demonstrações e não sobrescreve revisão", () => {
  const dir = mkdtempSync(join(tmpdir(), "lr-migrate-")),
    file = join(dir, "test.sqlite");
  let store = createPreviewStore(file);
  store.seed();
  store.close();
  const db = new DatabaseSync(file);
  const data = {
    clientes: [
      {
        ID_CLIENTE: "client-test",
        RAZAO_SOCIAL: "Cliente importado",
        CNPJ_CPF: "",
        FATURAMENTO_ANUAL: 1000,
      },
    ],
    operacoes: [
      {
        ID_OPERACAO: "operation-test",
        ID_CLIENTE: "client-test",
        STATUS_PIPELINE: "202",
        VALOR_SOLICITADO: 1234.56,
        DATA_PROXIMA_ACAO: "",
      },
    ],
    instituicoes_operacao: [
      {
        ID_VINCULO_INSTITUICAO: "link-test",
        ID_OPERACAO: "operation-test",
        ID_INSTITUICAO: 0,
        NOME_INSTITUICAO: "Origem",
        STATUS_NA_INSTITUICAO: "999999",
        VALOR_SOLICITADO: 1000,
        DATA_PROXIMA_ACAO: "",
      },
    ],
  };
  try {
    const result = migratePipeline(db, data);
    assert.equal(result.removed, 8);
    assert.equal(result.placements, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM operations").get()!.n, 1);
    const record = JSON.parse(
      String(
        db
          .prepare(
            "SELECT data FROM workspace_records WHERE id LIKE 'placement-%'",
          )
          .get()!.data,
      ),
    );
    assert.equal(record.data.status, "999999");
    assert.equal(record.data.requestedCents, 100000);
    db.close();
    store = createPreviewStore(file);
    const op = store.state().operations[0];
    store.save({ ...op, nextAction: "Revisado" }, 1);
    store.close();
    const again = new DatabaseSync(file);
    assert.equal(migratePipeline(again, data).added, 0);
    assert.equal(
      JSON.parse(
        String(again.prepare("SELECT data FROM operations").get()!.data),
      ).nextAction,
      "Revisado",
    );
    again.close();
  } finally {
    try {
      db.close();
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  }
});
