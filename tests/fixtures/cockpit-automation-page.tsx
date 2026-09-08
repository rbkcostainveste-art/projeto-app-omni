'use client';
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Cockpit} from '@/components/cockpit';
import {FlightOperations} from '@/components/flight-operations';
import {cockpitDay} from '@/lib/cockpit';
const channel={on:()=>channel,subscribe:()=>channel};
const client={channel:()=>channel,removeChannel:async()=>{},rpc:async(name:string,args:unknown)=>(await fetch('/__cockpit_test',{method:'POST',body:JSON.stringify({name,args})})).json(),auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},storage:{from:()=>({upload:async(path:string)=>(await fetch('/__upload_test',{method:'POST',body:JSON.stringify({path})})).json(),createSignedUrls:async()=>({data:[]})})}} as unknown as SupabaseClient;
export default function Test(){
 const [context,setContext]=useState<{flightId?:string;section?:string;nonce:number}|null>(null);
 useEffect(()=>{const listener=(e:Event)=>setContext({...((e as CustomEvent).detail),nonce:Date.now()});window.addEventListener('flight-ia-cockpit',listener);return()=>window.removeEventListener('flight-ia-cockpit',listener);},[]);
 const flight={id:'flight-test',prefix:'PR-CHT',model:'S92',base:'Jacarepaguá',date:cockpitDay(),departure:'10:00',destination:'Plataforma',commander:'P1',copilot:'P2',duration:60,fuelAmount:200,fuelUnit:'kg'};
 const signature=async(action:()=>void|Promise<void>)=>{await action();return true;};
 return <main className="mx-auto max-w-5xl p-2"><button onClick={()=>setContext({nonce:Date.now()})}>Meu dia teste</button>{context?<Cockpit key={context.nonce} client={client} user="P1" profile="commander" flights={[flight]} aircraft={[flight]} people={[{employeeNumber:'P1',name:'Piloto teste'},{employeeNumber:'P2',name:'Copiloto teste'}]} initialFlightId={context.flightId} initialSection={context.section} requireSignature={signature} onOpenTrail={()=>setContext(null)}/>:<FlightOperations supabase={client} flight={flight} showDocumentation requireSignature={signature}/>}</main>;
}
