import {NextResponse} from 'next/server';
import {assistantAccess} from '@/lib/assistant-access';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 try{await assistantAccess(request);}catch(e){return NextResponse.json({error:(e as Error).message},{status:401});}
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'O envio de áudio precisa da chave da OpenAI configurada no aplicativo.'},{status:503});
 try{
  const data=await request.formData(),file=data.get('file');
  if(!(file instanceof File)||!file.size||file.size>3*1024*1024||!/^audio\//.test(file.type))return NextResponse.json({error:'Envie um áudio de até 3 MB.'},{status:400});
  const form=new FormData();form.set('file',file);form.set('model','gpt-4o-mini-transcribe');form.set('language','pt');
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(45000)}),result=await response.json();
  if(!response.ok)return NextResponse.json({error:result.error?.message||'Não consegui ouvir este áudio.'},{status:response.status});
  if(!result.text?.trim())return NextResponse.json({error:'Nenhuma fala reconhecida. Grave novamente.'},{status:422});
  return NextResponse.json({text:result.text});
 }catch{return NextResponse.json({error:'Falha ao processar o áudio. Tente enviar novamente.'},{status:502});}
}
