"use client";
import {useCallback,useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Entry={id:number;message:string;reply:string;created_at:string};
export function useAssistantHistory(client:SupabaseClient|null,user:string){
 const [entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[more,setMore]=useState(false),[error,setError]=useState('');
 const rpc=useCallback(async(action:string,payload:Record<string,unknown>={})=>{if(!client)throw Error('Sem conexão com o histórico.');const {data,error}=await client.rpc('personal_assistant',{p_action:action,p_payload:{...payload,employee:user}});if(error)throw Error(error.message);return data;},[client,user]);
 useEffect(()=>{let live=true;void rpc('list').then(data=>{if(live){setEntries(data);setMore(data.length===50);setError('');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[rpc]);
 async function append(entry:{requestId:string;message:string;reply:string}){const saved=await rpc('append',entry) as Entry;setEntries(items=>[...items.filter(i=>i.id!==saved.id),saved].sort((a,b)=>a.id-b.id));}
 async function older(){setLoading(true);try{const data=await rpc('list',{before:entries[0]?.id}) as Entry[];setEntries(items=>[...new Map([...data,...items].map(e=>[e.id,e])).values()].sort((a,b)=>a.id-b.id));setMore(data.length===50);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 return {entries,loading,more,error,append,older};
}
export function AssistantHistory({entries}:{entries:Entry[]}){
 return <div className="space-y-4">{entries.map(entry=><div key={entry.id} className="space-y-2"><p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-xl bg-emerald-100 p-3 text-sm">{entry.message||'Foto enviada para análise'}</p><div className="mr-auto max-w-[95%] rounded-xl bg-white p-3 shadow-sm"><p className="mb-1 text-xs font-bold text-emerald-800">Assistente IA</p><p className="whitespace-pre-wrap break-words text-sm">{entry.reply}</p><time className="mt-2 block text-[10px] text-slate-500">{new Date(entry.created_at).toLocaleString('pt-BR')}</time></div></div>)}</div>;
}
