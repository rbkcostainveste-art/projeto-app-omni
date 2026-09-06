"use client";
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export function ToolboxReceipts({supabase,user,onOpen}:{supabase:SupabaseClient|null;user:string;onOpen:(id:string)=>void}){
 const [items,setItems]=useState<{id:string;name:string;status:string}[]>([]);
 useEffect(()=>{let active=true;async function load(){if(!supabase)return;const {data,error}=await supabase.rpc('get_toolbox_dashboard');if(!active||error||!data)return;setItems((data.operations??[]).filter((op:{assigned_to:string;status:string})=>op.assigned_to===user&&['awaiting_receipt','awaiting_return_signature'].includes(op.status)).map((op:{id:string;box_id:string;status:string})=>({id:op.id,status:op.status,name:data.boxes.find((b:{id:string})=>b.id===op.box_id)?.name??'Caixa'})));}void load();const timer=setInterval(()=>void load(),15000);return()=>{active=false;clearInterval(timer);};},[supabase,user]);
 if(!items.length)return null;
 return <section aria-label="Caixas destinadas a você" className="mb-4 space-y-2">{items.map(item=><button key={item.id} onClick={()=>onOpen(item.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-white p-4 text-left shadow-sm"><span><strong>Caixa {item.name}</strong><small className="block text-slate-600">{item.status==='awaiting_receipt'?'A ferramentaria enviou a caixa conferida. Confira e assine o recebimento.':'A ferramentaria conferiu a devolução. Confira e assine para concluir.'}</small></span><span className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">Conferir caixa</span></button>)}</section>;
}
