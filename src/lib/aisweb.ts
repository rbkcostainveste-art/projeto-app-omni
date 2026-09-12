import {XMLParser,XMLValidator} from 'fast-xml-parser';

export type AisProduct<T>={ok:true;data:T;updatedAt:string}|{ok:false;error:string};
export type AisNotam={id:string;number:string;type:string;status:string;reference:string;station:string;issuedAt:string;from:string;until:string;schedule:string;text:string;lower:string;upper:string;code:string};
export type AisAerodrome={station:string;name:string;city:string;state:string;status:string;latitude:string;longitude:string;utcOffset:string;elevationFeet:string;operation:string;runways:{identifier:string;length:string;width:string;surface:string}[];communications:{type:string;callsign:string;frequencies:string[]}[];remarks:string[];complements:string[]};
export type AisSun={date:string;station:string;sunrise:string;sunset:string};
export type AisResult={station:string;date:string;source:string;sourceUrl:string;retrievedAt:string;aerodrome:AisProduct<AisAerodrome>;notams:AisProduct<AisNotam[]>;sun:AisProduct<AisSun[]>};
type XmlNode=Record<string,unknown>;
const object=(value:unknown):XmlNode=>value&&typeof value==='object'&&!Array.isArray(value)?value as XmlNode:{};
const list=(value:unknown):unknown[]=>value===undefined||value===null||value===''?[]:Array.isArray(value)?value:[value];
const text=(value:unknown):string=>typeof value==='string'?value.trim():typeof value==='number'?String(value):typeof object(value)['#text']==='string'?String(object(value)['#text']).trim():'';
const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false,maxNestedTags:40,processEntities:true});

export function validAisDate(date:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(`${date}T00:00:00Z`))&&new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)===date;
}
export function nextAisDate(date:string){return new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString().slice(0,10);}
export function aisSourceUrl(station:string){return `https://aisweb.decea.mil.br/?i=aerodromos&codigo=${encodeURIComponent(station)}`;}

export function parseAisXml(xml:string):XmlNode{
  if(xml.length>1000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml.trim())!==true)throw Error('invalid_response');
  const result=object(parser.parse(xml.trim()));
  if(!Object.hasOwn(result,'aisweb'))throw Error('invalid_response');
  const root=object(result.aisweb);
  if(Object.hasOwn(root,'error')||Object.hasOwn(root,'erro')||Object.hasOwn(root,'errors'))throw Error('invalid_response');
  return root;
}

export function parseAerodrome(xml:string,station:string):AisProduct<AisAerodrome>{
  const root=parseAisXml(xml);
  if(text(root.AeroCode)!==station||!text(root.name))throw Error('invalid_response');
  return {ok:true,updatedAt:text(root.dt),data:{station,name:text(root.name),city:text(root.city),state:text(root.uf),status:text(root.status),latitude:text(root.lat),longitude:text(root.lng),utcOffset:text(root.utc),elevationFeet:text(root.altFt),operation:text(root.typeOpr),
    runways:list(object(root.runways).runway).map(value=>{const r=object(value);return {identifier:text(r.ident),length:text(r.length),width:text(r.width),surface:text(r.surface)||text(r.surface_c)};}),
    communications:list(object(root.services).service).map(object).filter(r=>text(r['@_type'])==='COM').map(r=>({type:text(r.type),callsign:text(r.callsign),frequencies:list(object(r.freqs).freq).map(text).filter(Boolean)})),
    remarks:list(object(root.rmk).rmkText).map(text).filter(Boolean),complements:list(object(root.compls).compl).map(value=>{const c=object(value);return [text(c['@_n']),text(value)].filter(Boolean).join(' · ');}).filter(Boolean)}};
}

export function parseNotams(xml:string,station:string):AisProduct<AisNotam[]>{
  const root=parseAisXml(xml);
  if(!Object.hasOwn(root,'notam'))throw Error('invalid_response');
  const group=object(root.notam),items=list(group.item);
  const count=text(group['@_total']);
  if(!/^\d+$/.test(count)||Number(count)!==items.length)throw Error('incomplete_response');
  const data=items.map(value=>{
    const r=object(value),itemStation=text(r.loc)||text(r.icaoairport_id);
    if(itemStation!==station||!text(r.n)||!text(r.e))throw Error('invalid_response');
    return {id:text(r.id)||text(r['@_id']),number:text(r.n),type:text(r.tp),status:text(r.state)||text(r.status),reference:text(r.ref)||text(r.ref_n),station:itemStation,issuedAt:text(r.dt),from:text(r.b),until:text(r.c),schedule:text(r.d),text:text(r.e),lower:text(r.f),upper:text(r.g),code:text(r.cod)};
  });
  return {ok:true,updatedAt:text(group['@_updatedat']),data};
}

