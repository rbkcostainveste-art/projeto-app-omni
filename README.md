# Passagem de Pista

Timeline operacional de aeronaves, do lançamento ao corte do voo.

## Teste local

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000` e use a matrícula `1024` com a senha `1234`.

O MVP funciona em modo demonstração usando armazenamento local. Para ativar a persistência compartilhada, crie um projeto Supabase, copie `.env.example` para `.env.local`, preencha as duas variáveis públicas e aplique a migration em `supabase/migrations`.

## Status dos cards

- Amarelo: alteração ainda não reconhecida pelo usuário atual.
- Azul: usuário atual está ciente da versão mais recente.
- Verde: aeronave com acionamento confirmado, em voo.
- Cinza: corte confirmado; card encerrado e bloqueado.

## Validação

```bash
pnpm lint
pnpm build
```
