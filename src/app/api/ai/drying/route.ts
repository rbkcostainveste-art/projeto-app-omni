import {assistantAccess} from '@/lib/assistant-access';

export const runtime='nodejs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

// This endpoint only reads the queue. RLS remains active under the caller's JWT.
export async function GET(request:Request){
 let access:Awaited<ReturnType<typeof assistantAccess>>;
 try{access=await assistantAccess(request);}catch{return json({error:'Entre novamente para consultar as secagens.'},401);}
 const params=new URL(request.url).searchParams;
 const model=params.get('model')||'all',id=params.get('id');
 if(!['all','s92'].includes(model)||id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return json({error:'Filtro inválido.'},400);
 try{
  const {data:identity,error:identityError}=await access.client.rpc('refresh_current_device');
  if(identityError||!identity||identity.employeeNumber!==access.employee)return json({error:'Sua sessão mudou. Entre novamente.'},401);
  const role=identity.accessProfile;
  const globalRoles=['admin','app_manager','coordination','maintenance_director','maintenance_manager'];
  const crewRoles=['commander','copilot','flight_attendant'];
  const baseRoles=['mechanic','maintenance_assistant','maintenance_coordinator','maintenance_leader','maintenance_inspector','dispatch'];
  if(![...globalRoles,...crewRoles,...baseRoles].includes(role))return json({error:'Seu perfil não possui esta consulta operacional.'},403);
  const base=typeof identity.assignedBase==='string'?identity.assignedBase.trim():'';
  if(baseRoles.includes(role)&&!base)return json({error:'Seu cadastro precisa de uma base para esta consulta.'},403);
  let query=access.client.from('compressor_drying_tasks').select('id,prefix,model,base,reason,status,triggered_at,completed_at').order('triggered_at',{ascending:true}).order('id',{ascending:true}).limit(101);
  if(id)query=query.eq('id',id);else query=query.eq('status','pending');
  if(baseRoles.includes(role))query=query.eq('base',base);
  if(model==='s92')query=query.in('model',['S92','S92A','S-92','S-92A','S 92','S 92A']);
  const {data,error}=await query.abortSignal(request.signal);
  if(error||!Array.isArray(data))throw Error('query failed');
  if(id&&!data.length)return json({error:'Registro indisponível ou sem acesso. Atualize a consulta.'},404);
  return json({items:data.slice(0,100),truncated:data.length>100,queriedAt:new Date().toISOString(),scope:baseRoles.includes(role)?`Base ${base}`:crewRoles.includes(role)?'Base operacional atual, conforme permissão do servidor':'Bases autorizadas ao seu cargo',period:'Pendências atuais, de qualquer data',notice:'A data indica a abertura da pendência. Lavagens posteriores podem estar agrupadas nela; esta consulta não determina quais aeronaves foram lavadas hoje.'});
 }catch{return json({error:'Não foi possível consultar a fila. Nenhuma conclusão sobre pendências foi produzida.'},503);}
}
