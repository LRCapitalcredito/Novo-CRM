import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createPreviewStore } from "../server/preview";
import { inspectDocumentFile, maxDocumentBytes } from "../server/documentFiles";
import { newOperation, today, type Operation } from "../src/domain";
import { recordInput, validateRecord, type WorkspaceRecord } from "../src/records";
import { checklistId, documentChecklist, newDocument, newTask, followUps, readyDocument, clientUpdateDraft, requestDraft } from "../src/workflow";
import { portfolioIndex } from "../src/portfolio";
const pdf = Buffer.from("%PDF-1.4\nDocumento fictício para teste de preservação\n%%EOF");
const seed = (store: ReturnType<typeof createPreviewStore>) => store.save({ ...newOperation(), id:"workflow-client", company:"Cliente de teste", owner:"Equipe" }, null);
const placement = (store: ReturnType<typeof createPreviewStore>, op: Operation, id="workflow-placement") => store.records.save(recordInput("placement",op.id,{ bankId:"",institution:"Instituição fictícia",managerId:"",manager:"Gerente fictício",status:"Em análise",product:"",requestedCents:null,approvedCents:null,notes:"",nextAction:"Consultar andamento",dueDate:"",active:true },id),null);
const document = (store:ReturnType<typeof createPreviewStore>,op:Operation,id="workflow-document") => store.records.save(recordInput("document",op.id,{...newDocument(op),title:"Balanço",period:"2025"},id),null);
const ready = (store:ReturnType<typeof createPreviewStore>,doc:WorkspaceRecord) => { const uploaded=store.records.attach(doc.id,doc.version,"Balanço.pdf",pdf);return store.records.save({...uploaded,data:{...uploaded.data,status:"Conferido",reviewNotes:"Entidade e período conferidos; assinatura ainda não verificada."}},uploaded.version); };
const dispatch = (op:Operation,p:WorkspaceRecord,d:WorkspaceRecord) => recordInput("dispatch",op.id,{placementId:p.id,recipient:"Gerente fictício",channel:"E-mail",sentOn:today(),followUpOn:today(),status:"Aguardando retorno",owner:"Equipe",nextAction:"Confirmar recebimento",notes:"",items:[{documentId:d.id,version:d.version,title:d.data.title,fileId:d.data.files.at(-1)?.id??"",sourceUrl:d.data.sourceUrl}]},"workflow-dispatch");

