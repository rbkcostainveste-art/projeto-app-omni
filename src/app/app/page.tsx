import { FlightBoard } from "@/components/flight-board";
import { AssistantWorkspaceProvider } from "@/components/assistant-workspace";

export const metadata = { title: "Flight IA | Aplicativo demonstrativo", robots: { index: false, follow: false } };

export default function ApplicationPage() {
  return <><div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-bold text-red-800">AMBIENTE DEMONSTRATIVO — utilize apenas dados simulados. Registros desta avaliação não substituem os registros oficiais da empresa.</div><AssistantWorkspaceProvider><FlightBoard /></AssistantWorkspaceProvider></>;
}
