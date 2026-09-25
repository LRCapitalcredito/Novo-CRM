import { jsPDF } from "jspdf";
import {
  contractSections,
  contractMissing,
  type ContractData,
  type ContractTemplate,
} from "./contracts";
import { indicators, type Diagnosis } from "./diagnosis";
import { type CreditInput, simulateCredit } from "./credit";
import type { Operation } from "./domain";
const navy = "#0d203b",
  gold = "#bc9659",
  muted = "#63748a";
const currency = (v: number | null | undefined) =>
  v == null
    ? "Não informado"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v: number | null | undefined, suffix = "") =>
  v == null
    ? "Não informado"
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + suffix;
const date = (s: string) =>
  s ? s.split("-").reverse().join("/") : "Não informada";
function text(
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  width: number,
  size = 10,
  color = navy,
  bold = false,
) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(color);
  const lines = doc.splitTextToSize(s || "Não informado", width);
  doc.text(lines, x, y);
  return lines.length * size * 0.43;
}
function footer(doc: jsPDF, label: string) {
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth(),
      h = doc.internal.pageSize.getHeight();
    doc.setDrawColor("#d9e0e7");
    doc.line(18, h - 17, w - 18, h - 17);
    text(doc, label, 18, h - 11, w - 50, 7, muted);
    text(
      doc,
      String(i).padStart(2, "0") + " / " + count,
      w - 35,
      h - 11,
      25,
      7,
      muted,
    );
  }
}
export function contractPdf(t: ContractTemplate, d: ContractData) {
  const doc = new jsPDF();
  let y = 23;
  const draft = contractMissing(d).length > 0;
  const heading = () => {
    text(doc, "CONTRATO", 18, 23, 150, 22, gold, true);
    text(doc, "DE PRESTAÇÃO DE SERVIÇOS", 18, 30, 150, 10, navy, true);
    text(doc, "LR", 175, 26, 25, 28, navy, true);
    text(doc, "C A P I T A L", 169, 33, 28, 6, gold);
  };
  heading();
  y = 43;
  function paragraph(s: string, size = 10) {
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s, 174) as string[];
    for (const line of lines) {
      if (y > 274) {
        doc.addPage();
        y = 24;
      }
      text(doc, line, 18, y, 174, size);
      y += size * 0.48;
    }
    y += 3;
  }
  function title(s: string) {
    if (y > 251) {
      doc.addPage();
      y = 24;
    }
    y += 4;
    text(doc, s, 18, y, 174, 10, navy, true);
    y += 9;
  }
  if (draft)
    paragraph(
      "MINUTA PARA CONFERÊNCIA - campos cadastrais e autorização ainda precisam de complemento.",
      9,
    );
  title("CONTRATANTE");
  paragraph(
    `${d.company}\nCPF/CNPJ: ${d.cnpj || "________________"}\nEndereço: ${d.address || "________________"}\nRepresentante: ${d.representative || "________________"} | CPF: ${d.cpf || "________________"}\nCargo: ${d.role} | E-mail: ${d.email || "________________"}`,
  );
  if (d.group.trim())
    paragraph(
      "Empresas do grupo representadas, mediante poderes suficientes:\n" +
        d.group,
    );
  title("CONTRATADA");
  paragraph(
    `${t.issuer}\nCNPJ: ${t.issuerDocument}\nEndereço: ${t.issuerAddress}\nRepresentante: ${t.issuerRepresentative}\nE-mail: ${t.issuerEmail}`,
  );
  paragraph(
    "As partes celebram este contrato de assessoria financeira, regido pelas cláusulas seguintes.",
  );
  for (const section of contractSections(t, d)) {
    title(section.heading);
    for (const p of section.text.split(/\n\n/)) paragraph(p);
  }
  title(
    "AUTORIZAÇÃO ESPECÍFICA DE CONSULTA AO SCR - INTEGRANTE DESTE CONTRATO",
  );
  paragraph(
    `Titular: ${d.company}. CPF/CNPJ: ${d.cnpj || "________________"}.\nRepresentante: ${d.representative || "________________"}, CPF ${d.cpf || "________________"}, cargo ${d.role}.\nInstituições autorizadas a consultar:\n${d.institutions.length ? d.institutions.map((i) => `${i.name || "________________"} - CNPJ ${i.cnpj || "________________"}`).join("\n") : "________________ - CNPJ ________________"}\nFinalidade específica: ${d.purpose}.\nVigência da autorização: ${date(d.date)} a ${date(d.authorizationEnd)}.\nCanal para revogação e cópia à assessoria: ${t.issuerEmail}.`,
  );
  paragraph(
    "O titular autoriza expressamente as instituições acima identificadas, desde que legalmente habilitadas, a consultar suas informações no Sistema de Informações de Créditos (SCR) do Banco Central, para a finalidade e o prazo indicados, inclusive datas-base históricas estritamente necessárias. Esta autorização integra o contrato e é abrangida pela única assinatura ao final.",
  );
  paragraph(
    "O SCR subsidia a supervisão do sistema financeiro e o intercâmbio regulamentado de informações de crédito. Os registros não impedem, por si sós, a concessão de crédito. O titular pode acessar seus dados pelos canais oficiais do Banco Central e solicitar correção ou contestar registros perante a instituição responsável. Pode revogar a autorização para consultas futuras, sem afastar deveres legais de conservação. A instituição consulente manterá prova da autorização pelo prazo regulamentar aplicável, inclusive cinco anos da última consulta, quando exigido.",
  );
  paragraph(
    "A autorização não habilita a LR Capital a acessar diretamente o SCR, não autoriza acesso a contas ou senhas e não permite divulgação em desacordo com a lei. Consultas em nome próprio de sócios, garantidores ou terceiros exigem autorização individual específica. Cada instituição poderá exigir seu formulário e formalidades próprios. A autorização somente será usada após o preenchimento integral dos campos e assinatura do representante habilitado. A inclusão posterior de instituição dependerá de novo aceite específico.",
  );
  if (y > 228) {
    doc.addPage();
    y = 24;
  }
  title("ACEITE ÚNICO DO CONTRATO E DA AUTORIZAÇÃO DE CONSULTA");
  paragraph(
    "Declaro que li e aceito as condições deste contrato e autorizo especificamente as consultas indicadas na seção acima, na qualidade de representante habilitado do titular.",
  );
  paragraph(`${d.city || "________________"}, ${date(d.date)}.`);
  y += 12;
  doc.setDrawColor(navy);
  doc.line(30, y, 180, y);
  y += 7;
  text(
    doc,
    "ASSINATURA DO REPRESENTANTE HABILITADO DA CONTRATANTE",
    30,
    y,
    150,
    9,
    navy,
    true,
  );
  y += 7;
  text(
    doc,
    `${d.representative || "Nome: ____________________"} | CPF: ${d.cpf || "________________"}`,
    30,
    y,
    150,
    9,
  );
  footer(
    doc,
    draft
      ? "LR CAPITAL | MINUTA PARA CONFERÊNCIA"
      : "LR CAPITAL | CONTRATO E AUTORIZAÇÃO INTEGRADOS",
  );
  return doc;
}
export function diagnosisPdf(op: Operation, d: Diagnosis) {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const w = 297,
    h = 210,
    n = d.numbers,
    k = indicators(d);
  const t = d.texts;
  let page = 0;
  function start(title: string) {
    if (page++) doc.addPage();
    doc.setFillColor(navy);
    doc.rect(0, 0, w, 3, "F");
    doc.setFillColor(gold);
    doc.rect(0, 0, 75, 3, "F");
    text(doc, title, 16, 22, 247, 16, navy, true);
    text(doc, "LR", 266, 23, 22, 19, navy, true);
    doc.setDrawColor("#e3e8ee");
    doc.line(16, 29, 281, 29);
  }
  function box(
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    doc.setFillColor("#f5f7fa");
    doc.roundedRect(x, y, width, height, 4, 4, "F");
    const compact = height < 40,
      ly = compact ? 8 : 10,
      vy = compact ? 18 : 22;
    const content = value || "Não informado";
    text(
      doc,
      label.toUpperCase(),
      x + 6,
      y + ly,
      width - 12,
      compact ? 7 : 8,
      muted,
      true,
    );
    let size = compact ? 10 : 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    let lines = doc.splitTextToSize(content, width - 12) as string[];
    while (lines.length * size * 0.43 > height - vy + 1 && size > 7) {
      size -= 0.5;
      doc.setFontSize(size);
      lines = doc.splitTextToSize(content, width - 12);
    }
    if (lines.length * size * 0.43 > height - vy + 1)
      throw new Error(
        `O campo "${label}" é longo demais para o PDF. Resuma-o antes de exportar (conteúdo preservado no cadastro).`,
      );
    text(doc, content, x + 6, y + vy, width - 12, size);
  }
  // Same eleven sections and landscape format as the reference; no sample figures.
  doc.setFillColor(navy);
  doc.rect(0, 0, w, h, "F");
  text(doc, "LR  |  LR CAPITAL", 27, 35, 245, 20, "#ffffff", true);
  text(doc, "BOOK\nFINANCEIRO", 27, 72, 240, 38, "#ffffff", true);
  text(
    doc,
    date(d.referenceDate) + "  |  CONFIDENCIAL",
    27,
    121,
    240,
    10,
    gold,
    true,
  );
  text(doc, "PREPARADO PARA", 27, 146, 240, 8, "#c6d0df");
  text(doc, op.company, 27, 161, 235, 20, "#ffffff", true);
  text(
    doc,
    "CNPJ/CPF: " + (op.cnpj || "Não informado"),
    27,
    186,
    240,
    10,
    gold,
  );
  page++;
  start("PERFIL & HISTÓRICO");
  box("História e fundação", t.history, 16, 38, 130, 67);
  box("Principais produtos", t.products, 152, 38, 129, 67);
  box("Diferenciais competitivos", t.differentials, 16, 112, 130, 67);
  box(
    "Responsável e fontes",
    `${d.analyst || "Responsável não informado"}\n${t.location || "Cidade/UF não informada"}\n${t.sources || "Fontes não informadas"}`,
    152,
    112,
    129,
    67,
  );
  start("MERCADO & CICLOS OPERACIONAIS");
  box("Principais clientes", t.clients, 16, 38, 128, 44);
  box("Principais fornecedores", t.suppliers, 16, 88, 128, 44);
  box("Principais concorrentes", t.competitors, 16, 138, 128, 43);
  [
    ["PMR", n.pmr],
    ["PME", n.pme],
    ["PMP", n.pmp],
    ["Ciclo operacional", k.operatingCycle],
    ["Ciclo financeiro", k.financialCycle],
  ].forEach(([label, v], i) =>
    box(String(label), fmt(v as any, " dias"), 152, 38 + i * 29, 129, 26),
  );
  start("RAIO-X FINANCEIRO & INDICADORES");
  const metrics = [
    ["Liquidez corrente", k.currentRatio, "x"],
    ["Liquidez seca", k.quickRatio, "x"],
    ["Liquidez geral", k.generalRatio, "x"],
    ["CCL", k.ccl, "R$"],
    ["Dívida líquida / EBITDA", k.netDebtEbitda, "x"],
    ["Dívida líquida / PL", k.netDebtEquity, "x"],
    ["Endividamento geral", k.debtRatio, "%"],
    ["Composição do endividamento", k.debtComposition, "%"],
    ["Margem bruta", k.grossMargin, "%"],
    ["Margem EBITDA", k.ebitdaMargin, "%"],
    ["ROE", k.roe, "%"],
    ["Giro do ativo", k.assetTurnover, "x"],
  ];
  metrics.forEach(([label, v, suffix], i) =>
    box(
      String(label),
      suffix === "R$" ? currency(v as any) : fmt(v as any, String(suffix)),
      16 + Math.floor(i / 4) * 90,
      38 + (i % 4) * 36,
      85,
      31,
    ),
  );
  start("SUMÁRIO EXECUTIVO");
  box("Faturamento LTM", currency(n.revenue), 16, 38, 85, 34);
  box("Margem EBITDA", fmt(k.ebitdaMargin, "%"), 106, 38, 85, 34);
  box("Dívida líquida / EBITDA", fmt(k.netDebtEbitda, "x"), 196, 38, 85, 34);
  box("Objetivo do crédito", t.objective, 16, 81, 128, 97);
  box(
    "Composição do ativo",
    `Disponível: ${currency(n.cash)}\nEstoque: ${currency(n.inventory)}\nRecebíveis: ${currency(n.receivables)}\nOutros ativos: ${currency(n.otherAssets)}`,
    152,
    81,
    129,
    97,
  );
  start("PERFORMANCE & EVOLUÇÃO");
  const year = Number(d.referenceDate.slice(0, 4)) || new Date().getFullYear();
  let peak = 0;
  for (const v of Object.values(d.monthly)) peak = Math.max(peak, v ?? 0);
  if (peak > 0) {
    for (let m = 1; m <= 12; m++) {
      const x = 20 + (m - 1) * 21;
      for (let yr = year - 1; yr <= year; yr++) {
        const value = d.monthly[`${yr}-${String(m).padStart(2, "0")}`];
        if (value != null) {
          doc.setFillColor(yr === year ? gold : navy);
          doc.rect(
            x + (yr - (year - 1)) * 8,
            126 - (value / peak) * 65,
            7,
            (value / peak) * 65,
            "F",
          );
        }
      }
      text(doc, String(m).padStart(2, "0"), x, 134, 18, 8);
    }
    text(
      doc,
      `${year - 1} (azul)   ${year} (dourado) | Valores ausentes não são zero`,
      20,
      44,
      255,
      9,
      muted,
    );
  } else
    text(
      doc,
      "Preencha os faturamentos mensais para gerar o comparativo.",
      20,
      86,
      250,
      13,
      muted,
    );
  box("Sazonalidade e crescimento", t.seasonality, 16, 145, 265, 38);
  start("DETALHAMENTO DE FATURAMENTO");
  const months = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  text(
    doc,
    "HISTÓRICO MENSAL - 36 MESES + ANO ATUAL",
    18,
    40,
    260,
    10,
    navy,
    true,
  );
  ["MÊS", ...Array.from({ length: 4 }, (_, i) => String(year - 3 + i))].forEach(
    (v, i) => text(doc, v, 20 + i * 53, 51, 50, 9, gold, true),
  );
  months.forEach((m, i) => {
    text(doc, m, 20, 63 + i * 9.5, 48, 8, navy, true);
    for (let col = 0; col < 4; col++)
      text(
        doc,
        currency(
          d.monthly[`${year - 3 + col}-${String(i + 1).padStart(2, "0")}`],
        ),
        73 + col * 53,
        63 + i * 9.5,
        50,
        8,
      );
  });
  start("INDICADORES DE PERFORMANCE");
  box("Liquidez corrente", fmt(k.currentRatio, "x"), 16, 39, 85, 45);
  box("Margem EBITDA", fmt(k.ebitdaMargin, "%"), 106, 39, 85, 45);
  box("Dívida líquida / EBITDA", fmt(k.netDebtEbitda, "x"), 196, 39, 85, 45);
  box("EBITDA LTM", currency(n.ebitda), 16, 92, 128, 43);
  box("Avaliação de solvência", t.solvency, 152, 92, 129, 43);
  box("Conclusão do responsável", t.conclusion, 16, 143, 265, 39);
  start("GARANTIAS & ESTRUTURA");
  box("Garantias oferecidas", t.guarantees, 16, 38, 128, 55);
  box(
    "Estrutura",
    `Colaboradores: ${fmt(n.employees)}\nInstalações: ${t.facilities || "Não informadas"}`,
    152,
    38,
    129,
    55,
  );
  [
    ["Caráter", t.character],
    ["Capacidade", t.capacity],
    ["Capital", t.capital],
    ["Colateral", t.collateral],
    ["Condições", t.conditions],
  ].forEach(([label, value], i) => box(label, value, 16 + i * 54, 102, 49, 78));
  start("DESTAQUES E RISCOS");
  box("Pontos positivos", t.strengths, 16, 39, 128, 141);
  box("Riscos e mitigadores", t.risks, 152, 39, 129, 141);
  start("PRÓXIMOS PASSOS");
  text(doc, "OBRIGADO.", 24, 77, 250, 40, navy, true);
  text(
    doc,
    "Estamos à disposição para discutir esta análise\ne os próximos passos da estruturação.",
    24,
    104,
    245,
    16,
    muted,
  );
  text(doc, "LR CAPITAL", 24, 150, 250, 16, gold, true);
  text(
    doc,
    "Preparado por: " + (d.analyst || "Não informado"),
    24,
    165,
    245,
    10,
  );
  footer(doc, "CONFIDENCIAL | LR CAPITAL | BASE: " + date(d.referenceDate));
  return doc;
}
export function creditPdf(input: CreditInput, label = "Simulação de crédito") {
  const result = simulateCredit(input),
    doc = new jsPDF();
  let y = 23;
  text(doc, "LR CAPITAL | SIMULADOR DE CRÉDITO", 18, y, 174, 16, navy, true);
  y += 12;
  const summary = [
    label,
    `Sistema: ${input.system} | Taxa: ${fmt(input.rateMonthly, "% a.m.")} | Prazo total: ${input.months} meses | Carência: ${input.grace}`,
    `Crédito: ${currency(input.amount)} | Financiado: ${currency(result.financed)}`,
    `Líquido na liberação: ${currency(result.net)} | Custos antecipados: ${currency(result.upfront)}`,
    `IOF: ${currency(result.iof)} (${input.iofFinanced ? "financiado" : "antecipado"}) | TAC: ${currency(input.tac)}`,
    `TAC ${input.tacFinanced ? "financiada" : "antecipada"} | Prestamista inicial: ${currency(input.insurance)} (${input.insuranceFinanced ? "financiado" : "antecipado"})`,
    `Prestamista mensal: ${currency(input.monthlyInsurance)} | Outros: ${currency(input.other)} (${input.otherFinanced ? "financiados" : "antecipados"})`,
    `Liberação: ${date(input.startDate)} | IOF diário: ${input.dailyIof.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "%"} | Adicional: ${fmt(input.additionalIof, "%")} | IOF ${input.iof ? "incluído" : "desativado"}`,
    `Carência: juros ${input.graceMode === "capitalized" ? "capitalizados" : "pagos mensalmente"}`,
    `CET estimado: ${fmt(result.cetAnnual * 100, "% a.a.")} | Total das parcelas: ${currency(result.totalPayments)}`,
    `Juros: ${currency(result.interest)} | Custo total sobre líquido: ${currency(result.totalCost)}`,
  ];
  for (const s of summary) {
    y += text(doc, s, 18, y, 174, 9) + 3;
  }
  const xs = [18, 51, 85, 119, 147, 174],
    widths = [30, 31, 31, 26, 25, 22];
  const columns = () => {
    ["Nº / DATA", "PARCELA", "PRINCIPAL", "JUROS", "SEGURO", "SALDO"].forEach(
      (v, i) => text(doc, v, xs[i], y + 5, widths[i], 7, navy, true),
    );
    y += 13;
  };
  columns();
  for (const r of result.rows) {
    if (y > 262) {
      doc.addPage();
      y = 20;
      columns();
    }
    const vals = [
      r.month + " / " + date(r.date),
      currency(r.payment),
      currency(r.principal),
      currency(r.interest),
      currency(r.insurance),
      currency(r.balance),
    ];
    let height = 0;
    vals.forEach(
      (v, i) =>
        (height = Math.max(height, text(doc, v, xs[i], y, widths[i], 7))),
    );
    y += Math.max(7, height + 2);
  }
  footer(
    doc,
    "Simulação prefixada mensal; CET por dias corridos. Sujeita às condições da instituição.",
  );
  return doc;
}
