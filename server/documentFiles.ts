import { createHash, randomUUID } from "node:crypto";
import type { DocumentFile } from "../src/workflow";
export const maxDocumentBytes = 10 * 1024 * 1024;
export function inspectDocumentFile(name: string, bytes: Uint8Array): DocumentFile {
  if (!name || name.length > 180 || /[\\/\x00-\x1f\x7f]/.test(name)) throw new Error("Nome de arquivo inválido.");
  if (!bytes.length || bytes.length > maxDocumentBytes) throw new Error("O arquivo precisa ter entre 1 byte e 10 MB.");
  const ext = name.split(".").at(-1)?.toLowerCase(), data = Buffer.from(bytes);
  const mime = ext === "pdf" && data.subarray(0, 5).toString() === "%PDF-" ? "application/pdf"
    : ["jpg", "jpeg"].includes(ext || "") && data[0] === 255 && data[1] === 216 && data[2] === 255 ? "image/jpeg"
    : ext === "png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
    : ["docx", "xlsx"].includes(ext || "") && data[0] === 80 && data[1] === 75 && data[2] === 3 && data[3] === 4 ? (ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") : "";
  if (!mime) throw new Error("Envie PDF, PNG, JPG, DOCX ou XLSX com conteúdo compatível com a extensão.");
  return { id: randomUUID(), name, mime, size: data.length, sha256: createHash("sha256").update(data).digest("hex"), uploadedAt: new Date().toISOString() };
}
