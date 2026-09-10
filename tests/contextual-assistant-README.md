# Verificação do assistente contextual

Lógica e rota com autenticação/provedor simulados:

```powershell
node --test tests/contextual-assistant.test.cjs tests/technical-case.test.cjs
```

Para reproduzir a interface em ambiente local de teste, copie `tests/fixtures/contextual-assistant-page.tsx` para `src/app/context-test/page.tsx`, criando a pasta se necessário. Use exclusivamente o servidor local; nunca publique essa página sintética. Configure `PLAYWRIGHT_MODULE` com o módulo Playwright instalado e `TEST_BASE_URL` com a URL do servidor local (padrão `http://127.0.0.1:3210`). Execute:

```powershell
node tests/contextual-assistant-browser.cjs
```

Remova a página temporária antes do build/deploy. A fixture usa sessão sintética e intercepta a API no navegador, não grava registros, não valida acesso real ao banco e não faz chamada paga à OpenAI. Testa captura de contexto, aplicar, desfazer, edição concorrente, fechamento/reabertura e largura em 390/1366 px. As imagens resultantes são evidências locais opcionais, não arquivos de aplicação.

## Importação de voos

Execute `node --test tests/flight-import.test.cjs` para validação da extração, anexos e duplicidade com provedor simulado. Para o navegador, copie temporariamente `tests/fixtures/flight-import-page.tsx` para `src/app/flight-import-test/page.tsx` e execute `node tests/flight-import-browser.cjs` com as mesmas variáveis acima. Remova a página antes do build.

O teste envia uma imagem sintética, intercepta a resposta da IA, bloqueia duplicidade, adiciona dados incompletos aos rascunhos e exige conferência antes de programar. A gravação é um callback em memória, sem banco real. Verificado em 390/1366 px. Não mede precisão real de OCR, cobertura de PDF, autenticação no banco nem cobrança da OpenAI.
# Consulta de secagens

Para reproduzir a verificação isolada, copie `tests/fixtures/assistant-drying-page.tsx` para `src/app/drying-test/page.tsx` durante o teste local, execute `tests/assistant-drying-browser.cjs` com `PLAYWRIGHT_MODULE` e `TEST_BASE_URL` configurados como nos demais testes, e remova a página antes de build/publicação. O navegador simula a API e verifica o callback de destino; não valida a navegação completa do Trilho nem RLS real. A lógica de rota é verificada por `node --test tests/assistant-drying.test.cjs`.
# Conversas separadas

`tests/assistant-conversations.test.cjs` verifica o encaminhamento do identificador e ausência de histórico global. `tests/assistant-conversations.sql` verifica isolamento, migração e idempotência no banco com transação revertida; requer duas identidades ativas e não imprime dados dessas pessoas.

Para interface, copie temporariamente `tests/fixtures/assistant-conversations-page.tsx` para `src/app/conversations-test/page.tsx`, rode `tests/assistant-conversations-browser.cjs` com `PLAYWRIGHT_MODULE` e `TEST_BASE_URL`, e remova a página antes de build/publicação. API/histórico simulados: criação de dois assuntos, retomada e isolamento visual em 390/1366 px. O teste contextual também foi atualizado para criação explícita de conversa.
# Opções de áudio

`tests/assistant-audio-modes-browser.cjs` usa a fixture `tests/fixtures/assistant-media-page.tsx` em `/assistant-test`, microfone sintético e APIs simuladas. Configure `PLAYWRIGHT_MODULE`/`TEST_BASE_URL`. Cobre envio automático, revisão, falhas separadas e preservação de rascunho em 390/1366 px. Remova a página temporária antes de build/publicação. `tests/assistant-media-browser.cjs` mantém a regressão de áudio/câmera ao vivo.
