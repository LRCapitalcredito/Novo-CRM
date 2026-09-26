# Acesso ao CRM — 0.11.1

O CRM continua em https://lr-capital-crm-v2-2026.web.app/ com Firebase Authentication e permissão individual no workspace. Não foi criado outro método de autenticação, senha compartilhada ou liberação anônima.

Em 26/09/2026, o Google concluía o login, mas a consulta de permissão no Firestore retornava `resource-exhausted`. A interface confundia a indisponibilidade do banco com falha na ativação de convite e exibia novamente o formulário de login.

A verificação agora conserva a identidade autenticada separada da sessão autorizada. A tela informa a indisponibilidade e oferece nova tentativa e saída. A carteira só é liberada após confirmar uma associação ativa e válida no servidor. Falhas de serviço não concedem permissão. A escuta continua detectando revogações; respostas de contas anteriores são ignoradas.

A transação inicial usa uma tentativa para preservar o erro de cota e evitar cinco consultas repetidas. A atualização equivalente do perfil deixa de reiniciar todas as consultas da carteira. Erros de redirecionamento não substituem uma identidade já autenticada. O carregamento inicial da autenticação também tem estado próprio.

O limite do projeto permanece uma condição operacional: a cota gratuita do Firestore é diária, com renovação por volta da meia-noite do Pacífico. Mudar o endereço de publicação ou a forma de login não aumenta essa cota. Habilitar cobrança exige decisão do responsável pela conta.

Fonte: https://firebase.google.com/docs/firestore/quotas

A página adicional do Squarespace foi cancelada a pedido do usuário, descartada e retirada da lista de páginas ativas. O site institucional foi preservado. O CRM mantém `noindex` no HTML e no cabeçalho de hospedagem; isso não substitui autenticação e regras de acesso.
