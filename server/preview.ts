import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  validateOperation,
  type Operation,
  type Activity,
  type WorkspaceState,
} from "../src/domain";
import { sampleOperations } from "../src/sample";
import { createDirectoryStore } from "./directoryStore";
import { createRecordStore } from "./recordStore";
import { extractDiagnosis } from "./diagnosisAi";
import { migratePipeline } from "./migratePipeline";
import { maxDocumentBytes } from "./documentFiles";

export function createPreviewStore(filename: string) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, data TEXT NOT NULL, at TEXT NOT NULL);",
  );
  const directory = createDirectoryStore(db);
  const records = createRecordStore(db);
  return {
    directory,
    records,
    importPipeline(data: unknown, filename: string) {
      migratePipeline(db, data, true);
      const summary = directory.import(data, filename);
      const migrated = migratePipeline(db, data);
      return { ...summary, migrated };
    },
    seed() {
      const count = db
        .prepare("SELECT COUNT(*) AS n FROM operations")
        .get() as { n: number };
      if (!count.n)
        for (const op of sampleOperations())
          db.prepare("INSERT INTO operations VALUES (?,?)").run(
            op.id,
            JSON.stringify(op),
          );
    },
    state(): WorkspaceState {
      return {
        ...records.state(),
        directory: directory.state(),
        operations: db
          .prepare("SELECT data FROM operations ORDER BY id")
          .all()
          .map((r) => JSON.parse(String(r.data))),
        activities: db
          .prepare("SELECT data FROM activities ORDER BY at DESC LIMIT 100")
          .all()
          .map((r) => JSON.parse(String(r.data))),
      };
    },
    save(
      raw: unknown,
      expectedVersion: number | null,
      actor = "Ricardo · prévia",
    ) {
      const input = validateOperation(raw);
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = db
          .prepare("SELECT data FROM operations WHERE id=?")
          .get(input.id);
        const old: Operation | null = row ? JSON.parse(String(row.data)) : null;
        if ((old?.version ?? null) !== expectedVersion)
          throw new Error(
            "CONFLICT: Esta operação foi alterada em outra sessão. Abra novamente antes de salvar.",
          );
        const at = new Date().toISOString();
        const next: Operation = {
          ...input,
          version: (old?.version ?? 0) + 1,
          createdAt: old?.createdAt ?? at,
          updatedAt: at,
        };
        const event: Activity = {
          id: randomUUID(),
          operationId: next.id,
          company: next.company,
          actor,
          at,
          action: old ? "Operação atualizada" : "Operação criada",
          before: old,
          after: next,
        };
        db.prepare(
          "INSERT INTO operations(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        ).run(next.id, JSON.stringify(next));
        db.prepare("INSERT INTO activities(id,data,at) VALUES (?,?,?)").run(
          event.id,
          JSON.stringify(event),
          at,
        );
        db.exec("COMMIT");
        return next;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}

async function readBody(req: IncomingMessage) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 8000000)
      throw new Error("Solicitação muito grande (limite: 8 MB).");
  }
  return JSON.parse(body);
}

