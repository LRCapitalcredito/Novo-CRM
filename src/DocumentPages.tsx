import React, { useEffect, useState } from "react";
import { FileDown, Eye, Save, Plus, Sparkles } from "lucide-react";
import type { Operation, WorkspaceState } from "./domain";
import {
  findRecord,
  recordInput,
  validateRecord,
  type WorkspaceRecord,
} from "./records";
import type { Repository } from "./repository";
import {
  newContract,
  contractMissing,
  type ContractData,
  type ContractTemplate,
} from "./contracts";
import {
  emptyDiagnosis,
  narrativeFields,
  numericFields,
  indicators,
  extractLabeledText,
  applyExtraction,
  numberValue,
  type Diagnosis,
  type Extraction,
} from "./diagnosis";
import { contractPdf, diagnosisPdf } from "./pdf";
import type { jsPDF } from "jspdf";
import "./modules.css";
const PdfPreview = React.lazy(() => import("./PdfPreview"));
import TemplateTools from "./TemplateTools";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir.";
export const Field = ({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <label className={"field " + (wide ? "full-width" : "")}>
    {label}
    {children}
  </label>
);
export function usePdf() {
  const [url, setUrl] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return {
    url,
    show: (doc: jsPDF) => setUrl(URL.createObjectURL(doc.output("blob"))),
    clear: () => setUrl(""),
  };
}
export function DocumentPage({
  kind,
  state,
  repo,
  canEdit,
  selectedId,
  select,
  notify,
}: {
  kind: "contracts" | "diagnosis";
  state: WorkspaceState;
  repo: Repository;
  canEdit: boolean;
  selectedId: string;
  select: (id: string) => void;
  notify: (s: string) => void;
}) {
  const op = state.operations.find((o) => o.id === selectedId),
    records = state.records ?? [];
  return (
    <section className="module-page">
      <div className="module-heading">
        <div>
          <div className="eyebrow">DOCUMENTOS DO CLIENTE</div>
          <h1>
            {kind === "contracts" ? "Contratos" : "Diagnóstico financeiro"}
          </h1>
          <p>
            {kind === "contracts"
              ? "Cadastro editável, cláusulas padronizadas e autorização integrada."
              : "Book financeiro com preenchimento manual, por texto e extração assistida."}
          </p>
        </div>
        <select
          className="client-select"
          aria-label="Cliente do documento"
          value={op?.id ?? ""}
          onChange={(e) => select(e.target.value)}
        >
          <option value="">Selecione um cliente</option>
          {[...state.operations]
            .sort((a, b) => a.company.localeCompare(b.company))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.company}
              </option>
            ))}
        </select>
      </div>
      {op ? (
        kind === "contracts" ? (
          <ContractEditor
            key={op.id}
            op={op}
            records={records}
            repo={repo}
            canEdit={canEdit}
            notify={notify}
          />
        ) : (
          <DiagnosisEditor
            key={op.id}
            op={op}
            records={records}
            repo={repo}
            canEdit={canEdit}
            notify={notify}
          />
        )
      ) : (
        <div className="module-card module-empty">
          Selecione um cliente para preencher e visualizar o documento.
        </div>
      )}
    </section>
  );
}
type EditorProps = {
  op: Operation;
  records: WorkspaceRecord[];
  repo: Repository;
  canEdit: boolean;
  notify: (s: string) => void;
};
function ContractEditor({ op, records, repo, canEdit, notify }: EditorProps) {
  const existing = findRecord(records, "contract", op.id),
    profile = findRecord(records, "profile", op.id),
    template = records.find((r) => r.id === "contract-template")?.data as
      | ContractTemplate
      | undefined;
  const [data, setData] = useState<ContractData>(
      () =>
        (existing?.data as ContractData) ??
        newContract(op, profile?.data.address || ""),
    ),
    [version, setVersion] = useState(existing?.version ?? null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pdf = usePdf();
  const f =
    (k: keyof ContractData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      pdf.clear();
      setData({ ...data, [k]: e.target.value });
    };
  const perform = (action: () => void) => {
    setError("");
    try {
      action();
    } catch (e) {
      setError(errorText(e));
    }
  };
  const generate = () => {
    if (!template)
      throw new Error(
        "Configure o modelo padrão da LR Capital nesta base antes de emitir.",
      );
    validateRecord(recordInput("contract", op.id, data));
    return contractPdf(template, data);
  };
  const missing = contractMissing(data);
  return (
    <>
      <TemplateTools
        record={records.find((r) => r.id === "contract-template")}
        repo={repo}
        notify={notify}
      />
      <div className="module-info">
        Um único aceite do representante do cliente abrange o contrato e a
        autorização de consulta. O texto das cláusulas permanece padronizado;
        valores e identificação são preenchidos abaixo.
      </div>
      {!template && (
        <p className="module-warning">
          O modelo privado da LR Capital ainda não foi carregado nesta base. A
          prévia local mantém o modelo anexado; ele não é incluído no
          repositório público.
        </p>
      )}
      <fieldset className="module-fieldset" disabled={!canEdit || busy}>
        <div className="module-card">
          <h2>Dados da contratante</h2>
          <div className="module-grid">
            <Field label="Razão social">
              <input
                value={data.company}
                onChange={f("company")}
                maxLength={160}
              />
            </Field>
            <Field label="CNPJ / CPF">
              <input value={data.cnpj} onChange={f("cnpj")} maxLength={18} />
            </Field>
            <Field label="Endereço completo" wide>
              <input
                value={data.address}
                onChange={f("address")}
                maxLength={500}
              />
            </Field>
            <Field label="Representante habilitado">
              <input
                value={data.representative}
                onChange={f("representative")}
                maxLength={150}
              />
            </Field>
            <Field label="CPF do representante">
              <input value={data.cpf} onChange={f("cpf")} maxLength={14} />
            </Field>
            <Field label="Cargo / qualidade">
              <input value={data.role} onChange={f("role")} />
            </Field>
            <Field label="E-mail do representante">
              <input type="email" value={data.email} onChange={f("email")} />
            </Field>
            <Field
              label="Empresas do grupo — razão social, CNPJ e poderes de representação"
              wide
            >
              <textarea
                rows={3}
                value={data.group}
                onChange={f("group")}
                maxLength={3000}
              />
            </Field>
          </div>
          <button
            onClick={() => {
              setData({
                ...data,
                company: op.company,
                cnpj: op.cnpj,
                email: op.email,
                address: profile?.data.address || data.address,
              });
              pdf.clear();
            }}
          >
            Atualizar identificação a partir do cadastro
          </button>
          <p className="small-note">
            Confirme se o contato cadastrado possui poderes para representar a
            empresa.
          </p>
        </div>
        <div className="module-card">
          <h2>Assessoria financeira · configuração financeira</h2>
          <div className="module-grid three">
            {(
              [
                ["setup", "Diagnóstico (R$)", "setupEnabled"],
                [
                  "success",
                  "Comissão de novas operações (%)",
                  "successEnabled",
                ],
                ["restructure", "Reestruturação (%)", "restructureEnabled"],
              ] as const
            ).map(([key, label, toggle]) => (
              <div key={key}>
                <Field label={label}>
                  <input
                    type="number"
                    min="0"
                    max={key === "setup" ? 1e9 : 100}
                    step="0.01"
                    value={data[key]}
                    onChange={(e) => {
                      setData({ ...data, [key]: Number(e.target.value) });
                      pdf.clear();
                    }}
                  />
                </Field>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={data[toggle]}
                    onChange={(e) => {
                      setData({ ...data, [toggle]: e.target.checked });
                      pdf.clear();
                    }}
                  />{" "}
                  Aplicar cobrança
                </label>
              </div>
            ))}
          </div>
          <p className="small-note">
            Ao desmarcar, a respectiva remuneração é indicada como dispensada no
            contrato.
          </p>
        </div>
        <div className="module-card">
          <h2>Autorização de consulta integrada</h2>
          <div className="module-grid">
            <Field label="Finalidade específica" wide>
              <input
                value={data.purpose}
                onChange={f("purpose")}
                maxLength={500}
              />
            </Field>
            <Field label="Local de assinatura">
              <input value={data.city} onChange={f("city")} />
            </Field>
            <Field label="Data do contrato e início da autorização">
              <input type="date" value={data.date} onChange={f("date")} />
            </Field>
            <Field label="Fim da autorização">
              <input
                type="date"
                min={data.date}
                value={data.authorizationEnd}
                onChange={f("authorizationEnd")}
              />
            </Field>
          </div>
          <p className="small-note">
            Identifique as instituições consulentes. O vínculo comercial na
            carteira, sozinho, não constitui autorização de consulta.
          </p>
          {data.institutions.map((item, index) => (
            <div className="module-grid" key={index}>
              <Field label={"Instituição autorizada " + (index + 1)}>
                <input
                  value={item.name}
                  maxLength={160}
                  onChange={(e) => {
                    setData({
                      ...data,
                      institutions: data.institutions.map((v, i) =>
                        i === index ? { ...v, name: e.target.value } : v,
                      ),
                    });
                    pdf.clear();
                  }}
                />
              </Field>
              <Field label="CNPJ da instituição">
                <div className="module-actions">
                  <input
                    value={item.cnpj}
                    maxLength={18}
                    onChange={(e) => {
                      setData({
                        ...data,
                        institutions: data.institutions.map((v, i) =>
                          i === index ? { ...v, cnpj: e.target.value } : v,
                        ),
                      });
                      pdf.clear();
                    }}
                  />
                  <button
                    onClick={() => {
                      setData({
                        ...data,
                        institutions: data.institutions.filter(
                          (_, i) => i !== index,
                        ),
                      });
                      pdf.clear();
                    }}
                  >
                    Remover
                  </button>
                </div>
              </Field>
            </div>
          ))}
          <button
            onClick={() =>
              setData({
                ...data,
                institutions: [...data.institutions, { name: "", cnpj: "" }],
              })
            }
          >
            <Plus size={14} /> Adicionar instituição autorizada
          </button>
        </div>
      </fieldset>
      {missing.length > 0 && (
        <p className="module-warning">
          Minuta para conferência. Completar: {missing.join("; ")}.
        </p>
      )}
      {error && (
        <p role="alert" className="module-error">
          {error}
        </p>
      )}
      <div className="module-actions preview-actions">
        <button
          className="primary"
          disabled={busy || !canEdit}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await repo.saveRecord(
                recordInput("contract", op.id, data),
                version,
              );
              setVersion((version ?? 0) + 1);
              notify("Contrato salvo para este cliente.");
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save size={15} /> Salvar dados
        </button>
        <button onClick={() => perform(() => pdf.show(generate()))}>
          <Eye size={15} /> Visualizar contrato
        </button>
        <button
          onClick={() =>
            perform(() => generate().save("Contrato - " + op.company + ".pdf"))
          }
        >
          <FileDown size={15} /> Baixar PDF
        </button>
        <span className="small-note">
          {version ? "Versão salva: " + version : "Rascunho ainda não salvo"}
        </span>
      </div>
      {pdf.url && (
        <React.Suspense fallback={<p>Carregando leitor PDF…</p>}>
          <PdfPreview title="Contrato" url={pdf.url} />
        </React.Suspense>
      )}
    </>
  );
}
function DiagnosisEditor({ op, records, repo, canEdit, notify }: EditorProps) {
  const existing = findRecord(records, "diagnosis", op.id);
  const [data, setData] = useState<Diagnosis>(
      () => (existing?.data as Diagnosis) ?? emptyDiagnosis(),
    ),
    [version, setVersion] = useState(existing?.version ?? null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState(""),
    [proposals, setProposals] = useState<Extraction[]>([]),
    [aiReady, setAiReady] = useState(false),
    [numericErrors, setNumericErrors] = useState<Record<string, string>>({});
  const pdf = usePdf();
  useEffect(() => {
    if (repo.mode === "preview")
      fetch("/__preview/ai-status")
        .then((r) => r.json())
        .then((v) => setAiReady(v.available === true))
        .catch(() => {});
  }, [repo.mode]);
  const set = (v: Diagnosis) => {
    setData(v);
    pdf.clear();
  };
  const k = indicators(data),
    year = Number(data.referenceDate.slice(0, 4)) || new Date().getFullYear();
  const check = () => {
    validateRecord(recordInput("diagnosis", op.id, data));
    if (Object.values(numericErrors).some(Boolean))
      throw new Error(
        "Corrija os campos numéricos destacados antes de salvar ou exportar.",
      );
  };
  const perform = (action: () => void) => {
    setError("");
    try {
      check();
      action();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <>
      <div className="module-info">
        O PDF segue as 11 seções do modelo enviado. Campos vazios aparecem como
        “Não informado”. Indicadores são calculados quando suas bases estão
        preenchidas; análises e conclusões ficam sob revisão do responsável.
      </div>
      <div className="module-card">
        <h2>Preencher a partir de texto</h2>
        <Field label="Informações do cliente">
          <textarea
            rows={5}
            maxLength={40000}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={
              "História e fundação: ...\nFaturamento LTM: 1.200.000,00\nEBITDA LTM: 120.000,00\nPontos positivos: ..."
            }
          />
        </Field>
        <div className="module-actions">
          <button
            disabled={!canEdit || busy}
            onClick={() => {
              setError("");
              const items = extractLabeledText(source);
              setProposals(items);
              if (!items.length)
                setError(
                  "Nenhum campo reconhecido. Use uma informação por linha no formato Nome do campo: valor.",
                );
            }}
          >
            Ler campos do texto
          </button>
          <button
            disabled={!canEdit || busy || !aiReady}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const res = await fetch("/__preview/diagnosis-extract", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: source }),
                });
                const out = await res.json();
                if (!res.ok) throw new Error(out.error);
                setProposals(out.items);
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Sparkles size={15} /> {busy ? "Processando…" : "Extrair com IA"}
          </button>
        </div>
        <p className="small-note">
          {aiReady
            ? "Ao extrair com IA, somente o texto acima será enviado à OpenAI. Revise os trechos antes de aplicar."
            : "A leitura de campos funciona localmente. A extração de texto livre com IA ficará disponível após configurar a chave e o modelo no servidor."}
        </p>
        {proposals.length > 0 && (
          <>
            <div className="extraction-list">
              {proposals.map((p, i) => (
                <div key={i}>
                  <strong>
                    {narrativeFields[p.field] || numericFields[p.field]}
                  </strong>
                  : {p.value ?? "Não identificado"}
                  <blockquote>{p.evidence}</blockquote>
                </div>
              ))}
            </div>
            <button
              className="primary"
              disabled={!canEdit}
              onClick={() =>
                perform(() => {
                  set(applyExtraction(data, proposals));
                  setProposals([]);
                  notify("Campos aplicados ao rascunho. Revise e salve.");
                })
              }
            >
              Aplicar campos revisados
            </button>
          </>
        )}
      </div>
      <fieldset className="module-fieldset" disabled={!canEdit || busy}>
        <div className="module-card">
          <h2>Identificação e referência</h2>
          <div className="module-grid">
            <Field label="Data-base">
              <input
                type="date"
                value={data.referenceDate}
                onChange={(e) =>
                  set({ ...data, referenceDate: e.target.value })
                }
              />
            </Field>
            <Field label="Responsável pela análise">
              <input
                value={data.analyst}
                onChange={(e) => set({ ...data, analyst: e.target.value })}
                maxLength={120}
              />
            </Field>
          </div>
        </div>
        <div className="module-card">
          <h2>Perfil, mercado e análise</h2>
          <div className="module-grid">
            {Object.entries(narrativeFields).map(([key, label]) => (
              <Field key={key} label={label}>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={data.texts[key] ?? ""}
                  onChange={(e) =>
                    set({
                      ...data,
                      texts: { ...data.texts, [key]: e.target.value },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
        <div className="module-card">
          <h2>Dados financeiros e indicadores</h2>
          <p className="small-note">
            Valores monetários em reais, margens em %, prazos em dias e razões
            em vezes. Use a mesma data-base e o mesmo período para valores
            comparáveis. Um indicador informado manualmente é usado quando
            faltam suas bases de cálculo.
          </p>
          <div className="module-grid three">
            {Object.entries(numericFields).map(([key, label]) => (
              <Field key={key} label={label}>
                <NumericInput
                  value={data.numbers[key] ?? null}
                  error={numericErrors[key]}
                  setError={(s) =>
                    setNumericErrors((v) => ({ ...v, [key]: s }))
                  }
                  onValue={(v) =>
                    set({ ...data, numbers: { ...data.numbers, [key]: v } })
                  }
                />
                {key in k && k[key] != null && (
                  <span className="small-note">
                    Indicador resultante:{" "}
                    {k[key]!.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </Field>
            ))}
          </div>
        </div>
        <div className="module-card">
          <h2>Faturamento mensal</h2>
          <p className="small-note">
            36 meses anteriores e ano da data-base. Deixe vazio quando não
            houver informação.
          </p>
          <div className="table-scroll">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  {[0, 1, 2, 3].map((c) => (
                    <th key={c}>{year - 3 + c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, m) => (
                  <tr key={m}>
                    <td>
                      {new Date(2020, m, 1).toLocaleDateString("pt-BR", {
                        month: "long",
                      })}
                    </td>
                    {[0, 1, 2, 3].map((c) => {
                      const key = `${year - 3 + c}-${String(m + 1).padStart(2, "0")}`;
                      return (
                        <td key={key}>
                          <NumericInput
                            label={"Faturamento " + key}
                            value={data.monthly[key] ?? null}
                            nonnegative
                            error={numericErrors[key]}
                            setError={(s) =>
                              setNumericErrors((v) => ({ ...v, [key]: s }))
                            }
                            onValue={(v) =>
                              set({
                                ...data,
                                monthly: { ...data.monthly, [key]: v },
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="module-error">
          {error}
        </p>
      )}
      <div className="module-actions preview-actions">
        <button
          className="primary"
          disabled={!canEdit || busy}
          onClick={async () => {
            setError("");
            setBusy(true);
            try {
              check();
              await repo.saveRecord(
                recordInput("diagnosis", op.id, data),
                version,
              );
              setVersion((version ?? 0) + 1);
              notify("Diagnóstico salvo.");
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save size={15} /> Salvar diagnóstico
        </button>
        <button onClick={() => perform(() => pdf.show(diagnosisPdf(op, data)))}>
          <Eye size={15} /> Visualizar PDF
        </button>
        <button
          onClick={() =>
            perform(() =>
              diagnosisPdf(op, data).save(
                "Diagnóstico Financeiro - " + op.company + ".pdf",
              ),
            )
          }
        >
          <FileDown size={15} /> Baixar PDF
        </button>
        <span className="small-note">
          {version ? "Versão salva: " + version : "Rascunho ainda não salvo"}
        </span>
      </div>
      {pdf.url && (
        <React.Suspense fallback={<p>Carregando leitor PDF…</p>}>
          <PdfPreview title="Diagnóstico financeiro" url={pdf.url} />
        </React.Suspense>
      )}
    </>
  );
}
function NumericInput({
  value,
  onValue,
  label,
  error,
  setError,
  nonnegative = false,
}: {
  value: number | null;
  onValue: (v: number | null) => void;
  label?: string;
  error?: string;
  setError: (s: string) => void;
  nonnegative?: boolean;
}) {
  const [text, setText] = useState(
    value == null ? "" : String(value).replace(".", ","),
  );
  useEffect(
    () => setText(value == null ? "" : String(value).replace(".", ",")),
    [value],
  );
  return (
    <>
      <input
        className="compact-number"
        aria-label={label}
        aria-invalid={!!error}
        inputMode="decimal"
        value={text}
        placeholder="Não informado"
        onChange={(e) => {
          setText(e.target.value);
          try {
            const n = numberValue(e.target.value);
            if (nonnegative && n != null && n < 0)
              throw new Error("Use valor não negativo.");
            setError("");
            onValue(n);
          } catch (e) {
            setError(errorText(e));
          }
        }}
      />
      {error && <small role="alert">{error}</small>}
    </>
  );
}
