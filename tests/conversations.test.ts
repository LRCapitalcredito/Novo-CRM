import {test} from "node:test";
import assert from "node:assert/strict";
import {createPreviewStore} from "../server/preview";
import {newOperation,parseMoney} from "../src/domain";
import {recordInput,validateRecord} from "../src/records";
import {celular,reaisInput,formatReaisInput} from "../src/brFormats";

const data={channel:"WhatsApp",recipient:"51999990000",recipientName:"Contato fictício",placementId:"",body:"Mensagem fictícia",subject:"",source:"manual",status:"draft",sendConfirmed:false,occurredAt:new Date().toISOString(),recordedBy:"Equipe teste"};
test("formatação de reais conserva magnitude, centavos, zero e ausência",()=>{
  for(const cents of [null,0,3000000000,500000000000,12345,1e15])assert.equal(parseMoney(reaisInput(cents)),cents);
  assert.equal(formatReaisInput("30000000").replace(/\u00a0/g," "),"R$ 30.000.000,00");
  assert.equal(formatReaisInput("valor inválido"),"valor inválido");
  assert.equal(celular("51998174811"),"(51) 9.9817-4811");
  assert.equal(celular("+55 51 99817-4811"),"(51) 9.9817-4811");
  assert.equal(celular("5199537964"),"(51) 9953-7964");
  assert.equal(celular("519996247984"),"519996247984");
});
test("mensagem manual não simula entrega, leitura, envio automático ou horário futuro",()=>{
  for(const status of ["delivered","read","sent","unknown"])assert.throws(()=>validateRecord(recordInput("message","client-test",{...data,status})),/situação/);
  assert.throws(()=>validateRecord(recordInput("message","client-test",{...data,status:"sent_manual"})),/Confirme/);
  assert.throws(()=>validateRecord(recordInput("message","client-test",{...data,source:"meta"})),/Origem/);
  assert.throws(()=>validateRecord(recordInput("message","client-test",{...data,occurredAt:"2099-01-01T00:00:00.000Z"})),/data/);
  assert.throws(()=>validateRecord(recordInput("message","client-test",{...data,body:" "})),/body/);
});
test("histórico conserva rascunho e registro de envio como entradas distintas e imutáveis",()=>{
  const store=createPreviewStore(":memory:");try{
    const op=store.save({...newOperation(),id:"client-test",company:"Cliente teste",owner:"Equipe teste"},null);
    const draft=store.records.save(recordInput("message",op.id,data,"message-draft"),null);
    const sent=store.records.save(recordInput("message",op.id,{...data,status:"sent_manual",sendConfirmed:true},"message-sent"),null);
    assert.equal(draft.data.status,"draft");assert.equal(sent.data.status,"sent_manual");
    assert.equal(store.state().records?.filter(r=>r.kind==="message").length,2);
    assert.throws(()=>store.records.save({...draft,data:{...data,body:"Adulterado"}},draft.version),/preservado/);
    assert.throws(()=>store.records.save(recordInput("message",op.id,{...data,placementId:"missing-placement"},"message-invalid"),null),/vinculada/);
    assert.equal(store.records.get(draft.id)?.data.body,data.body);
  }finally{store.close();}
});
