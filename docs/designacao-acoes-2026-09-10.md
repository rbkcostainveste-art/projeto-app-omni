# Designação das ações — 10/09/2026

- [x] Designação aberta e visível em Gerar ação e Nova atividade, com busca por nome/matrícula e filtros de frota, missão e turno.
- [x] Selecionar resultados de outro filtro preserva as pessoas já escolhidas. É possível limpar a designação ou deixar para escolher depois.
- [x] Editar finalidade e executantes nas ações já criadas, tanto na linha do tempo do relato quanto em Atividades.
- [x] Gravação confirmada antes de fechar a edição; erro mantém os campos para nova tentativa. Versão antiga e executante inválido/outra base são rejeitados pelo banco.
- [x] Histórico original preservado. A nova designação aparece na ação atual, e uma atualização é acrescentada à linha do tempo do relato vinculado.
- [x] Autor de atividade não recebe comandos Dar OK/Dar ciência da própria criação. Ciência dos destinatários continua individual; não foi gerada ciência nem execução automática.
- [x] Conferidos inspetor, coordenador de manutenção, gerente de manutenção, diretor de manutenção, administrador e gestor do aplicativo: criação vinculada e independente, edição pelo autor e limites de base.

Coordenação operacional é uma função distinta de coordenação de manutenção. Esta entrega mantém a permissão de ações técnicas com a manutenção e a administração, além das permissões de liderança já existentes. A edição permanece com o autor autorizado; esta entrega não concede edição geral de ações de outras pessoas.

## Verificação

- 160 testes unitários passaram.
- Navegador em 390 e 1366 pixels: criação com seleção acumulada, gravação no relato, edição na atividade, falha/nova tentativa e diferença entre autor e destinatário.
- Banco real em transação revertida: seis funções autorizadas; bloqueios para funções não habilitadas, outra base, executante inválido e revisão desatualizada; atribuição, remoção, autoria, histórico e preservação de ciência/execução.
- A migração mantém compatibilidade com a interface anterior. Os testes não deixam atividades, usuários modificados ou relatos de demonstração no banco.

Arquivos de reprodução: `tests/action-assignment.sql`, `tests/action-assignment-browser.cjs` e `tests/fixtures/action-assignment-page.tsx`. A página de teste é montada apenas localmente e não acompanha a publicação.
