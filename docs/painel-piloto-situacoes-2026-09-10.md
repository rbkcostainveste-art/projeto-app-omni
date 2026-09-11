# Programação do piloto — grupos por situação

- Seis filtros com contadores: Manutenção, Confirmados, Planejados, Cancelados, Retornados e Finalizados. Apenas o grupo selecionado aparece abaixo.
- Classificação usa cancelamento, retorno e encerramento operacional antes de considerar confirmação ou categoria de manutenção. `shutdown=ok` ou `actualShutdown` levam a Finalizados; retorno fica em Retornados.
- Mantidos o recorte do dia, a tripulação designada e os filtros de frota/base existentes. Inicialmente prioriza Confirmados, depois Manutenção e Planejados, se houver itens.
- Voos/giros encerrados aparecem uma vez em Finalizados; o encerramento administrativo da ação não altera esse fato operacional. Power Check continua vinculado ao voo, sem gerar outra operação.
- Verificação: 172 testes unitários aprovados; navegador em 390 e 1366 pixels verificou os seis filtros, contadores, exclusividade, detalhes e abertura no Trilho; lint aprovado. Fixture em tests/fixtures/crew-dashboard-page.tsx, rota temporária removida antes da publicação.
