# Impedimentos da preparação visíveis aos participantes do voo

> Atualização posterior de 10/09/2026: a visibilidade dos impedimentos foi mantida, mas o usuário retirou a confirmação final manual. O fluxo vigente está em [Preparação operacional simples](preparacao-simples-2026-09-10.md). O restante deste documento registra a entrega anterior.

## Comportamento

- [x] Mostrar o checklist da manutenção separadamente: quantidade de OKs e verificações que faltam.
- [x] Mostrar os impedimentos técnicos mesmo quando todos os itens do checklist estão OK.
- [x] Distinguir checklist concluído, impedimento técnico, confirmação final e necessidade de reconfirmação.
- [x] Usar a mesma apresentação nos cartões do piloto, cockpit, trilhos, coordenação, programação e detalhes da operação.
- [x] Atualizar ao retornar à janela, após alterações e por consulta periódica de 10 segundos.
- [x] Respeitar o acesso ao voo. Títulos e códigos de ocorrências seguem as permissões existentes dos relatos; os demais participantes autorizados veem o motivo operacional, sem detalhes restritos.

Os motivos apresentados incluem avaliação técnica, indisponibilidade, manutenção, alerta crítico, teste não satisfatório, discrepância sem disposição válida e prazo de diferimento vencido. Mostram-se até cinco ocorrências, das mais recentes para as antigas, com o total adicional quando houver.

Esta entrega não altera critérios de prontidão, assinaturas, registros operacionais ou a confirmação final pelo mecânico. Documentação do piloto continua separada. Os efeitos valem para voos existentes e novos; não é necessário apagar um voo para receber a atualização.

## Validação

- [x] Migração `20260910222013_preparation_impediment_details` aplicada no banco.
- [x] Teste transacional com rollback: quatro OKs e impedimento simultâneos; confirmação bloqueada; títulos protegidos por função/base; voo fora da tripulação protegido; confirmação e reconfirmação preservadas; acesso anônimo bloqueado.
- [x] Regressões de operação de voo e preparação/MEL no banco, com rollback.
- [x] 157 testes automatizados locais aprovados; TypeScript e lint dos arquivos alterados aprovados.
- [x] Navegador em 390 px e 1366 px: impedimento, privacidade do título, confirmação desabilitada, conclusão, reconfirmação, verificação ausente e ocultação após inativação; sem erro de página ou transbordamento horizontal.
- [x] Inspeção visual das capturas em celular e desktop.
- [x] Build de produção aprovado, incluindo TypeScript e geração das páginas.
- [x] Publicação em produção e conferência no site.

Arquivos de teste: `tests/preparation-display.test.cjs`, `tests/preparation-visibility.sql` e `tests/preparation-mel-browser.cjs`. O teste visual usa dados fictícios e a página temporária é removida antes do build.

O build local inicialmente encontrou funções Deno de uma cópia antiga dentro de `tmp/release-mel-preparation`. A pasta `tmp` foi excluída do escopo do TypeScript do aplicativo; o build completo passou após esse ajuste, sem desabilitar a verificação de tipos.

O verificador de segurança do banco não apontou achado para a função privada alterada. Avisos preexistentes do projeto permanecem fora desta entrega; esta verificação não declara o projeto inteiro livre de avisos.

## Publicação verificada

- Código: `367749a33ad5808363ff56fe23a4bb2e6cec42af`.
- Vercel: `dpl_A9xKzpNfkf1ZbB86wyncpBZ2HkQY`, estado `READY`, domínio de produção `https://passagem-de-pista.vercel.app`.
- Na sessão real já aberta, o cartão do PR-OHG exibiu `Checklist da manutenção concluído · 4/4 conferidos` e `Aguardando confirmação final da manutenção` após a atualização.
- A conferência de produção foi somente de leitura. Os cenários com impedimento e privacidade foram verificados no banco com rollback e no navegador com dados fictícios.
