'use client';
import {CrewPresentation,CrewPresentationSettings} from '@/components/crew-presentation';
import type {SupabaseClient} from '@supabase/supabase-js';
const flight={id:'demo',date:'2026-09-08',departure:'08:00',prefix:'PR-CHT',base:'Jacarepaguá',model:'S92',commander:'pilot',maintenancePostId:'demo',duration:1,fuelAmount:0,fuelUnit:'kg'};
const state={date:'2026-09-08',flight,timezone:'America/Sao_Paulo',scheduledAt:'2026-09-08T11:00:00Z',expectedAt:'2026-09-08T10:15:00Z',leadMinutes:45,canCheckin:true,changed:false,checkin:null as unknown};
const client={rpc:async(_:string,args:{p_action:string})=>{if(args.p_action==='settings')return{data:{flight_minutes:45,maintenance_minutes:45},error:null};if(args.p_action==='checkin'){state.checkin={checked_at:'2026-09-08T10:10:00Z',expected_at:state.expectedAt,flight_snapshot:flight};state.canCheckin=false;}return {data:{...state},error:null};}} as unknown as SupabaseClient;
export default function Page(){return <main className="p-3"><CrewPresentation client={client} user="pilot" flights={[flight]} requireSignature={async action=>{await action();return true;}} onOpenTrail={()=>{}}/><CrewPresentationSettings client={client} requireSignature={async action=>{await action();return true;}}/></main>}
