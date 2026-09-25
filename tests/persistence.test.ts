import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPreviewStore, allowedPreviewRequest } from "../server/preview";
import { sampleOperations } from "../src/sample";
test("prévia aceita somente localhost na porta configurada e bloqueia origem externa", () => {
  assert.equal(allowedPreviewRequest("127.0.0.1:5175", "http://127.0.0.1:5175", 5175), true);
  assert.equal(allowedPreviewRequest("localhost:5174", undefined, 5174), true);
  assert.equal(allowedPreviewRequest("127.0.0.1:5174", undefined, 5175), false);
  assert.equal(allowedPreviewRequest("127.0.0.1:5175", "https://externo.example", 5175), false);
  assert.equal(allowedPreviewRequest("externo.example:5175", undefined, 5175), false);
});
test("gravação é persistente e auditada após reabrir o banco", () => {
  const dir = mkdtempSync(join(tmpdir(), "lr-v2-test-"));
  try {
    const file = join(dir, "workspace.sqlite");
    let store = createPreviewStore(file);
    const op = sampleOperations()[0];
    store.save(op, null);
    store.close();
    store = createPreviewStore(file);
    assert.equal(store.state().operations[0].company, op.company);
    assert.equal(store.state().activities.length, 1);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("conflito de versão não sobrescreve registro nem cria evento falso", () => {
  const store = createPreviewStore(":memory:");
  const op = sampleOperations()[0];
  store.save(op, null);
  store.save({ ...op, nextAction: "Atualização A" }, 1);
  assert.throws(
    () => store.save({ ...op, nextAction: "Atualização B" }, 1),
    /CONFLICT/,
  );
  const state = store.state();
  assert.equal(state.operations[0].nextAction, "Atualização A");
  assert.equal(state.activities.length, 2);
  store.close();
});
