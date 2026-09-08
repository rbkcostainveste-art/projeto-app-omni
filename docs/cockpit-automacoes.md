# Fluxos do piloto

- No voo, **Registrar ocorrência** abre o formulário com aeronave, trecho, tripulação e horário. A aeronave permanece vinculada ao voo, inclusive na validação do servidor.
- O aparelho tenta obter a posição. Permissão negada ou posição indisponível não impedem salvar. O piloto pode corrigir horário, local e coordenadas; uma correção manual remove a precisão atribuída ao aparelho. O mapa apenas mostra as coordenadas informadas.
- O clipe permite fotos, áudios e vídeos; o microfone grava áudio diretamente. Os arquivos são enviados quando a ocorrência é salva, em armazenamento privado. Os acessos seguem os participantes autorizados no registro do Cockpit, não os participantes dos chats. Os anexos permanecem na ocorrência; o encaminhamento à manutenção existente mantém sua referência, sem duplicar os arquivos.
- **Documentação do voo** consulta os mesmos registros preenchidos pela coordenação. Preparação e contadores ficam em **Mais ações**.
- **Meu dia → Minha jornada / registrar liberação** propõe a apresentação registrada e os dados dos voos com eventos efetivos, preservando horários já preenchidos. O registro da jornada não fica vinculado a um voo isolado.
- O tempo entre decolagem e pouso é uma referência separada, com IDs e revisões dos eventos. Não substitui o total de voo conferido ou o cálculo noturno. A seleção usa a data da programação; voos atravessando a meia-noite precisam de conferência da jornada correspondente.
- Início/fim da refeição e liberação usam ações explícitas com a confirmação já existente. Uma refeição aberta pode ser salva; precisa ser encerrada antes da liberação. Nas datas anteriores, os horários são preenchidos manualmente.
- O eDB permanece sem integração ativa. As automações não geram aceite oficial ou liberação técnica.

## Verificação

`tests/cockpit-automation.sql` executa cenários transacionais com rollback: números, refeição em andamento, liberação explícita, localização opcional, coordenadas inválidas e permissão de anexos. Requer usuários ativos de teste com perfis de comandante e mecânico.

Para o teste de interface, copie `tests/fixtures/cockpit-automation-page.tsx` para `src/app/cockpit-test/page.tsx`, inicie o Next em 3010 e execute `tests/cockpit-automation-browser.cjs` com Playwright disponível. Remova a rota ao finalizar. O teste intercepta as chamadas e não altera dados reais. Abrange 390, 820 e 1366 px, áudio capturado, localização negada/obtida/corrigida, salvamento e jornada sem encerramento automático.

A verificação de segurança mantém o padrão do projeto: tabelas sem acesso direto e funções autenticadas com identidade ativa e autorização interna. O aviso de função `SECURITY DEFINER` pública é intencional para o predicado de Storage, que retorna apenas a permissão e não expõe conteúdo.