test("checklists usam exercícios distintos e IDs estáveis por cliente", async()=>{
  const c=documentChecklist("Home equity",2026);assert.equal(c.length,9);assert.equal(c.find(d=>d.key==="contabil")?.period,"2024 e 2025");
  assert.ok(documentChecklist("Antecipação de recebíveis",2026).some(d=>d.key==="cessoes"));
  assert.equal(await checklistId("cliente-a","cadastro"),await checklistId("cliente-a","cadastro"));
  assert.notEqual(await checklistId("cliente-a","cadastro"),await checklistId("cliente-b","cadastro"));
});
test("recebimento não autoriza conferência sem arquivo, evidência ou validade",()=>{
  const op={...newOperation(),company:"Teste",owner:"Equipe"} as Operation, d={...newDocument(op),title:"Documento"};
  assert.throws(()=>validateRecord(recordInput("document",op.id,{...d,status:"Conferido",reviewNotes:"Conferido"})),/Anexe/);
  assert.throws(()=>validateRecord(recordInput("document",op.id,{...d,status:"Conferido",sourceUrl:"https://example.org/doc"})),/resultado/);
  assert.throws(()=>validateRecord(recordInput("document",op.id,{...d,status:"Conferido",sourceUrl:"https://example.org/doc",reviewNotes:"Conferido",expiresOn:"2000-01-01"})),/vencido/);
  assert.throws(()=>validateRecord(recordInput("document",op.id,{...d,sourceUrl:"javascript:alert(1)"})),/HTTPS/);
  assert.throws(()=>validateRecord(recordInput("document",op.id,{...d,status:"Dispensado"})),/justificativa/);
});
test("anexos preservam bytes e versões ao reabrir; nova versão exige nova conferência",()=>{
  const dir=mkdtempSync(join(tmpdir(),"lr-documents-")), file=join(dir,"files.sqlite");let store=createPreviewStore(file);
  try { const op=seed(store),d=ready(store,document(store,op)),first=d.data.files[0];assert.equal(readyDocument(d),true);
    const next=store.records.attach(d.id,d.version,"Balanço revisado.pdf",Buffer.concat([pdf,Buffer.from("\nrevisão")]));assert.equal(next.data.status,"Recebido");assert.equal(next.data.signatureCheck,"Não verificada");assert.equal(next.data.reviewNotes,"");assert.equal(next.data.files.length,2);
    store.close();store=createPreviewStore(file);assert.deepEqual(Buffer.from(store.records.file(first.id)!.bytes),pdf);assert.equal(first.sha256,createHash("sha256").update(pdf).digest("hex"));assert.equal(store.records.get(d.id)?.data.files.length,2);assert.equal(readyDocument(store.records.get(d.id)!),false);
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});
test("arquivos não podem ser forjados, removidos, duplicados nem sobrescritos por edição antiga",()=>{
  const store=createPreviewStore(":memory:");try{const op=seed(store),d=document(store,op),uploaded=store.records.attach(d.id,d.version,"Arquivo.pdf",pdf);
    assert.throws(()=>store.records.attach(d.id,d.version,"Outro.pdf",Buffer.concat([pdf,Buffer.from("novo")])),/CONFLICT/);
    assert.throws(()=>store.records.attach(d.id,uploaded.version,"Duplicado.pdf",pdf),/mesmo arquivo/);
    assert.throws(()=>store.records.save({...uploaded,data:{...uploaded.data,files:[],status:"A solicitar"}},uploaded.version),/preservados/);
    assert.throws(()=>store.records.save(recordInput("document",op.id,{...uploaded.data},"doc-forjado"),null),/preservados/);
    assert.equal(store.records.get(d.id)?.data.files.length,1);
  }finally{store.close();}
});
test("anexos recusam extensão incompatível, caminho e tamanho excedido",()=>{
  assert.throws(()=>inspectDocumentFile("../arquivo.pdf",pdf),/Nome/);
  assert.throws(()=>inspectDocumentFile("arquivo.html",pdf),/Envie/);
  assert.throws(()=>inspectDocumentFile("arquivo.pdf",Buffer.from("<html>")),/Envie/);
  assert.throws(()=>inspectDocumentFile("arquivo.pdf",Buffer.alloc(maxDocumentBytes+1)),/10 MB/);
  assert.throws(()=>inspectDocumentFile("arquivo.pdf",Buffer.alloc(0)),/1 byte/);
});
test("envio vincula instituição e versão exata; histórico do pacote não pode ser reescrito",()=>{
  const store=createPreviewStore(":memory:");try{const op=seed(store),p=placement(store,op),d=ready(store,document(store,op));
    const sent=store.records.save(dispatch(op,p,d),null);assert.equal(sent.data.items[0].fileId,d.data.files[0].id);
    assert.throws(()=>store.records.save({...sent,data:{...sent.data,recipient:"Outra pessoa"}},sent.version),/preservado/);
    const changed=store.records.save({...d,data:{...d.data,period:"2024"}},d.version);
    assert.throws(()=>store.records.save({...dispatch(op,p,d),id:"old-version-send"},null),/mudou/);
    assert.throws(()=>store.records.save({...sent,data:{...sent.data,items:[{...sent.data.items[0],version:changed.version}]}},sent.version),/preservado/);
    const closed=store.records.save({...sent,data:{...sent.data,status:"Concluído",notes:"Retorno recebido e comunicado."}},sent.version);assert.equal(closed.data.status,"Concluído");
    const history=store.state().recordEvents!.filter(e=>e.recordId===sent.id);assert.equal(history.length,2);assert.equal(JSON.parse(history.find(e=>e.version===1)!.contentJson!).status,"Aguardando retorno");assert.equal(JSON.parse(history.find(e=>e.version===2)!.contentJson!).notes,"Retorno recebido e comunicado.");
  }finally{store.close();}
});
test("vínculos e documentos de outro cliente ou de outra instituição são recusados",()=>{
  const store=createPreviewStore(":memory:");try{const op=seed(store),p=placement(store,op),other=store.save({...newOperation(),company:"Outro cliente teste",owner:"Equipe"},null),p2=placement(store,other,"other-placement"),d=ready(store,document(store,op));
    assert.throws(()=>store.records.save(recordInput("task",op.id,{...newTask(op),title:"Cobrar",placementId:p2.id},"task-cross-client"),null),/vinculada/);
    assert.throws(()=>store.records.save({...dispatch(op,p,d),operationId:other.id,data:{...dispatch(op,p,d).data,placementId:p2.id}},null),/outra instituição/);
    const p3=placement(store,op,"third-placement"),restricted=store.records.save({...d,data:{...d.data,placementId:p3.id}},d.version);
    assert.throws(()=>store.records.save(dispatch(op,p,restricted),null),/outra instituição/);
  }finally{store.close();}
});
test("agenda reúne prazos e descarta concluídos, dispensados e datas inválidas",()=>{
  const store=createPreviewStore(":memory:");try{const op=seed(store),p=placement(store,op),d=ready(store,document(store,op));
    store.records.save({...p,data:{...p.data,dueDate:"2026-09-20"}},p.version);
    const task=store.records.save(recordInput("task",op.id,{...newTask(op),title:"Comunicar ao cliente",dueDate:"2026-09-22"},"workflow-task"),null);
    const doc=store.records.save({...d,data:{...d.data,expiresOn:"2099-01-01"}},d.version);
    const records=store.state().records!.map(r=>r.id===doc.id?{...r,data:{...r.data,expiresOn:"2026-09-21"}}:r);
    const state={...store.state(),records};
    assert.equal(followUps(state,"2026-09-26").length,4);assert.ok(followUps(state,"2026-09-26").some(r=>r.id===op.id&&!r.dueDate));assert.equal(portfolioIndex(state,"2026-09-26")[0].nextDue,"2026-09-20");
    store.records.save({...task,data:{...task.data,status:"Concluída",completedOn:today(),notes:"Cliente informado."}},task.version);
    assert.equal(followUps(store.state()).some(r=>r.id===task.id),false);
  }finally{store.close();}
});
test("rascunhos são baseados nos registros sem expor notas internas no retorno ao cliente",()=>{
  const store=createPreviewStore(":memory:");try{const op=seed(store),d=document(store,op);store.records.save(recordInput("task",op.id,{...newTask(op),title:"Alinhar próxima etapa",notes:"INFORMAÇÃO INTERNA"},"workflow-task"),null);
    assert.match(requestDraft(op,[d]),/Balanço/);const update=clientUpdateDraft(op,store.state().records!);assert.match(update,/Alinhar próxima etapa/);assert.ok(!update.includes("INFORMAÇÃO INTERNA"));assert.match(update,/dependem da análise/);
  }finally{store.close();}
});
