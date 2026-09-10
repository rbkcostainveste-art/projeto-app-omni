import type {SupabaseClient} from '@supabase/supabase-js';
export type DryingRow={id:string;prefix:string;model:string;base:string;reason:string;status:string;triggered_at:string;completed_at:string|null};
export async function assistantDryingContext(client:SupabaseClient,employee:string,signal:AbortSignal,id?:string){
 const unavailable={status:'unavailable',items:[] as DryingRow[],complete:false,notice:'Não foi possível verificar as secagens. Não concluir ausência.'};
 try{
  const {data:identity,error}=await client.rpc('refresh_current_device');
  if(error||!identity||identity.employeeNumber!==employee)return unavailable;
  const role=identity.accessProfile,base=typeof identity.assignedBase==='string'?identity.assignedBase.trim():'';
  const global=['admin','app_manager','coordination','maintenance_director','maintenance_manager'],crew=['commander','copilot','flight_attendant'],local=['mechanic','maintenance_assistant','maintenance_coordinator','maintenance_leader','maintenance_inspector','dispatch'];
  if(![...global,...crew,...local].includes(role)||local.includes(role)&&!base)return {...unavailable,status:'not_authorized'};
  let query=client.from('compressor_drying_tasks').select('id,prefix,model,base,reason,status,triggered_at,completed_at').order('triggered_at',{ascending:true}).order('id',{ascending:true}).limit(id?1:101);
  query=id?query.eq('id',id):query.eq('status','pending');
  if(local.includes(role))query=query.eq('base',base);
  const result=await query.abortSignal(signal);
  if(result.error||!Array.isArray(result.data))return unavailable;
  return {status:'available',items:result.data.slice(0,100) as DryingRow[],complete:result.data.length<=100,scope:local.includes(role)?base:crew.includes(role)?'Base operacional atual definida pelas permissões do servidor':'Bases autorizadas ao cargo',queriedAt:new Date().toISOString(),notice:'Pendências atuais de secagem, de qualquer data. triggered_at é abertura da pendência, não comprova lavagem hoje. Lavagens posteriores podem estar agrupadas. Não deduzir quais aeronaves foram lavadas hoje.'};
 }catch{return unavailable;}
}
