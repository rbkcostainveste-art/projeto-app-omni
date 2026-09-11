"use client";
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {CrewDashboard,type CrewFlight} from '@/components/crew-dashboard';
import {NewActivityDialog} from '@/components/new-activity-dialog';
const noop=()=>{};
const aircraft=[{prefix:'PR-QA',model:'S92',base:'QA'}];
let lastArgs:Record<string,unknown>={};
const client={rpc:async(name:string,args:Record<string,unknown>)=>{if(name==='create_scoped_activity')lastArgs=args;return {data:[],error:null};},from:()=>{const q={select:()=>q,or:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[],error:null}),then:(resolve:(x:unknown)=>void)=>resolve({data:[],error:null})};return q;},channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:noop} as unknown as SupabaseClient;
export default function Fixture(){
 const[ready,setReady]=useState(false);const[open,setOpen]=useState(false);const[result,setResult]=useState('');useEffect(()=>setReady(true),[]);if(!ready)return null;
 const day=new Date().toLocaleDateString('sv-SE');
 const flights=[{id:'done',prefix:'PR-QA',model:'S92',base:'QA',date:day,departure:'08:00',duration:1,fuelAmount:0,fuelUnit:'L',commander:'P1',shutdown:'ok'}] as CrewFlight[];
 return <main><button onClick={()=>setOpen(true)}>Nova atividade de teste</button><output>{result}</output><CrewDashboard supabase={null} user="P1" base="" aircraft={aircraft} fleets={['AW139','S92']} flights={flights} requireSignature={async()=>true} onOpenTrail={noop} onError={noop}/>{open?<NewActivityDialog supabase={client} user="I1" defaultBase="QA" assignedBase="QA" bases={['QA']} aircraft={aircraft} onClose={()=>setOpen(false)} onCreated={async()=>setResult(String(lastArgs.p_title))} requireSignature={async fn=>{await fn();return true;}}/>:null}</main>;
}
