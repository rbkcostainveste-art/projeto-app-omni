# Acompanhamento técnico — implementação e validação

Atualização documental: 09/09/2026. O histórico de implementação e testes abaixo foi preservado; esses testes não foram repetidos nesta revisão. Estado consolidado com as entregas posteriores descritas em [Correções da auditoria técnica](correcoes-auditoria-tecnica.md).

## Checklist atual

- [x] Fluxo técnico, auditoria, recorrência, proteções e integração com a Passagem de Serviço implementados, conforme histórico abaixo.
- [x] Configuração de mecânicos designados com APRS e ajustes de autorizações registrados nas migrações 045/046 e na documentação de correções.
- [x] Biblioteca pública pesquisável conectada ao assistente: 17 documentos e 598 páginas.
- [x] Chave OpenAI configurada; conversa e recuperação de fontes testadas pelo usuário em produção em 09/09/2026.
- [ ] Conferir fidelidade das citações, páginas e aplicabilidade nos PDFs; o teste de conexão não encerra validação técnica.
- [x] Ajustada localmente a instrução genérica sobre documentos: agora distingue fontes recuperadas, ausência de evidência e manuais licenciados indisponíveis. Publicação e avaliação de respostas reais ainda pendentes; acompanhamento em [Checklist IA](checklist-ia.md).
- [ ] Concluir assistência contextual, extração e preenchimento assistido. Primeira integração local na criação de relato: painel de texto, proposta de título/descrição, aplicar/desfazer e proteção contra edição concorrente; demais campos, anexos à IA e publicação pendentes.
- [ ] Formalizar e conferir designações reais do operador, escopo por base e responsáveis.
- [ ] Receber MEL/CDL, procedimentos e manuais autorizados, com revisão e aplicabilidade.
- [ ] Integrar eDB/TC/OS; referências digitadas continuam sem sincronização externa.
- [ ] Validar retenção, recuperação, alertas e fluxo operacional com a empresa.

## Finalidade

O Flight A auxilia o operador na organização e rastreabilidade dos processos técnicos. A conformidade final depende dos regulamentos aplicáveis, dos manuais aprovados do operador e das decisões dos profissionais autorizados.

Este módulo não substitui eDB, TC/OS, MEL, controle oficial de manutenção ou APRS. Registra referências e confirmações humanas; não emite esses documentos nem autoriza voos.

## Como usar

1. Em **Manutenção → Relatos Técnicos**, crie o relato com aeronave, título, descrição e evidências. Imagens, áudio, vídeo e PDF são aceitos nos registros técnicos. A entrada começa como Relato Técnico / Em Avaliação / Aguardando Avaliação / Aguardando Triagem.
2. Abra o caso e expanda **Acompanhamento técnico → atualizar**. Os quatro eixos são independentes. Classificar como Discrepância Técnica encaminha o vínculo para Registro Oficial Pendente, sem impedir o troubleshooting.
3. Preencha o identificador oficial para marcar Vinculado ao eDB. A opção Não Aplicável exige reclassificação quando necessária, justificativa e autorização. Matrícula, nome e horário vêm da sessão no servidor.
4. Registre TC/OS, componente, posição, ação, testes e documento efetivamente consultado. As referências técnicas não são inventadas pelo aplicativo.
5. A indicação de liberação exige profissional autorizado e disposição válida. MEL e CDL têm campos separados; CDL só aparece se habilitada. Outros procedimentos precisam existir previamente na configuração do operador.
6. Confirme a APRS e o encerramento da discrepância no eDB para acompanhar Monitoramento Pós-APRS. Uma evidência adversa posterior exige nova confirmação; uma autorização anterior não basta.
7. Se o sintoma reaparecer, use **Criar recorrência**. Um novo relato mantém vínculo com o anterior. O caso anterior não é sobrescrito.
8. Use **Comentário Técnico** para registrar informações compartilhadas com os perfis de manutenção autorizados. Conversas particulares continuam restritas aos seus participantes.
9. Consulte **Auditoria** para ver autor, função, horário, justificativa e valores anteriores/novos. O cancelamento é lógico, com motivo; a aplicação não permite apagar definitivamente o registro confirmado.

