"use client";
import {useId,useState} from "react";

type Option={id:string;label:string;search:string};
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function ToolboxSearchSelect({label,placeholder,value,options,onChange,numeric=false}:{label:string;placeholder:string;value:string;options:Option[];onChange:(value:string)=>void;numeric?:boolean}){
 const id=useId();const[query,setQuery]=useState<string|null>(null);const[open,setOpen]=useState(false);
 const selected=options.find(option=>option.id===value);
 const matches=options.filter(option=>normalize(query??"").split(/\s+/).every(token=>normalize(option.search).includes(token)));
 return <div className="relative text-xs font-bold" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){setOpen(false);setQuery(null);}}}><label htmlFor={id}>{label}</label><input id={id} role="combobox" autoComplete="off" aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list" inputMode={numeric?"numeric":"text"} value={query??selected?.label??""} onFocus={()=>{setOpen(true);setQuery("");}} onChange={event=>{setQuery(numeric?event.target.value.replace(/\D/g,""):event.target.value);onChange("");setOpen(true);}} onKeyDown={event=>{if(event.key==="Escape"){setOpen(false);setQuery(null);}}} placeholder={placeholder} className="mt-1 h-11 w-full rounded-xl border bg-white px-3"/>{open?<div id={`${id}-options`} role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-xl border bg-white p-1 shadow-xl">{matches.map(option=><button type="button" role="option" aria-selected={option.id===value} key={option.id} onClick={()=>{onChange(option.id);setQuery(null);setOpen(false);}} className="block w-full rounded-lg p-3 text-left hover:bg-blue-50 focus:bg-blue-50">{option.label}</button>)}{!matches.length?<p className="p-3 text-slate-500">Nenhum resultado encontrado.</p>:null}</div>:null}</div>;
}
