# Fase 18E.1 — Hardening de UI e governança pós-homologação

## Objetivo

A 18E.1 remove affordances enganosas do shell autenticado sem ativar novos fluxos. O escopo fica restrito a `AppShell` e `AppTopbar`: menu de usuário, contexto tenant/workspace, busca global, notificações e persistência visual da Sidebar.

## Mudanças

- O avatar/nome abre um dropdown acessível. Nome, e-mail, primeiro papel disponível e contexto atual são apenas informativos; `Sair` é a única ação e dispara o logout existente de forma explícita.
- A busca global deixa de ser um campo editável e passa a mostrar `Busca global em breve`. Não há atalho, consulta, simulação ou chamada de API.
- Notificações deixam de exibir botão e indicador de não lidas. O estado estático informa `Sem notificações nesta fase`.
- Tenant e primeiro workspace da sessão são exibidos como `Contexto atual`, sem chevron, botão ou troca simulada. A aplicação já usa o primeiro workspace autorizado como fallback de escopo; a 18E.1 apenas torna esse contexto visível.
- Collapse/expand da Sidebar desktop persiste o booleano `orchestra.sidebar.collapsed` no `localStorage`. Falha ou bloqueio de storage não impede a navegação.

As rotas e itens da Sidebar, RBAC, autenticação local/SSO e contrato de logout não foram alterados.

## Estados seguros

A fase não cria endpoint nem ativa busca, notificações ou switcher. Também não executa MCP remoto/local, tool, provider externo, embeddings, Chat ou AgentRun. Não há mudança em Prisma schema, migration, env, secrets, backend funcional ou infraestrutura.

## Cobertura

`frontend/src/components/shared/AppShell.test.tsx` valida:

1. abrir o menu do usuário não executa logout;
2. somente a ação explícita `Sair` chama o logout e redireciona;
3. busca, notificações e contexto são informativos e não interativos;
4. o estado collapsed é restaurado e persistido no `localStorage`.

## Validação manual sugerida

1. Abrir qualquer rota autenticada e clicar no avatar/nome: o menu deve abrir sem encerrar a sessão.
2. Conferir nome, e-mail, papel e `tenant / workspace`; não deve existir controle de troca.
3. Acionar `Sair`: somente então o logout existente deve ser chamado e a tela deve retornar ao login.
4. Confirmar que busca e notificações comunicam indisponibilidade sem aceitar entrada ou sugerir itens não lidos.
5. Colapsar a Sidebar, recarregar a página e confirmar que o estado visual foi preservado.

Não foi criado smoke próprio: o teste unitário cobre a interação localizada e os gates offline 17D, 18A e 18D continuam sendo as regressões de segurança obrigatórias.
