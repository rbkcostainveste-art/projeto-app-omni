# Aplicação de correções pela IA — 10/09/2026

## Problema confirmado

O relato PR-OHG continuava com o texto original no banco. A IA preenchia uma revisão interna, sem salvar o relato nem atualizar o card. Além disso, comandos compostos como “coloque em inglês e aplique” nem sempre eram reconhecidos como autorização. Nenhum texto operacional desse relato foi alterado durante esta verificação.

## Correções desta entrega

- [x] Reconhecer autorização junto do novo pedido, mantendo seus qualificadores: tradução, correção e classificação solicitada. Pedidos condicionais, negativos ou citados não autorizam uma alteração automaticamente.
- [x] Em um relato existente, aplicar a correção autorizada pelo fluxo de gravação do registro e atualizar o card aberto. A assinatura/autoria existente continua sendo respeitada.
- [x] Preservar a observação original e registrar a justificativa de correção na auditoria. A IA altera somente os campos descritivos permitidos; não concede liberação técnica nem modifica decisões de autoridade.
- [x] Respeitar “sem salvar” ou “somente no rascunho”. Nesse caso, a revisão fica preenchida e a conversa informa que não houve gravação.
- [x] Aguardar o resultado dos formulários compartilhados. A conversa distingue campos preenchidos, gravação confirmada, sincronização pendente e falha; uma falha mantém a sugestão disponível.
- [x] Aguardar a confirmação da gravação na Passagem de Pista e na publicação de comentário do mural.
- [x] Evitar aplicação simultânea e rejeitar propostas quando o formulário mudou durante a resposta.
- [x] Permitir ATA como classificação geral solicitada, sem apresentá-la como comprovação de manual específico. Tarefa, revisão e aplicabilidade de AMM/FIM não podem ser inventadas.

## Revisão das áreas

| Área | Comportamento verificado no código |
| --- | --- |
| Relato técnico existente | Correção autorizada salva no registro e atualiza o card. |
| Novo relato, ação, execução e comentário de manutenção | Preenchimento dos campos do rascunho; criação/registro permanece no comando correspondente. |
| Coordenação, programação e edição de voos | Preenchimento dos campos; programar e confirmar continuam sendo etapas distintas. |
| Cockpit, preparação, documentos e contadores | Preenchimento dos formulários; gravação/assinatura segue o fluxo da área. |
| Passagem de Pista existente | Confirmação de autoria e resultado real da gravação; lavagem conserva sua confirmação própria. |
| Mural, notas, clientes, atividades e ferramentaria | Formulários conectados ao mecanismo compartilhado; comentário direto do mural confirma publicação somente após retorno do servidor. |
| Giro de manutenção, nova passagem e administração de vídeos | Preenchimento de rascunho pelos campos declarados em cada formulário. |

Essa revisão não transforma todos os rascunhos em salvamento automático. A mensagem da IA deve indicar exatamente o que ocorreu em cada área.

## Evidências

- 160 testes unitários passaram.
- Testes de navegador em 390 e 1366 pixels passaram no formulário real de relato: comando composto, card atualizado, original preservado, falha do servidor, nova tentativa, assinatura cancelada e pedido sem salvar.
- Os mesmos tamanhos passaram nos testes do formulário compartilhado: rascunho, gravação, falha e conexão que não altera os campos. Também passaram os testes da Passagem de Pista, incluindo quantidade, assinatura e confirmação/cancelamento de lavagem.
- A RPC real do banco foi testada em transação revertida: correções permitidas para mecânico, auxiliar, líder, inspetor, coordenação/gerência/diretoria de manutenção e administrador; bloqueio para funções sem acesso e outra base; preservação de original, motivo e controle de revisão.
- TypeScript passou. ESLint dos arquivos alterados: zero erros; permanecem avisos anteriores do projeto.

Os testes de navegador usaram respostas simuladas da IA e do salvamento para reproduzir falhas de forma controlada. A autorização e a persistência do relato também foram exercitadas no banco real, sem deixar dados de teste. Esta entrega não certifica respostas do modelo para toda combinação possível de linguagem, nem faz uma nova consulta ao modelo sobre o relato real do usuário.

## Reteste do usuário

Após a publicação, recarregue o aplicativo e repita o pedido no relato existente. A confirmação de gravação deve acompanhar a mudança do texto no card. Se faltar uma referência específica, o assistente deve declarar essa ausência; classificação ATA geral não substitui referência aplicável do operador.
