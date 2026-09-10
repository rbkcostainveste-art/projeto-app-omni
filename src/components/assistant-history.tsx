"use client";
import {useCallback,useEffect,useState} from 'react';
import {splitTargetLinks,type AssistantTargetRef} from "@/lib/assistant-targets";
import type {SupabaseClient} from '@supabase/supabase-js';
type Entry={id:number;message:string;reply:string;created_at:string};
export function useAssistantHistory(client:SupabaseClient|null,user:string,conversationId:string){
 const [entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[more,setMore]=useState(false),[error,setError]=useState('');
 const rpc=useCallback(async(action:string,payload:Record<string,unknown>={})=>{if(!client||!conversationId)throw Error('Selecione uma conversa.');const {data,error}=await client.rpc('personal_assistant',{p_action:action,p_payload:{...payload,employee:user,conversationId}});if(error)throw Error(error.message);return data;},[client,user,conversationId]);
 useEffect(()=>{let live=true;void rpc('list').then(data=>{if(live){setEntries(data);setMore(data.length===50);setError('');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[rpc]);
 async function append(entry:{requestId:string;message:string;reply:string}){const saved=await rpc('append',entry) as Entry;setEntries(items=>[...items.filter(i=>i.id!==saved.id),saved].sort((a,b)=>a.id-b.id));window.dispatchEvent(new Event('flight-ia-assistant-history-saved'));}
 async function older(){setLoading(true);try{const data=await rpc('list',{before:entries[0]?.id}) as Entry[];setEntries(items=>[...new Map([...data,...items].map(e=>[e.id,e])).values()].sort((a,b)=>a.id-b.id));setMore(data.length===50);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 return {entries,loading,more,error,append,older};
}
function Reply({reply,onOpenTarget}:{reply:string;onOpenTarget?:(ref:AssistantTargetRef)=>Promise<void>}){
 const {text,cards}=splitTargetLinks(reply);const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function open(ref:AssistantTargetRef){if(!onOpenTarget||busy)return;setBusy(`${ref.kind}:${ref.id}`);setError('');try{await onOpenTarget(ref);}catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir o card.');}finally{setBusy('');}}
 return <><p className="whitespace-pre-wrap break-words text-sm">{text.split(/(\*\*[^*\n]+\*\*)/g).map((part,index)=>part.startsWith("**")&&part.endsWith("**")?<strong key={index}>{part.slice(2,-2)}</strong>:part)}</p>{cards.length?<div className="mt-3 space-y-2" aria-label="Registros encontrados">{cards.map((card,i)=><article key={`${card.kind}:${card.id}:${i}`} className="rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="break-words text-sm font-bold">{card.label}</p><button type="button" disabled={!onOpenTarget||Boolean(busy)} onClick={()=>void open(card)} className="mt-2 min-h-11 rounded-lg border border-blue-300 bg-white px-3 text-sm font-bold text-blue-800 disabled:opacity-50">{busy===`${card.kind}:${card.id}`?'Verificando acesso…':card.kind==='maintenance'?'Abrir relato':card.kind==='wall'?'Abrir no Mural':card.kind==='activity'?'Abrir atividade':card.kind==='flight'?'Abrir voo':card.kind==='passage'?'Abrir passagem':card.kind==='tool'?'Abrir na Ferramentaria':card.kind==='cockpit'?'Abrir no Cockpit':card.kind==='note'?'Abrir nota pessoal':'Abrir secagem no Trilho'}</button></article>)}</div>:null}{error?<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>:null}</>;
}
export function AssistantHistory({entries,onOpenTarget}:{entries:Entry[];onOpenTarget?:(ref:AssistantTargetRef)=>Promise<void>}){
 return <div className="space-y-4">{entries.map(entry=><div key={entry.id} className="space-y-2"><p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-xl bg-emerald-100 p-3 text-sm">{entry.message||'Anexo enviado para análise'}</p><div className="mr-auto max-w-[95%] rounded-xl bg-white p-3 shadow-sm"><p className="mb-1 text-xs font-bold text-emerald-800">Assistente IA</p><Reply reply={entry.reply} onOpenTarget={onOpenTarget}/><time className="mt-2 block text-[10px] text-slate-500">{new Date(entry.created_at).toLocaleString('pt-BR')}</time></div></div>)}</div>;
}
