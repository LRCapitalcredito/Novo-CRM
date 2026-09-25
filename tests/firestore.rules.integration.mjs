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
  product: v.product,
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
const bankInput = {
  id: "bank-test",
  kind: "bank",
  name: "Instituição fictícia",
  notes: "",
  source: "Teste",
  archived: false,
  type: "Banco",
  color: "#123456",
  logoUrl: "",
  acceptsRestriction: null,
  guarantees: {},
};
const managerInput = {
  id: "manager-test",
  kind: "manager",
  name: "Contato fictício",
  notes: "",
  source: "Teste",
  archived: false,
  bankId: "bank-test",
  minRevenueCents: null,
  maxRevenueCents: null,
  email: "",
  phone: "",
  city: "",
  state: "",
  serviceScope: "",
  radiusKm: null,
  servedStates: [],
};
async function writeDirectory(db, input, previous = null, options = {}) {
  const version = (previous?.version ?? 0) + 1,
    eventId = input.id + "-" + version;
  const next = {
    ...input,
    version,
    createdAt: previous?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: "editor",
    lastEventId: eventId,
  };
  const changes = Object.keys(input).filter(
    (k) =>
      !["id", "kind"].includes(k) &&
      JSON.stringify(previous?.[k]) !== JSON.stringify(input[k]),
  );
  const batch = writeBatch(db);
  batch.set(doc(db, `${root}/directory/${input.id}`), next);
  if (!options.noAudit)
    batch.set(doc(db, `${root}/directoryEvents/${eventId}`), {
      entityId: input.id,
      kind: input.kind,
      name: input.name,
      actor: "editor teste",
      actorUid: "editor",
      at: serverTimestamp(),
      version,
      changes,
      ...options.eventPatch,
    });
  await batch.commit();
}
test("bancos e gerentes são vinculados, auditados e podem ser arquivados", async () => {
  const db = dbFor();
  await assertSucceeds(writeDirectory(db, bankInput));
  await assertSucceeds(writeDirectory(db, managerInput));
  const old = (await getDoc(doc(db, `${root}/directory/bank-test`))).data();
  await assertSucceeds(
    writeDirectory(db, { ...bankInput, archived: true }, old),
  );
  await assertSucceeds(
    getDoc(doc(dbFor("reader"), `${root}/directory/manager-test`)),
  );
});
test("cadastros recusam leitor, banco ausente e histórico falso", async () => {
  await assertFails(writeDirectory(dbFor("reader"), bankInput));
  await assertFails(writeDirectory(dbFor(), managerInput));
  await assertFails(
    writeDirectory(dbFor(), bankInput, null, { noAudit: true }),
  );
  await assertFails(
    writeDirectory(dbFor(), bankInput, null, { eventPatch: { changes: [] } }),
  );
});
test("garantias e faixa de faturamento têm validação no servidor", async () => {
  const db = dbFor();
  const guarantees = Object.fromEntries(
    [
      "Imóveis (Geral)",
      "Imóvel Urbano",
      "Imóvel Rural",
      "Imóvel Operacional",
      "Veículos Leves",
      "Veículos Pesados",
      "Recebíveis",
      "Contratos",
      "Aplicação Financeira",
      "Aval / Fiador",
      "Estoque",
      "FGI / Limpa",
      "Safra",
      "Câmbio",
      "Universal",
    ].map((k) => [k, { rate: "Referência", termMonths: 60, ltvPercent: 70 }]),
  );
  await assertSucceeds(writeDirectory(db, { ...bankInput, guarantees }));
  let previous = (await getDoc(doc(db, `${root}/directory/bank-test`))).data();
  await assertSucceeds(
    writeDirectory(
      db,
      { ...bankInput, guarantees, notes: "Atualização com todas as garantias" },
      previous,
    ),
  );
  previous = (await getDoc(doc(db, `${root}/directory/bank-test`))).data();
  for (const kind of Object.keys(guarantees)) {
    await assertFails(
      writeDirectory(
        db,
        {
          ...bankInput,
          guarantees: {
            ...guarantees,
            [kind]: { rate: "", termMonths: 60, ltvPercent: 101 },
          },
        },
        previous,
      ),
    );
  }
  for (const invalid of [
    { rate: "", termMonths: 2.5, ltvPercent: null },
    { rate: "", termMonths: -1, ltvPercent: null },
    { rate: "", termMonths: 601, ltvPercent: null },
    { rate: "", termMonths: null, ltvPercent: "70" },
    { rate: 15, termMonths: null, ltvPercent: null },
    { rate: "x".repeat(81), termMonths: null, ltvPercent: null },
    { rate: "", termMonths: null },
  ]) {
    await assertFails(
      writeDirectory(
        db,
        { ...bankInput, guarantees: { Universal: invalid } },
        previous,
      ),
    );
  }
  const unknown = Object.fromEntries(
    Object.keys(guarantees).map((k) => [
      k,
      { rate: "", termMonths: null, ltvPercent: null },
    ]),
  );
  await assertSucceeds(
    writeDirectory(db, { ...bankInput, guarantees: unknown }, previous),
  );
  await assertFails(
    writeDirectory(db, {
      ...managerInput,
      minRevenueCents: 200,
      maxRevenueCents: 100,
    }),
  );
  const old = (await getDoc(doc(db, `${root}/directory/bank-test`))).data();
  await assertFails(
    writeDirectory(
      db,
      {
        ...bankInput,
        guarantees: {
          Universal: { rate: "", termMonths: 60, ltvPercent: 101 },
        },
      },
      old,
    ),
  );
  await assertFails(
    writeDirectory(
      db,
      {
        ...bankInput,
        guarantees: {
          Universal: {
            rate: "",
            termMonths: 60,
            ltvPercent: 70,
            other: "injetado",
          },
        },
      },
      old,
    ),
  );
});
test("tipo de cadastro, versão e histórico não podem ser adulterados", async () => {
  const db = dbFor();
  await writeDirectory(db, bankInput);
  const old = (await getDoc(doc(db, `${root}/directory/bank-test`))).data();
  await assertFails(writeDirectory(db, bankInput));
  await assertFails(
    writeDirectory(db, { ...managerInput, id: bankInput.id }, old),
  );
  await assertFails(
    updateDoc(doc(db, `${root}/directoryEvents/bank-test-1`), {
      name: "Alterado",
    }),
  );
  await assertFails(deleteDoc(doc(db, `${root}/directory/bank-test`)));
});
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
async function writeRecord(
  db,
  {
    id = "contract-test",
    kind = "contract",
    operationId = "test-operation",
    contentJson = "{}",
  } = {},
  previous = null,
  options = {},
) {
  const version = (previous?.version ?? 0) + 1,
    eventId = id + "-event-" + version;
  const value = {
    id,
    kind,
    operationId,
    contentJson,
    version,
    createdAt: previous?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: "editor",
    lastEventId: eventId,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, `${root}/records/${id}`), value);
  if (!options.noAudit)
    batch.set(doc(db, `${root}/recordEvents/${eventId}`), {
      recordId: id,
      operationId,
      kind,
      version,
      at: serverTimestamp(),
      actor: "editor teste",
      actorUid: "editor",
      ...options.eventPatch,
    });
  return batch.commit();
}
test("novas modalidades e status são auditados; leitor e evento adulterado são recusados", async () => {
  const db = dbFor();
  await assertSucceeds(writeOperation(db, { patch: { product: "Crédito estruturado", stage: "Aguardando Assinatura" } }));
  const previous = (await getDoc(doc(db, path))).data();
  await assertFails(writeOperation(dbFor("reader"), { previous, patch: { stage: "Contrato Assinado" } }));
  await assertFails(writeOperation(db, { previous, patch: { product: "Produto inexistente" } }));
  await assertFails(writeOperation(db, { previous, patch: { product: "Crédito rural" }, eventPatch: { after: { ...summary(base), product: "Capital de giro", version: 2 } } }));
  await assertSucceeds(writeOperation(db, { previous, patch: { product: "Reestruturação de dívida", stage: "Negado" } }));
});
test("contratos e diagnósticos exigem vínculo, versão e histórico atômico", async () => {
  const db = dbFor();
  await writeOperation(db);
  await assertSucceeds(writeRecord(db));
  const old = (await getDoc(doc(db, `${root}/records/contract-test`))).data();
  await assertSucceeds(
    writeRecord(db, { contentJson: '{"company":"Revisado"}' }, old),
  );
  await assertFails(writeRecord(db, {}, old));
  await assertFails(
    writeRecord(db, { id: "no-audit-record" }, null, { noAudit: true }),
  );
  await assertFails(
    writeRecord(db, { id: "wrong-audit-record" }, null, {
      eventPatch: { version: 2 },
    }),
  );
  await assertFails(
    writeRecord(db, { id: "orphan-record", operationId: "missing-operation" }),
  );
});
test("leitores consultam documentos, não alteram, e modelos são exclusivos de administradores", async () => {
  const db = dbFor();
  await writeOperation(db);
  await writeRecord(db);
  await assertSucceeds(
    getDoc(doc(dbFor("reader"), `${root}/records/contract-test`)),
  );
  await assertFails(writeRecord(dbFor("reader"), { id: "reader-record" }));
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        `${root}/records/contract-test`,
      ),
    ),
  );
  await assertFails(
    writeRecord(db, {
      id: "contract-template",
      kind: "template",
      operationId: "",
    }),
  );
  await assertFails(deleteDoc(doc(db, `${root}/records/contract-test`)));
  await assertFails(
    updateDoc(doc(db, `${root}/recordEvents/contract-test-event-1`), {
      actor: "Outro",
    }),
  );
});
test("documento não pode mudar de cliente ou tipo e recebe limite de conteúdo", async () => {
  const db = dbFor();
  await writeOperation(db);
  await writeRecord(db);
  const old = (await getDoc(doc(db, `${root}/records/contract-test`))).data();
  await assertFails(writeRecord(db, { kind: "diagnosis" }, old));
  await assertFails(writeRecord(db, { operationId: "another-operation" }, old));
  await assertFails(
    writeRecord(db, { id: "oversize-record", contentJson: "x".repeat(150001) }),
  );
});
test("etapas originais e faturamento desconhecido são aceitos sem valor inventado", async () => {
  await assertSucceeds(
    writeOperation(dbFor(), {
      patch: {
        stage: "Captação de Documentos",
        product: "Não informado",
        revenueCents: null,
        nextAction: "Atualização ".repeat(70),
      },
    }),
  );
});
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
