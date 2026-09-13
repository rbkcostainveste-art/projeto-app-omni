import { handlePresentationTranscription } from "@/lib/presentation-transcription";
import { consumePresentationRequestQuota } from "@/lib/presentation-request-quota";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  return handlePresentationTranscription(request, {
    apiKey,
    model: process.env.PRESENTATION_TRANSCRIBE_MODEL || "gpt-transcribe",
    enabled: process.env.PRESENTATION_ASSISTANT_ENABLED !== "false",
    consumeQuota: () => consumePresentationRequestQuota(request, apiKey!),
  });
}
