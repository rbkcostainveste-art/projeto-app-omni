"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PersonalNotes} from '@/components/personal-notes';
import {FlightCoordination} from '@/components/flight-coordination';
import {AssistantWorkspaceProvider,AssistantTarget} from '@/components/assistant-workspace';
const history:unknown[]=[];const query={select:()=>query,eq:()=>query,order:async()=>({data:[],error:null})};
const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})},from:()=>query,rpc:async(name:string,args:{p_action:string;p_payload:Record<string,string>})=>{if(name!=='personal_assistant')return {data:[],error:null};let data:unknown=[];if(args.p_action==='create_conversation')data={id:args.p_payload.id,title:'Teste',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(args.p_action==='list')data=history;if(args.p_action==='append'){data={id:history.length+1,message:args.p_payload.message,reply:args.p_payload.reply,created_at:new Date().toISOString()};history.push(data);}return {data,error:null};}} as unknown as SupabaseClient;
const aircraft=[{prefix:'PR-CHT',model:'S92',base:'Macaé',available:true}],people=[{employeeNumber:'42',name:'Carlos',profile:'commander'},{employeeNumber:'43',name:'Ana',profile:'copilot'}];
function App(){const [notes,setNotes]=useState(true);return <main><AssistantTarget id="root" label="Teste" priority={0} revision="1" content={null}/><button onClick={()=>setNotes(false)}>Programação de teste</button>{notes?<PersonalNotes client={client} user="42" aircraft={aircraft} onBack={()=>{}} onEnablePush={async()=>{}} requireSignature={async()=>{throw Error('No save');}}/>:<FlightCoordination supabase={client} flights={[]} aircraft={aircraft} people={people} user="42" onCreate={async()=>{throw Error('No save');}} onConfirm={()=>{}} onOpenTrail={()=>{}} onOpenWaves={()=>{}} onBack={()=>{}}/>}</main>;}
export default function Page(){return <AssistantWorkspaceProvider><App/></AssistantWorkspaceProvider>;}
