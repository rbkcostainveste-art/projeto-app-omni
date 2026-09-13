# Assistente da apresentação

O assistente público explica a proposta, relaciona ferramentas a benefícios e encaminha o visitante para assuntos existentes na página. A linguagem começa simples e acompanha a profundidade das perguntas. Não usa o assistente operacional, não autentica usuários e não executa ações no aplicativo.

## Conteúdo e navegação

`presentation-assistant-knowledge.ts` monta o contexto exclusivamente a partir dos textos editoriais públicos, recursos e vídeos da apresentação. O catálogo cobre os 56 assuntos do dossiê e fornece destinos internos validados. Imagens, nomes de arquivos e dados operacionais não entram no contexto. As respostas distinguem recursos demonstráveis, propostas de integração e validações necessárias. Não devem alegar aprovação ANAC, conformidade já alcançada ou liberação de aeronave.

O modelo recebe no máximo 12 mensagens recentes, um contexto público limitado e instruções comerciais. Links retornados pelo modelo são identificadores: o servidor resolve apenas destinos do catálogo. Não há navegação externa, busca na internet, ferramentas ou acesso ao banco operacional. Texto de conversa não é fonte factual confiável. Nenhum código, segredo ou configuração interna é enviado como contexto.

## Dados e consumo

As perguntas e o histórico recente são enviados à OpenAI; o rodapé do chat informa isso. Não se gravam conversas no banco, em localStorage ou nos logs da aplicação. O histórico da interface dura enquanto o componente está aberto na página. A chamada usa `store: false`; isso não equivale a garantir ausência de retenção de segurança pelo provedor. A política corporativa deverá avaliar os termos aplicáveis antes de uso empresarial.

O banco mantém somente contadores de uso, com RLS e acesso direto bloqueado. A chave diária do cliente é um HMAC do endereço de rede, gerado no servidor; não se salva IP bruto. Limites fixos: 8 consultas/minuto e 60/hora por chave, 1.000/dia no total. Janelas UTC; falha do controle de quota impede a chamada paga. A função pública somente consome quota e não expõe mensagens ou contagens. Pedidos diretos à função podem consumir a cota e reduzir disponibilidade, mas não aumentar o teto diário. A API também limita origem, tamanho de pedido, saída e duração. A infraestrutura continua responsável por proteção adicional contra abuso.

## Configuração

Reutiliza `OPENAI_API_KEY` e `OPENAI_MODEL`, somente no servidor. `PRESENTATION_ASSISTANT_MODEL` permite configurar modelo próprio para a apresentação. `PRESENTATION_ASSISTANT_ENABLED=false` desativa o endpoint sem alterar o assistente operacional. Nenhuma variável secreta usa prefixo público. Aplicar a migração de quota antes de publicar o endpoint.

## Verificação

- `node --test tests/presentation-assistant.test.cjs tests/presentation-assistant-knowledge.test.cjs`
- Executar o teste SQL de quota com rollback.
- Conferir diálogo, teclado, navegação por assunto, erro/retry e respostas de segurança, ferramenta e limite de escopo em computador e celular.

Referências de implementação: [Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) e [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
