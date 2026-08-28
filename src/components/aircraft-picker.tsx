"use client";

import { Search } from "lucide-react";
import { useMemo,useState } from "react";

export type AircraftOption={ prefix:string; model:string; base:string };

export function AircraftPicker({ aircraft,value,onChange }:{ aircraft:AircraftOption[]; value:string; onChange:(aircraft:AircraftOption)=>void }) {
  const selected=aircraft.find((item)=>item.prefix===value);
  const [query,setQuery]=useState("");
  const visible=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase("pt-BR");
    if(!term) return aircraft;
    return aircraft.filter((item)=>`${item.prefix} ${item.model} ${item.base}`.toLocaleLowerCase("pt-BR").includes(term));
  },[aircraft,query]);

  return <div>
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718197]"/>
      <input aria-label="Buscar aeronave" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar por prefixo, modelo ou base" autoComplete="off" className="h-11 w-full rounded-xl border border-[#cedbe7] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#1769e0]"/>
    </div>
    <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-[#d8e3ee] bg-white p-1">
      {visible.map((item)=><button key={item.prefix} type="button" onClick={()=>{onChange(item);setQuery("");}} className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm ${item.prefix===value?"bg-[#e8f2ff] text-[#0e5fbd]":"hover:bg-[#f2f6fa]"}`}><strong>{item.prefix}</strong><span className="ml-1 text-xs text-[#718197]">· {item.model} · {item.base}</span></button>)}
      {visible.length===0?<p className="px-3 py-5 text-center text-xs text-[#718197]">Nenhuma aeronave encontrada.</p>:null}
    </div>
    {selected?<p className="mt-2 text-xs font-semibold text-green-700">Selecionada: {selected.prefix} · {selected.model} · {selected.base}</p>:<p className="mt-2 text-xs text-[#718197]">Digite para filtrar e toque na aeronave desejada.</p>}
  </div>;
}
