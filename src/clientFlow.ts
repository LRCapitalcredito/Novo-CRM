import { today, type Operation } from "./domain";
import { whatsappUrl } from "./directory";
import { documentChecklist, expiredDocument, newDocument, pendingDocument, readyDocument } from "./workflow";
import type { WorkspaceRecord } from "./records";
import {legacyMinimumChecklist,legacyTemplateKey} from "./legacyChecklist";

export const clientTracks = ["Captação de crédito", "Antecipação de recebíveis", "Home equity", "Outras possibilidades"] as const;
export const restrictionOptions = ["A verificar", "Sem restrições", "Com restrições"] as const;
export const cleanSearch = (s:string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function trackForProduct(product:string) {
  if (["Capital de giro","Financiamento","Crédito estruturado","Crédito rural"].includes(product)) return "Captação de crédito";
  if (["Antecipação de recebíveis","Home equity"].includes(product)) return product;
  return product && product!=="Não informado" ? "Outras possibilidades" : "";
}
export function activeTracks(op:Operation, records:WorkspaceRecord[]) {
  const profile=records.find(r=>r.kind==="profile"&&r.operationId===op.id);
  if(Array.isArray(profile?.data.activeTracks)) return profile.data.activeTracks as string[];
  return [...new Set([op.product,...records.filter(r=>r.kind==="placement"&&r.operationId===op.id&&r.data.active).map(r=>r.data.deal?.modality)].map(trackForProduct).filter(Boolean))];
}
export function minimumChecklist(op:Operation, records:WorkspaceRecord[]) {
  const tracks=activeTracks(op,records), products=tracks.length?tracks:[op.product];
  const documents=records.filter(r=>r.operationId===op.id&&r.kind==="document"&&!r.data.archived);
  const legacy=documents.some(r=>r.data.legacyDocumentId);
  const suggestions=[...new Map(products.flatMap(p=>legacy?[...legacyMinimumChecklist(),...documentChecklist(p).slice(6)]:documentChecklist(p)).map(s=>[s.key,s])).values()];
  const items=suggestions.map(s=>{
    const linked=documents.filter(d=>d.data.templateKey===s.key||(legacy&&d.data.legacyDocumentId&&s.key===`legacy-${legacyTemplateKey(d.data.legacyTemplateId||"")}`));
    const complete=linked.some(d=>readyDocument(d)||d.data.status==="Dispensado"&&d.data.reviewNotes?.trim());
    return {...s,linked,complete};
  });
  return {items,complete:items.every(i=>i.complete),done:items.filter(i=>i.complete).length,total:items.length,untracked:items.filter(i=>!i.linked.length)};
}
export function requestableDocuments(op:Operation,records:WorkspaceRecord[]) {
  const actual=records.filter(r=>r.operationId===op.id&&pendingDocument(r)&&(!["Recebido","Em conferência"].includes(r.data.status)||expiredDocument(r)));
  const missing=minimumChecklist(op,records).untracked.map(s=>({id:`missing-${s.key}`,kind:"document",operationId:op.id,version:0,createdAt:"",updatedAt:"",data:{...newDocument(op),title:s.title,period:s.period,category:s.category,templateKey:s.key,requirement:s.requirement}} as WorkspaceRecord));
  return [...actual,...missing];
}
export function casualRequest(op:Operation,records:WorkspaceRecord[]) {
  const name=op.contact.trim().split(/\s+/)[0];
  const greet=name?name.charAt(0).toLocaleUpperCase("pt-BR")+name.slice(1).toLocaleLowerCase("pt-BR"):"";
  const docs=requestableDocuments(op,records), coverage=minimumChecklist(op,records);
  const lines=[...new Set(docs.map(d=>`• ${d.data.title}${d.data.period?` (${d.data.period})`:""}${expiredDocument(d)?" — precisamos de uma versão atualizada":d.data.status==="A corrigir"?` — ${d.data.reviewNotes}`:""}${d.data.dueDate?` — combinado para ${d.data.dueDate.split("-").reverse().join("/")}`:""}`))];
  const awaiting=records.some(r=>r.operationId===op.id&&r.kind==="document"&&!r.data.archived&&["Recebido","Em conferência"].includes(r.data.status));
  return `Oi${greet?`, ${greet}`:""}! Tudo bem? 😊\n\nPassando pra dar andamento na operação da ${op.company}.\n\n${lines.length?`${coverage.untracked.length?"Ainda precisamos confirmar ou receber estes documentos por aqui":"No nosso acompanhamento, ainda faltam estes itens"}:\n${lines.join("\n")}\n\nConsegue me ajudar com eles? Se já mandou algum, me avisa por onde que eu confiro.`:awaiting?"Recebemos os documentos e a equipe está conferindo. Se aparecer alguma pendência, te aviso por aqui.":"Não há documentos pendentes de envio no checklist registrado. Vamos acompanhando os próximos passos com você."}\n\n${awaiting&&lines.length?"O que já chegou está em conferência com a equipe.\n\n":""}Qualquer dúvida, me chama. Vamos falando!\n${op.owner&&op.owner!=="Não informado"?op.owner+" · ":""}LR Capital`;
}
export function whatsappMessageUrl(phone:string,text:string) { const base=whatsappUrl(phone);return base?`${base}?text=${encodeURIComponent(text)}`:null; }
export function emailMessageUrl(email:string,subject:string,body:string) {
  const value=email.trim();
  if(!/^[^\s@?&#\r\n]+@[^\s@?&#\r\n]+\.[^\s@?&#\r\n]+$/.test(value)||/@(example\.com|exemplo\.com|banco\.com)$/i.test(value))return null;
  return `mailto:${encodeURIComponent(value)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
export interface DemandSuggestion { title:string;category:string;period:string;selected:boolean }
export function parseManagerDemand(text:string):DemandSuggestion[] {
  const chunks=text.split(/\n|;|,|\.(?=\s+[A-ZÀ-Ý])/).map(s=>s.replace(/^\s*[-•\d.)]+\s*/,"").trim()).filter(Boolean);
  const patterns:[RegExp,string,string][]=[[/\bbalan[cç]o\b/i,"Balanço patrimonial","Contábil"],[/\bdre\b|demonstr[aã][cç][aã]o.*resultado/i,"DRE","Contábil"],[/balancete/i,"Balancete","Contábil"],[/faturamento/i,"Faturamento mensal","Faturamento"],[/endividamento|rela[cç][aã]o.*d[ií]vidas/i,"Mapa de endividamento","Endividamento"],[/contrato social/i,"Contrato social consolidado","Cadastro"],[/matr[ií]cula/i,"Matrícula do imóvel","Garantias"],[/laudo|avalia[cç][aã]o.*im[oó]vel/i,"Laudo de avaliação do imóvel","Garantias"],[/receb[ií]veis/i,"Carteira de recebíveis","Recebíveis"],[/nota fiscal|notas fiscais/i,"Notas fiscais","Recebíveis"],[/comprovante.*entrega/i,"Comprovantes de entrega","Recebíveis"],[/certid[aã]o|certid[oõ]es/i,"Certidões solicitadas","Fiscal"],[/extrato/i,"Extratos solicitados","Outros"],[/irpf|imposto de renda/i,"Declaração de imposto de renda","Sócios"]];
  const found:DemandSuggestion[]=[];
  for(const chunk of chunks){const hits=patterns.filter(([p])=>p.test(chunk));const period=[...new Set(chunk.match(/\b(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(?:19|20)\d{2}\b|\b(?:19|20)\d{2}\b/gi)??[])].join(" e ");for(const [,title,category]of hits)found.push({title,category,period,selected:true});if(!hits.length)found.push({title:chunk.slice(0,200),category:"Outros",period,selected:false});}
  return [...new Map(found.map(r=>[cleanSearch(r.title+"|"+r.period),r])).values()].slice(0,30);
}
export const demandKey = (placementId:string,title:string,period:string) => `${placementId}|${cleanSearch(title)}|${cleanSearch(period)}`;
export function validateClientProfile(data:Record<string,any>) {
  if(data.restriction!==undefined&&!restrictionOptions.includes(data.restriction))throw Error("Selecione a situação de restrição.");
  if(data.activeTracks!==undefined&&(!Array.isArray(data.activeTracks)||data.activeTracks.length>4||new Set(data.activeTracks).size!==data.activeTracks.length||data.activeTracks.some((t:string)=>!(clientTracks as readonly string[]).includes(t))))throw Error("Selecione frentes de atuação válidas.");
}
