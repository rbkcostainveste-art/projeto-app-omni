# Revisão de usabilidade e importação — 10/09/2026

Ajustes autorizados após a conferência da versão 75e7bdfc. Implementação e testes desta entrega abaixo; publicação conferida ao concluir o deploy.

## Aplicado

- [x] Relato principal primeiro: título, descrição, prefixo, código e situação em destaque. Anexos disponíveis no mesmo bloco; ações, acompanhamento, execução e comentários abaixo.
- [x] Comentários amigáveis: campo aberto “Escreva um comentário…” e botão Enviar. Elogios, dúvidas e observações preservam autoria e permissões; não alteram o resultado técnico.
- [x] Vincular ocorrência em janela própria, com fundo opaco, pesquisa por prefixo/código/texto/TC e filtros progressivos de modelo, base, tipo, situação e período. Ordem por criação mais recente.
- [x] Busca paginada no banco: encontra também registros fora da lista já carregada. A RPC mantém as políticas de acesso do usuário e não concede acesso anônimo.
- [x] Enter envia e Shift+Enter cria nova linha nos chats, comentários e assistentes, inclusive programação. Composição de texto, repetição de tecla e envio em andamento não causam envio indevido. Formulários operacionais continuam com seus botões de salvar/confirmar; Enter nos seletores escolhe uma opção.
- [x] Horários e datas não podem ocupar cliente/plataforma. Importação limpa o campo incompatível e preserva o valor nas observações; validação de rascunhos e proposta do assistente também verifica esse erro. O prompt diferencia cabeçalhos de saída, chegada, duração e destino, sem presumir dados ausentes.
- [x] Seletor próprio pesquisável de cliente/plataforma, com fundo opaco e opção de escrever um nome novo. Aeronave continua limitada ao catálogo permitido.
- [x] Campos de busca de aeronave e cliente/plataforma têm autocomplete desativado e sinalização para gerenciadores de senhas não interferirem.

## Já publicado antes desta entrega e conferido novamente

- [x] Galeria, arquivos, câmera, múltiplos anexos e colagem nos assistentes/chats.
- [x] Histórico, filtros e republicação do quadro da manutenção; publicações recentes primeiro e texto sem imagem aproveitando o card.
- [x] Público da manutenção sem tripulantes; filtros de base preservados.
- [x] Voos incompletos salvos em Programado e separados em levas.

## Verificação

- 149 testes unitários/de rotas aprovados; TypeScript e lint dos arquivos alterados sem erros.
- Navegador em 390 e 1366 px: hierarquia do relato, comentários com Shift+Enter/Enter, pesquisa remota com 45 ocorrências, paginação e filtros combinados, retorno ao relato e seletores com teclado/fundo opaco.
- Regressões em 390 e 1366 px: múltiplas imagens, colagem, revisão/aplicação/desfazer, preservação do relato original, programação incompleta em levas, mural e republicação sem tripulantes. Respostas do modelo controladas nesses testes.
- SQL real em transação revertida: paginação, ordenação, período, bloqueio de registros de outra base para mecânico, bloqueio de ocorrência raiz inacessível e ausência de acesso anônimo. Nenhum dado operacional de teste permanece.
- Migração aplicada: `20260910151026_search_related_occurrences.sql`. Verificador de segurança não apontou os novos objetos.

## Limite da verificação

A captura do usuário identifica a extensão LastPass. A proteção dos campos foi aplicada, mas a interferência específica da extensão no Chrome do usuário não foi reproduzida no navegador de testes. O site não pode garantir que toda extensão respeite esses atributos.

Esta entrega corrige os itens desta revisão. Ela não declara concluído todo o inventário mais amplo de IA e regras operacionais do aplicativo.

Build definitivo aprovado, sem a rota de testes.
