import { PresentationSite } from "@/components/presentation-site";
import { existsSync } from "node:fs";
import path from "node:path";
import { presentationVideos } from "@/lib/presentation-videos";

export const metadata = {
  title: "Flight IA | Proposta de integração operacional",
  description: "Conheça a proposta, as condições de adoção e os ambientes do protótipo Flight IA.",
  robots: { index: false, follow: false },
};

export default function Home() {
  const availableVideos = presentationVideos.filter(video => existsSync(path.join(process.cwd(), "public", "presentation", "videos", `${video.id}.mp4`))).map(video => video.id);
  return <PresentationSite availableVideos={availableVideos} />;
}
