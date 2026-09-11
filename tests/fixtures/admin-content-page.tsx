"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AdminContent} from '@/components/admin-content';
export default function Page(){
 const [client]=useState(()=>{
  let rows=[{key:{id:'demo-1'},label:'PR-CGO · Power Check',date:'2026-09-11'},{key:{id:'demo-2'},label:'PR-OHG · Voo de manutenção',date:'2026-09-11'}];
  return {rpc:async(_name:string,args:{p_action:string;p_keys?:{id:string}[]})=>{
   if(args.p_action==='catalog')return {data:[{kind:'shared_flights',label:'Voos e giros',count:rows.length}]};
   if(args.p_action==='list')return {data:{rows}};
   if(args.p_action==='pending_files')return {data:[]};
   if(args.p_action==='delete'){rows=rows.filter(row=>!args.p_keys?.some(key=>key.id===row.key.id));return {data:{removed:1}};}
   return {data:true};
  }} as unknown as SupabaseClient;
 });
 return <main><AdminContent client={client}/></main>;
}
