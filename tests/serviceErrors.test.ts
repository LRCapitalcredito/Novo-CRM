import {test} from "node:test";
import assert from "node:assert/strict";
import {isQuotaError,messageSaveError,serviceErrorText} from "../src/serviceErrors";

test("quota do Firestore tem explicação específica sem confundir com permissão ou conexão",()=>{
  for(const e of [{code:"resource-exhausted"},{code:"firestore/resource-exhausted"},new Error("Quota exceeded.")]){
    assert.equal(isQuotaError(e),true);
    assert.match(messageSaveError(e),/não foi salva no histórico/);
    assert.match(serviceErrorText(e,"falha"),/limite de uso/);
  }
  for(const e of [null,{code:"permission-denied"},new Error("Sem permissão para alterar."),{code:"unavailable"}])assert.equal(isQuotaError(e),false);
  assert.equal(messageSaveError(new Error("Sem permissão para alterar.")),"Sem permissão para alterar.");
  assert.equal(serviceErrorText(null,"Falha de conexão"),"Falha de conexão");
});
