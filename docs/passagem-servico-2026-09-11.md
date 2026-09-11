# Passagem de Serviço

- Cards de programadas, relatos e panes mostram prefixo, descrição, TC (número, N/A explícito ou não informada), executantes e autoria/turno da última intervenção.
- Fundo diurno branco e noturno azul escuro. O servidor captura o turno na intervenção; mudanças posteriores no cadastro não reescrevem o turno das entradas anteriores.
- Seleção em lote: liderança designa múltiplos executantes da base ou exclui do planejamento. Execução OK exige descrição e assinatura; sai da programação ativa sem encerrar o caso técnico. Excluir não agenda outro dia nem apaga registros/ações. Filtros permitem consultar os excluídos e as execuções OK.
- TC editável nos cards e no registro completo. N/A não é preenchido automaticamente e não substitui o número obrigatório de uma pane.
- Gerar ação, anexos, execução, comentários, vínculos e encerramento permanecem no registro completo. Programadas possuem edição com justificativa pelo fluxo existente.
- IA recebe texto, imagem ou PDF e prepara até 100 rascunhos editáveis. WO Task é o número da TC; ATA, PN e SN não são TC. Ausências permanecem em branco com aviso. A IA não executa nem publica automaticamente; o inspetor confere e assina a criação.

## Validação
186 testes unitários passaram. Teste SQL com rollback confirmou atribuição, TC/N/A, turno da última intervenção, revisão concorrente com rollback integral, edição, exclusão preservando o registro e OK sem encerramento. Browser 390/1366 verificou cores, designação múltipla, TC N/A e importação em rascunho (resposta da IA simulada). Build e lint. Advisor sinalizou o novo RPC security-definer como esperado: acesso autenticado intencional, com identidade ativa, papel/base, assinatura, revisão e autorização por operação; não há grant para anon.
