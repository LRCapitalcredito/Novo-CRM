import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newOperation,type Operation} from '../src/domain';
import {newDocument,readyDocument} from '../src/workflow';
import {validateRecord,type WorkspaceRecord} from '../src/records';
import {communicationChecklist,receivedDocument,reviewedRequest,checklistFingerprint} from '../src/documentReview';
import {requestableDocuments} from '../src/clientFlow';
import {invitationInput} from '../src/team';
const op={...newOperation(),id:'review-client-test',company:'Empresa teste',contact:'Ana',owner:'Equipe',version:1,createdAt:'',updatedAt:''} as Operation;
const row:WorkspaceRecord={id:'review-document-test',kind:'document',operationId:op.id,version:1,createdAt:'',updatedAt:'',data:{...newDocument(op),title:'Documento específico',templateKey:'cadastro'}};
test('recebimento informado sai da cobrança, preserva arquivos e continua sem conferência',()=>{
 const data=receivedDocument(row,'Anexo do e-mail recebido hoje','Equipe');const next={...row,data,version:2};
 validateRecord(next);assert.equal(readyDocument(next),false);assert.ok(!requestableDocuments(op,[next]).some(r=>r.id===row.id));
 assert.deepEqual(data.files,row.data.files);assert.throws(()=>validateRecord({...next,data:{...data,status:'Conferido',reviewNotes:'Sem evidência'}}));
 assert.throws(()=>receivedDocument(row,'','Equipe'));
 assert.throws(()=>receivedDocument({...row,data:{...row.data,expiresOn:'2000-01-01'}},'Nova pasta','Equipe'));
});
test('mensagem inclui apenas a seleção, sem alterar a pendência omitida',()=>{
 const items=communicationChecklist(op,[row]);assert.ok(items.some(r=>r.id===row.id));
 const text=reviewedRequest(op,[row],new Set([row.id]));assert.match(text,/Documento específico/);assert.ok(!text.includes('Balanço'));
 assert.equal(row.data.status,'A solicitar');assert.ok(!reviewedRequest(op,[row],new Set()).includes('•'));
});
test('revisão detecta mudança de versão e contato sem depender da ordem',()=>{
 const other={...row,id:'another-doc-test'};assert.equal(checklistFingerprint(op,[row,other]),checklistFingerprint(op,[other,row]));
 assert.notEqual(checklistFingerprint(op,[row]),checklistFingerprint(op,[{...row,version:2}]));
 assert.notEqual(checklistFingerprint(op,[row]),checklistFingerprint({...op,phone:'51999999999'},[row]));
});
test('convites normalizam email e não permitem elevação de privilégio',()=>{
 assert.equal(invitationInput(' TESTE@gmail.com ','Pessoa','editor').email,'teste@gmail.com');
 assert.throws(()=>invitationInput('teste/usuario@gmail.com','Pessoa','editor'));
 assert.throws(()=>invitationInput('teste@gmail.com','Pessoa','admin' as any));
});

test('documentos importados não são recobrados e períodos ausentes permanecem pendentes',()=>{
 const received={...row,data:{...newDocument(op),title:'Balanço 2025.pdf',status:'Recebido',sourceUrl:'https://example.org/file',legacyDocumentId:'source-id',legacyTemplateId:'balanco_2025'}};
 const pending=requestableDocuments(op,[received]);assert.ok(!pending.some(r=>r.data.title==='Balanço 2025'));
 assert.ok(pending.some(r=>r.data.title==='Balanço 2024'));
 assert.ok(pending.some(r=>r.data.title==='DRE 2025'));
 assert.equal(readyDocument(received),false);
});
