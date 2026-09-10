import type {SupabaseClient} from '@supabase/supabase-js';
import type {AssistantActor,QueryArgs,QueryResult} from './assistant-queries';
import {parseTarget} from './assistant-targets';

/** Dates refer to authenticated wash confirmations, never to drying queue creation. */
export async function queryWashing(client:SupabaseClient,actor:AssistantActor,q:QueryArgs,signal:AbortSignal,timeZone:string):Promise<QueryResult>{
 if(q.id||q.mine)return {status:'unsupported',items:[],cards:[],complete:false,notice:'Lavagens são consultadas por período, base, prefixo e modelo. Não há filtro pessoal nesta consulta.'};
 const {data,error}=await client.rpc('assistant_wash_read',{p_employee:actor.employeeNumber,p_from:q.from,p_until:q.until,p_timezone:timeZone,p_base:q.base,p_prefix:q.prefix,p_model:q.query,p_status:q.status,p_offset:q.offset}).abortSignal(signal);
 if(error||!data||data.status!=='available'||!Array.isArray(data.items))return {status:'unavailable',items:[],cards:[],complete:false,notice:'Não foi possível consultar as confirmações de lavagem. Não concluir ausência de lavagens.'};
 const cards=data.items.flatMap((item:{dryingTaskId?:string;prefix:string;base:string})=>{const ref=parseTarget({kind:'drying',id:item.dryingTaskId});return ref?[{...ref,title:`${item.prefix} · Secagem pendente`,detail:item.base}]:[];});
 return {...data,cards:cards.filter((card:typeof cards[number],index:number)=>cards.findIndex((other:typeof card)=>other.id===card.id)===index),queriedAt:new Date().toISOString()};
}
