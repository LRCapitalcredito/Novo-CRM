import React, { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowDownUp,
  Check,
  Copy,
  History,
  Landmark,
  Plus,
  Search,
  Settings2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { money, parseMoney } from "./domain";
import {
  newBank,
  newManager,
  validateDirectory,
  validateDataset,
  whatsappUrl,
  warrantyKinds,
  statesBR,
  scopes,
  type Bank,
  type Manager,
  type DirectoryRecord,
  type DirectoryInput,
  type DirectoryState,
  type LegacyDataset,
  legacyTables,
} from "./directory";
import type { Repository } from "./repository";
import "./directory.css";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir.";
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const amountInput = (v: number | null) =>
  v === null ? "" : String(v / 100).replace(".", ",");
const optionalNumber = (s: string) =>
  s === "" ? null : Number(s.replace(",", "."));
const fieldNames: Record<string, string> = {
  name: "nome",
  type: "tipo",
  color: "cor",
  logoUrl: "logo",
  acceptsRestriction: "restrição",
  guarantees: "garantias e condições",
  bankId: "instituição",
  minRevenueCents: "faturamento mínimo",
  maxRevenueCents: "faturamento máximo",
  email: "e-mail",
  phone: "WhatsApp",
  city: "cidade",
  state: "UF",
  serviceScope: "alcance",
  radiusKm: "raio",
  servedStates: "estados atendidos",
  notes: "observações",
  source: "origem",
  archived: "arquivamento",
};
function BankMark({ bank }: { bank: Bank }) {
  return (
    <span className="bank-mark" style={{ background: bank.color }}>
      {bank.logoUrl ? (
        <img
          src={bank.logoUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        bank.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
function sourceText(record: DirectoryRecord) {
  return record.source === "Vínculo do pipeline importado"
    ? "Dados a completar"
    : record.source.includes("tela")
      ? "Transcrito da tela"
      : "Cadastro atualizado";
}
export function DirectoryPage({
  kind,
  directory,
  repo,
  canEdit,
  notify,
}: {
  kind: "bank" | "manager";
  directory: DirectoryState;
  repo: Repository;
  canEdit: boolean;
  notify: (s: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [bankFilter, setBankFilter] = useState(""),
    [stateFilter, setStateFilter] = useState(""),
    [scopeFilter, setScopeFilter] = useState(""),
    [guaranteeFilter, setGuaranteeFilter] = useState(""),
    [restriction, setRestriction] = useState(""),
    [archived, setArchived] = useState("active"),
    [sort, setSort] = useState("name"),
    [reverse, setReverse] = useState(false);
  const [edit, setEdit] = useState<DirectoryRecord | DirectoryInput | null>(
      null,
    ),
    [error, setError] = useState("");
  const banks = directory.records.filter((r): r is Bank => r.kind === "bank");
  const items = directory.records.filter((r) => r.kind === kind);
  const bankName = (id: string) =>
    banks.find((b) => b.id === id)?.name || "Instituição não encontrada";
  const filtered = items
    .filter((r) => {
      if (
        (archived === "active" && r.archived) ||
        (archived === "archived" && !r.archived)
      )
        return false;
      const searchable =
        r.kind === "bank"
          ? [r.name, r.type, ...Object.keys(r.guarantees)]
          : [r.name, bankName(r.bankId), r.email, r.phone, r.city, r.state];
      if (!searchable.some((s) => norm(s).includes(norm(search)))) return false;
      if (r.kind === "bank")
        return (
          (!guaranteeFilter || Object.hasOwn(r.guarantees, guaranteeFilter)) &&
          (!restriction || String(r.acceptsRestriction) === restriction)
        );
      return (
        (!bankFilter || r.bankId === bankFilter) &&
        (!stateFilter || r.state === stateFilter) &&
        (!scopeFilter || r.serviceScope === scopeFilter)
      );
    })
    .sort((a, b) => {
      let av: any = (a as any)[sort] ?? "",
        bv: any = (b as any)[sort] ?? "";
      if (sort === "bankId") {
        av = bankName(av);
        bv = bankName(bv);
      }
      return (
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR", { numeric: true })) *
        (reverse ? -1 : 1)
      );
    });
  function heading(key: string, label: string) {
    return (
      <button
        className="sort-heading"
        onClick={() => {
          setSort(key);
          setReverse(sort === key ? !reverse : false);
        }}
      >
        {label}
        <ArrowDownUp size={12} />
      </button>
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">BASE DE RELACIONAMENTO</div>
          <h1>
            {kind === "bank" ? "Bancos e instituições" : "Gerentes"}
            <span className="title-dot">.</span>
          </h1>
          <p>
            {kind === "bank"
              ? "Garantias, condições e critérios em um cadastro único."
              : "Contatos vinculados às instituições, com faixa de faturamento e alcance."}
          </p>
        </div>
        <div className="title-actions">
          {kind === "bank" && (
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    filtered.map((r) => r.name).join("\n"),
                  );
                  notify("Nomes das instituições copiados.");
                } catch {
                  setError("Não foi possível copiar.");
                }
              }}
            >
              <Copy size={16} />
              Copiar nomes
            </button>
          )}
          <button
            className="button primary"
            disabled={!canEdit}
            onClick={() => setEdit(kind === "bank" ? newBank() : newManager())}
          >
            <Plus size={16} />
            {kind === "bank" ? "Adicionar instituição" : "Adicionar gerente"}
          </button>
        </div>
      </div>
      <div className="directory-summary">
        <span>
          <strong>{items.filter((r) => !r.archived).length}</strong>{" "}
          {kind === "bank" ? "instituições" : "gerentes"} ativos
        </span>
        <span>
          {
            items.filter((r) => r.source === "Vínculo do pipeline importado")
              .length
          }{" "}
          derivados do pipeline
        </span>
        <span>{items.filter((r) => r.archived).length} arquivados</span>
      </div>
      <section className="portfolio-panel directory-panel">
        <div className="directory-tools">
          <label className="search">
            <Search size={17} />
            <input
              aria-label={kind === "bank" ? "Buscar banco" : "Buscar gerente"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                kind === "bank"
                  ? "Buscar nome, tipo ou garantia…"
                  : "Buscar nome, banco, e-mail, telefone ou cidade…"
              }
            />
          </label>
          <div className="directory-filters">
            {kind === "bank" ? (
              <>
                <select
                  aria-label="Filtrar garantia"
                  value={guaranteeFilter}
                  onChange={(e) => setGuaranteeFilter(e.target.value)}
                >
                  <option value="">Todas as garantias</option>
                  {warrantyKinds.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar aceitação de restrição"
                  value={restriction}
                  onChange={(e) => setRestriction(e.target.value)}
                >
                  <option value="">Política de restrição</option>
                  <option value="true">Aceita restrição</option>
                  <option value="false">Não aceita restrição</option>
                  <option value="null">Não informada</option>
                </select>
              </>
            ) : (
              <>
                <select
                  aria-label="Filtrar instituição"
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                >
                  <option value="">Todas as instituições</option>
                  {[...banks]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Filtrar UF base"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                >
                  <option value="">Todas as UFs</option>
                  {statesBR.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar alcance"
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                >
                  <option value="">Todos os alcances</option>
                  {Object.entries(scopes)
                    .filter(([k]) => k)
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </>
            )}
            <select
              aria-label="Situação do cadastro"
              value={archived}
              onChange={(e) => setArchived(e.target.value)}
            >
              <option value="active">Ativos</option>
              <option value="archived">Arquivados</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className={`directory-table ${kind}`}>
            <thead>
              <tr>
                {kind === "bank" ? (
                  <>
                    <th>{heading("name", "INSTITUIÇÃO")}</th>
                    <th>{heading("type", "TIPO")}</th>
                    <th>ACEITA RESTRIÇÃO</th>
                    <th>GARANTIAS E CONDIÇÕES</th>
                    <th>GERENTES</th>
                  </>
                ) : (
                  <>
                    <th>{heading("bankId", "INSTITUIÇÃO")}</th>
                    <th>{heading("name", "GERENTE")}</th>
                    <th>{heading("minRevenueCents", "FAT. MÍNIMO")}</th>
                    <th>{heading("maxRevenueCents", "FAT. MÁXIMO")}</th>
                    <th>E-MAIL / WHATSAPP</th>
                    <th>{heading("city", "CIDADE BASE")}</th>
                    <th>ALCANCE</th>
                  </>
                )}
                <th>
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) =>
                record.kind === "bank" ? (
                  <tr key={record.id}>
                    <td>
                      <button
                        className="bank-name"
                        onClick={() => setEdit(record)}
                      >
                        <BankMark bank={record} />
                        <span>
                          <strong>{record.name}</strong>
                          <small>{sourceText(record)}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      {record.type || (
                        <span className="not-informed">Não informado</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`restriction ${record.acceptsRestriction === true ? "yes" : ""}`}
                      >
                        {record.acceptsRestriction === null
                          ? "Não informado"
                          : record.acceptsRestriction
                            ? "Sim"
                            : "Não"}
                      </span>
                    </td>
                    <td>
                      <div className="warranty-chips">
                        {Object.entries(record.guarantees).map(([g, d]) => (
                          <button
                            key={g}
                            onClick={() => setEdit(record)}
                            title={`Prazo: ${d.termMonths ?? "não informado"} meses · LTV: ${d.ltvPercent ?? "não informado"}%`}
                          >
                            <Landmark size={12} />
                            {g}
                            {d.rate && <strong>{d.rate}</strong>}
                          </button>
                        ))}
                        {!Object.keys(record.guarantees).length && (
                          <span className="not-informed">
                            Condições não informadas
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {
                        directory.records.filter(
                          (r) =>
                            r.kind === "manager" &&
                            r.bankId === record.id &&
                            !r.archived,
                        ).length
                      }
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Editar ${record.name}`}
                        onClick={() => setEdit(record)}
                      >
                        <Settings2 size={17} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={record.id}>
                    <td>
                      <button
                        className="bank-link"
                        onClick={() => {
                          const bank = banks.find(
                            (b) => b.id === record.bankId,
                          );
                          if (bank) setEdit(bank);
                        }}
                      >
                        {banks.find((b) => b.id === record.bankId) && (
                          <BankMark
                            bank={banks.find((b) => b.id === record.bankId)!}
                          />
                        )}
                        <strong>{bankName(record.bankId)}</strong>
                      </button>
                    </td>
                    <td>
                      <button
                        className="record-name"
                        onClick={() => setEdit(record)}
                      >
                        {record.name}
                      </button>
                      <small>{sourceText(record)}</small>
                    </td>
                    <td className="numeric">{money(record.minRevenueCents)}</td>
                    <td className="numeric">{money(record.maxRevenueCents)}</td>
                    <td>
                      {record.email ? (
                        <a href={`mailto:${record.email}`}>{record.email}</a>
                      ) : (
                        <span className="not-informed">
                          E-mail não informado
                        </span>
                      )}
                      <div className="contact-phone">
                        {whatsappUrl(record.phone) ? (
                          <a
                            href={whatsappUrl(record.phone)!}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {record.phone} ↗
                          </a>
                        ) : (
                          record.phone || "WhatsApp não informado"
                        )}
                      </div>
                    </td>
                    <td>
                      {record.city || "Não informada"}
                      {record.state && <small>{record.state}</small>}
                    </td>
                    <td>
                      {scopes[record.serviceScope]}
                      {record.serviceScope === "radius" && (
                        <small>{record.radiusKm} km</small>
                      )}
                      {record.serviceScope === "states" && (
                        <small>{record.servedStates.join(" · ")}</small>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Editar gerente ${record.name}`}
                        onClick={() => setEdit(record)}
                      >
                        <Settings2 size={17} />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty">
            <Landmark />
            <strong>Nenhum cadastro encontrado</strong>
            <p>Adicione um registro ou ajuste os filtros.</p>
          </div>
        )}
        <div className="table-footer">
          <span>{filtered.length} registros exibidos</span>
          <span>Alterações com histórico e controle de versão</span>
        </div>
      </section>
      <p className="directory-note">
        “Não informado” significa que a informação não consta na fonte. As taxas
        são referências cadastradas e precisam de confirmação com a instituição.
      </p>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {edit && (
        <DirectoryEditor
          record={edit}
          banks={banks}
          events={directory.events}
          canEdit={canEdit}
          close={() => setEdit(null)}
          save={async (input) => {
            await repo.saveDirectory(
              input,
              "version" in edit ? edit.version : null,
            );
            notify("Cadastro salvo e sincronizado.");
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

export function Drawer({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const listener = (e: KeyboardEvent) => {
      // Somente a janela sobreposta mais recente recebe Escape e prende o foco.
      if (Array.from(document.querySelectorAll(".directory-drawer")).at(-1) !== ref.current) return;
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ),
        ].filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-overlay">
      <div
        className="directory-drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <div className="eyebrow">CADASTRO LR CAPITAL</div>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Fechar cadastro"
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function DirectoryEditor({
  record,
  banks,
  events,
  canEdit,
  close,
  save,
}: {
  record: DirectoryRecord | DirectoryInput;
  banks: Bank[];
  events: DirectoryState["events"];
  canEdit: boolean;
  close: () => void;
  save: (r: DirectoryInput) => Promise<void>;
}) {
  const [form, setForm] = useState<any>(() =>
      JSON.parse(JSON.stringify(record)),
    ),
    [min, setMin] = useState(
      record.kind === "manager" ? amountInput(record.minRevenueCents) : "",
    ),
    [max, setMax] = useState(
      record.kind === "manager" ? amountInput(record.maxRevenueCents) : "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false);
  const set = (key: string, value: unknown) =>
    setForm((old: any) => ({ ...old, [key]: value }));
  const field =
    (key: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      set(key, e.target.value);
  const warranty = (key: string, field: string, value: unknown) =>
    setForm((old: any) => ({
      ...old,
      guarantees: {
        ...old.guarantees,
        [key]: { ...old.guarantees[key], [field]: value },
      },
    }));
  return (
    <Drawer
      title={
        record.name ||
        (record.kind === "bank" ? "Nova instituição" : "Novo gerente")
      }
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="modal-tabs">
        <button
          className={!history ? "active" : ""}
          onClick={() => setHistory(false)}
        >
          Cadastro
        </button>
        <button
          className={history ? "active" : ""}
          onClick={() => setHistory(true)}
        >
          <History size={14} />
          Histórico
        </button>
      </div>
      {history ? (
        <div className="modal-body">
          {events
            .filter((e) => e.entityId === record.id)
            .map((e) => (
              <div className="directory-event" key={e.id}>
                <strong>
                  Versão {e.version} · {e.actor}
                </strong>
                <p>{e.changes.map((k) => fieldNames[k] || k).join(" · ")}</p>
                <small>{new Date(e.at).toLocaleString("pt-BR")}</small>
              </div>
            ))}
          {!events.some((e) => e.entityId === record.id) && (
            <p>Nenhuma alteração registrada.</p>
          )}
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const next = validateDirectory({
                ...form,
                ...(form.kind === "manager"
                  ? {
                      minRevenueCents: parseMoney(min),
                      maxRevenueCents: parseMoney(max),
                    }
                  : {}),
              });
              await save(next);
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="modal-body">
            <fieldset disabled={!canEdit || busy}>
              <div className="form-grid">
                <label className="span2">
                  {form.kind === "bank"
                    ? "Nome da instituição"
                    : "Nome do gerente"}
                  <input
                    required
                    maxLength={160}
                    value={form.name}
                    onChange={field("name")}
                  />
                </label>
                {form.kind === "bank" ? (
                  <>
                    <label>
                      Tipo
                      <input
                        list="bank-types"
                        value={form.type}
                        onChange={field("type")}
                        placeholder="Não informado"
                      />
                      <datalist id="bank-types">
                        {[
                          "Banco",
                          "Banco Público",
                          "Banco de Fomento",
                          "Cooperativa",
                          "FIDC",
                          "Fundo de Crédito",
                          "Fintech",
                          "Fintech Agro",
                          "Financeira",
                          "Banco Atacado",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </datalist>
                    </label>
                    <label>
                      Aceita restrição?
                      <select
                        value={String(form.acceptsRestriction)}
                        onChange={(e) =>
                          set(
                            "acceptsRestriction",
                            e.target.value === "null"
                              ? null
                              : e.target.value === "true",
                          )
                        }
                      >
                        <option value="null">Não informado</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </label>
                    <label>
                      Cor da instituição
                      <input
                        type="color"
                        value={form.color}
                        onChange={field("color")}
                      />
                    </label>
                    <label>
                      Endereço HTTPS da logo
                      <input
                        type="url"
                        placeholder="https://…"
                        value={form.logoUrl}
                        onChange={field("logoUrl")}
                      />
                    </label>
                    <div className="span2 warranty-editor">
                      <h3>Garantias e condições por garantia</h3>
                      <p>
                        Selecione as garantias aceitas. Preencha taxa, prazo e
                        LTV somente quando conhecidos.
                      </p>
                      {warrantyKinds.map((g) => (
                        <div
                          className={`warranty-option ${form.guarantees[g] ? "chosen" : ""}`}
                          key={g}
                        >
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={!!form.guarantees[g]}
                              onChange={(e) => {
                                const next = { ...form.guarantees };
                                if (e.target.checked)
                                  next[g] = {
                                    rate: "",
                                    termMonths: null,
                                    ltvPercent: null,
                                  };
                                else delete next[g];
                                set("guarantees", next);
                              }}
                            />
                            {g}
                          </label>
                          {form.guarantees[g] && (
                            <div className="warranty-values">
                              <label>
                                Taxa · {g}
                                <input
                                  placeholder="Ex.: 1,5% a.m."
                                  value={form.guarantees[g].rate}
                                  onChange={(e) =>
                                    warranty(g, "rate", e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                Prazo em meses · {g}
                                <input
                                  type="number"
                                  min="0"
                                  max="600"
                                  placeholder="Não informado"
                                  value={form.guarantees[g].termMonths ?? ""}
                                  onChange={(e) =>
                                    warranty(
                                      g,
                                      "termMonths",
                                      optionalNumber(e.target.value),
                                    )
                                  }
                                />
                              </label>
                              <label>
                                LTV % · {g}
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  placeholder="Não informado"
                                  value={form.guarantees[g].ltvPercent ?? ""}
                                  onChange={(e) =>
                                    warranty(
                                      g,
                                      "ltvPercent",
                                      optionalNumber(e.target.value),
                                    )
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="span2">
                      Instituição vinculada
                      <select
                        required
                        value={form.bankId}
                        onChange={field("bankId")}
                      >
                        <option value="">Selecione a instituição</option>
                        {[...banks]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                              {b.archived ? " · arquivada" : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Faturamento mínimo
                      <input
                        inputMode="decimal"
                        placeholder="Não informado"
                        value={min}
                        onChange={(e) => setMin(e.target.value)}
                      />
                    </label>
                    <label>
                      Faturamento máximo
                      <input
                        inputMode="decimal"
                        placeholder="Não informado"
                        value={max}
                        onChange={(e) => setMax(e.target.value)}
                      />
                    </label>
                    <label>
                      E-mail
                      <input
                        type="email"
                        value={form.email}
                        onChange={field("email")}
                      />
                    </label>
                    <label>
                      WhatsApp
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={field("phone")}
                      />
                    </label>
                    <label>
                      UF da cidade base
                      <select value={form.state} onChange={field("state")}>
                        <option value="">Não informada</option>
                        {statesBR.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cidade base
                      <input value={form.city} onChange={field("city")} />
                    </label>
                    <label className="span2">
                      Alcance de atendimento
                      <select
                        value={form.serviceScope}
                        onChange={field("serviceScope")}
                      >
                        {Object.entries(scopes).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    {form.serviceScope === "radius" && (
                      <label>
                        Raio em quilômetros
                        <input
                          type="number"
                          min="1"
                          max="20000"
                          value={form.radiusKm ?? ""}
                          onChange={(e) =>
                            set("radiusKm", optionalNumber(e.target.value))
                          }
                        />
                      </label>
                    )}
                    {form.serviceScope === "states" && (
                      <div className="span2">
                        <p>Estados atendidos</p>
                        <div className="state-picker">
                          {statesBR.map((s) => (
                            <label key={s}>
                              <input
                                type="checkbox"
                                checked={form.servedStates.includes(s)}
                                onChange={(e) =>
                                  set(
                                    "servedStates",
                                    e.target.checked
                                      ? [...form.servedStates, s]
                                      : form.servedStates.filter(
                                          (v: string) => v !== s,
                                        ),
                                  )
                                }
                              />
                              {s}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <label className="span2">
                  Origem / confirmação
                  <input
                    maxLength={300}
                    value={form.source}
                    onChange={field("source")}
                  />
                </label>
                <label className="span2">
                  Observações
                  <textarea
                    rows={3}
                    maxLength={12000}
                    value={form.notes}
                    onChange={field("notes")}
                  />
                </label>
                <label className="check-label span2">
                  <input
                    type="checkbox"
                    checked={form.archived}
                    onChange={(e) => set("archived", e.target.checked)}
                  />
                  <Archive size={15} />
                  Cadastro arquivado (pode ser reativado)
                </label>
              </div>
            </fieldset>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <footer>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </button>
            <button className="button primary" disabled={!canEdit || busy}>
              <Check size={16} />
              {busy ? "Salvando…" : "Salvar cadastro"}
            </button>
          </footer>
        </form>
      )}
    </Drawer>
  );
}

const tableNames: Record<string, string> = {
  metadata: "Metadados",
  clientes: "Clientes",
  operacoes: "Operações",
  instituicoes_operacao: "Vínculos bancários",
  garantias: "Garantias",
  documentos: "Documentos",
  historico: "Histórico",
  erros_validacao: "Avisos da origem",
};
export function ComparisonPage({
  directory,
  repo,
  notify,
}: {
  directory: DirectoryState;
  repo: Repository;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<LegacyDataset | null>(null),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState<(typeof legacyTables)[number]>("clientes"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState<Record<string, unknown> | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState<{
      filename: string;
      data: LegacyDataset;
    } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!selected && directory.imports.length)
      setSelected(directory.imports[0].id);
  }, [directory.imports, selected]);
  useEffect(() => {
    let active = true;
    setData(null);
    if (selected && repo.readImport)
      repo
        .readImport(selected)
        .then((d) => {
          if (active) setData(d);
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    return () => {
      active = false;
    };
  }, [selected, repo]);
  const rows = (data?.[tab] ?? []).filter(
    (row) =>
      !search ||
      Object.values(row).some((v) =>
        norm(String(v ?? "")).includes(norm(search)),
      ),
  );
  const columns = Object.keys(rows[0] ?? {});
  const displayColumns = columns.slice(0, tab === "clientes" ? 8 : 6);
  const visible = rows.slice(page * 25, (page + 1) * 25);
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">CONFERÊNCIA COM O SISTEMA ATUAL</div>
          <h1>
            Base recebida<span className="title-dot">.</span>
          </h1>
          <p>
            Dados originais para comparação, preservando valores, etapas e
            vínculos.
          </p>
        </div>
        {repo.importDataset && (
          <label className="button primary file-button">
            <Upload size={16} />
            Importar JSON
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Importar JSON do pipeline"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 8000000)
                    throw new Error("Arquivo maior que 8 MB.");
                  setPending({
                    filename: file.name,
                    data: validateDataset(JSON.parse(await file.text())),
                  });
                  setError("");
                } catch (err) {
                  setError(message(err));
                }
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <div className="info-box">
        <Landmark size={19} />
        <span>
          O arquivo de pipeline contém vínculos, mas não a base completa de
          bancos e gerentes. Os nomes identificáveis viram cadastros editáveis;
          critérios e contatos ausentes ficam como “Não informado”. A carteira
          original abaixo é uma consulta para comparação, ainda sem conversão
          para os novos fluxos.
        </span>
      </div>
      {pending && (
        <section className="surface import-review">
          <h2>Conferir importação</h2>
          <p>{pending.filename}</p>
          <div className="import-counts">
            {legacyTables
              .filter((t) => t !== "metadata")
              .map((t) => (
                <span key={t}>
                  <strong>{pending.data[t].length}</strong>
                  {tableNames[t]}
                </span>
              ))}
          </div>
          <p>
            O arquivo ficará salvo apenas neste ambiente local. Reimportar o
            mesmo conteúdo não duplica os cadastros nem substitui edições
            existentes.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const summary = await repo.importDataset!(
                  pending.data,
                  pending.filename,
                );
                setSelected(summary.id);
                setPending(null);
                notify("Base importada e preservada para comparação.");
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar importação local
          </button>
        </section>
      )}
      {directory.imports.length > 0 && (
        <>
          <label className="source-select">
            Arquivo consultado
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setPage(0);
              }}
            >
              {directory.imports.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.filename}
                </option>
              ))}
            </select>
          </label>
          <div className="import-counts">
            {legacyTables
              .filter((t) => t !== "metadata")
              .map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => {
                    setTab(t);
                    setSearch("");
                    setPage(0);
                  }}
                >
                  <strong>{data?.[t].length ?? "…"}</strong>
                  {tableNames[t]}
                </button>
              ))}
          </div>
          <section className="portfolio-panel">
            <div className="directory-tools">
              <label className="search">
                <Search size={16} />
                <input
                  aria-label="Buscar na base recebida"
                  placeholder={`Buscar em ${tableNames[tab].toLowerCase()}…`}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <span className="not-informed">
                Consulta da origem · {tableNames[tab]}
              </span>
            </div>
            <div className="table-scroll">
              <table className="directory-table source-table">
                <thead>
                  <tr>
                    {displayColumns.map((k) => (
                      <th key={k}>{k.replaceAll("_", " ")}</th>
                    ))}
                    <th>DETALHES</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, index) => (
                    <tr key={page * 25 + index}>
                      {displayColumns.map((k) => (
                        <td key={k}>{String(row[k] ?? "Não informado")}</td>
                      ))}
                      <td>
                        <button
                          className="button secondary"
                          onClick={() => setDetail(row)}
                        >
                          Ver registro
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {rows.length} registros · página {page + 1} de{" "}
                {Math.max(1, Math.ceil(rows.length / 25))}
              </span>
              <div>
                <button
                  className="button secondary"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <button
                  className="button secondary"
                  disabled={(page + 1) * 25 >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      {!directory.imports.length && (
        <div className="empty">
          <Upload />
          <strong>Nenhuma base importada neste ambiente</strong>
          <p>
            A importação inicial está disponível na prévia local para
            conferência antes da migração.
          </p>
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {detail && (
        <Drawer title="Registro original" close={() => setDetail(null)}>
          <div className="modal-body">
            <dl className="source-details">
              {Object.entries(detail).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>
                    {typeof v === "object"
                      ? JSON.stringify(v, null, 2)
                      : String(v ?? "Não informado")}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
            {tab === "clientes" && data && (
              <div className="source-related">
                <h3>Registros vinculados ao cliente</h3>
                {(
                  ["operacoes", "garantias", "documentos", "historico"] as const
                ).map((t) => (
                  <p key={t}>
                    {tableNames[t]}:{" "}
                    {
                      data[t].filter(
                        (row) => row.ID_CLIENTE === detail.ID_CLIENTE,
                      ).length
                    }
                  </p>
                ))}
              </div>
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}
