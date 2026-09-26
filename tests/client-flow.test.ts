import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewStore } from "../server/preview";
import { newOperation, type Operation } from "../src/domain";
import { recordInput, validateRecord, type WorkspaceRecord } from "../src/records";
import { documentChecklist, newDocument, checklistId } from "../src/workflow";
import { activeTracks, casualRequest, demandKey, emailMessageUrl, minimumChecklist, parseManagerDemand, whatsappMessageUrl } from "../src/clientFlow";
import { matchesModality, portfolioIndex } from "../src/portfolio";
const op={...newOperation(),id:"client-flow-test",company:"Empresa fictícia",contact:"JOÃO SILVA",owner:"Equipe teste",product:"Home equity"} as Operation;
const doc=(key:string,patch:Record<string,any>={}):WorkspaceRecord=>({id:`document-${key}`,operationId:op.id,kind:"document",data:{...newDocument(op),...documentChecklist(op.product).find(d=>d.key===key),templateKey:key,...patch},version:1,createdAt:"",updatedAt:""});

test("contatos brasileiros e mensagens especiais geram links sem envio automático",()=>{
 const text="Oi, João! Tudo bem? 😊\nBalanço & DRE de 2025";
 assert.equal(whatsappMessageUrl("(51) 99999-1234",text),"https://wa.me/5551999991234?text="+encodeURIComponent(text));
 assert.equal(whatsappMessageUrl("(XX) XXXXX-XXXX",text),null);
 assert.equal(emailMessageUrl("cliente@example.com","Docs",text),null);
 assert.equal(emailMessageUrl("contato@empresa.teste?bcc=fora@teste.com","Docs",text),null);
 assert.equal(emailMessageUrl("contato@empresa.teste","Docs & confirmação",text),`mailto:contato%40empresa.teste?subject=${encodeURIComponent("Docs & confirmação")}&body=${encodeURIComponent(text)}`);
});
test("documentação mínima não fica completa sem checklist e recebido não significa conferido",()=>{
 assert.equal(minimumChecklist(op,[]).complete,false);assert.equal(minimumChecklist(op,[]).total,9);
 const records=documentChecklist(op.product).map(s=>doc(s.key,{status:"Conferido",sourceUrl:"https://example.org/doc",reviewNotes:"Revisado"}));
 assert.equal(minimumChecklist(op,records).complete,true);
 records[0]=doc("cadastro",{status:"Recebido",sourceUrl:"https://example.org/doc"});assert.equal(minimumChecklist(op,records).done,8);
 records[0]=doc("cadastro",{status:"Dispensado",reviewNotes:"Não aplicável, validado pela instituição"});assert.equal(minimumChecklist(op,records).complete,true);
 records[0]=doc("cadastro",{status:"Conferido",sourceUrl:"https://example.org/doc",expiresOn:"2000-01-01"});assert.equal(minimumChecklist(op,records).complete,false);
});
test("mensagem casual cobra faltantes e correções, preservando os que já estão em conferência",()=>{
 const docs=[doc("cadastro",{status:"Recebido",sourceUrl:"https://example.org/cadastro"}),doc("contabil",{status:"A corrigir",reviewNotes:"Enviar as páginas finais"})];
 const text=casualRequest(op,docs);assert.match(text,/Oi, João!/);assert.match(text,/Enviar as páginas finais/);assert.match(text,/já chegou está em conferência/);assert.ok(!text.includes("• CNPJ"));assert.match(text,/confirmar ou receber/);
 assert.ok(!text.includes("undefined"));
});
test("classificação persiste múltiplas frentes e recusa sobreposição de edição",()=>{
 const store=createPreviewStore(":memory:");try{const created=store.save(op,null);const profile=store.records.save(recordInput("profile",op.id,{address:"",city:"",state:"",segment:"",restriction:"Com restrições",activeTracks:["Captação de crédito","Antecipação de recebíveis"]}),null);
 assert.deepEqual(activeTracks(created,store.state().records!),["Captação de crédito","Antecipação de recebíveis"]);
 const row=portfolioIndex(store.state())[0];assert.equal(matchesModality(row,"Antecipação de recebíveis"),true);assert.equal(matchesModality(row,"Home equity"),false);
 assert.equal(minimumChecklist(created,store.state().records!).total,9);
 const updated=store.records.save({...profile,data:{...profile.data,restriction:"Sem restrições"}},profile.version);assert.throws(()=>store.records.save(profile,profile.version),/CONFLICT/);
 assert.equal(store.records.get(updated.id)?.data.restriction,"Sem restrições");
 assert.throws(()=>validateRecord({...updated,data:{...updated.data,activeTracks:["Inválido"]}}),/frentes/);
 }finally{store.close();}
});
test("pedido do gerente sugere itens distintos, mantém meses e separa texto não reconhecido",async()=>{
 const items=parseManagerDemand("Bom dia!\nEnviar balanço e DRE de 2025, balancete de agosto de 2026; matrícula atualizada");
 assert.equal(items.filter(x=>x.selected).length,4);assert.equal(items.find(x=>x.title==="Balancete")?.period,"agosto de 2026");assert.equal(items.find(x=>x.title==="Balanço patrimonial")?.period,"2025");assert.equal(items[0].selected,false);
 assert.equal(await checklistId(op.id,demandKey("banco-a","DRE","2025")),await checklistId(op.id,demandKey("banco-a","dre","2025")));
 assert.notEqual(await checklistId(op.id,demandKey("banco-a","DRE","2025")),await checklistId(op.id,demandKey("banco-b","DRE","2025")));
});
