"use client";
/* eslint-disable @next/next/no-img-element */
import {useRef, useState} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";

type Media = {id:string;name:string;type:"image"|"video"|"audio";url:string};
export function NoticeCarousel({items,mediaUrls,onOpen}:{items:Media[];mediaUrls:Record<string,string>;onOpen?:()=>void}) {
 const [index,setIndex]=useState(0);
 const start=useRef<number|null>(null);
 if(!items.length)return null;
 const current=Math.min(index,items.length-1),item=items[current],src=mediaUrls[item.url];
 const move=(delta:number)=>setIndex((current+delta+items.length)%items.length);
 return <section aria-label="Mídias da publicação" aria-roledescription="carrossel" className="notice-carousel mt-3 overflow-hidden rounded-xl border bg-slate-50">
  <div className="notice-media" onTouchStart={e=>{start.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(item.type!=="video"&&start.current!==null){const delta=e.changedTouches[0].clientX-start.current;if(Math.abs(delta)>50)move(delta<0?1:-1);}start.current=null;}}>
   {!src?<p className="p-6 text-sm">Carregando mídia…</p>:item.type==="image"?(onOpen?<button type="button" onClick={onOpen} aria-label={`Abrir publicação: ${item.name}`} className="block w-full"><img loading="lazy" decoding="async" src={src} alt={item.name} className="block h-auto w-full object-contain"/></button>:<a href={src} target="_blank" rel="noreferrer"><img loading="lazy" decoding="async" src={src} alt={item.name} className="max-h-[55vh] w-full object-contain"/></a>):item.type==="video"?<video key={item.id} src={src} controls playsInline preload="metadata" className="max-h-[55vh] w-full bg-black"/>:<audio key={item.id} src={src} controls preload="metadata" className="w-full"/>}
  </div>
  {items.length>1?<div className="notice-media-controls flex items-center justify-between gap-2 p-1"><button type="button" aria-label="Mídia anterior" onClick={()=>move(-1)} className="rounded-lg p-2 text-blue-700"><ChevronLeft size={20}/></button><span aria-live="polite" className="text-xs text-slate-600">{current+1} / {items.length}</span><button type="button" aria-label="Próxima mídia" onClick={()=>move(1)} className="rounded-lg p-2 text-blue-700"><ChevronRight size={20}/></button></div>:null}
 </section>;
}
