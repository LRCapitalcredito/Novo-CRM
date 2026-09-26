import type { RecordInput } from "./records";

export const messageStatuses = {draft:"Rascunho", sent_manual:"Envio informado pela equipe", received_manual:"Resposta registrada pela equipe"} as const;
export type MessageStatus = keyof typeof messageStatuses;
export type MessageChannel = "WhatsApp" | "E-mail";
export function validateMessage(input: RecordInput) {
  if(input.kind !== "message") return;
  const d=input.data;
  for(const [key,max,required] of [["body",16000,true],["recipient",180,false],["recipientName",200,true],["subject",180,false],["placementId",100,false],["recordedBy",200,true]] as const) {
    if(typeof d[key] !== "string" || d[key].length>max || (required&&!d[key].trim())) throw Error("Preencha corretamente a mensagem: "+key+".");
  }
  if(!["WhatsApp","E-mail"].includes(d.channel)||!Object.hasOwn(messageStatuses,d.status)||d.source!=="manual") throw Error("Origem ou situação da mensagem inválida.");
  const date=Date.parse(d.occurredAt);
  if(typeof d.occurredAt!=="string"||!Number.isFinite(date)||date>Date.now()+60000) throw Error("Informe uma data válida, sem horário futuro.");
  if(d.status==="sent_manual" && d.sendConfirmed!==true) throw Error("Confirme que realizou o envio no aplicativo.");
  if(d.status!=="sent_manual" && d.sendConfirmed!==false) throw Error("Um rascunho ou recebimento não confirma um envio.");
  if(d.placementId&&!/^[-\w]{6,100}$/.test(d.placementId)) throw Error("Instituição da conversa inválida.");
}

export function localDateTime(date = new Date()): string {
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
