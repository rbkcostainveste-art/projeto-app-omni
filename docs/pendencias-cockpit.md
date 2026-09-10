# Pendências para conectar o Cockpit

Atualizado em 09/09/2026. Revisão documental baseada no código local, no histórico das entregas e nos testes relatados pelo usuário. Esta atualização não representa novos testes de produção nem validação das regras da empresa.

## Checklist de situação

- [x] REDEMET conectada e testada na entrega anterior; METAR/TAF com decodificação em português e acesso ao boletim original.
- [x] Frota importada do RAB/ANAC: 88 aeronaves, conforme registro da entrega anterior. As novas receberam base “A definir”; disponibilidade no aplicativo não comprova situação operacional real.
- [x] Biblioteca pública de demonstração: 17 documentos, 598 páginas e 1.610 trechos indexados.
- [x] OpenAI configurada na Vercel; usuário confirmou resposta e consulta com fontes em 09/09/2026.
- [x] Campos de jornada, resumos de horas e apresentação/check-in disponíveis no código. Isso não encerra a validação regulamentar.
- [ ] AISWEB automática: chave ainda não recebida, conforme confirmação do usuário em 09/09/2026; adaptador e teste de integração pendentes.
- [ ] Confirmar bases, emprego e situação operacional da frota com o operador.
- [ ] Fechar regras de jornada e validar exemplos com a operação.
- [ ] Definir e validar modelo, dados e fluxo da FIRA.
- [ ] Confirmar habilitações, autorizações e documentos oficiais do operador.
- [ ] Integrar eDB/TC/OS após obter acesso e documentação.
- [ ] Receber e conectar acervo autorizado de manuais completos.

Antes da implementação de IA em todos os módulos, criar um checklist próprio por etapa e registrar nele execução, verificação e dependências. A transformação global ainda não foi iniciada nesta atualização.

Nenhuma integração com eDB está confirmada. A imagem anterior identifica a marca Sigtrip e o módulo eDB; fornecedor, endereço e API devem ser confirmados pela TI, inclusive a relação com os nomes WinAir/WINAR citados na conversa.

## 1. eDB / Sigtrip — solicitar à TI ou ao responsável pelo diário

- URL do portal e identificação do fornecedor (página Sobre, suporte ou contrato).
- Contato técnico responsável e autorização para integrar o aplicativo.
- Documentação da API e indicação das operações disponíveis para consulta e preenchimento.
- Ambiente de homologação com dados de teste, método de autenticação e permissões necessárias.
- Correspondência de aeronaves, funcionários/matrículas, voos, trechos, diários/páginas e equipamentos entre os sistemas.
- Exemplos sem dados pessoais de requisições e respostas; unidades, fusos, campos obrigatórios e códigos de situação.
- Regras de assinatura, aceite, liberação, fechamento/reabertura e retorno de erros.
- Forma de consultar alterações feitas no eDB, confirmação de recebimento, limites de uso e prevenção de duplicações.

O eDB permanece oficial. A integração deverá respeitar suas correções e permissões. Exportar um rascunho aqui não significa enviá-lo ou assiná-lo lá. Informar URLs e referências em Cadastros → Cockpit → Integração eDB; guardar credenciais somente na configuração segura do servidor.

## 2. Meteorologia / AIS — solicitar acesso às fontes

- REDEMET: integração e teste real concluídos na entrega anterior. O servidor usa REDEMET_API_KEY; não registrar seu valor neste documento. Fonte, horário de consulta e falhas do provedor são tratados pela rota. Decodificação em português não substitui o boletim original.
- AISWEB: solicitação enviada, chave ainda não recebida. O adaptador ainda precisa ser implementado e validado. O Cockpit já oferece o botão “Consultar AISWEB / NOTAM” para consulta manual no portal oficial.
- Lista de bases, aeródromos, helipontos/plataformas, códigos, coordenadas e fusos; confirmar cobertura das fontes para cada local.
- Confirmar com a operação frequência de atualização e critérios de informação vencida por produto. A consulta REDEMET atual é acionada pelo usuário e registra a obtenção; não equivale a monitoramento automático. Horários solares continuam referências manuais com data.

### AISWEB — acompanhamento do acesso

