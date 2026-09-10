# Transformação do Flight AI com IA — checklist de implementação

Criado em 09/09/2026, antes da implementação da transformação contextual. Este é o acompanhamento principal solicitado pelo usuário. Atualizar em cada entrega e informar na conversa o que mudou, como foi verificado e o próximo passo.

## Como acompanhar

- **Pendente:** ainda não implementado.
- **Em andamento:** trabalho iniciado, ainda incompleto.
- **Implementado localmente:** código pronto, sem afirmar publicação ou teste real.
- **Validado:** verificações identificadas realizadas; explicitar se houve simulação.
- **Publicado:** deployment confirmado, distinto de validação pelo usuário.
- **Dependência externa:** exige acesso, documento ou decisão identificada.

Marcar uma etapa concluída somente após atender aos critérios descritos. Não usar uma porcentagem geral enquanto o inventário de campos/cards não estiver completo. Um botão visível não comprova integração funcional.

## Situação atual — revisão profunda em andamento

[Cobertura por área, campos e limitações](cobertura-ia.md).

Última publicação confirmada: `5b41781db275c0a71380c7ecd5a4ea65989eaea9`, deployment `dpl_9cPnieE1gr2TAHF3qs5eMFwzCTP4`, READY no domínio principal. Atualizações seguintes em validação são descritas no final.

- [x] Substituir consultas fixas por ferramentas escolhidas conforme a pergunta. Remover bloco de secagens sem relação com o pedido.
- [x] Compartilhar regras da timeline e das designações entre a tela e a consulta. Contexto inclui área, filtros, card e fuso; identidade/base vêm do servidor.
- [x] Consultas autorizadas de Mural, avisos, designações, relatos, secagens atuais, frota, voos, passagem e ferramentaria. Limites/parcialidade são explícitos; isso não é acesso ilimitado nem histórico completo de lavagens.
- [x] Navegação estruturada com reconsulta de acesso. Teste real “abre esse relato do CHT” abriu o registro original; logs confirmaram consulta, destino e GET autorizado. Outros destinos foram verificados por código/testes, sem afirmar aceite real de todos.
- [x] Preenchimento dos campos conectados em nova atividade, publicação, relato, execução/comentário/geração de ação técnica, observações de passagem, empréstimo/retirada de ferramentas e formulários declarados do Cockpit. Campos exatos e limitações constam nas entregas abaixo.
- [x] Até três imagens/PDF de 2 MB somados no assistente geral; áudio transcrito com envio automático ou revisão. Proteção de edição concorrente, desfazer e preservação dos controles existentes de salvar/assinar.
- [x] Testes reais: timeline, designações pessoais, continuação para PR-CHT, abertura do relato, ferramentaria e rascunho de nova atividade. Sessão de administrador; consultas de mecânico também verificadas como authenticated no banco em transação revertida.
- [ ] Completar os campos e ações restantes do inventário: cadastros administrativos, seleções múltiplas de atividades e encadeamento nos destinos ainda não adaptados. Coordenação, notas, catálogo de ferramentas e evidências técnicas já tiveram ampliação publicada.
- [x] Continuidade da mesma conversa ao abrir relato, passagem ou Cockpit e continuar um pedido composto. Teste real aprovado no relato PR-CHT. Demais destinos ainda exigem expansão individual.
- [x] Captura prospectiva de confirmações autenticadas de lavagem e vínculo ao ciclo de secagem, instalada em 10/09. Consulta publicada, com aviso de cobertura parcial imposto pelo servidor. O histórico anterior permanece incompleto e não será inventado.
- [x] Consulta dos registros autorizados do Cockpit e abertura do editor original. Notas pessoais publicadas; demais conjuntos ainda precisam de inventário. Ter preenchimento no formulário não significa ter consulta de todo o módulo.
- [ ] Aceite real por todos os cargos/bases, imagens/documentos representativos, voz em ambiente de pista e câmera ao vivo integrada às mesmas ações.
- [ ] Planilhas, documentos maiores, acervo técnico do operador, acompanhamento de consumo e cobertura integral do inventário.

A experiência global ainda não está concluída. As aprovações de build e testes não equivalem a comprovar entendimento de qualquer pedido. As entradas antigas abaixo são histórico; prevalecem os registros de publicação e validação mais recentes.

## Base já entregue antes desta transformação

- [x] OpenAI configurada; teste de conversa confirmado pelo usuário.
- [x] Biblioteca pública: 17 documentos, 598 páginas e 1.610 trechos pesquisáveis.
- [x] Primeira resposta com fontes sobre a MGB confirmada pelo usuário; fidelidade técnica ainda exige conferência.
- [x] REDEMET e decodificação METAR/TAF entregues anteriormente.
- [x] Importação de 88 aeronaves registrada na entrega anterior; cadastro operacional ainda depende de conferência.
- [x] Documentos de pendências anteriores atualizados: [Cockpit](pendencias-cockpit.md) e [Acompanhamento técnico](acompanhamento-tecnico.md).

## Etapas da transformação

### Comparação com a lista original e autorização integral — 09/09/2026

O usuário autorizou aplicar e publicar todo o escopo. Essa autorização inclui as próximas entregas verificadas, sem nova confirmação a cada publicação. Dependências do operador continuam identificadas; autorização de desenvolvimento não define regras operacionais ainda ausentes.

| Grupo | O que ainda falta |
| --- | --- |
| IA-02 | Avaliar a qualidade das respostas reais após a política publicada; evitar confundir documentos da biblioteca com relatos operacionais |
| IA-03/04/06/09 | Expandir além de título/descrição, integrar registros existentes, voz e anexos, revisão e desfazer em cada formulário; registrar cobertura por alvo |
| IA-05 | Continuidade entre o rascunho e o registro salvo, retomada contextual dos demais módulos e validação de acesso ao alvo em cada consulta |
| IA-07/08 | Planilhas, anexos nos demais lançamentos, documentos reais, associação de tripulação e garantia de duplicidade entre usuários simultâneos |
| IA-10/11 | Piloto/Cockpit, documentos, ferramentas, atividades, mural, cadastros, contadores, Passagem de Pista/serviço, notas e administração |
| IA-12 | Administração do acervo, importação autorizada, revisão e aplicabilidade dos manuais; fontes disponíveis sem bibliografia automática na conversa |
| IA-13 | Limites distribuídos, medição de consumo, auditoria das aplicações e testes de autorização para cada nova capacidade |
| IA-14 | Aceite de ponta a ponta com perfis, bases e dados reais para cada entrega; a publicação anterior já foi concluída |
| Pedidos posteriores IA-15/16/17/18 | Perguntas livres e continuidade natural, resolução de prefixos, consultas entre módulos, eventos de lavagem por dia, cards clicáveis e comandos de preenchimento em todos os lançamentos |

Conversas por assunto e os dois modos de áudio do assistente geral já estão publicados. As linhas antigas com “local” abaixo são histórico da primeira entrega e não significam publicação pendente.

### Ampliação publicada nesta rodada

- [x] Conectar IA à revisão de título/descrição do relato existente, usando a confirmação, assinatura e versão do fluxo atual.
- [x] Reconsultar o registro no servidor com JWT do usuário, cargo/base e versão antes de chamar o modelo.
- [x] Voz no painel contextual: revisar por padrão, opção automática e preservação da transcrição em falha da consulta.
- [x] Testes de interface de registros existentes e áudio aprovados em 390/1366 px, com APIs e microfone simulados; regressão do novo relato aprovada.
- [x] 104 testes de lógica/rotas aprovados; TypeScript e lint dos arquivos alterados sem erros.
- [x] Build de produção aprovado, sem páginas sintéticas de teste.
- [x] Publicado: commit `ea7c73bc415511dd4907a343894f8bc5738eb188`, deployment `dpl_XWjE3uST1pkv7eAQTnBB3MqeFWJr` READY, domínio de produção associado.
- [x] Conferência real de interface: botão da IA no relato do PR-CHT e lista vinculada ao registro. Sem alterar o relato, criar conversa ou chamar o modelo nessa conferência.
- [ ] Continuar a expansão e o inventário detalhado acima; esta rodada não encerra o escopo global.

### Escopo ampliado aprovado pelo usuário

