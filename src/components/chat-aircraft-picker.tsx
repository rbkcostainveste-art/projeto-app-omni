"use client";

import {useId,useState} from "react";
import {Search,X,Check} from "lucide-react";

const normalize=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"");

export function ChatAircraftPicker({aircraft,value,onChange,required=false}:{required?:boolean;aircraft:{prefix:string}[];value:string;onChange:(prefix:string)=>void}){
 const id=useId();
 const [query,setQuery]=useState("");
 const [open,setOpen]=useState(false);
 const term=normalize(query);
 const matches=aircraft.filter(a=>normalize(a.prefix).includes(term)).sort((a,b)=>{
  const rank=(prefix:string)=>normalize(prefix)===term?0:normalize(prefix.split("-").at(-1)||prefix).startsWith(term)?1:2;
  return rank(a.prefix)-rank(b.prefix)||a.prefix.localeCompare(b.prefix);
 });
 function select(prefix:string){onChange(prefix);setQuery("");setOpen(false);}
 return <section className="space-y-2">
  <label htmlFor={id} className="block text-sm">{required?"Aeronave":"Aeronave (opcional)"}</label>
  <div className="relative"><Search size={17} className="absolute left-3 top-3.5 text-slate-400"/><input id={id} aria-label="Pesquisar aeronave" aria-controls={`${id}-results`} autoComplete="off" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='Enter'&&open&&matches.length===1){e.preventDefault();select(matches[0].prefix);}}} placeholder="Digite poucas letras: CH, CHT, OH…" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm"/>{query?<button type="button" aria-label="Limpar busca de aeronave" className="absolute right-3 top-3.5" onClick={()=>setQuery("")}><X size={17}/></button>:null}</div>
  {open?<div id={`${id}-results`} className="max-h-44 overflow-y-auto rounded-xl border bg-white p-1"><button type="button" onClick={()=>select("")} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50">Sem aeronave</button>{matches.map(a=><button type="button" key={a.prefix} onClick={()=>select(a.prefix)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-blue-50 focus:bg-blue-50">{a.prefix}{value===a.prefix?<Check size={16}/>:null}</button>)}{!matches.length?<p role="status" className="p-3 text-xs text-slate-500">Nenhuma aeronave encontrada. Tente outras letras.</p>:null}</div>:null}
  <div className="flex items-center gap-2 text-xs">{value?<><span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-800">{value}</span><button type="button" onClick={()=>select("")} className="text-slate-600 underline">Remover aeronave</button></>:<span className="text-slate-500">Sem aeronave selecionada.</span>}</div>
 </section>;
}
