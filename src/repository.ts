import type { OperationInput, Session, WorkspaceState } from "./domain";
export interface Repository {
  mode: "preview" | "firebase";
  session: Session | null;
  authListener(
    callback: (session: Session | null, error?: string) => void,
  ): () => void;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  subscribe(
    next: (state: WorkspaceState) => void,
    error: (message: string) => void,
  ): () => void;
  save(
    operation: OperationInput,
    expectedVersion: number | null,
  ): Promise<void>;
}
export async function createRepository(): Promise<Repository | null> {
  const response = await fetch("/firebase-config.json", { cache: "no-store" });
  let config: any = null;
  if (
    response.ok &&
    response.headers.get("content-type")?.includes("application/json")
  )
    config = await response.json();
  if (config?.apiKey && config?.projectId && config?.authDomain) {
    const { firebaseRepository } = await import("./firebaseRepository");
    return firebaseRepository(config);
  }
  if (!import.meta.env.DEV) return null;
  const session: Session = {
    uid: "preview-ricardo",
    name: "Ricardo",
    email: "",
    role: "admin",
  };
  return {
    mode: "preview",
    session,
    authListener(cb) {
      cb(session);
      return () => {};
    },
    async login() {},
    async logout() {},
    subscribe(next, error) {
      const events = new EventSource("/__preview/events");
      events.onmessage = (e) => next(JSON.parse(e.data));
      events.onerror = () =>
        error("Conexão interrompida. Tentando reconectar à prévia…");
      return () => events.close();
    },
    async save(operation, expectedVersion) {
      const res = await fetch("/__preview/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, expectedVersion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    },
  };
}