A importação de voos é um exemplo, não o limite da transformação. A IA deve apoiar **todo tipo de lançamento**, explicar o aplicativo, consultar registros reais autorizados, localizar e abrir os cards originais e propor o preenchimento de seus campos por conversa. Isso vale para o assistente geral e para os pontos contextuais de cada módulo. O objetivo é executar fluxos completos com as regras existentes, não apenas acrescentar botões de chat.

- [x] Incorporar este escopo ao acompanhamento antes de continuar a implementação.
- [ ] Inventariar cada formulário, card, campo, consulta e ação; registrar cobertura individual.
- [ ] Catálogo de consultas com dados atuais buscados no servidor e permissões por cargo, base e registro.
- [ ] Catálogo de navegação com destinos válidos para abrir o card original a partir da conversa.
- [ ] Catálogo de preenchimento para todos os lançamentos: campos permitidos, validação, revisão e gravação existente.
- [ ] Resolver referências como “CHT”, “esse card”, “hoje” e “aquelas aeronaves”; solicitar escolha quando houver ambiguidade.
- [ ] Consultas que cruzam módulos, com período, origem e estados desconhecidos explícitos.
- [ ] Cards de resultados na conversa, com identificação, situação e botão de acesso.
- [ ] Aplicar o mesmo contexto entre assistente geral, painel local e card aberto.
- [ ] Validar cada capacidade com diferentes cargos e bases antes de publicá-la.

Esses itens estão pendentes de implementação salvo indicação explícita. As integrações de relato e programação foram publicadas e continuam parciais. Os estados locais na tabela e no histórico abaixo descrevem a validação de cada etapa; a publicação consolidada está registrada a seguir.

### Publicação confirmada — 09/09/2026

