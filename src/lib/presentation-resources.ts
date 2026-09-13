export type PresentationScreen = { src: string; width: number; height: number; caption: string };
export type PresentationResource = {
  id: string; title: string; summary: string; detail: string; desktop?: PresentationScreen; mobile?: PresentationScreen;
  topic?: string;
};

const screen = (file: string, width: number, height: number, caption: string): PresentationScreen => ({
  src: `/presentation/screens/${file}.jpg`, width, height, caption,
});
const desktop = (file: string, caption: string, width = 1100, height = 780) => screen(file, width, height, caption);
const mobile = (file: string, caption = "Captura real em formato de celular", width = 390, height = 844) => screen(file, width, height, caption);

export const presentationResources: Record<string, PresentationResource> = {
  programacao: {
    id: "programacao", title: "Painel e programação", summary: "Planeje o voo e organize as informações que chegam aos envolvidos.",
    detail: "A coordenação reúne aeronave, posição, horário, destino e tripulação. Esta prévia mostra a tela de programação; o painel completo é explorado no aplicativo.",
    desktop: desktop("coord", "Coordenação · tela de programação de voos, não cockpit"),
  },
  levas: {
    id: "levas", title: "Levas e confirmação", summary: "Agrupe voos e confirme a programação com menos etapas.",
    detail: "Selecionar, confirmar, editar, repetir ou cancelar depende do estado do voo e da autorização. A confirmação alimenta o acompanhamento nos ambientes envolvidos.",
    desktop: desktop("levas", "Recorte real da programação por levas", 725, 392),
  },
  briefing: {
    id: "briefing", title: "Dados do voo", summary: "Reúna os dados que ajudam a tripulação a preparar o voo.",
    detail: "Contrato, cliente, locais, horários e documentação compõem o contexto do cockpit. Integrações com sistemas da empresa dependem de política, autorização e adequação.",
    desktop: desktop("documentacao", "Coordenação · documentação opcional do voo"),
  },
  prontidao: {
    id: "prontidao", title: "Preparação concluída", summary: "Um indicador informa ao piloto e à coordenação que a preparação foi concluída.",
    detail: "O mecânico confirma após as verificações exigidas. O indicador identifica momento e responsável; não representa liberação técnica nem elimina outras pendências da aeronave.",
    desktop: desktop("preparation-ready-1366", "Recorte do cartão de preparação concluída", 992, 181),
    mobile: mobile("preparation-ready-390", "Recorte do cartão no celular", 358, 181), topic: "preparacao-concluida",
  },
  trilho: {
    id: "trilho", title: "Trilho do voo", summary: "Veja o que precisa ser feito no contexto de cada voo.",
    detail: "O trilho conecta programação, atividades, responsáveis e etapas. Esta captura mostra o recorte de verificações da manutenção; entre no aplicativo para navegar pelo trilho completo.",
    desktop: desktop("checks", "Recorte do trilho · verificações do voo", 725, 492),
  },
  verificacoes: {
    id: "verificacoes", title: "Verificações do mecânico", summary: "Registre as etapas e acompanhe o que ainda impede concluir a preparação.",
    detail: "Os comandos de confirmação consideram o voo e as pendências. O resultado fica identificado por responsável e horário. Uma tarefa concluída não substitui a liberação da aeronave.",
    desktop: desktop("preparation-mechanic-1366", "Verificações da manutenção e confirmação", 992, 583),
    mobile: mobile("preparation-mechanic-390", "Verificações do mecânico no celular", 358, 757),
  },
  pista: {
    id: "pista", title: "Passagem de pista", summary: "Organize as rotinas e deixe o próximo turno informado.",
    detail: "Lavagem, secagem, HUMS e demais tarefas mantêm um contexto compartilhado. O conteúdo e os procedimentos efetivos seguem as regras da empresa.",
    mobile: mobile("mobile-pista", "Passagem de pista · captura real no celular"),
  },
  secagem: {
    id: "secagem", title: "Lavagem e secagem", summary: "Transforme uma etapa concluída em informação útil para a próxima equipe.",
    detail: "A prévia apresenta dois estados da mesma rotina: pendência visível ao piloto e confirmação de secagem. São capturas estáticas; a atualização compartilhada pode ser testada no aplicativo.",
    desktop: desktop("secagem", "Comparação de estados da automação de secagem", 1055, 330),
  },
  passagem: {
    id: "passagem", title: "Passagem de serviço", summary: "Preserve o contexto do trabalho entre turnos e profissionais.",
    detail: "Registros programados e relatos organizam descrição, prioridade, anexos e vínculos. A captura mostra o formulário de inspeção programada, uma das ferramentas da passagem.",
    desktop: desktop("servico", "Passagem · cadastro de inspeção programada com assistência", 1152, 875),
    mobile: mobile("mobile-servico", "Inspeção programada no celular"), topic: "servico",
  },
  relato: {
    id: "relato", title: "Relato técnico", summary: "Registre o fato, acompanhe a evolução e mantenha o histórico acessível.",
    detail: "Aeronave, sintoma, momento, anexos e responsáveis preservam o contexto. A classificação no aplicativo não dispensa registro oficial quando exigido. O texto na captura é um exemplo de preenchimento, não orientação de manutenção.",
    desktop: desktop("relato", "Relato técnico · exemplo de tela preenchida", 768, 875),
    mobile: mobile("mobile-relato", "Consulta ao relato técnico no celular"), topic: "relatos",
  },
  acompanhamento: {
    id: "acompanhamento", title: "Acompanhamento técnico", summary: "Acompanhe investigação, disposição e referência documental no mesmo caso.",
    detail: "Os campos estruturam a avaliação técnica e os vínculos. Resultado de teste, referência aplicável e aprovação precisam ser conferidos pelo profissional autorizado; a IA não decide aeronavegabilidade.",
    desktop: desktop("eixos", "Campos de acompanhamento técnico do relato", 1150, 950), topic: "relatos",
  },
  acoes: {
    id: "acoes", title: "Ações e designações", summary: "Encaminhe uma necessidade e acompanhe quem ficou responsável.",
    detail: "O botão Gerar ação parte do contexto do relato. Execução, resultado, comentários e ciência ajudam a continuidade; a captura mostra a origem da ação, não a tela completa do mural.",
    desktop: desktop("relato", "Origem da ação · botão Gerar ação no relato", 768, 875),
    mobile: mobile("mobile-relato", "Ação a partir do relato no celular"), topic: "mural",
  },
  vinculo: {
    id: "vinculo", title: "Vínculo com ocorrência", summary: "Conecte o acompanhamento à ocorrência correspondente.",
    detail: "Preservar o vínculo evita perder a relação entre comunicação, investigação e registro. Uma referência no aplicativo não comprova, sozinha, que o lançamento obrigatório foi realizado no sistema oficial.",
    desktop: desktop("vinculo", "Seleção da ocorrência a vincular", 840, 950), topic: "registro-oficial",
  },
  mel: {
    id: "mel", title: "MEL · prazos e alertas", summary: "Mantenha datas originais e visualize o prazo de acompanhamento.",
    detail: "Referência oficial, item/revisão MEL, descoberta, aplicação e fuso devem ser conferidos. O contador não concede extensão. Categoria A com horas, ciclos ou dias de voo exige controle próprio.",
    desktop: desktop("mel-deadline-1366", "Controle de datas e prazo MEL", 992, 524),
    mobile: mobile("mel-deadline-390", "Controle de prazo MEL no celular", 358, 848), topic: "controle-mel",
  },
  comentarios: {
    id: "comentarios", title: "Comentários e anexos", summary: "Deixe a explicação junto ao serviço que lhe dá contexto.",
    detail: "Texto, arquivos e fotos podem complementar o acompanhamento. Leitura ou ciência de uma mensagem não equivalem à aprovação técnica de um registro.",
    desktop: desktop("comentarios", "Comentários vinculados ao relato", 750, 950),
    mobile: mobile("mobile-comentarios", "Comentários no celular"),
  },
  ia: {
    id: "ia", title: "IA · dados e textos", summary: "Prepare campos e melhore a redação, conferindo antes de aplicar.",
    detail: "A assistência pode organizar, traduzir e corrigir o texto. O profissional valida fatos e fontes. Não criar referências, diagnósticos ou resultados ausentes; o serviço e o envio de dados dependem dos controles aprovados pela empresa.",
    desktop: desktop("ia-relato", "Formulário e assistente de IA lado a lado", 1183, 918),
    mobile: mobile("mobile-ia-relato", "Assistente de IA no celular"), topic: "ia-exemplo",
  },
  "mural-piloto": {
    id: "mural-piloto", title: "Mural · programação", summary: "Comece o dia sabendo o que está previsto e o que mudou nos seus voos.",
    detail: "Na primeira área do piloto, a Programação reúne voos por situação, giros de manutenção e avisos de secagem. Os voos atribuídos ao piloto aparecem aqui. Esta captura real mostra a visão de um visitante sem voos vinculados.",
    desktop: desktop("pilot-mural-desktop", "Piloto · mural de programação no computador", 1085, 769),
    mobile: mobile("pilot-mural-mobile", "Piloto · mural de programação no celular", 375, 812), topic: "mural-piloto",
  },
  "trilhos-piloto": {
    id: "trilhos-piloto", title: "Trilhos do piloto", summary: "Escolha a data e acompanhe as etapas dos voos atribuídos a você.",
    detail: "Os filtros ajudam a encontrar o voo e abrir seu acompanhamento compartilhado com manutenção e coordenação. No aplicativo, as atualizações chegam em tempo real conforme o acesso. Esta captura mostra os controles disponíveis, ainda sem voos atribuídos ao visitante.",
    desktop: desktop("pilot-trilhos-desktop", "Piloto · filtros e datas dos trilhos no computador", 1085, 769),
    mobile: mobile("pilot-trilhos-mobile", "Piloto · filtros e datas dos trilhos no celular", 375, 812), topic: "trilhos-piloto",
  },
  cockpit: {
    id: "cockpit", title: "Cockpit · meu dia", summary: "Consulte a programação e registre sua apresentação em um único ambiente.",
    detail: "O piloto encontra o contexto do dia e os atalhos para preparar o voo. As informações do voo e os comandos dependem da escala, do perfil e das autorizações.",
    desktop: desktop("cockpit", "Cockpit · visão do piloto"), mobile: mobile("mobile-cockpit", "Cockpit do piloto no celular"), topic: "perfil-piloto",
  },
  "cockpit-consulta": {
    id: "cockpit-consulta", title: "Cockpit · consulta", summary: "A tripulação consulta as informações disponibilizadas para seu perfil.",
    detail: "A imagem de referência é a do cockpit do piloto. A visão de consulta do comissário depende das permissões configuradas; esta imagem não representa liberação dos mesmos comandos para todos.",
    desktop: desktop("cockpit", "Referência do ambiente · captura do perfil piloto"),
    mobile: mobile("mobile-cockpit", "Referência do cockpit · perfil piloto"),
  },
  preparo: {
    id: "preparo", title: "Preparação do voo", summary: "Organize os dados de planejamento antes da execução.",
    detail: "Origem, destino, alternado, combustível e observações ficam no contexto do voo. A tela apoia o trabalho e não substitui os procedimentos ou a avaliação do comandante.",
    desktop: desktop("preparo", "Cockpit · formulário de preparação"), mobile: mobile("mobile-preparo", "Preparação no celular"),
  },
  ais: {
    id: "ais", title: "AIS e meteorologia", summary: "Acesse as consultas aeronáuticas no contexto do voo.",
    detail: "A interface apresenta METAR/TAF, AISWEB/NOTAM e links de consulta. Disponibilidade de fontes e integração devem ser verificadas; informação recebida precisa ser conferida quanto a origem e atualização.",
    desktop: desktop("ais", "Cockpit · consultas AIS e meteorologia"), mobile: mobile("mobile-ais", "Consultas AIS no celular"),
  },
  documentos: {
    id: "documentos", title: "Documentos e eDB", summary: "Prepare referências e informações documentais junto ao voo.",
    detail: "A tela reúne referência ao diário, ciclo/página e observações. Integração ao eDB é uma possibilidade condicionada à política e à validação da empresa; não há confirmação de transmissão ao sistema oficial nesta prévia.",
    desktop: desktop("edb", "Cockpit · preparação de informações para eDB"), mobile: mobile("mobile-edb", "Informações documentais no celular"), topic: "registro-oficial",
  },
  ocorrencias: {
    id: "ocorrencias", title: "Ocorrências", summary: "Descreva uma observação mantendo o contexto da aeronave e do voo.",
    detail: "Aeronave, título, momento e descrição ajudam o encaminhamento à manutenção. Ocorrências que exigem registro oficial devem seguir o procedimento aplicável, ainda que também registradas aqui.",
    desktop: desktop("ocorrencia", "Cockpit · formulário de ocorrência"), mobile: mobile("mobile-ocorrencia", "Ocorrência no celular"),
  },
  jornada: {
    id: "jornada", title: "Jornada e contadores", summary: "Organize horários e consulte as informações registradas no dia.",
    detail: "O profissional confere apresentação, refeições, liberação e tempos. O protótipo não calcula todos os cenários de fadiga e não declara aptidão; a aplicação das regras depende da operação.",
    desktop: desktop("jornada", "Cockpit · registro de jornada"), mobile: mobile("mobile-jornada", "Jornada no celular"),
  },
  caixas: {
    id: "caixas", title: "Caixas e gavetas", summary: "Identifique ferramentas pela organização visual da caixa.",
    detail: "A silhueta, a posição e a identificação facilitam a conferência. A fotografia mostra o catálogo da gaveta; o acesso completo permite explorar caixas, movimentações e histórico conforme perfil.",
    desktop: desktop("ferramentas", "Edição do catálogo da caixa e gavetas", 882, 794),
    mobile: mobile("mobile-ferramentas", "Gaveta com silhuetas no celular"), topic: "perfil-ferramentaria",
  },
  conferencia: {
    id: "conferencia", title: "Conferência e empréstimos", summary: "Veja a situação dos itens e acompanhe o que precisa retornar.",
    detail: "Disponibilidade, empréstimo e seleção por ferramenta apoiam a rastreabilidade. Recebimento, transferência e correção do histórico seguem os comandos e permissões do aplicativo.",
    mobile: mobile("mobile-ferramentas-detalhe", "Recorte real · situação e seleção das ferramentas", 390, 235),
  },
  chat: {
    id: "chat", title: "Chat e chamadas", summary: "Converse com a equipe e preserve o contexto de cada serviço.",
    detail: "Mensagens, anexos, câmera, chamadas de voz/vídeo e gravações são recursos para avaliação. A captura mostra o chat de texto. Gravações exigem definição de finalidade, aviso, acesso e retenção; conteúdo relevante segue para o registro apropriado.",
    desktop: desktop("chat", "Chat · conversa de demonstração", 1160, 660), topic: "chat",
  },
  notas: {
    id: "notas", title: "Notas e agenda", summary: "Organize lembretes e anotações sem sair do aplicativo.",
    detail: "As notas aparecem como individuais na interface. Acesso, conservação e descarte precisam seguir a política corporativa e os controles efetivos no servidor.",
    desktop: desktop("notas", "Mensagens · notas e agenda", 1160, 660),
  },
  ajuda: {
    id: "ajuda", title: "Ajuda contextual", summary: "Encontre orientação a partir da tela em que está trabalhando.",
    detail: "A ajuda organiza vídeos por perfil e tela, além do contato para dúvidas, sugestões e problemas. Os tutoriais poderão ser publicados ou substituídos pela administração autorizada.",
    desktop: desktop("ajuda", "Ajuda · espaço para tutoriais e contato", 1160, 660),
  },
  pendencias: {
    id: "pendencias", title: "Pendências pessoais", summary: "Explore como avisos e pendências poderiam chegar ao usuário.",
    detail: "Qpulse e treinamentos são exemplos demonstrativos. Integração real requer fonte autorizada, autenticação, responsável e regras de atualização definidos pela empresa.",
    desktop: desktop("pendencias", "Pendências · exemplos sem integração corporativa", 1160, 660),
  },
  cadastros: {
    id: "cadastros", title: "Cadastros e permissões", summary: "Organize pessoas, bases e referências que sustentam os fluxos.",
    detail: "Função, base, frota e designações ajudam a configurar os acessos. O aplicativo também reúne catálogos de aeronaves, clientes e parâmetros especializados; esta captura mostra o cadastro de pessoas.",
    desktop: desktop("pessoas", "Administração · cadastro de pessoas", 850, 950),
  },
};

