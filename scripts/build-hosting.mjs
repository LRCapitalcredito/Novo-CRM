import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Keep the local preview disconnected from the shared validation database.
const raw = JSON.parse(readFileSync('.local-data/firebase-config.json', 'utf8').replace(/^\uFEFF/, ''));
const { projectId, appId, apiKey, authDomain } = raw;
if (projectId !== 'lr-capital-crm-v2-2026' || !appId || !apiKey || authDomain !== `${projectId}.firebaseapp.com`) {
  throw Error('Configuração ausente ou destinada a outro projeto. Confira PUBLICAR.md.');
}
if (!process.env.npm_execpath) throw Error('Execute por npm run build:hosting.');
execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { stdio: 'inherit' });
writeFileSync('dist/firebase-config.json', JSON.stringify({ projectId, appId, apiKey, authDomain: `${projectId}.web.app`, workspaceId: 'lr-capital', passwordLoginEnabled: false }, null, 2));
console.log('Interface gerada para o ambiente de validação. A prévia local permanece independente.');
