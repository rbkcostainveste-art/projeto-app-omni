"use client";
import {useEffect,useState,useMemo} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {CrewDashboard,type CrewFlight} from '@/components/crew-dashboard';
const noop=()=>{};
export default function Fixture(){const[ready,setReady]=useState(false);const[returned,setReturned]=useState(false);const[saved,setSaved]=useState('');const[error,setError]=useState('');useEffect(()=>setReady(true),[]);
 const client=useMemo(()=>{let status='pending';const q:unknown=new Proxy({}, {get:(_,key)=>key==='then'?Promise.resolve({data:[],error:null}).then.bind(Promise.resolve({data:[],error:null})):()=>q});return {rpc:async(name:string,args:Record<string,unknown>)=>{if(name==='record_maintenance_task_result'){status=String(args.p_result);setSaved(String(args.p_description));return {error:null};}return {data:name==='list_crew_maintenance_actions'&&status==='pending'?[{id:'pc',postId:'post',flightId:'flight',prefix:'PR-QPC',category:'Power Check',title:'Power Check',status,commander:'P1'}]:[],error:null};},from:()=>q,channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:noop} as unknown as SupabaseClient;},[]);
 if(!ready)return null;
 const flight={id:'flight',prefix:'PR-QPC',model:'S92',base:'QA',date:new Date().toLocaleDateString('sv-SE'),departure:'08:00',duration:1,fuelAmount:0,fuelUnit:'L',commander:'P1',planningStatus:'planned',shutdown:returned?'ok':'pending'} as CrewFlight;
 return <main><button onClick={()=>setReturned(true)}>Simular retorno</button><output>{saved}</output><p role="alert">{error}</p><CrewDashboard supabase={client} user="P1" base="QA" aircraft={[{prefix:'PR-QPC',model:'S92',base:'QA'}]} fleets={['S92']} flights={[flight]} requireSignature={async fn=>{await fn();return true;}} onOpenTrail={noop} onError={setError}/></main>;
}
