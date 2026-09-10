import {assistantAccess} from '@/lib/assistant-access';
import {assistantRecords} from '@/lib/assistant-records';
import {assistantDryingContext} from '@/lib/assistant-drying-context';
import {parseTarget} from '@/lib/assistant-targets';
import {assistantActor,assistantQuery} from '@/lib/assistant-queries';
export const runtime='nodejs';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 let access:Awaited<ReturnType<typeof assistantAccess>>;
 try{access=await assistantAccess(request);}catch{return json({error:'Entre novamente para abrir o registro.'},401);}
 const params=new URL(request.url).searchParams,ref=parseTarget({kind:params.get('kind'),id:params.get('id')});
 if(!ref)return json({error:'Card inválido.'},400);
 if(ref.kind==='wall'||ref.kind==='activity'||ref.kind==='flight'||ref.kind==='passage'||ref.kind==='tool'||ref.kind==='cockpit'||ref.kind==='note'){
  try{
   const actor=await assistantActor(access.client,access.employee);
   const result=await assistantQuery(access.client,actor,{dataset:ref.kind==='wall'?'timeline':ref.kind==='activity'?'assignments':ref.kind==='flight'?'flights':ref.kind==='tool'?'tools':ref.kind==='cockpit'?'cockpit':ref.kind==='note'?'notes':'passage',query:null,prefix:null,base:null,from:null,until:null,status:'all',mine:false,offset:0,id:ref.id},request.signal);
   if(result.status==='unavailable')return json({error:'Não foi possível verificar o registro.'},503);
   if(result.status!=='available'||!result.items.length)return json({error:'Registro indisponível ou sem acesso.'},404);
   const item=result.items[0] as {date?:string;prefix?:string};
   return json({target:ref,...(ref.kind==='passage'?{date:item.date,prefix:item.prefix}:{})});
  }catch{return json({error:'Não foi possível verificar o acesso.'},503);}
 }
 const result=ref.kind==='maintenance'?await assistantRecords(access.client,access.employee,request.signal,ref.id):await assistantDryingContext(access.client,access.employee,request.signal,ref.id);
 if(result.status==='unavailable')return json({error:'Não foi possível verificar o registro. Tente novamente.'},503);
 const rows='records' in result?result.records:result.items;
 if(result.status!=='available'||!rows.some((row:{id:string})=>row.id===ref.id))return json({error:'Registro indisponível ou sem acesso na sua base atual.'},404);
 return json({target:ref});
}
