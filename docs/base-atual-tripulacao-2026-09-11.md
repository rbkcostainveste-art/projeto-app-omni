# Base atual da tripulação

- Gestão de Pessoas volta a permitir cadastrar a base de comandante, copiloto e comissário. Removidos os gatilhos que apagavam a base desses perfis.
- Coordenação vê somente tripulantes nessa gestão. Pode atualizar base, frotas, missão, turno e foto; não pode mudar cargos nem editar pessoas de outros setores. A restrição de atualização também é aplicada no banco.
- A base cadastrada tem prioridade para o contexto operacional e para as secagens. Quando não definida, permanece a referência automática da aeronave escalada, incluindo o último voo do dia para a secagem.
- A gestão da base da aeronave pela coordenação já existia e foi verificada. A transferência da aeronave e a do tripulante são alterações independentes.
- Não foram atribuídas bases reais automaticamente. A coordenação deve informar a base atual de cada tripulante.

Verificação: cenário SQL com rollback para os três perfis, persistência no cadastro e identidades, bloqueio de edição de mecânico, prioridade da base cadastrada e alteração da base da aeronave. Navegador em 390 e 1366 px: lista restrita à tripulação, edição e reabertura com base salva. Lint sem erros.
