"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AssistantConversations} from '@/components/assistant-conversations';
import type {AssistantTargetRef} from '@/lib/assistant-targets';
import {AiAssistant} from '@/components/flight-board';
export default function Page(){const [opened,setOpened]=useState('');const open=async(ref:AssistantTargetRef)=>{const response=await fetch(`/api/ai/targets?kind=${ref.kind}&id=${ref.id}`);const body=await response.json();if(!response.ok)throw Error(body.error);setOpened(`${body.target.kind}:${body.target.id}`);};const [client]=useState(()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})},rpc:async(name:string,args:unknown)=>{const response=await fetch('/__conversations',{method:'POST',body:JSON.stringify({name,args})});return response.json();}} as unknown as SupabaseClient));return <main className="mx-auto flex h-dvh max-w-3xl flex-col"><output aria-label="Destino aberto">{opened}</output><AssistantConversations client={client} user="TEST" onClose={()=>{}} renderConversation={(id,onBack,title)=><AiAssistant onOpenTarget={open} key={id} client={client} user="TEST" conversationId={id} conversationTitle={title} flights={[]} catalogs={{bases:[],models:[],aircraft:[],users:[]}} onClose={onBack} onCreate={()=>{}}/>}/></main>;}
