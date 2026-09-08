# Pendências para conectar o Cockpit

Situação em 08/09/2026: campos locais disponíveis e opcionais. Nenhuma integração com eDB ativa. A imagem recebida identifica a marca Sigtrip e o módulo eDB; não confirma fornecedor, endereço ou disponibilidade de API.

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

- REDEMET: chave autorizada para METAR/TAF. O adaptador já existe, mas depende da configuração segura de REDEMET_API_KEY e de teste real.
- AISWEB: acesso/documentação para NOTAM e informações aeronáuticas. O adaptador ainda precisa ser implementado e validado.
- Lista de bases, aeródromos, helipontos/plataformas, códigos, coordenadas e fusos; confirmar cobertura das fontes para cada local.
- Definir frequência de atualização e indicação de dados vencidos/indisponíveis. Horários solares hoje são referências manuais com data.

## 3. Jornada e regras — solicitar à operação responsável

- Manual e enquadramento aplicável, apêndice RBAC 117, acordos e regras de apresentação, refeição, liberação, repouso e noturno.
- Responsável que validará os cálculos e exemplos reais conferidos.
- Histórico de jornadas e horas de voo que cubra os períodos exibidos, inclusive o ano e janelas móveis.
- Definição da FIRA e seus campos, origem dos dados e critérios de edição/regeneração.

Os campos existem; o cálculo completo de disponibilidade regulamentar ainda depende dessas definições e implementação. Dados incompletos não comprovam aptidão.

## 4. Cadastros e documentação operacional

- Habilitações, certificados, validades e designações por matrícula; responsável por atualização.
- Contratos e relação com aeronaves, bases e operações.
- Modelos de documentos por voo e quem consulta, preenche, confere ou assina cada um.
- Procedimentos e nomenclaturas de Fuel Check, BFF, HUMS/ST, itens diferidos, RTS e liberação de aeronavegabilidade.
- Contadores por equipamento, unidades, valores iniciais e tratamento de substituição/reset.

Até a validação, manter preenchimento manual e opcional para os testes. Alguns campos são referências livres; o mapeamento detalhado será ajustado à documentação do fornecedor.

## Texto para encaminhar à TI

Estamos preparando uma integração do nosso aplicativo operacional com o eDB exibido no Sigtrip. Precisamos confirmar o fornecedor e obter contato técnico, documentação da API, recursos disponíveis para leitura/preenchimento, ambiente de homologação e método de autenticação. O eDB continuará sendo o registro oficial. Também precisamos saber como identificar voos, aeronaves, tripulantes e diários, evitar envios duplicados e receber as alterações realizadas no sistema oficial.
