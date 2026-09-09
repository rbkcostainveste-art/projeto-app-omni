"use client";
import {Children,isValidElement,useId,useState,type ReactNode} from "react";
import {matchesSearch} from "@/lib/search-text";

function text(node:ReactNode):string {return Children.toArray(node).map(child=>isValidElement<{children?:ReactNode}>(child)?text(child.props.children):String(child)).join("");}

/** Search only among the caller's options: base/fleet restrictions remain upstream. */
export function SearchableSelect({value,onValueChange,children,disabled=false,className="",...props}:{value:string;onValueChange:(value:string)=>void;children:ReactNode;disabled?:boolean;className?:string;"aria-label"?:string}){
 const id=useId();const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0);
 const options=Children.toArray(children).flatMap(child=>{
  if(!isValidElement<{value?:string;children?:ReactNode;disabled?:boolean}>(child))return [];
  const label=text(child.props.children);return [{value:child.props.value??label,label,disabled:!!child.props.disabled}];
 });
 const selected=options.find(option=>option.value===value);
 const visible=options.filter(option=>!option.disabled&&(!query||matchesSearch(`${option.value} ${option.label}`,query)));
 const index=Math.min(active,Math.max(visible.length-1,0));
 function choose(next:string){onValueChange(next);setOpen(false);setQuery("");}
 return <div className="min-w-0"><input {...props} aria-label={props["aria-label"]||"Buscar aeronave"} role="combobox" aria-autocomplete="list" aria-expanded={open&&!disabled} aria-controls={id} aria-activedescendant={open&&visible[index]?`${id}-${index}`:undefined} disabled={disabled} value={open?query:selected?.label||value} placeholder="Digite parte do prefixo ou nome" autoComplete="off" className={`h-11 w-full min-w-0 rounded-xl border border-[#c8d7e6] bg-white px-3 text-sm outline-none focus:border-blue-600 disabled:bg-slate-100 ${className}`} onClick={()=>{if(!open){setQuery("");setActive(0);setOpen(true);}}} onFocus={()=>{setQuery("");setActive(0);setOpen(true);}} onBlur={()=>setOpen(false)} onChange={event=>{setQuery(event.target.value);setActive(0);setOpen(true);}} onKeyDown={event=>{
 if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);}
 if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();setOpen(true);setActive(i=>Math.max(0,Math.min(visible.length-1,i+(event.key==="ArrowDown"?1:-1))));}
 if(event.key==="Enter"&&open){event.preventDefault();if(visible[index])choose(visible[index].value);}
 }}/>{open&&!disabled?<div id={id} role="listbox" className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#c8d7e6] bg-white p-1 shadow-sm">{visible.map((option,i)=><button id={`${id}-${i}`} key={option.value} type="button" role="option" aria-selected={option.value===value} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option.value)} className={`block min-h-11 w-full break-words rounded-lg px-3 py-2 text-left text-sm ${i===index?"bg-blue-50 text-blue-900":"hover:bg-slate-50"}`}>{option.label}</button>)}{!visible.length?<p role="status" className="p-3 text-sm text-slate-600">Nenhum resultado encontrado.</p>:null}</div>:null}</div>;
}
