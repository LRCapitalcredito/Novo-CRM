import { readFileSync } from "node:fs";
import { before, after, beforeEach, test } from "node:test";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";

let env;
const root = "lr_v2_workspaces/lr-capital";
const path = `${root}/operations/test-operation`;
const base = {
  id: "test-operation",
  company: "Empresa fictícia",
  cnpj: "",
  contact: "",
  email: "",
  phone: "",
  product: "Capital de giro",
  stage: "Novo",
  owner: "Editor teste",
  requestedCents: 200000000,
  approvedCents: null,
  revenueCents: null,
  nextAction: "Conferir documentos",
  dueDate: "",
  institution: "",
  notes: "",
  version: 1,
};
const summary = (v) => ({
  company: v.company,
  stage: v.stage,
  requestedCents: v.requestedCents,
  approvedCents: v.approvedCents,
  nextAction: v.nextAction,
  dueDate: v.dueDate,
  version: v.version,
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-lr-capital-v2",
    firestore: {
      host: "127.0.0.1",
      port: 8088,
      rules: readFileSync(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const role of ["admin", "editor", "reader"])
      await setDoc(doc(db, `${root}/members/${role}`), {
        name: `${role} teste`,
        role,
        active: true,
      });
  });
});
const dbFor = (uid = "editor") => env.authenticatedContext(uid).firestore();
async function writeOperation(
  db,
  { previous = null, patch = {}, eventPatch = {}, withAudit = true } = {},
) {
  const version = (previous?.version ?? 0) + 1;
  const eventId = `event-${version}`;
  const next = {
    ...base,
    ...patch,
    version,
    createdAt: previous?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: "editor",
    lastEventId: eventId,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, path), next);
  if (withAudit)
    batch.set(doc(db, `${root}/activities/${eventId}`), {
      operationId: next.id,
      company: next.company,
      actor: "editor teste",
      actorUid: "editor",
      at: serverTimestamp(),
      action: previous ? "Operação atualizada" : "Operação criada",
      before: previous ? summary(previous) : null,
      after: summary(next),
      operationVersion: version,
      ...eventPatch,
    });
  await batch.commit();
}
test("visitantes e contas sem vínculo não leem operações", async () => {
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), path)),
  );
  await assertFails(getDoc(doc(dbFor("unknown"), path)));
});
test("editor cria e atualiza com registro atômico no histórico", async () => {
  const db = dbFor();
  await assertSucceeds(writeOperation(db));
  const previous = (await getDoc(doc(db, path))).data();
  await assertSucceeds(
    writeOperation(db, { previous, patch: { stage: "Documentação" } }),
  );
  await assertSucceeds(getDoc(doc(dbFor("reader"), path)));
});
test("leitor não altera, editor não se promove e conta não se cadastra sozinha", async () => {
  await assertFails(writeOperation(dbFor("reader")));
  await assertFails(
    updateDoc(doc(dbFor(), `${root}/members/editor`), { role: "admin" }),
  );
  await assertFails(
    setDoc(doc(dbFor("unknown"), `${root}/members/unknown`), {
      name: "Outro",
      role: "admin",
      active: true,
    }),
  );
});
test("gravação sem histórico, histórico falso e valor negativo são recusados", async () => {
  await assertFails(writeOperation(dbFor(), { withAudit: false }));
  await assertFails(
    writeOperation(dbFor(), { eventPatch: { after: { company: "Falso" } } }),
  );
  await assertFails(writeOperation(dbFor(), { patch: { requestedCents: -1 } }));
});
test("versão antiga, edição de histórico e exclusão são recusadas", async () => {
  const db = dbFor();
  await writeOperation(db);
  await assertFails(writeOperation(db));
  await assertFails(
    updateDoc(doc(db, `${root}/activities/event-1`), { actor: "Outro" }),
  );
  await assertFails(deleteDoc(doc(db, path)));
});
test("conta desativada perde acesso e os dados de outro workspace ficam isolados", async () => {
  await env.withSecurityRulesDisabled((c) =>
    updateDoc(doc(c.firestore(), `${root}/members/editor`), { active: false }),
  );
  await assertFails(getDoc(doc(dbFor(), path)));
  await assertFails(
    getDoc(
      doc(
        dbFor("admin"),
        "lr_v2_workspaces/outra-equipe/operations/test-operation",
      ),
    ),
  );
});