- [x] Commit `7fe04a37ab9270dee9d93a7c60f83997a9d3a4aa` enviado para `main`.
- [x] Vercel `dpl_98XWJnDoekA5H55LcTRoqwZCoDZp`: **READY**, produção, build aprovado e domínio [passagem-de-pista.vercel.app](https://passagem-de-pista.vercel.app/) associado.
- [x] Publicadas as entregas prontas de conversas por assunto, opções de áudio, consultas autenticadas de relatos/secagens, painel do novo relato técnico, importação de programação e ajustes de linguagem/fontes.
- [x] Conferência na sessão real do site: lista de conversas, histórico anterior preservado, duas opções de áudio e botão “Conversar com IA neste relato” abrindo o painel vinculado ao rascunho.
- [x] 102 testes de lógica/rotas aprovados antes da publicação. Privacidade no banco e testes simulados de interface registrados nas etapas abaixo.
- [ ] Aceite com perguntas reais ao modelo, documentos reais e gravações operacionais. Esta conferência de publicação não criou registros nem chamou o modelo.
- [ ] Expansão para todos os módulos e campos. Edição de título/descrição de relatos existentes e voz contextual foram publicadas na ampliação ea7c73b; o escopo global permanece incompleto.

| ID | Entrega | Situação | Critério para concluir |
| --- | --- | --- | --- |
| IA-01 | Checklist e mapeamento inicial | Concluído | Escopo, módulos, critérios e dependências registrados neste arquivo |
| IA-02 | Corrigir orientação contraditória sobre fontes | Publicado; regressões aprovadas | Política diferencia referências recuperadas e ausência de resultado; avaliação de respostas reais pendente |
| IA-03 | Contrato de contexto e ações por módulo | Parcial: rascunho técnico publicado parcialmente | Alvo e campos tipados; rota aceita somente título/descrição e verifica sessão; outros módulos e ações persistentes pendentes |
| IA-04 | Painel lateral reutilizável e botões locais | Parcial: criação de relato técnico validada com simulação | Painel ao lado em desktop e empilhado no celular; expansão aos demais campos/cards pendente |
| IA-05 | Conversas pessoais por assunto | Publicado; privacidade no banco e interface verificadas | Lista, título, criação explícita, histórico por conversa e vínculo ao rascunho; continuidade entre rascunho salvo e outros módulos pendente |
| IA-06 | Correção, tradução e proposta de texto | Parcial: revisão/aplicação/desfazer validados com simulação | Comparação original/proposta, edição e bloqueio de resposta obsoleta; qualidade das respostas reais e demais campos pendentes |
| IA-07 | Anexos e extração parcial | Parcial: texto, imagem e PDF na programação, publicados parcialmente | Até 2 MB e 30 voos por análise; tipo/tamanho verificados. XLSX, áudio, anexos no relato e precisão de leitura real pendentes |
| IA-08 | Coordenação: importar programação | Parcial: revisão e adição aos rascunhos validadas com simulação | Editar/selecionar itens, detectar duplicidade, conferir antes de programar; validação com documentos e gravação reais pendente |
| IA-09 | Manutenção: elaborar relato no card | Publicado parcialmente: criação e revisão de relato existente, com voz transcrita | Propostas de título/descrição, revisão, desfazer e confirmação existente; anexos à IA, demais campos e aceite do modelo com dados reais pendentes |
| IA-10 | Piloto: mural, Cockpit e documentos | Parcial; Cockpit publicado, documentação em validação | Extrair campos pertinentes, propor relatos e interpretar dados disponíveis; não inventar validade, assinatura ou cálculo regulamentar |
| IA-11 | Expansão aos demais módulos | Parcial; consultar cobertura-ia.md | Cobertura por campo/card inventariada, ações e permissões verificadas; sem atalhos que só abrem chat genérico |
| IA-12 | Biblioteca administrável e pesquisa técnica | Pendente / dependência externa parcial | Importar acervo autorizado, revisões e efetividade; citar página/seção, conferir fontes e identificar referência ausente; AMM/FIM/IPC reais dependem dos documentos |
| IA-13 | Segurança, auditoria e consumo | Parcial: autenticação também publicada na rota geral de texto | Rascunho sem escrita no banco; validar sessões reais, revisar escopo dos dados, limites distribuídos de uso, auditoria persistente e consumo |
| IA-14 | Validação completa e publicação | Pendente | Testes por perfil e base, concorrência/duplicidade, mobile/desktop, regressão, deployment confirmado e aceite dos fluxos reais |
| IA-15 | Consultas operacionais entre módulos | Publicado: ferramentas por pergunta livre, incluindo lavagens e Cockpit | Identidade/base verificadas; cobertura histórica e conjuntos explicitados; notas em validação |
| IA-16 | Cards acionáveis e navegação na conversa | Publicado para conjuntos conectados | Reconsulta do ID; relato aberto por comando em sessão real; demais alvos conforme inventário |
| IA-17 | Comandos para todos os lançamentos | Parcial; relato/Passagem/Cockpit, demais adaptadores em expansão | Localizar alvo, propor campos permitidos, revisar, aplicar e salvar pelas regras do módulo; testar comando de preenchimento na Passagem de Pista |
| IA-18 | Conhecimento do aplicativo e continuidade | Parcial; ferramentas, contexto e continuidade publicada | Explicar funções existentes, conhecer capacidades disponíveis e continuar conversa entre painel/card; informar quando uma ação ainda não é suportada |

IA-13 deve ser construída junto com as primeiras rotas/ações; sua posição na tabela não permite adiá-la até o final.

## Cobertura inicial do aplicativo (histórico; inventário atualizado em cobertura-ia.md)

O inventário é inicial: cada linha deve ser desdobrada nos formulários, campos e cards efetivos antes de ser marcada como coberta. A criação de relato técnico e importação da programação são integrações publicadas parciais; os demais alvos ainda exigem integração. Textos estáticos/cards de leitura recebem explicação/consulta; campos editáveis podem receber propostas conforme permissão. Senhas, tokens e ações técnicas formais não serão enviados ou alterados automaticamente.

| Área | Arquivos de referência em `src/components` | Uso previsto |
| --- | --- | --- |
| Coordenação e programação | `flight-coordination.tsx`, `flight-board.tsx`, `flight-documentation.tsx` | Importar listas de voo, preencher parcialmente, revisar documentos e corrigir rascunhos |
| Piloto e Cockpit | `cockpit.tsx`, `crew-dashboard.tsx`, `crew-presentation.tsx`, `flight-operations.tsx` | Documentos, relatos, explicação dos campos e dados operacionais disponíveis |
| Manutenção e investigação | `maintenance-records.tsx`, `technical-case.tsx` | Elaborar relatos, pesquisar fontes, traduzir e solicitar informação ausente |
| Trilhos e contadores | `maintenance-trail-card.tsx`, `drying-trail-card.tsx`, `flight-counters.tsx`, `flight-position.tsx` | Explicar registros e preparar propostas sem inferir execução ou medição |
| Mural e atividades | `operational-wall.tsx`, `new-activity-dialog.tsx`, `action-fields.tsx`, `notice-carousel.tsx` | Redação, extração e resumo limitado aos registros autorizados |
| Passagem de serviço | `runway-handover.tsx` | Resumir pendências com vínculo às fontes e preparar textos |
| Cadastros e clientes | `client-management.tsx`, `aircraft-registry.tsx`, cadastros em `flight-board.tsx` | Extrair dados e revisar propostas; preservar fonte e resolver divergências |
| Ferramentaria | `tool-control.tsx`, `toolbox-visual.tsx`, `toolbox-receipts.tsx` | Auxiliar cadastros, recibos e consultas sem inventar identificação ou movimentação |
| Mensagens e notas | `internal-chat.tsx`, `personal-notes.tsx`, `assistant-history.tsx` | Reutilizar conversa, corrigir/traduzir, preservar privacidade e confirmar envio |
| Biblioteca e meteorologia | `technical-library-search.tsx`, `weather-results.tsx` | Consulta contextual e explicações com fonte, data e limitações |
| Ajuda, administração e lixeira | `help-and-pending.tsx`, `help-video-admin.tsx`, `flight-trash.tsx` | Ajuda contextual e redação; restauração/exclusão pelas ações existentes e suas permissões |

## Decisões de arquitetura iniciais

1. Usar um painel comum aberto por alvos explícitos: módulo, registro/rascunho, campo e revisão. Não extrair indiscriminadamente textos de toda a página.
2. Cada módulo declara contexto mínimo e ações permitidas. As permissões e o estado atual são validados no servidor; informação enviada pelo navegador não concede autoridade.
3. Conversa produz propostas estruturadas. Aplicar no rascunho é diferente de salvar registro. Preservar campos ausentes e detectar alteração manual posterior à proposta.
4. Reutilizar os caminhos existentes de gravação para manter regras de negócio; não dar à IA escrita genérica no banco.
5. Preservar identificação do original, proposta, usuário que aplicou e resultado da gravação. Histórico privado não vira conversa coletiva automaticamente.
6. Começar pelos fluxos completos de coordenação e relato técnico; expandir o mesmo padrão após validá-los. A primeira entrega de interface deve mostrar o contexto e permitir continuar editando.
7. A API de texto recebeu localmente a mesma verificação de sessão das novas rotas. Validar sessão real e revisar limites/escopo antes de expandir o acesso às novas ações.
8. A infraestrutura atual usa diretamente a API OpenAI. A arquitetura do painel não exige substituir SDK ou modelo nesta etapa.
9. Separar consulta, navegação, proposta e gravação em capacidades explícitas. O modelo escolhe capacidades cadastradas; não recebe SQL livre nem acesso genérico ao banco.
10. Cargo, bases acessíveis e identidade são resolvidos no servidor. Filtrar antes de enviar dados ao modelo, inclusive contagens, anexos, histórico e títulos dos cards. Revalidar ao abrir e salvar.
11. Resultados operacionais carregam IDs reais, origem, instante da consulta e intervalo consultado. Falha, paginação incompleta e ausência de registro não equivalem a “nenhuma pendência”.
12. Cards na conversa são referências ao registro original. Destinos são resolvidos pelo aplicativo, sem executar URLs ou comandos gerados livremente pelo modelo. Registro removido ou acesso revogado deve produzir mensagem adequada.
13. “Hoje” depende do fuso operacional definido e mostrado na consulta. Não presumir que o estado atual de um checklist prova execução naquele dia; usar eventos/datas de realização disponíveis.
14. Solicitações de preenchimento geram proposta por campo e revisão do registro. Detectar edição concorrente, preservar campos não solicitados e manter assinaturas/confirmações exigidas pelo fluxo original.

## Cenários obrigatórios de aceite do escopo ampliado

| Pedido | Comportamento esperado | Verificação necessária |
| --- | --- | --- |
| “Quais S-92 foram lavados hoje e faltam secar?” | Resolver frota, período e base autorizada; cruzar eventos de lavagem e tarefas de secagem; listar prefixos com cards originais | Diferenciar lavagem CT disk, produto e compressor quando relevante; tarefas concluídas, canceladas, múltiplos eventos, ausência de registro e mudança de dia |
| “Quais faltam lavar?” | Comparar obrigação/programação explícita com registros de execução | Sem regra ou programação de lavagem, informar que não é possível determinar todos os que faltam apenas pela ausência de registro |
| “Abra o card do CHT e preencha X, Y e Z” | Localizar aeronave/card autorizado, apresentar escolha se necessário, abrir o original e preparar alterações dos campos existentes | Prefixo parcial ambíguo, múltiplos cards, campo inexistente, somente leitura, edição concorrente e confirmação/assinatura do módulo |
| Imagem ou documento de qualquer lançamento | Identificar tipo de formulário, extrair campos sustentados pelo documento, mostrar origem e deixar ausências pendentes | Anexo com vários registros, dados contraditórios, instruções maliciosas no documento, limites de tamanho e ausência de permissão |
| Pergunta sobre funcionamento do app | Explicar a função real e oferecer acesso à área disponível ao usuário | Não prometer funções ainda pendentes nem revelar áreas ou registros restritos |

## Próxima sequência de implementação

1. Validar autenticação unificada do assistente geral com sessão real e levantar as consultas/regras de acesso existentes.
2. Criar contrato comum de consulta e referência a cards; primeiro fluxo completo: lavagem/secagem autorizada.
3. Conectar resultados da conversa à navegação real de Passagem de Pista/Trilho.
4. Adicionar localização e propostas de campos nos cards existentes, começando por Passagem de Pista.
5. Expandir por inventário a todos os módulos, incluindo anexos, mantendo o status individual. Voos e relatos não encerram essa expansão.

## Dependências que permanecem abertas

- AISWEB: solicitação enviada e chave não recebida. Portal manual já acessível; isso não bloqueia o painel ou os fluxos de rascunho.
- Jornada/FIRA: modelos, enquadramento e casos validados pelo operador.
- eDB/TC/OS: acesso e documentação técnica da empresa.
- Manuais completos: autorização, arquivos, revisão e aplicabilidade. Fontes públicas atuais permitem demonstração limitada.
- Amostras reais anonimizadas de programação e documentos do piloto ajudam na validação; enquanto indisponíveis, identificar claramente os testes sintéticos.

## Registro de entregas

### 09/09/2026 — nova conversa direta e títulos automáticos

- Nova conversa abre diretamente o compositor de texto/voz, sem formulário de título nem confirmação adicional. A criação continua sendo uma escolha explícita; reabrir o assistente não cria conversa.
- Título curto extraído da primeira mensagem salva, inclusive transcrição; sem chamada adicional ao modelo. Conversas antigas preservadas. O nome pode ser alterado em “Editar título”, na lista, e não é sobrescrito por novas mensagens.
- Migração `20260910010847_assistant_automatic_titles.sql` aplicada. RPC mantém verificação de identidade/proprietário, cria com ID idempotente, serializa alterações do título e rejeita nomes vazios/acima do limite.
- Testes reais do banco com rollback passaram: título automático, renomeação, preservação do título manual/antigo, isolamento entre usuários e idempotência. Testes de interface em 390/1366 px aprovados; regressões contextual e áudio aprovadas com provedor simulado.
- Advisors mantêm os avisos já conhecidos de [RLS sem política direta](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [RPC security definer autenticada](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Acesso direto segue revogado; esta mudança não amplia permissões.
- Publicado: commit `7e7a6231202b621c0efafde8ecff5aea143f3512`, deployment `dpl_33iHCy8Y3SxFBLJqBkgm5q9e8BjY` READY, produção. Build/lint aprovados. Conferida a nova lista com Editar título no site; nenhuma conversa de teste criada em produção.


### 09/09/2026 — publicação solicitada

- Usuário autorizou publicar as entregas prontas: conversas por assunto, opções de áudio, consultas autenticadas de relatos/secagens, painel do rascunho técnico, importação de programação e ajustes de linguagem/fontes.
- Revisão do pacote: 102 testes de lógica/rotas aprovados, além dos testes de navegador e builds registrados nas entregas anteriores. Capturas, vídeos, apresentações e páginas sintéticas não integram o pacote.
- Migração local alinhada à versão efetivamente aplicada no Supabase: `20260910001601_personal_assistant_conversations.sql`.
- Publicação concluída pelo commit `7fe04a3`, deployment `dpl_98XWJnDoekA5H55LcTRoqwZCoDZp` em produção, estado READY. As funcionalidades ainda pendentes de implementação não fazem parte desta entrega.

### 09/09/2026 — áudio transcrito com envio automático ou revisão

- Adicionado seletor “Ao gravar áudio”: “Enviar após transcrever” e “Revisar antes de enviar”. No assistente geral, padrão automático; quando aberto na área de manutenção, padrão revisão. A escolha vale para a conversa aberta e pode ser alterada antes de gravar.
- Revisão mantém texto editável sem consultar o modelo até o usuário enviar. Envio automático consulta após transcrição bem-sucedida. Texto já digitado ou imagem anexada exigem revisão; transcrição é acrescentada ao texto existente, sem apagá-lo. Acima de 8.000 caracteres, pede divisão antes de enviar.
- Estados separados: “Transcrevendo…”, “Consultando…” e “Salvando conversa…”. Botão “Tentar transcrever novamente” aparece somente se a transcrição falhar, nunca durante processamento normal. Falha posterior na consulta mantém o texto e não pede outro envio do áudio.
- Testes de navegador em 390/1366 px com microfone sintético/API simulada: automático, revisão/edição, falha da consulta seguida de reenvio sem nova transcrição, falha da transcrição seguida de retry e preservação do texto digitado. Passaram sem erro de página ou transbordamento horizontal. TypeScript aprovado.
- Esta alteração cobre o áudio gravado do assistente geral. Não adiciona microfone aos painéis contextuais ainda sem voz. Não houve medição de consumo/velocidade nem chamada real ao serviço de transcrição. Interface ainda local, não publicada.
- Verificação final: regressão de áudio/câmera ao vivo com histórico passou usando mídia/API simuladas; build de produção, TypeScript e `git diff --check` aprovados. Página sintética removida antes do build.

### 09/09/2026 — conversas pessoais separadas por assunto

- Alterada a decisão anterior de histórico único: abertura do assistente mostra lista e “Nova conversa”. Usuário informa título e cria explicitamente; abrir/retornar não cria conversas vazias.
- Migração `personal_assistant_conversations` aplicada ao Supabase. Histórico anterior preservado em uma “Conversa anterior” por usuário. Compatibilidade mantida para o cliente ainda publicado, que continua acessando somente o histórico anterior.
- Mensagens vinculadas por chave composta a conversa e proprietário. RPC verifica identidade ativa, proprietário e tentativa de reutilizar uma resposta em outra conversa. Tabelas sem acesso direto para anon/authenticated, RLS habilitada. Listas paginadas em blocos de 50.
- Texto e sessão ao vivo enviam identificador da conversa. Servidor recupera somente seu histórico; rotas sem conversa verificam acesso sem importar histórico global. Trocar de conversa remonta o painel, limpando campo, propostas e contexto temporário.
- Painel de criação do relato também possui lista/criação de conversas, identificadas pelo rascunho e aeronave. Histórico é persistido; propostas de preenchimento não são reaplicadas ao retomar. Rascunhos ainda não têm associação automática ao registro salvo — o vínculo é ao rascunho, com rótulo explícito.
- Testes reais no banco, em transação revertida: isolamento entre assuntos/proprietários, matrícula forjada, repetição de criação/envio, tentativa de transferir resposta entre conversas e integridade dos históricos migrados. Passaram, sem deixar conversas ou mensagens sintéticas gravadas.
- Navegador com API simulada em 390/1366 px: criar dois assuntos, enviar, voltar, retomar sem misturar mensagens e sem criar conversas extras. Regressão do painel contextual: histórico persistido simulado, aplicação/desfazer e bloqueio de proposta obsoleta. Sem erros de página/transbordamento.
- Interface ainda local, não publicada. A migração de banco por si só não faz o novo botão aparecer no site. Páginas sintéticas removidas após os testes.
- Verificação final: 21 testes de lógica/rotas, lint dos componentes alterados, TypeScript, `git diff --check` e build de produção aprovados. Nenhuma rota sintética na saída do build. Testes de interface usam respostas simuladas; testes SQL de isolamento foram reais.
- Advisor Supabase: mantém os avisos esperados de [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) nas tabelas fechadas e [RPC SECURITY DEFINER executável por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). O desenho é intencional: acesso direto revogado e identidade/proprietário conferidos dentro da RPC; testes reais validaram essas restrições. Não foi afirmado que todos os avisos do projeto foram resolvidos.

### 09/09/2026 — correção da conversa e consulta de relatos existentes

- Requisito reforçado pelo usuário: conversa natural por área/cargo; sem referências bibliográficas automáticas; “E relato técnico?” após consulta de panes deve continuar a pesquisa, não abrir roteiro de criação.
- Assistente geral passa a receber as últimas seis trocas do histórico autenticado como mensagens sequenciais, em vez de depender do histórico enviado pelo navegador. A área de origem é enviada como contexto de interface, sem conceder acesso.
- Nova consulta interna de relatos abertos, com JWT/RLS e perfil/base resolvidos no servidor. Envia somente identificação, tipo, prefixo, modelo, base, título, status e atualização; até 100 registros. Resultado indisponível, não autorizado, parcial e vazio têm estados distintos. Cadastro/voos não são evidência de inexistência de pane.
- Política diferencia relato aberto de pane confirmada, pede esclarecimento para prefixo/fala ambíguos e orienta respostas breves, sem listas automáticas de campos ou avisos documentais fora de contexto.
- Fontes continuam sendo usadas na fundamentação, mas o chat geral não retorna lista bibliográfica automática. Nos painéis que usam a lista compartilhada, as fontes ficam recolhidas em “Ver fontes consultadas”. A biblioteca continua disponível para pesquisa explícita.
- Testes de rota verificam histórico sequencial e inclusão de relato sintético do PR-CHT. Não houve consulta ao registro real do usuário nem avaliação da resposta do modelo em produção; esses testes não comprovam qualidade conversacional real.
- Verificação desta rodada: 20 testes de lógica/rotas aprovados com dependências simuladas; TypeScript, lint dos novos arquivos e da lista de fontes, `git diff --check` e build de produção aprovados.
- Esta entrega ainda é local e parcial. A consulta é de relatos abertos, não inclui todos os módulos nem pesquisa livre paginada. Voz contextual, painéis em registros existentes, ferramentas por profissão e publicação continuam pendentes. Não marcar cobertura global como concluída.

### 09/09/2026 — primeira consulta operacional e referências à secagem

- Adicionada seção “Secagens pendentes” no assistente geral. Consulta S-92/S-92A ou todas as frotas autorizadas por botão; retorna prefixo, modelo, base, motivo e abertura da pendência. Esta etapa não interpreta livremente perguntas operacionais.
- Nova rota GET `/api/ai/drying`: autentica, resolve identidade/cargo/base via RPC do servidor e consulta a tabela com o JWT do usuário, mantendo RLS. Perfis de base recebem filtro adicional; tripulação depende da política existente de base operacional dinâmica. Perfis não habilitados e base obrigatória ausente são recusados.
- Não usa chave de serviço, não grava dados e não envia a fila ao modelo. Mostra instante/escopo da consulta, resultados parciais acima de 100 registros e mensagem de falha diferente de resultado vazio.
- “Abrir card no Trilho” reconsulta o ID sob as mesmas permissões e permite que um registro já concluído seja encontrado. A integração abre o Trilho filtrado por data/prefixo, com todos os estados; se o card não estiver carregado, informa indisponibilidade. Destaque e foco no card exato ainda pendentes.
- Descoberto que a fila agrega lavagens novas a uma pendência existente, sem atualizar necessariamente `triggered_at`. Por isso não foi usado esse campo como data de lavagem. A resposta “lavadas hoje e faltam secar” ainda exige consulta dos eventos de realização.
- Verificação: 19 testes de lógica/rotas passaram, com casos de identidade divergente, cargo, base ausente, filtro forjado, ID indisponível, resultado parcial e falha do banco. Interface isolada passou em 390/1366 px: consulta, revalidação ao abrir, erro de acesso e ausência de transbordamento/erros de página. Dependências e dados simulados; não valida políticas reais do Supabase nem navegação completa do aplicativo.
- TypeScript, lint dos novos arquivos, `git diff --check` e build de produção aprovados. A saída inclui `/api/ai/drying` e não contém a fixture de teste, removida após a verificação. Alterações locais, sem publicação.

### 09/09/2026 — escopo global e autenticação do assistente geral

- Incorporado o pedido de todos os tipos de lançamento, consultas operacionais entre módulos, cards clicáveis e comandos de localização/preenchimento. Criadas etapas IA-15 a IA-18 e cenários de aceite de lavagem/secagem e card CHT.
- Inspeção do código encontrou tipos distintos de lavagem na Passagem de Pista e tarefas próprias de secagem. A consulta deverá respeitar essas diferenças; um estado marcado no card não comprova, sozinho, execução no dia solicitado.
- `/api/ai` agora verifica `assistantAccess` antes de ler o corpo ou chamar o provedor. O assistente geral envia o token da sessão e identificação do funcionário, conforme as rotas existentes. Erro de autorização retorna mensagem genérica, sem detalhes internos.
- Verificação: 18 testes de lógica/rotas passaram com dependências simuladas, incluindo rejeição de sessão antes de consultar fontes/provedor. TypeScript e `git diff --check` aprovados.
- Esta correção autentica a conversa; não implementa autorização por base para novas consultas. O contexto operacional atual ainda vem do navegador e não constitui fonte autoritativa. Consultas no servidor, cards acionáveis e preenchimento global permanecem pendentes.
- Alterações locais, sem publicação, teste pago do modelo ou validação de sessão real nesta rodada. Próximo trabalho: catálogo de consultas autorizadas e primeiro fluxo de lavagem/secagem.

### 09/09/2026 — início

- Criado este checklist antes de alterar a IA.
- Mapeados componentes principais e caminhos atuais de consulta e gravação.
- Identificada contradição na política técnica que gerava a ressalva confusa mesmo com fontes disponíveis.
- Corrigida a política compartilhada de texto/ao vivo para usar apenas fontes fornecidas, evitar a ressalva em pedidos não técnicos e não tratar instruções dos documentos como ordens. Ao vivo continua sem nova validação real.
- Verificação: 7 testes existentes de `technical-case.test.cjs` passaram; lint do arquivo sem erros (um aviso preexistente `_priority`); build de produção e TypeScript concluídos. Não foram realizadas chamadas pagas à OpenAI nesta etapa.
- Alterações locais, ainda sem commit/push/deployment desta entrega. O teste real anterior pertence à versão já publicada, não valida automaticamente o novo prompt.
- Próxima implementação de interface: contrato de contexto e painel lateral; ainda não há novos botões publicados.

### 09/09/2026 — primeira integração contextual local

- Adicionado botão “Conversar com IA neste relato” na criação de registro técnico. Abre painel lateral em desktop e seção empilhada no celular, preservando formulário.
- Criado contrato `maintenance-draft`, limitado a título/descrição e contexto do rascunho. Propostas com campos adicionais ou tipos inválidos são rejeitadas.
- Nova rota `/api/ai/context` verifica sessão pelo mecanismo existente `assistantAccess`, não consulta registros privados por ID e não grava no banco. Limites de entrada, histórico e saída, timeout, tratamento de resposta incompleta e `store: false` no provedor.
- Proposta pode ser editada antes da aplicação. Campos null são preservados. Uma edição manual posterior impede aplicar resposta antiga. Última aplicação pode ser desfeita enquanto os campos não forem novamente alterados.
- Conversa limitada às últimas 8 trocas, em memória, isolada por usuário/rascunho/aeronave. Fechar o painel cancela a consulta em curso; encerrar formulário ou trocar aeronave descarta a conversa.
- 12 testes unitários/de rota passaram com provedores simulados. Interface passou em 390/1366 px: contexto enviado, aplicar, desfazer, bloquear proposta obsoleta e reabrir painel. Sem erro de página e sem transbordamento horizontal. Lint sem erros, avisos preexistentes no componente de manutenção.
- Fixture removida da árvore de rotas após o teste; reprodução em `tests/contextual-assistant-README.md`.
- Build de produção e TypeScript aprovados; nova rota incluída e página sintética ausente da saída. Sem gravação real, sem teste pago de OpenAI ou nova validação de autenticação no banco nesta rodada. Ainda não publicado.
- Próximo: autenticação da rota antiga e controle de consumo; ampliar entradas/anexos e fluxo de coordenação. Esta entrega não conclui IA-03 a IA-14.

### 09/09/2026 — importação da programação de voos

- Botão “Importar programação com IA” na coordenação, com texto e um anexo PDF/PNG/JPG/WebP de até 2 MB. Até 30 voos por consulta; a interface informa o envio do documento à OpenAI.
- Nova rota `/api/ai/flight-import` autentica pelo mecanismo existente, limita corpo da requisição, valida MIME/base64 e assinatura do arquivo, usa saída estruturada, timeout e `store: false`. Não lê registros privados nem grava voos.
- Extrai prefixo, data, saída, destino, duração, abastecimento/unidade e observações de origem. Dados de tripulação permanecem nas observações para associação manual; recorrência não é inferida.
- Revisão editável por linha e seleção explícita. Adição ao formulário preserva rascunhos existentes; campos ausentes/ inválidos ficam vazios e dados recebidos ficam disponíveis para conferência. Quando há quantidade de combustível sem unidade válida, a quantidade fica pendente nas observações/dados recebidos, sem conversão presumida.
- Bloqueio de possíveis duplicidades por prefixo/data/saída contra programação e rascunhos, incluindo itens aceitos no mesmo lote. Duplicidade é conferida novamente antes de programar os importados. Essa verificação de interface não constitui garantia transacional entre usuários simultâneos.
- Voos importados exigem a marcação “Conferi os dados deste voo importado”. Edições dos campos principais retiram a conferência. A gravação segue o fluxo existente, com estado planejado e confirmação posterior para o Trilho; histórico inclui fonte, observações e dados importados. O combustível ausente continua seguindo a representação numérica preexistente ao salvar; a fonte importada preserva a ausência para conferência.
- Testes: 17 testes de lógica/rotas aprovados com provedores simulados. Browser 390/1366 px: envio de imagem sintética, bloqueio de duplicidade, rascunho incompleto, conferência obrigatória e programação com callback em memória. Sem erros de página/transbordamento. Lint dos quatro arquivos sem erros ou avisos após correção de conflito de nome.
- Fixture de teste removida da árvore de rotas. Reprodução documentada em `tests/contextual-assistant-README.md`.
- Não houve teste pago de leitura real pela OpenAI, gravação no banco de produção ou publicação nesta etapa. IA-07 e IA-08 continuam parciais.
- Verificação final: build de produção e TypeScript aprovados, sem rota sintética na saída. Mais 30 regressões de coordenação aprovadas (47 testes de lógica/rotas no total desta rodada, além dos testes de navegador).


### 09/09/2026 — assistente da tela e rascunho direto

- [x] Botão flutuante nas áreas autenticadas, incluindo Ferramentaria, com painel lateral e identificação da tela. A janela de relato aberta fornece seu próprio contexto. Visualização de outro perfil não oferece o assistente.
- [x] Abrir o assistente contextual leva diretamente à conversa; histórico e nova conversa continuam acessíveis, sem pedir título. Reabrir retoma a conversa daquele contexto.
- [x] Relato novo: IA preenche título, descrição e prefixo do catálogo do formulário. Abreviação CHT e fala Charlie Hotel Tango resolvem PR-CHT se houver uma única opção. Ambiguidade não escolhe uma aeronave.
- [x] Relato existente: ajuste direto de título/descrição na revisão, preservando verificação de versão, base, autorização e confirmação final existente.
- [x] Aplicação automática apenas se os campos continuam iguais aos enviados. Desfazer disponível; edições manuais concorrentes são preservadas. Não há gravação nem assinatura automática.
- [x] Relatos aceitam até três imagens/PDF, 2 MB somados, gravação de voz e arquivo de áudio para transcrição. Geral aceita imagem ou PDF de 2 MB e áudio. Histórico guarda texto e nomes dos anexos; binários não são arquivados na conversa nesta etapa.
- [x] Instrução de redação exige fatos informados, sem inventar circunstâncias como “durante a operação” e sem repetir bibliografia no texto da conversa.
- [x] Verificação: 107 testes de lógica/rotas; navegador em 390/1366 px para formulário, desfazer, edição concorrente, áudio revisar/automático, falha e repetição, painel sobre janela modal, anexos e isolamento de contexto. APIs de IA simuladas nesses testes; qualidade do modelo real ainda precisa de validação.
- [ ] Conectar preenchimento específico dos demais módulos (ferramentaria, passagem de pista, cockpit e outros), consultas completas e abertura de qualquer card por comando. O botão global identifica a área; isso não equivale a ter acesso a todos os dados ou ações. No fallback geral não são oferecidos lançamentos de voo ou edição do formulário sem integração.
- Publicação confirmada: commit `caa11eb551647c0ed21abf116a774abb660880ad`, deployment `dpl_5J4paSMGt2v6KoR813JPzznLH4tz`, READY em produção com alias `passagem-de-pista.vercel.app`. Build e TypeScript aprovados, sem rotas sintéticas. Botão flutuante e abertura direta conferidos no site com sessão real. As notas históricas acima descrevem entregas anteriores; esta entrada substitui o fluxo antigo de revisão em formulário duplicado para relatos.

- Verificação real em produção: “cht com vazamento na mgb” selecionou PR-CHT, preencheu título “Vazamento na MGB” e descrição fiel; título da conversa foi gerado automaticamente. Desfazer limpou os três campos e o formulário foi cancelado, sem criar relato técnico. Apenas a conversa pessoal de teste foi preservada.
- A resposta real usou “Posso registrar como referência...”. Ajustada a orientação para evitar nova oferta/permissão ao preparar o rascunho e usar prefixo completo e linguagem direta. Isso não garante ausência de variação do modelo; continuar avaliando a naturalidade em uso.

- Publicação final confirmada: `bce3fb655146be4d5d22375b648b26d03c533230`, deployment `dpl_3V4cAuf75igVBSfzbyp8UiYjfacV`, READY e alias de produção associado. Inclui orientação de linguagem do commit `86db3d1`.
- Segundo teste com OpenAI real: resposta “Preparei o rascunho sobre o vazamento na MGB do PR-CHT.”; prefixo PR-CHT, título “Vazamento na MGB” e descrição “Vazamento na MGB do PR-CHT.” preenchidos. Desfeito e cancelado, sem salvar registro operacional. Nenhum teste real de leitura de imagem/PDF ou microfone nesta rodada; esses fluxos foram verificados com APIs simuladas.


### 09/09/2026 — cards de relatos e secagens na conversa livre

- [x] Renovada a autorização do usuário para continuar implementando e publicar as próximas entregas verificadas sem nova confirmação.
- [x] A consulta geral busca relatos abertos e secagens pendentes no servidor, com JWT do usuário e filtros/permissões atuais. Falha, falta de acesso e resultado parcial não equivalem a ausência de registros.
- [x] A IA pode apresentar até 12 cards pertinentes de relatos e secagens. O servidor aceita somente identificadores presentes na consulta autorizada e monta os destinos; o modelo não escolhe URL externa nem concede acesso.
- [x] Cards preservados no histórico da própria conversa. Clique reconsulta o registro e suas permissões atuais antes de navegar. Um relato fechado pode continuar acessível pelo histórico se o usuário ainda tiver acesso; ausência de acesso impede abrir.
- [x] Atalhos ligados ao assistente geral de Mensagens e ao painel flutuante: abrir relato original ou card de secagem no Trilho. Se o card do Trilho não estiver carregado, informa indisponibilidade em vez de simular abertura.
- [x] 110 testes de lógica/rotas; navegador em 390/1366 px para persistência dos cards, abertura e acesso revogado; consultas SQL reais como authenticated com identidade de mecânico, em transação revertida, aprovadas. Não houve alteração de schema ou ampliação de permissões.
- [ ] Lavagens realizadas hoje requerem consulta aos eventos correspondentes; a abertura de pendência de secagem não comprova data de lavagem. Esse cruzamento continua pendente.
- [ ] Ferramentaria requer consulta específica com escopo de base e campos mínimos. A função existente de dashboard retorna dados amplos e executa limpeza de fotos; não foi reutilizada pela IA nesta etapa.
- [ ] Ampliar os cards e comandos para os demais módulos, além de relatos e secagens. Preenchimentos dos demais formulários continuam pendentes conforme inventário.
- Publicação confirmada: commits `5704353` e `937feb1ea1f9bb3ea643a1ec348c8a7edd4a1cc7`, deployment `dpl_5F17p6LbrTUW5jmMQWGaxavKAg1v`, READY e alias `passagem-de-pista.vercel.app`. Build e TypeScript aprovados, sem fixture. Abas antigas mantêm resposta em texto; recarregar habilita os cards. Conferência funcional real aprovada: a pergunta “Tem algum relato técnico do CHT? Mostre o card para eu abrir.” encontrou PR-CHT / Altimetro; o botão validou o acesso e abriu o relato original PAN-PRCHT-202609-001. Sem alterar o registro. Secagens foram verificadas por testes e consulta SQL, sem novo teste pago de pergunta sobre secagem nesta rodada.


### Revisão da integração — ferramentas e formulários (validação local)

- Consulta fixa substituída por ciclo de ferramentas na Responses API. O modelo escolhe o conjunto conforme o pedido e pode consultar detalhes em seguida. Biblioteca técnica só é pesquisada quando a ferramenta correspondente é escolhida.
- Consultas conectadas: timeline, avisos, designações, relatos abertos/fechados, secagens pendentes, frota, voos, Passagem de Pista e caixas/operações da Ferramentaria. Escopos, datas, identidade e resultados parciais explícitos. Isso não equivale a cobertura de todo o aplicativo.
- Timeline e correspondência de designações compartilham seletores com a interface. Relato aberto não é tratado como designação. Contexto explícito de filtros/janela em Mural, Atividades, Passagem de Pista e Ferramentaria.
- Cards e revalidação de acesso ampliados para mural, atividades, voos, passagens e operações de ferramentas. Comando explícito de abertura pode solicitar navegação, executada pela interface após nova verificação.
- Componente comum de assistência por formulário: campos/opções declarados, resposta validada, proteção de edição concorrente, desfazer em rascunho e revisão explícita de alteração em registro salvo.
- Conectados: nova atividade, nova publicação, nova passagem (prefixo), observações/descrição de caso em passagem existente, empréstimo de caixa/retirada sem catálogo (campos declarados), execução/comentário/geração de ação em relato. Não marca checks operacionais, não assina e não conclui tarefas automaticamente. Fotos do catálogo e seleção de ferramentas catalogadas continuam no fluxo próprio.
- Removido bloco fixo de secagens do chat. Mensagens antigas com negrito passam a renderizar o destaque. Áudio no formulário inicia em revisar; usuário pode escolher envio automático.
- Migração remota `20260910021455_assistant_toolroom_read` aplicada. Endpoint somente de leitura, com identidade ativa, cargo/base e escopo pessoal para mecânico/auxiliar; não retorna fotos/URLs nem executa limpeza. CLI indisponível neste ambiente: arquivo local usa a versão gerada pelo serviço de migrações. Verificação real em transação revertida passou com role authenticated; anon não pode executar. Advisor registra SECURITY DEFINER acessível a authenticated: uso intencional, pois as tabelas não são expostas diretamente; a função valida identidade/base e não concede permissões de escrita. Demais avisos preexistentes não foram alterados.
- Validação: 121 testes unitários/de rotas passaram; navegador 390/1366 verificou formulário, desfazer, edição concorrente, revisão, histórico e cards. SQL real verificou os SELECTs como authenticated. Build preliminar passou. APIs do modelo simuladas nos testes de navegador; aceitação com OpenAI real e publicação desta revisão ainda pendentes.
- Pendências da revisão: acervo técnico por operador, lavagem por histórico completo, integração de todos os campos do Cockpit/coordenação/administração, continuação da conversa durante navegação, cobertura completa de anexos e testes reais por cargo. Nenhuma alegação de equivalência ao ChatGPT ou conclusão global.

### 09/09/2026 — validação real da estrutura de consultas

- Produção: `9740a51abb6a102ef9d5944dc7038c4068603798`, deployment `dpl_FryNT2NCj75XrxcfF1yz79yXhnvg`, READY com alias principal. Consulta de Ferramentaria usa a migração `20260910021455_assistant_toolroom_read.sql`, aplicada e validada como authenticated.
- Testes com OpenAI e sessão real de administrador: Mural respondeu “Nada novo na timeline de Jacarepaguá para hoje”, coerente com a tela; “tem alguma designação para mim pendente” não confundiu tarefa com relato; continuação “e relato técnico do cht, tem?” localizou PR-CHT / Altimetro e trouxe o card correto.
- Formulário real de nova atividade: frase informal preencheu Procedimentos, PR-CHT, finalidade, TC 123 e rotina. Desfeito e cancelado; nenhuma atividade operacional foi criada. Conversas pessoais de teste permanecem no histórico.
- Abertura por comando ainda falhou no primeiro teste. O botão abriu corretamente. Após uma primeira correção, o modelo escreveu “abri” sem executar navegação. Falha identificada pelos logs; não considerar navegação por comando aprovada nessa publicação.
- Segunda publicação: `79e0e100f0bfae9968e7519e1dccd2472e0445b2`, deployment `dpl_26CVVGYbsvnjGV5eiGtWMrodXWRn`, READY. Até três imagens/PDF por mensagem no assistente geral e nos formulários genéricos, 2 MB somados; áudio continua transcrito. Datas impossíveis rejeitadas, revalidação do formulário e diagnósticos de nomes/estados de ferramentas sem conteúdo das conversas nos logs.
- 123 testes passaram. Navegador em 390/1366 px verificou preenchimento, desfazer, edição concorrente, revisão de registro e múltiplos anexos com APIs simuladas. Build passou e fixtures foram removidas antes de publicar.
- Próxima correção em andamento: destino de abertura estruturado na resposta, com reconsulta obrigatória de acesso; integração dos campos declarados no Cockpit. Ainda não publicar como concluído até testar.

- Cockpit implementado localmente: campos declarados de preparação, ocorrência, documentos, diário, contadores, jornada, licenças/certificados e cadastros. Somente rascunho; campos derivados, ciência e assinatura ficam fora da ferramenta. Números, datas, URLs, opções e prefixo vinculado ao voo são validados. 124 testes, lint/TypeScript/build e navegador 390/1366 px aprovados; APIs simuladas no teste do Cockpit, sem gravação de operação. Fixtures removidas antes do build.

### 09/09/2026 — unificação do relato e ampliação de rascunhos (em validação)

- O assistente dentro do relato passou ao mesmo agente de consultas do painel geral. Mantém autenticação, leitura autorizada e rejeição de versão obsoleta antes do modelo; consulta técnica só busca biblioteca quando necessária. Não altera registros confirmados por conta própria.
- TC conectada no novo relato, inclusive aplicação/desfazer e detecção de edição concorrente. Prefixos fonéticos generalizados, com ambiguidade preservada e escolha limitada ao catálogo.
- Rascunhos adicionais: comentários, edição de publicação e execução de atividade no Mural. Os botões preparam os campos; enviar/publicar/registrar continuam pelos fluxos existentes.
- Teste de interface do relato em 390/1366 px passou com TC, desfazer e resposta obsoleta. Testes da rota agora percorrem o agente compartilhado com provedor simulado, incluindo falhas, quotas e preparação sem gravação.


### Leitura real de imagem e histórico de lavagem — 10/09/2026

- Publicação contextual `8d21784` READY. Teste real no domínio principal, administrador: imagem sintética com PR-CHT, “Luz da cabine intermitente” e TC 456 preencheu prefixo/título/descrição/TC corretamente, sem acréscimos. Desfazer restaurou todos os campos; rascunho cancelado, nenhum relato operacional criado. A conversa pessoal de teste ficou no histórico.
- Migration aplicada `20260910032516_assistant_wash_history`: eventos capturados somente a partir da instalação, sem backfill fictício; vínculo por ID e instante do ciclo de secagem. Repetir Sim não duplica evento. Uma nova transição para Sim corresponde a nova confirmação.
- Teste SQL em transação revertida, antes e depois da aplicação: captura, não duplicação, ciclo reutilizado, cobertura parcial, identidade falsificada, isolamento da base do mecânico e ausência de acesso anônimo/direto. Dados sintéticos não persistidos.
- Consulta `washing` usa data/fuso, prefixo/modelo/base e situação da pendência. `closed` significa ausência de pendência ativa daquele ciclo, não comprova execução. Consultas que incluem período anterior à instalação indicam cobertura parcial.
- Advisor: RLS sem políticas nas tabelas de eventos/cobertura é intencional (acesso direto revogado); RPC SECURITY DEFINER tem identidade ativa e escopo de base conferidos. Não abrir SELECT genérico para eliminar esse aviso.
- Corrigido identificador de Passagem de Pista: banco utiliza texto, não exclusivamente UUID. Destinos preservam o ID e continuam rejeitando caminhos inválidos.
- 128 testes de lógica/rotas aprovados; TypeScript aprovado. Publicação da consulta de lavagem ainda em andamento nesta entrada.


### Passagem de Pista e consulta do Cockpit — próxima publicação

- Passagem: todos os checks visíveis no card, observações, caso técnico e quantidades/unidades de óleo dos dois motores. Proposta revisada antes de aplicar; lavagem mantém confirmação específica e assinatura. Validação rejeita valor negativo, campo invisível e descrição de caso técnico sem marcação correspondente. Não inferir check executado por dados incompletos.
- Testes de navegador 390/1366: cancelar não altera registro; confirmar aplica a quantidade e chama assinatura uma vez. Corrigido painel da IA que sobrepunha a janela de confirmação. São dados/APIs simulados, sem lavagem operacional criada.
- Cockpit: consulta usa RPC existente com private.cockpit_access sob JWT; campos declarados apenas, sem URLs/anexos/campos desconhecidos. Navegação abre editor original. Testes de navegador abriram a qualificação correta em 390/1366. Teste SQL de piloto confirmou isolamento de qualificações pessoais/listagem, em transação revertida.
- Lavagens: d83c340 READY; pergunta real escolheu washing (logs), mas modelo omitiu a cobertura parcial. Acrescentada limitação explícita no servidor quando o histórico consultado não cobre o período, sem depender dessa decisão do modelo.
- Migration 20260910033825 alinha coordenação ao acesso já existente à fila de secagem. Teste SQL da coordenação aprovado. As permissões locais e de tripulação permanecem verificadas na função.
- 130 testes aprovados e build aprovado antes do ajuste final da limitação; última regressão/publicação em andamento. Não concluir escopo integral: conversas entre telas, demais formulários, consulta dos outros conjuntos e testes reais por cargo ainda pendentes.


### Continuidade entre conversa e registro — em validação

- Pedido composto pode abrir relato, passagem ou registro do Cockpit e continuar o texto original no editor, na mesma conversa pessoal. Destino revalidado antes da navegação; pedido de apenas abrir não gera segunda chamada ao modelo.
- A continuação só é executada ao registrar o alvo exato, uma vez por transferência. Em rascunho preenche; alterações persistentes mantêm a revisão/assinatura do formulário. Outros destinos abrem normalmente, mas ainda não têm transferência automática de campos.
- Testes de navegador 390/1366: uma única conversa, abertura do relato original, preenchimento uma única vez e desfazer. APIs/modelo simulados; teste real após publicação pendente.
- 132 testes aprovados, build aprovado; esta entrega não encerra o inventário de formulários.


### 10/09/2026 — continuação real aprovada e ampliação dos formulários

- Publicação `671f8a3` READY. Teste real com OpenAI e administrador: “Abra o relato técnico do CHT e prepare a correção do título para Altímetro intermitente, sem salvar o registro.” abriu PR-CHT, manteve a conversa e preencheu a correção. Desfazer restaurou Altimetro; janela fechada, registro original não alterado.
- Notas pessoais: consulta pela RPC existente, isolada pelo dono, sem anexos privados. SQL real em transação revertida confirmou isolamento/identidade. Navegação para nota original e preparação de título, texto, prefixo e lembrete implementadas localmente.
- Coordenação: formulário compartilhado de criação/edição recebe prefixo, data, saída, destino, duração, combustível/unidade, posição, tripulantes elegíveis e repetição semanal. Valida datas/horários, pessoas distintas e elegibilidade do comissário. Salvar/programar permanecem no fluxo original.
- Outros adaptadores locais: cliente/plataforma, briefing e títulos/links de documentos, contador anterior/equipamento, planejamento de manutenção e metadados de vídeo de ajuda. Não modificam valores derivados, assinaturas nem concessões de acesso.
- Ferramentaria: seleção múltipla entre ferramentas conferidas e disponíveis; item emprestado/sem revisão não é opção da IA. Cadastro de gaveta/ferramenta permite preparar nomes, medida e posição; alterações retiram a marca de revisão, preservando conferência e assinatura existentes.
- Painéis locais compartilham a renderização e navegação dos cards com o assistente geral. Notas e demais formulários herdam o navegador autorizado.
- 135 testes unitários/de rotas passaram. Navegador de notas/coordenação aprovado em 390/1366 px com APIs simuladas; seleção de ferramentas e regressão da navegação ainda em validação. Esta entrada não afirma publicação dos adaptadores novos.

- Regressão final: navegação/continuação em uma conversa e desfazer aprovados em 390/1366 px com build otimizado; seleção múltipla/catálogo aprovada nas duas larguras. Ambiente de desenvolvimento ficou lento; teste final usou build local de produção. Notas/coordenação: restaurar o valor original (inclusive horários) aprovado. Lint sem erros, três avisos preexistentes. Fixtures removidas para o build definitivo.

- Publicação da ampliação confirmada: `680cc8fe11a8d77a9109218b20a360a09cc0207f`, `dpl_HCVH5JcfhtpDLtwLVy1TowV6ytx9`, READY. Conferência real no domínio principal: nota “conferir a escala do CHT amanhã às 08h” preencheu título, texto, PR-CHT e 11/09/2026 08:00, sem ativar notificação. Desfeito e fechado sem salvar. Conversa pessoal de teste permanece; nenhuma nota operacional foi criada. Build definitivo aprovado sem fixtures.


### 10/09/2026 — evidências técnicas no mesmo relato e foco do formulário

- Mesmo assistente/contexto/conversa do relato ampliado para TC, componente, posição, ação, teste, medição, limite e resultado informado, identificação/revisão/efetividade do documento consultado e justificativa. Não oferece alteração de APRS, condição da aeronave, conclusão do teste nem confirmações formais.
- Campos técnicos têm lista explícita no servidor, preservação de campos ausentes, detecção de edição concorrente e desfazer. A atualização usa o estado mais recente e não apaga confirmações feitas pelo usuário em outros controles. Persistência continua por Confirmar atualização e assinatura.
- Botão flutuante respeita o formulário que recebeu foco; seções fechadas e elementos ocultos não assumem o contexto. A conversa não muda só porque a página foi rolada.
- 136 testes de lógica/rotas aprovados. Testes de navegador 390/1366 aprovados para foco/seção fechada; evidências técnicas em validação final. Publicação desta etapa pendente.

- Evidências técnicas: navegador 390/1366 aprovado, incluindo aplicação/desfazer no componente real, sem salvar nem assinar. Lint sem erros ou avisos nos arquivos desta etapa. Fixtures removidas antes do build.

- Publicação dos campos técnicos e foco confirmada: `5b41781db275c0a71380c7ecd5a4ea65989eaea9`, deployment `dpl_9cPnieE1gr2TAHF3qs5eMFwzCTP4`, READY. Ajuste final: botões locais de novo/atual relato indicam o alvo explicitamente, mesmo após foco em outro campo.

- Aceite real desta etapa, administrador e OpenAI no domínio principal: no PR-CHT, pedido preparou Componente=Altímetro e Resultado observado=Intermitente; Medição/Documento permaneceram vazios, conclusão do teste e confirmações formais inalteradas. Desfazer restaurou os campos; relato fechado sem salvar. Não foi criada execução nem alterado registro operacional. A conversa pessoal permanece no histórico.


### 10/09/2026 — praticidade, anexos e revisão técnica

Acompanhamento detalhado em [ajustes-2026-09-10.md](ajustes-2026-09-10.md).

- Revisão diferencia redação, completude e evidência documental; consulta fontes pertinentes e preserva a observação original imutável no registro. Não inventa manual/referência e não confunde revisão com autorização.
- Propostas aguardam botão ou “pode aplicar”. Comentário do mural pode ser publicado com aprovação; assistente geral prepara e salva voos como Programado após aprovação. Datas/horários, catálogo, edição concorrente e duplicidade permanecem verificados.
- Imagens/arquivos múltiplos e colagem nos chats/assistentes; envio explícito na programação e pedidos de ajuste da lista importada. Arquivos da IA acima de 2 MB passam pelo armazenamento privado (20 MB por arquivo, 40 MB por mensagem).
- Público de manutenção filtrado, histórico/republicação do quadro, recentes primeiro, texto sem imagem ocupa o card. Painel da coordenação filtra base atual e exclui A definir. Datas seguem hoje por padrão sem substituir consulta histórica.
- 144 testes unitários/de rotas, navegador 390/1366 e teste SQL real com rollback aprovados. Modelos/respostas controlados nos testes de navegador; isso não certifica toda resposta futura da IA. Compilação definitiva aprovada sem rota de testes; lint sem erros. Publicação confirmada: `7a57653d5ea6040e95c68303baf037d93093216b`, `dpl_Emd2gGGgBR89GL2igdidy2uceS6C`, READY no domínio principal.
- Conferência com OpenAI real no PR-CHT: revisão apontou sintoma genérico e sugeriu redação sem alteração automática; consulta de referência reconheceu ausência de documento diretamente aplicável/AMM-FIM do operador. Não foi salvo registro operacional. A conversa pessoal permanece no histórico.
- Usuário optou por manter a integração OpenAI após esclarecimento sobre processamento externo, não treinamento por padrão e retenção distinta de store:false. Avaliação corporativa de privacidade permanece com a empresa.

- Correção identificada na conferência real: autorização com instruções adicionais (por exemplo, “Pode aplicar a redação que sugeriu aos campos, deixando a referência em branco. Sem salvar o registro.”) gera uma proposta nova, preservando os qualificadores, e aplica somente aos campos. Confirmação de aplicação depende do resultado real da interface. Perguntas, condições e negações não aprovam a alteração. Regressão aprovada em 390/1366 px, incluindo desfazer e observação original; rótulos técnicos apresentados em português.

- Aceite final em produção confirmado: commit `6f64121be1bf8b9779e1f351fdb431cb6bc58977`, deployment `dpl_Gn4ir4f2v8xbkRxGqn8ZeJXRgSGR`, READY. Na IA real do PR-CHT, a autorização completa preencheu título/descrição com “Indicação intermitente do altímetro durante o voo” e componente Altímetro, mantendo Documento e demais referências vazios. Desfazer restaurou “Altimetro / Intermitente em vôo” e componente vazio. Relato fechado sem Confirmar atualização; nenhuma execução nem alteração operacional foi salva. A conversa pessoal de teste permanece.


### 10/09/2026 — usabilidade do relato, busca e importação

- Relato principal no topo, comentários amigáveis e vinculação em janela própria com filtros progressivos. Busca paginada no banco respeita as permissões existentes, inclusive para registros antigos.
- Enter envia; Shift+Enter quebra linha nos compositores de chat, comentários e IA. Formulários e confirmações técnicas mantêm o fluxo de salvar; seletores usam Enter para escolher.
- Horários/datas são rejeitados como cliente/plataforma; importação preserva o valor original nas observações e deixa o destino desconhecido vazio. Voos incompletos continuam em Programado.
- Seletor pesquisável de cliente/plataforma e mitigação de interferência de preenchimento automático. LastPass no Chrome do usuário ainda não reproduzido; não se afirma controle sobre a extensão.
- 149 testes de lógica/rotas, TypeScript e lint aprovados. Navegador 390/1366: relato, comentários, busca remota/paginação/período, seletores, importação/conversa e regressão do mural aprovados. Teste SQL real com rollback confirmou acesso por base, ordenação e paginação.
- Detalhes e limites em [revisao-usabilidade-2026-09-10.md](revisao-usabilidade-2026-09-10.md). Publicação autorizada; conferência do deployment ao concluir esta entrega.
