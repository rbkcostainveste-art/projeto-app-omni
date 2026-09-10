import type {SupabaseClient} from '@supabase/supabase-js';
import type {AssistantActor,QueryArgs,QueryResult} from './assistant-queries';
import {normalizeSearch} from './assistant-queries';
import {calendarDay} from './wall-selectors';
type Note={id:string;title:string;body:string;prefix:string;revision:number;updated_at:string;remind_at:string|null;notify:boolean;reminder_status:string|null};
export async function queryNotes(client:SupabaseClient,actor:AssistantActor,q:QueryArgs,signal:AbortSignal,timeZone:string):Promise<QueryResult>{
 if(q.base||q.status!=='all')return {status:'unsupported',items:[],cards:[],complete:false,notice:'Notas são pessoais, não por base ou situação de pane. Use base=null e status=all. Datas filtram o lembrete, ou atualização quando não há lembrete.'};
 const rows:Note[]=[];let complete=false;
 for(let page=0;page<11;page++){
  const last=rows.at(-1),payload=q.id?{employee:actor.employeeNumber,id:q.id}:{employee:actor.employeeNumber,search:q.query||'',...(last?{before:last.updated_at,beforeId:last.id}:{})};
  const {data,error}=await client.rpc('personal_note',{p_action:q.id?'get':'list',p_payload:payload}).abortSignal(signal);
  if(error||!data)return {status:'unavailable',items:[],cards:[],complete:false,notice:'Não foi possível consultar suas notas pessoais. Não concluir ausência.'};
  const batch=(q.id?[data]:data) as Note[];if(!Array.isArray(batch))return {status:'unavailable',items:[],cards:[],complete:false};rows.push(...batch);if(q.id||batch.length<50){complete=true;break;}if(rows.length>500)break;
 }
 const filtered=rows.slice(0,500).filter(r=>{const day=calendarDay(r.remind_at||r.updated_at,timeZone);return (!q.prefix||normalizeSearch(r.prefix).includes(normalizeSearch(q.prefix)))&&(!q.from||day>=q.from)&&(!q.until||day<=q.until);});
 const items=filtered.slice(q.offset,q.offset+30).map(r=>({id:r.id,title:r.title,body:r.body.slice(0,12000),prefix:r.prefix,revision:r.revision,updatedAt:r.updated_at,remindAt:r.remind_at,notify:r.notify,reminderStatus:r.reminder_status}));
 return {status:'available',items,cards:items.map(r=>({kind:'note',id:r.id,title:r.title,detail:r.prefix||'Nota pessoal'})),complete:complete&&rows.length<=500&&filtered.length<=q.offset+30,nextOffset:filtered.length>q.offset+30?q.offset+30:null,queriedAt:new Date().toISOString(),notice:'Somente notas da identidade autenticada; nem administrador lê notas de outra pessoa nesta consulta. Anexos privados não são enviados. Datas referem-se ao lembrete, quando existente, ou à atualização. Notas não são relatos técnicos nem designações.'};
}
