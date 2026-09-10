"use client";
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

type Task={id:string;prefix:string;model:string;base:string;reason:string;status:string;triggered_at:string;completed_at:string|null};
type Result={items:Task[];truncated:boolean;queriedAt:string;scope:string;period:string;notice:string};
export function AssistantDrying({client,user,onOpen}:{client:SupabaseClient|null;user:string;onOpen:(id:string)=>void}){
 const [model,setModel]=useState('s92'),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function query(id?:string){
  if(busy)return;setBusy(true);setError('');if(!id)setResult(null);
  const active=new AbortController();controller.current=active;
  try{
   if(!client)throw Error('Sem conexão com o servidor.');
   const {data}=await client.auth.getSession();if(!data.session)throw Error('Entre novamente para consultar.');
   const response=await fetch(`/api/ai/drying?${id?`id=${encodeURIComponent(id)}`:`model=${model}`}`,{headers:{Authorization:`Bearer ${data.session.access_token}`,'x-employee':user},signal:active.signal,cache:'no-store'});
   const value=await response.json();if(!response.ok)throw Error(value.error||'Consulta indisponível.');
   if(id){if(!value.items?.some((item:Task)=>item.id===id))throw Error('Card indisponível.');onOpen(id);}else setResult(value);
  }catch(e){if(!active.signal.aborted)setError(e instanceof Error?e.message:'Consulta indisponível.');}
  finally{if(!active.signal.aborted)setBusy(false);}
 }
 return <section aria-label="Consulta operacional de secagens" className="my-3 rounded-xl border bg-white p-3 text-sm">
  <h3 className="font-bold">Secagens pendentes</h3>
  <div className="mt-2 flex flex-wrap gap-2"><select aria-label="Frota para consultar secagens" disabled={busy} value={model} onChange={e=>{setModel(e.target.value);setResult(null);}} className="min-h-11 rounded-lg border px-2"><option value="s92">S-92 / S-92A</option><option value="all">Todas as frotas autorizadas</option></select><button disabled={busy} onClick={()=>void query()} className="min-h-11 rounded-lg bg-blue-700 px-3 text-white disabled:opacity-50">{busy?'Consultando…':'Consultar dados reais'}</button></div>
  {error?<p role="alert" className="mt-2 text-red-700">{error}</p>:null}
  {result?<div className="mt-3 space-y-2"><p>{result.scope} · {result.period}</p><p className="text-xs text-slate-600">Consulta: {new Date(result.queriedAt).toLocaleString('pt-BR')}</p><p className="text-xs">{result.notice}</p>{result.truncated?<p role="status">Resultado parcial: exibindo as primeiras 100 pendências.</p>:null}{!result.items.length?<p>Nenhuma secagem pendente encontrada neste escopo. Isso não confirma que todas as aeronaves foram lavadas.</p>:result.items.map(item=><article key={item.id} className="rounded-lg border p-3"><strong>{item.prefix}</strong><p>{item.model} · {item.base}</p><p className="mt-1">{item.reason}</p><p className="text-xs">Aguardando secagem · pendência aberta em {new Date(item.triggered_at).toLocaleString('pt-BR')}</p><button disabled={busy} onClick={()=>void query(item.id)} className="mt-2 min-h-11 rounded-lg border px-3 font-bold text-blue-700">Abrir card no Trilho</button></article>)}</div>:null}
 </section>;
}
