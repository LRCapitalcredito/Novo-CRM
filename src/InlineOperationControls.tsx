import { useRef, useState } from "react";
import { products, stages, type Operation, type Product, type Stage } from "./domain";
import { stageTone } from "./portfolio";
import type { Repository } from "./repository";

export function InlineOperationControls({ op, repo, canEdit, notify }: { op: Operation; repo: Repository; canEdit: boolean; notify: (text: string) => void }) {
  const lock = useRef(false);
  const [pending, setPending] = useState<{ stage: Stage; product: Product } | null>(null);
  const [error, setError] = useState("");
  async function change(field: "stage" | "product", value: string) {
    if (lock.current || !canEdit || op[field] === value) return;
    lock.current = true;
    const next = { ...op, [field]: value };
    setPending(next);
    setError("");
    try {
      // A versão impede que uma linha antiga sobrescreva a edição de outra pessoa.
      await repo.save(next, op.version);
      notify(`${field === "stage" ? "Status" : "Modalidade"} de ${op.company} salvo: ${value}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
    } finally { setPending(null); lock.current = false; }
  }
  return <div className="inline-operation" aria-busy={!!pending}>
    <select aria-label={`Status de ${op.company}`} className={`inline-status status-${stageTone(pending?.stage ?? op.stage)}`} value={pending?.stage ?? op.stage} disabled={!canEdit || !!pending} onChange={(e) => void change("stage", e.target.value)}>
      {stages.map((s) => <option key={s}>{s}</option>)}
    </select>
    <select aria-label={`Modalidade de ${op.company}`} className="inline-product" value={pending?.product ?? op.product} disabled={!canEdit || !!pending} onChange={(e) => void change("product", e.target.value)}>
      {products.map((p) => <option key={p} value={p}>{p === "Não informado" ? "Modalidade a classificar" : p}</option>)}
    </select>
    {pending && <small role="status">Salvando…</small>}
    {error && <small role="alert" className="inline-save-error">{error}</small>}
  </div>;
}
