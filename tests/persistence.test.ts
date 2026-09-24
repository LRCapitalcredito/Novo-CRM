import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPreviewStore } from "../server/preview";
import { sampleOperations } from "../src/sample";
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
