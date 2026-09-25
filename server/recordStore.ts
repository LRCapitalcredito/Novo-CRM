import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  validateRecord,
  type WorkspaceRecord,
  type RecordEvent,
} from "../src/records";
export function createRecordStore(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS workspace_records(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS record_events(id TEXT PRIMARY KEY,data TEXT NOT NULL,at TEXT NOT NULL)",
  );
  const get = (id: string): WorkspaceRecord | null => {
    const row = db
      .prepare("SELECT data FROM workspace_records WHERE id=?")
      .get(id);
    return row ? JSON.parse(String(row.data)) : null;
  };
  return {
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
        db.exec("COMMIT");
        return next;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
