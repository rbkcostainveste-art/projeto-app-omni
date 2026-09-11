# Revisão antes da confirmação e encerramento do relato

- Novo relato: ao focar título/descrição, a revisão abre ao lado no desktop e em tela própria no celular. Campos sincronizados; sugestão após pausa de 1,5 segundo. Respostas antigas não podem ser aplicadas a texto modificado. A pessoa escolhe Usar sugestão e depois confirma o registro.
- Rascunhos da revisão automática ficam apenas no estado da tela. O endpoint autenticado não grava conversa, rascunho nem logs de conteúdo no banco do aplicativo e usa store:false na OpenAI. Isso não é garantia de ausência de retenção técnica pelo provedor.
- O registro novo contém o texto confirmado. O mecanismo existente conserva esse primeiro texto confirmado; correções posteriores continuam auditáveis. Não foram apagados históricos de registros anteriores.
- Histórico de revisões disponível por consulta autorizada ao registro/perfil/base; original fora da apresentação principal; exportação JSON inclui versão vigente, original e auditoria.
- Mural sincroniza título e descrição da fonte sem sobrescrever instruções/resultados das ações. Backfill corrigiu cópias antigas sem encerrar registros nem alterar seus fatos.
- Encerrar relato e registrar disponibilidade funciona mesmo após o encerramento das ações. O servidor valida permissão, base, assinatura recente, revisão, ações encerradas e os controles técnicos existentes. O encerramento conjunto da ação e relato continua disponível.
- Validação: 177 testes automatizados, browser 390/1366 para revisão e criação real do formulário, regressão de encerramento, SQL transacional com rollback para sincronização, preservação de auditoria, permissões e encerramento separado. Nenhum registro real foi encerrado por estes testes.
