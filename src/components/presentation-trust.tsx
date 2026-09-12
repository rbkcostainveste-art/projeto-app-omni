import type { ReactNode } from "react";
import { ArrowDown, ArrowUpRight, BookOpen, ChevronDown, ClipboardCheck, Database, FileCheck2, Fingerprint, GraduationCap, Link2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import "./presentation-trust.css";

const sources = {
  lgpd: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm",
  transfer: "https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024",
  incident: "https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis",
  rbac43: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/rbha-e-rbac/rbac/rbac-43",
  rbac135: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/rbha-e-rbac/rbac/rbac-135",
  rbac145: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/rbha-e-rbac/rbac/rbac-145",
  diary: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/resolucoes/2025/resolucao-773",
  electronic: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/resolucoes/2017/resolucao-no-458-20-12-2017",
  maintenance: "https://pergamum.anac.gov.br/pergamum/vinculos/IS120-016C.pdf",
  mel: "https://pergamum.anac.gov.br/pergamum/vinculos/IS91-012C.pdf",
};

function Source({ href, children }: { href: string; children: ReactNode }) {
  return <a className="p-trust-source" href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={13} aria-hidden="true" /></a>;
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return <div className="p-trust-point"><h4>{title}</h4><div>{children}</div></div>;
}

function Panel({ title, teaser, icon, children, id }: { title: string; teaser: string; icon: ReactNode; children: ReactNode; id?: string }) {
  return <details className="p-trust-panel" id={id}>
    <summary><span className="p-trust-icon" aria-hidden="true">{icon}</span><span className="p-trust-summary"><strong>{title}</strong><span>{teaser}</span><em>Explorar o tema <ChevronDown size={14} aria-hidden="true" /></em></span><ChevronDown className="p-trust-chevron" size={20} aria-hidden="true" /></summary>
    <div className="p-trust-body">{children}</div>
  </details>;
}

function Intro({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return <div className="p-trust-intro"><p className="p-trust-eyebrow">{step}</p><h2>{title}</h2><p>{children}</p><span className="p-trust-hint"><ArrowDown size={15} aria-hidden="true" /> Clique nos temas para ver os detalhes</span></div>;
}

export function PresentationSecurity() {
  return <section id="seguranca" className="p-trust-section p-trust-security">
    <Intro step="1. PRIMEIRO, SEGURANÇA" title="A adoção começa pela segurança.">A proposta considera infraestrutura, proteção de dados e integração sob os critérios da empresa.</Intro>
    <p className="p-trust-status"><ShieldCheck size={16} aria-hidden="true" /><strong>Condições para implantação corporativa.</strong> Os controles abaixo devem ser definidos, implementados e comprovados antes do uso operacional.</p>
    <div className="p-trust-grid p-trust-three">
      <Panel title="Implantação corporativa" teaser="Aplicativo e banco em ambiente aprovado pelo TI." icon={<Database />}>
        <div className="p-trust-columns">
          <Point title="Construir no ambiente definido pela empresa"><p>O desenvolvimento, a homologação e a produção deverão ter ambientes separados, repositório aprovado, revisão de alterações e responsáveis definidos. A operação corporativa não dependerá do computador do autor.</p></Point>
          <Point title="Banco de dados e arquivos sob controle"><p>TI definirá hospedagem, localização dos dados, fornecedores, criptografia em trânsito e em repouso, credenciais protegidas, acesso de suporte e segregação entre ambientes.</p></Point>
          <Point title="Reaproveitar o que já foi construído"><p>O protótipo oferece fluxos, componentes e código para reduzir o trabalho de descoberta. O reaproveitamento depende da avaliação de arquitetura, segurança, licenças e manutenção; ajustes poderão ser necessários.</p></Point>
          <Point title="Continuidade da operação"><p>Prever monitoramento, atualização de dependências, cópias de segurança, testes de restauração, exportação de dados, suporte e procedimento de contingência. Falhas de conexão devem ser visíveis e tratadas antes de confiar na atualização de um registro.</p></Point>
        </div>
        <p className="p-trust-callout">Arquitetura proposta: usuários autorizados → aplicativo → banco e arquivos aprovados → integrações expressamente habilitadas.</p>
      </Panel>
      <Panel title="Integração conforme a empresa" teaser="Pode conectar sistemas internos, conforme política e necessidade." icon={<Link2 />}>
        <div className="p-trust-columns">
          <Point title="Conexões com finalidade clara"><p>A solução pode ser adaptada para integrar programação, identidade corporativa, manutenção ou diário eletrônico, conforme necessidade, interfaces disponíveis, política e autorização da empresa.</p></Point>
          <Point title="Cada integração precisa ser validada"><p>Definir dados enviados e recebidos, sistema que mantém o registro oficial, permissões, frequência, tratamento de erros e confirmação de recebimento. Um rascunho ou uma exportação local não equivale a registro aceito no sistema de destino.</p></Point>
          <Point title="Diário eletrônico / eDB"><p>O protótipo organiza informações de apoio. A integração com o diário oficial exige definição técnica e regulatória específica; uma marcação no aplicativo não produz automaticamente assinatura, aprovação ou lançamento no diário.</p></Point>
          <Point title="Serviços externos"><p>Fontes meteorológicas, informações aeronáuticas, IA e comunicação devem ser inventariadas. Credenciais, contratos, limites de uso e disponibilidade serão avaliados pelo TI antes de habilitar cada conexão.</p></Point>
        </div>
        <p className="p-trust-callout">A apresentação demonstra possibilidades. Não pressupõe conexão ou autorização de acesso aos sistemas internos da empresa.</p>
        <div className="p-trust-sources"><Source href={sources.diary}>Resolução ANAC 773/2025</Source><Source href={sources.electronic}>Resolução ANAC 458/2017</Source><a href="#bibliografia">Fontes DECEA e demais referências</a></div>
      </Panel>
      <Panel title="Proteção de dados e LGPD" teaser="Finalidade, acesso, retenção e responsabilidades definidos." icon={<LockKeyhole />}>
        <div className="p-trust-columns">
          <Point title="Coletar somente o necessário"><p>Mapear dados de colaboradores, contatos, escalas, mensagens, anexos e gravações. Para cada tratamento, definir finalidade e base legal, incluindo regras específicas para dados sensíveis. Consentimento não resolve, sozinho, todas as situações.</p></Point>
          <Point title="Responsabilidades e acesso"><p>Identificar controlador, operadores, fornecedores e canal de privacidade. Aprovar permissões por necessidade e revisar acessos quando houver mudança de função ou encerramento do vínculo.</p></Point>
          <Point title="Retenção, direitos e descarte"><p>Definir prazos por categoria, atendimento aos titulares e descarte controlado. Obrigações legais, regulatórias e preservação de evidências podem exigir conservação. Excluir uma conta não deve apagar registros de guarda obrigatória.</p></Point>
          <Point title="Evidências e incidentes"><p>Preparar inventário, contratos, matriz de acesso, testes de proteção e resposta a incidentes. Avaliar relatório de impacto conforme o risco. Prever contenção, preservação de evidências e análise das comunicações exigidas à ANPD e aos titulares.</p></Point>
        </div>
        <p className="p-trust-callout">LGPD: princípios, bases legais, conservação, transferências e segurança — arts. 6º, 7º/11, 15–16, 33–39 e 46–50. Conformidade depende da prática e das evidências da implantação.</p>
        <div className="p-trust-sources"><Source href={sources.lgpd}>LGPD — texto compilado</Source><Source href={sources.transfer}>ANPD — transferência internacional</Source><Source href={sources.incident}>ANPD — comunicação de incidentes</Source></div>
      </Panel>
    </div>
  </section>;
}

export function PresentationConfidence() {
  return <section id="confianca" className="p-trust-section p-trust-confidence">
    <Intro step="2. DEPOIS, CONFIANÇA" title="Transparência para decidir.">Entenda o papel da IA, a responsabilidade de cada profissional e as condições para usar registros e documentos.</Intro>
    <div className="p-trust-grid">
      <Panel title="Governança e rastreabilidade" teaser="Cada acesso, alteração e responsabilidade precisa ter um critério." icon={<Fingerprint />}>
        <div className="p-trust-columns">
          <Point title="Acessos por perfil"><p>Os acessos variam conforme o perfil, a área de atuação e as autorizações atribuídas. Base, frota e designação podem limitar a visibilidade conforme o recurso. A matriz final deverá ser aprovada pela empresa; acesso administrativo não substitui habilitação técnica.</p></Point>
          <Point title="Histórico e responsabilidades"><p>Definir autoria, data, contexto, versões, correções e revisão dos registros. Designar responsáveis pelo produto, conteúdo técnico e suporte. Mudanças precisam de avaliação, registro e treinamento quando aplicável.</p></Point>
          <Point title="Chat, notas e gravações"><p>Conversas vinculadas a um serviço ajudam a conservar o contexto. A política deverá informar quando uma chamada é gravada, quem pode acessar e por quanto tempo o conteúdo será mantido. Prazos variam conforme finalidade e obrigações.</p></Point>
          <Point title="Preservar o que precisa ser guardado"><p>A retenção automática e o bloqueio de descarte são requisitos a validar ou implementar. Preservar registros sujeitos a obrigação de guarda, investigação ou solicitação competente. A natureza informal de uma conversa não autoriza exclusão para evitar fiscalização.</p></Point>
        </div>
        <div className="p-trust-sources"><Source href={sources.lgpd}>LGPD</Source><Source href={sources.electronic}>Registros eletrônicos — Resolução 458</Source></div>
      </Panel>
      <Panel title="IA empresarial sob controle" teaser="Ajuda a preencher, organizar e escrever. O profissional revisa." icon={<Sparkles />}>
        <div className="p-trust-columns">
          <Point title="O que a IA pode apoiar"><p>Organizar dados informados, corrigir a redação, traduzir e consultar fontes autorizadas. Deve preservar os fatos, separar observação de conclusão e indicar informação ausente. O usuário compara o original, verifica a sugestão e decide aplicá-la.</p></Point>
          <Point title="Referência verificável"><p>A sugestão deve identificar documento, revisão, trecho ou página e aplicabilidade quando houver fonte correspondente. Sem referência aplicável, deve indicar a ausência e solicitar verificação. Referências, diagnósticos ou resultados não podem ser inventados.</p></Point>
          <Point title="Fornecedor, contrato e localização"><p>TI escolherá um serviço empresarial e as condições de envio de textos, anexos e áudio. Uso para treinamento, prazo de retenção e país de processamento são questões distintas e precisam de evidência contratual e técnica, incluindo suboperadores.</p></Point>
          <Point title="Limites da assistência"><p>A IA não certifica aeronavegabilidade, não libera aeronave, não decide despacho ou MEL e não elimina a possibilidade de erro. Validação, autorização e responsabilidade permanecem com as pessoas habilitadas.</p></Point>
        </div>
        <p className="p-trust-callout">O protótipo possui integração de IA externa. Não se afirma processamento apenas local, retenção zero ou aprovação corporativa. Transferências internacionais deverão seguir um mecanismo válido da LGPD e as regras aplicáveis da ANPD.</p>
        <div className="p-trust-sources"><Source href={sources.lgpd}>LGPD — arts. 33 a 36</Source><Source href={sources.transfer}>Resolução ANPD 19/2024</Source><a href="#explorador">Ver relato técnico e assistência de IA</a></div>
      </Panel>
      <Panel id="registros-tecnicos" title="Relatos técnicos e requisitos ANAC" teaser="Comunicação complementar com encaminhamento para o registro obrigatório." icon={<FileCheck2 />}>
        <p className="p-trust-lead">O aplicativo pode apoiar comunicação, acompanhamento de pesquisa de pane e passagem de serviço. Isso não dispensa os lançamentos oficiais exigidos pelo conteúdo da ocorrência.</p>
        <div className="p-trust-columns">
          <Point title="1. Descrever o fato"><p>Identificar aeronave, momento, sintoma e evidências. Uma irregularidade intermitente continua relevante. Nomes como “observação” ou “relato complementar” não alteram a obrigação de registrar ou avaliar um fato.</p></Point>
          <Point title="2. Revisar e encaminhar"><p>Profissional autorizado avalia o tratamento segundo os manuais e procedimentos aplicáveis. O fluxo deve conservar o vínculo com o diário ou registro exigido e a confirmação de que o lançamento foi realizado.</p></Point>
          <Point title="3. Separar tarefa de liberação"><p>Concluir atividades ou mostrar “preparação concluída” comunica uma etapa. Não equivale à liberação técnica, à autorização de voo nem à verificação de todas as condições de aeronavegabilidade.</p></Point>
          <Point title="4. Manter rastreabilidade"><p>Preservar o relato original, revisão, referência técnica, anexos, responsáveis e vínculo com a ação ou pane. A sugestão da IA só entra no registro após conferência humana.</p></Point>
        </div>
        <div className="p-trust-regulations">
          <div><h4>RBAC 135 · 135.65, 135.439 e 135.443</h4><p>Tratam de irregularidades, registros de manutenção e liberação, conforme o programa aplicável. A observação antes, durante ou depois do voo deve seguir o processo oficial exigido; o acompanhamento no app é complementar.</p><Source href={sources.rbac135}>Consultar RBAC 135 · EMD 15</Source></div>
          <div><h4>RBAC 43 e RBAC 145</h4><p>Execução, pessoas autorizadas, registros e organização de manutenção. A aplicação de 43.9 deve considerar seu parágrafo (b) e os requisitos do operador. Não se aplica uma única regra de conteúdo ou guarda a todo documento.</p><Source href={sources.rbac43}>RBAC 43 · EMD 05</Source><Source href={sources.rbac145}>RBAC 145 · EMD 09</Source></div>
          <div><h4>IS 120-016C · manutenção de operadores</h4><p>Orienta o programa e os registros de manutenção de empresas aéreas. Ajuda a definir responsabilidades do operador e da organização contratada, inclusive geração e conservação dos registros, conforme o escopo.</p><Source href={sources.maintenance}>Consultar IS 120-016C</Source></div>
          <div><h4>Resoluções 773/2025 e 458/2017</h4><p>Diário de bordo e uso de sistemas informatizados para registros obrigatórios. A substituição por meio digital exige enquadramento, segurança, integridade, assinaturas, conservação e autorização/aceitação aplicável da ANAC.</p><Source href={sources.diary}>Diário de bordo · Resolução 773</Source><Source href={sources.electronic}>Sistemas informatizados · Resolução 458</Source></div>
        </div>
        <p className="p-trust-callout">Essas normas orientam o enquadramento; não garantem que um relato fora do eDB esteja dispensado de registro obrigatório. Suspeita de trinca, alteração de pintura ou indicação intermitente exigem avaliação própria. O protótipo não está apresentado como sistema aprovado pela ANAC.</p>
      </Panel>
      <Panel title="Documentação técnica autorizada" teaser="Nesta etapa, o S-92A é o exemplo técnico usado no acervo público." icon={<BookOpen />}>
        <div className="p-trust-columns">
          <Point title="Qual é o acervo desta demonstração?"><p>O modelo usado como exemplo técnico é o Sikorsky S-92A, com nove referências públicas: ficha de certificação, diretrizes de aeronavegabilidade e boletins. Há também três publicações gerais da FAA; esses handbooks não são manuais específicos do S-92A.</p></Point>
          <Point title="Cada documento tem um papel"><p>A TCDS descreve dados de certificação. As ADs estabelecem ações dentro de sua aplicabilidade. SIB e SAIB têm natureza informativa. O conjunto não equivale ao AMM, FIM ou RFM completo da aeronave.</p></Point>
          <Point title="Futuro acervo corporativo"><p>A empresa deverá autorizar manuais licenciados e controlar origem, revisão, validade, aplicabilidade e permissões. Revisões obsoletas devem ser retiradas do uso conforme o procedimento de controle documental.</p></Point>
          <Point title="Consulta no cockpit e na manutenção"><p>A consulta deve permitir abrir e conferir a fonte. Um trecho recuperado pela IA só deve ser usado após verificar revisão e aplicabilidade. O acesso público de um arquivo não significa licença irrestrita para republicação.</p></Point>
        </div>
        <p className="p-trust-callout">As edições listadas documentam o material usado no protótipo. Sua presença não atesta vigência nem aplicabilidade a uma matrícula específica. Outros modelos mostrados visualmente no site não ampliam o acervo técnico demonstrativo.</p>
        <a className="p-trust-inline" href="#bibliografia">Abrir bibliografia completa <ArrowDown size={15} aria-hidden="true" /></a>
      </Panel>
      <Panel title="MEL, preparação e cockpit" teaser="Indicadores para organizar o trabalho, com os limites operacionais claros." icon={<ClipboardCheck />}>
        <div className="p-trust-columns">
          <Point title="Contador MEL como apoio"><p>O responsável informa referência, categoria, início e vencimento conforme a MEL aprovada e as regras aplicáveis. O contador ajuda a acompanhar o prazo; não concede postergação, extensão ou despacho e não decide a validade técnica da MEL.</p><Source href={sources.mel}>IS 91-012C</Source><Source href={sources.rbac135}>RBAC 135 · 135.179</Source></Point>
          <Point title="Preparação concluída"><p>A confirmação comunica que a manutenção concluiu as etapas daquele voo. Mudanças relevantes exigem nova conferência. O indicador e os avisos no aplicativo não substituem os registros oficiais ou as verificações do piloto.</p></Point>
          <Point title="Cockpit e jornada"><p>Organiza programação, apresentação, preparação, referências, ocorrências e apoio documental. A liberação de jornada do tripulante não é liberação técnica da aeronave. Limites de jornada e fadiga devem seguir o enquadramento e os procedimentos aprovados.</p></Point>
          <Point title="Informação atualizada"><p>A sincronização depende de conectividade e serviços disponíveis. Antes da implantação, validar avisos, atrasos, reconexão e contingência. METAR, TAF e informações aeronáuticas de apoio devem preservar fonte e horário e ser conferidos no processo operacional.</p></Point>
        </div>
        <div className="p-trust-sources"><a href="#bibliografia">Referências de jornada, fadiga e DECEA</a><a href="#explorador">Explorar as ferramentas</a></div>
      </Panel>
      <Panel title="Avaliação com um grupo limitado" teaser="Validar segurança, facilidade e benefício antes de ampliar." icon={<GraduationCap />}>
        <div className="p-trust-columns">
          <Point title="Definir escopo e participantes"><p>Selecionar uma base e representantes de manutenção, coordenação, tripulação e ferramentaria. Começar com poucos fluxos, responsáveis definidos e dados de demonstração.</p></Point>
          <Point title="Condições para começar"><p>Aprovar ambiente, dados e acessos; validar procedimentos; treinar participantes; definir suporte e contingência. Uso de dados reais depende da aprovação das áreas responsáveis.</p></Point>
          <Point title="Medir o resultado"><p>Acompanhar tempo para localizar informação, pendências nas trocas de turno, retrabalho, qualidade dos relatos e facilidade de uso. Testar comportamento com falhas de conexão e registrar problemas encontrados.</p></Point>
          <Point title="Decidir com evidências"><p>Consolidar resultados e ajustes para direção, TI, privacidade e responsáveis operacionais. Ampliação, integração ou uso oficial dependem das validações específicas. Não se presume economia ou redução de ocorrências sem medição.</p></Point>
        </div>
        <p className="p-trust-callout">Próximo passo proposto: uma avaliação técnica e operacional que defina as condições de um piloto controlado.</p>
      </Panel>
    </div>
  </section>;
}

type Reference = readonly [string, string, string];
const regulatoryReferences: Reference[] = [
  ["N1", "BRASIL. Lei nº 13.709/2018 (LGPD), texto compilado. Princípios, bases legais, conservação, transferências e segurança.", sources.lgpd],
  ["N2", "ANPD. Resolução CD/ANPD nº 19/2024. Transferência internacional de dados e cláusulas-padrão.", sources.transfer],
  ["N3", "ANPD. Regulamento de Comunicação de Incidente de Segurança, Resolução nº 15/2024. Portal orientativo oficial.", sources.incident],
  ["N4", "ANAC. Resolução nº 773/2025. Diário de bordo. Vigente desde 1º de janeiro de 2026.", sources.diary],
  ["N5", "ANAC. Resolução nº 458/2017, texto compilado. Sistemas informatizados para registro e guarda de informações.", sources.electronic],
  ["N6", "ANAC. RBAC 43, Emenda 05. Manutenção, manutenção preventiva, reconstrução e alteração.", sources.rbac43],
  ["N7", "ANAC. RBAC 135, Emenda 15. Operações, irregularidades, manutenção, registros e liberação, conforme o escopo.", sources.rbac135],
  ["N8", "ANAC. RBAC 145, Emenda 09. Organizações de manutenção de produto aeronáutico.", sources.rbac145],
  ["N9", "ANAC. RBAC 91, Emenda 07. Requisitos gerais de operação; registros conforme aplicabilidade.", "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/rbha-e-rbac/rbac/rbac-91"],
  ["N10", "ANAC. IS 91-015B. Referência complementar para registros e correções, conforme escopo.", "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/iac-e-is/is/is-91-015"],
  ["N11", "BRASIL. Lei nº 13.475/2017. Exercício da profissão de aeronauta.", "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13475.htm"],
  ["N12", "ANAC. RBAC 117. Gerenciamento de risco de fadiga humana; consultar edição aplicável no índice oficial.", "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/rbha-e-rbac/rbac"],
  ["N13", "ANAC. IS 117-001C, 2026. Orientações para gerenciamento de risco de fadiga humana.", "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/boletim-de-pessoal/2026/bps-v-21-no-28-13-a-17-07-2026/is-117-001c/visualizar_ato_normativo"],
  ["N14", "ANAC. IS 91-012C, 2025. MEL e operação com equipamentos e instrumentos inoperantes.", sources.mel],
  ["N15", "ANAC. IS 120-016C, 2025. Manutenção realizada por empresas de transporte aéreo. Complemento regulatório desta apresentação.", sources.maintenance],
];

const s92References: Reference[] = [
  ["S1", "EASA. TCDS EASA.IM.R.001: Sikorsky S-92A. Issue 9, 25 maio 2021. Edição utilizada no protótipo.", "https://www.easa.europa.eu/en/downloads/7957/en"],
  ["S2", "FAA. AD 2023-09-07. Main Rotor — Swashplate Assembly — Inspection/Removal. Publicada em 25 maio 2023; vigência 29 jun. 2023.", "https://ad.easa.europa.eu/ad/US-2023-09-07"],
  ["S3", "FAA. AD 2022-11-04. Horizontal Stabilizer Forward Root/Strut Fittings — Life Limit/Inspection. Publicada em 23 maio 2022; vigência 27 jun. 2022.", "https://ad.easa.europa.eu/ad/US-2022-11-04"],
  ["S4", "FAA. AD 2021-08-18. Main Landing Gear Assembly/Nose Landing Gear Kit — Inspection. Publicada em 14 abr. 2021; vigência 29 abr. 2021.", "https://ad.easa.europa.eu/ad/US-2021-08-18"],
  ["S5", "EASA. AD 2015-0013. Fuel — Internal Auxiliary Fuel System — Modification. 30 jan. 2015; vigência 13 fev. 2015.", "https://ad.easa.europa.eu/ad/2015-0013"],
  ["S6", "EASA. AD 2011-0109. Main Rotor Drive — Main Gearbox Assembly — Inspection/Replacement. 8 jun. 2011; corrigida em 15 jun. 2011.", "https://ad.easa.europa.eu/ad/2011-0109"],
  ["S7", "EASA. SIB 2009-05. Sikorsky S-92A Main Gearbox Malfunctions. 17 mar. 2009. Boletim informativo.", "https://ad.easa.europa.eu/ad/2009-05"],
  ["S8", "FAA. AD 2009-25-10. Main Gearbox Lube System Filter Assembly — Inspection. Publicada em 4 dez. 2009; vigência 21 dez. 2009.", "https://ad.easa.europa.eu/ad/US-2009-25-10"],
  ["S9", "FAA. SAIB SW-12-23. Sikorsky S-92A Fuselage — Cabin Airframe Inspection. 29 mar. 2012. Boletim informativo.", "https://ad.easa.europa.eu/ad/SW-12-23"],
];

const generalReferences: Reference[] = [
  ["G1", "FAA. Pilot’s Handbook of Aeronautical Knowledge. FAA-H-8083-25C, 2023. Capítulos 7, 8 e 16: sistemas, instrumentos e navegação.", "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak"],
  ["G2", "FAA. Instrument Flying Handbook. FAA-H-8083-15B, 2012. Instrumentos, navegação e cross-check.", "https://www.faa.gov/sites/faa.gov/files/pilots/FAA-H-8083-15B.pdf"],
  ["G3", "FAA. Helicopter Flying Handbook, 2019. Sistemas, manual de voo, emergências e decisão aeronáutica.", "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/helicopter_flying_handbook"],
  ["G4", "DECEA. API REDEMET. Orientações oficiais para integração meteorológica.", "https://ajuda.decea.mil.br/base-de-conhecimento/api-redemet-o-que-e/"],
  ["G5", "DECEA. API AISWEB. Orientações oficiais para integração de informação aeronáutica.", "https://ajuda.decea.mil.br/base-de-conhecimento/o-que-e-a-api-aisweb/"],
];

function ReferenceList({ items }: { items: Reference[] }) {
  return <ol className="p-trust-reference-list">{items.map(([code, label, href]) => <li key={code}><span className="p-trust-ref-code">{code}</span><a href={href} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={14} aria-hidden="true" /><span className="p-trust-ref-action">Consultar fonte oficial</span></a></li>)}</ol>;
}

export function PresentationReferences() {
  return <section id="bibliografia" className="p-trust-section p-trust-references">
    <div className="p-trust-reference-heading"><Intro step="REFERÊNCIAS E TRANSPARÊNCIA" title="As fontes também estão aqui.">Bibliografia completa da proposta, com acesso aos documentos de origem e ao material para avaliação.</Intro><a className="p-trust-download" href="#avaliacao-perfis"><BookOpen size={19} aria-hidden="true" /><span>Consultar proposta completa<small>Conteúdo do PDF em leitura interativa</small></span><ArrowUpRight size={19} aria-hidden="true" /></a></div>
    <p className="p-trust-callout"><strong>Sikorsky S-92A: exemplo técnico desta primeira etapa.</strong> O acervo reúne nove documentos públicos relacionados ao modelo e três publicações gerais da FAA. Os handbooks são material geral, não manuais específicos do S-92A. Antes do uso operacional, conferir revisão, aplicabilidade e autorização de uso.</p>
    <div className="p-trust-grid p-trust-three">
      <Panel title="Legislação e requisitos" teaser="LGPD, ANPD, RBACs e orientações da ANAC." icon={<ShieldCheck />}><ReferenceList items={regulatoryReferences} /><p className="p-trust-fine">Referências centrais conferidas no acervo oficial em setembro de 2026. Consultar o texto consolidado e a aplicabilidade ao operador na implantação. As fontes não representam aprovação do aplicativo.</p></Panel>
      <Panel title="Documentos públicos S-92A" teaser="Certificação, ADs, SIB e SAIB usados como exemplos." icon={<BookOpen />}><ReferenceList items={s92References} /><p className="p-trust-fine">Relação das cópias utilizadas no protótipo. Uma revisão posterior ou substituição pode alterar o documento consultado pelo link. As diretrizes devem ser avaliadas segundo sua aplicabilidade.</p></Panel>
      <Panel title="FAA geral e integrações" teaser="Handbooks e fontes oficiais DECEA." icon={<Link2 />}><ReferenceList items={generalReferences} /><p className="p-trust-fine">As edições indicam o material utilizado. Links de API documentam possibilidades; não comprovam credenciais, autorização de uso ou conexão já configurada.</p></Panel>
    </div>
    <div className="p-trust-footer"><p>Proposta independente de <strong>Robson Kerly de Araújo Costa</strong><br />MMA · ANAC 139090 · Protótipo para avaliação</p><a href="#contato">Fale conosco <ArrowDown size={16} aria-hidden="true" /><small>Ligação ou WhatsApp · (21) 98673-9747</small></a></div>
  </section>;
}
