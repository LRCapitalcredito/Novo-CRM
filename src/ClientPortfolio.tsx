import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Landmark,
  FileText,
  ClipboardList,
  Settings2,
} from "lucide-react";
import {
  money,
  parseMoney,
  displayDate,
  type Operation,
  type WorkspaceState,
} from "./domain";
import { type Bank, type Manager, whatsappUrl, statesBR } from "./directory";
import { Drawer } from "./DirectoryPages";
import {
  findRecord,
  recordInput,
  isInactive,
  type WorkspaceRecord,
} from "./records";
import type { Repository } from "./repository";
import "./modules.css";
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
  onModule: (page: "contracts" | "diagnosis" | "simulator", id: string) => void;
  notify: (s: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todos"),
    [owner, setOwner] = useState("Todos"),
    [expanded, setExpanded] = useState<string | null>(null),
    [editing, setEditing] = useState<{
      op: Operation;
      record: WorkspaceRecord | null;
      kind: "profile" | "placement";
    } | null>(null);
  const records = state.records ?? [],
    placements = records.filter((r) => r.kind === "placement");
  const rows = state.operations.filter(
    (o) =>
      (filter === "Todos" ||
        (filter === "Em atuação"
          ? !isInactive(o.stage)
          : isInactive(o.stage))) &&
      (owner === "Todos" || o.owner === owner) &&
      norm(
        [
          o.company,
          o.cnpj,
          o.owner,
          o.nextAction,
          ...placements
            .filter((r) => r.operationId === o.id)
            .map((r) => r.data.institution),
        ].join(" "),
      ).includes(norm(search)),
  );
  return (
    <section className="module-page">
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
          {["Todos", "Em atuação", "Para retomada"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Responsável pela carteira"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option>Todos</option>
          {[...new Set(state.operations.map((o) => o.owner))]
            .sort()
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
      </div>
      <div className="module-card portfolio">
        <div className="portfolio-head">
          <span>EMPRESA / CLIENTE</span>
          <span>ETAPA</span>
          <span>DEMANDA / FATURAMENTO</span>
          <span>PRÓXIMO PASSO</span>
          <span>RESPONSÁVEL</span>
        </div>
        {rows.map((op) => {
          const links = placements.filter((r) => r.operationId === op.id),
            profile = findRecord(records, "profile", op.id);
          return (
            <React.Fragment key={op.id}>
              <button
                className={
                  "portfolio-row " + (expanded === op.id ? "open" : "")
                }
                aria-expanded={expanded === op.id}
                onClick={() => setExpanded(expanded === op.id ? null : op.id)}
              >
                <span className="client-title">
                  {expanded === op.id ? (
                    <ChevronDown size={17} />
                  ) : (
                    <ChevronRight size={17} />
                  )}
                  <span>
                    <strong>{op.company}</strong>
                    <small>
                      {op.cnpj || "Documento a completar"} · {links.length}{" "}
                      instituições
                    </small>
                  </span>
                </span>
                <span>
                  <b
                    className={"pill " + (isInactive(op.stage) ? "muted" : "")}
                  >
                    {op.stage}
                  </b>
                </span>
                <span>
                  {money(op.requestedCents)}
                  <small>Faturamento: {money(op.revenueCents)}</small>
                </span>
                <span className="next-action" title={op.nextAction}>
                  {op.nextAction || "Próximo passo a definir"}
                  <small>{displayDate(op.dueDate)}</small>
                </span>
                <span>{op.owner}</span>
              </button>
              {expanded === op.id && (
                <div className="client-expanded">
                  <div className="module-actions">
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
                  <InstitutionList
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
          <p className="module-empty">Nenhum cliente encontrado.</p>
        )}
      </div>
      <p className="module-footnote">
        {rows.length} clientes nesta seleção. Os valores e códigos sem definição
        na base original permanecem sinalizados para conferência.
      </p>
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
  op,
  links,
  state,
  canEdit,
  onEdit,
}: {
  op: Operation;
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
                    <strong>{d.institution || "A identificar"}</strong>
                    <small>{d.active ? "Em atuação" : "Fora de atuação"}</small>
                  </td>
                  <td>
                    <span className="pill">
                      {/^\d+$/.test(d.status)
                        ? "Código original: " + d.status
                        : d.status || "Não informado"}
                    </span>
                  </td>
                  <td>
                    {m?.name || d.manager || "Não informado"}
                    {m?.phone && (
                      <a
                        className="contact-link"
                        target="_blank"
                        rel="noreferrer"
                        href={whatsappUrl(m.phone) || undefined}
                      >
                        {m.phone}
                      </a>
                    )}
                  </td>
                  <td>
                    {d.product || "Não informada"}
                    <small>Solicitado: {money(d.requestedCents)}</small>
                    <small>Aprovado: {money(d.approvedCents)}</small>
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
function RecordEditor({
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
              active: true,
            }),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
          e.preventDefault();
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
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
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
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
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
          <button className="primary" disabled={busy || !canEdit}>
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