Casos pendentes e em monitoramento continuam no acompanhamento diário. Os filtros permitem selecionar vínculo, tipo, situação da aeronave, investigação, base, modelo, prefixo e período. Serviços programados preservam seu fluxo próprio.

## Autorizações do operador

Em **Cadastros → Autorizações do acompanhamento técnico**, a administração cadastra as matrículas habilitadas para classificar/reclassificar, declarar não aplicabilidade, confirmar diferimento, confirmar APRS, registrar liberação, encerrar/cancelar e analisar alertas críticos.

Na versão consolidada após as correções, inspetores, coordenadores, gerentes e diretores de manutenção possuem controles técnicos conforme a determinação registrada do operador; mecânicos ativos explicitamente designados com APRS também. A administração mantém “Mecânicos com APRS — matrículas designadas pelo operador”, com motivo/referência e auditoria. Permissões nominais adicionais devem ser verificadas separadamente. Administrador, isoladamente, não recebe aprovação técnica. A geração de ações continua restrita à liderança, respeitando base e perfil. Essas regras de software não comprovam habilitação ou designação real: a lista efetiva deve ser conferida pela empresa.

Também ficam configuráveis os procedimentos aprovados, a utilização de CDL e os destinatários dos alertas. A configuração é auditada.

## Proteções no servidor

- Referência obrigatória para o vínculo com eDB.
- Não aplicabilidade não pode ser usada diretamente para uma Discrepância Técnica ou Recorrência.
- Registro de troubleshooting e evidências não depende de número do eDB.
- Liberação incompatível é recusada; o relato de segurança é preservado.
- Novos resultados não satisfatórios e sinais críticos retiram a indicação incompatível de liberação.
- Uma APRS ou disposição anterior à última evidência adversa não satisfaz a nova liberação.
- Outros casos ativos da mesma aeronave são considerados antes de confirmar liberação.
- Monitoramento pós-APRS requer discrepância encerrada no eDB.
- Encerramento não é permitido para alerta crítico não resolvido ou discrepância sem APRS válida.
- Atualizações comuns do mural não podem forjar os estados técnicos espelhados.
- Comentários, execuções e anexos confirmados são preservados; correções ficam no histórico.
- O acesso direto de clientes à escrita/exclusão da auditoria e à configuração privada é recusado.
- Revisão concorrente é verificada no RPC de transições; registros são bloqueados durante a atualização.

## Notas e IA

Notas pessoais/administrativas continuam visíveis somente ao autor e exibem aviso para não registrar nelas falhas ou condições técnicas. Converter uma nota em relato mantém autoria, versão original e evento de conversão. O aviso não é uma classificação automática do conteúdo: a pessoa continua responsável por encaminhar uma condição técnica.

A revisão técnica determinística apresenta perguntas diferentes para piloto e mecânico e preserva o texto. A primeira integração contextual local acrescenta, na criação do relato, um painel que solicita propostas de título e descrição à IA e exige aplicação explícita ao rascunho. Não altera registros confirmados nem salva automaticamente; “Criar registro” continua usando o fluxo existente. A IA geral e a conversa ao vivo receberam instruções para não inventar referências, resultados, limites ou liberações.

O assistente geral já consulta um índice textual de fontes públicas e envia os trechos recuperados à OpenAI, retornando resposta e referências. Os PDFs completos permanecem locais; o índice textual foi publicado com o aplicativo. Portanto, essa consulta não é processamento exclusivamente offline. O usuário confirmou o funcionamento com uma pergunta sobre o filtro da MGB. A integração nos campos/cards, importação de documentos para preenchimento e validação sistemática das citações permanecem pendentes. A conversa ao vivo não foi validada por esse teste.

Após a revisão documental, foi criado o [Checklist IA](checklist-ia.md) e ajustada localmente a política em `src/lib/technical-case.ts`. A instrução antiga pedia uma ressalva genérica sobre documentos não confirmados; a nova distingue fontes públicas recuperadas de manuais licenciados ausentes e evita ressalvas documentais em testes de conexão. A correção ainda exige publicação e avaliação de respostas reais; não se declara a fidelidade das citações validada apenas pela alteração do prompt.

Nenhum acervo técnico licenciado foi conectado. Não há consulta confirmada a AMM/FIM, seleção automática de MEL/CDL, emissão de APRS ou modificação automática de registro confirmado. A revisão preparatória não é apresentada como uma geração feita pela IA.

