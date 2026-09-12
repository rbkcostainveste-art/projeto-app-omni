export const presentationVideos = [
  { id: "apresentacao-geral", title: "Apresentação geral", description: "Uma visão da proposta em cerca de três minutos.", poster: "/presentation/hero-aw139.png" },
  { id: "coordenacao", title: "Coordenação", description: "Painel, programação e equipes alinhadas.", poster: "/presentation/screens/coord.jpg" },
  { id: "cockpit-tripulacao", title: "Cockpit da tripulação", description: "Do planejamento à preparação do voo.", poster: "/presentation/screens/cockpit.jpg" },
  { id: "ferramentaria", title: "Ferramentaria", description: "Caixas, ferramentas e conferências.", poster: "/presentation/screens/ferramentas.jpg" },
  { id: "passagem-e-automacoes", title: "Passagem de serviço e automações", description: "Continuidade entre equipes e acompanhamento de ações.", poster: "/presentation/screens/servico.jpg" },
  { id: "ia-textos-tecnicos", title: "IA para dados e textos técnicos", description: "Inserção assistida e revisão de textos técnicos.", poster: "/presentation/screens/ia-relato.jpg" },
  { id: "chat-e-videochamada", title: "Chat e videochamada", description: "Mensagens, chamadas, notas e gravações.", poster: "/presentation/screens/chat.jpg" },
] as const;
export type PresentationVideo = typeof presentationVideos[number];
export function presentationVideoPath(id: string) { return `/presentation/videos/${id}.mp4`; }