O [procedimento oficial](https://ajuda.decea.mil.br/base-de-conhecimento/como-solicitar-a-chave-da-api-aisweb/) prevê análise pelo DECEA e envio posterior da chave. Não foi encontrada indicação oficial de prioridade por provedor de e-mail ou prazo garantido. Trocar de e-mail pode resolver um problema de recebimento, mas não há evidência de que acelere a análise.

Próxima ação recomendada: consultar o andamento pelo [SAC-DECEA](https://servicos.decea.mil.br/sac/), citando data, e-mail e protocolo da solicitação original, se disponível. Nenhuma nova solicitação ou mensagem foi enviada nesta atualização.

Texto preparado para o usuário encaminhar:

> Solicitei acesso à API AISWEB para o Flight AI, aplicativo em desenvolvimento disponível em https://passagem-de-pista.vercel.app/, e ainda não recebi as credenciais. Solicito confirmação do recebimento e orientação sobre o andamento. Data da solicitação: [preencher]. E-mail utilizado: [preencher]. Protocolo, se houver: [preencher]. Se houver problema de entrega, posso informar outro e-mail de contato.

A [página oficial da API](https://aisweb.decea.mil.br/?i=publicacoes&p=api) também divulga geosserviços WFS/WMS para dados geográficos. São uma alternativa a avaliar para mapas/camadas; não foram integrados e não substituem automaticamente a consulta de NOTAM. Enquanto isso, usar o portal oficial pelo atalho existente.

## 3. Jornada e regras — solicitar à operação responsável

- Manual e enquadramento aplicável, apêndice RBAC 117, acordos e regras de apresentação, refeição, liberação, repouso e noturno.
- Responsável que validará os cálculos e exemplos reais conferidos.
- Histórico de jornadas e horas de voo que cubra os períodos exibidos, inclusive o ano e janelas móveis.
- Definição da FIRA e seus campos, origem dos dados e critérios de edição/regeneração.

O código já registra horários e apresenta somatórios/saldos de referência condicionados à regra e ao histórico informados. A apresentação prevista usa a programação e antecedência configurável. O cálculo completo de disponibilidade regulamentar ainda depende das definições acima, implementação complementar e validação. Dados incompletos não comprovam aptidão.

Para fechar esta pendência, a operação deve fornecer a regra aplicável e casos conferidos de jornada normal, virada de dia, refeição, repouso, noturno e histórico incompleto. A implementação deve reproduzir os resultados aprovados e indicar quando não há dados suficientes.

Para a FIRA, solicitar um modelo em branco ou exemplo anonimizado, significado dos campos, origem de cada dado, responsáveis e regras de correção/regeneração. A pendência só termina após comparar a saída do aplicativo com um exemplo aprovado; não presumir que exportação genérica corresponde à FIRA oficial.

## 4. Cadastros e documentação operacional

- Habilitações, certificados, validades e designações por matrícula; responsável por atualização.
- Contratos e relação com aeronaves, bases e operações.
- Modelos de documentos por voo e quem consulta, preenche, confere ou assina cada um.
- Procedimentos e nomenclaturas de Fuel Check, BFF, HUMS/ST, itens diferidos, RTS e liberação de aeronavegabilidade.
- Contadores por equipamento, unidades, valores iniciais e tratamento de substituição/reset.

Até a validação, manter preenchimento manual e opcional para os testes. Alguns campos são referências livres; o mapeamento detalhado será ajustado à documentação do fornecedor.

Documentação por voo já aceita nome, link, PDF/imagem e indicação de assinatura requerida no eDB. Isso não implementa assinatura externa. Para concluir, o operador deve fornecer modelos vigentes, campos obrigatórios e responsáveis por preenchimento, conferência e assinatura. Para contadores, o mecanismo existente deve ser conferido com unidades e valores iniciais reais, incluindo substituição/reset.

## Texto para encaminhar à TI

Estamos preparando uma integração do nosso aplicativo operacional com o eDB exibido no Sigtrip. Precisamos confirmar o fornecedor e obter contato técnico, documentação da API, recursos disponíveis para leitura/preenchimento, ambiente de homologação e método de autenticação. O eDB continuará sendo o registro oficial. Também precisamos saber como identificar voos, aeronaves, tripulantes e diários, evitar envios duplicados e receber as alterações realizadas no sistema oficial.
