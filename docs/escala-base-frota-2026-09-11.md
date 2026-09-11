# Escala por base e frota

A programação normal e os voos/giros de manutenção listam apenas tripulantes ativos, na base da aeronave e habilitados para seu modelo. A coordenação pode transferir a base na Gestão de Pessoas e voltar à programação; a lista é recarregada ao fechar essa gestão.

Uma nova designação também é validada no banco. Base incompatível ou ausência de habilitação impedem salvar a escala. Alterar o cadastro de base não apaga as escalas já registradas. Ao trocar a aeronave de um rascunho, a seleção de tripulação é limpa para escolher pessoas compatíveis.

Testes: filtros por base/modelo, transferência entre bases, validação SQL com rollback e preservação das escalas anteriores. Não foram alteradas bases ou escalas reais nos testes.
