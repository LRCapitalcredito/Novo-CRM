# Publicar e atualizar a LR Capital

Versão 0.7 · 26/09/2026.

## Ambiente disponível

- Endereço: https://lr-capital-crm-v2-2026.web.app
- Projeto dedicado: `lr-capital-crm-v2-2026`.
- Firebase Spark, sem conta de cobrança vinculada. Firestore Standard em São Paulo (`southamerica-east1`), banco `(default)`, com franquia gratuita e atualização em tempo real.
- Acesso pelo botão **Entrar com Google**, usando uma conta autorizada. A conta comercial informada pelo titular foi habilitada como administradora; não foi criada senha.
- O projeto, site e base anteriores não foram alterados. A prévia local usa seu próprio SQLite e não recebe as alterações feitas online.

A migração inicial copiou 165 clientes, 936 vínculos com instituições, 61 bancos e 80 gerentes, além dos cadastros complementares e históricos disponíveis. Os 1.565 documentos gravados foram conferidos campo a campo, incluindo o membro inicial. Nenhum arquivo de cliente foi colocado no Hosting ou no GitHub. O banco bloqueia consultas sem autenticação e exige membro ativo para a carteira.

O arquivo bruto da importação permanece apenas na prévia local. A exportação da interface abrange o estado carregado e não substitui backup completo do banco.

## Atualizar a interface publicada

Use Node.js 24 e execute os comandos na pasta deste repositório. O login é feito no navegador; não cole códigos ou senhas em arquivos do projeto.

Na primeira preparação desta máquina:

```powershell
npm ci
npx firebase-tools@15.31.0 login
New-Item -ItemType Directory -Path .local-data -Force
npx firebase-tools@15.31.0 apps:sdkconfig WEB '1:1073352483145:web:20e757b6f6f4ca4d827a98' --project lr-capital-crm-v2-2026 --out .local-data/firebase-config.json
```

Para cada atualização:

```powershell
npm test
npm run build:hosting
npx firebase-tools@15.31.0 deploy --only hosting --config firebase.validation.json --project lr-capital-crm-v2-2026
```

O comando `build:hosting` valida o projeto e coloca a configuração pública apenas na pasta gerada `dist`. Assim, `npm run dev` continua abrindo a prévia local, sem conectar acidentalmente os testes à carteira compartilhada. A pasta `.local-data` é ignorada pelo Git. Não inserir credenciais de serviço, chaves OpenAI ou senhas nessa configuração.

O site usa login com redirecionamento na mesma aba. O domínio `web.app` é também o `authDomain`, evitando depender de pop-ups e armazenamento entre domínios. Os retornos autorizados estão em `firebase.validation.json`. Se houver mudança de domínio, atualizar também a configuração do provedor Google e os domínios autorizados no Authentication.

A integração do GitHub verifica o código e as regras; não publica automaticamente. O Firebase Hosting guarda versões da interface que podem ser revertidas pelo console. Reverter a interface não desfaz edições no banco.

## Acesso dos sócios

Cada pessoa deve usar sua própria conta Google para que as alterações sejam identificadas. Entrar com Google cria a identidade no Authentication, mas não libera a carteira por si só.

Após a primeira tentativa de entrada da conta autorizada pelo administrador, copie seu UID em Authentication e crie `lr_v2_workspaces/lr-capital/members/UID` com somente:

```json
{ "name": "Nome da pessoa", "role": "editor", "active": true }
```

Papéis: `admin`, `editor` e `reader`. O leitor não grava alterações. Para revogar, defina `active` como `false`. Não distribua senha da conta comercial nem crie acesso para e-mails não autorizados. A tela da aplicação ainda não administra convites; esse cadastro é feito no console Firebase.

## Banco e regras

As regras exigem equipe ativa, validação de campos, versão da edição e histórico no mesmo salvamento. Não publicar regras abertas para facilitar login. A atualização inicial da carteira aguarda os seis conjuntos de dados antes de exibir os controles.

Quando houver mudança nas regras, execute os testes do emulador antes de implantar:

```powershell
npx firebase-tools@15.31.0 emulators:exec --project demo-lr-capital-v2 --config firebase.test.json --only firestore "node --test tests/firestore.rules.integration.mjs"
npx firebase-tools@15.31.0 deploy --only firestore:rules --config firebase.validation.json --project lr-capital-crm-v2-2026
```

O emulador exige Java 21. O arquivo `firebase.validation.json` aponta explicitamente para este ambiente novo. Não usar suas regras para substituir as regras do sistema antigo.

## O que é gratuito e os limites atuais

Hosting: 10 GB de armazenamento e 10 GB/mês de transferência. Firestore: 1 GiB, 50 mil leituras/dia e 20 mil gravações/dia, dentro da franquia aplicável. Aberturas da carteira e atualizações em tempo real consomem leituras. Permanecer no Spark evita cobrança variável, mas exceder uma cota pode interromper o serviço; acompanhe o consumo no console.

Fontes oficiais: [Hosting](https://firebase.google.com/docs/hosting/usage-quotas-pricing), [Firestore](https://firebase.google.com/docs/firestore/pricing), [planos](https://firebase.google.com/pricing).

- **Documentos online:** checklist, exigências, conferência, prazos e links de arquivos são compartilhados. O upload binário disponível na prévia continua local. No ambiente gratuito publicado, use links de pastas/arquivos com permissões apropriadas; o sistema não altera essas permissões. Cloud Storage for Firebase requer Blaze e não foi ativado. [Requisitos de Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
- **WhatsApp e e-mail:** o sistema prepara a mensagem e abre o aplicativo. A pessoa revisa e conclui o envio; não há disparos em segundo plano, leitura da caixa de mensagens ou cobrança de WhatsApp Business API.
- **Pedidos do gerente:** sugestões locais por palavras-chave, com revisão obrigatória. Não interpreta sozinho conversas recebidas.
- **IA automática:** a extração por API disponível no servidor local não é publicada neste Hosting estático. O fluxo assistido e o preenchimento manual continuam disponíveis. Um serviço de IA autenticado e seu orçamento precisam ser configurados separadamente.

## Conferência operacional

Teste a mesma carteira em duas sessões, confira o registro do histórico e a proteção contra edição desatualizada. Cadastros de teste devem ficar separados da carteira real. Para começar o uso da equipe, cadastre os e-mails individuais dos sócios e combine quem confere cada documento e quem registra os retornos das instituições.
