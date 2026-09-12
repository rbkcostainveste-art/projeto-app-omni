import {createClient} from '@supabase/supabase-js';
import {fetchAisweb,validAisDate} from '@/lib/aisweb';

export const runtime='nodejs';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const station=(params.get('station')||'').trim().toUpperCase(),date=params.get('date')||new Date().toISOString().slice(0,10);
  if(!/^[A-Z]{4}$/.test(station)||!validAisDate(date))return Response.json({error:'Informe quatro letras ICAO e uma data válida.'},{status:400,headers});
  const authorization=request.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return Response.json({error:'Entre no aplicativo.'},{status:401,headers});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return Response.json({error:'Serviço indisponível.'},{status:503,headers});
  const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const {error}=await client.rpc('crew_presentation',{p_action:'settings'});
    if(error)return Response.json({error:'Sessão sem acesso. Entre novamente.'},{status:401,headers});
    const apiKey=process.env.AISWEB_API_KEY?.trim(),apiPass=process.env.AISWEB_API_PASS?.trim();
    if(!apiKey||!apiPass)return Response.json({error:'Consulta AISWEB aguardando configuração do acesso pelo ADM. O portal oficial continua disponível.'},{status:503,headers});
    const result=await fetchAisweb(station,date,{key:apiKey,pass:apiPass});
    return Response.json(result,{status:result.aerodrome.ok||result.notams.ok||result.sun.ok?200:502,headers});
  }catch{return Response.json({error:'Consulta indisponível. Tente novamente.'},{status:502,headers});}
}
