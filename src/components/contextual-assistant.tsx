"use client";

import {useAssistantUploadCleanup} from "./use-assistant-upload-cleanup";
import {FileAttachmentPicker,pastedFiles} from "./file-attachment-picker";
import {prepareAssistantFiles,removeAssistantFiles} from "@/lib/assistant-uploads";
import {approvesAssistantProposal,requestsAssistantFieldApplication,pendingAssistantProposalReply} from "@/lib/assistant-approval";
import {technicalAssistantFields} from "@/lib/assistant-technical-fields";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {Bot, Send, ArrowLeft} from "lucide-react";
import {applyDraftProposal, sameDraft, parseDraftAnswer, type DraftContext, type DraftFields, type DraftProposal, type AssistantAttachment} from "@/lib/contextual-assistant";
import {TechnicalSourceList, type TechnicalSource} from "./technical-library-search";
import {AssistantConversations} from './assistant-conversations';
import {useAssistantHistory,AssistantHistory} from './assistant-history';
import {ChatCapture} from './chat-capture';
import {useAssistantContinuation,useAssistantWorkspace} from './assistant-workspace';

type Suggestion = {original: DraftFields; proposal: DraftProposal;spoken:string};
const fieldClass = "w-full rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-900";

/** Keep mounted while hidden; parent keys by draft/aircraft/user to isolate conversations. */
type Props={
  open: boolean; context: DraftContext; client: SupabaseClient | null; user: string; disabled: boolean;
  onClose: () => void; onApply: (fields: DraftFields,original?:{title:string;description:string;spoken:string}) => void;
};
export function ContextualAssistant(props:Props){
 return <div hidden={!props.open} className="min-w-0"><AssistantConversations direct={props.open} key={`${props.user}:${props.context.id}`} client={props.client} user={props.user} context={{id:props.context.id,label:`Relato ${props.context.prefix||'sem aeronave'} · ${props.context.record?'registro existente':'rascunho'}`}} onClose={props.onClose} renderConversation={(conversationId,onBack,title)=><ContextualConversation key={conversationId} {...props} onClose={onBack} conversationId={conversationId} title={title}/>}/></div>;
}
function ContextualConversation({open, context, client, user, disabled, onClose, onApply,conversationId,title}:Props&{conversationId:string;title:string}) {
  const [readingFiles,setReadingFiles]=useState(false);
  const [message, setMessage] = useState("");
  const [attachments,setAttachments]=useState<AssistantAttachment[]>([]);
  useAssistantUploadCleanup(client,attachments);
  const latest=useRef({fields:context.fields,onApply});
  useLayoutEffect(()=>{latest.current={fields:context.fields,onApply};},[context.fields,onApply]);
  const history=useAssistantHistory(client,user,conversationId);
  const workspace=useAssistantWorkspace();const navigate=workspace?.navigationAvailable()?workspace.navigate:undefined;
  const pending=useRef<{requestId:string;message:string;reply:string}|null>(null);
  const [needsSave,setNeedsSave]=useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [undo, setUndo] = useState<{before: DraftFields; after: DraftFields} | null>(null);
  const [sources, setSources] = useState<TechnicalSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [audioMode, setAudioMode] = useState<'auto'|'review'>('review');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioRetry, setAudioRetry] = useState<File|null>(null);
  const audioRequest = useRef<AbortController|null>(null);
  useEffect(() => () => audioRequest.current?.abort(), []);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useAssistantContinuation(context.id,conversationId,!history.loading&&!disabled,text=>{setMessage(text);void send(text);});
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {if (open) input.current?.focus();}, [open]);

  async function attachFiles(files:File[]){if(readingFiles||busy||disabled||needsSave)return;setReadingFiles(true);setError('');try{const audio=files.filter(f=>f.type.startsWith('audio/'));if(audio.length){if(files.length!==1)throw Error('Envie um áudio por vez.');await transcribe(audio[0]);return;}setAttachments(await prepareAssistantFiles(client,files,attachments));}catch(e){setError((e as Error).message);}finally{setReadingFiles(false);}}
  function close() {
    if(busy||needsSave||recording||transcribing)return;
    request.current?.abort(); request.current = null; setBusy(false); onClose();
  }
  async function save(){if(!pending.current)return;await history.append(pending.current);pending.current=null;setNeedsSave(false);setMessage('');void removeAssistantFiles(client,attachments);setAttachments([]);}
  async function send(text = message) {
    if (request.current || (!text.trim()&&!attachments.length&&!pending.current) || disabled||history.loading) return;
    const controller = new AbortController(); request.current = controller;
    const snapshot = {...context.fields}, prompt = text.trim();
    setBusy(true); setError(""); setNotice("");
    try {
      if(pending.current){await save();return;}
      if(suggestion&&approvesAssistantProposal(prompt)){const next=applyDraftProposal(latest.current.fields,suggestion.original,suggestion.proposal);setUndo({before:suggestion.original,after:next});latest.current.onApply(next,{title:suggestion.original.title,description:suggestion.original.description,spoken:suggestion.spoken});setSuggestion(null);setNotice('Sugestão aplicada aos campos.');pending.current={requestId:crypto.randomUUID(),message:prompt,reply:'Apliquei a sugestão aos campos do formulário.'};setNeedsSave(true);await save();return;}
      const session = await client?.auth.getSession();
      if (!session?.data.session) throw Error("Entre novamente para usar a IA.");
      if (controller.signal.aborted) return;
      const response = await fetch("/api/ai/context", {
        method: "POST", signal: controller.signal,
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}`, "x-employee": user,"x-conversation-id":conversationId,"x-assistant-cards":navigate?"1":"0"},
        body: JSON.stringify({message: prompt, attachments, context: {...context, fields: snapshot}, history: []}),
      });
      const data = await response.json();
      if (request.current !== controller) return;
      if (!response.ok) throw Error(data.error || "A consulta falhou.");
      if (data.contextId !== context.id) throw Error("A resposta pertence a outro rascunho.");
      const answer = parseDraftAnswer(data);
      let reply=answer.reply;
      setSources(data.sources ?? []);
      if (answer.proposal.title !== null || answer.proposal.description !== null || answer.proposal.prefix || answer.proposal.tc!==undefined&&answer.proposal.tc!==null || Object.keys(answer.proposal.technical||{}).length) {
        if((approvesAssistantProposal(prompt)||requestsAssistantFieldApplication(prompt))&&sameDraft(latest.current.fields,snapshot)){
          const next=applyDraftProposal(latest.current.fields,snapshot,answer.proposal);setUndo({before:snapshot,after:next});latest.current.onApply(next,{title:snapshot.title,description:snapshot.description,spoken:prompt});setSuggestion(null);setNotice('Sugestão aplicada aos campos.');
          reply='Apliquei a sugestão aos campos. O registro ainda não foi salvo.';
        }else {setSuggestion({original:snapshot,proposal:answer.proposal,spoken:prompt});reply=pendingAssistantProposalReply(reply);}
      }
      pending.current={requestId:crypto.randomUUID(),message:[prompt,...attachments.map(a=>`Anexo: ${a.name}`)].filter(Boolean).join('\n'),reply};setNeedsSave(true);
      await save();
      if(data.navigation&&navigate)await navigate(data.navigation,{conversationId,title,message:data.continuation?prompt:undefined});
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) setError((reason instanceof Error ? reason.message : "A consulta falhou.")+(pending.current?' A resposta está pronta. Tente salvar o histórico.':''));
    } finally {
      if (request.current === controller) {request.current = null; setBusy(false);}
    }
  }
  async function transcribe(file: File) {
    if (audioRequest.current || busy || disabled || needsSave) return;
    const controller = new AbortController(); audioRequest.current = controller;
    setTranscribing(true); setError(''); setNotice(''); setAudioRetry(null);
    let transcript = '';
    try {
      if (!file.size || file.size > 3 * 1024 * 1024) throw Error('Grave um áudio de até 3 MB.');
      const session = await client?.auth.getSession();
      if (!session?.data.session) throw Error('Entre novamente para usar a IA.');
      const form = new FormData(); form.set('file', file);
      const response = await fetch('/api/ai/transcribe', {method:'POST', signal:controller.signal, headers:{Authorization:`Bearer ${session.data.session.access_token}`, 'x-employee':user, 'x-conversation-id':conversationId}, body:form});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Não foi possível transcrever.');
      if (typeof data.text !== 'string' || !data.text.trim()) throw Error('Nenhuma fala reconhecida. Grave novamente.');
      transcript = data.text.trim();
    } catch (reason) {
      if (!controller.signal.aborted) {setError((reason as Error).message); setAudioRetry(file);}
      return;
    } finally {
      if (audioRequest.current === controller) {audioRequest.current = null; setTranscribing(false);}
    }
    if (controller.signal.aborted) return;
    const combined = [message.trim(), transcript].filter(Boolean).join('\n');
    setMessage(combined);
    if (combined.length > 4000) {setNotice('Transcrição preservada. Divida o texto em pedidos de até 4.000 caracteres.'); return;}
    if (audioMode === 'review' || message.trim()) {setNotice('Transcrição pronta. Confira o texto e toque em enviar.'); return;}
    await send(combined);
  }
  function apply() {
    if (!suggestion || disabled) return;
    try {
      const next = applyDraftProposal(context.fields, suggestion.original, suggestion.proposal);
      setUndo({before: {...context.fields}, after: next}); onApply(next,{title:suggestion.original.title,description:suggestion.original.description,spoken:suggestion.spoken}); setSuggestion(null);
      setNotice(context.record ? "Sugestão aplicada à revisão. Confira os campos, informe a justificativa e use Confirmar atualização para salvar." : "Sugestão aplicada ao rascunho. Confira os campos e use Criar registro para salvar.");
    } catch (reason) {setError((reason as Error).message);}
  }
  const stale = suggestion && !sameDraft(context.fields, suggestion.original);
  return <aside hidden={!open} aria-label="IA do relato técnico" className="min-w-0 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-slate-900 ">
    <header className="flex items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 font-bold"><Bot size={20}/>IA neste relato</h3><p className="mt-1 text-xs">{context.prefix || "Aeronave ainda não selecionada"}{context.model ? ` · ${context.model}` : ""}</p></div><button type="button" aria-label="Conversas anteriores do relato" onClick={close} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-blue-100"><ArrowLeft size={18}/></button></header>
    <p className="my-3 text-xs text-slate-600">{title} · Conversa pessoal vinculada a {context.record ? 'este registro' : 'este rascunho'}. O histórico fica disponível na lista do assistente.</p>
    {history.error?<p role="alert">{history.error}</p>:null}{history.loading?<p role="status">Carregando histórico…</p>:null}{history.more?<button type="button" disabled={history.loading} onClick={()=>void history.older()}>Mensagens anteriores</button>:null}
    <div className="space-y-3" aria-live="polite"><AssistantHistory entries={history.entries} onOpenTarget={navigate?ref=>navigate(ref,{conversationId,title}):undefined}/></div>
    <TechnicalSourceList sources={sources}/>
    {suggestion ? <section className="my-3 rounded-xl bg-white p-3">{stale?<p role="status">Você alterou o formulário durante a resposta. Mantive sua edição. Peça um novo ajuste.</p>:<><p className="text-sm font-bold">Sugestão para o relato</p>{Object.entries({...suggestion.proposal,...suggestion.proposal.technical}).filter(([,value])=>typeof value==="string").map(([key,value])=><p key={key} className="my-2 whitespace-pre-wrap text-sm"><strong>{key==="title"?"Título":key==="description"?"Descrição":key==="prefix"?"Aeronave":key==="tc"?"TC":technicalAssistantFields.find(field=>field[0]===key)?.[1]||key}: </strong>{value as string}</p>)}<p className="text-xs">Diga “pode aplicar” ou use o botão.</p><button type="button" className="min-h-11 text-blue-700 font-bold" disabled={disabled||busy} onClick={apply}>Aplicar sugestão aos campos</button></>}</section>:null}
    {notice ? <p role="status" className="my-3 text-sm text-green-800">{notice}</p> : null}
    {undo ? <button type="button" disabled={disabled || busy || !sameDraft(context.fields, undo.after)} onClick={() => {if (sameDraft(context.fields, undo.after)) {onApply(undo.before); setUndo(null); setNotice("Aplicação desfeita no rascunho.");}}} className="my-2 min-h-11 text-sm font-bold text-blue-800 disabled:opacity-40">Desfazer última aplicação</button> : null}
    <label className="mt-3 block text-sm font-semibold">Pedido à IA<textarea onPaste={e=>{const files=pastedFiles(e);if(files.length){e.preventDefault();void attachFiles(files);}}} aria-label="Pedido à IA" ref={input} maxLength={4000} rows={3} disabled={busy || disabled||needsSave||recording||transcribing} value={message} onChange={event => setMessage(event.target.value)} placeholder="Fale, escreva ou anexe. Ex.: CHT com vazamento na MGB" className={fieldClass}/></label>
    <FileAttachmentPicker disabled={busy||disabled||needsSave||transcribing||recording||readingFiles} onFiles={files=>void attachFiles(files)}/>
    {attachments.map((file,index)=><div key={index} className="flex items-center gap-2 text-xs"><span className="min-w-0 break-all">{file.name}</span><button type="button" disabled={busy||needsSave} aria-label={`Remover ${file.name}`} onClick={()=>{void removeAssistantFiles(client,[file]);setAttachments(files=>files.filter((_,i)=>i!==index));}}>Remover</button></div>)}
    <label className="my-2 block text-xs">Ao gravar áudio<select aria-label="Modo de envio do áudio" value={audioMode} disabled={busy||disabled||needsSave||recording||transcribing} onChange={e=>setAudioMode(e.target.value as 'auto'|'review')} className={fieldClass}><option value="review">Revisar antes de enviar</option><option value="auto">Enviar após transcrever</option></select></label>
    {open ? <ChatCapture allowVideo={false} disabled={busy||disabled||needsSave||transcribing||history.loading} onSend={transcribe} onRecording={setRecording} onError={setError}/> : null}
    {transcribing ? <p role="status">Transcrevendo…</p> : null}
    {audioRetry ? <button type="button" disabled={busy||disabled||transcribing||recording} onClick={()=>void transcribe(audioRetry)} className="min-h-11 text-sm text-blue-800">Tentar transcrever novamente</button> : null}
    {error ? <p role="alert" className="my-2 text-sm text-red-700">{error}</p> : null}
    <button type="button" disabled={busy || readingFiles || disabled || recording || transcribing || message.length>4000 || history.loading || (!message.trim()&&!attachments.length&&!needsSave) || !client} onClick={() => void send()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40"><Send size={16}/>{busy ? "Processando…" : needsSave?'Salvar histórico':"Enviar à IA"}</button>
  </aside>;
}
