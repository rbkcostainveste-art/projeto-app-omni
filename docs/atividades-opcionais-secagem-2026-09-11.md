# Atividades e secagens — 11/09/2026

- Nova atividade e Gerar ação aceitam descrição vazia. O tipo escolhido identifica a atividade; detalhes continuam opcionais. O registro da execução continua exigindo seu resultado e descrição.
- A consulta de cadastros recusava o perfil interno `pilot`. Tripulantes agora recebem apenas seu próprio cadastro ativo, incluindo suas habilitações. O acesso dos demais perfis permanece como antes.
- A secagem usa a aeronave do dia mesmo depois de encerrado o voo, acompanhando a base atual dessa aeronave. Isso não altera a indicação de ausência de voo ativo no cabeçalho. Sem referência do dia nem outra escala válida, a base permanece indefinida.
- O filtro continua salvo por usuário neste navegador, limitado às frotas habilitadas. O banco também verifica base e habilitação ao consultar e concluir secagens.
- Lavagem com produto/CT disk é solicitada como atividade e confirmada na Passagem de Pista. A confirmação da lavagem gera a pendência de secagem; a mera criação da atividade não declara uma lavagem realizada.

Validação: 180 testes unitários; cenário SQL transacional com rollback de criação vinculada/avulsa sem descrição, consulta restrita ao próprio piloto, lavagem na Passagem de Pista, secagem após voo encerrado, bloqueio de frota não habilitada e conclusão; interface em 390 e 1366 px, persistência do filtro e criação sem descrição. Lint sem erros. Nenhuma lavagem ou secagem real foi concluída durante os testes.
