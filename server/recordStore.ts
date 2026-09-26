import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { assertPlacementFit, needsFitCheck } from "../src/institutionFit";
import { inspectDocumentFile } from "./documentFiles";
import { isWorkflowKind, validateWorkflowLinks, type DocumentFile } from "../src/workflow";
import {
  validateRecord,
  type WorkspaceRecord,
  type RecordEvent,
} from "../src/records";
export function createRecordStore(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS workspace_records(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS record_events(id TEXT PRIMARY KEY,data TEXT NOT NULL,at TEXT NOT NULL)",
  );
  db.exec("CREATE TABLE IF NOT EXISTS document_files(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,metadata TEXT NOT NULL,bytes BLOB NOT NULL)");
  const get = (id: string): WorkspaceRecord | null => {
    const row = db
      .prepare("SELECT data FROM workspace_records WHERE id=?")
      .get(id);
    return row ? JSON.parse(String(row.data)) : null;
  };
  const api = {
    get,
    state() {
      return {
        records: db
          .prepare("SELECT data FROM workspace_records")
          .all()
          .map((r) => JSON.parse(String(r.data))) as WorkspaceRecord[],
        recordEvents: db
          .prepare("SELECT data FROM record_events ORDER BY at DESC LIMIT 400")
          .all()
          .map((r) => JSON.parse(String(r.data))) as RecordEvent[],
      };
    },
    save(
      raw: unknown,
      expectedVersion: number | null,
      actor = "Ricardo · prévia",
      attachment?: { metadata: DocumentFile; bytes: Uint8Array },
    ) {
      const input = validateRecord(raw);
      db.exec("BEGIN IMMEDIATE");
      try {
        const old = get(input.id);
        if ((old?.version ?? null) !== expectedVersion)
          throw new Error(
            "CONFLICT: O registro mudou em outra sessão. Reabra antes de salvar.",
          );
        if (
          old &&
          (old.kind !== input.kind || old.operationId !== input.operationId)
        )
          throw new Error("O vínculo do registro não pode ser alterado.");
        if (
          input.kind !== "template" &&
          !db
            .prepare("SELECT id FROM operations WHERE id=?")
            .get(input.operationId)
        )
          throw new Error("Cliente/operação não encontrado.");
        const relatedIds = [input.data.placementId, ...(input.kind === "dispatch" && !old ? input.data.items.map((item: any) => item.documentId) : [])].filter(Boolean);
        validateWorkflowLinks(input, old, relatedIds.map(get).filter((r): r is WorkspaceRecord => !!r), !!attachment);
        if (input.kind === "placement" && input.data.bankId) {
          const bank = db
            .prepare("SELECT data FROM directory WHERE id=?")
            .get(input.data.bankId);
          if (!bank || JSON.parse(String(bank.data)).kind !== "bank")
            throw new Error("Instituição não encontrada.");
        }
        if (input.kind === "placement" && input.data.managerId) {
          const row = db
            .prepare("SELECT data FROM directory WHERE id=?")
            .get(input.data.managerId);
          const manager = row ? JSON.parse(String(row.data)) : null;
          if (
            !manager ||
            manager.kind !== "manager" ||
            manager.bankId !== input.data.bankId
          )
            throw new Error(
              "O gerente precisa pertencer à instituição vinculada.",
            );
        }
        if (needsFitCheck(input, old)) {
          const readDirectory = (id: string) => { const row = db.prepare("SELECT data FROM directory WHERE id=?").get(id); return row ? JSON.parse(String(row.data)) : undefined; };
          const row = db.prepare("SELECT data FROM operations WHERE id=?").get(input.operationId)!;
          assertPlacementFit(input, old, JSON.parse(String(row.data)), get(`profile-${input.operationId}`)?.data ?? {}, readDirectory(input.data.bankId), readDirectory(input.data.managerId));
        }
        const at = new Date().toISOString();
        const next = {
          ...input,
          version: (old?.version ?? 0) + 1,
          createdAt: old?.createdAt ?? at,
          updatedAt: at,
        };
        const event: RecordEvent = {
          id: randomUUID(),
          recordId: next.id,
          operationId: next.operationId,
          kind: next.kind,
          actor,
          at,
          version: next.version,
          ...(isWorkflowKind(input.kind) ? { contentJson: JSON.stringify(input.data) } : {}),
          changes: Object.keys(input.data).filter(
            (k) =>
              JSON.stringify(old?.data[k]) !== JSON.stringify(input.data[k]),
          ),
        };
        db.prepare(
          "INSERT INTO workspace_records VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        ).run(next.id, JSON.stringify(next));
        db.prepare("INSERT INTO record_events VALUES (?,?,?)").run(
          event.id,
          JSON.stringify(event),
          at,
        );
        if (attachment) db.prepare("INSERT INTO document_files VALUES (?,?,?,?)").run(attachment.metadata.id, input.id, JSON.stringify(attachment.metadata), attachment.bytes);
        db.exec("COMMIT");
        return next;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return {
    get: api.get, state: api.state,
    save: (raw: unknown, version: number | null, actor?: string) => api.save(raw, version, actor),
    attach(recordId: string, expectedVersion: number, name: string, bytes: Uint8Array) {
      const old = get(recordId);
      if (!old || old.kind !== "document" || old.data.archived) throw new Error("Selecione um item ativo do checklist.");
      const metadata = inspectDocumentFile(name, bytes);
      if (old.data.files.some((f: DocumentFile) => f.sha256 === metadata.sha256)) throw new Error("Este mesmo arquivo já está anexado ao item.");
      return api.save({ ...old, data: { ...old.data, files: [...old.data.files, metadata], status: "Recebido", reviewNotes: "", signatureCheck: "Não verificada" } }, expectedVersion, "Ricardo · prévia", { metadata, bytes });
    },
    file(id: string) {
      const row = db.prepare("SELECT metadata, bytes FROM document_files WHERE id=?").get(id);
      return row ? { metadata: JSON.parse(String(row.metadata)) as DocumentFile, bytes: row.bytes as Uint8Array } : null;
    },
  };
}
