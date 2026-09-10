# Preparação do voo e prazo MEL

> Atualização de 10/09/2026: a confirmação final manual foi substituída por conclusão automática após os OKs aplicáveis, sem impedimento técnico. Consulte [Preparação operacional simples](preparacao-simples-2026-09-10.md). A seção de preparação abaixo registra o funcionamento anterior; os controles MEL continuam válidos.

Implementação de 10/09/2026. Banco remoto do protótipo: migrações `20260910213111_mel_and_preparation` e `20260910213657_mel_alert_stage_deduplication`, aplicadas e verificadas. Interface publicada em https://passagem-de-pista.vercel.app pelo commit `fb3d851d79acfead7803d37f91aad6a94fc79d7c`; deployment `dpl_8KWDsMgNKjZpA3C3pavRvHx1CgKQ`, produção READY e domínio vinculado.

## Preparação

`record_flight_operation` aceita `confirm_preparation`, com identidade, cargo, revisão, UUID idempotente e fingerprint do contexto consultado. Administrador não ganha assinatura de manutenção. O servidor exige voo confirmado, sem início de operação, verificações aplicáveis conferidas e ausência de impedimento técnico registrado. Primeira operação: dreno, combustível, inspeção e HUMS; operações seguintes: combustível, inspeção entre voos e HUMS; giro/voo de manutenção: combustível e inspeção. Procedimentos específicos adicionais precisam ser mapeados antes do uso corporativo.

`preparation` conserva matrícula, horário, fingerprint e eventual invalidação. A confirmação anterior fica no audit do comando seguinte. Alterações nas verificações, programação e registros técnicos exigem nova confirmação. A volta ao valor antigo não restaura a confirmação anterior. Vencimento do diferimento é reavaliado no servidor em cada consulta. Operação iniciada/encerrada deixa de apresentar o indicador de preparação pronta.

`get_preparation_statuses` verifica o acesso de cada voo pelo mesmo controle do módulo operacional. Não retorna dados de voos fora da escala do piloto. Clientes não recebem acesso direto à tabela. O provider compartilha resultados entre cards do Trilho, Cockpit, piloto e coordenação. Escuta alterações do estado compartilhado, foco e confirmação; consulta de apoio a cada 10 segundos. Perda de consulta remove indicadores antigos. Avisos no sino usam o controle de leitura já existente. Não há push externo novo.

## MEL

Separados: descoberta, aplicação do diferimento, cadastro/autoria no aplicativo. O servidor calcula B/C/D a partir do dia da descoberta no fuso informado, excluindo esse dia, e limita a 3/10/120 dias. Aceita prazo mais restritivo. Categoria A exige regra e data limite conferida manualmente; o contador MEL não calcula horas, ciclos ou dias de voo. Não concede extensão de MEL. Legados sem os novos campos continuam legíveis; a conferência de seus dados é necessária para migrá-los ao cálculo estruturado.

Alterações passam pelas permissões `defer` e pelo motivo exigido no registro técnico. O histórico existente conserva os valores anteriores. A referência ao registro oficial é obrigatória no novo controle. Dados antigos expirados podem ser cadastrados para acompanhamento, mas não confirmados como diferimento vigente.

Cron existente a cada cinco minutos: aviso antecipado configurável (24/48/72 horas), aviso de 24 horas e vencimento, sem duplicação por evento/data/destinatário. Preserva destinatários e escopo por base. Os avisos são internos; a confirmação da referência oficial continua manual.

## Verificação

- 9 testes Node: calendário, fusos, exemplo ANAC, limites de categoria, vencimento e regressões operacionais.
- `tests/preparation-mel.sql`: transação revertida; checklist incompleto, confirmação, idempotência, invalidação persistente, cargo, piloto fora da escala, cálculo no servidor, limite de categoria, auditoria e entrega do aviso MEL sem duplicação.
- `tests/flight-operations-db.sql`: regressão de execução/conferência, eventos, autorizações e vínculo entre voos; transação revertida.
- `tests/preparation-mel-browser.cjs`: componentes reais com RPC simulado; confirmação e reconfirmação, campos MEL, ausência de overflow/erros em 390 e 1366 pixels. Fixture em `tests/fixtures/preparation-mel-page.tsx`; montar uma rota temporária somente de desenvolvimento para reproduzir.
- TypeScript verificado com `tsconfig.preparation.json`, que exclui tipos `.next/dev` antigos de rotas de captura removidas. Lint das alterações sem erros; avisos anteriores permanecem em componentes existentes.
- Advisors: nenhum erro; avisos prévios do projeto e aviso esperado de RPC SECURITY DEFINER autenticado. Novo RPC verifica identidade e autorização por voo; helpers privados sem EXECUTE para clientes. Não representa certificação de segurança do projeto inteiro.
- Publicação: build Next.js de produção e TypeScript concluídos; os 9 testes Node também passaram na cópia isolada dos arquivos enviados. Página publicada aberta em sessão autenticada: sincronização ativa, Trilhos e acompanhamento técnico carregados, sem erros/avisos no console na inspeção. Nenhum erro de runtime encontrado na Vercel entre o envio e a consulta. O filtro atual do Trilho não retornou voos, e a sessão de administrador não permite confirmar diferimento: não foi criada preparação nem alterada MEL em produção para esta inspeção. A validação completa das regras está nos testes de componentes e de banco descritos acima.

Supabase CLI indisponível no ambiente: migração aplicada via MCP, nome/versão recuperados do histórico do servidor e cópia idêntica preservada no repositório. Nenhum dado operacional real foi alterado pelos testes.

Referência: [ANAC IS 91-012C](https://pergamum.anac.gov.br/pergamum/vinculos/IS91-012C.pdf), itens 4.1.6, 5.1.2.5.3 e 5.3.12. Adoção depende da MEL e dos procedimentos aprovados da empresa.

Ajuste complementar aplicado: 20260910213657_mel_alert_stage_deduplication. Evita duplicar o aviso quando a antecedência escolhida é 24 horas e separa aviso prévio de vencimento.
