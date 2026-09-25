import React, { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;
export default function PdfPreview({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [pageText, setPageText] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    setPage(1);
    setDoc(null);
    setError("");
    setLoading(true);
    const task = getDocument({ url });
    task.promise
      .then((d) => {
        if (active) setDoc(d);
      })
      .catch(() => {
        if (active) {
          setError(
            "Não foi possível visualizar o documento. Você pode baixar o PDF.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      void task.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!doc) return;
    let active = true;
    let task:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    setLoading(true);
    setPageText("");
    void (async () => {
      try {
        const p = await doc.getPage(page);
        if (!active || !canvas.current) return;
        const viewport = p.getViewport({ scale: 1.6 });
        canvas.current.width = Math.ceil(viewport.width);
        canvas.current.height = Math.ceil(viewport.height);
        task = p.render({ canvas: canvas.current, viewport });
        await task.promise;
        if (active) {
          const content = await p.getTextContent();
          setPageText(
            content.items.map((i) => ("str" in i ? i.str : "")).join(" "),
          );
          setLoading(false);
        }
      } catch (e) {
        if (
          active &&
          !(e instanceof Error && e.name === "RenderingCancelledException")
        ) {
          setError("Não foi possível renderizar a página.");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      task?.cancel();
    };
  }, [doc, page]);
  return (
    <section className="pdf-reader" aria-label={title}>
      <div className="module-actions pdf-controls">
        <strong>{title}</strong>
        <button
          disabled={!doc || page <= 1 || loading}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span role="status">
          Página {page} de {doc?.numPages ?? "…"}
        </span>
        <button
          disabled={!doc || page >= (doc?.numPages ?? 0) || loading}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </button>
        <a href={url} download={title + ".pdf"}>
          Baixar PDF
        </a>
      </div>
      {error && (
        <p role="alert" className="module-error">
          {error}
        </p>
      )}
      {loading && <p role="status">Preparando página…</p>}
      <canvas
        ref={canvas}
        role="img"
        aria-label={title + " — página " + page}
      />
      {pageText && (
        <details>
          <summary>Texto acessível desta página</summary>
          <p>{pageText}</p>
        </details>
      )}
    </section>
  );
}
