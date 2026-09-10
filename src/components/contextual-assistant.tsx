"use client";

import {useEffect, useRef, useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {Bot, Send, X} from "lucide-react";
import {applyDraftProposal, sameDraft, parseDraftAnswer, type ContextTurn, type DraftContext, type DraftFields, type DraftProposal} from "@/lib/contextual-assistant";
import {TechnicalSourceList, type TechnicalSource} from "./technical-library-search";
import {AssistantConversations} from './assistant-conversations';
import {useAssistantHistory} from './assistant-history';

type Suggestion = {original: DraftFields; proposal: DraftProposal};
const fieldClass = "w-full rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-900";

/** Keep mounted while hidden; parent keys by draft/aircraft/user to isolate conversations. */
type Props={
  open: boolean; context: DraftContext; client: SupabaseClient | null; user: string; disabled: boolean;
  onClose: () => void; onApply: (fields: DraftFields) => void;
};
export function ContextualAssistant(props:Props){
 return <div hidden={!props.open} className="min-w-0"><AssistantConversations key={`${props.user}:${props.context.id}:${props.context.prefix}`} client={props.client} user={props.user} context={{id:props.context.id,label:`Relato ${props.context.prefix||'sem aeronave'} · rascunho`}} onClose={props.onClose} renderConversation={(conversationId,onBack,title)=><ContextualConversation key={conversationId} {...props} onClose={onBack} conversationId={conversationId} title={title}/>}/></div>;
}
function ContextualConversation({open, context, client, user, disabled, onClose, onApply,conversationId,title}:Props&{conversationId:string;title:string}) {
  const [message, setMessage] = useState("");
  const history=useAssistantHistory(client,user,conversationId);
  const turns:ContextTurn[]=history.entries;
  const pending=useRef<{requestId:string;message:string;reply:string}|null>(null);
  const [needsSave,setNeedsSave]=useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [undo, setUndo] = useState<{before: DraftFields; after: DraftFields} | null>(null);
  const [sources, setSources] = useState<TechnicalSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {if (open) input.current?.focus();}, [open]);

  function close() {
    if(busy||needsSave)return;
    request.current?.abort(); request.current = null; setBusy(false); onClose();
  }
  async function save(){if(!pending.current)return;await history.append(pending.current);pending.current=null;setNeedsSave(false);setMessage('');}
  async function send() {
    if (request.current || (!message.trim()&&!pending.current) || disabled||history.loading) return;
    const controller = new AbortController(); request.current = controller;
    const snapshot = {...context.fields}, prompt = message.trim();
    setBusy(true); setError(""); setNotice(""); if(!pending.current)setSuggestion(null);
    try {
      if(pending.current){await save();return;}
      const session = await client?.auth.getSession();
      if (!session?.data.session) throw Error("Entre novamente para usar a IA.");
      if (controller.signal.aborted) return;
      const response = await fetch("/api/ai/context", {
        method: "POST", signal: controller.signal,
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}`, "x-employee": user,"x-conversation-id":conversationId},
        body: JSON.stringify({message: prompt, context: {...context, fields: snapshot}, history: []}),
      });
      const data = await response.json();
      if (request.current !== controller) return;
      if (!response.ok) throw Error(data.error || "A consulta falhou.");
      if (data.contextId !== context.id) throw Error("A resposta pertence a outro rascunho.");
      const answer = parseDraftAnswer(data);
      pending.current={requestId:crypto.randomUUID(),message:prompt,reply:answer.reply};setNeedsSave(true);
      setSources(data.sources ?? []);
      if (answer.proposal.title !== null || answer.proposal.description !== null) setSuggestion({original: snapshot, proposal: answer.proposal});
      await save();
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) setError((reason instanceof Error ? reason.message : "A consulta falhou.")+(pending.current?' A resposta está pronta. Tente salvar o histórico.':''));
    } finally {
      if (request.current === controller) {request.current = null; setBusy(false);}
    }
  }
  function apply() {
    if (!suggestion || disabled) return;
    try {
      const next = applyDraftProposal(context.fields, suggestion.original, suggestion.proposal);
      setUndo({before: {...context.fields}, after: next}); onApply(next); setSuggestion(null);
      setNotice("Sugestão aplicada ao rascunho. Confira os campos e use Criar registro para salvar.");
    } catch (reason) {setError((reason as Error).message);}
  }
  const stale = suggestion && !sameDraft(context.fields, suggestion.original);
  return <aside hidden={!open} aria-label="IA do relato técnico" className="min-w-0 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-slate-900 lg:sticky lg:top-20 lg:max-h-[75dvh] lg:overflow-auto">
    <header className="flex items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 font-bold"><Bot size={20}/>IA neste relato</h3><p className="mt-1 text-xs">{context.prefix || "Aeronave ainda não selecionada"}{context.model ? ` · ${context.model}` : ""}</p></div><button type="button" aria-label="Fechar assistente do relato" onClick={close} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-blue-100"><X size={18}/></button></header>
    <p className="my-3 text-xs text-slate-600">{title} · Conversa pessoal vinculada a este rascunho. O histórico fica disponível na lista do assistente.</p>
    {history.error?<p role="alert">{history.error}</p>:null}{history.loading?<p role="status">Carregando histórico…</p>:null}{history.more?<button type="button" disabled={history.loading} onClick={()=>void history.older()}>Mensagens anteriores</button>:null}
    <div className="space-y-3" aria-live="polite">{turns.map((turn, index) => <div key={index} className="space-y-2"><p className="whitespace-pre-wrap break-words rounded-xl bg-blue-100 p-3 text-sm"><b>Você: </b>{turn.message}</p><p className="whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-sm"><b>IA: </b>{turn.reply}</p></div>)}</div>
    <TechnicalSourceList sources={sources}/>
    {suggestion ? <section className="my-3 space-y-3 rounded-xl border bg-white p-3" aria-label="Revisar sugestão"><h4 className="font-bold">Revisar antes de aplicar</h4>{(["title", "description"] as const).map(key => suggestion.proposal[key] !== null ? <div key={key}><p className="text-xs font-bold">{key === "title" ? "Título original" : "Descrição original"}</p><p className="my-1 whitespace-pre-wrap break-words text-xs text-slate-600">{suggestion.original[key] || "Em branco"}</p><label className="block text-xs font-bold">{key === "title" ? "Título sugerido" : "Descrição sugerida"}<textarea maxLength={key === "title" ? 500 : 12000} rows={key === "title" ? 2 : 5} value={suggestion.proposal[key] ?? ""} onChange={event => setSuggestion({...suggestion, proposal: {...suggestion.proposal, [key]: event.target.value}})} className={fieldClass}/></label></div> : null)}{stale ? <p role="status" className="text-sm text-amber-800">O rascunho mudou. Peça uma nova sugestão antes de aplicar.</p> : null}<button type="button" onClick={apply} disabled={disabled || busy || Boolean(stale)} className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40">Aplicar ao rascunho</button></section> : null}
    {notice ? <p role="status" className="my-3 text-sm text-green-800">{notice}</p> : null}
    {undo ? <button type="button" disabled={disabled || busy || !sameDraft(context.fields, undo.after)} onClick={() => {if (sameDraft(context.fields, undo.after)) {onApply(undo.before); setUndo(null); setNotice("Aplicação desfeita no rascunho.");}}} className="my-2 min-h-11 text-sm font-bold text-blue-800 disabled:opacity-40">Desfazer última aplicação</button> : null}
    <label className="mt-3 block text-sm font-semibold">Pedido à IA<textarea ref={input} maxLength={4000} rows={3} disabled={busy || disabled||needsSave} value={message} onChange={event => setMessage(event.target.value)} placeholder="Ex.: organize este relato sem acrescentar fatos" className={fieldClass}/></label>
    {error ? <p role="alert" className="my-2 text-sm text-red-700">{error}</p> : null}
    <button type="button" disabled={busy || disabled || history.loading || (!message.trim()&&!needsSave) || !client} onClick={() => void send()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40"><Send size={16}/>{busy ? "Processando…" : needsSave?'Salvar histórico':"Enviar à IA"}</button>
  </aside>;
}
