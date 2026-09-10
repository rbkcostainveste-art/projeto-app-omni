import {parseTechnicalAssistantValues} from './assistant-technical-fields';
export type DraftFields = { title: string; description: string; prefix?:string;tc?:string;technical?:Record<string,string> };
export type DraftProposal = { title: string | null; description: string | null; prefix?:string|null;tc?:string|null;technical?:Record<string,string> };
export type DraftContext = { kind: "maintenance-draft"; id: string; prefix: string; model: string; fields: DraftFields; aircraft?:{prefix:string;model:string}[]; record?: {id: string; revision: number} };
export type AssistantAttachment={name:string;data:string};
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
  if(fields.prefix!==undefined)context.fields.prefix=text(fields.prefix,20);
  if(fields.tc!==undefined)context.fields.tc=text(fields.tc,100);
  if(fields.technical!==undefined)context.fields.technical=parseTechnicalAssistantValues(fields.technical);
  if(raw.aircraft!==undefined){if(!Array.isArray(raw.aircraft)||raw.aircraft.length>300)throw Error('Catálogo inválido.');context.aircraft=raw.aircraft.map(item=>{const a=object(item);return {prefix:text(a.prefix,20),model:text(a.model,80)};});}
  if (raw.record !== undefined) {
    const record = object(raw.record);
    const id = text(record.id, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !Number.isSafeInteger(record.revision) || Number(record.revision) < 1) throw Error("Registro inválido.");
    if (context.id !== `record:${id}`) throw Error("Contexto de registro inválido.");
    context.record = {id, revision: Number(record.revision)};
  }
  const message = text(body.message, 4000).trim();
  const attachments=parseAssistantAttachments(body.attachments);
  if (!message&&!attachments.length) throw Error("Escreva ou anexe o que deseja usar neste relato.");
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 8) throw Error("Histórico acima do limite.");
  const turns: ContextTurn[] = history.map(item => {
    const turn = object(item);
    return {message: text(turn.message, 4000), reply: text(turn.reply, 16000)};
  });
  return {context, message, history: turns,attachments};
}

export function parseAssistantAttachments(value:unknown):AssistantAttachment[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>3)throw Error('Envie até três anexos.');
 let size=0;return value.map(item=>{const f=object(item),name=text(f.name,180),data=text(f.data,2800000);size+=data.length;if(size>2800000||!/^data:(application\/pdf|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('Use imagens ou PDF, até 2 MB no total.');return {name,data};});
}
export function resolveDraftAircraft(message:string,aircraft:{prefix:string;model:string}[]){
 const alphabet:Record<string,string>={ALFA:'A',ALPHA:'A',BRAVO:'B',CHARLIE:'C',DELTA:'D',ECHO:'E',FOXTROT:'F',GOLF:'G',HOTEL:'H',INDIA:'I',JULIET:'J',JULIETT:'J',KILO:'K',LIMA:'L',MIKE:'M',NOVEMBER:'N',OSCAR:'O',PAPA:'P',QUEBEC:'Q',ROMEO:'R',SIERRA:'S',TANGO:'T',UNIFORM:'U',VICTOR:'V',WHISKEY:'W',XRAY:'X',YANKEE:'Y',ZULU:'Z'};
 const words:string[]=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/X[ -]RAY/g,'XRAY').match(/[A-Z0-9]+(?:-[A-Z0-9]+)?/g)||[];
 const spoken:string[]=[];let run='';for(const word of [...words,'']){if(alphabet[word])run+=alphabet[word];else{if(run.length>=3)spoken.push(run);run='';}}words.push(...spoken);
 return aircraft.filter(a=>{const compact=a.prefix.toUpperCase().replace(/[^A-Z0-9]/g,'');return words.some(w=>{const token=w.replace(/-/g,'');return token===compact||(token.length===3&&compact.endsWith(token));});});
}

export function parseDraftAnswer(value: unknown): {reply: string; proposal: DraftProposal} {
  const answer = object(value), proposed = object(answer.proposal);
  if (Object.keys(proposed).some(key => !["title", "description","prefix","tc","technical"].includes(key))) throw Error("Proposta contém campos não permitidos.");
  const reply = text(answer.reply, 16000);
  if (!reply.trim()) throw Error("Resposta vazia.");
  return {reply, proposal: {
    ...(proposed.technical===undefined?{}:{technical:parseTechnicalAssistantValues(proposed.technical)}),
    ...(proposed.prefix===undefined?{}:{prefix:proposed.prefix===null?null:text(proposed.prefix,20)}),
    ...(proposed.tc===undefined?{}:{tc:proposed.tc===null?null:text(proposed.tc,100)}),
    title: proposed.title === null ? null : text(proposed.title, 500),
    description: proposed.description === null ? null : text(proposed.description, 12000),
  }};
}

export function sameDraft(a: DraftFields, b: DraftFields) {
  return a.title === b.title && a.description === b.description&&a.prefix===b.prefix&&a.tc===b.tc&&JSON.stringify(Object.entries(a.technical||{}).sort())===JSON.stringify(Object.entries(b.technical||{}).sort());
}

/** Reject stale answers and keep missing fields unchanged. Never persists a record. */
export function applyDraftProposal(current: DraftFields, original: DraftFields, proposal: DraftProposal): DraftFields {
  if (!sameDraft(current, original)) throw Error("O rascunho mudou. Peça uma nova sugestão antes de aplicar.");
  if(proposal.technical&&Object.keys(proposal.technical).some(key=>!Object.hasOwn(current.technical||{},key)))throw Error('Campo técnico fora deste formulário.');
  return {...current,...(current.technical?{technical:{...current.technical,...proposal.technical}}:{}),title: proposal.title ?? current.title, description: proposal.description ?? current.description,...(current.prefix===undefined?{}:{prefix:proposal.prefix??current.prefix}),...(current.tc===undefined?{}:{tc:proposal.tc??current.tc})};
}

export const draftAnswerSchema = {
  type: "object", additionalProperties: false,
  properties: {
    reply: {type: "string"},
    proposal: {type: "object", additionalProperties: false, properties: {
      prefix:{type:["string","null"]},
      title: {type: ["string", "null"]}, description: {type: ["string", "null"]},
    }, required: ["title", "description","prefix"]},
  }, required: ["reply", "proposal"],
};
