import React, { useMemo, useState } from "react";
import { defaultCredit, simulateCredit, type CreditInput } from "./credit";
import { creditPdf } from "./pdf";
import { Field, usePdf } from "./DocumentPages";
import { recordInput } from "./records";
import type { WorkspaceState } from "./domain";
import type { Repository } from "./repository";
const PdfPreview = React.lazy(() => import("./PdfPreview"));
const money = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  pct = (v: number) =>
    (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "%";
export function SimulatorPage({
  state,
  repo,
  canEdit,
  selectedId,
  select,
  notify,
}: {
  state: WorkspaceState;
  repo: Repository;
  canEdit: boolean;
  selectedId: string;
  select: (s: string) => void;
  notify: (s: string) => void;
}) {
  const op = state.operations.find((o) => o.id === selectedId);
  const [input, setInput] = useState<CreditInput>(() => ({
      ...defaultCredit(),
      ...(op?.requestedCents ? { amount: op.requestedCents / 100 } : {}),
    })),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pdf = usePdf();
  const calculation = useMemo(() => {
    try {
      return { result: simulateCredit(input), error: "" };
    } catch (e) {
      return {
        result: null,
        error: e instanceof Error ? e.message : "Cenário inválido.",
      };
    }
  }, [input]);
  const r = calculation.result;
  const update = (key: keyof CreditInput, value: any) => {
    setInput({ ...input, [key]: value });
    pdf.clear();
  };
  const numeric = (key: keyof CreditInput, label: string, step = "0.01") => (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step={step}
        value={String(input[key])}
        onChange={(e) =>
          update(key, e.target.value === "" ? NaN : Number(e.target.value))
        }
      />
    </Field>
  );
  const fees = (key: "tac" | "insurance" | "other", label: string) => {
    const financed = (key + "Financed") as keyof CreditInput;
    return (
      <div>
        {numeric(key, label)}
        <label className="check-field">
          <input
            type="checkbox"
            checked={input[financed] === true}
            onChange={(e) => update(financed, e.target.checked)}
          />{" "}
          Financiar este custo
        </label>
      </div>
    );
  };
  const saved = (state.records ?? []).filter(
    (x) => x.kind === "simulation" && x.operationId === selectedId,
  );
  return (
    <section className="module-page">
      <div className="module-heading">
        <div>
          <div className="eyebrow">PLANEJAMENTO FINANCEIRO</div>
          <h1>Simulador de crédito</h1>
          <p>Parcelas, custos e fluxo de caixa em um único cenário.</p>
        </div>
        <select
          className="client-select"
          aria-label="Cliente da simulação"
          value={op?.id ?? ""}
          onChange={(e) => select(e.target.value)}
        >
          <option value="">Simulação sem cliente</option>
          {[...state.operations]
            .sort((a, b) => a.company.localeCompare(b.company))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.company}
              </option>
            ))}
        </select>
      </div>
      <div className="sim-layout">
        <div className="module-card">
          {numeric("amount", "Valor solicitado (R$)")}
          {op && (
            <button
              onClick={() => update("amount", (op.requestedCents ?? 0) / 100)}
            >
              Usar demanda de {op.company}
            </button>
          )}
          <div className="module-grid">
            {numeric("rateMonthly", "Taxa (% ao mês)")}
            {numeric("months", "Prazo total (meses)", "1")}
            {numeric("grace", "Carência (meses)", "1")}
            <Field label="Amortização">
              <select
                value={input.system}
                onChange={(e) => update("system", e.target.value)}
              >
                <option>PRICE</option>
                <option>SAC</option>
              </select>
            </Field>
          </div>
          <Field label="Durante a carência">
            <select
              value={input.graceMode}
              onChange={(e) => update("graceMode", e.target.value)}
            >
              <option value="capitalized">Capitalizar os juros</option>
              <option value="interest">Pagar os juros mensalmente</option>
            </select>
          </Field>
          <Field label="Data da liberação">
            <input
              type="date"
              value={input.startDate}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </Field>
          <p className="small-note">
            Carência incluída no prazo total. Vencimentos mensais no dia da
            liberação, limitados ao último dia do mês.
          </p>
          <details open>
            <summary>Impostos e despesas</summary>
            <label className="check-field">
              <input
                type="checkbox"
                checked={input.iof}
                onChange={(e) => update("iof", e.target.checked)}
              />{" "}
              Incluir IOF
            </label>
            {input.iof && (
              <>
                <div className="module-grid">
                  {numeric("dailyIof", "IOF diário (%)", "0.0001")}
                  {numeric("additionalIof", "IOF adicional (%)", "0.0001")}
                </div>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={input.iofFinanced}
                    onChange={(e) => update("iofFinanced", e.target.checked)}
                  />{" "}
                  Financiar o IOF
                </label>
                <p className="small-note">
                  Parâmetros editáveis. Incidência diária sobre principal
                  amortizado, limitada a 365 dias. Verifique o enquadramento da
                  operação e eventuais isenções.
                </p>
              </>
            )}
            {fees("tac", "TAC (R$)")}
            {fees("insurance", "Prestamista inicial (R$)")}
            {numeric("monthlyInsurance", "Prestamista mensal fixo (R$)")}
            {fees("other", "Outras despesas (R$)")}
            <p className="small-note">
              Custos não financiados são descontados na liberação. O prestamista
              mensal é somado a cada parcela, inclusive na carência.
            </p>
          </details>
        </div>
        <div>
          {calculation.error && (
            <p role="alert" className="module-error">
              {calculation.error}
            </p>
          )}
          {r && (
            <>
              <div className="stat-cards">
                {[
                  ["Líquido na liberação", money(r.net)],
                  ["Primeiro pagamento", money(r.first)],
                  ["CET estimado ao ano", pct(r.cetAnnual)],
                  ["Total de parcelas", money(r.totalPayments)],
                  ["Total de juros", money(r.interest)],
                  ["IOF calculado", money(r.iof)],
                ].map(([label, v]) => (
                  <div className="stat-card" key={label}>
                    <small>{label}</small>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="module-info">
                Financiado: <strong>{money(r.financed)}</strong> · Custos na
                liberação: {money(r.upfront)} · Último pagamento:{" "}
                {money(r.last)}
                <br />
                Taxa efetiva: {pct(r.annualRate)} a.a. · CET equivalente:{" "}
                {pct(r.cetMonthly)} a.m. · Custo sobre o líquido:{" "}
                {money(r.totalCost)}
              </div>
              <p className="small-note">
                CET estimado por fluxo de caixa e dias corridos (base 365).
                Operação prefixada mensal. As condições finais e os custos
                efetivos dependem da proposta da instituição.
              </p>
              <div className="module-actions">
                <button
                  onClick={() => {
                    try {
                      pdf.show(creditPdf(input, op?.company));
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  Visualizar PDF
                </button>
                <button
                  onClick={() =>
                    creditPdf(input, op?.company).save(
                      "Simulação de crédito.pdf",
                    )
                  }
                >
                  Baixar PDF
                </button>
                <button
                  onClick={() => {
                    const lines = [
                      [
                        "Nº",
                        "Data",
                        "Parcela",
                        "Amortização",
                        "Juros",
                        "Seguro",
                        "Saldo",
                      ],
                      ...r.rows.map((v) => [
                        v.month,
                        v.date,
                        ...[
                          v.payment,
                          v.principal,
                          v.interest,
                          v.insurance,
                          v.balance,
                        ].map((n) => n.toFixed(2).replace(".", ",")),
                      ]),
                    ];
                    const url = URL.createObjectURL(
                      new Blob(
                        ["\uFEFF" + lines.map((v) => v.join(";")).join("\r\n")],
                        { type: "text/csv;charset=utf-8" },
                      ),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "simulacao.csv";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Exportar planilha CSV
                </button>
                <button
                  className="primary"
                  disabled={!canEdit || !op || busy}
                  onClick={async () => {
                    if (!op) return;
                    setBusy(true);
                    setError("");
                    try {
                      await repo.saveRecord(
                        recordInput(
                          "simulation",
                          op.id,
                          {
                            input,
                            title: `${input.system} · ${money(input.amount)} · ${input.months} meses`,
                          },
                          crypto.randomUUID(),
                        ),
                        null,
                      );
                      notify("Cenário salvo no cliente.");
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Falha ao salvar.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Salvar cenário
                </button>
              </div>
              {saved.length > 0 && (
                <Field label="Cenários salvos do cliente">
                  <select
                    value=""
                    onChange={(e) => {
                      const s = saved.find((v) => v.id === e.target.value);
                      if (s) {
                        setInput(s.data.input);
                        pdf.clear();
                      }
                    }}
                  >
                    <option value="">Abrir cenário salvo</option>
                    {saved.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.data.title} ·{" "}
                        {new Date(s.updatedAt).toLocaleString("pt-BR")}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="module-card table-scroll">
                <h2>Cronograma de pagamento · {r.rows.length} meses</h2>
                <table className="module-table numeric">
                  <thead>
                    <tr>
                      {[
                        "Nº / data",
                        "Parcela",
                        "Amortização",
                        "Juros",
                        "Prestamista",
                        "Saldo",
                      ].map((s) => (
                        <th key={s}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((v) => (
                      <tr key={v.month}>
                        <td>
                          {v.month} · {v.date.split("-").reverse().join("/")}
                          {v.capitalized > 0 && (
                            <small>Juros capitalizados</small>
                          )}
                        </td>
                        {[
                          v.payment,
                          v.principal,
                          v.interest,
                          v.insurance,
                          v.balance,
                        ].map((n, i) => (
                          <td key={i}>{money(n)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="module-error">
              {error}
            </p>
          )}
        </div>
      </div>
      {pdf.url && (
        <React.Suspense fallback={<p>Carregando leitor PDF…</p>}>
          <PdfPreview title="Simulação de crédito" url={pdf.url} />
        </React.Suspense>
      )}
    </section>
  );
}
