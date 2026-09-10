import type {SupabaseClient} from '@supabase/supabase-js';
import {cockpitFields,type CockpitEntry} from './cockpit';
import type {AssistantActor,QueryArgs,QueryResult} from './assistant-queries';
import {normalizeSearch} from './assistant-queries';
import {calendarDay} from './wall-selectors';
const labels={person:'Regras pessoais',qualification:'Habilitação certificado CMA treinamento validade',location:'Aeródromo base local',contract:'Contrato',settings:'Configuração eDB',preparation:'Preparação de voo',document:'Documento',diary:'Diário de bordo',counter:'Contador',occurrence:'Ocorrência',duty:'Jornada'};
export async function queryCockpit(client:SupabaseClient,actor:AssistantActor,q:QueryArgs,signal:AbortSignal,timeZone:string):Promise<QueryResult>{
 if(q.status!=='all')return {status:'unsupported',items:[],cards:[],complete:false,notice:'Use status=all. Registros do Cockpit possuem estados próprios, validades e ciência local; não equivalem a panes abertas/fechadas.'};
 const {data,error}=await client.rpc('cockpit',{p_action:'list',p_payload:{}}).abortSignal(signal);
 if(error||!Array.isArray(data))return {status:'unavailable',items:[],cards:[],complete:false,notice:'Não foi possível consultar o Cockpit autorizado.'};
 // The existing RPC enforces private.cockpit_access for every entry under the caller JWT.
 const entries=(data as CockpitEntry[]).filter(r=>!q.id||r.id===q.id).slice(0,501);
 const linkedIds=new Set(entries.map(r=>r.flight_id).filter(Boolean));
 let flights:{id:string;prefix:string;base:string;date:string}[]=[],flightError=false;
 if(linkedIds.size){const result=await client.from('shared_app_state').select('flights').eq('id','main').abortSignal(signal).maybeSingle();flightError=Boolean(result.error||!Array.isArray(result.data?.flights));if(!flightError)flights=result.data!.flights.filter((f:{id:string})=>linkedIds.has(f.id)).map((f:{id:string;prefix:string;base:string;date:string})=>({id:f.id,prefix:f.prefix,base:f.base,date:f.date}));}
 const matches=(text:string,filter:string|null)=>!filter||normalizeSearch(text).includes(normalizeSearch(filter));
 const rows=entries.slice(0,500).filter(r=>Object.hasOwn(cockpitFields,r.kind)&&(!q.mine||r.subject===actor.employeeNumber||r.created_by===actor.employeeNumber)).map(r=>{
  const flight=flights.find(f=>f.id===r.flight_id);
  const fields=Object.fromEntries(cockpitFields[r.kind].filter(f=>f.type!=='url').map(f=>[f.key,typeof r.data[f.key]==='string'?(r.data[f.key] as string).slice(0,4000):typeof r.data[f.key]==='number'?r.data[f.key]:null]));
  const value=(key:string)=>typeof r.data[key]==='string'?r.data[key] as string:'';
  const date=value('date')||(value('at')?calendarDay(value('at'),timeZone):flight?.date||calendarDay(r.updated_at,timeZone));
  return {id:r.id,kind:r.kind,label:labels[r.kind],subject:r.subject,flightId:r.flight_id,prefix:value('prefix')||flight?.prefix||'',base:value('base')||flight?.base||'',date,fields,revision:r.revision,updatedAt:r.updated_at,acknowledgment:r.data.acknowledgment||null,preparedAt:r.data.preparedAt||null};
 }).filter(r=>(!q.base||r.base===q.base)&&matches(r.prefix,q.prefix)&&matches(`${r.label} ${r.kind} ${Object.values(r.fields).filter(v=>v!==null).join(' ')}`,q.query)&&(!q.from||r.date>=q.from)&&(!q.until||r.date<=q.until));
 const items=rows.slice(q.offset,q.offset+30);
 return {status:'available',items,cards:items.map(r=>({kind:'cockpit',id:r.id,title:`${r.label} · ${r.prefix||r.subject||r.fields.title||'Cockpit'}`,detail:r.date})),complete:entries.length<=500&&!flightError&&rows.length<=q.offset+30,nextOffset:rows.length>q.offset+30?q.offset+30:null,queriedAt:new Date().toISOString(),notice:'Registros autorizados do Cockpit. Datas filtram a data do registro/voo (ou atualização, se não houver). Validade consta em expires. Ciência e preparação são locais, não aprovação oficial do eDB. URLs, mídias e campos não declarados não são enviados. mine restringe ao titular ou criador. Não calcular limites regulamentares ausentes.'};
}
