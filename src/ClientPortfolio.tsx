import { BankLogo } from "./BankLogo";
import { CopyCnpj, DriveActions, ManagerContact } from "./ClientResources";
import { InstitutionFitPanel, ClientCriteriaEditor } from "./InstitutionFitPanel";
import { institutionFit, needsFitCheck, placementStatuses } from "./institutionFit";
import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Landmark,
  FileText,
  ClipboardList,
  Settings2,
  BriefcaseBusiness,
  Users,
  Clock3,
  RotateCcw,
  ArrowRight,
  Calculator,
  ListFilter,
  Rows3,
  LayoutList,
  FolderOpen,
} from "lucide-react";
import {
  money,
  parseMoney,
  displayDate,
  today,
  products,
  type Operation,
  type WorkspaceState,
} from "./domain";
import { type Bank, type Manager, statesBR } from "./directory";
import { Drawer } from "./DirectoryPages";
import {
  findRecord,
  recordInput,
  isInactive,
  type WorkspaceRecord,
} from "./records";
import type { Repository } from "./repository";
import { isWorking, matchesAttention, matchesModality, modalityGroups, normalizeSearch, portfolioIndex, priorityOrder, stageTone, type Attention, type ModalityGroup } from "./portfolio";
import { InlineOperationControls } from "./InlineOperationControls";
import { DealFields, DealSummary, dealDraft, readDeal } from "./DealFields";
import { ContactButtons, ClientClassification } from "./ClientActions";
import { activeTracks, minimumChecklist } from "./clientFlow";
import { pendingDocument, readyDocument } from "./workflow";
import "./modules.css";
const err = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível salvar.";
export function ClientPortfolio({
  state,
  repo,
  canEdit,
  onEdit,
  onModule,
  notify,
}: {
  state: WorkspaceState;
  repo: Repository;
  canEdit: boolean;
  onEdit: (op: Operation | "new") => void;
  onModule: (page: "contracts" | "diagnosis" | "simulator" | "workflow", id: string) => void;
  notify: (s: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todos"),
    [owner, setOwner] = useState("Todos"),
    [product, setProduct] = useState("Todos"),
    [modality, setModality] = useState<ModalityGroup>("Todas as modalidades"),
    [attention, setAttention] = useState<Attention>("all"),
    [sort, setSort] = useState("priority"),
    [currentPage, setCurrentPage] = useState(1),
    [compact, setCompact] = useState(() => { try { return localStorage.getItem("lr-portfolio-compact") === "true"; } catch { return false; } }),
    [expanded, setExpanded] = useState<string | null>(null),
    [editing, setEditing] = useState<{
      op: Operation;
      record: WorkspaceRecord | null;
      kind: "profile" | "placement";
    } | null>(null);
  const records = state.records ?? [],
    placements = records.filter((r) => r.kind === "placement");
  const [criteriaClient, setCriteriaClient] = useState<Operation | null>(null);
  const [date, setDate] = useState(today);
  useEffect(() => { const timer = setInterval(() => setDate(today()), 60000); return () => clearInterval(timer); }, []);
  const index = useMemo(() => portfolioIndex(state, date), [state, date]);
  const activeCount = index.filter((r) => isWorking(r.operation)).length;
  const resumeCount = index.filter((r) => isInactive(r.operation.stage)).length;
  const lateCount = index.filter((r) => r.late).length;
  const todayCount = index.filter((r) => r.dueToday).length;
  const unscheduledCount = index.filter((r) => r.unscheduled).length;
  const rows = useMemo(() => {
    const result = index.filter((r) => {
      const o = r.operation;
      return (filter === "Todos" || (filter === "Em atuação" ? isWorking(o) : filter === "Para retomada" ? isInactive(o.stage) : !isWorking(o) && !isInactive(o.stage)))
        && (owner === "Todos" || o.owner === owner) && (product === "Todos" || o.product === product || r.links.some((p) => p.data.deal?.modality === product)) && matchesModality(r, modality)
        && matchesAttention(r, attention) && r.search.includes(normalizeSearch(search));
    });
    if (sort === "priority") result.sort(priorityOrder);
    if (sort === "name") result.sort((a, b) => a.operation.company.localeCompare(b.operation.company, "pt-BR"));
    if (sort === "amount") result.sort((a, b) => (b.operation.requestedCents ?? -1) - (a.operation.requestedCents ?? -1));
    if (sort === "due") result.sort((a, b) => (a.nextDue || "9999").localeCompare(b.nextDue || "9999"));
    return result;
  }, [index, filter, owner, product, modality, attention, search, sort]);
  useEffect(() => { setCurrentPage(1); }, [search, filter, owner, product, modality, attention, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / 25)), page = Math.min(currentPage, pages);
  const displayed = rows.slice((page - 1) * 25, page * 25);
  const reset = () => { setSearch(""); setOwner("Todos"); setProduct("Todos"); setModality("Todas as modalidades"); setFilter("Todos"); setAttention("all"); setSort("priority"); };
  const selectSummary = (nextFilter: string, nextAttention: Attention = "all") => { reset(); setFilter(nextFilter); setAttention(nextAttention); };
  const filtered = search || owner !== "Todos" || product !== "Todos" || modality !== "Todas as modalidades" || filter !== "Todos" || attention !== "all";
  return (
    <section className={`module-page portfolio-page ${compact ? "compact-portfolio" : ""}`}>
      <div className="portfolio-overview" aria-label="Resumo da carteira">
        {[
          { label: "Clientes na carteira", value: index.length, sub: `${placements.length} vínculos com instituições`, icon: Users, tone: "navy", selected: filter === "Todos" && attention === "all", run: () => selectSummary("Todos") },
          { label: "Em atuação", value: activeCount, sub: "operações em andamento", icon: BriefcaseBusiness, tone: "green", selected: filter === "Em atuação" && attention === "all", run: () => selectSummary("Em atuação") },
          { label: "Para retomada", value: resumeCount, sub: "clientes para reaproximar", icon: RotateCcw, tone: "gold", selected: filter === "Para retomada" && attention === "all", run: () => selectSummary("Para retomada") },
          { label: "Retornos vencidos", value: lateCount, sub: "clientes com prazos pendentes", icon: Clock3, tone: "red", selected: attention === "late", run: () => selectSummary("Todos", "late") },
        ].map(({ label, value, sub, icon: Icon, tone, selected, run }) => <button key={label} onClick={run} aria-pressed={selected} className={`portfolio-metric ${tone}`}><span>{label}<Icon size={18} /></span><strong>{value}</strong><small>{sub}<ArrowRight size={14} /></small></button>)}
      </div>
      <div className="daily-focus">
        <div className="daily-focus-label"><Clock3 size={17} /><strong>Radar da carteira</strong><span>Cliente e instituições</span></div>
        <button className={attention === "today" ? "is-active" : ""} onClick={() => selectSummary("Todos", "today")}><b>{todayCount}</b> com retorno hoje <ArrowRight size={13} /></button>
        <button className={attention === "unscheduled" ? "is-active" : ""} onClick={() => selectSummary("Em atuação", "unscheduled")}><b>{unscheduledCount}</b> sem prazo definido <ArrowRight size={13} /></button>
      </div>
      <div className="module-heading">
        <div>
          <div className="eyebrow">GESTÃO DE OPERAÇÕES</div>
          <h1>Carteira de clientes</h1>
          <p>
            {state.operations.length} clientes · {placements.length} vínculos
            com instituições
          </p>
        </div>
        <div className="module-actions">
          <button
            onClick={() => {
              const blob = new Blob(
                [
                  JSON.stringify(
                    {
                      schemaVersion: "0.3",
                      exportedAt: new Date().toISOString(),
                      ...state,
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download =
                "LRCapital-v2-" +
                new Date().toISOString().slice(0, 10) +
                ".json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Exportar base
          </button>
          <button
            className="primary"
            disabled={!canEdit}
            onClick={() => onEdit("new")}
          >
            <Plus size={16} /> Adicionar cliente
          </button>
        </div>
      </div>
      <div className="portfolio-shortcuts" aria-label="Acesso rápido">
        <span>ACESSO RÁPIDO</span>
        <button onClick={() => onModule("contracts", "")}><FileText size={15} /> Emitir contrato</button>
        <button onClick={() => onModule("simulator", "")}><Calculator size={15} /> Simular crédito</button>
        <button onClick={() => onModule("diagnosis", "")}><ClipboardList size={15} /> Preparar diagnóstico</button>
        <button onClick={() => onModule("workflow", "")}><FolderOpen size={15} /> Acompanhamento e documentos</button>
      </div>
      <div className="module-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar cliente ou instituição"
            placeholder="Buscar empresa, responsável ou instituição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Situação dos clientes"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["Todos", "Em atuação", "Para retomada", "Concluídos"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Responsável pela carteira"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="Todos">Todos os responsáveis</option>
          {[...new Set(state.operations.map((o) => o.owner))]
            .sort()
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
      </div>
      <nav className="modality-tabs" aria-label="Carteiras por modalidade">
        {modalityGroups.map((group) => <button key={group} aria-pressed={modality === group} onClick={() => { setModality(group); setProduct("Todos"); }}>{group}<b>{index.filter((r) => matchesModality(r, group)).length}</b></button>)}
      </nav>
      <p className="portfolio-help">Altere a etapa ou a modalidade diretamente na linha. Clique no nome do cliente para acompanhar suas instituições. Um cliente pode participar de mais de uma modalidade.</p>
      <div className="portfolio-view-tools">
        <div><ListFilter size={15} /><select aria-label="Produto da carteira" value={product} onChange={(e) => setProduct(e.target.value)}><option value="Todos">Todos os produtos</option>{products.map((p) => <option key={p}>{p}</option>)}</select>
          <select aria-label="Filtrar por prazo" value={attention} onChange={(e) => setAttention(e.target.value as Attention)}><option value="all">Todos os prazos</option><option value="late">Retornos vencidos</option><option value="today">Retorno hoje</option><option value="unscheduled">Sem prazo definido</option></select>
          {filtered && <button onClick={reset}>Limpar filtros</button>}
        </div>
        <div><span>{rows.length} clientes</span><select aria-label="Ordenar carteira" value={sort} onChange={(e) => setSort(e.target.value)}><option value="priority">Prioridade da carteira</option><option value="original">Ordem da base</option><option value="name">Nome A–Z</option><option value="amount">Maior demanda</option><option value="due">Próximo retorno</option></select>
          <button aria-pressed={compact} aria-label={compact ? "Usar linhas confortáveis" : "Usar linhas compactas"} title={compact ? "Linhas confortáveis" : "Linhas compactas"} onClick={() => { setCompact(!compact); try { localStorage.setItem("lr-portfolio-compact", String(!compact)); } catch { /* Preferência opcional. */ } }}>{compact ? <LayoutList size={17} /> : <Rows3 size={17} />}</button>
        </div>
      </div>
      <div className="module-card portfolio" id="portfolio-list">
        <div className="portfolio-head">
          <span>EMPRESA / CLIENTE</span>
          <span>ETAPA / MODALIDADE</span>
          <span>DEMANDA / FATURAMENTO</span>
          <span>PRÓXIMO PASSO</span>
          <span>RESPONSÁVEL</span>
        </div>
        {displayed.map((entry) => {
          const { operation: op, links } = entry;
          const documents = records.filter((r) => r.operationId === op.id && r.kind === "document" && !r.data.archived);
          const
            profile = findRecord(records, "profile", op.id);
          return (
            <React.Fragment key={op.id}>
              <div
                className={
                  "portfolio-row " + (expanded === op.id ? "open" : "")
                }
              >
                <div className="client-row-identity"><button className="client-title client-toggle" aria-expanded={expanded === op.id} aria-label={`Instituições de ${op.company}`} onClick={() => setExpanded(expanded === op.id ? null : op.id)}>
                  {expanded === op.id ? (
                    <ChevronDown size={17} />
                  ) : (
                    <ChevronRight size={17} />
                  )}
                  <span>
                    <strong>{op.company}</strong>
                    <small>
                      {links.length}{" "}
                      instituições
                    </small>
                    <small>{minimumChecklist(op,records).complete?"✓ Mínimo documental conferido":"○ Mínimo documental: "+minimumChecklist(op,records).done+"/"+minimumChecklist(op,records).total} · {documents.filter((r)=>pendingDocument(r)).length} pendências registradas</small>
                  </span>
                </button>
                <CopyCnpj cnpj={op.cnpj} notify={notify}/><ContactButtons op={op} records={records} repo={repo} canEdit={canEdit} notify={notify}/><DriveActions op={op} state={state} repo={repo} canEdit={canEdit} notify={notify}/></div>
                <div data-label="Etapa">
                  <InlineOperationControls op={op} repo={repo} canEdit={canEdit} notify={notify} />
                  <ClientClassification op={op} state={state} repo={repo} canEdit={canEdit} notify={notify}/>
                  <div className="client-track-labels">{activeTracks(op,records).join(" · ")||"Frentes a definir"}</div>
                </div>
                <span data-label="Demanda">
                  {money(op.requestedCents)}
                  <small>Faturamento: {money(op.revenueCents)}</small>
                </span>
                <span className="next-action" data-label="Próximo passo" title={op.nextAction}>
                  {op.nextAction || "Próximo passo a definir"}
                  <small className={entry.late ? "due-overdue" : ""}>{entry.nextDue ? <><Clock3 size={11} /> {displayDate(entry.nextDue)}{entry.late ? " · vencido" : ""}{entry.nextDue !== op.dueDate ? " · acompanhamento" : ""}</> : isWorking(op) ? "Sem prazo definido" : "Sem retorno agendado"}</small>
                </span>
                <span className="portfolio-owner" data-label="Responsável"><i>{op.owner?.slice(0, 1) || "—"}</i>{op.owner}</span>
              </div>
              {expanded === op.id && (
                <div className="client-expanded">
                  <div className="module-actions">
                    <button onClick={() => setCriteriaClient(op)}>Garantias e direcionamento</button>
                    <button className="primary" onClick={() => onModule("workflow", op.id)}><FolderOpen size={15} /> Documentos e acompanhamento</button>
                    <button onClick={() => onEdit(op)}>
                      <Settings2 size={15} /> Dados do cliente
                    </button>
                    <button
                      onClick={() =>
                        setEditing({
                          op,
                          record: profile ?? null,
                          kind: "profile",
                        })
                      }
                    >
                      Endereço e cadastro
                    </button>
                    <button onClick={() => onModule("contracts", op.id)}>
                      <FileText size={15} /> Contrato
                    </button>
                    <button onClick={() => onModule("diagnosis", op.id)}>
                      <ClipboardList size={15} /> Diagnóstico
                    </button>
                    <button onClick={() => onModule("simulator", op.id)}>
                      Simular crédito
                    </button>
                  </div>
                  {profile?.data.importIssues?.length > 0 && (
                    <p className="module-warning">
                      Revisar cadastro: {profile?.data.importIssues.join(" · ")}
                    </p>
                  )}
                  <InstitutionList repo={repo} notify={notify}
                    op={op}
                    links={links}
                    state={state}
                    canEdit={canEdit}
                    onEdit={(r) =>
                      setEditing({ op, record: r, kind: "placement" })
                    }
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
        {!rows.length && (
          <div className="module-empty"><Search size={25} /><p>Nenhum cliente nesta seleção.</p><button onClick={reset}>Limpar filtros e ver a carteira</button></div>
        )}
      </div>
      <div className="portfolio-pagination" aria-label="Páginas da carteira">
        <span aria-live="polite">{rows.length ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, rows.length)} de ${rows.length} clientes` : "Nenhum resultado"}</span>
        <div><button disabled={page <= 1} onClick={() => { setCurrentPage(page - 1); document.getElementById("portfolio-list")?.scrollIntoView({ block: "start" }); }}>Anterior</button><span>Página {page} de {pages}</span><button disabled={page >= pages} onClick={() => { setCurrentPage(page + 1); document.getElementById("portfolio-list")?.scrollIntoView({ block: "start" }); }}>Próxima <ChevronRight size={14} /></button></div>
      </div>
      <p className="module-footnote">
        {rows.length} clientes nesta seleção. Os valores e códigos sem definição
        na base original permanecem sinalizados para conferência.
      </p>
      {criteriaClient && <ClientCriteriaEditor op={state.operations.find(o => o.id === criteriaClient.id) || criteriaClient} state={state} repo={repo} canEdit={canEdit} notify={notify} close={() => setCriteriaClient(null)}/>}
      {editing && (
        <RecordEditor
          key={editing.record?.id ?? editing.op.id + editing.kind}
          {...editing}
          state={state}
          repo={repo}
          canEdit={canEdit}
          close={() => setEditing(null)}
          notify={notify}
        />
      )}
    </section>
  );
}
function InstitutionList({
  repo, notify,
  op,
  links,
  state,
  canEdit,
  onEdit,
}: {
  op: Operation;
  repo: Repository; notify: (s:string) => void;
  links: WorkspaceRecord[];
  state: WorkspaceState;
  canEdit: boolean;
  onEdit: (r: WorkspaceRecord | null) => void;
}) {
  const [filter, setFilter] = useState("Todas");
  const shown = links.filter(
    (r) =>
      filter === "Todas" ||
      (filter === "Em atuação" ? r.data.active : !r.data.active),
  );
  return (
    <>
      <div className="subheading">
        <h3>
          <Landmark size={19} /> Instituições financeiras{" "}
          <span className="pill">{links.length}</span>
        </h3>
        <div className="module-actions">
          <select
            aria-label="Atuação das instituições"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["Todas", "Em atuação", "Fora de atuação"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button disabled={!canEdit} onClick={() => onEdit(null)}>
            <Plus size={14} /> Vincular instituição
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="module-table">
          <thead>
            <tr>
              {[
                "Instituição",
                "Status / atuação",
                "Gerente / contato",
                "Operação solicitada",
                "Interações e próximo passo",
                "Atualização",
                "",
              ].map((s, i) => (
                <th key={i}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const d = r.data,
                m = state.directory?.records.find(
                  (x) => x.id === d.managerId && x.kind === "manager",
                ) as Manager | undefined;
              return (
                <tr key={r.id}>
                  <td>
                    <div className="institution-identity"><BankLogo bank={state.directory?.records.find(x => x.id === d.bankId && x.kind === "bank") as Bank | undefined} name={d.institution}/><strong>{d.institution || "A identificar"}</strong></div>
                    <small>{d.active ? "Em atuação" : "Fora de atuação"}</small>
                  </td>
                  <td>
                    <PlacementStatus record={r} repo={repo} canEdit={canEdit} notify={notify}/>
                    <FitSummary op={op} state={state} record={r} onOpen={() => onEdit(r)}/>
                  </td>
                  <td>
                    {m?.name || d.manager || "Não informado"}
                    <ManagerContact op={op} placement={r} state={state} repo={repo} canEdit={canEdit} notify={notify}/>
                  </td>
                  <td>
                    {d.product || "Não informada"}
                    <small>Solicitado: {money(d.requestedCents)}</small>
                    <small>Aprovado: {money(d.approvedCents)}</small>
                    <DealSummary deal={d.deal} requested={d.requestedCents} approved={d.approvedCents} />
                  </td>
                  <td className="notes-cell">
                    <div>{d.notes || "Sem interação registrada"}</div>
                    {d.nextAction && d.nextAction !== d.notes && (
                      <p>Próximo: {d.nextAction}</p>
                    )}
                    <small>{displayDate(d.dueDate)}</small>
                  </td>
                  <td>
                    {r.updatedAt
                      ? new Date(r.updatedAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td>
                    <button
                      onClick={() => onEdit(r)}
                      aria-label={"Abrir atuação " + d.institution}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && (
          <p className="module-empty">Nenhuma instituição nesta seleção.</p>
        )}
      </div>
    </>
  );
}
export function RecordEditor({
  op,
  record,
  kind,
  state,
  repo,
  canEdit,
  close,
  notify,
}: {
  op: Operation;
  record: WorkspaceRecord | null;
  kind: "profile" | "placement";
  state: WorkspaceState;
  repo: Repository;
  canEdit: boolean;
  close: () => void;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<Record<string, any>>(
      () =>
        record?.data ??
        (kind === "profile"
          ? { address: "", city: "", state: "", segment: "" }
          : {
              bankId: "",
              institution: "",
              managerId: "",
              manager: "",
              status: "Não enviado",
              product: "",
              requestedCents: null,
              approvedCents: null,
              notes: "",
              nextAction: "",
              dueDate: "",
              active: false,
            }),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [deal, setDeal] = useState(() => dealDraft(record?.data.deal));
  const banks = (state.directory?.records ?? []).filter(
      (r) => r.kind === "bank" && !r.archived,
    ) as Bank[],
    managers = (state.directory?.records ?? []).filter(
      (r) => r.kind === "manager" && r.bankId === data.bankId && !r.archived,
    ) as Manager[];
  const [requested, setRequested] = useState(
      data.requestedCents == null
        ? ""
        : String(data.requestedCents / 100).replace(".", ","),
    ),
    [approved, setApproved] = useState(
      data.approvedCents == null
        ? ""
        : String(data.approvedCents / 100).replace(".", ","),
    );
  const currentOp = state.operations.find(o => o.id === op.id) || op;
  const currentProfile = findRecord(state.records ?? [], "profile", op.id)?.data ?? {};
  const rank = {compatible:0,pending:1,conflict:2};
  const rankedBanks = banks.map(bank => {
    const candidates = (state.directory?.records ?? []).filter(r => r.kind === "manager" && r.bankId === bank.id && !r.archived) as Manager[];
    const fits = (candidates.length ? candidates : [undefined]).map(manager => institutionFit(currentOp,currentProfile,bank,manager));
    const best = fits.sort((a,b) => rank[a.status]-rank[b.status] || a.issues.length-b.issues.length)[0];
    return {bank,fit:best};
  }).sort((a,b) => rank[a.fit.status]-rank[b.fit.status] || a.bank.name.localeCompare(b.bank.name,"pt-BR"));
  const fit = institutionFit(currentOp, findRecord(state.records ?? [], "profile", op.id)?.data ?? {}, banks.find(b => b.id === data.bankId), managers.find(m => m.id === data.managerId), data);
  const blocked = kind === "placement" && needsFitCheck(recordInput("placement", op.id, data, record?.id), record) && (!data.bankId || fit.conflicts.length > 0);
  const f =
    (k: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setData({ ...data, [k]: e.target.value });
  return (
    <Drawer
      title={
        kind === "profile" ? "Cadastro complementar" : "Atuação por instituição"
      }
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="module-form"
        onSubmit={async (e) => {
          e.preventDefault(); e.stopPropagation();
          setBusy(true);
          setError("");
          try {
            await repo.saveRecord(
              recordInput(
                kind,
                op.id,
                kind === "placement"
                  ? {
                      ...data,
                      requestedCents: parseMoney(requested),
                      approvedCents: parseMoney(approved),
                      deal: readDeal(deal),
                    }
                  : data,
                record?.id ??
                  (kind === "placement" ? crypto.randomUUID() : undefined),
              ),
              record?.version ?? null,
            );
            notify("Cadastro salvo.");
            close();
          } catch (e) {
            setError(err(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{op.company}</p>
        <fieldset disabled={!canEdit || busy}>
          {kind === "profile" ? (
            <>
              <label>
                Endereço completo
                <input
                  value={data.address || ""}
                  onChange={f("address")}
                  maxLength={500}
                />
              </label>
              <div className="module-grid">
                <label>
                  Cidade
                  <input value={data.city || ""} onChange={f("city")} />
                </label>
                <label>
                  UF
                  <select value={data.state || ""} onChange={f("state")}>
                    <option value="">Não informada</option>
                    {statesBR.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Segmento
                <input value={data.segment || ""} onChange={f("segment")} />
              </label>
            </>
          ) : (
            <>
              <label>
                Instituição
                <select
                  required
                  value={data.bankId}
                  onChange={(e) =>
                    setData({
                      ...data,
                      bankId: e.target.value,
                      institution:
                        banks.find((b) => b.id === e.target.value)?.name || "",
                      managerId: "",
                      manager: "",
                    })
                  }
                >
                  <option value="">Selecionar instituição</option>
                  {rankedBanks.map(({bank:b,fit}) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {fit.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gerente
                <select
                  value={data.managerId}
                  onChange={(e) =>
                    setData({
                      ...data,
                      managerId: e.target.value,
                      manager:
                        managers.find((m) => m.id === e.target.value)?.name ||
                        "",
                    })
                  }
                >
                  <option value="">Não informado</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {institutionFit(currentOp,currentProfile,banks.find(b=>b.id===data.bankId),m,data).label}
                    </option>
                  ))}
                </select>
              </label>
              <InstitutionFitPanel op={currentOp} state={state} repo={repo} canEdit={canEdit} notify={notify} data={data} change={setData}/>
              <label>
                Status
                <input
                  required
                  list="placement-status"
                  value={data.status}
                  onChange={f("status")}
                  maxLength={300}
                />
                <datalist id="placement-status">
                  {[
                    "Não enviado",
                    "Em preparação",
                    "Pendência",
                    "Em análise",
                    "Mesa de crédito",
                    "Aprovado",
                    "Contratado",
                    "Negado",
                    "Parado",
                    "Perdido",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </datalist>
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={data.active}
                  onChange={(e) =>
                    setData({ ...data, active: e.target.checked })
                  }
                />{" "}
                Em atuação nesta instituição
              </label>
              <label>
                Operação solicitada
                <textarea
                  value={data.product}
                  onChange={f("product")}
                  maxLength={300}
                />
              </label>
              <div className="module-grid">
                <label>
                  Solicitado (R$)
                  <input
                    inputMode="decimal"
                    value={requested}
                    onChange={(e) => setRequested(e.target.value)}
                  />
                </label>
                <label>
                  Aprovado (R$)
                  <input
                    inputMode="decimal"
                    value={approved}
                    onChange={(e) => setApproved(e.target.value)}
                  />
                </label>
              </div>
              <DealFields value={deal} onChange={setDeal} />
              <label>
                Interações / pendências
                <textarea
                  rows={5}
                  value={data.notes}
                  onChange={f("notes")}
                  maxLength={12000}
                />
              </label>
              <label>
                Próximo passo
                <textarea
                  value={data.nextAction}
                  onChange={f("nextAction")}
                  maxLength={12000}
                />
              </label>
              <label>
                Prazo
                <input
                  type="date"
                  value={data.dueDate}
                  onChange={f("dueDate")}
                />
              </label>
            </>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="module-error">
            {error}
          </p>
        )}
        <div className="module-actions">
          <button type="button" onClick={close}>
            Fechar
          </button>
          <button className="primary" disabled={busy || !canEdit || blocked}>
            Salvar dados
          </button>
        </div>
        {record && (
          <details>
            <summary>Histórico de alterações</summary>
            {(state.recordEvents ?? [])
              .filter((e) => e.recordId === record.id)
              .map((e) => (
                <p key={e.id}>
                  {new Date(e.at).toLocaleString("pt-BR")} · {e.actor} · versão{" "}
                  {e.version}
                </p>
              ))}
            {record.data.sourceUpdatedAt && (
              <p>Atualização na base original: {record.data.sourceUpdatedAt}</p>
            )}
            <p>
              Os registros originais importados permanecem disponíveis na aba
              Base recebida.
            </p>
          </details>
        )}
      </form>
    </Drawer>
  );
}

function PlacementStatus({record,repo,canEdit,notify}:{record:WorkspaceRecord;repo:Repository;canEdit:boolean;notify:(s:string)=>void}) {
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const save = async (data:Record<string,any>) => {setBusy(true);setError("");try {await repo.saveRecord({...record,data},record.version);notify("Atuação atualizada.");} catch(e) {setError(err(e));}finally{setBusy(false);}};
  return <div className="placement-inline"><select aria-label={"Status em " + record.data.institution} className={"status-"+stageTone(record.data.status)} disabled={!canEdit || busy} value={record.data.status} onChange={e => {const status=e.target.value;void save({...record.data,status,...(["Negado","Parado","Perdido","Liberado"].includes(status)?{active:false}:{})});}}>{[...new Set([record.data.status,...placementStatuses])].filter(Boolean).map(s => <option key={s}>{s}</option>)}</select><label><input type="checkbox" checked={record.data.active} disabled={!canEdit || busy} onChange={e => void save({...record.data,active:e.target.checked})}/> Em atuação</label>{error&&<p role="alert" className="module-error">{error}</p>}</div>;
}
function FitSummary({op,state,record,onOpen}:{op:Operation;state:WorkspaceState;record:WorkspaceRecord;onOpen:()=>void}) {
 const fit=institutionFit(op,findRecord(state.records??[],"profile",op.id)?.data??{},state.directory?.records.find(r=>r.id===record.data.bankId&&r.kind==="bank") as Bank|undefined,state.directory?.records.find(r=>r.id===record.data.managerId&&r.kind==="manager") as Manager|undefined,record.data);
 return <button className={"fit-summary "+fit.status} onClick={onOpen} title={fit.issues.map(i=>i.message).join("\n")}>{fit.status==="conflict"?"⚠ ":fit.status==="compatible"?"✓ ":"○ "}{fit.label}</button>;
}
