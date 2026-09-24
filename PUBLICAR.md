# Publicar a LR Capital no Firebase

Guia da versão 0.1 — 24/09/2026. O código está preparado para publicação estática, mas ainda precisa ser conectado ao projeto Firebase e às contas da equipe. Nenhum projeto de produção foi alterado nesta entrega.

## 1. Entender o que pode ficar sem custo

Use **Firebase Hosting**, Authentication com e-mail/senha e Cloud Firestore. Para começar sem cobrança variável, use o plano **Spark** e acompanhe os limites. Não é necessário contratar um novo domínio: o Hosting fornece um endereço `web.app`. Você poderá conectar um subdomínio do seu domínio atual depois.

Limites gratuitos documentados no momento da consulta:

| Serviço | Cota gratuita relevante |
| --- | --- |
| Hosting | 10 GB de armazenamento e 10 GB/mês de transferência |
| Firestore | 1 GiB de dados, 50 mil leituras/dia, 20 mil gravações/dia, 20 mil exclusões/dia e 10 GiB/mês de saída |

As cotas são limitadas e compartilhadas conforme o projeto. A sincronização gera leituras; abrir sessões e manter vários usuários conectados consome a franquia. Uma gravação nesta aplicação grava a operação e o histórico. Regras que consultam documentos também podem gerar leituras. Se o projeto existente usa Blaze, sua cobrança continua sujeita ao consumo: este guia não muda esse plano.