As frases críticas do pedido têm detecção determinística no servidor. Essa detecção é uma proteção adicional e não substitui interpretação técnica ou identifica todas as condições perigosas possíveis. A análise formal é atribuída a profissionais autorizados.

## Alertas

Destinatários configurados recebem alertas no acompanhamento técnico. Um agendamento no banco verifica prazos a cada cinco minutos e gera lembrete a partir de 24 horas antes do vencimento. Alertas resolvidos deixam a lista ativa, preservando o registro.

Os novos alertas são internos ao aplicativo. As funções existentes de push de chat/notas não foram substituídas; distribuição externa adicional desses alertas técnicos depende de configuração posterior do operador.

## Migração e arquivos

Banco identificado: PostgreSQL no Supabase. Todas as migrações são aditivas e foram aplicadas com testes transacionais que terminam em rollback.

`maintenance_records` mantém seus IDs e colunas legadas. `legacy_type` guarda tipo, prioridade, situação e dados anteriores; `technical_case` contém os quatro eixos atuais. Nenhuma liberação, APRS ou dispensa de eDB foi inferida da classificação antiga. Registros antigos sem comprovação de vínculo entram conservadoramente como pendentes/em avaliação.

Migrações, em ordem:

- `20260909003000_technical_case_axes.sql`: eixos, preservação do legado, permissões, auditoria, recorrência, notas e lembretes.
- `20260909003100_technical_case_connections.sql`: conexões e resumo da aeronave; documentos PDF.
- `20260909003200_technical_evidence_guard.sql`: aceitação de evidências adversas e retirada de liberação incompatível.
- `20260909003300_technical_evidence_freshness.sql`: análise de evidências novas e preservação de anexos.
- `20260909003400_technical_confirmations.sql`: identificação nominal, reconfirmação e validade posterior à evidência adversa.
- `20260909003500_technical_aircraft_consistency.sql`: consistência entre casos da aeronave e alertas ativos.
- `20260909003600_technical_wall_states.sql`: espelhamento dos eixos no mural.
- `20260909003700_technical_wall_integrity.sql`: integridade do estado espelhado.
- `20260909003800_technical_summary_scope.sql`: resumo mínimo do Cockpit, sem detalhes internos adicionais.
- `20260909003900_technical_closure_guard.sql`: encerramento e monitoramento com requisitos próprios.
- `20260909004000_technical_adverse_official_review.sql`: nova evidência adversa exige reconfirmação do encerramento oficial e da APRS; a confirmação anterior permanece na auditoria.

Arquivos centrais:

- `src/lib/technical-case.ts`: tipos, rótulos, apresentação e preparação/política de IA.
- `src/components/technical-case.tsx`: eixos, edição, configurações, alertas e auditoria.
- `src/components/maintenance-records.tsx`: criação, filtros, comentários e ligação ao fluxo existente.
- `src/components/flight-board.tsx`, `cockpit.tsx`, `flight-operations.tsx`, `operational-wall.tsx`, `internal-chat.tsx`, `technical-record-picker.tsx`, `runway-handover.tsx`: integração e nomenclatura.
- `src/components/personal-notes.tsx`: aviso e conversão de notas.
- `src/lib/record-media.ts`, `src/components/record-media.tsx`, `notice-carousel.tsx`: PDF e apresentação das evidências.
- `src/app/api/ai/route.ts`, `src/app/api/ai/live/route.ts`: política técnica das respostas.
- `src/lib/cockpit.ts`, `src/lib/help-videos.ts`: campos/nomes compatíveis.
- `client-management.tsx`, `tool-control.tsx`, `toolbox-visual.tsx` e efeitos nos componentes citados: correções de erros de lint preexistentes, preservando as ações e limpando os temporizadores.
- `tsconfig.json`: exclusão da pasta de demonstração local `video-teste` da compilação da aplicação, sem editar/apagar seu conteúdo.

## Validação realizada

