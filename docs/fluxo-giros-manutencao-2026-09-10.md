# Giros e voos de manutenção — 10/09/2026

## Comportamento aplicado

- Giro em baixa, giro em alta, voo de vibração e voo de manutenção criam imediatamente um único card por ação nos Trilhos e na fila da coordenação.
- O card nasce com **Aguardando programação**, sem aproveitar a tripulação de outro voo. A coordenação define data, horário, posição e tripulação no próprio card. Salvar com piloto designado confirma a programação e disponibiliza a atividade aos pilotos escolhidos.
- Solicitações ainda não programadas e pendências de dias anteriores continuam na fila da coordenação. Operações futuras já programadas respeitam a data.
- Power Check aparece para a manutenção e a tripulação do voo normal, com atalho para esse voo. Não cria operação própria.
- Procedimentos continuam internos à manutenção. Solicitações de lavagem continuam na Passagem de Pista, sem card operacional próprio; o fluxo posterior de secagem permanece.
- “Sem aeronave escalada” mantém a regra existente de operações ativas/futuras, sem reter a aeronave de um voo já concluído.

## Causa e correção

A leitura do mural substituía a categoria de qualquer publicação com `technicalCase` pelo tipo do relato. Atividades vinculadas também carregam esses metadados. Ao salvar a ciência/edição, “Voo de manutenção” virava “Relato Técnico”, e o gatilho do banco retirava o card como se sua ação de origem tivesse desaparecido.

A interface agora normaliza apenas publicações sem ações. Um gatilho protege atividades contra essa substituição feita por versões antigas do aplicativo. A programação valida função, base, revisão, tripulantes distintos, data/horário e operação já iniciada ou encerrada.

A migração `20260911011918_maintenance_operations_routing.sql` recupera somente vínculos com evidência da falha: categoria de relato, ação ainda aberta e card retirado automaticamente com `maintenanceSourceDeleted`. Exclusões explícitas não são recuperadas. Categorias, exclusão anterior e escala anterior permanecem no histórico de reparação.

O vínculo afetado do PR-OHG foi recuperado. Como não possuía eventos operacionais, voltou à programação pendente da coordenação. Nenhum resultado técnico foi alterado.

## Verificação

- `tests/maintenance-routing-flow.sql`: transação com rollback; sete funções de criação, quatro categorias operacionais, atividade avulsa e vinculada, card automático, ausência de tripulação herdada, escala pela coordenação, piloto escolhido, proteção de categoria em cliente antigo, Power Check, lavagem, procedimentos, isolamento por base, conflito de revisão e retirada legítima da origem.
- Regressão existente `tests/action-assignment.sql` passou com rollback.
- 163 testes `*.test.cjs` passaram.
- Build de produção e TypeScript passaram; lint dos componentes finais sem erros.
- `tests/maintenance-routing-browser.cjs`: componentes reais com transporte simulado, desktop de 1366 px e celular de 390 px. Fluxo coordenação → Trilho → programação → piloto, rejeição de tripulação duplicada, sem erros JavaScript ou transbordamento horizontal.
- Fixture em `tests/fixtures/maintenance-routing-page.tsx`; montada temporariamente em `src/app/maintenance-routing-test/page.tsx` com reexportação e removida antes da publicação. Executar com `TEST_BASE_URL=http://localhost:3010`.
- Advisors de segurança: nenhuma diferença em relação à situação anterior (143 apontamentos existentes). Nenhuma ampliação de acesso público.

Os testes de navegador usam dados simulados; permissões e persistência foram verificadas separadamente no banco real, com os dados sintéticos revertidos ao final.

## Correção da lista de tripulação

O catálogo compartilhado de contatos tem apenas nome e matrícula. O card filtrava esse catálogo por função, portanto não mostrava ninguém, embora o cadastro operacional já tivesse comandante e copiloto ativos para S92.

O seletor agora consulta `get_operational_assignments` ao abrir a programação, com função, frota e situação ativa. Tripulantes sem base fixa são aceitos conforme a frota cadastrada. Falha na consulta exibe uma mensagem e “Tentar novamente”; nunca é confundida com ausência de cadastro. A lista e a aplicação pela IA usam as mesmas opções.

A resposta real dessa consulta, sob acesso da coordenação de Jacarepaguá, foi verificada com o seletor: os dois tripulantes do S92 foram encontrados. Nenhuma escala real foi alterada pelo teste.

A fixture de navegador foi corrigida para representar a origem real: contatos sem função e consulta operacional separada, com nomes de campos do RPC. O fluxo passou em 390 e 1366 px, incluindo filtro de frota, exclusão de inativos e outras funções, seleção, gravação e recuperação após falha de consulta. Os 165 testes automatizados e a regressão transacional do fluxo no banco passaram.
