# Edição dos horários previstos do voo

Comandante e copiloto escalados possuem a mesma permissão para editar saída prevista, duração e pouso previsto. Coordenação pode editar na própria base; administração permanece autorizada. Pré-visualizações são somente leitura.

Pouso previsto é calculado pela duração a partir da decolagem real, se já registrada, ou da saída prevista. Editar pouso recalcula a duração, inclusive cruzando a meia-noite. Horários realizados continuam nos Eventos da operação.

Salvamento atômico por RPC com assinatura recente, perfil ativo, escala/base, revisão e validação dos horários. Autor, data e valores anteriores são preservados; outros dados do voo não são editados por esta operação. Nenhum voo real foi alterado pelos testes.

Validação: 178 testes automatizados; SQL transacional com rollback para comandante, copiloto, coordenação, base indevida, revisão vencida e horários inválidos; navegador em 390 e 1366 pixels para cálculo, salvamento único e preservação após erro.
