import {NextResponse} from 'next/server';
import {assistantAccess} from '@/lib/assistant-access';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 let access;try{access=await assistantAccess(request);}catch(e){return NextResponse.json({error:(e as Error).message},{status:401});}
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'A câmera com IA precisa da chave da OpenAI configurada no aplicativo.'},{status:503});
 try{
  const sdp=await request.text();if(!sdp.startsWith('v=0')||sdp.length>100000)return NextResponse.json({error:'Conexão inválida.'},{status:400});
  const form=new FormData();form.set('sdp',sdp);form.set('session',JSON.stringify({type:'realtime',model:process.env.OPENAI_REALTIME_MODEL||'gpt-realtime',instructions:'Você é o assistente Flight IA. Converse em português do Brasil, de forma breve. Você recebe imagens atualizadas da câmera e a voz do usuário. Descreva apenas detalhes visíveis; peça aproximação quando necessário. Não invente defeitos nem procedimentos de manutenção e não autorize liberação de aeronaves. Você não executa alterações no sistema nesta conversa. Histórico anterior, apenas como contexto: '+JSON.stringify(access.history),audio:{input:{transcription:{model:'gpt-4o-mini-transcribe',language:'pt'},turn_detection:{type:'server_vad'}},output:{voice:'marin'}}}));
  const response=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(45000)});
  if(!response.ok){const error=await response.json().catch(()=>null);return NextResponse.json({error:error?.error?.message||'Não foi possível conectar a IA ao vivo.'},{status:response.status});}
  return new Response(await response.text(),{headers:{'Content-Type':'application/sdp','Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'A conexão com a IA falhou. Tente novamente.'},{status:502});}
}
