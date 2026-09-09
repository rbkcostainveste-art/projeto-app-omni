import {createClient} from '@supabase/supabase-js';

export async function GET(request:Request){
 const station=new URL(request.url).searchParams.get('station')||'';
 if(!/^[A-Z]{4}$/.test(station))return Response.json({error:'Informe quatro letras ICAO.'},{status:400});
 const authorization=request.headers.get('authorization');
 if(!authorization?.startsWith('Bearer '))return Response.json({error:'Entre no aplicativo.'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return Response.json({error:'Serviço indisponível.'},{status:503});
 const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await client.rpc('crew_presentation',{p_action:'settings'});
 if(error)return Response.json({error:'Sessão sem acesso. Entre novamente.'},{status:401});
 const apiKey=process.env.REDEMET_API_KEY?.trim();
 if(!apiKey)return Response.json({error:'Consulta automática aguardando chave REDEMET. Use o acesso ao portal oficial abaixo.'},{status:503});
 try{
  const products=await Promise.all(['metar','taf'].map(async product=>{
   const endpoint=new URL(`https://api-redemet.decea.mil.br/mensagens/${product}/${station}`);
   const response=await fetch(endpoint,{headers:{'X-Api-Key':apiKey},cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok){
    if(response.status===401||response.status===403)throw Error('provider_auth');
    if(response.status===429)throw Error('provider_limit');
    throw Error('provider');
   }
   const result=await response.json();
   const entries=result?.data?.data;
   if(result.status===false)throw Error('provider');
   return {product:product.toUpperCase(),messages:Array.isArray(entries)?entries.map((row:Record<string,unknown>)=>({station:String(row.id_localidade||station),issuedAt:String(row.data_hora||row.recebimento||''),validFrom:String(row.validade_inicial||''),validUntil:String(row.validade_final||''),message:String(row.mens||'')})):[]};
  }));
  return Response.json({source:'DECEA / REDEMET',retrievedAt:new Date().toISOString(),station,products},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  const reason=error instanceof Error?error.message:'';
  const message=reason==='provider_auth'?'A REDEMET recusou o acesso. Confira se a chave cadastrada está completa, ativa e autorizada.':reason==='provider_limit'?'Limite de consultas da REDEMET atingido. Tente novamente mais tarde.':error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError')?'A REDEMET não respondeu no prazo. Tente novamente.':'Não foi possível consultar a REDEMET. Confira a fonte oficial; nenhuma informação foi estimada.';
  return Response.json({error:message},{status:502});
 }
}
