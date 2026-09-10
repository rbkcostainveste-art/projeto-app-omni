# Cobertura funcional da IA

Atualizado em 10/09/2026. Complementa checklist-ia.md; o registro de deployment nesse checklist determina o que já está publicado. Não representa conclusão integral.

| Área | Consulta conectada | Campos conectados ao formulário | Limite / próximo passo |
| --- | --- | --- | --- |
| Mural | Timeline e avisos, filtros e audiência autorizada | Nova publicação, edição, comentário; título/texto/categoria | Validar todos os públicos com sessões reais |
| Atividades | Designações pessoais e por escopo | Nova atividade e execução: título, finalidade, TC, prefixo, categoria, prioridade e responsável declarado | Ampliar seleção múltipla de responsáveis/destinatários |
| Relatos | Relatos reais abertos/fechados por prefixo/base | Novo: prefixo, título, descrição, TC; existente: correção, execução, comentário e geração de ação | Demais campos técnicos estruturados ainda precisam de adaptadores; nenhuma liberação inferida |
| Passagem de Pista | Registros autorizados | Checks visíveis, observações, caso técnico, óleo/quantidades/unidades | Proposta revisada; confirmação de lavagem e assinatura preservadas |
| Lavagem / secagem | Eventos desde instalação e vínculo ao ciclo de secagem | Marcações pelos controles da passagem | Histórico anterior incompleto; ausência de pendência não comprova secagem executada |
| Frota | Cadastro por escopo | Prefixos são opções dos formulários | Cadastros administrativos da frota ainda não integralmente adaptados |
| Coordenação | Voos por escopo | Programar/editar: data, horários, destino, combustível, posição, tripulação, repetição | Importação em lote tem revisão; falta aceite com programações representativas do operador |
| Documentação do voo | Registros do Cockpit autorizados | Briefing, nome/link do documento, requisito de assinatura | Arquivo vinculado permanece no fluxo de upload; não inventar links |
| Cockpit | RPC com autorização individual dos registros | Campos declarados de 11 tipos; editor original | Regras regulamentares e dados derivados não definidos pela IA |
| Contadores | Via registros autorizados do Cockpit | Valor anterior e identificação do equipamento | Incrementos/valores derivados continuam calculados pelo aplicativo |
| Planejamento de manutenção | Registros/voos autorizados | Posição, necessidade de tripulação e pessoas elegíveis | Salvar pelo fluxo existente |
| Ferramentaria | Caixas/operações/eventos dentro do escopo | Retirada/caixa/pessoa/prefixo/descrição; seleção múltipla conferida; gaveta/ferramenta/medida/posição | Revalidação e assinatura originais; não inferir medida só pela imagem |
| Notas pessoais | Somente notas do próprio usuário | Título, texto, prefixo, lembrete/notificação; conversão em rascunho | Anexos privados não enviados na consulta; navegação original |
| Clientes / plataformas | Sem consulta geral própria | Nomes e seleção existente nos controles declarados | Demais cadastros administrativos pendentes |
| Ajuda | Sem pesquisa semântica do catálogo de ajuda | Metadados do vídeo: título/perfil/tela/ativo | Upload e gravação originais |

## Capacidades transversais

- Português natural, contexto declarado de tela/card/filtros e identidade verificada no servidor.
- Consultas por ferramentas e respostas com cards autorizados; revalidação ao abrir.
- Conversas pessoais, títulos automáticos, histórico por assunto. A criação ainda pode deixar conversa vazia ao abrir um contexto novo: otimização pendente.
- Pedido composto continua na mesma conversa ao abrir relato, passagem, Cockpit e nota. Outros destinos ainda não têm encadeamento automático de preenchimento.
- Texto, até três imagens/PDF (2 MB somados) e voz transcrita. Revisão ou envio automático; formulários começam em revisão.
- Aplicação ao rascunho, desfazer, proteção contra resposta obsoleta e opções inventadas. Persistência pelo botão original; assinatura/permissão não delegadas ao modelo.
- Câmera ao vivo ainda usa sessão separada: não possui as mesmas ferramentas do agente de texto.

## Critérios ainda não cumpridos globalmente

Inventário completo de campos, comandos entre todos os módulos, planilhas/documentos maiores, acervo técnico licenciado, medição/limites distribuídos de consumo e aceite de todos os cargos/bases. Testes automatizados e de administrador não substituem teste de voz em pista nem aceitação do operador.
