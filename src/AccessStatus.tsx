import { useState } from "react";
import { AlertCircle, LoaderCircle, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import type { AccessState } from "./authAccess";
import type { Repository } from "./repository";
import "./access-status.css";

export function AccessStatus({ repo, access, error }: { repo: Repository; access: AccessState; error: string }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const checking = access.status === "checking";
  async function act(action: () => Promise<void>) {
    setBusy(true); setActionError("");
    try { await action(); }
    catch { setActionError("Não foi possível concluir a ação. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="access-status" aria-busy={checking || busy}>
    <div className="eyebrow">ACESSO À LR CAPITAL</div>
    <div className="access-account"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Conta conectada</strong>{access.email && <span>{access.email}</span>}</div></div>
    <div role="status" aria-live="polite">
      <h2>{checking ? "Verificando seu acesso" : access.status === "denied" ? "Conta sem permissão" : "Acesso temporariamente indisponível"}</h2>
      {checking ? <p className="access-checking"><LoaderCircle size={18} className="spin" aria-hidden="true" />Consultando a permissão da sua conta na equipe…</p> : <p className="access-explanation">{error}</p>}
    </div>
    {access.reason === "quota" && <p className="access-note"><AlertCircle size={18} aria-hidden="true" /><span>A carteira permanece protegida. O carregamento depende da liberação da cota do banco de dados.</span></p>}
    <div className="access-actions">
      {repo.retryAccess && <button type="button" className="button primary" disabled={busy || checking} onClick={() => void act(() => repo.retryAccess!())}><RefreshCw size={16} aria-hidden="true" />{checking ? "Verificando…" : "Tentar carregar novamente"}</button>}
      <button type="button" className="button secondary" disabled={busy} onClick={() => void act(() => repo.logout())}><LogOut size={16} aria-hidden="true" />Sair desta conta</button>
    </div>
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
  </div>;
}
