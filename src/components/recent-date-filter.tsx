"use client";
import {useEffect,useRef,useState} from 'react';
import {useOperationalDay} from './use-operational-day';
export const localFilterDay=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function RecentDateFilter({from,until,onChange}:{from:string;until:string;onChange:(from:string,until:string)=>void}){
 const [custom,setCustom]=useState(false);
 const day=useOperationalDay(),previousDay=useRef(day);
 useEffect(()=>{const previous=previousDay.current;previousDay.current=day;if(previous!==day&&!custom&&from===previous&&until===previous)onChange(day,day);},[day,custom,from,until,onChange]);
 const days=Array.from({length:7},(_,offset)=>{const d=new Date();d.setDate(d.getDate()-offset);return {value:localFilterDay(d),label:offset===0?'Hoje':offset===1?'Ontem':d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})};});
 const recent=from===until&&days.some(d=>d.value===from);const personalized=custom||!recent;
 const field='mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-[#cedbe7] bg-white px-3 text-sm';
 return <div className="min-w-0 space-y-3"><label className="block text-xs font-bold text-[#52677f]">Data<select aria-label="Data dos registros" className={field} value={personalized?'custom':from} onChange={e=>{setCustom(e.target.value==='custom');if(e.target.value!=='custom')onChange(e.target.value,e.target.value);}}>{days.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}<option value="custom">Data ou período personalizado</option></select></label>{personalized?<div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-xs font-bold">De<input aria-label="Data inicial" type="date" value={from} max={until||undefined} onChange={e=>onChange(e.target.value,until)} className={field}/></label><label className="min-w-0 text-xs font-bold">Até<input aria-label="Data final" type="date" value={until} min={from||undefined} onChange={e=>onChange(from,e.target.value)} className={field}/></label></div>:null}<p className="text-[11px] text-[#718197]">Período pela data de criação do registro.</p></div>;
}
