import type {Operation} from "./domain";
import {today} from "./domain";
import {requestableDocuments} from "./clientFlow";
import {expiredDocument} from "./workflow";
import type {WorkspaceRecord} from "./records";
export function communicationChecklist(op:Operation,records:WorkspaceRecord[]) {
 const existing=records.filter(r=>r.operationId===op.id&&r.kind==="document"&&!r.data.archived);
 return [...existing,...requestableDocuments(op,records).filter(r=>r.version===0)];
}
export function checklistFingerprint(op:Operation,records:WorkspaceRecord[]) {
 return JSON.stringify([op.company,op.contact,op.phone,op.email,communicationChecklist(op,records).map(r=>[r.id,r.version]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}
export function receivedDocument(record:WorkspaceRecord,location:string,actor:string):Record<string,any> {
 if(expiredDocument(record))throw Error("O item está vencido. Registre a nova versão e a validade no acompanhamento.");
 if(location.trim().length<3)throw Error("Informe onde os documentos recebidos estão guardados (Drive, e-mail ou anexo).");
 return {...record.data,status:"Recebido",receiptLocation:location.trim(),receivedOn:today(),receivedBy:actor};
}
export function reviewedRequest(op:Operation,records:WorkspaceRecord[],selected:Set<string>) {
 const docs=requestableDocuments(op,records).filter(r=>selected.has(r.id));
 const name=op.contact.trim().split(/\s+/)[0];
 const items=docs.map(d=>`• ${d.data.title}${d.data.period?` (${d.data.period})`:""}${expiredDocument(d)?" — versão atualizada":d.data.status==="A corrigir"?` — ${d.data.reviewNotes}`:""}`);
 return `Olá${name?`, ${name}`:""}! Tudo bem?\n\nPara dar andamento à operação da ${op.company}, ${items.length?`precisamos dos seguintes documentos:\n\n${items.join("\n")}\n\nVocê consegue nos encaminhar esses itens?`:"não temos novos documentos a solicitar nesta mensagem. O material recebido segue em conferência pela equipe."}\n\nQualquer dúvida, estamos à disposição.\n${op.owner&&op.owner!=="Não informado"?op.owner+" · ":""}LR Capital`;
}
