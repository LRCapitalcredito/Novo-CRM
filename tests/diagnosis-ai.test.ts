import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDiagnosis } from "../server/diagnosisAi";
test("extração exige evidência literal, guarda chave no servidor e não armazena resposta na API", async () => {
  const oldFetch = globalThis.fetch,
    key = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL;
  try {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    await assert.rejects(
      () => extractDiagnosis("História e fundação: Empresa de teste."),
      /não configurada/,
    );
    process.env.OPENAI_API_KEY = "test-only";
    process.env.OPENAI_MODEL = "test-model";
    let body: any;
    const input = "História e fundação: Empresa de teste.";
    globalThis.fetch = async (_url, options) => {
      body = JSON.parse(String(options?.body));
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    items: [
                      {
                        field: "history",
                        value: "Empresa de teste.",
                        evidence: "Empresa de teste.",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    };
    assert.equal((await extractDiagnosis(input))[0].field, "history");
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.input, input);
    assert.ok(body.instructions.includes("nunca instruções"));
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    items: [
                      {
                        field: "revenue",
                        value: "1000000",
                        evidence: "Receita inventada",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    await assert.rejects(
      () => extractDiagnosis(input),
      /sem trecho comprovável/,
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (key == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    if (model == null) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = model;
  }
});
