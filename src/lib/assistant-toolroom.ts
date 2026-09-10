import type {SupabaseClient} from '@supabase/supabase-js';
import type {AssistantActor,QueryArgs,QueryResult} from './assistant-queries';
import {normalizeSearch} from './assistant-queries';
import {calendarDay} from './wall-selectors';
type Box={id:string;code:string;name:string;base:string;status:string;aircraft_prefix:string|null};
type Event={employee_number:string;description:string;status:string;[key:string]:unknown};
type Operation={id:string;box_id:string;assigned_to:string;aircraft_prefix:string|null;status:string;notes:string;created_at:string;event_count:number;events:Event[]};
export async function queryToolroom(client:SupabaseClient,actor:AssistantActor,q:QueryArgs,signal:AbortSignal,timeZone='America/Sao_Paulo'):Promise<QueryResult>{
 if(!['admin','app_manager','maintenance_director','maintenance_manager'].includes(actor.accessProfile)&&q.base&&q.base!==actor.assignedBase)return {status:'not_authorized',items:[],cards:[],complete:false,notice:'Esta base não está disponível para seu perfil.'};
 const result=await client.rpc('assistant_toolroom_read',{p_employee:actor.employeeNumber,p_id:q.id}).abortSignal(signal);
 if(result.error||!result.data||result.data.status!=='available')return {status:'unavailable',items:[],cards:[],complete:false,notice:'Ferramentaria indisponível nesta consulta; não concluir ausência de pendências.'};
 const boxes=result.data.boxes as Box[],operations=result.data.operations as Operation[];
 const match=(value:string,filter:string|null)=>!filter||normalizeSearch(value).includes(normalizeSearch(filter));
 const items=operations.filter(op=>{const box=boxes.find(b=>b.id===op.box_id),day=calendarDay(op.created_at,timeZone);return box&&(!q.base||box.base===q.base)&&(!q.mine||op.assigned_to===actor.employeeNumber||op.events.some(e=>e.employee_number===actor.employeeNumber))&&match(op.aircraft_prefix||'',q.prefix)&&match(`${box.name} ${box.code} ${op.notes} ${op.events.map(e=>e.description).join(' ')}`,q.query)&&(!q.from||day>=q.from)&&(!q.until||day<=q.until)&&(q.status==='all'||(q.status==='closed'?op.status==='completed':op.status!=='completed'));}).map(op=>({...op,box:boxes.find(b=>b.id===op.box_id)}));
 const page=items.slice(q.offset,q.offset+30);
 return {status:'available',items:page,boxes:q.id?[]:boxes.filter(b=>(!q.base||b.base===q.base)&&match(`${b.name} ${b.code}`,q.query)),cards:page.map(op=>({kind:'tool',id:op.id,title:op.box?.name||'Caixa',detail:`${op.box?.base} · ${op.status}`})),complete:result.data.complete&&items.length<=q.offset+30&&page.every(op=>op.event_count<=60),nextOffset:items.length>q.offset+30?q.offset+30:null,scope:result.data.scope,queriedAt:new Date().toISOString(),notice:'Caixas e operações de ferramentaria. Operações têm estados próprios de aceite, uso e devolução; não confundir com status das ferramentas individuais. Eventos limitados aos 60 últimos por operação. Datas filtram criação da operação. Esta consulta não movimenta ferramentas, não executa limpeza de fotos e não altera registros.'};
}
