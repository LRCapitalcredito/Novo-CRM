import type { Session } from "./domain";
import { isQuotaError } from "./serviceErrors";

export type AccessState = {
  status: "checking" | "unavailable" | "denied";
  email: string;
  reason?: "quota" | "connection";
};
export type AuthIdentity = { uid: string; email: string | null };
export type AccessProfile = { name?: string; active?: boolean; role?: string };
export type AccessCallback = (session: Session | null, error?: string, access?: AccessState) => void;

export function accessFailure(error: unknown): { message: string; reason: "quota" | "connection" } {
  if (isQuotaError(error)) return {
    reason: "quota",
    message: "Sua conta está conectada, mas o banco de dados atingiu a cota de uso e não conseguiu confirmar sua permissão. Não é necessário entrar com Google novamente. Tente carregar quando a cota for liberada.",
  };
  return {
    reason: "connection",
    message: "Sua conta está conectada, mas não foi possível consultar sua permissão no CRM. Confira a conexão e tente carregar novamente.",
  };
}

// Authentication identifies the account. Only a current server-confirmed
// membership grants a workspace session; a service failure never grants access.
export function createAccessController(deps: {
  resolve: (user: AuthIdentity) => Promise<AccessProfile | undefined>;
  watch: (user: AuthIdentity, next: (profile: AccessProfile | undefined) => void, error: (error: unknown) => void) => () => void;
  publish: AccessCallback;
}) {
  let generation = 0;
  let stopped = false;
  let unwatch: (() => void) | undefined;
  const clear = () => { unwatch?.(); unwatch = undefined; };
  async function check(user: AuthIdentity | null) {
    if (stopped) return;
    const current = ++generation;
    clear();
    const fresh = () => !stopped && generation === current;
    if (!user) { deps.publish(null); return; }
    const email = user.email || "";
    deps.publish(null, undefined, { status: "checking", email });
    const fail = (error: unknown) => {
      if (!fresh()) return;
      const failure = accessFailure(error);
      deps.publish(null, failure.message, { status: "unavailable", email, reason: failure.reason });
      generation++;
      clear();
    };
    const accept = (profile: AccessProfile | undefined) => {
      if (!fresh()) return;
      if (profile?.active !== true || !["admin", "editor", "reader"].includes(profile.role || "")) {
        deps.publish(null, "Esta conta não tem acesso ativo à equipe. Confira o e-mail ou peça ao administrador para habilitá-la.", { status: "denied", email });
        return;
      }
      deps.publish({ uid: user.uid, email, name: profile.name || email || "Equipe", role: profile.role } as Session);
    };
    try {
      const profile = await deps.resolve(user);
      if (!fresh()) return;
      accept(profile);
      unwatch = deps.watch(user, accept, fail);
    } catch (error) { fail(error); }
  }
  return { check, stop() { stopped = true; generation++; clear(); } };
}
