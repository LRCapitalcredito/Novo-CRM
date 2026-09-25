import React, { useState } from "react";
import { validateRecord, type WorkspaceRecord } from "./records";
import type { Repository } from "./repository";
export default function TemplateTools({
  record,
  repo,
  notify,
}: {
  record?: WorkspaceRecord;
  repo: Repository;
  notify: (s: string) => void;
}) {
  const [error, setError] = useState(""),
    [candidate, setCandidate] = useState<any>(null),
    [busy, setBusy] = useState(false);
  if (repo.session?.role !== "admin") return null;
  return (
    <details>
      <summary>Modelo padrão da LR Capital</summary>
      <p className="small-note">
        Modelo privado, compartilhado entre os contratos desta base. Exporte
        para guardar uma cópia ou carregar no novo ambiente após a configuração.
        Revise as cláusulas antes de substituir.
      </p>
      <div className="module-actions">
        {record && (
          <button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(record.data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "modelo-contrato-LR-privado.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Exportar modelo privado
          </button>
        )}
        <label className="field">
          Carregar modelo JSON
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (e) => {
              setError("");
              setCandidate(null);
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 500000) throw new Error("Modelo muito grande.");
                const data = JSON.parse(await file.text());
                validateRecord({
                  id: "contract-template",
                  kind: "template",
                  operationId: "",
                  data,
                });
                setCandidate(data);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Arquivo inválido.");
              }
            }}
          />
        </label>
      </div>
      {candidate && (
        <div className="module-card">
          <h3>Modelo para revisão</h3>
          <p>
            {candidate.issuer} · {candidate.issuerDocument}
          </p>
          {candidate.sections.map((s: any, i: number) => (
            <details key={i}>
              <summary>{s.heading}</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{s.text}</p>
            </details>
          ))}
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await repo.saveRecord(
                  {
                    id: "contract-template",
                    kind: "template",
                    operationId: "",
                    data: candidate,
                  },
                  record?.version ?? null,
                );
                setCandidate(null);
                notify("Modelo padrão atualizado.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha ao salvar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Aplicar modelo revisado
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="module-error">
          {error}
        </p>
      )}
    </details>
  );
}
