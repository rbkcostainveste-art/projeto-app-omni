# Correções da auditoria técnica

## Fluxo de uso

- Relatos Técnicos concentra a comunicação e o acompanhamento. O filtro Estágio da Investigação → Em acompanhamento (todos) reúne as duas etapas, preservando sua distinção. A aba separada Monitoramento foi retirada.
- Observações podem ser registradas sem diagnóstico ou TC. A abertura direta de pane mantém a exigência de TC para os perfis previstos. O relato não adia registros oficiais que já sejam necessários.
- Casos que entram na Passagem de Serviço permanecem pendentes até o encerramento. A data inicial/final, base e demais filtros continuam disponíveis; a visão Hoje inclui pendências anteriores. Rebaixar prioridade ou alterar etapa não apaga a entrada na passagem.
- Uma nova evidência crítica durante acompanhamento/APRS é salva e devolve o caso à avaliação local. Isso não afirma ter reaberto o eDB. Resultado estruturado não satisfatório também retira uma liberação incompatível.
- Borda de relato técnico indica atenção/prioridade, sem ficar verde apenas porque a última ação foi satisfatória. O resultado da ação continua identificado separadamente. Encerramento local não constitui autorização de despacho.

## Cadastros e autorizações

Em Cadastros → Autorizações do acompanhamento técnico há o campo **Mecânicos com APRS — matrículas designadas pelo operador**. A administração informa as matrículas e o motivo/referência da designação. O banco aceita apenas mecânicos ativos e registra a alteração na auditoria. A retirada da matrícula revoga essa designação; permissões adicionais nominais devem ser verificadas separadamente.

Conforme determinação do operador nesta tarefa, inspetores, coordenadores, gerentes e diretores de manutenção têm acesso aos controles técnicos. Mecânicos explicitamente designados com APRS também. Isso não altera a geração de ações, que continua restrita à liderança. Administrador, isoladamente, não ganha aprovação técnica.

Esses profissionais recebem os alertas técnicos automaticamente, respeitando o escopo de base. Destinatários adicionais continuam configuráveis. Alertas são internos ao aplicativo; esta mudança não adiciona entrega push ao celular.

## Prazos e referências

- Referência ao eDB informada: número digitado, sem presumir integração externa. A opção de conferência humana registra matrícula e horário do responsável autorizado.
- Prazo do acompanhamento: opcional, em data/hora, horas ou ciclos. A leitura por contador exige origem e equipamento. Os valores não são extraídos automaticamente do eDB. Alertas por data começam 24 horas antes; por contador, ao atingir a leitura limite informada.
- O prazo textual anterior é preservado. A avaliação dentro dos limites continua exigindo referência técnica, condição medida, limite e próxima inspeção.
- Diferimento expirado aparece como atenção. Registrar nova informação não deve ser impedido pelo vencimento de uma autorização anterior.

## Verificação

Migrações aditivas 045 e 046; nenhum registro operacional apagado. Testes SQL transacionais com rollback confirmaram a preservação de evidência adversa, permanência na passagem, autoria da conferência, autorização por designação e alertas por contador. A suíte técnica SQL existente também passou. Doze testes unitários relacionados passaram, além da verificação de interface em 390, 820 e 1366 pixels e do build.

O advisor do Supabase continua apontando características da arquitetura existente: RPCs SECURITY DEFINER autenticadas com checagens internas, tabelas privadas com RLS sem acesso direto, sessões anônimas vinculadas a identidade e proteção contra senhas vazadas desabilitada. Não se declara auditoria de segurança integral concluída. Referência: [Supabase Database Advisors](https://supabase.com/docs/guides/database/database-advisors).

Permanecem dependências do operador: formalização das designações, manuais e MEL aplicáveis, política de retenção/recuperação e integração do sistema oficial. As correções não equivalem a homologação ANAC.
