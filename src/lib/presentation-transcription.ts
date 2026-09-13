type TranscriptionDependencies = {
  apiKey: string | undefined;
  model: string;
  enabled?: boolean;
  consumeQuota: () => Promise<{ allowed: boolean; retryAfter: number }>;
  fetcher?: typeof fetch;
};

const maxAudioBytes = 3 * 1024 * 1024;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function handlePresentationTranscription(request: Request, deps: TranscriptionDependencies): Promise<Response> {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    return json({ error: "Abra o assistente pela página da apresentação." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return json({ error: "Envie uma mensagem de voz." }, 415);
  }
  if (Number(request.headers.get("content-length")) > maxAudioBytes + 128 * 1024) {
    return json({ error: "A mensagem de voz é muito longa. Grave um áudio menor." }, 413);
  }
  if (deps.enabled === false || !deps.apiKey) {
    return json({ error: "A mensagem de voz está temporariamente indisponível. Você ainda pode escrever sua pergunta." }, 503);
  }
  let file: File;
  try {
    const data = await request.formData();
    const input = data.get("file");
    if (!(input instanceof File) || !input.size || input.size > maxAudioBytes || !/^audio\//i.test(input.type)) throw Error("invalid_audio");
    file = input;
  } catch {
    return json({ error: "Grave uma mensagem de voz de até 3 MB." }, 400);
  }

  try {
    const quota = await deps.consumeQuota();
    if (!quota.allowed) return json(
      { error: "Muitas mensagens em pouco tempo. Aguarde um instante ou escreva sua pergunta." },
      429,
      { "Retry-After": String(Math.max(1, Math.ceil(quota.retryAfter))) },
    );
  } catch {
    return json({ error: "Não foi possível processar a voz agora. Você ainda pode escrever sua pergunta." }, 503);
  }

  try {
    const form = new FormData();
    form.set("file", file);
    form.set("model", deps.model);
    form.set("language", "pt");
    form.set("prompt", "Flight IA, segurança de dados, LGPD, ANAC, RBAC, cockpit, trilhos, ferramentaria, eDB, S-92A, AW139.");
    const response = await (deps.fetcher ?? fetch)("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.apiKey}` },
      body: form,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    });
    if (!response.ok) throw Error("provider_unavailable");
    const result = await response.json() as { text?: unknown };
    if (typeof result.text !== "string" || !result.text.trim()) return json({ error: "Não identifiquei fala nesse áudio. Grave novamente." }, 422);
    return json({ text: result.text.trim().slice(0, 2000) });
  } catch {
    return json({ error: "Não consegui ouvir a mensagem agora. Grave novamente ou escreva sua pergunta." }, 502);
  }
}
