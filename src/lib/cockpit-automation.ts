import type {SupabaseClient} from '@supabase/supabase-js';
import type {CrewFlight} from '@/components/crew-dashboard';
import {type CockpitData,valueOf} from './cockpit';
import type {OperationData,OperationEvent} from './flight-operations';
import {mediaFormat,type RecordMedia} from './record-media';

export function airborneMinutes(events:OperationEvent[]){
 let start:number|null=null, milliseconds=0;
 for(const event of events){
  if(event.type==='takeoff')start=Date.parse(event.at);
  if(event.type==='landing'&&start!==null){milliseconds+=Math.max(0,Date.parse(event.at)-start);start=null;}
 }
 return Math.floor(milliseconds/60000);
}
export async function proposeDuty(client:SupabaseClient,user:string,date:string,flights:CrewFlight[],existing:CockpitData):Promise<CockpitData>{
 const {data:summary,error}=await client.rpc('crew_presentation',{p_action:'summary',p_payload:{user,date}});
 if(error)throw Error(error.message);
 const selected=flights.filter(f=>f.date===date&&!f.deletedAt&&[f.commander,f.copilot,f.flightAttendant].includes(user));
 const operations=await Promise.all(selected.map(async flight=>{
  const {data,error}=await client.rpc('get_flight_operation',{p_flight_id:flight.id});
  if(error)throw Error('Não foi possível consultar os eventos de todos os voos. Tente novamente.');
  return {flight,operation:data as OperationData};
 }));
 const actual=operations.filter(x=>x.operation?.events.length).sort((a,b)=>Date.parse(a.operation.events[0].at)-Date.parse(b.operation.events[0].at));
 return {...existing,_proposalPending:'yes',
  presentation:valueOf(existing,'presentation')||summary?.checkin?.checked_at||'',
  origin:valueOf(existing,'origin')||actual[0]?.flight.base||'',
  destination:valueOf(existing,'destination')||actual.at(-1)?.flight.destination||'',
  airborneReference:actual.reduce((sum,x)=>sum+airborneMinutes(x.operation.events),0),
  eventReferences:JSON.stringify(actual.map(x=>({flightId:x.flight.id,prefix:x.flight.prefix,revision:x.operation.revision,events:x.operation.events}))),
  referenceUpdatedAt:new Date().toISOString(),
  source:valueOf(existing,'source')||'Apresentação registrada e eventos efetivos dos voos programados nesta data; conferir os totais.'};
}
export function occurrenceMedia(data:CockpitData):RecordMedia[]{try{const items=JSON.parse(valueOf(data,'mediaJson')||'[]');return Array.isArray(items)?items:[];}catch{return [];}}
export async function uploadOccurrenceMedia(client:SupabaseClient,entryId:string,files:File[]):Promise<RecordMedia[]>{
 const {data:{user},error}=await client.auth.getUser();if(error||!user)throw Error('Entre novamente para anexar arquivos.');
 const result:RecordMedia[]=[];
 for(const file of files){
  const format=mediaFormat(file);
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const path=`${user.id}/${entryId}/${hash}`;
  const {error}=await client.storage.from('cockpit-occurrence-media').upload(path,file,{contentType:format.contentType.split(';')[0],upsert:false});
  if(error&&!/already exists|duplicate/i.test(error.message))throw Error(`Não foi possível anexar ${file.name}: ${error.message}`);
  result.push({id:hash,name:file.name,type:format.type,url:path,bucket:'cockpit-occurrence-media'});
 }
 return result;
}
