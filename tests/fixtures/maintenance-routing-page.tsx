"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {CoordinationDashboard,type CoordinatedFlight} from '@/components/flight-coordination';
import {CrewDashboard} from '@/components/crew-dashboard';
import {MaintenanceTrailCard} from '@/components/maintenance-trail-card';
import {operationalDay} from '@/lib/coordination-day';

const people=[{employeeNumber:'P1',name:'Piloto QA',profile:'commander'},{employeeNumber:'P2',name:'Copiloto QA',profile:'copilot'}];
const aircraft=[{prefix:'PR-QAT',model:'AW139',base:'QA'}];
const noop=()=>{};
const sign=async(fn:()=>void|Promise<void>)=>{await fn();return true;};
export default function RoutingFixture(){
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const [mode,setMode]=useState('coordination');
 const [flight,setFlight]=useState(()=>({id:'maintenance-qa',prefix:'PR-QAT',model:'AW139',base:'QA',date:operationalDay(),departure:'10:00',planningStatus:'planned' as 'planned'|'confirmed',commander:'',copilot:'',spot:'',revision:1,maintenancePostId:'qa-post',maintenanceCategory:'Voo de manutenção',maintenancePurpose:'Verificar se normalizou',maintenanceOriginTitle:'Relato de teste',shutdown:'pending',engineStart:'pending',fuel:'pending',preflight:'pending',hums:'pending',duration:0,fuelAmount:0,fuelUnit:'L',acknowledged:{},createdBy:'QA',updatedBy:'QA'}));
 const current=useRef(flight);current.current=flight;
 const [calls,setCalls]=useState<unknown[]>([]),[error,setError]=useState('');
 const client=useMemo(()=>{
  const result=()=>Promise.resolve({data:[],error:null});
  const query:unknown=new Proxy({}, {get:(_target,key)=>key==='then'?result().then.bind(result()):()=>query});
  const listeners=new Set<()=>void>();
  return {from:()=>query,channel:()=>{const channel={on:(_event:string,_filter:unknown,cb:()=>void)=>{listeners.add(cb);return channel;},subscribe:()=>channel};return channel;},removeChannel:noop,rpc:async(name:string,args:Record<string,unknown>={})=>{
   const f=current.current;
   const card={id:'qa-action',postId:f.maintenancePostId,flightId:f.id,prefix:f.prefix,category:f.maintenanceCategory,title:f.maintenancePurpose,description:f.maintenanceOriginTitle,date:f.date,createdAt:new Date().toISOString(),planningStatus:f.planningStatus,status:'pending',commander:f.commander,copilot:f.copilot};
   if(name==='list_maintenance_operation_cards')return {data:[card],error:null};
   if(name==='list_crew_maintenance_actions')return {data:f.commander==='P1'?[card]:[],error:null};
   if(name==='configure_maintenance_operation'){
    const plan=args.p_plan as Record<string,string>;setCalls(prev=>[...prev,args]);
    const next={...f,...plan,revision:f.revision+1,planningStatus:plan.commander||plan.copilot?'confirmed' as const:'planned' as const};
    current.current=next;setFlight(next);listeners.forEach(fn=>fn());return {data:null,error:null};
   }
   if(name==='get_flight_position')return {data:{spot:f.spot,confirmed:false,history:[]},error:null};
   if(name==='get_flight_operation')return {data:{events:[],checks:{},counters:[],revision:1,first:true,previousFlightId:null,nextFlightId:null,day:f.date,canPilot:mode==='pilot',canSign:false,canExecute:false,closed:false},error:null};
   if(name==='technical_case_action')return {data:{cases:[],alerts:[]},error:null};
   return {data:[],error:null};
  }} as unknown as SupabaseClient;
 },[mode]);
 const flights=[flight] as CoordinatedFlight[];
 return <main data-hydrated={ready} className="min-h-screen bg-slate-100 p-4 text-[#17324d]">
  <nav className="mb-4 flex flex-wrap gap-3">{['coordination','pilot','trail'].map(value=><button className="rounded-lg border bg-white p-3" key={value} onClick={()=>setMode(value)}>{value}</button>)}</nav>
  {error?<p role="alert">{error}</p>:null}
  {mode==='coordination'?<CoordinationDashboard base="QA" user="COORD" people={people} supabase={client} flights={flights} aircraft={aircraft} onOpenTrail={()=>setMode('trail')} onOpenPlanning={noop} onOpenAircraftManagement={noop} onOpenWaves={noop} onError={setError}/>:null}
  {mode==='pilot'?<CrewDashboard people={people} supabase={client} user="P1" base="QA" aircraft={aircraft} fleets={['AW139']} flights={flights} requireSignature={sign} onOpenTrail={()=>setMode('trail')} onError={setError}/>:null}
  {mode==='trail'?<div className="mx-auto max-w-3xl"><MaintenanceTrailCard supabase={client} flight={flight} people={people} canPlan readOnly={false} requireSignature={sign} editUnread={false} onReadEdit={noop}/></div>:null}
  <pre className="hidden" data-testid="calls">{JSON.stringify(calls)}</pre>
 </main>;
}
