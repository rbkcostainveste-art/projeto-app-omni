import type {SupabaseClient} from '@supabase/supabase-js';
import {crewOperationalBase} from './crew-operational-base';
import type {AssistantActor,QueryArgs,QueryResult} from './assistant-queries';
import {normalizeSearch} from './assistant-queries';
import type {AssistantRecordCard} from './assistant-targets';

type Plane={prefix:string;model:string;base:string;available?:boolean;unavailableReason?:string};
type Flight={id:string;prefix:string;model:string;base:string;date:string;departure:string;commander?:string;copilot?:string;flightAttendant?:string;cancelled?:boolean;deletedAt?:string;compressorDryingTaskId?:string;maintenancePostId?:string;shutdown?:string;planningStatus?:string;[key:string]:unknown};
const globalRoles=['admin','app_manager','coordination','maintenance_director','maintenance_manager'];
const crewRoles=['commander','copilot','flight_attendant'];
const localRoles=['mechanic','maintenance_assistant','maintenance_coordinator','maintenance_leader','maintenance_inspector','leader_inspector','toolroom','dispatch'];
const fail=(status='unavailable'):QueryResult=>({status,items:[],cards:[],complete:false,notice:'Não foi possível consultar este conjunto; não concluir ausência.'});
const match=(text:string,filter:string|null)=>!filter||normalizeSearch(text).includes(normalizeSearch(filter));
export async function queryOperations(client:SupabaseClient,actor:AssistantActor,q:QueryArgs,signal:AbortSignal,today:string):Promise<QueryResult>{
 const global=globalRoles.includes(actor.accessProfile),crew=crewRoles.includes(actor.accessProfile),local=localRoles.includes(actor.accessProfile);
 if(!global&&!crew&&!local||local&&!actor.assignedBase||local&&q.base&&q.base!==actor.assignedBase)return fail('not_authorized');
 if(q.dataset==='passage'){
  if(crew||actor.accessProfile==='coordination')return fail('not_authorized');
  let query=client.from('runway_handovers').select('id,prefix,model,base,date,checks,actions,discrepancy_details,oil_additions,notes,revision,updated_at').order('date',{ascending:false}).order('id',{ascending:true}).limit(101);
  if(local)query=query.eq('base',actor.assignedBase);else if(q.base)query=query.eq('base',q.base);
  if(q.id)query=query.eq('id',q.id);
  if(q.from)query=query.gte('date',q.from);if(q.until)query=query.lte('date',q.until);
  const {data,error}=await query.abortSignal(signal);if(error||!Array.isArray(data))return fail();
  const found=data.slice(0,100).filter(r=>match(r.prefix,q.prefix)&&match(`${r.prefix} ${r.model} ${r.notes}`,q.query)),items=found.slice(q.offset,q.offset+30);
  return {status:'available',items,cards:items.map(r=>({kind:'passage',id:r.id,title:`${r.prefix} · ${r.date}`,detail:'Passagem de Pista'})),complete:data.length<=100&&found.length<=q.offset+30,nextOffset:found.length>q.offset+30?q.offset+30:null,notice:'checks registra estados atuais. actions registra o último autor/horário de alteração de cada campo. Não representa histórico completo de execuções. Diferencie lavagem CT disk, lavagem com produto e lavagem de compressores. Para secagem pendente consulte drying.',scope:local?actor.assignedBase:q.base||'Bases autorizadas',queriedAt:new Date().toISOString()};
 }
 const {data,error}=await client.from('shared_app_state').select('flights,catalogs').eq('id','main').abortSignal(signal).maybeSingle();
 if(error||!data||!Array.isArray(data.flights)||!Array.isArray(data.catalogs?.aircraft))return fail();
 const planes=data.catalogs.aircraft as Plane[],flights=data.flights as Flight[];
 const base=crew?crewOperationalBase(actor.employeeNumber,flights,planes,today).base:actor.assignedBase;
 if(crew&&!base&&q.dataset==='fleet')return fail('not_authorized');
 const scope=global?q.base||(actor.accessProfile==='coordination'?base:''):base;
 const authorizedPlanes=planes.filter(p=>!scope||p.base===scope);
 let rows:Record<string,unknown>[],cards:AssistantRecordCard[]=[];
 if(q.dataset==='fleet')rows=authorizedPlanes.filter(p=>match(p.prefix,q.prefix)&&match(`${p.prefix} ${p.model}`,q.query)).map(p=>({prefix:p.prefix,model:p.model,base:p.base,available:p.available??null,unavailableReason:p.unavailableReason||null}));
 else {
  const found=flights.filter(f=>!f.deletedAt&&!f.compressorDryingTaskId&&!f.maintenancePostId&&(!q.id||f.id===q.id)&&(!crew||[f.commander,f.copilot,f.flightAttendant].includes(actor.employeeNumber))&&(!scope||f.base===scope)&&(!q.from||f.date>=q.from)&&(!q.until||f.date<=q.until)&&match(f.prefix,q.prefix)&&match(`${f.prefix} ${f.model}`,q.query)&&(!q.mine||[f.commander,f.copilot,f.flightAttendant].includes(actor.employeeNumber))&&(q.status==='all'||(q.status==='closed'?f.cancelled||f.shutdown==='ok':!f.cancelled&&f.shutdown!=='ok')));
  rows=found.sort((a,b)=>`${a.date} ${a.departure}`.localeCompare(`${b.date} ${b.departure}`)).map(f=>Object.fromEntries(['id','prefix','model','base','date','departure','duration','destination','commander','copilot','flightAttendant','cancelled','planningStatus','actualEngineStart','actualShutdown','fuelAmount','fuelUnit','fuel','preflight','hums','engineStart','shutdown'].map(k=>[k,f[k]??null])));
  cards=rows.slice(q.offset,q.offset+30).map(r=>({kind:'flight',id:String(r.id),title:`${r.prefix} · ${r.date} ${r.departure}`,detail:String(r.base)}));
 }
 return {status:'available',items:rows.slice(q.offset,q.offset+30),cards,complete:rows.length<=q.offset+30,nextOffset:rows.length>q.offset+30?q.offset+30:null,scope:scope||'Bases autorizadas',queriedAt:new Date().toISOString(),notice:q.dataset==='fleet'?'Cadastro operacional de aeronaves; disponibilidade de cadastro não comprova ausência de relato ou pane.':'Voos reais do estado compartilhado atual. Exclui registros apagados e cards virtuais de manutenção/secagem. Voos de tripulantes são limitados à sua própria escala.'};
}
