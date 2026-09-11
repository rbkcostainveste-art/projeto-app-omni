# Resultado do giro e encerramento pelo inspetor — 10/09/2026

## Regra final
- A atividade com resultado satisfatório fica verde no mural, com “Satisfatório · aguardando encerramento”. A prioridade urgente herdada do relato não substitui o resultado da atividade.
- O relato original continua com sua própria situação até revisão do responsável. Verde na atividade não significa disponibilidade da aeronave.
- Inspetor, líder, coordenador, gerente e diretor de manutenção, além da administração, podem encerrar a ação, com assinatura, justificativa e resultado satisfatório prévio. Mecânico não pode encerrá-la.
- O botão “Encerrar ação” aparece na atividade e em sua tarefa na linha do tempo do registro técnico.
- Para ações vinculadas, a revisão permite encerrar também o relato e registrar disponibilidade. Esta opção requer confirmação humana e mantém as permissões técnicas e os controles existentes de APRS, eDB, outras ações pendentes e outros casos da aeronave. É possível encerrar somente a ação e manter o relato pendente.
- Encerramento conjunto é atômico: um impedimento na revisão técnica desfaz toda a tentativa, sem encerrar parcialmente a ação.
- Relato encerrado e liberado fica verde, preserva o histórico e volta ao topo na data da atualização. Leituras/visualizações não o reposicionam. Evidência adversa e alerta crítico continuam destacados.

## Diagnóstico
O registro real PR-OHG tinha resultado satisfactory gravado; a aparência usava technicalCase do relato urgente antes dos resultados da tarefa. TaskExecutionHistory não oferecia encerramento. O seletor da timeline não considerava encerramentos como atualização relevante.

## Implementação
- maintenance-wall-state.ts separa resultado da atividade dos eixos do relato.
- maintenance-task-closure.tsx usa a mesma revisão nos dois pontos de entrada.
- close_maintenance_task valida sessão, assinatura recente, perfil/base, revisões e resultado; reaproveita technical_case_action e seus controles de liberação.
- Guard de tabela também impede encerramento de ação sem revisão pela API genérica antiga.
- Atualizações técnicas geram eventos de conteúdo no mural e os seletores compartilhados com a IA os consideram na ordenação.

## Verificação
- 171 testes unitários aprovados.
- Browser 390 e 1366: verde de resultado, vermelho do relato ainda aberto, confirmação humana, payload, tratamento de erro sem perda do texto, encerramento conjunto e ausência de overflow/erros JS.
- SQL com rollback: 7 perfis de liderança, negativa para mecânico, concorrência, tarefa sem resultado, falta de APRS, atomicidade, encerramento separado/conjunto, autoria e timeline.
- Regressão SQL de roteamento aprovada: 4 categorias, escala, tripulação, Power Check, procedimentos, lavagens e base.
- Advisor: acréscimo esperado de um RPC SECURITY DEFINER acessível a authenticated. Função valida autorização, assinatura e base; PUBLIC/anon revogados; search_path vazio. Sem novos tipos de alerta.
- Nenhuma ação/relato real foi encerrado pelos testes. O resultado existente passa a ser mostrado corretamente; a revisão real continua com o responsável.

