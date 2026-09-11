# Power Check para a tripulação

Diagnóstico do PR-CGO: o voo consultado estava confirmado, com comandante e copiloto vazios. Não foi atribuída tripulação automaticamente. A coordenação deve salvar a escala; o voo então aparece em Confirmados.

O Power Check não cria operação própria. A consulta o vincula ao primeiro voo aplicável da aeronave após a abertura da atividade, incluindo voo planejado. Só a tripulação desse voo vê o aviso. Cancelar/excluir o voo permite usar o próximo; o retorno mantém a pendência até o resultado explícito.

No painel do piloto, o aviso conta em Manutenção e não bloqueia o voo por si só. Após o retorno, comandante/copiloto escalado pode confirmar o resultado com assinatura. Resultado satisfatório remove o aviso; não satisfatório permanece. O resultado é guardado na execução da atividade, disponível ao mecânico e ao mural. Não encerra o relato técnico de origem. Mecânicos continuam registrando pela atividade.

Validação: SQL transacional com rollback para atividade avulsa e vinculada, piloto não escalado, voo planejado, bloqueio de confirmação antes do retorno, ausência de OK automático, resultado explícito e retirada da lista. Interface validada em 390 e 1366 px. Nenhum resultado ou escala real foi alterado nos testes.
