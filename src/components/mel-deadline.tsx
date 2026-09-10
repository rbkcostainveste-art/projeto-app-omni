"use client";
import {useEffect,useState} from 'react';
import {calendarMelDeadline,deadlineRemaining} from '@/lib/mel-deadline';
export function MelCountdown({deadline,timeZone}:{deadline?:string;timeZone?:string}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 if(!deadline)return null;
 return <span className={`block rounded-lg p-2 text-xs font-semibold ${Date.parse(deadline)<=now?'bg-red-100 text-red-900':'bg-blue-50 text-blue-900'}`}>{deadlineRemaining(deadline,now)} · limite: {new Date(deadline).toLocaleString('pt-BR',timeZone?{timeZone}:undefined)} ({timeZone||'horário deste aparelho'})</span>;
}
const local=(v?:string)=>v&&Number.isFinite(Date.parse(v))?new Date(Date.parse(v)-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
export function MelDeadlineFields({value,onChange,disabled=false}:{value:Record<string,string>;onChange:(value:Record<string,string>)=>void;disabled?:boolean}){
 function change(key:string,text:string){
  const next={...value,[key]:text};
  if(key==='repairCategory'){next.category=text;next.repairDays=({B:'3',C:'10',D:'120'} as Record<string,string>)[text]||'';next.deadlineMode=text==='A'?'manual':'calendar';}
  const calculated=calendarMelDeadline(next.discoveredAt,next.repairCategory,Number(next.repairDays),next.timeZone||'UTC');
  if(calculated)next.deadline=calculated;
  onChange(next);
 }
 const style='mt-1 min-h-11 w-full rounded-lg border bg-white p-2 text-sm disabled:bg-slate-100';
 return <fieldset disabled={disabled} className="col-span-full space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3"><legend className="px-1 text-sm font-bold">Prazo MEL · registro original</legend><div className="grid gap-3 sm:grid-cols-2">
  {([['discoveredAt','Descoberta da discrepância'],['deferredAt','Aplicação do diferimento']] as const).map(([key,label])=><label className="text-xs font-semibold" key={key}>{label} (horário deste aparelho)<input aria-label={label} type="datetime-local" className={style} value={local(value[key])} onChange={e=>change(key,e.target.value?new Date(e.target.value).toISOString():'')}/></label>)}
  <label className="text-xs font-semibold">Categoria MEL<select aria-label="Categoria MEL" className={style} value={value.repairCategory||''} onChange={e=>change('repairCategory',e.target.value)}><option value="">Selecione conforme o item</option>{['A','B','C','D'].map(k=><option key={k}>{k}</option>)}</select></label>
  <label className="text-xs font-semibold">Fuso da contagem previsto na MEL<select aria-label="Fuso da contagem" className={style} value={value.timeZone||''} onChange={e=>change('timeZone',e.target.value)}><option value="">Selecione</option><option value="UTC">UTC</option><option value="America/Sao_Paulo">Local · Brasília</option></select></label>
  {value.repairCategory&&value.repairCategory!=='A'?<label className="text-xs font-semibold">Dias calendáricos do item<input aria-label="Dias calendáricos do item" type="number" min="1" step="1" className={style} value={value.repairDays||''} onChange={e=>change('repairDays',e.target.value)}/></label>:null}
  <label className="text-xs font-semibold">Primeiro aviso<select aria-label="Primeiro aviso MEL" className={style} value={value.alertHours||'48'} onChange={e=>change('alertHours',e.target.value)}>{['24','48','72'].map(k=><option key={k} value={k}>{k} horas antes</option>)}</select></label>
 </div><label className="block text-xs font-semibold">Regra e localização no item MEL<input aria-label="Regra e localização no item MEL" className={style} value={value.calculationBasis||''} onChange={e=>change('calculationBasis',e.target.value)}/></label>
 <p className="text-xs text-slate-600">B, C e D: exclui o dia da descoberta; o servidor confere o cálculo. Categoria A: informe a regra e confira a data limite abaixo. Este contador de calendário não controla horas, ciclos ou dias de voo. Esses limites exigem acompanhamento próprio.</p>
 <MelCountdown deadline={value.deadline} timeZone={value.timeZone}/><p className="text-xs text-slate-600">Cadastrar depois não reinicia o prazo. Correções exigem autorização e motivo e ficam no histórico. Este formulário não concede extensão de MEL.</p></fieldset>;
}
