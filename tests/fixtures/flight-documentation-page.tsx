'use client';
import {useState} from 'react';
import {FlightCoordination,type CoordinatedFlight} from '@/components/flight-coordination';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {CockpitEntry} from '@/lib/cockpit';
const entries:CockpitEntry[]=[];let fail=false;
const chain={select:()=>chain,eq:()=>chain,order:async()=>({data:[],error:null})};
const client={from:()=>chain,storage:{from:()=>({upload:async()=>({error:null})})},rpc:async(_:string,args:{p_action:string;p_payload:Record<string,unknown>})=>{if(args.p_action==='list')return {data:entries,error:null};if(fail){fail=false;return {data:null,error:{message:'Falha simulada de documentação'}};}const row={...args.p_payload,flight_id:args.p_payload.flightId,revision:1} as CockpitEntry;entries.push(row);return {data:row,error:null};}} as unknown as SupabaseClient;
export default function Page(){const [flights,setFlights]=useState<CoordinatedFlight[]>([]);return <main className="mx-auto max-w-6xl p-3"><button onClick={()=>{fail=true;}}>Simular falha no próximo documento</button><p role="status">Voos gravados: {flights.length}</p><FlightCoordination supabase={client} flights={flights} aircraft={[{prefix:'PR-CHT',model:'S92',base:'Jacarepaguá'}]} people={[{employeeNumber:'pilot',name:'Piloto teste',profile:'commander'}]} user="coordination" onCreate={async flight=>{setFlights(old=>[...old,flight]);return true;}} onConfirm={()=>{}} onOpenTrail={()=>{}} onOpenWaves={()=>{}} onBack={()=>{}}/></main>;}