export function parseSun(xml:string,station:string,date:string):AisProduct<AisSun[]>{
  const root=parseAisXml(xml);
  if(!Object.hasOwn(root,'day'))throw Error('invalid_response');
  const data=list(root.day).map(value=>{const r=object(value);return {date:text(r.date),station:text(r.aero),sunrise:text(r.sunrise),sunset:text(r.sunset)};});
  if(!data.length||data.some(r=>r.station!==station||![date,nextAisDate(date)].includes(r.date)||![r.sunrise,r.sunset].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))||!data.some(r=>r.date===date))throw Error('invalid_response');
  return {ok:true,updatedAt:'',data};
}

export function aisError(error:unknown){
  const reason=error instanceof Error?error.message:'';
  if(reason==='provider_auth')return 'A AISWEB recusou as credenciais. Solicite ao ADM a verificação do acesso.';
  if(reason==='provider_limit')return 'Limite de consultas AISWEB atingido. Tente novamente mais tarde.';
  if(reason==='incomplete_response')return 'A AISWEB retornou uma lista incompleta. Atualize a consulta ou confira o portal oficial.';
  if(error instanceof Error&&['AbortError','TimeoutError'].includes(error.name))return 'A AISWEB não respondeu no prazo. Tente novamente.';
  return 'Não foi possível confirmar os dados na AISWEB. Atualize a consulta ou confira o portal oficial.';
}

export async function fetchAisweb(station:string,date:string,credentials:{key:string;pass:string},fetcher:typeof fetch=fetch):Promise<AisResult>{
  if(!/^[A-Z]{4}$/.test(station)||!validAisDate(date))throw Error('invalid_query');
  if(!credentials.key||!credentials.pass)throw Error('missing_credentials');
  async function query<T>(area:string,decode:(xml:string)=>AisProduct<T>):Promise<AisProduct<T>>{
    try{
      const endpoint=new URL('https://api.decea.mil.br/aisweb/');
      endpoint.search=new URLSearchParams({apiKey:credentials.key,apiPass:credentials.pass,area,icaoCode:station}).toString();
      if(area==='notam'){
        endpoint.searchParams.set('all','1');endpoint.searchParams.set('dist','N');
        // all=1 alone defaults to notices issued in the last 24 hours. Include
        // all notices since 1900 so older, still-valid notices are not omitted.
        endpoint.searchParams.set('minutes',String(Math.ceil((Date.now()-Date.UTC(1900,0,1))/60000)));
      }
      if(area==='sol'){endpoint.searchParams.set('dt_i',date);endpoint.searchParams.set('dt_f',nextAisDate(date));}
      const response=await fetcher(endpoint,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error(response.status===401||response.status===403?'provider_auth':response.status===429?'provider_limit':'provider');
      if(Number(response.headers.get('content-length')||0)>1000000)throw Error('invalid_response');
      const reader=response.body?.getReader();if(!reader)throw Error('invalid_response');
      const chunks:Uint8Array[]=[];let size=0;
      try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>1000000)throw Error('invalid_response');chunks.push(chunk.value);}}
      finally{await reader.cancel();reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      // Only normalized fields leave the server; never return provider URLs
      // or raw errors, which can include the credentials sent in the query.
      const xml=new TextDecoder().decode(bytes).replaceAll(credentials.key,'[oculto]').replaceAll(credentials.pass,'[oculto]');
      return decode(xml);
    }catch(error){return {ok:false,error:aisError(error)};}
  }
  const [aerodrome,notams,sun]=await Promise.all([query('rotaer',xml=>parseAerodrome(xml,station)),query('notam',xml=>parseNotams(xml,station)),query('sol',xml=>parseSun(xml,station,date))]);
  return {station,date,source:'DECEA / AISWEB',sourceUrl:aisSourceUrl(station),retrievedAt:new Date().toISOString(),aerodrome,notams,sun};
}