const common = ["chat", "notas", "ajuda", "pendencias"];
export const presentationAreas = [
  { id: "coordenacao", label: "Coordenação", profiles: [
    { id: "coordenador", label: "Coordenação", description: "Painel de controle e programação", resourceIds: ["programacao", "levas", "briefing", "prontidao", "trilho", "secagem", "ia", ...common, "cadastros"] },
  ] },
  { id: "manutencao", label: "Manutenção", profiles: [
    { id: "inspetor", label: "Liderança e inspeção", description: "Passagem, relatos e acompanhamento técnico", resourceIds: ["passagem", "relato", "acompanhamento", "acoes", "vinculo", "mel", "comentarios", "ia", "prontidao", ...common, "cadastros"] },
    { id: "mecanico", label: "Mecânico", description: "Trilho, atividades e execução", resourceIds: ["verificacoes", "trilho", "pista", "secagem", "passagem", "relato", "acoes", "comentarios", "ia", ...common] },
  ] },
  { id: "tripulacao", label: "Tripulação", profiles: [
    { id: "piloto", label: "Piloto", description: "Mural, trilhos e cockpit", resourceIds: ["mural-piloto", "trilhos-piloto", "cockpit", "preparo", "ais", "documentos", "ocorrencias", "jornada", "prontidao", "secagem", ...common] },
    { id: "comissario", label: "Comissário · consulta", description: "Informações conforme autorização", resourceIds: ["cockpit-consulta", ...common] },
  ] },
  { id: "ferramentaria", label: "Ferramentaria", profiles: [
    { id: "ferramenteiro", label: "Ferramenteiro", description: "Caixas, conferência e movimentação", resourceIds: ["caixas", "conferencia", "ia", ...common] },
  ] },
];
