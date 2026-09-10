"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AssistantDrying} from '@/components/assistant-drying';
const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}} as unknown as SupabaseClient;
export default function Page(){const [id,setId]=useState('');return <main className="mx-auto max-w-xl p-3"><AssistantDrying client={client} user="42" onOpen={setId}/><p role="status">{id?`Destino recebido: ${id}`:''}</p></main>;}
