import { parseMoney } from "./domain";

export const warrantyKinds = [
  "Imóveis (Geral)",
  "Imóvel Urbano",
  "Imóvel Rural",
  "Imóvel Operacional",
  "Veículos Leves",
  "Veículos Pesados",
  "Recebíveis",
  "Contratos",
  "Aplicação Financeira",
  "Aval / Fiador",
  "Estoque",
  "FGI / Limpa",
  "Safra",
  "Câmbio",
  "Universal",
] as const;
export const statesBR = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
export const scopes = {
  "": "Não informado",
  city: "Apenas cidade",
  radius: "Raio de distância",
  states: "Estados específicos",
  national: "Nacional",
};
export type Warranty = {
  rate: string;
  termMonths: number | null;
  ltvPercent: number | null;
};
type Base = {
  id: string;
  name: string;
  notes: string;
  source: string;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Bank = Base & {
  kind: "bank";
  type: string;
  color: string;
  logoUrl: string;
  acceptsRestriction: boolean | null;
  guarantees: Record<string, Warranty>;
};
export type Manager = Base & {
  kind: "manager";
  bankId: string;
  minRevenueCents: number | null;
  maxRevenueCents: number | null;
  email: string;
  phone: string;
  city: string;
  state: string;
  serviceScope: keyof typeof scopes;
  radiusKm: number | null;
  servedStates: string[];
};
export type DirectoryRecord = Bank | Manager;
export type DirectoryInput =
  | Omit<Bank, "version" | "createdAt" | "updatedAt">
  | Omit<Manager, "version" | "createdAt" | "updatedAt">;
export type DirectoryEvent = {
  id: string;
  entityId: string;
  kind: "bank" | "manager";
  name: string;
  actor: string;
  at: string;
  version: number;
  changes: string[];
};
export type ImportSummary = {
  id: string;
  filename: string;
  at: string;
  counts: Record<string, number>;
  banksCreated: number;
  managersCreated: number;
  unidentifiedLinks: number;
  notes: string[];
};
export type DirectoryState = {
  records: DirectoryRecord[];
  events: DirectoryEvent[];
  imports: ImportSummary[];
};
export const emptyDirectory: DirectoryState = {
  records: [],
  events: [],
  imports: [],
};
export function newBank(): DirectoryInput {
  return {
    id: crypto.randomUUID(),
    kind: "bank",
    name: "",
    type: "",
    color: "#18334a",
    logoUrl: "",
    acceptsRestriction: null,
    guarantees: {},
    notes: "",
    source: "Cadastro manual",
    archived: false,
  };
}
export function newManager(bankId = ""): DirectoryInput {
  return {
    id: crypto.randomUUID(),
    kind: "manager",
    name: "",
    bankId,
    minRevenueCents: null,
    maxRevenueCents: null,
    email: "",
    phone: "",
    city: "",
    state: "",
    serviceScope: "",
    radiusKm: null,
    servedStates: [],
    notes: "",
    source: "Cadastro manual",
    archived: false,
  };
}
const obj = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validateDirectory(raw: unknown): DirectoryInput {
  if (!obj(raw) || !["bank", "manager"].includes(raw.kind))
    throw new Error("Cadastro inválido.");
  const text = (key: string, max: number) => {
    if (typeof raw[key] !== "string" || raw[key].length > max)
      throw new Error(`Campo inválido: ${key}.`);
    return raw[key].trim();
  };
  const number = (v: unknown, max: number, integer = false) => {
    if (v === null) return null;
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < 0 ||
      v > max ||
      (integer && !Number.isSafeInteger(v))
    )
      throw new Error("Valor numérico inválido.");
    return v;
  };
  const base = {
    id: text("id", 100),
    name: text("name", 160),
    notes: text("notes", 12000),
    source: text("source", 300),
    archived: raw.archived,
  };
  if (
    !/^[\w-]{6,100}$/.test(base.id) ||
    !base.name ||
    typeof base.archived !== "boolean"
  )
    throw new Error("Preencha nome e identificação válidos.");
  if (raw.kind === "bank") {
    const color = text("color", 7),
      logoUrl = text("logoUrl", 2000);
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Cor inválida.");
    if (logoUrl && !/^https:\/\/[^\s]+$/i.test(logoUrl))
      throw new Error("A logo deve usar um endereço HTTPS.");
    if (![true, false, null].includes(raw.acceptsRestriction))
      throw new Error("Informe a política de restrição.");
    if (!obj(raw.guarantees) || Object.keys(raw.guarantees).length > 15)
      throw new Error("Garantias inválidas.");
    const guarantees: Record<string, Warranty> = {};
    for (const [key, g] of Object.entries(raw.guarantees)) {
      if (
        !warrantyKinds.includes(key as any) ||
        !obj(g) ||
        typeof g.rate !== "string" ||
        g.rate.length > 80
      )
        throw new Error("Condição de garantia inválida.");
      guarantees[key] = {
        rate: g.rate.trim(),
        termMonths: number(g.termMonths, 600, true),
        ltvPercent: number(g.ltvPercent, 100),
      };
    }
    return {
      ...base,
      kind: "bank",
      type: text("type", 100),
      color,
      logoUrl,
      acceptsRestriction: raw.acceptsRestriction,
      guarantees,
    };
  }
  const bankId = text("bankId", 100),
    email = text("email", 180),
    state = text("state", 2),
    city = text("city", 120);
  if (!/^[\w-]{6,100}$/.test(bankId))
    throw new Error("Selecione a instituição do gerente.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("E-mail inválido.");
  if (state && !statesBR.includes(state)) throw new Error("UF inválida.");
  if (
    !Object.hasOwn(scopes, raw.serviceScope) ||
    !Array.isArray(raw.servedStates) ||
    raw.servedStates.some(
      (s: unknown) => typeof s !== "string" || !statesBR.includes(s),
    )
  )
    throw new Error("Alcance de atendimento inválido.");
  const minRevenueCents = number(raw.minRevenueCents, 1e15, true),
    maxRevenueCents = number(raw.maxRevenueCents, 1e15, true),
    radiusKm = number(raw.radiusKm, 20000);
  if (
    minRevenueCents !== null &&
    maxRevenueCents !== null &&
    minRevenueCents > maxRevenueCents
  )
    throw new Error("O faturamento máximo deve ser maior ou igual ao mínimo.");
  if (raw.serviceScope === "radius" && (!radiusKm || !city || !state))
    throw new Error("Informe cidade, UF e raio de atendimento.");
  if (raw.serviceScope === "states" && !raw.servedStates.length)
    throw new Error("Selecione os estados atendidos.");
  return {
    ...base,
    kind: "manager",
    bankId,
    email,
    phone: text("phone", 40),
    city,
    state,
    serviceScope: raw.serviceScope,
    radiusKm,
    servedStates: [...new Set(raw.servedStates)] as string[],
    minRevenueCents,
    maxRevenueCents,
  };
}
export function directoryChanges(
  old: DirectoryRecord | null,
  next: DirectoryInput,
): string[] {
  return Object.keys(next).filter(
    (k) =>
      !["id", "kind"].includes(k) &&
      stableValue(old?.[k as keyof DirectoryRecord]) !==
        stableValue((next as any)[k]),
  );
}
function stableValue(value:unknown){return JSON.stringify(value,(_key,item)=>obj(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);}
export function whatsappUrl(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return /^55\d{10,11}$/.test(digits) ? `https://wa.me/${digits}` : null;
}
export function legacyMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      !Number.isSafeInteger(Math.round(value * 100))
    )
      throw new Error("Valor inválido na origem.");
    return Math.round(value * 100);
  }
  return parseMoney(String(value));
}

export const legacyTables = [
  "metadata",
  "clientes",
  "operacoes",
  "instituicoes_operacao",
  "garantias",
  "documentos",
  "historico",
  "erros_validacao",
] as const;
export type LegacyDataset = Record<
  (typeof legacyTables)[number],
  Record<string, unknown>[]
>;
export function validateDataset(raw: unknown): LegacyDataset {
  if (
    !obj(raw) ||
    !Array.isArray(raw.clientes) ||
    !Array.isArray(raw.operacoes) ||
    !Array.isArray(raw.instituicoes_operacao)
  )
    throw new Error("Use a exportação JSON do Pipeline LR Capital.");
  const result = {} as LegacyDataset;
  for (const table of legacyTables) {
    const rows = raw[table] ?? [];
    if (
      !Array.isArray(rows) ||
      rows.length > 15000 ||
      rows.some((r) => !obj(r))
    )
      throw new Error(`Tabela inválida: ${table}.`);
    result[table] = rows;
  }
  return result;
}
