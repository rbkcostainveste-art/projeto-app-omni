import { FlightBoard } from "@/components/flight-board";

import {AssistantWorkspaceProvider} from "@/components/assistant-workspace";

export default function Home() {
  return <AssistantWorkspaceProvider><FlightBoard /></AssistantWorkspaceProvider>;
}
