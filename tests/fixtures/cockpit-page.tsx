'use client';
import {Cockpit,CockpitAdmin,CockpitPersonFields} from '@/components/cockpit';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {CockpitEntry} from '@/lib/cockpit';
const flight={id:'00000000-0000-4000-8000-000000009999',date:'2026-09-08',departure:'08:00',prefix:'PR-CHT',base:'Jacarepaguá',model:'S92',commander:'pilot',duration:1,fuelAmount:1000,fuelUnit:'kg'};
const rows:CockpitEntry[]=[];
const client={rpc:async(name:string,args:{p_action?:string;p_payload?:Record<string,unknown>}={})=>{
 const p=args.p_payload||{};
 if(name==='get_operational_assignments')return {data:[{employee_number:'pilot',access_profile:'commander'},{employee_number:'monthly',access_profile:'toolroom'}],error:null};
 if(name==='crew_presentation')return {data:{date:'2026-09-08',flight,timezone:'America/Sao_Paulo',scheduledAt:'2026-09-08T11:00:00Z',expectedAt:'2026-09-08T10:15:00Z',leadMinutes:45,canCheckin:true,changed:false,checkin:null},error:null};
 if(args.p_action==='list')return {data:[...rows],error:null};
 if(args.p_action==='technical_history'||args.p_action==='history')return {data:[],error:null};
 if(args.p_action==='save'){const i=rows.findIndex(r=>r.id===p.id);const row={...p,flight_id:p.flightId,revision:i<0?1:rows[i].revision+1,created_by:'pilot',updated_by:'pilot',updated_at:new Date().toISOString()} as CockpitEntry;if(i<0)rows.push(row);else rows[i]=row;return {data:row,error:null};}
 return {data:{},error:null};
}} as unknown as SupabaseClient;
const signature=async(action:()=>void|Promise<void>)=>{await action();return true;};
const people=[{employeeNumber:'pilot',name:'Piloto de teste'},{employeeNumber:'monthly',name:'Ferramenteiro de teste'}];
export default function Page(){return <main className="mx-auto max-w-6xl bg-slate-50 p-3"><Cockpit client={client} user="pilot" profile="commander" flights={[flight]} aircraft={[flight]} people={people} requireSignature={signature} onOpenTrail={()=>{}}/><CockpitAdmin client={client} people={people} requireSignature={signature}/><CockpitPersonFields client={client} employee="monthly" profile="toolroom" requireSignature={signature}/></main>;}
