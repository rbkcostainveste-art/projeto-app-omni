# Integração AISWEB

Consulta disponível em **Cockpit → AIS**, por código ICAO. A rota autenticada
`/api/cockpit-ais` consulta o servidor oficial `https://api.decea.mil.br/aisweb/`.

- ROTAER: identificação, coordenadas, elevação, pistas, frequências e observações.
- NOTAM: lista atual da localidade, com número, tipo, referência, texto original,
  vigência, períodos de atividade e limites verticais. A busca inclui emissões
  antigas ainda vigentes; `all=1` sem `minutes` limitaria o histórico a 24 horas.
- Nascer/pôr do sol: data escolhida e dia seguinte, com horários expressos em UTC.
- METAR/TAF continuam na integração REDEMET existente.

Os produtos falham independentemente. Indisponibilidade, resposta inválida ou
lista incompleta nunca são apresentadas como ausência de NOTAMs. Nova consulta
substitui os resultados anteriores; mudar local/data cancela a requisição em
andamento. Os dados não são persistidos no banco, nem servidos de cache.

A consulta é da localidade escolhida. Não monta automaticamente um briefing
completo de rota/FIR/alternados. Cartas e demais publicações continuam acessíveis
no portal oficial, vinculado em cada consulta. O resumo ROTAER não substitui o
conjunto completo de campos e vínculos da publicação.

## Configuração

`AISWEB_API_KEY` e `AISWEB_API_PASS` são variáveis privadas de servidor. Na Vercel,
cadastrar ambas como **Secret**, no ambiente Production. Nunca usar prefixo
`NEXT_PUBLIC_`, salvar os valores em registros do aplicativo ou versionar arquivos
de credenciais. O arquivo local `.env.aisweb.local` é apenas usado na preparação;
Next.js não o carrega automaticamente. Para desenvolvimento, injetar suas
variáveis no processo ou usar `.env.local`, também ignorado pelo Git.

A rota exige sessão com identidade ativa, seguindo a mesma validação da consulta
REDEMET. Há limite de tamanho XML, tempo de consulta, validação de estrutura,
ICAO e data; DTD/entidades externas e redirecionamentos são recusados. URLs do
provedor que possam conter credenciais não são retornadas ao navegador.

## Validação em 12/09/2026

- `node --test tests/aisweb.test.cjs`: preservação dos campos, substituição e
  cancelamento, resposta vazia/incompleta, erros do provedor, bloqueio de XML
  inseguro, proteção de credenciais e autenticação da rota.
- Consulta real SBJR: ROTAER, 13 NOTAMs e horários solares de dois dias.
- Credenciais cadastradas na Vercel como Secret de produção, sem expor valores.
- Os 11 testes automatizados, lint dos arquivos alterados e build de produção passaram.
- Tela validada em 1280 e 390 px, com dados simulados: consulta, detalhes,
  troca de aeródromo e falha isolada de NOTAM sem apresentar ausência de avisos.
  Sem erros de console ou transbordamento horizontal.

A fixture `tests/fixtures/aisweb-page.tsx` permite repetir a verificação visual
com uma rota temporária de desenvolvimento; ela não é uma página publicada.

Documentação oficial: https://documenter.getpostman.com/view/7201070/SzKQyg3H
Portal oficial: https://aisweb.decea.mil.br/?i=publicacoes&p=api