export function allowedPreviewRequest(host: string, origin: string | undefined, port: number) {
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(host) && (!origin || origin === `http://${host}`);
}
export function previewPlugin(): Plugin {
  return {
    name: "lr-local-preview",
    apply: "serve",
    configureServer(server) {
      const filename =
        process.env.LR_PREVIEW_DB ||
        resolve(process.cwd(), ".preview", "workspace.sqlite");
      const store = createPreviewStore(filename);
      if (process.env.LR_PREVIEW_DEMO === "1") store.seed();
      const subscribers = new Set<ServerResponse>();
      const publish = () => {
        for (const res of subscribers)
          res.write(`data: ${JSON.stringify(store.state())}\n\n`);
      };
      const heartbeat = setInterval(() => {
        for (const res of subscribers) res.write(": connected\n\n");
      }, 20000);
      server.httpServer?.once("close", () => {
        clearInterval(heartbeat);
        for (const res of subscribers) res.end();
        store.close();
      });
      server.middlewares.use("/__preview", async (req, res, next) => {
        const origin = req.headers.origin;
        const host = req.headers.host || "";
        const address = server.httpServer?.address();
        const port = address && typeof address === "object" ? address.port : server.config.server.port;
        if (!port || !allowedPreviewRequest(host, origin, port)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        const respond = (status: number, data: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(data));
        };
        try {
          if(req.url==="/drive-folders"&&req.method==="GET") {
            respond(200,process.env.LR_DRIVE_FOLDERS?JSON.parse(readFileSync(process.env.LR_DRIVE_FOLDERS,"utf8")):[]);return;
          }
          const uploadId = req.url?.match(/^\/document-files\/([-\w]{6,100})$/)?.[1];
          if (uploadId && req.method === "POST") {
            const chunks: Buffer[] = []; let size = 0;
            for await (const chunk of req) { size += chunk.length; if (size > maxDocumentBytes) throw new Error("O arquivo excede o limite de 10 MB."); chunks.push(Buffer.from(chunk)); }
            const version = Number(req.headers["x-lr-version"]);
            if (!Number.isSafeInteger(version) || version < 1) throw new Error("Versão do documento inválida.");
            const name = decodeURIComponent(String(req.headers["x-lr-filename"] || ""));
            respond(200, store.records.attach(uploadId, version, name, Buffer.concat(chunks)));
            publish(); return;
          }
          const fileId = req.url?.match(/^\/document-files\/([-\w]{6,100})\/download$/)?.[1];
          if (fileId && req.method === "GET") {
            const file = store.records.file(fileId);
            if (!file) { respond(404, { error: "Arquivo não encontrado neste ambiente." }); return; }
            res.writeHead(200, { "Content-Type": file.metadata.mime, "Content-Length": file.bytes.length, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.metadata.name).replace(/'/g, "%27")}`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" });
            res.end(file.bytes); return;
          }
          if (req.url === "/ai-status" && req.method === "GET") {
            respond(200, {
              available:
                !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_MODEL,
            });
            return;
          }
          if (req.url === "/diagnosis-extract" && req.method === "POST") {
            if (req.headers["content-type"] !== "application/json") {
              respond(415, { error: "Formato inválido." });
              return;
            }
            const body = await readBody(req);
            respond(200, { items: await extractDiagnosis(body.text) });
            return;
          }
          if (req.url === "/records" && req.method === "POST") {
            if (req.headers["content-type"] !== "application/json") {
              respond(415, { error: "Formato inválido." });
              return;
            }
            const body = await readBody(req);
            respond(200, store.records.save(body.record, body.expectedVersion));
            publish();
            return;
          }
          if (req.url === "/events" && req.method === "GET") {
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-store",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            });
            res.write(`data: ${JSON.stringify(store.state())}\n\n`);
            subscribers.add(res);
            req.on("close", () => subscribers.delete(res));
            return;
          }
          if (req.url === "/state" && req.method === "GET") {
            respond(200, store.state());
            return;
          }
          if (req.url?.startsWith("/imports/") && req.method === "GET") {
            respond(
              200,
              store.directory.readImport(req.url.slice("/imports/".length)),
            );
            return;
          }
          if (
            (req.url === "/directory" || req.url === "/imports") &&
            req.method === "POST"
          ) {
            if (req.headers["content-type"] !== "application/json") {
              respond(415, { error: "Formato inválido." });
              return;
            }
            const body = await readBody(req);
            const result =
              req.url === "/directory"
                ? store.directory.save(body.record, body.expectedVersion)
                : store.importPipeline(body.data, body.filename);
            respond(200, result);
            publish();
            return;
          }
          if (req.url === "/operations" && req.method === "POST") {
            if (req.headers["content-type"] !== "application/json") {
              respond(415, { error: "Formato inválido." });
              return;
            }
            const body = await readBody(req);
            const saved = store.save(body.operation, body.expectedVersion);
            respond(200, saved);
            publish();
            return;
          }
          next();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Falha ao salvar.";
          respond(message.startsWith("CONFLICT:") ? 409 : 400, {
            error: message.replace("CONFLICT: ", ""),
          });
        }
      });
    },
  };
}
