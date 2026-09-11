# Grupos fixos por público

Implementado sem converter conversas comuns, de tarefas ou relatos.

## Público

Novo tipo Grupo fixo por público para liderança. Blocos repetíveis combinam base, frota, turno, missão, função e área; união sem duplicados. Exclusões individuais prevalecem; inclusões manuais permanecem até remoção. Seleção manual em grupos fixos respeita a base permitida ao responsável; perfis globais podem combinar bases. Conversas comuns continuam permitindo convites pelo fluxo existente.

Os blocos também estão disponíveis ao adicionar participantes a conversas existentes: só grupos fixos guardam os critérios. Nos demais, são enviados os IDs selecionados naquele momento. O seletor de aeronave, vínculos, assinaturas, chamadas e gravações existentes permanecem.

## Participação e histórico

Alterações do cadastro em base, frota, turno, missão, função ou atividade sincronizam grupos fixos. Períodos são delimitados pelos IDs das mensagens sob bloqueio da conversa: entrada exclui o histórico anterior; saída congela o período; retorno cria novo período, preservando os antigos e ocultando intervalos de ausência. Grupos não são apagados com a saída do criador. O criador aparece como inclusão manual inicial na tela, podendo desmarcar sua participação; não há privilégio de leitura automática por ser criador.

Ex-participantes consultam o histórico e não enviam nem atendem chamadas do grupo. Mensagens, paginação, prévia, contagem, recibos e anexos usam os mesmos períodos. Notificações e convites de chamadas usam participantes atuais. A função de push revalida a participação na entrega. Gestão do público é do criador ou gestão global; não permite converter conversas comuns ou vinculadas a atividades.

## Verificação

195 testes unitários aprovados. SQL transacional com rollback: entrada/saída/retorno, lacunas de histórico, exclusões, inclusões manuais, envio negado, chamadas, notificações, isolamento por base, mídia via RLS e anonimato. Suítes anteriores de conversas, vínculos de atividades, recibos e chamadas integradas aprovadas. Navegador 390/1366: soma de blocos, deduplicação, exclusão, inclusão manual, sem overflow. Compilação e lint de produção são verificados antes de publicar.

Nenhuma conversa real foi criada pelos testes; todas as alterações de teste foram revertidas com rollback. Banco atualizado em quatro migrações; send-chat-notifications versão 3 conserva a autenticação por segredo do cron.
