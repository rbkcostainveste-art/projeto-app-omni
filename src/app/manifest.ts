import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flight IA - Operações Aéreas",
    short_name: "Flight IA",
    description: "Acompanhamento operacional de voos em tempo real",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#0d315e",
    lang: "pt-BR",
    icons: [{ src: "/favicon.ico",sizes: "any",type: "image/x-icon" }],
  };
}
