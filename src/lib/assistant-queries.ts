import {queryToolroom} from './assistant-toolroom';
import {queryOperations} from './assistant-operations';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {WallPost} from '@/components/operational-wall';
import {assignedToEmployee,calendarDay,isWallNotice,wallTimeline} from './wall-selectors';
import {assistantRecords} from './assistant-records';
import {assistantDryingContext} from './assistant-drying-context';
import type {AssistantRecordCard} from './assistant-targets';

export type AssistantActor={employeeNumber:string;accessProfile:string;assignedBase:string;fleets:string[]};
export type QueryArgs={dataset:'timeline'|'notices'|'assignments'|'maintenance'|'drying'|'fleet'|'flights'|'passage'|'tools';query:string|null;prefix:string|null;base:string|null;from:string|null;until:string|null;status:'open'|'closed'|'all';mine:boolean;offset:number;id:string|null};
export type QueryResult={status:string;items:unknown[];cards:AssistantRecordCard[];complete:boolean;notice?:string;[key:string]:unknown};
const globalRoles=['admin','app_manager','maintenance_director','maintenance_manager'];
const localRoles=['mechanic','maintenance_assistant','maintenance_coordinator','maintenance_leader','maintenance_inspector','leader_inspector','toolroom','dispatch'];
export const normalizeSearch=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const matches=(text:string,query:string|null)=>!query||normalizeSearch(text).includes(normalizeSearch(query));
export function validateQuery(value:unknown):QueryArgs {
 if(!value||typeof value!=='object')throw Error('Consulta inválida.');
 const q=value as QueryArgs;
 if(!['timeline','notices','assignments','maintenance','drying','fleet','flights','passage','tools'].includes(q.dataset)||!['open','closed','all'].includes(q.status)||typeof q.mine!=='boolean'||!Number.isInteger(q.offset)||q.offset<0||q.offset>500)throw Error('Consulta inválida.');
 for(const key of ['query','prefix','base','from','until','id'] as const)if(q[key]!==null&&(typeof q[key]!=='string'||q[key]!.length>160))throw Error('Filtro inválido.');
 for(const key of ['from','until'] as const)if(q[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(q[key]!))throw Error('Data inválida.');
 if(q.from&&q.until&&q.from>q.until)throw Error('Período inválido.');
 return q;
}
export async function assistantActor(client:SupabaseClient,employee:string):Promise<AssistantActor>{
 const {data,error}=await client.rpc('refresh_current_device');
 if(error||!data||data.employeeNumber!==employee)throw Error('Identidade indisponível.');
 return {employeeNumber:employee,accessProfile:data.accessProfile,assignedBase:typeof data.assignedBase==='string'?data.assignedBase.trim():'',fleets:Array.isArray(data.fleets)?data.fleets.filter((x:unknown)=>typeof x==='string'):[]};
}
const failed=(status='unavailable',notice='A consulta não foi concluída. Não afirmar ausência de registros.'):QueryResult=>({status,notice,items:[],cards:[],complete:false});
export async function assistantQuery(client:SupabaseClient,actor:AssistantActor,q:QueryArgs,signal:AbortSignal,timeZone='America/Sao_Paulo'):Promise<QueryResult>{
 const {employeeNumber:employee,accessProfile:role,assignedBase:base}=actor;
 try {
  if(q.dataset==='tools')return await queryToolroom(client,actor,q,signal);
  if(['fleet','flights','passage'].includes(q.dataset))return await queryOperations(client,actor,q,signal,calendarDay(new Date(),timeZone));
  if(q.dataset==='maintenance'||q.dataset==='drying'){
   if(q.dataset==='drying'&&(q.from||q.until||q.status==='closed'))return failed('unsupported','Esta consulta cobre pendências atuais, sem filtro de data. Para eventos do dia use timeline/assignments; abertura de secagem não comprova lavagem.');
   const result=q.dataset==='maintenance'?await assistantRecords(client,employee,signal,q.id||undefined,{status:q.status}):await assistantDryingContext(client,employee,signal,q.id||undefined);
   if(result.status!=='available')return failed(result.status);
   const raw=('records' in result?result.records:result.items) as {id:string;prefix:string;base:string;title?:string;reason?:string;model?:string;description?:string;created_at?:string}[];
   const filtered=raw.filter(r=>matches(r.prefix,q.prefix)&&(!q.base||r.base===q.base)&&matches(`${r.prefix} ${r.title||''} ${r.reason||''} ${r.model||''} ${r.description||''}`,q.query)&&(!q.from||calendarDay(r.created_at||'',timeZone)>=q.from)&&(!q.until||calendarDay(r.created_at||'',timeZone)<=q.until));
   const items=filtered.slice(q.offset,q.offset+30);
   return {status:'available',items,cards:items.map(r=>({kind:q.dataset==='maintenance'?'maintenance':'drying',id:r.id,title:`${r.prefix} · ${r.title||r.reason||'Secagem'}`,detail:r.base})),complete:('complete' in result&&result.complete)&&filtered.length<=q.offset+30,nextOffset:filtered.length>q.offset+30?q.offset+30:null,notice:result.notice,queriedAt:new Date().toISOString()};
  }
  const global=globalRoles.includes(role),local=localRoles.includes(role);
  if(!global&&!local&&!['coordination','commander','copilot','flight_attendant'].includes(role))return failed('not_authorized');
  if(local&&!base)return failed('not_authorized','Seu cadastro não tem uma base definida.');
  if(local&&q.base&&q.base!==base)return failed('not_authorized','Esta base não está disponível para seu perfil.');
  let query=client.from('operational_wall_posts').select('id,base,audience_area,resolved,revision,data,updated_at,created_at').order('updated_at',{ascending:false}).order('id',{ascending:true}).limit(q.id?1:501);
  if(q.id)query=query.eq('id',q.id);
  if(local||q.base)query=query.in('base',[local?base:q.base!,'Todas']);
  const audience=global?null:role==='coordination'?'coordination':['commander','copilot','flight_attendant'].includes(role)?'pilots':'maintenance';
  if(audience)query=query.in('audience_area',[audience,'general']);
  const result=await query.abortSignal(signal);
  if(result.error||!Array.isArray(result.data))return failed();
  // RLS remains active. Recipient filtering also mirrors the app and never trusts model-supplied identity.
  const posts:WallPost[]=result.data.slice(0,500).map(row=>({...row.data,id:row.id,base:row.base,resolved:row.resolved,revision:row.revision,updatedAt:row.updated_at,createdAt:row.created_at,audienceArea:row.audience_area,actions:row.data.actions||[],history:row.data.history||[],comments:row.data.comments||[],views:row.data.views||[],attachments:row.data.attachments||[]})).filter(post=>!post.audienceRecipients?.length||post.createdBy===employee||post.audienceRecipients.includes(employee));
  const today=calendarDay(new Date(),timeZone);
  const inDate=(value:string)=>{const day=calendarDay(value,timeZone);return (!q.from||day>=q.from)&&(!q.until||day<=q.until);};
  const selectedStatus=(closed:boolean)=>q.status==='all'||(q.status==='closed'?closed:!closed);
  let rows:{id:string;title:string;[key:string]:unknown}[]=[];
  if(q.id)rows=posts.map(p=>({id:p.id,title:p.title,body:p.body,base:p.base,category:p.category,resolved:p.resolved,actions:p.actions,comments:p.comments.map(c=>({body:c.body,at:c.at,employeeNumber:c.employeeNumber})),history:p.history,maintenanceRecordId:p.maintenanceRecordId}));
  else if(q.dataset==='timeline') rows=wallTimeline(posts,q.from||today,q.until||q.from||today,timeZone).filter(r=>matches(r.prefix,q.prefix)&&matches(`${r.post.title} ${r.summary}`,q.query)).map(r=>({id:r.id,title:r.post.title,summary:r.summary,prefix:r.prefix,at:r.at,activityAt:r.activityAt,base:r.post.base,category:r.post.category,resolved:r.post.resolved,latestComments:r.post.comments.slice(-3).map(c=>({body:c.body,at:c.at}))}));
  else if(q.dataset==='notices')rows=posts.filter(p=>isWallNotice(p)&&inDate(p.createdAt)&&matches(`${p.title} ${p.body}`,q.query)&&selectedStatus(p.resolved)).map(p=>({id:p.id,title:p.title,body:p.body,base:p.base,createdAt:p.createdAt,read:p.views.some(v=>v.employeeNumber===employee)}));
  else rows=posts.flatMap(p=>p.actions.filter(a=>(!q.mine||assignedToEmployee(a.assignedTo,employee,actor.fleets))&&selectedStatus(p.resolved||['satisfactory','resolved'].includes(a.status))&&inDate(a.createdAt||p.createdAt)&&matches(a.prefix,q.prefix)&&matches(`${a.title} ${a.description} ${p.category}`,q.query)).map(a=>({id:p.id,actionId:a.id,title:a.title,description:a.description,prefix:a.prefix,base:p.base,category:p.category,status:a.status,postResolved:p.resolved,assignedTo:a.assignedTo,createdAt:a.createdAt,executions:a.executions.map(e=>({description:e.description,result:e.result,at:e.at})),maintenanceRecordId:p.maintenanceRecordId})));
  const items=rows.slice(q.offset,q.offset+30),kind=q.dataset==='assignments'?'activity':'wall';
  return {status:'available',dataset:q.dataset,items,cards:items.map(r=>({kind,id:r.id,title:r.title,detail:String(r.base||'')})),complete:result.data.length<=500&&rows.length<=q.offset+30,nextOffset:rows.length>q.offset+30?q.offset+30:null,queriedAt:new Date().toISOString(),scope:local?base:q.base||'Bases autorizadas',period:{from:q.dataset==='timeline'?q.from||today:q.from,until:q.dataset==='timeline'?q.until||q.from||today:q.until},mine:q.mine,notice:result.data.length>500?'Busca limitada aos 500 registros mais recentemente atualizados; não afirmar ausência global.':q.dataset==='assignments'?'Designações são ações atribuídas. Relato técnico aberto não é designação. Datas filtram criação da atividade, não prazo de execução.':q.dataset==='timeline'?'Mesmas regras da Timeline do dia no Mural; não confundir atualização do cadastro de um relato com evento exibido na timeline.':'Publicações do quadro de avisos.'};
 }catch{return failed();}
}
