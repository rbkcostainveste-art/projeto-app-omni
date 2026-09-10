import type {SupabaseClient} from '@supabase/supabase-js';

export async function assistantRecords(client:SupabaseClient,employee:string,signal:AbortSignal){
 const unavailable={status:'unavailable',records:[],notice:'Não foi possível verificar os relatos. Não concluir ausência de pane ou relato.'};
 try{
  const {data:identity,error}=await client.rpc('refresh_current_device');
  if(error||!identity||identity.employeeNumber!==employee)return unavailable;
  const role=identity.accessProfile,base=typeof identity.assignedBase==='string'?identity.assignedBase.trim():'';
  const global=['admin','app_manager','maintenance_director','maintenance_manager'];
  const local=['mechanic','maintenance_assistant','maintenance_coordinator','maintenance_leader','maintenance_inspector'];
  const profile={role,base};
  if(!global.includes(role)&&!local.includes(role))return {...unavailable,status:'not_authorized',profile};
  if(local.includes(role)&&!base)return {...unavailable,profile,notice:'Base não definida para consultar relatos deste perfil.'};
  let query=client.from('maintenance_records').select('id,record_type,prefix,model,base,title,status,updated_at').eq('status','open').in('record_type',['fault','discrepancy']).order('updated_at',{ascending:false}).order('id',{ascending:true}).limit(101);
  if(local.includes(role))query=query.eq('base',base);
  const result=await query.abortSignal(signal);
  if(result.error||!Array.isArray(result.data))return {...unavailable,profile};
  return {status:'available',profile,scope:local.includes(role)?base:'Registros autorizados pelo servidor',queriedAt:new Date().toISOString(),complete:result.data.length<=100,records:result.data.slice(0,100),notice:'Relatos técnicos com status aberto acessíveis nesta consulta; não representa diagnóstico de pane nem todos os tipos de registro. Acima de 100, resultado parcial.'};
 }catch{return unavailable;}
}
