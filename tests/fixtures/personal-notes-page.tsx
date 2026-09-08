"use client";
import {PersonalNotes} from '@/components/personal-notes';
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export default function Page(){const[client]=useState(()=>({auth:{getUser:async()=>({data:{user:{id:'fake-auth'}}})},storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null}),download:async()=>({data:new Blob(["image bytes"],{type:"image/png"}),error:null}),createSignedUrls:async()=>({data:[]})})},rpc:async(name:string,args:unknown)=>{const r=await fetch('/__notes',{method:'POST',body:JSON.stringify({name,args})});return r.json();}} as unknown as SupabaseClient));return <main className="flex h-dvh flex-col"><PersonalNotes client={client} user="A" aircraft={[{prefix:'PR-CHT'}]} onBack={()=>{}} onEnablePush={async()=>{}} requireSignature={async action=>{await action();return true;}}/></main>;}
