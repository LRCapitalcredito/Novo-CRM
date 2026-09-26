import { useEffect, useState } from "react";
import { Copy, FolderOpen, MessageCircle, Link2, Check } from "lucide-react";
import { Drawer, DirectoryEditor } from "./DirectoryPages";
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
  const [url, setUrl] = useState(profile?.data.driveFolderUrl || ""), [name, setName] = useState(profile?.data.driveFolderName || ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [catalog,setCatalog]=useState<{name:string;url:string}[]>([]),[search,setSearch]=useState(""),[manual,setManual]=useState(false),[loading,setLoading]=useState(!!repo.listDriveFolders);
  useEffect(()=>{let active=true;repo.listDriveFolders?.().then(f=>{if(active)setCatalog(f);}).catch(()=>{if(active)setError("Não foi possível carregar a lista de pastas. Você pode colar o link abaixo.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[repo]);
  const suggestions: {name: string; url: string}[] = Array.isArray(profile?.data.driveFolderSuggestions) ? profile!.data.driveFolderSuggestions.filter((s: any) => typeof s.name === "string" && driveFolderUrl(s.url)) : [];
  const normalized = driveFolderUrl(url);
  const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const options=[...new Map([...suggestions,...catalog,...(url?[{name:name||"Pasta atual",url}]:[])].filter(f=>driveFolderUrl(f.url)).map(f=>[f.url,f])).values()].sort((a,b)=>Number(suggestions.some(s=>s.url===b.url))-Number(suggestions.some(s=>s.url===a.url))||a.name.localeCompare(b.name,"pt-BR"));
  return <Drawer title="Pasta do Drive do cliente" close={() => !busy && close()}><form className="module-form" onSubmit={async e => {e.preventDefault();e.stopPropagation(); setError(""); setBusy(true); try {if (url && !normalized) throw Error("Selecione uma pasta ou informe um link de pasta válido do Google Drive."); await repo.saveRecord(recordInput("profile", op.id, {...(profile?.data || {address:"",city:"",state:"",segment:""}), driveFolderUrl: normalized || "", driveFolderName: name.trim()}, profile?.id), profile?.version ?? null); notify("Pasta do cliente atualizada."); close();} catch(e) {setError(message(e));} finally {setBusy(false);}}}>
    <p><strong>{op.company}</strong><br/>{op.cnpj}</p>
    <p>Vincule a pasta uma vez para abrir os documentos pela carteira e preparar o WhatsApp ao gerente.</p>
    <fieldset disabled={!canEdit||busy}><label>Buscar pasta pelo nome<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Digite o nome do cliente ou da pasta"/></label><label>Selecionar pasta do cliente<select value={manual?"":url} onChange={e=>{const folder=options.find(f=>f.url===e.target.value);setUrl(folder?.url||"");setName(folder?.name||"");setManual(false);}}><option value="">{loading?"Carregando pastas…":"Selecione uma pasta"}</option>{options.filter(f=>f.url===url||norm(f.name).includes(norm(search))).map(f=><option key={f.url} value={f.url}>{suggestions.some(s=>s.url===f.url)?"Sugestão · ":""}{f.name}</option>)}</select></label><p className="module-footnote">{options.length} pastas disponíveis no catálogo. Confira o cliente e o CNPJ antes de salvar.</p><button type="button" onClick={()=>setManual(!manual)}>{manual?"Voltar à seleção":"Usar o link de outra pasta"}</button>
    {manual&&<><label>Link da pasta do Google Drive<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" maxLength={2000}/></label><label>Nome da pasta<input value={name} onChange={e=>setName(e.target.value)} maxLength={200}/></label></>}{normalized&&<a href={normalized} target="_blank" rel="noreferrer">Abrir a pasta selecionada ↗</a>}{url&&<button type="button" onClick={()=>{setUrl("");setName("");}}>Remover vínculo com a pasta</button>}</fieldset>
    <a href={`https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(op.company)}`} target="_blank" rel="noreferrer">Localizar pasta no Google Drive ↗</a>
    <p className="module-footnote">O sistema guarda o link. Os documentos e as permissões de acesso continuam no Google Drive; vincular a pasta não a torna pública.</p>{error && <p role="alert" className="module-error">{error}</p>}<div className="module-actions"><button type="button" onClick={close}>Fechar</button><button className="primary" disabled={!canEdit || busy || (!!url && !normalized)}>{busy?"Salvando…":"Salvar pasta selecionada"}</button></div>
  </form></Drawer>;
}
export function ManagerContact({op, placement, state, repo, canEdit, notify}: Props & {placement: WorkspaceRecord}) {
  const [open, setOpen] = useState(false);
  return <><button className="manager-whatsapp" onClick={() => setOpen(true)}><MessageCircle size={14}/> WhatsApp do gerente</button>{open && <ManagerMessage key={placement.data.managerId} op={op} placement={placement} state={state} repo={repo} canEdit={canEdit} notify={notify} close={() => setOpen(false)}/>}</>;
}
function ManagerMessage({op, placement, state, repo, canEdit, notify, close}: Props & {placement: WorkspaceRecord; close: () => void}) {
  const [editing,setEditing]=useState<Manager|null>(null);
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
    {manager&&<div className="module-actions"><span>{manager.phone||"Telefone pendente"}</span>{canEdit&&<button type="button" onClick={()=>setEditing(manager)}>Conferir contato do gerente</button>}</div>}
    {editing&&<DirectoryEditor record={editing} banks={(state.directory?.records??[]).filter((r):r is Bank=>r.kind==="bank")} events={state.directory?.events??[]} canEdit={canEdit} close={()=>setEditing(null)} save={async input=>{await repo.saveDirectory(input,editing.version);setEditing(null);notify("Contato do gerente atualizado.");}}/>}
    {fit.status !== "compatible" && <div className={`fit-panel ${fit.status}`}><strong>{fit.label}</strong>{fit.issues.map(i => <p key={i.key+i.message}>{i.message}</p>)}{fit.conflicts.length > 0 && <p>Resolva as divergências em “Abrir atuação” antes de encaminhar a pasta.</p>}</div>}
    {base !== fingerprint && <p role="alert">A pasta ou o destinatário mudou. Atualize a mensagem antes de continuar.</p>}
    <button onClick={() => {setText(initial());setBase(fingerprint);setReviewed(false);}} disabled={!manager || !folder}>Atualizar mensagem com a pasta atual</button>
    <label>Mensagem para revisar<textarea rows={13} value={text} onChange={e => {setText(e.target.value);setReviewed(false);}}/></label>
    <label className="check-field"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/> Revisei a pasta, o destinatário e o acesso do gerente no Drive.</label>
    <p className="module-footnote">A mensagem abre preenchida. O envio é feito por você no WhatsApp e não é registrado automaticamente como concluído.</p>
    <div className="module-actions"><button disabled={!text.trim()} onClick={async () => {try {await navigator.clipboard.writeText(text);notify("Mensagem copiada.");} catch {notify("Selecione o texto para copiar.");}}}><Copy size={14}/> Copiar mensagem</button>{ready ? <a className="button primary" href={url!} target="_blank" rel="noreferrer">Abrir WhatsApp do gerente ↗</a> : <button className="primary" disabled>Abrir WhatsApp do gerente</button>}</div>
  </div></Drawer>;
}
