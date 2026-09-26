# LR Capital · Novo CRM

Versão 0.11: carteira, atuação por instituição, bancos, gerentes, contratos, simulador, diagnóstico financeiro e acompanhamento documental. React + TypeScript; prévia independente com SQLite; ambiente compartilhado com Firebase. Este repositório contém código, imagens institucionais e testes fictícios. Carteira real, PDFs recebidos, modelo privado de contrato e credenciais ficam fora do Git.

Ambiente de validação: https://lr-capital-crm-v2-2026.web.app — login Google e autorização por membro da equipe. Consulte [PUBLICAR.md](PUBLICAR.md) para atualizações. O sistema anterior permanece independente.

### Contatos, documentação e atuação

- Status e atuação da instituição editáveis na linha, com controle de versão. Encerrar/pausar continua possível em vínculos antigos com divergências; reativar exige nova conferência.
- Logos fornecidas pela equipe em `public/institutions`, com nomes e aliases explícitos. CNPJ copiável sem pontuação e pesquisável nos dois formatos.
- Pasta do Google Drive por cliente, com validação do endereço e confirmação de identidade. Sugestões privadas podem ser armazenadas no perfil; não há sincronização contínua nem leitura automática dos arquivos. As permissões do Drive são preservadas.
- WhatsApp do gerente com saudação, cliente, CNPJ e pasta atual. Exige revisão antes de abrir a conversa, bloqueia o encaminhamento pela interface quando existem divergências e não registra envio presumido.
- Conferência de garantias, restrições, faturamento anual, cidade/UF, raio informado e segmentos do gerente. Instituições sem divergência aparecem primeiro no seletor. Ausências permanecem “Dados a confirmar”; não são aprovação ou política presumida.
- Novos vínculos, trocas de instituição/gerente e reativações com incompatibilidade comprovada são recusados. O fluxo oferece correção do cliente, da política do banco ou do target do gerente; revisão da política exige registrar a origem da confirmação. Um raio entre cidades precisa de distância e fonte explícitas.
- A regra comercial roda na interface, na transação SQLite e na transação do repositório Firebase, relendo os dados atuais. As regras Firestore protegem acesso, versão e auditoria; não interpretam o JSON comercial. Portanto, a validação comercial não é uma barreira contra clientes SDK modificados por membros autorizados. Critérios seguem os cadastros da equipe, sem consulta automática a políticas oficiais de bancos.

- WhatsApp e e-mail na carteira e no acompanhamento: revise uma mensagem casual já preparada com os documentos que faltam. O envio final acontece no aplicativo escolhido; abrir a conversa não registra um envio fictício.
- Documentação mínima conforme as frentes do cliente. Itens recebidos ainda precisam ser conferidos; dispensas exigem justificativa. A falta de checklist não produz um indicador de documentação completa.
- Pedidos dos gerentes: cole a solicitação, revise os documentos e períodos sugeridos por palavras-chave e registre as exigências na instituição correta. O pedido original fica guardado. Pedidos repetidos não duplicam o mesmo documento/período dentro da instituição.
- Botões para situação de restrição e múltiplas frentes de atuação. As classificações alimentam os filtros e o checklist, sem inferir aprovação de crédito.
- Proteção contra edições concorrentes, inclusive na classificação. A primeira carga do Firebase aguarda os seis conjuntos de dados antes de exibir a carteira.

### Documentos e acompanhamento

A aba **Acompanhamento** organiza o trabalho por cliente. Na carteira, abra a linha do cliente e escolha **Documentos e acompanhamento**.

