# Exclusão de conteúdo pelo ADM

Em Cadastros operacionais, o administrador encontra **Gerenciar e excluir conteúdo**.
Pode escolher uma categoria, selecionar registros e confirmar a exclusão definitiva.
A lista inclui conteúdo encerrado, de outras bases e de outros autores. Cada página
contém até 100 registros. Contas, aeronaves, bases e configurações continuam nas
respectivas áreas de cadastro.

A autorização é verificada no banco por identidade autenticada e cadastro ativo
de administrador. A interface não concede permissões por si só. Registros vinculados
ao conteúdo são excluídos em cascata. Arquivos identificados nos registros excluídos
entram em uma fila privada, processada pela API do Storage no cliente e por um worker
com autenticação própria. O worker continua tentando mesmo se o ADM fechar a tela.
Arquivos avulsos também podem ser selecionados na categoria de anexos.

Na limpeza solicitada em 11/09/2026, foram preservadas as caixas 030, 048 e 052 e
seus três catálogos visuais, além das pendências demonstrativas de Qpulse e
treinamentos. Foram confirmados zero voos, registros de manutenção, publicações,
conversas, mensagens do chat e mensagens da IA. Os sete arquivos armazenados foram
removidos pela API, com retorno HTTP 200 e fila vazia. Nenhum cadastro de pessoa,
aeronave, base ou configuração foi removido. A limpeza não integra as migrações e
não será repetida em uma nova implantação.

Validação: `tests/admin-content.sql` verifica recusa ao usuário sem permissão,
recusa de identificadores vazios e exclusão das categorias com rollback, mantendo
as caixas. `tests/admin-content-browser.cjs` utiliza a fixture local
`tests/fixtures/admin-content-page.tsx`, em `/admin-content-test` na porta 3011, para
testar seleção, cancelamento, exclusão e atualização em 390 e 1366 pixels.
As verificações do Supabase apontam a RPC administrativa como SECURITY DEFINER
executável por autenticados: isso é intencional e protegido pela verificação de ADM
antes de qualquer consulta ou alteração. A fila privada não tem acesso direto dos clientes.
