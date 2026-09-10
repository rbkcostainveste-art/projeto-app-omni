"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Synthetic browser fixture. Only mounted by a temporary local route, never deployed.
import {useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AiAssistant} from '../../src/components/flight-board';
import {CreateRecord} from '../../src/components/maintenance-records';
import {FlightCoordination,type CoordinatedFlight} from '../../src/components/flight-coordination';
import {OperationalWall} from '../../src/components/operational-wall';
import {operationalDay} from '../../src/lib/coordination-day';
const aircraft=[{prefix:'PR-QAT',model:'S92',base:'QA',available:true},{prefix:'PR-CGO',model:'S92',base:'QA',available:true}];
export default function PracticalFixture(){
 const [screen,setScreen]=useState('plan'),[saved,setSaved]=useState<any[]>([]),[flights,setFlights]=useState<CoordinatedFlight[]>([]);
 const client=useMemo(()=>{
  let entries:any[]=[];const conversations:any[]=[];const day=operationalDay();
  const notice=(id:string,title:string,at:string)=>({id,base:'QA',audience_area:'maintenance',revision:1,created_at:at,updated_at:at,data:{id,title,body:'Texto completo da publicação '+title,base:'QA',audienceArea:'maintenance',category:'Avisos',priority:'routine',pinned:false,essential:false,resolved:false,createdBy:'QA',createdAt:at,updatedAt:at,revision:1,attachments:[],actions:[],comments:[],views:[],acknowledgements:[],history:[]}});
  const posts=[notice('new','Aviso mais recente',day+'T14:00:00Z'),notice('old','Aviso anterior',day+'T13:00:00Z'),notice('past','Aviso histórico','2026-09-01T14:00:00Z')];
  const storage={upload:async()=>({error:null}),remove:async()=>({error:null}),download:async()=>({data:new Blob(['synthetic']),error:null}),createSignedUrls:async()=>({data:[],error:null})};
  const query=(table:string)=>{let pending:any=null;const proxy:any=new Proxy({}, {get(_t,key){if(key==='then')return (resolve:any)=>Promise.resolve({data:pending|| (table==='operational_wall_posts'?posts:[]),error:null}).then(resolve);return (...args:any[])=>{if(key==='insert'){pending=args[0];posts.unshift(pending);setSaved(previous=>[...previous,pending]);}return proxy;};}});return proxy;};
  const channel:any={on:()=>channel,subscribe:()=>channel};
  return {auth:{getSession:async()=>({data:{session:{access_token:'synthetic-only',user:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}}}}),getUser:async()=>({data:{user:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}}})},storage:{from:()=>storage},from:query,channel:()=>channel,removeChannel:()=>{},rpc:async(name:string,args:any={})=>{
   if(name==='get_operational_assignments')return {data:[{employee_number:'QA',display_name:'Mecânico QA',access_profile:'mechanic',assigned_base:'QA'},{employee_number:'PILOT',display_name:'Piloto excluído',access_profile:'commander',assigned_base:'QA'}],error:null};
   if(name==='personal_assistant'){const p=args.p_payload,a=args.p_action;if(a==='conversations')return {data:conversations,error:null};if(a==='create_conversation'){const c={id:p.id,title:p.title,context_kind:p.contextKind,context_id:p.contextId,context_label:p.contextLabel,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};conversations.push(c);return {data:c,error:null};}if(a==='list')return {data:entries.filter(e=>e.conversationId===p.conversationId),error:null};if(a==='append'){const entry={...p,id:entries.length+1,created_at:new Date().toISOString()};entries=[...entries,entry];return {data:entry,error:null};}}
   return {data:[],error:null};
  }} as unknown as SupabaseClient;
 },[]);
 return <main className="min-h-screen bg-slate-100 p-3"><nav className="mb-4 flex gap-2">{['plan','review','wall','general'].map(s=><button key={s} className="rounded border bg-white p-3" onClick={()=>{setScreen(s);setSaved([]);}}>{s}</button>)}</nav>
 {screen==='general'?<AiAssistant area="Mural da coordenação" conversationId="synthetic-general" conversationTitle="Programação QA" client={client} user="QA" onClose={()=>setScreen('plan')} allowFlightCreation flights={flights} catalogs={{aircraft,bases:['QA'],models:['S92'],users:[]}} onCreate={async items=>{setSaved(items);setFlights(p=>[...p,...items]);return true;}}/>:screen==='plan'?<FlightCoordination supabase={client} user="QA" aircraft={aircraft} people={[]} flights={flights} onCreate={async f=>{setFlights(p=>[...p,f]);setSaved(p=>[...p,f]);return true;}} onConfirm={()=>{}} onOpenTrail={()=>{}} onOpenWaves={()=>{}} onBack={()=>{}}/>:screen==='review'?<CreateRecord client={client} type="inspection" aircraft={aircraft} people={[]} user="QA" canAssign={false} seed={{type:'fault',prefix:'PR-QAT',sourceFlightId:'qa'}} onClose={()=>setScreen('plan')} onCreate={async item=>{setSaved([item]);setScreen('done');}}/>:screen==='wall'?<OperationalWall supabase={client} user="QA" userDirectory={{}} isAdmin canCreate canFilterBase={false} assignedBase="QA" bases={['QA']} aircraft={aircraft} wallAudience="maintenance" allowedAudiences={['maintenance']} requireSignature={async action=>{await action();return true;}} onError={console.error}/>:null}
 <pre data-testid="saved" className="break-all whitespace-pre-wrap">{JSON.stringify(saved)}</pre></main>;
}
