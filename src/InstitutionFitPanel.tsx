import { useState } from "react";
import { Drawer, DirectoryEditor } from "./DirectoryPages";
import { money, parseMoney, type Operation, type WorkspaceState } from "./domain";
import { statesBR, type Bank, type Manager, type DirectoryRecord } from "./directory";
import { findRecord, recordInput } from "./records";
import type { Repository } from "./repository";
import { clientWarrantyKinds, distanceContext, institutionFit, offeredGuarantees } from "./institutionFit";
import { restrictionOptions } from "./clientFlow";
import { BankLogo } from "./BankLogo";
type Props = {op: Operation; state: WorkspaceState; repo: Repository; canEdit: boolean; notify: (s:string) => void};
export function InstitutionFitPanel({op, state, repo, canEdit, notify, data, change}: Props & {data: Record<string, any>; change: (data: Record<string, any>) => void}) {
  const [editing, setEditing] = useState<DirectoryRecord | "client" | null>(null);
  const bank = state.directory?.records.find(r => r.kind === "bank" && r.id === data.bankId) as Bank | undefined;
  const manager = state.directory?.records.find(r => r.kind === "manager" && r.id === data.managerId) as Manager | undefined;
  const profile = findRecord(state.records ?? [], "profile", op.id)?.data ?? {};
  const fit = institutionFit(op, profile, bank, manager, data);
  return <div className={`fit-panel ${fit.status}`}>
    <div className="fit-heading"><BankLogo bank={bank}/><div><strong>{fit.label}</strong><small>Garantias, restrições, faturamento anual e atuação do gerente</small></div></div>
    {fit.issues.length > 0 ? <ul>{fit.issues.map(i => <li key={i.key+i.message}><b>{i.level === "conflict" ? "Divergência" : "A confirmar"}:</b> {i.message}</li>)}</ul> : <p>Os dados cadastrados atendem aos critérios informados. A aprovação depende da análise da instituição.</p>}
    {fit.conflicts.length > 0 && <p><strong>Novos vínculos e reativações ficam bloqueados até corrigir a divergência.</strong></p>}
    {fit.pending.length > 0 && <p>Informações ausentes continuam sinalizadas; um vínculo em preparação não confirma elegibilidade.</p>}
    <div className="module-actions"><button type="button" disabled={!canEdit} onClick={() => setEditing("client")}>Cliente disponibilizará outra garantia / corrigir dados</button>{bank && <button type="button" disabled={!canEdit} onClick={() => setEditing(bank)}>Banco mudou a política</button>}{manager && <button type="button" disabled={!canEdit} onClick={() => setEditing(manager)}>Revisar target / área do gerente</button>}</div>
    {manager?.serviceScope === "radius" && <details><summary>Confirmar distância de atendimento</summary><p>Informe a distância consultada e a fonte. Ela será revista se as cidades ou o raio mudarem.</p><label>Distância até {manager.city} (km)<input type="number" min="0" max="20000" step="0.1" value={data.distanceKm ?? ""} onChange={e => change({...data,distanceKm: e.target.value === "" ? null : Number(e.target.value), distanceContext: distanceContext(profile,manager)})}/></label><label>Fonte e data da consulta<input maxLength={2000} value={data.distanceSource || ""} onChange={e => change({...data,distanceSource: e.target.value,distanceContext: distanceContext(profile,manager)})}/></label></details>}
    {editing === "client" && <ClientCriteriaEditor op={op} state={state} repo={repo} canEdit={canEdit} notify={notify} close={() => setEditing(null)}/>}
    {editing && editing !== "client" && <DirectoryEditor confirmationRequired record={editing} banks={(state.directory?.records ?? []).filter(r => r.kind === "bank") as Bank[]} events={state.directory?.events ?? []} canEdit={canEdit} close={() => setEditing(null)} save={async input => {if (!input.source.trim()) throw Error("Informe quem confirmou a política e a data.");await repo.saveDirectory(input,editing.version);notify("Política atualizada. A aderência será recalculada para os clientes.");setEditing(null);}}/>}
  </div>;
}
export function ClientCriteriaEditor({op,state,repo,canEdit,notify,close}: Props & {close:()=>void}) {
  const [profile] = useState(() => findRecord(state.records ?? [], "profile", op.id));
  const [originalOp,setOriginalOp] = useState(op);
  const [data,setData] = useState<Record<string,any>>(() => ({address:"",city:"",state:"",segment:"",...profile?.data}));
  const [guarantees,setGuarantees] = useState(() => offeredGuarantees(profile?.data ?? {}));
  const [confirmation,setConfirmation] = useState("");
  const [revenue,setRevenue] = useState(op.revenueCents === null ? "" : String(op.revenueCents / 100).replace(".",","));
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const field = (k:string,v:string) => setData({...data,[k]:v});
  return <Drawer title="Dados para direcionamento" close={() => !busy && close()}><form className="module-form" onSubmit={async e => {e.preventDefault();e.stopPropagation();setBusy(true);setError("");try {await repo.saveRecord(recordInput("profile",op.id,{...data,offeredGuarantees:guarantees,guaranteeConfirmation:confirmation.trim()},profile?.id),profile?.version ?? null);notify("Garantias e cadastro atualizados.");close();} catch(e) {setError(e instanceof Error ? e.message : "Falha ao salvar.");} finally {setBusy(false);}}}>
    <p><strong>{op.company}</strong><br/>{op.cnpj}</p>
    <fieldset disabled={!canEdit || busy}><label>Faturamento anual (R$)<input value={revenue} inputMode="decimal" onChange={e => setRevenue(e.target.value)}/></label><button type="button" onClick={async () => {setBusy(true);setError("");try {const revenueCents=parseMoney(revenue);await repo.save({...originalOp,revenueCents},originalOp.version);setOriginalOp({...originalOp,revenueCents,version:originalOp.version+1});notify("Faturamento anual atualizado.");} catch(e){setError(e instanceof Error ? e.message : "Falha ao atualizar faturamento.");}finally{setBusy(false);}}}>Atualizar faturamento anual</button><small>Atual: {money(originalOp.revenueCents)}</small>
    <label>Situação de restrição<select value={data.restriction || "A verificar"} onChange={e => field("restriction",e.target.value)}>{restrictionOptions.map(s => <option key={s}>{s}</option>)}</select></label>
    <div className="module-grid"><label>Cidade<input value={data.city} onChange={e => field("city",e.target.value)} maxLength={120}/></label><label>UF<select value={data.state} onChange={e => field("state",e.target.value)}><option value="">Não informada</option>{statesBR.map(s => <option key={s}>{s}</option>)}</select></label></div>
    <label>Segmento de atuação<input value={data.segment} onChange={e => field("segment",e.target.value)} maxLength={120}/></label>
    <h3>Garantias que o cliente disponibilizará</h3><p>Marque somente as garantias confirmadas para a operação. A seleção substitui a lista usada no direcionamento; a base importada é preservada.</p>
    <div className="guarantee-picker">{clientWarrantyKinds.map(g => <label key={g}><input type="checkbox" checked={guarantees.includes(g)} onChange={e => setGuarantees(e.target.checked ? [...guarantees,g] : guarantees.filter(x => x !== g))}/>{g}</label>)}</div>
    <label>Quem confirmou a disponibilidade e quando?<textarea required maxLength={2000} value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Ex.: contato do cliente, data e garantia que ficará disponível. Se não houver garantia, registre essa confirmação."/></label>
    </fieldset>{error && <p className="module-error" role="alert">{error}</p>}<div className="module-actions"><button type="button" onClick={close}>Fechar</button><button className="primary" disabled={!canEdit || busy || !confirmation.trim()}>Salvar cadastro e garantias</button></div>
  </form></Drawer>;
}
