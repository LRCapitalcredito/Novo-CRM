export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (typeof code === "string" && /^(?:firestore\/)?resource-exhausted$/.test(code)) ||
    (typeof message === "string" && /quota[\s_-]+exceeded/i.test(message));
}

export function serviceErrorText(error: unknown, fallback: string): string {
  if (isQuotaError(error)) return "O banco de dados do CRM atingiu um limite de uso. Tente novamente após a liberação da cota. Isso não é um bloqueio do WhatsApp.";
  return error instanceof Error ? error.message : fallback;
}

export function messageSaveError(error: unknown): string {
  if (isQuotaError(error)) return "O banco de dados do CRM atingiu um limite de uso. Esta tentativa não foi salva no histórico. O texto continua nesta tela; copie-o antes de fechar ou recarregar.";
  return serviceErrorText(error, "Não foi possível salvar a mensagem.");
}
