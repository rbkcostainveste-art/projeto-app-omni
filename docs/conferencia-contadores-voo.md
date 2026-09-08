# Conferência dos trilhos, Cockpit e contadores

## Controles acrescentados

| Controle | Utilização |
| --- | --- |
| **Contadores do voo** | Seção recolhida no trilho, para piloto e manutenção. Consulta os mesmos eventos, sem redigitar horários. No Cockpit, aparece na aba Contadores. |
| **Registrar leitura** | Registra o incremento calculado para o voo. O saldo anterior e a identificação do equipamento são opcionais. Havendo saldo anterior, o servidor calcula o acumulado. |
| **Atualizar leitura** | Atualiza o mesmo registro após nova conferência, preservando o histórico. Alterações nos eventos sinalizam a necessidade de conferir novamente. |
| **Verificações vinculadas ao voo** | Consulta recolhida em Documentos / eDB: execução, conferência, matrícula e horário da manutenção, inclusive vínculo da inspeção entre voos com a operação anterior. |
| **Outro contador / leitura manual** | Mantém os campos existentes para contadores que não podem ser deduzidos dos eventos. |

## Medições disponíveis

- Motor 1 e motor 2: minutos de funcionamento em períodos concluídos e quantidade de acionamentos.
- APU: minutos e acionamentos, nos modelos já habilitados pelo aplicativo (S92).
- Tempo registrado entre decolagem e pouso, pousos registrados e aplicações do freio rotor.

O tempo em andamento é identificado e não pode ser conferido como período concluído. Não se presume saldo anterior zero. Acionamentos e pousos não são convertidos automaticamente em ciclos de vida de motores/componentes, e o tempo decolagem–pouso não substitui os critérios de voo/jornada da operação.

## Correções de conexão

- A edição rápida no card mantém apenas horários previstos. Horários realizados são corrigidos em Eventos da operação, de onde vêm os contadores.
- A reabertura administrativa agora reabre os eventos, retirando o encerramento e preservando sua informação no histórico. Não apaga acionamentos, cortes ou medições.
- O cancelamento/retorno passou a ter esse nome, para não confundir com o formulário de ocorrência técnica.
- Os cálculos e a conferência de revisão acontecem no servidor. Piloto e mecânico acessam a mesma leitura, respeitando escala/base e perfis. O mecânico não recebe acesso à documentação pessoal ou às demais áreas do Cockpit por causa dessa permissão.
- Uma alteração apenas nas conferências de manutenção não torna os contadores obsoletos: a comparação usa os eventos efetivos.

## Situação da integração

Eventos, verificações e contadores estão vinculados por `flight_id`. A exportação de preparação inclui os eventos e contadores calculados atuais, além das leituras conferidas e suas revisões. O eDB externo ainda não está conectado; não há confirmação de transmissão, assinatura oficial ou recebimento pelo fornecedor.

## Validação

- `tests/connected-flight-counters.sql`: piloto e mecânico consultando a mesma leitura; cálculo no servidor; alteração de horário; rejeição de fonte desatualizada; exportação; reabertura com eventos preservados. Executado com rollback.
- `tests/flight-operations-db.sql`: execução e assinatura, perfis, requisições repetidas, sequência, primeira/próxima operação, vínculo entre voos e inspeção após voo. Executado com rollback.
- `tests/flight-operations.test.cjs`: cinco testes de sequenciamento e totalização, incluindo meia-noite.
- `tests/flight-counters-browser.cjs`: trilho → Cockpit → atualização → consulta da manutenção, em 390, 820 e 1366 px. Usa `tests/fixtures/cockpit-automation-page.tsx` temporariamente em `src/app/counters-test/page.tsx`, servidor na porta 3010 e RPCs simulados. Remover a rota após o teste.
- TypeScript e lint dos componentes específicos passaram. O lint completo de `flight-board.tsx` mantém quatro erros de efeitos e três avisos preexistentes, confirmados também na versão anterior.