Fontes: [cotas do Hosting](https://firebase.google.com/docs/hosting/usage-quotas-pricing), [preços do Firestore](https://firebase.google.com/docs/firestore/pricing), [planos do Firebase](https://firebase.google.com/pricing).

Esta versão não depende de Cloud Functions, Cloud Run ou upload de anexos. Cloud Storage for Firebase requer Blaze atualmente, mesmo com faixas de uso gratuito; não ativar esse recurso esperando garantia de custo zero. [Requisitos de Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

A integração automática com OpenAI tem consumo de API separado. O modo assistido atual não chama a API. A assinatura do ChatGPT não equivale a créditos de API. [Preços da API](https://developers.openai.com/api/docs/pricing).

## 2. Escolher o ambiente

**Opção A — validação em um projeto Spark separado:** mais simples para testar sem interferir no CRM atual. Crie um projeto no console Firebase, sem habilitar cobrança. Crie o Firestore Standard em modo de produção, com banco `(default)`, e registre um aplicativo Web nas configurações do projeto.

**Opção B — aproveitar seu Firebase atual:** utilize um novo site de Hosting e o caminho `lr_v2_workspaces/lr-capital`, que não coincide com as coleções do sistema anterior. Antes de conectar, é necessário ler e combinar as regras existentes. Uma regra ampla como `match /{document=**}` com acesso liberado pode anular a restrição do novo caminho, porque permissões no Firestore são cumulativas. Não substituir as regras existentes pelo arquivo deste repositório: isso pode bloquear o sistema atual. O banco e as funções existentes permanecem sujeitos às próprias configurações.

O arquivo `firebase.json` contém **somente Hosting** para evitar implantar regras por engano. Os comandos abaixo não apontam automaticamente ao site atual.

## 3. Configurar o aplicativo Web

No console Firebase, em Configurações do projeto → Seus aplicativos → aplicativo Web, copie os valores da configuração pública do SDK.

Duplique `public/firebase-config.example.json` como `public/firebase-config.json` e preencha:

```json
{
  "apiKey": "CHAVE_PUBLICA_DO_APP_WEB_FIREBASE",
  "authDomain": "SEU_PROJETO.firebaseapp.com",
  "projectId": "SEU_PROJETO",
  "appId": "APP_ID_DO_FIREBASE",
  "workspaceId": "lr-capital"
}
```

Esse arquivo é configuração pública do cliente; a segurança é garantida pela autenticação e pelas regras. Ele não aceita chave privada, arquivo de conta de serviço, senha, token Gmail ou chave OpenAI. Foi excluído do Git para evitar misturar ambientes. O build o copiará para o site.

## 4. Preparar o acesso da equipe

1. Em Authentication → Sign-in method, habilite e-mail/senha.
2. Crie as contas da equipe no Authentication. O titular deve definir ou receber acesso à senha pelo fluxo apropriado; não registrar senhas em documentos do Firestore ou no código.
3. Copie o UID de cada conta e crie o documento `lr_v2_workspaces/lr-capital/members/UID_DA_CONTA` com somente os campos:

```json
{ "name": "Nome da pessoa", "role": "admin", "active": true }
```

Use `admin`, `editor` ou `reader`. O primeiro administrador precisa ser cadastrado por quem já tem permissão no console Firebase. Uma conta sem documento ativo não entra na carteira. Todos os membros ativos da equipe enxergam a mesma carteira; `reader` não altera dados. Para revogar acesso, altere `active` para `false` no console.

Não há autoinscrição aberta ou senha administrativa embutida.

## 5. Implantar as regras no ambiente escolhido

**Somente em um projeto novo e dedicado à v2**, copie o conteúdo de `firestore.rules` para a aba Regras do Firestore e publique. O arquivo restringe o acesso à equipe e exige histórico junto de cada alteração.

**No projeto existente**, revisar e mesclar as regras primeiro, conferir regras gerais permissivas e testar a aplicação antiga e a nova. Não execute uma substituição integral. É possível revisar esse conjunto por aqui antes da publicação.

Os testes automáticos usam apenas um emulador e dados fictícios. Ainda será necessário validar o login, as permissões reais e duas sessões com o Firebase escolhido antes de carregar a carteira real.

## 6. Publicar em um site separado

Abra o terminal na pasta do novo CRM. Instale Node.js 24 se necessário. Troque `SEU_PROJETO` pelo ID do Firebase e `NOME_UNICO_DO_SITE_V2` por um nome disponível, diferente do site atual.

```powershell
npm ci
npx firebase-tools@15.31.0 login
npx firebase-tools@15.31.0 projects:list
npx firebase-tools@15.31.0 hosting:sites:create NOME_UNICO_DO_SITE_V2 --project SEU_PROJETO
npx firebase-tools@15.31.0 target:apply hosting lr-v2 NOME_UNICO_DO_SITE_V2 --project SEU_PROJETO
npm test
npm run build
npx firebase-tools@15.31.0 deploy --only hosting:lr-v2 --project SEU_PROJETO
```

O login ocorre no seu navegador. Não é necessário enviar senha ou token nesta conversa. Se o site separado já existir, pule apenas `hosting:sites:create` e aplique o destino ao site correto.

O comando final publica somente a interface no destino `lr-v2`. O endereço será apresentado no resultado. Se aparecer a tela “Conecte o ambiente da equipe”, falta o arquivo `public/firebase-config.json` no build. Preencha, gere novamente e publique.

O servidor de prévia e seu banco local **não são publicados**. O site publicado precisa do Firebase; os exemplos fictícios não são importados automaticamente.

Em Authentication → Settings → Authorized domains, confira o domínio de acesso; inclua o domínio personalizado se for adotado. Não altere os apontamentos do site atual enquanto a v2 estiver em validação.

## 7. Conferir antes de uso real

- Entrar como administrador, editor e leitor. Confirmar que leitor não consegue salvar.
- Abrir em duas contas/abas: criar uma operação de teste em uma e observar a atualização na outra.
- Editar a mesma operação nas duas sessões: a edição desatualizada deve ser recusada.
- Fechar e reabrir: dados e histórico devem continuar presentes.
- Desativar uma conta de teste e confirmar a perda de acesso.
- Conferir no Firebase os erros e o consumo de leituras/gravações.

A versão 0.2 importa o arquivo do pipeline para consulta e deriva cadastros de bancos/gerentes **somente na prévia local**. A migração para o Firebase continua pendente e deve preservar origem, IDs, valores solicitados/aprovados, responsáveis e relacionamentos, com relatório de conferência. Não copie dados reais para arquivos do GitHub. A exportação da tela é limitada ao conjunto carregado e não substitui backup do banco.

As regras da versão 0.2 incluem `directory` e `directoryEvents`, necessários para as telas de bancos/gerentes. Cadastros individuais são gravados com histórico e versão, e o servidor recusa gerente vinculado a uma instituição inexistente. Antes de atualizar um ambiente Firebase, homologar esse conjunto de regras conforme a seção 5. O arquivo bruto importado para comparação não é publicado nem sincronizado com o Firebase nesta versão.

## 8. Atualizações depois da primeira publicação

Faça alterações no novo repositório, confira a prévia e os testes do GitHub. Depois, com a configuração local preservada:

```powershell
npm ci
npm test
npm run build
npx firebase-tools@15.31.0 deploy --only hosting:lr-v2 --project SEU_PROJETO
```

O Firebase Hosting mantém histórico de versões da interface e permite reverter uma publicação pelo console. Isso não reverte alterações do banco. A automação deste repositório verifica o código; ela não publica automaticamente nem recebe credenciais de produção.

## Próximo passo para IA automática

Adicionar um serviço autenticado que valide o usuário Firebase, consulte apenas a equipe permitida, chame a OpenAI com chave no servidor e devolva propostas estruturadas. Alterações precisam passar pela mesma validação e controle de versão. Envio de mensagens, exclusões e decisões de crédito exigem fluxos próprios de revisão. O custo de modelo e hospedagem desse serviço deve ser definido antes da ativação.
