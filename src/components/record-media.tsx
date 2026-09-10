"use client";

/* eslint-disable @next/next/no-img-element */

import {useEffect,useState} from "react";

import type {SupabaseClient} from "@supabase/supabase-js";

import {FileAttachmentPicker,pastedFiles} from "./file-attachment-picker";
import {X} from "lucide-react";

import {mediaFormat,type RecordMedia} from "@/lib/record-media";

export function MediaPicker({files,onChange,disabled=false,documents=false}:{files:File[];onChange:(files:File[])=>void;disabled?:boolean;documents?:boolean}){

 const [error,setError]=useState("");

 const add=(next:File[])=>{if(disabled)return;try{if(files.length+next.length>10)throw Error("Selecione até 10 anexos por envio.");next.forEach(f=>{if(!documents&&mediaFormat(f).type==="document")throw Error("Este campo aceita imagens, áudios ou vídeos.");mediaFormat(f);});onChange([...files,...next]);setError("");}catch(e){setError((e as Error).message);}};
 return <div className="my-3 space-y-2" onPaste={e=>{const next=pastedFiles(e);if(next.length){e.preventDefault();add(next);}}}><FileAttachmentPicker disabled={disabled} accept={"image/*,audio/*,video/*"+(documents?",application/pdf":"")} onFiles={add}/>
 <p className="text-[11px] text-slate-500">Imagens e áudios: até 10 MB. Vídeos: até 50 MB por arquivo.</p>{files.map((file,i)=><div key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs"><span className="break-all">{file.name}</span><button type="button" disabled={disabled} aria-label={`Remover ${file.name}`} onClick={()=>onChange(files.filter((_,index)=>index!==i))}><X size={15}/></button></div>)}{error?<p role="alert" className="text-xs text-red-700">{error}</p>:null}</div>;

}

export function MediaGallery({items=[],supabase}:{items?:RecordMedia[];supabase:SupabaseClient|null}){

 const [urls,setUrls]=useState<Record<string,string>>({});const [error,setError]=useState("");

 const paths=JSON.stringify(items.map(item=>[item.bucket||"wall-media",item.url]));

 useEffect(()=>{if(!supabase)return;let active=true;const refresh=async()=>{const pairs=JSON.parse(paths) as string[][];const next:Record<string,string>={};for(const bucket of new Set(pairs.map(pair=>pair[0]))){const {data,error}=await supabase.storage.from(bucket).createSignedUrls(pairs.filter(pair=>pair[0]===bucket).map(pair=>pair[1]),3600);if(error){if(active)setError("Não foi possível abrir os anexos. Reabra o registro para tentar novamente.");continue;}for(const item of data||[])if(item.signedUrl&&item.path)next[`${bucket}/${item.path}`]=item.signedUrl;}if(active)setUrls(next);};void refresh();const timer=setInterval(()=>void refresh(),3000000);return()=>{active=false;clearInterval(timer);};},[paths,supabase]);

 if(!items.length)return null;

 return <div className="my-3 grid gap-3 sm:grid-cols-2">{items.map(item=>{const url=urls[`${item.bucket||"wall-media"}/${item.url}`];return <div key={item.id} className="min-w-0 rounded-xl border bg-slate-50 p-2">{url?(item.type==="document"?<a href={url} target="_blank" rel="noreferrer" className="text-blue-700">Documento PDF · {item.name}</a>:item.type==="image"?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.name} className="max-h-52 w-full object-contain"/></a>:item.type==="video"?<video controls preload="metadata" src={url} className="max-h-60 w-full"/>:<audio controls preload="metadata" src={url} className="w-full"/>):<p className="text-xs">{error||"Carregando anexo…"}</p>}{url?<a href={url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-blue-700">Abrir {item.name}</a>:<p className="break-all text-xs">{item.name}</p>}</div>;})}</div>;

}