- TypeScript sem erros.
- ESLint de `src` sem erros; avisos não bloqueantes permanecem.
- Build de produção Next.js concluído. A rota temporária de teste foi removida antes do build; também foi removida sua referência gerada de desenvolvimento.
- 10 testes unitários: modelo técnico e regressão de eventos/contadores de voo.
- `tests/technical-cases.sql`: classificação legada conservadora, permissões, vínculo obrigatório, reclassificação auditada, APRS/monitoramento, recorrência, bloqueio entre casos, comentários imutáveis, alerta crítico, MEL/CDL, vencimento, lembrete, evidência posterior e conversão privada de nota.
- `tests/technical-case-rls.sql`: bloqueio de escrita/exclusão da auditoria, acesso privado à configuração e acesso anônimo.
- `tests/cockpit-permissions.sql`: permissões, integração de ocorrência e exportação não oficial preservadas.
- `tests/connected-flight-counters.sql`: contadores compartilhados, correções, exportação e reabertura preservados.
- `tests/technical-case-browser.cjs`: formulário e envio em larguras 390, 820 e 1366 px; sem erro de página ou transbordamento horizontal. Usa respostas simuladas; as regras de servidor são verificadas separadamente pelos testes SQL.
- Revisão visual da captura mobile.
- Advisors do Supabase revisados: RLS ativo nas novas tabelas; acesso de RPCs security-definer é intencional, limitado e testado. O banco mantém avisos globais preexistentes. A configuração privada usa RLS sem políticas, com acesso exclusivamente pelo servidor. Referência: [orientações de segurança do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Decisões e conexões pendentes

1. Responsáveis, matrículas e escopo das autorizações técnicas do operador.
2. MEL vigente, revisões, itens, condições, procedimentos, prazos e aplicação de CDL, quando houver.
3. Outros procedimentos aprovados que possam constituir disposição válida.
4. Integração real com eDB/TC/OS: fornecedor, API, autenticação, IDs, sincronização e tratamento de correções. Não há envio externo automático nesta implementação.
5. Acervo técnico licenciado, revisões e efetividade para eventual consulta assistida por IA.
6. Política de retenção, auditoria, cancelamento e tratamento de alertas, validada pelos responsáveis da empresa.
7. Validação regulatória e operacional do fluxo antes de utilizá-lo como parte dos procedimentos oficiais.

Critérios para encerrar essas pendências:

| Dependência | Informação necessária | Evidência de conclusão |
| --- | --- | --- |
| Autorizações | Matrículas ativas, funções, bases, designações e responsável | Configuração conferida e testes de acesso permitido/negado |
| MEL/CDL e procedimentos | Documentos autorizados, revisões, efetividade e responsáveis | Cadastro revisado pelo responsável técnico e exemplos aprovados |
| eDB/TC/OS | Fornecedor, API, ambiente de homologação, permissões e IDs | Testes de leitura/escrita autorizada, correção e prevenção de duplicidade |
| Manuais | Acervo autorizado e política de processamento/armazenamento | Pesquisa com página/revisão conferida e controle de acesso validado |
| Retenção e recuperação | Prazos, responsáveis e procedimento de recuperação | Política aprovada e recuperação demonstrada |
| Alertas | Destinatários, bases, canais e prazos | Testes de entrega e resolução; push técnico externo ainda pendente |
| Uso operacional | Casos reais anonimizados e responsável pela aprovação | Aceite documentado do fluxo pela empresa |

Jornada, FIRA e modelos de documentação por voo estão detalhados em [Pendências do Cockpit](pendencias-cockpit.md). A atualização destes documentos organiza as dependências; não as declara resolvidas sem os insumos e validações indicados.

Não há declaração de conformidade automática com a ANAC.

## Simplificação: acompanhamento, ações e prioridade

- O mecânico inicia um relato com aeronave, título, descrição e prioridade **Rotina / Urgente**. O vínculo com uma pane já existente no eDB é opcional e recolhido. Informar esse número não confirma automaticamente classificação, encerramento ou liberação.
- **Gerar ação** fica no topo do relato, restrito à liderança (líder, inspetor e superiores). Mecânico não gera ação. Cria atividade pendente vinculada, sem registrar execução ou APRS. Mantém-se a restrição de base do servidor.
- Urgentes aparecem primeiro na lista; há filtro de prioridade. No **Ao vivo**, relatos técnicos e suas atividades vinculadas aparecem somente quando urgentes ou com alerta crítico. As atividades continuam acessíveis nos seus próprios quadros. Outros eventos do mural não são removidos. O período diário do Ao vivo continua valendo.
- **Condição dentro dos limites · acompanhar** é uma etapa no mesmo relato: exige referência/revisão, condição/medição, limite, próxima inspeção e confirmação do profissional com autorização de classificação. Não modifica automaticamente a situação da aeronave nem o vínculo oficial. Uma discrepância ativa não pode usar essa etapa.
- Evidência adversa posterior é preservada e retira o acompanhamento incompatível. A avaliação anterior permanece na auditoria.
- A separação em monitoramento continua como atalho de filtro; o histórico e as ações ficam no próprio relato.
- Migração adicional: `20260909004100_simple_technical_followup.sql`. Testes: `tests/simple-technical-followup.sql` e `tests/simple-followup-browser.cjs` (390, 820 e 1366 px), além da regressão técnica existente.
- `20260909004200_technical_priority_timeline.sql` registra a mudança de prioridade na timeline do dia, inclusive quando o relato foi criado anteriormente.
- `20260909004300_technical_leadership_permissions.sql` restaura a geração de ações exclusiva da liderança e protege a abertura direta de pane. O botão **Abrir pane** aparece para inspetor, coordenação, gerência e direção de manutenção, além da administração. Abre o mesmo formulário simples, já classificado como discrepância técnica, com o vínculo eDB expandido; sem número, o vínculo fica pendente. Não emite APRS nem cria registro no eDB externo. A tripulação mantém seu fluxo próprio; mecânico inicia relato técnico.

Referência atual do diário de bordo: [Resolução ANAC 773/2025](https://www.anac.gov.br/assuntos/legislacao/legislacao-1/resolucoes/2025/resolucao-773), vigente desde 1º de janeiro de 2026, que revogou a Resolução 457. Os nomes internos não dispensam os registros dos arts. 6–8. A confirmação de limites depende da documentação e dos profissionais autorizados, conforme os procedimentos aplicáveis; o aplicativo não valida sozinho os limites informados.

## Cards compactos e TC obrigatória para pane

Relatos técnicos urgentes ou críticos ainda abertos também aparecem automaticamente na Passagem de Serviço, mesmo quando aguardam triagem. Permanecem no filtro padrão de hoje quando vêm de dias anteriores, respeitando os demais filtros de base, aeronave e situação. É o mesmo registro, sem duplicar histórico, ações ou conversas.

Os eixos técnicos detalhados aparecem somente ao abrir o registro (ou expandir o resultado de busca), sem ocupar os cards fechados da manutenção e do Ao vivo. O card do Ao vivo usa os mesmos cantos arredondados da manutenção: 10 px no mobile e 14 px no desktop.

No atalho **Abrir pane**, a TC é obrigatória. O banco também exige TC em novas panes da manutenção e na evolução de relato para discrepância, além de impedir apagar a TC de uma pane que já a possua. Os relatos simples continuam com TC opcional. Os registros históricos sem TC são preservados e podem receber comentários; o reporte inicial da tripulação mantém seu fluxo próprio. TC e identificador eDB continuam campos distintos, sem validação automática no WinAir.

Migração: `20260909004400_require_tc_for_maintenance_fault.sql`. Validação: `tests/maintenance-fault-tc.sql`, regressões técnicas e de permissões, lint, TypeScript, build e comparação dos estilos no navegador em 390/1366 px.

## Atalho da chave no voo — 10/09/2026

- Removida a opção duplicada **Lançar caso técnico**. Para mecânico e líder, a chave abre diretamente **Novo relato técnico**.
- Inspetor, coordenador, gerente e diretor de manutenção, além da administração, recebem **Lançar relato técnico** e **Abrir pane**. É a mesma permissão já usada na área de manutenção.
- Os dois caminhos levam a aeronave e o vínculo do voo. **Abrir pane** usa o formulário existente, classifica a entrada como discrepância e exige TC; o relato comum mantém TC opcional. A escolha abre um rascunho, sem gravar automaticamente.
- A regra dos cargos está centralizada em `src/lib/maintenance-entry.ts`. Nenhuma migração ou mudança de permissão no banco é necessária.
- Validação: TypeScript e lint sem erros; navegador em 390 e 1366 px, cobrindo oito perfis, abertura com um clique, menu autorizado, prefixo preenchido e TC obrigatória somente na pane. Nenhum registro operacional foi criado durante a verificação.
