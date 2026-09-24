# LR Capital · Novo CRM

Primeira versão funcional do novo ambiente interno da LR Capital, com carteira de operações, próximos passos e histórico. Construída com React, TypeScript e Firebase. Este repositório contém somente código novo e exemplos fictícios; não contém o histórico do sistema anterior, credenciais ou a carteira real.

## Experimentar antes de publicar

Instale o Node.js 24. Na pasta do projeto:

```powershell
npm ci
npm run dev
```

Abra http://127.0.0.1:5174. A prévia inicial usa empresas fictícias, grava alterações em `.preview/workspace.sqlite` e sincroniza as abas deste computador. Esse banco é apenas para avaliação, sem login real, e não é enviado para o site publicado. Para mudar sua localização, defina `LR_PREVIEW_DB` antes de iniciar. Mantenha o servidor restrito a `127.0.0.1`.

A configuração Firebase, quando presente, tem prioridade também durante o desenvolvimento. Confira o aviso de ambiente antes de editar dados.

## O que funciona nesta entrega

- Bancos e instituições: nome, tipo, cor, endereço da logo, aceitação de restrição e condições por garantia (taxa, prazo e LTV).
- Gerentes: vínculo com instituição, faixa de faturamento, e-mail, WhatsApp, cidade/UF, alcance nacional, por estados, cidade ou raio.
- Busca, filtros, ordenação numérica de faturamento, arquivamento reversível e histórico dos campos alterados nos cadastros.
- Base recebida: importação local idempotente do JSON do pipeline, com consulta paginada de todas as tabelas originais. Dados reais permanecem no banco local e não entram neste repositório.
- Carteira com busca, filtros, etapas, responsáveis e próximos passos.
- Cadastro e edição de operações; valores solicitados e aprovados separados, em centavos.
- Agenda de retornos, indicadores e histórico de alterações.
- Controle de versão que recusa sobrescritas concorrentes.
- Exportação JSON dos registros carregados, com indicação da versão do formato.
- Adaptador Firebase Authentication + Firestore para login e sincronização entre usuários após configuração.
- Regras de acesso por equipe: administrador, editor e leitor. Operação e histórico são gravados juntos.
- Assistente em modo manual: copiar contexto para uma conversa no ChatGPT/Codex e revisar uma proposta JSON antes de aplicá-la.
- Verificação automática de compilação, valores, persistência e regras de acesso a cada atualização no GitHub.

## Limites atuais

É uma base funcional para evolução, ainda sem equivalência completa com o sistema anterior. A importação preserva a carteira antiga para consulta e deriva cadastros de bancos/gerentes dos vínculos, sem transformar as operações antigas nos novos fluxos. Não há migração para o Firebase real, anexos, Gmail, envio automático de mensagens, simulações bancárias, gestão de garantias de clientes ou portal externo. O faturamento da operação existe no modelo, mas ainda não tem editor na tela.

O JSON do pipeline não substitui a exportação das bases completas de bancos e gerentes. Critérios, contatos e taxas ausentes não recebem valores presumidos. A aplicação não interpreta textos dos arquivos como comandos. E-mails de exemplo exibidos como placeholders não devem ser cadastrados como contatos reais. Logs dos novos cadastros registram autor, momento, versão e nomes dos campos alterados; não são um backup com restauração de versões.

Na prévia, use **Base recebida → Importar JSON** para conferir os totais e confirmar a importação. Arquivos de até 8 MB ficam somente no SQLite local, fora da pasta pública. A importação em lote ainda não está disponível no Firebase; as telas de bancos e gerentes possuem gravação individual autenticada preparada para esse ambiente.

O assistente não faz chamadas à OpenAI nem mantém uma conversa automática dentro do CRM. O usuário escolhe o contexto que levará à conversa. Para uma integração automática será necessário um serviço autenticado no servidor, chave protegida, limite de consumo e registro de ações; nunca uma chave no navegador.

No Firebase, esta versão acompanha até **250 operações recentes e 100 eventos recentes**. Busca, indicadores e exportação se referem a esse conjunto, não a um backup completo. Antes de ultrapassar esse volume, implementar paginação, busca e totais no servidor. Os registros antigos permanecem no banco.

Todos os membros ativos de uma equipe podem visualizar suas operações. Editores e administradores podem criar/alterar; leitores consultam. Ainda não existe restrição por responsável nem tela de administração de membros. Não há exclusão pela aplicação.

## Publicar

Siga [PUBLICAR.md](PUBLICAR.md). O arquivo `firebase.json` publica apenas Hosting em um destino separado chamado `lr-v2`. Ele não implanta regras nem modifica automaticamente o site existente. O build sem configuração mostra uma tela de configuração, sem os dados fictícios.

Para usar o Firebase atual, primeiro revisar suas regras: uma permissão geral existente pode liberar a nova coleção mesmo quando adicionamos regras mais restritivas. Uma nova coleção não representa isolamento de segurança por si só. Alternativamente, usar um projeto Spark separado durante a validação.

## Verificações

```powershell
npm test
npm run build
```

Com Java 21 instalado, as regras podem ser testadas localmente sem acessar um projeto real:

```powershell
npx --yes firebase-tools@15.31.0 emulators:exec --project demo-lr-capital-v2 --config firebase.test.json --only firestore "node --test tests/firestore.rules.integration.mjs"
```

O mesmo comando é executado pelo GitHub Actions. Uma verificação verde no emulador não substitui a homologação do projeto real, dos usuários e das regras combinadas com as do sistema antigo.

## Organização

| Área | Arquivo/pasta |
| --- | --- |
| Interface | `src/main.tsx`, `src/styles.css` |
| Valores, validações e propostas | `src/domain.ts` |
| Persistência de produção | `src/firebaseRepository.ts` |
| Prévia local persistente | `server/preview.ts` |
| Permissões de produção | `firestore.rules` |
| Verificações automáticas | `tests/`, `.github/workflows/ci.yml` |

## Próximas entregas

1. Conectar um ambiente Firebase de homologação e validar duas contas em computadores diferentes.
2. Preparar importação revisável dos dados antigos, preservando IDs, valores e vínculos.
3. Completar campos e fluxos de garantias, recebíveis e documentos conforme a rotina da equipe.
4. Implementar o assistente automático e as integrações de e-mail com orçamento definido.

O desenvolvimento por aqui permite revisar a prévia antes de cada publicação. As atualizações ficam registradas neste repositório.
