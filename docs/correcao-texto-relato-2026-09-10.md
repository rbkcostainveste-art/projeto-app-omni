# Correção do texto principal do relato pela IA

O pedido de corrigir, melhorar ou traduzir o relato se refere ao título e à descrição exibidos no card. Preencher somente o ATA do acompanhamento técnico não atende esse pedido.

- [x] Orientar a geração para devolver a redação final em `title` e `description`, no idioma solicitado. Quando solicitado no texto, incluir o ATA na descrição como classificação do sistema. Referências documentais exigem evidência; não inventar AMM/FIM, tarefa, revisão, data ou fatos da ocorrência.
- [x] Aplicar a proposta autorizada no relato existente pelo fluxo comum aos perfis com permissão, preservando a observação original no histórico.
- [x] Conferir o conteúdo devolvido pelo servidor antes de anunciar que salvou: uma revisão incrementada, sozinha, não comprova que o texto foi alterado.
- [x] Não gravar uma revisão vazia nem anunciar nova correção quando os conteúdos são iguais. Mudar apenas a justificativa também não conta como correção.
- [x] Diferenciar a confirmação de mudança no texto da confirmação de mudança apenas nos campos complementares, quando essa foi a solicitação.
- [x] 161 testes automatizados aprovados, lint sem erros e build de produção aprovado. Fluxo visual com perfil de mecânico em 390 e 1366 px: correção em inglês com ATA na descrição principal, original preservado, repetição sem gravação, metadados sem alegar mudança textual, retorno divergente, erro/repetição, assinatura cancelada e edição só de rascunho.
- [ ] Teste adicional com geração real: `tests/report-text-model-smoke.cjs` está preparado com observações sintéticas, mas não executou chamadas porque `OPENAI_API_KEY` não está disponível no ambiente local. Os testes visuais utilizaram respostas simuladas. A disponibilidade da chave no site não foi alterada.

Os testes não editaram o relato real PR-OHG. A correção fica disponível para as próximas solicitações autorizadas no aplicativo; não houve migração de banco nem substituição automática dos relatos existentes.
