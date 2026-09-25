import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { validateDataset, legacyMoney } from "../src/directory";
import {
  validateOperation,
  products,
  stages,
  type OperationInput,
} from "../src/domain";
import {
  statusLabel,
  isInactive,
  validateRecord,
  type RecordInput,
} from "../src/records";
import { sampleOperations } from "../src/sample";
const str = (v: unknown) => String(v ?? "").trim();
const hash = (v: string) =>
  createHash("sha256").update(v).digest("hex").slice(0, 24);
export function migratePipeline(
  db: DatabaseSync,
  raw: unknown,
  dryRun = false,
) {
  const source = validateDataset(raw),
    at = new Date().toISOString();
  const clients = new Map(source.clientes.map((c) => [str(c.ID_CLIENTE), c]));
  const operations: OperationInput[] = [],
    records: RecordInput[] = [];
  const ids = new Set<string>();
  for (const row of source.operacoes) {
    const id = str(row.ID_OPERACAO),
      client = clients.get(str(row.ID_CLIENTE));
    if (!client) throw new Error("Operação sem cliente na origem.");
    if (ids.has(id)) throw new Error("ID de operação duplicado.");
    ids.add(id);
    const product = products.includes(str(row.PRODUTO_SOLICITADO) as any)
      ? str(row.PRODUTO_SOLICITADO)
      : "Não informado";
    const stage = statusLabel(row.STATUS_PIPELINE);
    if (!stages.includes(stage as any))
      throw new Error("Etapa de origem não mapeada: " + stage);
    const op = validateOperation({
      id,
      company: str(client.RAZAO_SOCIAL),
      cnpj: /^(\d{11}|\d{14})$/.test(str(client.CNPJ_CPF).replace(/\D/g, ""))
        ? str(client.CNPJ_CPF)
        : "",
      contact: str(client.CONTATO_PRINCIPAL),
      email: str(client.EMAIL),
      phone: str(client.CELULAR),
      product,
      stage,
      owner: str(row.RESPONSAVEL_INTERNO) || "Não informado",
      requestedCents: legacyMoney(row.VALOR_SOLICITADO),
      approvedCents: legacyMoney(row.VALOR_APROVADO_TOTAL),
      revenueCents: legacyMoney(client.FATURAMENTO_ANUAL),
      nextAction: str(row.PROXIMA_ACAO),
      dueDate: str(row.DATA_PROXIMA_ACAO),
      institution: "",
      notes: str(row.TESE_CREDITO_RESUMIDA),
    });
    operations.push(op);
    records.push({
      id: "profile-" + id,
      kind: "profile",
      operationId: id,
      data: {
        clientId: str(client.ID_CLIENTE),
        city: str(client.CIDADE),
        state: str(client.UF),
        address: "",
        segment: str(client.SEGMENTO),
        source: "Importação do pipeline",
        importIssues: op.cnpj
          ? []
          : [
              "Documento ausente ou incompleto na origem; conferir antes de emitir contrato.",
            ],
        originalClient: client,
        originalOperation: row,
        guarantees: source.garantias.filter((x) => str(x.ID_OPERACAO) === id),
        documents: source.documentos.filter(
          (x) =>
            str(x.ID_OPERACAO) === id ||
            str(x.ID_CLIENTE) === str(client.ID_CLIENTE),
        ),
        history: source.historico.filter((x) => str(x.ID_OPERACAO) === id),
      },
    });
  }
  for (const row of source.instituicoes_operacao) {
    const operationId = str(row.ID_OPERACAO);
    if (!ids.has(operationId))
      throw new Error("Vínculo sem operação na origem.");
    const bankId =
      str(row.ID_INSTITUICAO) && str(row.ID_INSTITUICAO) !== "0"
        ? "bank-" + hash(str(row.ID_INSTITUICAO))
        : "";
    const manager = str(row.GERENTE),
      managerId =
        bankId && manager && manager.toLowerCase() !== "a definir"
          ? "manager-" +
            hash(bankId + "|" + manager.normalize("NFC").toLowerCase())
          : "";
    const status = statusLabel(row.STATUS_NA_INSTITUICAO);
    records.push({
      id: "placement-" + str(row.ID_VINCULO_INSTITUICAO),
      kind: "placement",
      operationId,
      data: {
        bankId,
        managerId,
        institution: str(row.NOME_INSTITUICAO),
        manager,
        status,
        product: str(row.PRODUTO),
        requestedCents: legacyMoney(row.VALOR_SOLICITADO),
        approvedCents: legacyMoney(row.VALOR_APROVADO),
        notes: str(row.PENDENCIA),
        nextAction: str(row.PROXIMA_ACAO),
        dueDate: str(row.DATA_PROXIMA_ACAO),
        active: !isInactive(status),
        sourceUpdatedAt: str(row.DATA_ATUALIZACAO),
        source: row,
      },
    });
  }
  for (const r of records) {
    if (r.kind === "placement") r.id = "placement-" + hash(r.id);
    validateRecord(r);
  }
  if (dryRun)
    return {
      clients: clients.size,
      operations: operations.length,
      placements: source.instituicoes_operacao.length,
      added: 0,
      linked: 0,
      removed: 0,
    };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS migration_backups(id TEXT PRIMARY KEY,data TEXT NOT NULL)",
    );
    const backup = {
      operations: db.prepare("SELECT * FROM operations").all(),
      activities: db.prepare("SELECT * FROM activities").all(),
    };
    db.prepare("INSERT OR IGNORE INTO migration_backups VALUES (?,?)").run(
      "before-real-pipeline",
      JSON.stringify(backup),
    );
    const demoIds = new Set(sampleOperations().map((x) => x.id));
    let removed = 0;
    for (const row of db.prepare("SELECT id,data FROM operations").all()) {
      const op = JSON.parse(String(row.data));
      if (
        demoIds.has(String(row.id)) ||
        op.company === "Prisma Serviços · exemplo de cadastro"
      ) {
        db.prepare("DELETE FROM operations WHERE id=?").run(row.id);
        removed++;
        for (const event of db.prepare("SELECT id,data FROM activities").all())
          if (JSON.parse(String(event.data)).operationId === row.id)
            db.prepare("DELETE FROM activities WHERE id=?").run(event.id);
      }
    }
    let added = 0;
    for (const op of operations) {
      const saved = db
        .prepare("INSERT OR IGNORE INTO operations VALUES (?,?)")
        .run(
          op.id,
          JSON.stringify({ ...op, version: 1, createdAt: at, updatedAt: at }),
        );
      added += Number(saved.changes);
    }
    let linked = 0;
    for (const r of records) {
      const saved = db
        .prepare("INSERT OR IGNORE INTO workspace_records VALUES (?,?)")
        .run(
          r.id,
          JSON.stringify({ ...r, version: 1, createdAt: at, updatedAt: at }),
        );
      linked += Number(saved.changes);
    }
    db.exec("COMMIT");
    return {
      clients: clients.size,
      operations: operations.length,
      placements: source.instituicoes_operacao.length,
      added,
      linked,
      removed,
    };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
