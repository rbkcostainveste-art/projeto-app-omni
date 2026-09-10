"use client";
import {AiAssistant} from '@/components/flight-board';
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export default function Page(){const[open,setOpen]=useState(true);const[client]=useState(()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})},rpc:async(name:string,args:unknown)=>{const r=await fetch('/__history',{method:'POST',body:JSON.stringify({name,args})});return r.json();}} as unknown as SupabaseClient));return <main className="flex h-dvh flex-col">{open?<AiAssistant conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" conversationTitle="Teste" client={client} user="A" flights={[]} catalogs={{bases:[],models:[],aircraft:[],users:[]}} onClose={()=>setOpen(false)} onCreate={()=>{}}/>:<button onClick={()=>setOpen(true)}>Reabrir</button>}</main>;}
