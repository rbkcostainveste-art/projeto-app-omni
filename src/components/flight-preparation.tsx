"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {useScreenNotifications} from './screen-notifications';
import {pendingPreparationChecks,preparationBlockerText,type PreparationState} from '@/lib/preparation-display';
export type {PreparationState} from '@/lib/preparation-display';
const PreparationContext=createContext<Record<string,PreparationState>>({});
export function PreparationBadge({flightId,state}:{flightId?:string;state?:PreparationState}){
 const states=useContext(PreparationContext);const value=state||(flightId?states[flightId]:undefined);
 if(!value||value.status==='inactive')return null;
 const complete=value.checklist&&value.checklist.approved===value.checklist.total;
 const blockers=value.blockers||[];
 const remaining=Math.max(0,(value.blockerCount||blockers.length)-blockers.length);
 return <span role="status" aria-label="Situação da preparação do voo" className="mt-2 block min-w-0 space-y-1.5 text-xs">
  {value.checklist?<span className={`block rounded-lg px-2 py-2 font-bold ${complete?'bg-emerald-50 text-emerald-900':'bg-slate-100 text-slate-700'}`}>{complete?'✓ Checklist da manutenção concluído':'Checklist da manutenção'} · {value.checklist.approved}/{value.checklist.total} conferidos{value.pending.length?<span className="mt-1 block font-normal">Falta conferir: {pendingPreparationChecks(value)}.</span>:null}</span>:value.pending.length?<span className="block rounded-lg bg-slate-100 p-2 text-slate-700">Falta conferir: {pendingPreparationChecks(value)}.</span>:null}
  {value.blocked?<span className="block rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-amber-950"><strong className="block">⚠ Impedimento técnico</strong>{blockers.length?blockers.map((blocker,index)=><span key={index} className="mt-1 block break-words">{preparationBlockerText(blocker)}{blocker.ticketCode?<span className="block text-[10px]">{blocker.ticketCode}</span>:null}</span>):<span className="mt-1 block">Há pendência técnica. A manutenção precisa avaliar.</span>}{remaining?<span className="mt-1 block">E mais {remaining} ocorrência(s) com impedimento.</span>:null}</span>:null}
  <span className={`block rounded-lg px-2 py-2 font-bold ${value.status==='ready'?'bg-emerald-100 text-emerald-900':value.status==='reconfirm'?'bg-amber-100 text-amber-900':'bg-slate-100 text-slate-700'}`}>{value.status==='ready'?'✓ Preparação concluída':value.status==='reconfirm'?'↻ Preparação precisa ser reconfirmada':'Aguardando confirmação final da manutenção'}{value.status==='reconfirm'&&value.reason?<span className="mt-1 block font-normal">{value.reason}</span>:null}{value.status==='ready'&&value.at?<span className="mt-1 block font-normal">{new Date(value.at).toLocaleString('pt-BR')} · mat. {value.actor}</span>:null}</span>
 </span>;
}
export function PreparationProvider({client,flights,onOpen,children}:{client:SupabaseClient|null;flights:{id:string;prefix:string;date:string;departure:string;cancelled?:boolean;deletedAt?:string}[];onOpen:(id:string)=>void;children:ReactNode}){
 const [states,setStates]=useState<Record<string,PreparationState>>({});
 const ids=JSON.stringify(flights.filter(f=>!f.deletedAt&&!f.cancelled).map(f=>f.id).sort());
 useEffect(()=>{
  if(!client)return;let active=true,busy=false;
  const refresh=async()=>{if(busy)return;busy=true;try{
   const list=JSON.parse(ids) as string[];const next:Record<string,PreparationState>={};
   for(let i=0;i<list.length;i+=100){const {data,error}=await client.rpc('get_preparation_statuses',{p_ids:list.slice(i,i+100)});if(error)throw error;Object.assign(next,data);}
   if(active)setStates(next);
  }catch{if(active)setStates({});}finally{busy=false;}};
  const changed=()=>{void refresh();};changed();const timer=window.setInterval(changed,10000);
  window.addEventListener('focus',changed);window.addEventListener('preparation-updated',changed);
  const channel=client.channel(`preparation-${crypto.randomUUID()}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'shared_app_state'},changed).subscribe();
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',changed);window.removeEventListener('preparation-updated',changed);void client.removeChannel(channel);};
 },[client,ids]);
 const items=flights.flatMap(f=>{const s=states[f.id];return s?.at&&['ready','reconfirm'].includes(s.status)?[{id:`${f.id}|${s.at}|${s.status}`,title:s.status==='ready'?'Preparação concluída':'Preparação precisa ser reconfirmada',description:`${f.prefix} · ${f.departure} · ${s.status==='ready'?'Conclusão informada pela manutenção':s.reason||'Confira as pendências'}`,at:s.at}]:[];});
 useScreenNotifications('preparation',items,id=>onOpen(id.split('|')[0]));
 return <PreparationContext.Provider value={states}>{children}</PreparationContext.Provider>;
}
