import { useState } from "react";
import { Copy, FolderOpen, MessageCircle, Link2, Check } from "lucide-react";
import { Drawer } from "./DirectoryPages";
import type { Operation, WorkspaceState } from "./domain";
import type { Manager, Bank } from "./directory";
import type { Repository } from "./repository";
import { findRecord, recordInput, type WorkspaceRecord } from "./records";
import { driveFolderUrl, managerFolderDraft } from "./clientDrive";
import { whatsappMessageUrl } from "./clientFlow";
import { institutionFit } from "./institutionFit";

type Props = {op: Operation; state: WorkspaceState; repo: Repository; canEdit: boolean; notify: (s: string) => void};
const message = (e: unknown) => e instanceof Error ? e.message : "Não foi possível salvar.";
export function CopyCnpj({cnpj, notify}: {cnpj: string; notify: (s: string) => void}) {
  const [copied, setCopied] = useState(false);
  if (!cnpj) return null;
  return <button className="cnpj-copy" title="Copiar CNPJ sem pontuação" aria-label={`Copiar CNPJ ${cnpj}`} onClick={async () => {try {await navigator.clipboard.writeText(cnpj.replace(/[^a-zA-Z0-9]/g, "")); setCopied(true); notify("CNPJ copiado sem pontuação."); setTimeout(() => setCopied(false), 2000);} catch {notify("Não foi possível copiar. Selecione o CNPJ e copie manualmente.");}}}>{copied ? <Check size={13}/> : <Copy size={13}/>} {cnpj}</button>;
}
export function DriveActions(props: Props) {
  const [open, setOpen] = useState(false);
  const profile = findRecord(props.state.records ?? [], "profile", props.op.id), url = driveFolderUrl(profile?.data.driveFolderUrl || "");
  return <div className="client-drive-actions">{url && <a href={url} target="_blank" rel="noreferrer" title={profile?.data.driveFolderName || "Pasta do cliente"}><FolderOpen size={14}/> Drive do cliente</a>}<button type="button" onClick={() => setOpen(true)} disabled={!props.canEdit && !url}><Link2 size={13}/>{url ? "Alterar pasta" : "Vincular Drive"}</button>{open && <DriveEditor {...props} profile={profile} close={() => setOpen(false)}/>}</div>;
}
function DriveEditor({op, profile, repo, canEdit, notify, close}: Props & {profile?: WorkspaceRecord; close: () => void}) {
  const [url, setUrl] = useState(profile?.data.driveFolderUrl || ""), [name, setName] = useState(profile?.data.driveFolderName || ""), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const suggestions: {name: string; url: string}[] = Array.isArray(profile?.data.driveFolderSuggestions) ? profile!.data.driveFolderSuggestions.filter((s: any) => typeof s.name === "string" && driveFolderUrl(s.url)) : [];
  const normalized = driveFolderUrl(url);
  return <Drawer title="Pasta do Drive do cliente" close={() => !busy && close()}><form className="module-form" onSubmit={async e => {e.preventDefault();e.stopPropagation(); setError(""); setBusy(true); try {if (url && (!normalized || !confirmed)) throw Error("Abra a pasta e confirme que ela pertence ao cliente."); await repo.saveRecord(recordInput("profile", op.id, {...(profile?.data || {address:"",city:"",state:"",segment:""}), driveFolderUrl: normalized || "", driveFolderName: name.trim()}, profile?.id), profile?.version ?? null); notify("Pasta do cliente atualizada."); close();} catch(e) {setError(message(e));} finally {setBusy(false);}}}>
    <p><strong>{op.company}</strong><br/>{op.cnpj}</p>
    <p>Vincule a pasta uma vez para abrir os documentos pela carteira e preparar o WhatsApp ao gerente.</p>
    {suggestions.length > 0 && <div className="drive-suggestions"><strong>Pastas encontradas pelo nome do cliente</strong><p>Confira o conteúdo e o CNPJ antes de vincular.</p>{suggestions.map(s => <div key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a><button type="button" onClick={() => {setUrl(s.url); setName(s.name); setConfirmed(false);}}>Usar esta pasta</button></div>)}</div>}
    <a href={`https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(op.company)}`} target="_blank" rel="noreferrer">Localizar pasta no Google Drive ↗</a>
    <fieldset disabled={!canEdit || busy}><label>Link da pasta do Google Drive<input type="url" value={url} onChange={e => {setUrl(e.target.value); setConfirmed(false);}} placeholder="https://drive.google.com/drive/folders/…" maxLength={2000}/></label><label>Nome da pasta<input value={name} onChange={e => setName(e.target.value)} maxLength={200}/></label>{normalized && <a href={normalized} target="_blank" rel="noreferrer">Abrir pasta para conferir ↗</a>}{url && <label className="check-field"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> Conferi que esta pasta pertence a {op.company}.</label>}</fieldset>
    <p className="module-footnote">O sistema guarda o link. Os documentos e as permissões de acesso continuam no Google Drive; vincular a pasta não a torna pública.</p>{error && <p role="alert" className="module-error">{error}</p>}<div className="module-actions"><button type="button" onClick={close}>Fechar</button><button className="primary" disabled={!canEdit || busy || (!!url && (!normalized || !confirmed))}>Salvar pasta</button></div>
  </form></Drawer>;
}
export function ManagerContact({op, placement, state, repo, canEdit, notify}: Props & {placement: WorkspaceRecord}) {
  const [open, setOpen] = useState(false);
  return <><button className="manager-whatsapp" onClick={() => setOpen(true)}><MessageCircle size={14}/> WhatsApp do gerente</button>{open && <ManagerMessage key={placement.data.managerId} op={op} placement={placement} state={state} repo={repo} canEdit={canEdit} notify={notify} close={() => setOpen(false)}/>}</>;
}
function ManagerMessage({op, placement, state, repo, canEdit, notify, close}: Props & {placement: WorkspaceRecord; close: () => void}) {
  const manager = state.directory?.records.find(r => r.kind === "manager" && r.id === placement.data.managerId) as Manager | undefined;
  const bank = state.directory?.records.find(r => r.kind === "bank" && r.id === placement.data.bankId) as Bank | undefined;
  const profile = findRecord(state.records ?? [], "profile", op.id)?.data ?? {}, folder = driveFolderUrl(profile.driveFolderUrl || "");
  const fit = institutionFit(op, profile, bank, manager, placement.data);
  const fingerprint = JSON.stringify([op.company,op.cnpj,op.owner,folder,manager?.id,manager?.name,manager?.phone]);
  const initial = () => manager && folder ? managerFolderDraft(op, manager, folder) : "";
  const [text, setText] = useState(initial), [base, setBase] = useState(fingerprint), [reviewed, setReviewed] = useState(false);
  const url = manager ? whatsappMessageUrl(manager.phone, text) : null;
  const ready = !!url && !!folder && text.trim().length > 0 && reviewed && base === fingerprint && fit.status !== "conflict";
  return <Drawer title="Enviar pasta ao gerente" close={close}><div className="module-form"><p><strong>{op.company}</strong> → {manager?.name || "Gerente não cadastrado"} · {bank?.name || placement.data.institution}</p><DriveActions op={op} state={state} repo={repo} canEdit={canEdit} notify={notify}/>
    {(!manager || !url) && <p className="module-error">Cadastre o gerente e um celular válido na atuação antes de abrir o WhatsApp.</p>}
    {fit.status !== "compatible" && <div className={`fit-panel ${fit.status}`}><strong>{fit.label}</strong>{fit.issues.map(i => <p key={i.key+i.message}>{i.message}</p>)}{fit.conflicts.length > 0 && <p>Resolva as divergências em “Abrir atuação” antes de encaminhar a pasta.</p>}</div>}
    {base !== fingerprint && <p role="alert">A pasta ou o destinatário mudou. Atualize a mensagem antes de continuar.</p>}
    <button onClick={() => {setText(initial());setBase(fingerprint);setReviewed(false);}} disabled={!manager || !folder}>Atualizar mensagem com a pasta atual</button>
    <label>Mensagem para revisar<textarea rows={13} value={text} onChange={e => {setText(e.target.value);setReviewed(false);}}/></label>
    <label className="check-field"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/> Revisei a pasta, o destinatário e o acesso do gerente no Drive.</label>
    <p className="module-footnote">A mensagem abre preenchida. O envio é feito por você no WhatsApp e não é registrado automaticamente como concluído.</p>
    <div className="module-actions"><button disabled={!text.trim()} onClick={async () => {try {await navigator.clipboard.writeText(text);notify("Mensagem copiada.");} catch {notify("Selecione o texto para copiar.");}}}><Copy size={14}/> Copiar mensagem</button>{ready ? <a className="button primary" href={url!} target="_blank" rel="noreferrer">Abrir WhatsApp do gerente ↗</a> : <button className="primary" disabled>Abrir WhatsApp do gerente</button>}</div>
  </div></Drawer>;
}