1. **Preparar checklist:** sugestões selecionáveis para captação de crédito, antecipação de recebíveis e home equity, com entidade, competência, responsável, prazo e exigência. É uma base editável a confirmar com cada instituição. Repetir a preparação não duplica nem sobrescreve os itens existentes.
2. **Receber e conferir:** anexe um documento por item (PDF, PNG, JPG, DOCX ou XLSX, até 10 MB), ou registre um link HTTPS. Arquivos complementares devem ter itens próprios; a última versão é a selecionada no envio. Recebido, em conferência, conferido, a corrigir e dispensado são situações distintas. Conferência/dispensa exige justificativa; documentos vencidos não entram em novos envios. Assinatura observada não equivale a validação digital.
3. **Encaminhar ao gerente:** selecione a instituição vinculada e os documentos conferidos. Prepare a mensagem, encaminhe pelo canal habitual e registre o envio realizado. O registro preserva destinatário, canal, data, versão do cadastro e arquivo selecionado. O arquivo daquela remessa pode ser baixado novamente, mesmo após uma nova versão documental.
4. **Cobrar retorno:** registre responsável, próximo passo, prazo e resposta. Alterações mantêm o conteúdo de cada versão no histórico recente, sem apagar respostas anteriores. Crie tarefas que dependem da LR Capital, do cliente/contador ou da instituição. Concluir uma tarefa exige data e resultado.
5. **Atualizar o cliente:** gere um texto editável com etapa, situação documental, encaminhamentos e próximos passos. Os botões preparam textos para revisão e cópia; não enviam mensagens nem atribuem aprovação de crédito.

**Próximas ações** reúne compromissos da carteira, documentos, instituições, tarefas e envios, com filtros por atraso, hoje, próximos dias, sem prazo, responsável e dependência. O radar da carteira incorpora os novos prazos sem duplicar o cliente. Nenhum checklist é criado automaticamente nos clientes reais.

**Armazenamento:** anexos ficam como bytes originais no SQLite da prévia, com identificação SHA-256 e versões preservadas. A verificação do formato é de compatibilidade, não análise de conteúdo ou assinatura. O download preserva o arquivo original. A exportação JSON não inclui os arquivos: faça backup do banco local (com a aplicação fechada, ou via backup consistente do SQLite). Arquivar um item preserva seus anexos. Não há exclusão de arquivo pela interface.

No Firebase, os cadastros, links, tarefas e registros de envio usam a sincronização existente. **O armazenamento de arquivos em nuvem ainda não está conectado**; a interface informa essa limitação e aceita links de um repositório documental já autorizado. Publicar o site não transfere os arquivos locais. O histórico exibido é o conjunto dos 400 eventos mais recentes da equipe, não uma pesquisa histórica ilimitada.

### Edição e condições por modalidade

- Status e modalidade editáveis diretamente na carteira. O nome abre os vínculos; as seleções salvam com confirmação e histórico. Uma versão desatualizada é recusada sem sobrescrever outras alterações.
- Carteiras de captação, recebíveis, home equity e outras possibilidades consideram a classificação do cliente e das propostas. Um cliente pode aparecer em mais de uma; o total geral não duplica cadastros. O texto legado não é interpretado como uma classificação confiável.
- Em cada instituição, **Abrir → Condições da proposta** permite informar modalidade, taxa mensal e prazo.
- Recebíveis: limite, utilização em aberto, volume de uma competência e comissão percentual. Disponível = limite menos utilização; pode ser negativo e recebe alerta. Comissão estimada = volume da competência × percentual, arredondada a centavos, sem reconhecer receita recebida. O formulário mantém a competência atual; mudanças ficam auditadas, mas não constitui um extrato mensal.
- Home equity: avaliação do imóvel e LTV calculado sobre o aprovado, ou solicitado quando o aprovado está ausente. Garantia ausente/zero não produz índice. A relação não determina elegibilidade nem aprovação.
- Campos desconhecidos ficam vazios. Taxas e prazo são condições informadas, não CET ou ofertas bancárias.

### Visualização e rotina

