import type { Operation } from "./domain";
import type { Manager } from "./directory";
export function driveFolderUrl(value: string): string | null {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:" || u.hostname !== "drive.google.com" || u.username || u.password || u.port) return null;
    const match = u.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,200})\/?$/);
    if (!match) return null;
    const url = new URL(`https://drive.google.com/drive/folders/${match[1]}`);
    const resourceKey = u.searchParams.get("resourcekey");
    if (resourceKey && /^[\w-]{1,200}$/.test(resourceKey)) url.searchParams.set("resourcekey", resourceKey);
    return url.toString();
  } catch { return null; }
}
export function validateDriveProfile(data: Record<string, any>) {
  if (data.driveFolderUrl !== undefined && (typeof data.driveFolderUrl !== "string" || (data.driveFolderUrl && !driveFolderUrl(data.driveFolderUrl)))) throw Error("Cole o link de uma pasta do Google Drive (drive.google.com/drive/folders/…).");
  if (data.driveFolderName !== undefined && (typeof data.driveFolderName !== "string" || data.driveFolderName.length > 200)) throw Error("Nome da pasta inválido.");
}
export function managerFolderDraft(op: Operation, manager: Manager, folder: string) {
  const url = driveFolderUrl(folder);
  if (!url) throw Error("Vincule a pasta do Drive do cliente antes de preparar o envio.");
  const name = manager.name.trim().split(/\s+/)[0];
  return `Oi, ${name}! Tudo bem? 😊\n\nEstou te enviando a pasta do Drive da ${op.company}${op.cnpj ? ` (CNPJ ${op.cnpj})` : ""}, com a documentação para vocês avaliarem a operação:\n${url}\n\nConsegue confirmar se conseguiu acessar? Se precisar de algum documento adicional, me avisa por aqui que a gente organiza.\n\nObrigado!\n${op.owner && op.owner !== "Não informado" ? op.owner + " · " : ""}LR Capital`;
}
