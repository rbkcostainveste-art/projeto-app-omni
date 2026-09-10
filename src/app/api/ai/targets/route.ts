import {assistantAccess} from '@/lib/assistant-access';
import {assistantRecords} from '@/lib/assistant-records';
import {assistantDryingContext} from '@/lib/assistant-drying-context';
import {parseTarget} from '@/lib/assistant-targets';
export const runtime='nodejs';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 let access:Awaited<ReturnType<typeof assistantAccess>>;
 try{access=await assistantAccess(request);}catch{return json({error:'Entre novamente para abrir o registro.'},401);}
 const params=new URL(request.url).searchParams,ref=parseTarget({kind:params.get('kind'),id:params.get('id')});
 if(!ref)return json({error:'Card inválido.'},400);
 const result=ref.kind==='maintenance'?await assistantRecords(access.client,access.employee,request.signal,ref.id):await assistantDryingContext(access.client,access.employee,request.signal,ref.id);
 if(result.status==='unavailable')return json({error:'Não foi possível verificar o registro. Tente novamente.'},503);
 const rows='records' in result?result.records:result.items;
 if(result.status!=='available'||!rows.some((row:{id:string})=>row.id===ref.id))return json({error:'Registro indisponível ou sem acesso na sua base atual.'},404);
 return json({target:ref});
}
