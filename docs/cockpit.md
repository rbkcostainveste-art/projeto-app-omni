# Cockpit — implementação e integrações

O eDB externo é o registro oficial. O Cockpit prepara dados operacionais opcionais e não confirma sincronização, assinatura, liberação ou encerramento oficial.

## Uso
- Coordenação: “Documentação do voo · opcional” na criação recolhe briefing, links e anexos PDF/JPG/PNG/WebP (até 50 MB). Arquivos no bucket privado `cockpit-documents`; compartilhamento segue a designação atual do voo. Repetições recebem cópias vinculadas por voo. Falha documental permite tentar novamente sem duplicar voos já confirmados ou concluir a programação e anexar depois.
- Trilhos: botão documental somente na visão da tripulação. Não é adicionado à visão da manutenção. O botão abre diretamente a seção Documentos/eDB do voo escolhido.
- Navegação: Cockpit. Na programação, o botão Cockpit do voo abre os dados daquele voo.
- Cadastros: documentos por matrícula, regras/escala, contratos, locais AIS e referência do fornecedor eDB. Funções de tripulante abrem campos específicos; coordenação, despacho e ferramentaria exibem Mensalista.
- Preparação: número, contrato, rota, ICAO, alternado, combustível e unidade, passageiros e carga. Voo e tripulação continuam no cadastro original.
- Documentos/eDB: referências opcionais, ciência local, concluir/reabrir rascunho com motivo, exportação JSON com `official: false`. Nenhum transporte para um fornecedor eDB existe ainda.
- Ocorrência: registro sem aeronave permitido; envio técnico exige aeronave cadastrada e tipo pane/discrepância. O servidor cria uma manutenção única e devolve código, sem ampliar permissões de manutenção.
- Chat: selecionar mensagem e “Criar ocorrência no Cockpit” preenche uma proposta com o texto. O usuário ainda precisa salvar/encaminhar; nada é enviado automaticamente.
- Contadores: anterior/atual/unidade/equipamento; incremento calculado no banco. Não somar contador atual ao anterior: atual já é acumulado. Troca/reset deve ser novo contador contextualizado.
- Jornada: horários com data/fuso, apresentação importável do check-in, refeição e liberação, voo e noturno informados. Totais dia/mês/ano/30/90 são dos registros de jornada; não importam automaticamente o histórico externo. Minutos de voo são conferidos manualmente nesta versão.
- Saldo somente com fonte da regra, responsável/data da validação e histórico declarado cobrindo o período. Não calcula aptidão completa, repousos, aclimatação, exposição noturna fisiológica ou todos os cenários de GRF. A referência de 90 h/mês e 930 h/ano vem do art. 33, IV, e permanece sem validação automática.

## APIs pendentes
REDEMET: variável de servidor `REDEMET_API_KEY`, além das variáveis públicas Supabase já utilizadas. Nunca cadastrar chave em campos de texto do Cockpit. A rota `/api/cockpit-weather` exige identidade ativa e consulta somente o domínio oficial com ICAO validado. Ainda não houve teste com chave real. Sem chave, informa indisponibilidade e oferece portal oficial. AISWEB/NOTAM e horários solares permanecem em consulta externa, aguardando credenciais e adaptador.

eDB: obter fornecedor, documentação, ambiente de testes, autenticação, IDs, regras de conflito/idempotência e confirmação de recebimento. A exportação local não prova envio. Alterações feitas no sistema oficial devem prevalecer na futura reconciliação.

## Referências verificadas em 08/09/2026
- Lei 13.475/2017: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13475.htm
- IS 117-001C: https://www.anac.gov.br/assuntos/legislacao/legislacao-1/boletim-de-pessoal/2026/bps-v-21-no-28-13-a-17-07-2026/is-117-001c/visualizar_ato_normativo
- AISWEB: https://ajuda.decea.mil.br/base-de-conhecimento/o-que-e-a-api-aisweb/
- REDEMET: https://ajuda.decea.mil.br/base-de-conhecimento/api-redemet-o-que-e/
- METAR: https://ajuda.decea.mil.br/base-de-conhecimento/api-redemet-mensagem-metar/
- TAF: https://ajuda.decea.mil.br/base-de-conhecimento/api-redemet-mensagem-taf/

## Segurança e testes
Tabelas sem grants diretos para clientes e com RLS. RPC SECURITY DEFINER segue a identidade ativa e cargo atual no servidor, valida acesso por matrícula/voo, mantém revisões e auditoria. As observações do advisor para definer autenticado e tabelas sem políticas são intencionais para acesso exclusivamente via RPC; não foram abertos grants diretos.
`tests/cockpit-permissions.sql` testa acesso, conflito, cálculo, ciência/preparação e envio técnico com rollback integral. `tests/cockpit-layout.cjs` usa uma página temporária baseada em `tests/fixtures/cockpit-page.tsx`, nunca publicada, para verificar interface em 390/820/1366 px.