- Identidade em grafite, dourado e superfícies claras. Capa com fotografia ilustrativa separada dos textos; nomes e cargos ficam ao lado ou abaixo dos retratos. Fotografia gerada por IA, otimizada em WebP; [origem e prompt](docs/visual-identity.md).
- Logo oficial no acesso, menu e ícone do navegador. Retratos de Ricardo Reis, Lucas Macedo e Giovani Moura de Souza reaproveitados dos materiais do site fornecidos pelo usuário; apresentação conferida em https://www.lrcapitalcredito.com/.
- Capa recolhível e apresentação institucional com perfis dos sócios, navegação por teclado e respeito à preferência por movimento reduzido.
- Resumo clicável da carteira, radar de retornos de hoje, vencidos e sem prazo. Considera os prazos explícitos do cliente, dos vínculos ativos e do acompanhamento documental. Cada cliente conta uma vez; cadastros concluídos ou para retomada não aparecem como atrasos da operação corrente. Datas de atualização não são prazos.
- Ordenação inicial por operações ativas e prazo; opções por nome, demanda, retorno e ordem original. Busca também por contato, instituição e gerente dos vínculos.
- Filtros por responsável, produto, situação e prazo, páginas de 25 clientes e linhas compactas. Produtos ausentes permanecem sem informação; a interface não inventa classificações.
- A preferência de capa e densidade é individual, salva neste navegador. Dados operacionais continuam no repositório configurado (SQLite local ou Firebase).

Os indicadores representam a base carregada; não indicam integração bancária nem consulta externa em tempo real. Esta atualização não migra ou altera os dados de clientes.

## Experimentar

Com Node.js 24 instalado:

```powershell
npm ci
npm run dev
```

Abra `http://127.0.0.1:5174`. A prévia grava em `.preview/workspace.sqlite` e sincroniza abas deste computador. Para outro arquivo, defina `LR_PREVIEW_DB` antes de iniciar. Mantenha o servidor em `127.0.0.1`: ele não tem autenticação e não deve ser exposto na rede. A configuração Firebase, quando presente, tem prioridade; confira o aviso de ambiente antes de editar.

Uma instalação nova começa vazia. **Base recebida → Importar JSON** valida a exportação do pipeline, preserva as tabelas originais e cria clientes, operações, perfis, instituições e gerentes. Reimportações não sobrescrevem revisões. Demonstrações conhecidas são removidas após backup no banco. Para testes com exemplos, existe a opção explícita `LR_PREVIEW_DEMO=1`.

## Funcionalidades

- Carteira com busca, filtros de atuação/retomada, edição de contatos, valores e próximos passos.
- Linha expansível com instituições de cada operação, gerente, status, valores, pendências e prazo. Subitens podem ser adicionados ou editados independentemente.
- Bancos: tipo, logo, aceitação de restrição e taxas/prazos/LTV por garantia. Gerentes: instituição, faturamento, contatos, cidade/UF e alcance.
- Contrato por cliente com identificação, representante, grupo, remuneração, instituições autorizadas e vigência da consulta. Cláusulas fixas, parâmetros editáveis, uma assinatura final e autorização integrada. Dados essenciais incompletos geram **minuta**.
- Administradores podem exportar/importar o modelo privado JSON, revisar e aplicar. O modelo anexado pelo usuário foi carregado somente na base local.
- Simulador PRICE/SAC, carência, IOF parametrizado, TAC, prestamista inicial/mensal e outras despesas. Custos financiados ou descontados da liberação; cronograma, saldo final, CET estimado, CSV, PDF e cenários salvos.
- Diagnóstico de 11 páginas em paisagem baseado nas seções do modelo recebido. Preenchimento manual, texto estruturado, indicadores derivados e faturamentos mensais. Ausências ficam como desconhecidas. Não aprova crédito nem classifica solvência automaticamente.
- Leitor PDF interno com navegação e texto acessível. Documentos são carregados sob demanda.
- Persistência, histórico e controle de versão também para documentos/subitens; edições concorrentes desatualizadas são recusadas.
- Firebase Authentication/Firestore com acesso admin/editor/reader da mesma equipe no ambiente compartilhado. Novos membros precisam ser autorizados pelo administrador.

## Diagnóstico por texto e IA

**Ler campos do texto** funciona sem API. Uma informação por linha, com nome do campo e valor:

```text
História e fundação: Informação declarada pela empresa.
Faturamento LTM: 1.200.000,00
EBITDA LTM: 120.000,00
Fontes e data-base: Demonstrações fornecidas, período informado.
```

