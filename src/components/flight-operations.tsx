"use client";

import {useCallback,useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {X} from 'lucide-react';
import {activeEquipment,eventAvailable,eventLabels,isS92,operationTotals,pendingEndEvents,type OperationData} from '@/lib/flight-operations';

type Props={supabase:SupabaseClient|null;flight:{id:string;prefix:string;model:string;cancelled?:boolean};readOnly?:boolean;requireSignature:(action:()=>void|Promise<void>,label?:string)=>Promise<boolean>};
const localInput=(value:string)=>{const date=new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;};

export function FlightOperations({supabase,flight,readOnly=false,requireSignature}:Props){
 const [data,setData]=useState<OperationData|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [open,setOpen]=useState(false);
 const [correction,setCorrection]=useState<{id:string;at:string}|null>(null);
 const [closing,setClosing]=useState(false);
 const pending=useRef<{id:string;revision:number;action:string;payload:Record<string,string>}|null>(null);
 const [retry,setRetry]=useState(false);const lock=useRef(false);
 const load=useCallback(async()=>{if(!supabase)return;const {data:result,error:failure}=await supabase.rpc('get_flight_operation',{p_flight_id:flight.id});if(failure){setError(failure.message);return;}const next=result as OperationData;setData(current=>current&&current.revision>next.revision?current:next);},[supabase,flight.id]);
 useEffect(()=>{let active=true;const refresh=()=>{if(active&&!lock.current)void load();};refresh();const timer=window.setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[load]);
 async function send(action:string,payload:Record<string,string>){
  if(!data||!supabase||lock.current||readOnly)return;
  lock.current=true;setBusy(true);setError('');
  const request=pending.current??{id:crypto.randomUUID(),revision:data.revision,action,payload};pending.current=request;
  try{const {data:result,error:failure}=await supabase.rpc('record_flight_operation',{p_flight_id:flight.id,p_request_id:request.id,p_revision:request.revision,p_action:request.action,p_payload:request.payload});if(failure)throw failure;setData(result as OperationData);pending.current=null;setRetry(false);setCorrection(null);}
  catch(failure){const message=typeof failure==='object'&&failure&&'message' in failure?String(failure.message):'Não foi possível salvar';setError(message);setRetry(true);}
  finally{lock.current=false;setBusy(false);}
 }
 const disabled=busy||retry||readOnly||Boolean(flight.cancelled);
 const sign=(key:string,result:string)=>void requireSignature(()=>send('approve',{key,result}),'Conferir e assinar verificação');
 const controls=<>{error?<p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}{retry?<div className="my-3 flex gap-2"><button disabled={busy} onClick={()=>void send('',{})} className="rounded-xl border px-3 py-2 text-sm">Tentar novamente</button><button disabled={busy} onClick={()=>{pending.current=null;setRetry(false);setError('');void load();}} className="rounded-xl border px-3 py-2 text-sm">Recarregar e conferir</button></div>:null}</>;
 if(!data)return <div className="rounded-xl border p-3 text-sm">{error||'Carregando registros operacionais…'}<button onClick={()=>void load()} className="ml-3 text-blue-700">Recarregar</button></div>;
 const keys=[...(data.first?['drain']:[]),'fuel','inspection','hums',...(data.closed?['postflight']:[])];
 const labels:Record<string,string>={drain:'Dreno de combustível',fuel:'Abastecimento',inspection:data.first?'Pré-voo':'Entre voos',hums:'HUMS',postflight:'Inspeção após o voo'};
 return <section className="space-y-3">
  <p className="text-xs text-[#60758c]">{data.first?'Primeira operação do dia · dreno e pré-voo':'Operação seguinte · sem dreno de combustível'} · {data.day.split('-').reverse().join('/')}</p>
  <div className="grid gap-3 sm:grid-cols-2">{keys.map(key=>{
   const expectedKind=key==='inspection'?(data.first?'preflight':'between'):key;
   const expectedTarget=key==='inspection'&&!data.first?data.previousFlightId:flight.id;
   const stored=data.checks[key];const check=stored?.kind===expectedKind&&stored.targetFlightId===expectedTarget?stored:undefined;
   const approved=check?.approval;const execution=check?.execution;
   const tone=approved?(approved.result==='ok'?'border-green-300 bg-green-50':'border-red-300 bg-red-50'):execution?'border-orange-400 bg-orange-50':'border-[#d8e4ef] bg-[#f8fbff]';
   return <div key={key} className={`rounded-xl border p-3 ${tone}`}><h4 className="text-sm font-extrabold">{labels[key]}</h4><p className="mt-1 text-xs font-semibold">{approved?(approved.result==='ok'?'Conferido · OK':'Conferido · não conforme'):execution?'Executado · aguardando conferência':'Pendente'}</p>
    {execution?<p className="mt-2 text-xs">Executor: mat. {execution.actor} · {new Date(execution.at).toLocaleString('pt-BR')}</p>:null}
    {approved?<p className="mt-2 text-xs">Assinatura: mat. {approved.actor} · {new Date(approved.at).toLocaleString('pt-BR')}</p>:null}
    {key==='inspection'&&!data.first?<p className="mt-2 text-xs text-[#60758c]">Inspeção vinculada à operação anterior desta aeronave.</p>:null}
    {data.canSign?<div className="mt-3 flex gap-2"><button disabled={disabled} onClick={()=>sign(key,'ok')} className="min-h-11 flex-1 rounded-lg bg-green-700 px-3 text-xs font-bold text-white disabled:opacity-40">{execution?'Conferir e assinar OK':'Assinar OK'}</button><button disabled={disabled} onClick={()=>sign(key,'no')} className="min-h-11 rounded-lg border border-red-300 px-3 text-xs font-bold text-red-700 disabled:opacity-40">Não conforme</button></div>:null}
    {data.canExecute&&['drain','hums'].includes(key)&&!approved?<button disabled={disabled||Boolean(execution)} onClick={()=>void send('execute',{key})} className="mt-3 min-h-11 w-full rounded-lg bg-orange-100 px-3 text-xs font-bold text-orange-900 disabled:opacity-40">Registrar execução · sem assinatura</button>:null}
   </div>;
  })}</div>
  {!open?controls:null}
  <button onClick={()=>setOpen(true)} className="min-h-12 w-full rounded-xl bg-[#1268d8] px-4 py-3 text-sm font-extrabold text-white">{data.events.length?'Eventos da operação':data.canPilot?'Acionar · registrar eventos':'Ver eventos da operação'}</button>
  {open?<OperationDialog title={`${flight.prefix} · ${flight.model}`} onClose={()=>{if(!busy)setOpen(false);}}>
   <p className="text-sm text-[#60758c]">Cada toque registra o evento e o horário neste voo.</p>
   {closing&&!data.closed?<section aria-label="Concluir operação" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><h4 className="font-extrabold">Concluir operação</h4><p className="mt-2 text-sm">{pendingEndEvents(data.events).length?'Ainda faltam os registros abaixo. Confirme cada evento quando ele realmente acontecer.':'Todos os cortes foram registrados. A operação pode ser encerrada.'}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{pendingEndEvents(data.events).map(type=><button key={type} disabled={disabled||!data.canPilot||!eventAvailable(data.events,type,flight.model)} onClick={()=>void send('event',{type,at:new Date().toISOString()})} className="min-h-12 rounded-lg border bg-white p-3 text-sm font-bold disabled:opacity-40">Registrar: {eventLabels[type]}</button>)}</div><div className="mt-3 flex gap-2"><button disabled={disabled||!data.canPilot||!eventAvailable(data.events,'finish',flight.model)} onClick={()=>void send('event',{type:'finish',at:new Date().toISOString()})} className="min-h-12 flex-1 rounded-lg bg-green-700 p-3 text-sm font-bold text-white disabled:opacity-40">Confirmar encerramento</button><button onClick={()=>setClosing(false)} className="rounded-lg border px-3 text-sm font-bold">Voltar</button></div></section>:null}
   <div className="mt-4 grid grid-cols-2 gap-3">{[...(isS92(flight.model)?['apu']:[]),'engine1','engine2'].map(equipment=>{const on=activeEquipment(data.events,equipment);const type=`${equipment}_${on?'off':'on'}`;const total=operationTotals(data.events,equipment);return <button key={equipment} disabled={disabled||!data.canPilot||!eventAvailable(data.events,type,flight.model)||data.closed} onClick={()=>void send('event',{type,at:new Date().toISOString()})} className={`min-h-24 rounded-xl border p-4 text-left disabled:opacity-40 ${on?'border-green-400 bg-green-50':'border-blue-200 bg-blue-50'}`}><strong className="block text-sm">{eventLabels[type]}</strong><span className="mt-2 block text-xs">{total.activations} acionamento(s) · {total.minutes} min concluídos{total.running?' · ligado':''}</span></button>;})}
    {['takeoff','landing','rotor_brake','finish'].map(type=>{
     const recorded=data.events.filter(event=>event.type===type).at(-1);
     const available=(type==='finish'?data.events.length>0:eventAvailable(data.events,type,flight.model))&&!data.closed;
     const completedLabels:Record<string,string>={takeoff:'Decolagem registrada',landing:'Pouso registrado',rotor_brake:'Freio rotor registrado',finish:'Operação encerrada'};
     const repeatLabels:Record<string,string>={takeoff:'Decolar novamente',landing:'Registrar novo pouso',rotor_brake:'Registrar nova aplicação'};
     return <button key={type} aria-pressed={Boolean(recorded)} style={recorded?{opacity:1}:undefined} disabled={disabled||!data.canPilot||!available} onClick={()=>{if(type==='finish'){setClosing(true);return;}void send('event',{type,at:new Date().toISOString()});}} className={`min-h-24 rounded-xl border p-4 text-left text-sm font-bold ${recorded?(type==='finish'?'border-red-500 bg-red-100 text-red-900 disabled:opacity-100':'border-green-500 bg-green-100 text-green-900 disabled:opacity-100'):type==='finish'&&available?'border-blue-500 bg-blue-50 text-blue-900':'border-[#cbd9e7] bg-white disabled:opacity-40'}`}>
      <strong className="block">{recorded?`✓ ${completedLabels[type]}`:eventLabels[type]}</strong>
      {recorded?<span className="mt-2 block text-xs font-semibold">{new Date(recorded.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>:null}
      {recorded&&available&&data.canPilot?<span className="mt-2 block text-xs underline">{repeatLabels[type]}</span>:null}
      {type==='finish'&&!recorded&&data.events.length>0?<span className="mt-2 block text-xs font-semibold">{pendingEndEvents(data.events).length?'Conferir registros pendentes':'Pronto para concluir'}</span>:null}
     </button>;
    })}
   </div>
   <p className="mt-3 text-xs text-[#60758c]">{data.events.filter(e=>e.type==='takeoff').length} decolagem(ns) · {data.events.filter(e=>e.type==='landing').length} pouso(s) · {data.events.filter(e=>e.type==='rotor_brake').length} aplicação(ões) do freio rotor</p>
   {controls}
   <h4 className="mt-5 font-bold">Registros deste voo</h4><div className="mt-2 space-y-2">{data.events.map(event=><article key={event.id} className="rounded-xl border p-3 text-sm"><strong>{eventLabels[event.type]||event.type}</strong><p className="mt-1 text-xs">{new Date(event.at).toLocaleString('pt-BR')} · mat. {event.actor}</p>{event.corrections?.length?<p className="mt-1 text-xs text-amber-800">Horário corrigido · {event.corrections.length} correção(ões) preservada(s) no histórico</p>:null}{data.canPilot?<button disabled={disabled} onClick={()=>setCorrection({id:event.id,at:localInput(event.at)})} className="mt-2 text-xs font-bold text-blue-700">Corrigir horário</button>:null}</article>)}</div>
   {correction?<div className="mt-3 rounded-xl border bg-blue-50 p-3"><label className="text-sm font-bold">Horário real do evento<input aria-label="Horário real do evento" type="datetime-local" value={correction.at} onChange={e=>setCorrection({...correction,at:e.target.value})} className="mt-2 block min-h-11 w-full rounded-lg border bg-white p-2"/></label><div className="mt-3 flex gap-2"><button disabled={disabled||!correction.at} onClick={()=>void send('correct',{id:correction.id,at:new Date(correction.at).toISOString()})} className="rounded-lg bg-blue-700 p-3 text-sm text-white">Salvar correção</button><button onClick={()=>setCorrection(null)} className="rounded-lg border p-3 text-sm">Voltar</button></div></div>:null}
   {!data.events.length?<p className="mt-3 text-sm text-[#60758c]">Nenhum evento registrado.</p>:null}
  </OperationDialog>:null}
 </section>;
}

function OperationDialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const element=ref.current;element?.showModal();return()=>element?.close();},[]);
 return <dialog ref={ref} aria-label={`Eventos · ${title}`} onCancel={e=>{e.preventDefault();onClose();}} className="m-auto max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-0 text-[#17324d] shadow-2xl backdrop:bg-[#071a30]/60"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4"><h3 className="font-extrabold">{title}</h3><button onClick={onClose} aria-label="Fechar eventos" className="grid h-11 w-11 place-items-center"><X/></button></header><div className="p-4">{children}</div></dialog>;
}
