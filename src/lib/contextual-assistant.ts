export type DraftFields = { title: string; description: string };
export type DraftProposal = { title: string | null; description: string | null };
export type DraftContext = { kind: "maintenance-draft"; id: string; prefix: string; model: string; fields: DraftFields; record?: {id: string; revision: number} };
export type ContextTurn = { message: string; reply: string };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Dados inválidos.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) throw Error("Texto inválido ou acima do limite.");
  return value;
}

/** Explicit allowlist: no client-supplied roles, record lookups or writable status fields. */
export function parseContextRequest(value: unknown) {
  const body = object(value), raw = object(body.context), fields = object(raw.fields);
  if (raw.kind !== "maintenance-draft") throw Error("Área ainda não disponível para assistência contextual.");
  const context: DraftContext = {
    kind: "maintenance-draft", id: text(raw.id, 100), prefix: text(raw.prefix, 20), model: text(raw.model, 80),
    fields: {title: text(fields.title, 500), description: text(fields.description, 12000)},
  };
  if (!context.id) throw Error("Rascunho não identificado.");
  if (raw.record !== undefined) {
    const record = object(raw.record);
    const id = text(record.id, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !Number.isSafeInteger(record.revision) || Number(record.revision) < 1) throw Error("Registro inválido.");
    if (context.id !== `record:${id}`) throw Error("Contexto de registro inválido.");
    context.record = {id, revision: Number(record.revision)};
  }
  const message = text(body.message, 4000).trim();
  if (!message) throw Error("Escreva o que deseja fazer neste relato.");
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 8) throw Error("Histórico acima do limite.");
  const turns: ContextTurn[] = history.map(item => {
    const turn = object(item);
    return {message: text(turn.message, 4000), reply: text(turn.reply, 16000)};
  });
  return {context, message, history: turns};
}

export function parseDraftAnswer(value: unknown): {reply: string; proposal: DraftProposal} {
  const answer = object(value), proposed = object(answer.proposal);
  if (Object.keys(proposed).some(key => !["title", "description"].includes(key))) throw Error("Proposta contém campos não permitidos.");
  const reply = text(answer.reply, 16000);
  if (!reply.trim()) throw Error("Resposta vazia.");
  return {reply, proposal: {
    title: proposed.title === null ? null : text(proposed.title, 500),
    description: proposed.description === null ? null : text(proposed.description, 12000),
  }};
}

export function sameDraft(a: DraftFields, b: DraftFields) {
  return a.title === b.title && a.description === b.description;
}

/** Reject stale answers and keep missing fields unchanged. Never persists a record. */
export function applyDraftProposal(current: DraftFields, original: DraftFields, proposal: DraftProposal): DraftFields {
  if (!sameDraft(current, original)) throw Error("O rascunho mudou. Peça uma nova sugestão antes de aplicar.");
  return {title: proposal.title ?? current.title, description: proposal.description ?? current.description};
}

export const draftAnswerSchema = {
  type: "object", additionalProperties: false,
  properties: {
    reply: {type: "string"},
    proposal: {type: "object", additionalProperties: false, properties: {
      title: {type: ["string", "null"]}, description: {type: ["string", "null"]},
    }, required: ["title", "description"]},
  }, required: ["reply", "proposal"],
};
