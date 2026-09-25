import type { OperationInput, Session, WorkspaceState } from "./domain";
import type { DirectoryInput, ImportSummary, LegacyDataset } from "./directory";
export interface Repository {
  saveRecord(
    record: import("./records").RecordInput,
    expectedVersion: number | null,
  ): Promise<void>;
  saveDirectory(
    record: DirectoryInput,
    expectedVersion: number | null,
  ): Promise<void>;
  importDataset?(data: LegacyDataset, filename: string): Promise<ImportSummary>;
  readImport?(id: string): Promise<LegacyDataset>;
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
    async saveRecord(record, expectedVersion) {
      await post("/__preview/records", { record, expectedVersion });
    },
    async saveDirectory(record, expectedVersion) {
      await post("/__preview/directory", { record, expectedVersion });
    },
    async importDataset(data, filename) {
      return post("/__preview/imports", { data, filename });
    },
    async readImport(id) {
      const response = await fetch(
        "/__preview/imports/" + encodeURIComponent(id),
      );
      if (!response.ok)
        throw new Error("Não foi possível consultar o arquivo.");
      return response.json();
    },
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
async function post(url: string, data: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Falha ao salvar.");
  return body;
}