Revise e clique **Aplicar campos revisados**. Os valores acima ilustram apenas o formato. As sugestões ficam no rascunho até salvar.

Para texto livre na **prévia local**, configure `OPENAI_API_KEY` e `OPENAI_MODEL` no ambiente do processo servidor por um meio seguro e reinicie. Nunca use variáveis `VITE_*`, navegador ou Git para a chave. O botão permanece indisponível sem configuração.

A integração usa Responses API, JSON estruturado, `store:false`, prazo de 45 segundos, uma extração por vez e evidências literais verificadas. O usuário revisa antes de aplicar. Apenas o texto escolhido é enviado; a carteira não é enviada automaticamente. Instruções no texto são conteúdo. Evidências ajudam a conferir, mas não dispensam revisão. Os testes usam respostas simuladas; não houve chamada real nesta entrega.

O site publicado **não executa o servidor local**. IA em produção requer endpoint autenticado com Firebase, limites de consumo e segredo no servidor. A assinatura ChatGPT não inclui automaticamente créditos de API. [Saídas estruturadas da OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).

## Premissas de cálculo e documentos

Simulação prefixada mensal, vencimentos no dia da liberação limitados ao último dia do mês, arredondamento a centavos e última parcela reconciliando o saldo. Carência integra o prazo total; juros podem ser capitalizados ou pagos. Seguro mensal incide também na carência. Custos antecipados reduzem o líquido; financiados integram o saldo.

