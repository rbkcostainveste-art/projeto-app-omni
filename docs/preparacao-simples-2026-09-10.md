# Preparação operacional simples

Decisão do usuário em 10/09/2026: na operação de piloto e mecânico, evitar confirmações duplicadas e cliques que não acrescentem informação. A preparação documental do piloto permanece no seu fluxo próprio. Esta decisão substitui a confirmação final descrita nas entregas anteriores de preparação/MEL e visibilidade dos impedimentos.

## Checklist da mudança

- [x] Remover o botão “Confirmar preparação concluída” e a mensagem que aguardava essa confirmação.
- [x] Mostrar “Preparação concluída” automaticamente quando todos os itens aplicáveis estiverem assinados OK, o voo estiver confirmado e não houver impedimento técnico.
- [x] Consolidar a situação em uma faixa, evitando repetir checklist concluído e confirmação final.
- [x] Compartilhar o resultado entre manutenção, piloto, cockpit, trilhos, programação e coordenação, mantendo as permissões existentes.
- [x] Mostrar os impedimentos e os itens pendentes, sem apagar os OKs já dados.
- [x] Recalcular quando surgir impedimento, houver resultado não conforme ou mudar o contexto dos itens.
- [x] Preservar assinaturas e auditoria. A conclusão automática não inventa uma assinatura final.
- [x] Mudança de aeronave, modelo, data ou tipo de voo invalida os itens daquele contexto; mudança de quantidade/unidade de combustível invalida somente abastecimento. Reverter os valores não reaproveita uma assinatura invalidada: o mecânico assina o item novamente. Posição, horário, destino e tripulação não exigem confirmação adicional.
- [x] Preservar a distinção entre primeiro voo (4 itens), voo seguinte (3) e voo/giro de manutenção (2), inclusive o vínculo da inspeção entre voos.
- [x] Preservar a preparação documental do piloto e os controles de acesso e assinatura dos itens.
- [x] Aplicar a regra também aos voos existentes, sem obrigar sua recriação.

## Verificação

- Banco: migração `20260910230141_automatic_preparation_from_checks` aplicada.
- Testes de banco com rollback: `preparation-visibility.sql`, `preparation-mel.sql` e `preparation-automatic-context.sql` aprovados. Incluem último OK, permissão por voo/base, nenhum registro de assinatura final automática, impedimento posterior, revisão somente de combustível, troca de aeronave, vínculo entre voos e impedimento de iniciar voo de manutenção com aprovação invalidada.
- 157 testes automatizados aprovados; TypeScript e lint dos arquivos alterados aprovados.
- Navegador em 390 e 1366 px: conclusão sem comando extra, novo impedimento, assinatura de item pendente, ausência do botão final, atualização dos cartões, ausência de transbordamento e erros de página. Capturas inspecionadas.
- O verificador de segurança não apresentou achado relativo às funções privadas alteradas; avisos anteriores do projeto permanecem fora desta alteração.
- [x] Build final aprovado, incluindo TypeScript e geração das páginas.
- [ ] Publicação em produção e conferência no site.

Compatibilidade: o comando antigo `confirm_preparation` continua disponível para clientes antigos, sujeito às mesmas permissões e validações. Ele é opcional e não determina mais a prontidão. A interface atual não o envia. Histórico de confirmações anteriores é preservado.
