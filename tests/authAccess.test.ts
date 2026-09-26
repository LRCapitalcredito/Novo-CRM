import { test } from "node:test";
import assert from "node:assert/strict";
import { accessFailure, createAccessController, type AccessProfile, type AccessState } from "../src/authAccess";
import type { Session } from "../src/domain";

const account = { uid: "account-1", email: "equipe@example.com" };
const admin = { name: "Equipe", active: true, role: "admin" };
type Event = { session: Session | null; error?: string; access?: AccessState };
function harness(resolve: (user: typeof account) => Promise<AccessProfile | undefined>) {
  const events: Event[] = [];
  const listeners: { next: (profile: AccessProfile | undefined) => void; fail: (error: unknown) => void; stopped: boolean }[] = [];
  const controller = createAccessController({
    resolve: user => resolve({ ...user, email: user.email || "" }),
    watch(_user, next, fail) {
      const listener = { next, fail, stopped: false };
      listeners.push(listener);
      return () => { listener.stopped = true; };
    },
    publish(session, error, access) { events.push({ session, error, access }); },
  });
  return { ...controller, events, listeners };
}

test("conta autenticada continua identificada quando a cota bloqueia a permissão; nenhum acesso é concedido", async () => {
  let reads = 0;
  const h = harness(async () => { reads++; throw { code: "resource-exhausted" }; });
  await h.check(account);
  assert.equal(reads, 1);
  assert.equal(h.listeners.length, 0);
  assert.deepEqual(h.events.map(e => e.access?.status), ["checking", "unavailable"]);
  assert.equal(h.events.at(-1)?.access?.email, account.email);
  assert.equal(h.events.at(-1)?.access?.reason, "quota");
  assert.match(h.events.at(-1)!.error!, /Não é necessário entrar com Google novamente/);
  assert.ok(h.events.every(e => e.session === null));
  h.stop();
});

test("nova tentativa recupera o acesso apenas após confirmar a permissão no servidor", async () => {
  let unavailable = true;
  const h = harness(async () => { if (unavailable) throw { code: "resource-exhausted" }; return admin; });
  await h.check(account);
  unavailable = false;
  await h.check(account);
  assert.equal(h.events.at(-1)?.session?.role, "admin");
  assert.equal(h.events.at(-1)?.session?.uid, account.uid);
  assert.equal(h.events.at(-1)?.access, undefined);
  h.stop();
});

test("conta inexistente, inativa ou com papel inválido nunca entra na carteira", async () => {
  for (const profile of [undefined, { ...admin, active: false }, { ...admin, role: "owner" }]) {
    const h = harness(async () => profile);
    await h.check(account);
    assert.equal(h.events.at(-1)?.access?.status, "denied");
    assert.ok(h.events.every(e => e.session === null));
    h.stop();
  }
});

test("revogação da permissão remove a sessão e erro de serviço não vira falha do Google", async () => {
  const h = harness(async () => admin);
  await h.check(account);
  h.listeners[0].next({ ...admin, active: false });
  assert.equal(h.events.at(-1)?.session, null);
  assert.equal(h.events.at(-1)?.access?.status, "denied");
  h.listeners[0].fail({ code: "unavailable" });
  assert.equal(h.events.at(-1)?.access?.reason, "connection");
  assert.equal(h.listeners[0].stopped, true);
  h.listeners[0].next(admin);
  assert.equal(h.events.at(-1)?.session, null);
  h.stop();
});

test("resposta atrasada da conta anterior não reabre sessão após sair", async () => {
  let finish!: (profile: AccessProfile) => void;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.check(account);
  await h.check(null);
  finish(admin);
  await pending;
  assert.equal(h.events.at(-1)?.session, null);
  assert.equal(h.events.at(-1)?.access, undefined);
  assert.equal(h.listeners.length, 0);
  h.stop();
});

test("troca de conta ignora callbacks antigos e encerra a escuta anterior", async () => {
  const h = harness(async () => admin);
  await h.check(account);
  await h.check({ uid: "account-2", email: "outra@example.com" });
  assert.equal(h.listeners[0].stopped, true);
  const count = h.events.length;
  h.listeners[0].fail({ code: "resource-exhausted" });
  h.listeners[0].next(admin);
  assert.equal(h.events.length, count);
  assert.equal(h.events.at(-1)?.session?.uid, "account-2");
  h.stop();
  h.listeners[1].next(admin);
  assert.equal(h.events.length, count);
});

test("mensagem de serviço diferencia cota de indisponibilidade sem expor erros internos", () => {
  assert.equal(accessFailure({ code: "firestore/resource-exhausted" }).reason, "quota");
  assert.equal(accessFailure(new Error("Quota exceeded.")).reason, "quota");
  assert.equal(accessFailure({ code: "permission-denied" }).reason, "connection");
  assert.doesNotMatch(accessFailure(new Error("internal secret")).message, /internal secret/);
});