IOF diário é ponderado pelo principal amortizado, limitado a 365 dias; juros capitalizados da carência não são tratados como novo principal diário. IOF financiado usa cálculo iterativo. Alíquotas são visíveis e editáveis porque o enquadramento e as exceções dependem da operação. Não há modelagem de crédito rotativo, desconto de recebíveis, taxa pós-fixada ou dias úteis. CET estimado resolve o fluxo por datas em base 365; custos não informados não entram no cálculo. Referências: [regulamento do IOF](https://www2.camara.leg.br/legin/fed/decret/2007/decreto-6306-14-dezembro-2007-566561-normaatualizada-pe.html), [Resolução CMN 4.881 — CET](https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf).

O contrato reproduz o padrão fornecido com consulta integrada e assinatura única. Não constitui parecer jurídico ou aceite do cliente. Instituições podem exigir formalidades próprias. Adicionar instituição após a assinatura exige novo aceite. A assinatura eletrônica e o envio para assinatura não estão integrados.

O diagnóstico usa os períodos informados. Faturamento anual do cadastro não é presumido como LTM. Mostra índices calculados com bases suficientes, ou valores manuais quando elas faltarem. Texto maior que o espaço do modelo gera aviso antes da exportação, sem truncar o cadastro.

## Dados e limites

O JSON do pipeline não contém necessariamente toda a base de bancos/gerentes, contatos, anexos ou histórico integral por instituição. Status sem definição permanecem como códigos originais. Campos ausentes não recebem condições presumidas. Dados brutos ficam em **Base recebida**.

Na prévia, o estado completo é enviado via SSE. No Firebase, as coleções operacionais têm listeners em tempo real. Histórico visível: 100 eventos de operações, 200 do diretório, 400 de documentos. Não há limite artificial de 250 operações; crescimento significativo exigirá paginação/consulta no servidor para controlar leituras e memória. Todos os membros ativos visualizam a mesma equipe; não há filtro de permissão por responsável.

As regras validam equipe, permissão, vínculo, versão e auditoria. Registros complementares usam `contentJson`, limitado a 150 mil caracteres: os campos internos são validados pela aplicação e pelo servidor da prévia, **não por um parser nas regras Firestore**. Para validação independente do cliente em produção, adotar endpoint autenticado ou campos normalizados com regras específicas antes de liberar integrações externas.

A migração inicial local → Firebase foi concluída e conferida no projeto dedicado. Alterações posteriores da prévia não são importadas automaticamente. Ainda não há armazenamento de anexos em nuvem, integração de assinatura, Gmail, portal do cliente, automações de envio ou conversa automática completa. Exportação não substitui backup. O banco e o site originais não foram modificados.

## Testar e publicar

```powershell
npm test
npm run build
```

O GitHub Actions também executa as regras em emulador Firestore com Java 21 e projeto `demo-`. Testes abrangem cálculos, datas, ausências, documentos, importação, idempotência, persistência, conflito e permissões.

Siga [PUBLICAR.md](PUBLICAR.md). `firebase.validation.json` aponta ao projeto novo; `npm run build:hosting` prepara a interface e a configuração pública sem conectar a prévia local à carteira compartilhada. Banco local e modelo privado não entram no build. O modelo privado é consultado no banco protegido, pela aba Contratos.

| Área                    | Arquivos                                       |
| ----------------------- | ---------------------------------------------- |
| Acompanhamento e agenda | `src/WorkflowPage.tsx`, `src/workflow.ts`, `server/documentFiles.ts` |
| Carteira e instituições | `src/ClientPortfolio.tsx`                      |
| Contratos e diagnóstico | `src/DocumentPages.tsx`, `src/pdf.ts`          |
| Cálculos                | `src/credit.ts`, `src/diagnosis.ts`            |
| Importação              | `server/migratePipeline.ts`                    |
| Extração com IA         | `server/diagnosisAi.ts`                        |
| Firebase e permissões   | `src/firebaseRepository.ts`, `firestore.rules` |

O leitor local usa [PDF.js](https://mozilla.github.io/pdf.js/examples/).
## Version 0.9 — equipe, documentos e Drive

- Administradores cadastram convites por e-mail em Usuários e conexão. O primeiro acesso exige Google com e-mail verificado correspondente ao convite; resgate atômico cria o membro uma única vez. Permissões de edição/consulta, revogação de convite e desativação de membro. Administradores existentes não podem ser desativados pela interface.
- Catálogo de pastas em `driveFolders`, privado para os membros do workspace, com busca, seleção e link manual. O vínculo não altera o compartilhamento no Google Drive. Prévia opcional: `LR_DRIVE_FOLDERS` aponta para um catálogo JSON privado fora do repositório.
- Revisão antes de preparar WhatsApp/e-mail: recebimentos persistidos com local, responsável e data; seleção dos itens a solicitar; nova confirmação quando os dados mudam. Recebido não significa conferido. Documentos vencidos exigem revisão da versão no acompanhamento.
- Checklist de documentos importados reconhece identificadores e exercícios do sistema original sem inferir o período pela data de upload. Mantém períodos ausentes como pendentes.
- Lateral com gradiente, movimento suave e suporte a redução de movimento. Removido o atalho Base recebida; a base de origem é preservada.

Os cadastros reais, arquivos de conciliação, contatos e catálogo de pastas ficam fora deste repositório público. O cadastro comercial importado preserva sua origem e não representa aprovação de crédito ou confirmação de uma política oficial da instituição.

## Versão 0.10 — formatos e histórico de conversas

- Faturamento mínimo e máximo exibidos em reais, com centavos, inclusive ao abrir e sair dos campos de edição. Telefones brasileiros exibidos com DDD; entradas incompletas são preservadas para correção.
- Histórico por cliente e instituição: rascunhos, envio informado e respostas registradas manualmente, com data e responsável. Registros são preservados; editores adicionam e leitores consultam.
- Salvar e abrir WhatsApp/e-mail persiste o rascunho antes de abrir o aplicativo. O usuário confirma o envio; o CRM não presume entrega ou leitura. Respostas podem ser coladas no histórico.
- A sincronização automática e o envio pela plataforma oficial do WhatsApp ainda não estão conectados. Nenhuma captura de conversas do WhatsApp Web é realizada.

## Versão 0.10.1 — limite de uso

Falhas de cota do Firestore exibem orientação em português. Ao falhar o salvamento de uma mensagem por cota, a equipe pode abrir o aplicativo sem salvar, com aviso explícito de que não há registro no histórico. A opção respeita a revisão vigente e não transforma o clique em confirmação de envio. Falhas de permissão não liberam essa alternativa. A interface não altera o plano contratado nem renova a cota do serviço.

