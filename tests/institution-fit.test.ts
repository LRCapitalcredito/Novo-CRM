import {test} from "node:test";
import assert from "node:assert/strict";
import {newBank,newManager,validateDirectory,type Bank,type Manager} from "../src/directory";
import {newOperation,type Operation} from "../src/domain";
import {institutionFit,distanceContext} from "../src/institutionFit";
import {recordInput,validateRecord} from "../src/records";
import {driveFolderUrl,managerFolderDraft} from "../src/clientDrive";
import {whatsappMessageUrl} from "../src/clientFlow";
import {createPreviewStore} from "../server/preview";
const warranty={rate:"",termMonths:null,ltvPercent:null};
const bank={...newBank(),version:1,createdAt:"2026-09-26T00:00:00Z",updatedAt:"2026-09-26T00:00:00Z",id:"fit-bank",name:"Banco fictício",guarantees:{"Imóvel Urbano":warranty},acceptsRestriction:false} as Bank;
const manager={...newManager(bank.id),id:"fit-manager",name:"Gerente Teste",phone:"(51) 99999-0000",minRevenueCents:10000000,maxRevenueCents:50000000,serviceScope:"states",servedStates:["RS"]} as Manager;
const op={...newOperation(),id:"fit-client",company:"Cliente fictício",owner:"Equipe",revenueCents:20000000} as Operation;
const profile={address:"",city:"Porto Alegre",state:"RS",segment:"Indústria",restriction:"Sem restrições",offeredGuarantees:["Imóvel Urbano"],guaranteeConfirmation:"Confirmado pelo contato em 26/09/2026"};
const placement=recordInput("placement",op.id,{bankId:bank.id,institution:bank.name,managerId:manager.id,manager:manager.name,status:"Em preparação",product:"",requestedCents:null,approvedCents:null,notes:"Preservar nota",nextAction:"Conferir documentos",dueDate:"",active:true},"fit-placement");
test("garantias incompatíveis bloqueiam; atualização factual permite novo vínculo",()=>{
 const store=createPreviewStore(":memory:");try{store.save(op,null);store.directory.save(bank,null);store.directory.save(manager,null);
 const p=store.records.save(recordInput("profile",op.id,{...profile,offeredGuarantees:["Recebíveis"]}),null);
 assert.throws(()=>store.records.save(placement,null),/Vínculo bloqueado.*Recebíveis/);
 assert.equal(store.records.get(placement.id),null);
 store.records.save({...p,data:profile},p.version);
 const saved=store.records.save(placement,null);assert.equal(saved.version,1);
 assert.equal(institutionFit(op,profile,bank,manager).status,"compatible");
 }finally{store.close();}
});
test("política atual é relida ao salvar e vínculo antigo mantém histórico e encerramento",()=>{
 const store=createPreviewStore(":memory:");try{store.save(op,null);const b=store.directory.save(bank,null);store.directory.save(manager,null);store.records.save(recordInput("profile",op.id,profile),null);
 const first=store.records.save(placement,null);store.directory.save({...b,guarantees:{Recebíveis:warranty}},b.version);
 assert.throws(()=>store.records.save({...placement,id:"fit-second"},null),/Vínculo bloqueado/);
 const closed=store.records.save({...first,data:{...first.data,status:"Parado",active:false}},first.version);assert.equal(closed.data.notes,"Preservar nota");
 assert.throws(()=>store.records.save({...closed,data:{...closed.data,active:true}},closed.version),/Vínculo bloqueado/);
 assert.throws(()=>store.records.save({...first,data:{...first.data,status:"Aprovado"}},first.version),/CONFLICT/);
 assert.equal(store.state().recordEvents?.filter(e=>e.recordId===first.id).length,2);
 }finally{store.close();}
});
test("cadastro incompleto e garantia importada não viram aderência confirmada",()=>{
 const legacy={...profile,offeredGuarantees:undefined,guarantees:[{TIPO_GARANTIA:"Imóvel Urbano",DISPONIVEL_PARA_OPERACAO:null}]};
 assert.equal(institutionFit(op,legacy,bank,manager).status,"pending");
 assert.equal(institutionFit(op,{},bank).status,"pending");
 assert.equal(institutionFit(op,profile,{...bank,guarantees:{Universal:warranty}},manager).status,"pending");
 assert.equal(institutionFit(op,{...profile,offeredGuarantees:[]},bank,manager).status,"conflict");
 assert.equal(institutionFit(op,{...profile,offeredGuarantees:["Imóvel Rural"]},bank,manager).status,"conflict");
 assert.equal(institutionFit(op,{...profile,offeredGuarantees:["Imóvel Rural"]},{...bank,guarantees:{"Imóveis (Geral)":warranty}},manager).status,"compatible");
 assert.equal(institutionFit(op,{...profile,offeredGuarantees:["Imóveis (Geral)"]},bank,manager).status,"pending");
});
test("target anual é inclusivo e zero permanece zero; restrições têm regra explícita",()=>{
 for(const revenueCents of [manager.minRevenueCents,manager.maxRevenueCents])assert.equal(institutionFit({...op,revenueCents},profile,bank,manager).status,"compatible");
 for(const revenueCents of [0,9999999,50000001])assert.ok(institutionFit({...op,revenueCents},profile,bank,manager).conflicts.some(i=>i.key==="revenue"));
 assert.ok(institutionFit({...op,revenueCents:null},profile,bank,manager).pending.some(i=>i.key==="revenue"));
 assert.ok(institutionFit(op,{...profile,restriction:"Com restrições"},bank,manager).conflicts.some(i=>i.key==="restriction"));
 assert.equal(institutionFit(op,{...profile,restriction:"Com restrições"},{...bank,acceptsRestriction:true},manager).status,"compatible");
});
test("atendimento por estado, cidade, raio e segmento não confunde ausência com aceitação",()=>{
 assert.equal(institutionFit(op,{...profile,state:"SC"},bank,manager).status,"conflict");
 assert.equal(institutionFit(op,{...profile,state:"SC"},bank,{...manager,serviceScope:"national"}).status,"compatible");
 const city={...manager,serviceScope:"city",city:"PORTO ALEGRE",state:"RS"} as Manager;
 assert.equal(institutionFit(op,profile,bank,city).status,"compatible");
 assert.equal(institutionFit(op,{...profile,city:"Canoas"},bank,city).status,"conflict");
 const radius={...city,serviceScope:"radius",radiusKm:50} as Manager, p={...profile,city:"Canoas"};
 const distance={distanceKm:51,distanceSource:"Mapa consultado em 26/09/2026",distanceContext:distanceContext(p,radius)};
 assert.equal(institutionFit(op,p,bank,radius).status,"pending");assert.equal(institutionFit(op,p,bank,radius,distance).status,"conflict");
 assert.equal(institutionFit(op,p,bank,radius,{...distance,distanceKm:50}).status,"compatible");
 assert.equal(institutionFit(op,{...p,city:"Outra cidade"},bank,radius,distance).status,"pending");
 assert.equal(institutionFit(op,profile,bank,{...manager,targetSegments:["INDUSTRIA"]}).status,"compatible");
 assert.equal(institutionFit(op,profile,bank,{...manager,targetSegments:["Serviços"]}).status,"conflict");
});
test("perfil valida garantia confirmada e endereço de pasta; gerente valida segmentos",()=>{
 assert.throws(()=>validateRecord(recordInput("profile",op.id,{...profile,guaranteeConfirmation:""})),/quem confirmou/);
 assert.throws(()=>validateRecord(recordInput("profile",op.id,{...profile,offeredGuarantees:["Universal"]})),/Garantias/);
 assert.throws(()=>validateDirectory({...manager,targetSegments:[2]}),/Segmentos/);
 assert.throws(()=>validateRecord({...placement,data:{...placement.data,distanceKm:-1}}),/Distância/);
});
test("pasta aceita somente Google Drive e preserva resourcekey sem aceitar arquivos ou redirecionamento",()=>{
 const url="https://drive.google.com/drive/folders/folder-ficticio-123";
 assert.equal(driveFolderUrl(url+"?usp=sharing"),url);
 assert.equal(driveFolderUrl(url+"?resourcekey=0-key-abc&usp=sharing"),url+"?resourcekey=0-key-abc");
 for(const value of ["javascript:alert(1)","https://drive.google.com.evil.com/drive/folders/folder-ficticio-123","https://user@drive.google.com/drive/folders/folder-ficticio-123","https://drive.google.com/file/d/arquivo-ficticio/view","http://drive.google.com/drive/folders/folder-ficticio-123"])assert.equal(driveFolderUrl(value),null);
 const data={...profile,driveFolderUrl:url,driveFolderName:"Teste"};assert.doesNotThrow(()=>validateRecord(recordInput("profile",op.id,data)));
 assert.throws(()=>validateRecord(recordInput("profile",op.id,{...data,driveFolderUrl:"https://example.com"})),/pasta do Google/);
});
test("WhatsApp do gerente usa cliente e pasta sem expor observações internas ou registrar envio",()=>{
 const folder="https://drive.google.com/drive/folders/folder-ficticio-123", draft=managerFolderDraft({...op,notes:"SEGREDO INTERNO"},manager,folder);
 assert.match(draft,/Oi, Gerente/);assert.ok(draft.includes(op.company));assert.ok(draft.includes(folder));assert.ok(!draft.includes("SEGREDO"));
 const url=new URL(whatsappMessageUrl(manager.phone,draft)!);assert.equal(url.searchParams.get("text"),draft);assert.equal(url.pathname,"/5551999990000");
 assert.throws(()=>managerFolderDraft(op,manager,""),/Vincule/);
});
