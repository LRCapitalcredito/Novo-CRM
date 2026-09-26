import { useRef, useState } from "react";
import { History, Save } from "lucide-react";
import { Drawer } from "./DirectoryPages";
import { recordInput, type WorkspaceRecord } from "./records";
import type { Repository } from "./repository";
import type { Operation } from "./domain";
import { celular } from "./brFormats";
import { localDateTime, messageStatuses, type MessageChannel, type MessageStatus } from "./conversations";
import { whatsappMessageUrl, emailMessageUrl } from "./clientFlow";
import { isQuotaError, messageSaveError } from "./serviceErrors";
import "./conversations.css";

type Props={op:Operation;records:WorkspaceRecord[];repo:Repository;canEdit:boolean;notify:(s:string)=>void};
type Recipient={channel:MessageChannel;recipient:string;recipientName:string;placementId?:string};
const errorText=messageSaveError;

export function SavedMessageActions({op,repo,canEdit,notify,channel,recipient,recipientName,placementId="",body,subject="",ready}:Omit<Props,"records">&Recipient&{body:string;subject?:string;ready:boolean}) {
  const [busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(""),[savedKey,setSavedKey]=useState("");
  const working=useRef(false);
  const [quotaBlocked,setQuotaBlocked]=useState(false);
  const fingerprint=JSON.stringify([body,subject,recipient,placementId,channel]);
  const url=channel==="WhatsApp"?whatsappMessageUrl(recipient,body):emailMessageUrl(recipient,subject,body);
  const [confirmationKey,setConfirmationKey]=useState("");
  const sendConfirmed=confirmed&&confirmationKey===fingerprint;
  async function save(status:MessageStatus,open=false) {
    if(working.current||!canEdit||!ready||!body.trim())return;
    if(status==="sent_manual"&&!sendConfirmed)return;
    working.current=true;setBusy(true);setError("");setQuotaBlocked(false);
    // Reserve a tab during the click; navigating happens only after the draft has been saved.
    const tab=open&&url?window.open("about:blank","_blank"):null;
    if(tab)tab.opener=null;
    try {
      const key=status+fingerprint;
      if(savedKey!==key){await repo.saveRecord(recordInput("message",op.id,{channel,recipient,recipientName,placementId,body:body.trim(),subject,status,source:"manual",sendConfirmed:status==="sent_manual",occurredAt:new Date().toISOString(),recordedBy:repo.session?.name||op.owner},crypto.randomUUID()),null);setSavedKey(key);}
      notify(status==="draft"?"Rascunho salvo no histórico. O envio ainda não foi confirmado.":"Envio informado registrado no histórico.");
      if(open&&url){if(tab)tab.location.href=url;else setError("Rascunho salvo. O navegador bloqueou a nova aba; use o link abaixo.");}
      setConfirmed(false);
    } catch(e){tab?.close();setError(errorText(e));setQuotaBlocked(isQuotaError(e));}finally{working.current=false;setBusy(false);}
  }
  return <section className="message-save"><div className="module-actions"><button type="button" disabled={!canEdit||!ready||!body.trim()||busy} onClick={()=>void save("draft")}><Save size={14}/> Salvar rascunho</button><button type="button" className="primary" disabled={!canEdit||!ready||!url||!body.trim()||busy} onClick={()=>void save("draft",true)}>Salvar e abrir {channel} ↗</button></div>
    <label className="check-field"><input type="checkbox" checked={sendConfirmed} disabled={!canEdit||!ready||busy} onChange={e=>{setConfirmed(e.target.checked);setConfirmationKey(fingerprint);}}/> Confirmo que enviei esta mensagem pelo {channel}.</label>
    <button type="button" disabled={!canEdit||!ready||!sendConfirmed||busy||savedKey==="sent_manual"+fingerprint} onClick={()=>void save("sent_manual")}>Registrar envio realizado</button>
    {error&&<p role="alert" className="module-error">{error} {url&&ready&&!busy&&savedKey==="draft"+fingerprint&&<a href={url} target="_blank" rel="noreferrer">Abrir {channel} ↗</a>}</p>}
    {quotaBlocked&&canEdit&&ready&&url&&body.trim()&&!busy&&<div className="message-quota-fallback"><p>Ao continuar, esta ação não salva a mensagem no CRM nem confirma o envio.</p><a className="button" href={url} target="_blank" rel="noreferrer">Abrir {channel} sem salvar no CRM ↗</a></div>}
    <p className="module-footnote">{quotaBlocked?"O histórico será atualizado somente após um salvamento bem-sucedido. ":"O rascunho e a confirmação ficam salvos para a equipe. "}Abrir o aplicativo não comprova envio, entrega ou leitura.</p>
  </section>;
}

export function ConversationHistory({op,records,repo,canEdit,notify,channel,recipient,recipientName,placementId="",all=false}:Props&Recipient&{all?:boolean}) {
  const [incoming,setIncoming]=useState(""),[at,setAt]=useState(localDateTime),[busy,setBusy]=useState(false),[error,setError]=useState(""),[visible,setVisible]=useState(30);
  const working=useRef(false);
  const messages=records.filter(r=>r.kind==="message"&&r.operationId===op.id&&(all||r.data.channel===channel&&r.data.placementId===placementId)).sort((a,b)=>b.data.occurredAt.localeCompare(a.data.occurredAt));
  async function recordResponse(){if(working.current||!canEdit)return;working.current=true;setBusy(true);setError("");try {
    const occurredAt=new Date(at).toISOString();
    await repo.saveRecord(recordInput("message",op.id,{channel,recipient,recipientName,placementId,body:incoming.trim(),subject:"",status:"received_manual",source:"manual",sendConfirmed:false,occurredAt,recordedBy:repo.session?.name||op.owner},crypto.randomUUID()),null);
    setIncoming("");notify("Resposta registrada no histórico do cliente.");
  }catch(e){setError(errorText(e));}finally{working.current=false;setBusy(false);}}
  return <section className="conversation-history"><h3>Histórico de mensagens <small>{messages.length}</small></h3><p className="module-footnote">Registros feitos pela equipe. A sincronização automática do WhatsApp ainda não está conectada.</p>
    {!all&&<details><summary>Registrar resposta recebida</summary><label>Texto recebido<textarea rows={4} value={incoming} maxLength={16000} disabled={!canEdit||busy} onChange={e=>setIncoming(e.target.value)} placeholder="Cole a resposta recebida no aplicativo."/></label><label>Recebida em<input type="datetime-local" value={at} max={localDateTime()} disabled={!canEdit||busy} onChange={e=>setAt(e.target.value)}/></label><button type="button" disabled={!canEdit||busy||!incoming.trim()} onClick={()=>void recordResponse()}>Salvar resposta no histórico</button>{error&&<p role="alert" className="module-error">{error}</p>}</details>}
    {!messages.length&&<p className="module-footnote">Nenhuma mensagem registrada para esta conversa.</p>}
    <div className="conversation-list">{messages.slice(0,visible).map(r=><article key={r.id} className={`conversation-bubble ${r.data.status}`}><header><strong>{messageStatuses[r.data.status as MessageStatus]}</strong><span>{r.data.channel} · {r.data.recipientName}</span></header><small>{new Date(r.data.occurredAt).toLocaleString("pt-BR")} · Registrado por {r.data.recordedBy}</small>{r.data.recipient&&<small>{r.data.channel==="WhatsApp"?celular(r.data.recipient):r.data.recipient}</small>}{r.data.subject&&<strong>{r.data.subject}</strong>}<p>{r.data.body}</p></article>)}</div>{messages.length>visible&&<button type="button" onClick={()=>setVisible(visible+30)}>Mostrar mais mensagens</button>}
  </section>;
}

export function ConversationLogButton(props:Props) {
  const [open,setOpen]=useState(false);
  return <><button type="button" aria-label={"Conversas de "+props.op.company} onClick={()=>setOpen(true)}><History size={15}/><span>Conversas</span></button>{open&&<Drawer title={"Conversas · "+props.op.company} close={()=>setOpen(false)}><div className="module-form"><ConversationHistory {...props} all channel="WhatsApp" recipient={props.op.phone} recipientName={props.op.contact||props.op.company}/></div></Drawer>}</>;
}
