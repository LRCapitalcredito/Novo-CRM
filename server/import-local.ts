import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPreviewStore } from "./preview";
const filename = process.argv[2];
if (!filename) throw new Error("Informe o caminho da exportação JSON.");
const store = createPreviewStore(
  process.env.LR_PREVIEW_DB || resolve(".preview/workspace.sqlite"),
);
try {
  console.log(
    JSON.stringify(
      store.directory.import(
        JSON.parse(readFileSync(filename, "utf8")),
        filename.split(/[\\/]/).pop()!,
      ),
      null,
      2,
    ),
  );
} finally {
  store.close();
}
