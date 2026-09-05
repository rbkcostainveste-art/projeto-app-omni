# Registros operacionais e preparação para EDB

Esta versão registra no app. Não envia dados nem aprova registros no EDB.

## Fonte dos dados

`public.flight_operation_records`, uma linha por `flight_id` do planejamento:

- `events`: eventos ordenados, com UUID, tipo, horário real, horário de registro e matrícula. Correções de horário preservam o valor anterior e o autor em `corrections`.
- `checks`: execução e conferência separadas por tarefa. `execution` não é assinatura. Apenas `approval` representa a conferência da manutenção habilitada; seu resultado pode ser `ok` ou `no`.
- `audit`: histórico de todos os comandos, com UUID idempotente, matrícula, horário e conteúdo.
- `delete_event`: remove o evento da sequência ativa e preserva seu conteúdo completo em `audit.payload.removedEvent`. Recalcula decolagem, encerramento e contadores; rejeita exclusões que deixariam eventos dependentes sem seu antecedente. Somente pilotos escalados podem usar essa ação.
- `revision`: controle de concorrência. Um dispositivo desatualizado precisa recarregar antes de gravar.

O acesso direto à tabela é negado aos clientes. Os RPCs `get_flight_operation` e `record_flight_operation` verificam a identidade, a conta ativa, o cargo real, a base e a escala antes de acessar ou escrever. Perfis administrativos não recebem assinatura técnica automaticamente.

## Dia e vínculo da manutenção

O dia operacional usa `America/Sao_Paulo`. A primeira operação efetivamente iniciada da aeronave tem dreno e pré-voo. Antes de qualquer início, o contexto exibido é provisório e é recalculado ao gravar. Voos somente planejados ou cancelados sem acionamento não consomem a primeira operação.

Nas seguintes, `inspection.kind = between` e `targetFlightId` aponta para a operação anterior, embora a tarefa e seu OK apareçam no próximo cartão. Essa única assinatura representa a inspeção após o voo anterior para a futura integração EDB e exige que ele esteja encerrado. Não se solicita uma segunda assinatura no cartão anterior. `nextFlightId` considera a próxima operação da aeronave no mesmo dia, inclusive programada, excluindo canceladas e excluídas. `postflight` só aparece e aceita assinatura após o encerramento quando não há próximo voo: é a inspeção após o último voo do dia. Assinaturas anteriores permanecem preservadas no histórico. Uma mudança no contexto não reaproveita automaticamente a aprovação de outra tarefa ou outro alvo.

Operações atravessando meia-noite preservam o primeiro dia e aparecem no filtro de hoje enquanto estiverem em andamento. Os eventos guardam timestamps completos, não apenas HH:mm.

## Eventos do piloto

`apu_on`, `apu_off` (S-92); `engine1_on`, `engine1_off`, `engine2_on`, `engine2_off`; `takeoff`, `landing`, `rotor_brake`, `finish`.

Somente comandante/copiloto escalado registra eventos. Abrir o painel não registra acionamento. Acionamentos não representam decolagem. Os totais exibidos são acionamentos, minutos de intervalos concluídos, decolagens, pousos e aplicações do freio. Não são conversões certificadas para os contadores oficiais de cada modelo no EDB.

Os campos antigos do Trilho continuam sendo atualizados para decolagem e corte/encerramento. Registros anteriores permanecem no histórico original; não são convertidos automaticamente em assinaturas do novo fluxo.

## Futura integração

O TI deverá definir uma correspondência persistente entre `flight_id`/aeronave/dia/trecho e os identificadores oficiais do EDB. Não usar somente plataforma e horário. Para inspeções, usar `targetFlightId`; para execução do auxiliar, enviar apenas como evidência de execução, nunca como aprovação.

Reenvios devem usar o UUID do evento/comando e a revisão para evitar duplicações. Antes de habilitar escrita no EDB, definir regras de ciclos/horas por modelo, unidades, trechos, autorização de assinatura e conciliação de edições realizadas nos dois sistemas.

## Verificação

`node --test tests/flight-operations.test.cjs tests/coordination-edit.test.cjs tests/crew-flights.test.cjs`

`tests/flight-operations-db.sql` verifica os RPCs e bloqueios com fixtures dentro de transação sempre revertida. Nunca remover o `rollback` desse teste.
