"use client";
import {useScreenNotifications} from "./screen-notifications";
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export function ToolboxReceipts({supabase,user,onOpen}:{supabase:SupabaseClient|null;user:string;onOpen:(id:string)=>void}){
 const [items,setItems]=useState<{id:string;name:string;status:string;at:string}[]>([]);
 useEffect(()=>{let active=true;async function load(){if(!supabase)return;const {data,error}=await supabase.rpc('get_toolbox_dashboard');if(!active||error||!data)return;setItems((data.operations??[]).filter((op:{assigned_to:string;status:string})=>op.assigned_to===user&&['awaiting_receipt','awaiting_return_signature'].includes(op.status)).map((op:{id:string;box_id:string;status:string;created_at:string;return_requested_at?:string})=>({id:op.id,status:op.status,at:op.return_requested_at??op.created_at,name:data.boxes.find((b:{id:string})=>b.id===op.box_id)?.name??'Caixa'})));}void load();const timer=setInterval(()=>void load(),15000);return()=>{active=false;clearInterval(timer);};},[supabase,user]);
 useScreenNotifications("receipts",items.map(item=>({id:`${item.id}:${item.status}`,title:`Caixa ${item.name}`,description:item.status==="awaiting_receipt"?"Confira e assine o recebimento":"Confira e assine a devolução",at:item.at})),id=>{const item=items.find(item=>`${item.id}:${item.status}`===id);if(item)onOpen(item.id);});
 if(!items.length)return null;
 return <section aria-label="Caixas destinadas a você" className="mb-4 space-y-2">{items.map(item=><button key={item.id} onClick={()=>onOpen(item.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-white p-4 text-left shadow-sm"><span><strong>Caixa {item.name}</strong><small className="block text-slate-600">{item.status==='awaiting_receipt'?'A ferramentaria enviou a caixa conferida. Confira e assine o recebimento.':'A ferramentaria conferiu a devolução. Confira e assine para concluir.'}</small></span><span className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">Conferir caixa</span></button>)}</section>;
}
