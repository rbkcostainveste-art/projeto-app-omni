"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AssistantConversations} from '@/components/assistant-conversations';
import {AiAssistant} from '@/components/flight-board';
export default function Page(){const [client]=useState(()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})},rpc:async(name:string,args:unknown)=>{const response=await fetch('/__conversations',{method:'POST',body:JSON.stringify({name,args})});return response.json();}} as unknown as SupabaseClient));return <main className="mx-auto flex h-dvh max-w-3xl flex-col"><AssistantConversations client={client} user="TEST" onClose={()=>{}} renderConversation={(id,onBack,title)=><AiAssistant key={id} client={client} user="TEST" conversationId={id} conversationTitle={title} flights={[]} catalogs={{bases:[],models:[],aircraft:[],users:[]}} onClose={onBack} onCreate={()=>{}}/>}/></main>;}
