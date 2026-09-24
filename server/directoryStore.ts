import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  validateDirectory,
  validateDataset,
  directoryChanges,
  type DirectoryRecord,
  type DirectoryState,
  type ImportSummary,
  type LegacyDataset,
} from "../src/directory";

export function createDirectoryStore(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS directory (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS directory_events (id TEXT PRIMARY KEY, data TEXT NOT NULL, at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS source_imports (id TEXT PRIMARY KEY, summary TEXT NOT NULL, data TEXT NOT NULL);",
  );
  const get = (id: string): DirectoryRecord | null => {
    const row = db.prepare("SELECT data FROM directory WHERE id=?").get(id);
    return row ? JSON.parse(String(row.data)) : null;
  };
  const write = (
    raw: unknown,
    expectedVersion: number | null,
    actor = "Ricardo · prévia",
  ) => {
    const input = validateDirectory(raw),
      old = get(input.id);
    if ((old?.version ?? null) !== expectedVersion)
      throw new Error(
        "CONFLICT: Este cadastro mudou em outra sessão. Reabra antes de salvar.",
      );
    if (old && old.kind !== input.kind)
      throw new Error("Tipo de cadastro não pode ser alterado.");
    if (input.kind === "manager" && get(input.bankId)?.kind !== "bank")
      throw new Error("A instituição vinculada não existe.");
    const at = new Date().toISOString(),
      next = {
        ...input,
        version: (old?.version ?? 0) + 1,
        createdAt: old?.createdAt ?? at,
        updatedAt: at,
      };
    db.prepare(
      "INSERT INTO directory VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    ).run(next.id, next.kind, JSON.stringify(next));
    const event = {
      id: randomUUID(),
      entityId: next.id,
      kind: next.kind,
      name: next.name,
      actor,
      at,
      version: next.version,
      changes: directoryChanges(old, input),
    };
    db.prepare("INSERT INTO directory_events VALUES (?,?,?)").run(
      event.id,
      JSON.stringify(event),
      at,
    );
    return next;
  };
  return {
    get,
    state(): DirectoryState {
      return {
        records: db
          .prepare("SELECT data FROM directory ORDER BY id")
          .all()
          .map((r) => JSON.parse(String(r.data))),
        events: db
          .prepare(
            "SELECT data FROM directory_events ORDER BY at DESC LIMIT 200",
          )
          .all()
          .map((r) => JSON.parse(String(r.data))),
        imports: db
          .prepare("SELECT summary FROM source_imports ORDER BY rowid DESC")
          .all()
          .map((r) => JSON.parse(String(r.summary))),
      };
    },
    save(raw: unknown, version: number | null) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const saved = write(raw, version);
        db.exec("COMMIT");
        return saved;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    readImport(id: string): LegacyDataset {
      const row = db
        .prepare("SELECT data FROM source_imports WHERE id=?")
        .get(id);
      if (!row) throw new Error("Importação não encontrada.");
      return JSON.parse(String(row.data));
    },
    import(raw: unknown, filename: string) {
      const data = validateDataset(raw),
        serialized = JSON.stringify(data),
        hash = createHash("sha256").update(serialized).digest("hex");
      const existing = db
        .prepare("SELECT summary FROM source_imports WHERE id=?")
        .get(hash);
      if (existing)
        return { ...JSON.parse(String(existing.summary)), repeated: true };
      const summary: ImportSummary = {
        id: hash,
        filename: String(filename).slice(0, 180),
        at: new Date().toISOString(),
        counts: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, v.length]),
        ),
        banksCreated: 0,
        managersCreated: 0,
        unidentifiedLinks: 0,
        notes: [
          "Cadastros derivados dos vínculos do pipeline; condições bancárias e contatos ausentes precisam de complemento.",
          "Nomes semelhantes não foram fundidos entre instituições. Os dados originais permanecem íntegros na consulta.",
        ],
      };
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const row of data.instituicoes_operacao) {
          const sourceId = String(row.ID_INSTITUICAO ?? "").trim(),
            name = String(row.NOME_INSTITUICAO ?? "").trim();
          if (
            !sourceId ||
            sourceId === "0" ||
            !name ||
            name === "INSTITUIÇÃO NÃO IDENTIFICADA"
          ) {
            summary.unidentifiedLinks++;
            continue;
          }
          const bankId =
            "bank-" +
            createHash("sha256").update(sourceId).digest("hex").slice(0, 24);
          if (!get(bankId)) {
            write(
              {
                id: bankId,
                kind: "bank",
                name,
                type: "",
                color: "#18334a",
                logoUrl: "",
                acceptsRestriction: null,
                guarantees: {},
                notes: `ID da instituição na origem: ${sourceId}. Condições não incluídas no arquivo de pipeline.`,
                source: "Vínculo do pipeline importado",
                archived: false,
              },
              null,
              "Importação local",
            );
            summary.banksCreated++;
          }
          const managerName = String(row.GERENTE ?? "").trim();
          if (!managerName || managerName.toLowerCase() === "a definir")
            continue;
          const managerId =
            "manager-" +
            createHash("sha256")
              .update(bankId + "|" + managerName.normalize("NFC").toLowerCase())
              .digest("hex")
              .slice(0, 24);
          if (!get(managerId)) {
            write(
              {
                id: managerId,
                kind: "manager",
                bankId,
                name: managerName,
                minRevenueCents: null,
                maxRevenueCents: null,
                email: "",
                phone: "",
                city: "",
                state: "",
                serviceScope: "",
                radiusKm: null,
                servedStates: [],
                notes:
                  "Nome encontrado no vínculo da operação; contato e critérios precisam ser confirmados.",
                source: "Vínculo do pipeline importado",
                archived: false,
              },
              null,
              "Importação local",
            );
            summary.managersCreated++;
          }
        }
        db.prepare("INSERT INTO source_imports VALUES (?,?,?)").run(
          hash,
          JSON.stringify(summary),
          serialized,
        );
        db.exec("COMMIT");
        return summary;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
