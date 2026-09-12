'use client';
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {AisResult} from '@/lib/aisweb';
import {valueOf,type CockpitEntry} from '@/lib/cockpit';
import {WeatherResults} from './weather-results';

const input='mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800';
const button='min-h-11 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-40';
const primary='min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40';
function dateLabel(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):value;}
function notamTime(value:string){
  const match=value.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(.*)$/);
  return match?`${match[3]}/${match[2]}/20${match[1]} ${match[4]}:${match[5]} UTC${match[6]}`:value||'Não informado';
}
function AisClocks({timezone}:{timezone:string}){
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
  let local='Fuso cadastrado inválido';try{local=now?now.toLocaleString('pt-BR',timezone?{timeZone:timezone}:{}):'…';}catch{}
  return <div className="grid gap-2 sm:grid-cols-2"><p className="rounded-xl bg-blue-50 p-3 text-sm"><b>UTC</b><br/>{now?now.toLocaleString('pt-BR',{timeZone:'UTC'}):'…'}</p><p className="rounded-xl bg-blue-50 p-3 text-sm"><b>{timezone||'Horário deste aparelho'}</b><br/>{local}</p></div>;
}

export function AisResults({result}:{result:AisResult}){
  const aerodrome=result.aerodrome,sun=result.sun,notams=result.notams;
  return <section aria-label="Resultado AISWEB" className="min-w-0 space-y-4">
    <div className="rounded-xl bg-blue-50 p-3 text-sm"><strong>{result.station} · {result.source}</strong><p>Consulta obtida em {new Date(result.retrievedAt).toLocaleString('pt-BR',{timeZone:'UTC'})} UTC.</p><a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block py-2 font-semibold underline">Conferir publicação oficial</a><p className="text-xs">NOTAMs: consulta atual da localidade. Confira também as FIRs, a rota e os alternados necessários ao voo.</p></div>
    <article className="min-w-0 rounded-xl border p-3"><h3 className="font-bold">Aeródromo · ROTAER</h3>{!aerodrome.ok?<p role="alert" className="mt-2 text-sm text-amber-800">{aerodrome.error}</p>:<>
      <p className="mt-2 font-semibold">{aerodrome.data.name}</p><p className="text-sm">{aerodrome.data.city} / {aerodrome.data.state} · {aerodrome.data.station}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">{[['Situação na fonte',aerodrome.data.status],['Operação',aerodrome.data.operation],['Elevação',aerodrome.data.elevationFeet?`${aerodrome.data.elevationFeet} ft`:''],['Latitude',aerodrome.data.latitude],['Longitude',aerodrome.data.longitude],['Fuso informado',aerodrome.data.utcOffset?`UTC ${aerodrome.data.utcOffset}`:'']].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words">{value||'Não informado'}</dd></div>)}</dl>
      {aerodrome.updatedAt?<p className="mt-2 text-xs text-slate-500">Atualização na fonte: {dateLabel(aerodrome.updatedAt)}</p>:null}
      <details className="mt-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Pistas, frequências e observações</summary><div className="space-y-3 text-sm">{aerodrome.data.runways.map((r,i)=><p key={i}><b>Pista {r.identifier}</b> · {r.length||'?'} × {r.width||'?'} m · {r.surface||'Superfície não informada'}</p>)}{aerodrome.data.communications.map((r,i)=><p key={i}><b>{r.type} {r.callsign}</b> · {r.frequencies.join(' / ')||'Frequência não informada'}</p>)}{[...aerodrome.data.remarks,...aerodrome.data.complements].map((remark,i)=><p key={i} className="whitespace-pre-wrap break-words">{remark}</p>)}<p className="text-xs text-slate-500">Consulte o ROTAER oficial para os demais detalhes e vínculos das observações.</p></div></details>
    </>}</article>
    <article className="rounded-xl border p-3"><h3 className="font-bold">Nascer e pôr do sol · UTC</h3>{!sun.ok?<p role="alert" className="mt-2 text-sm text-amber-800">{sun.error}</p>:<div className="mt-3 grid gap-2 sm:grid-cols-2">{sun.data.map(day=><div key={day.date} className="rounded-lg bg-slate-50 p-3 text-sm"><b>{dateLabel(day.date)} · {day.station}</b><p>Nascer: {day.sunrise} UTC</p><p>Pôr: {day.sunset} UTC</p></div>)}</div>}</article>
    <article className="min-w-0 rounded-xl border p-3"><h3 className="font-bold">NOTAMs · {notams.ok?`${notams.data.length} retornados`:'consulta indisponível'}</h3>{!notams.ok?<p role="alert" className="mt-2 text-sm text-amber-800">{notams.error}</p>:<>
      {notams.updatedAt?<p className="mt-1 text-xs text-slate-500">Atualização informada pela AISWEB: {notams.updatedAt}</p>:null}
      {!notams.data.length?<p className="mt-3 text-sm">A AISWEB não retornou NOTAMs vigentes nesta consulta da localidade.</p>:<div className="mt-3 space-y-3">{notams.data.map((n,i)=><details key={n.id||`${n.number}-${i}`} className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm"><strong>{n.number} · {n.station}</strong><span className="ml-2 text-xs text-slate-600">{n.type} · {n.status}</span><span className="mt-2 block whitespace-pre-wrap break-words">{n.text}</span></summary><dl className="mt-3 space-y-2 break-words text-sm">{[['Código',n.code],['Referência substituída / cancelada',n.reference],['Expedição na fonte',n.issuedAt],['B · Início',notamTime(n.from)],['C · Término',notamTime(n.until)],['D · Períodos de atividade',n.schedule],['F · Limite inferior',n.lower],['G · Limite superior',n.upper]].filter(([,value])=>value).map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}</dl></details>)}</div>}
    </>}</article>
  </section>;
}

export function AisPanel({locations,initialStation,initialDate,client}:{locations:CockpitEntry[];initialStation:string;initialDate:string;client:SupabaseClient|null}){
  const [station,setStation]=useState(initialStation),[date,setDate]=useState(initialDate),[weather,setWeather]=useState(''),[result,setResult]=useState<AisResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState<'ais'|'weather'|null>(null);
  const currentRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>currentRequest.current?.abort(),[]);
  function clear(){currentRequest.current?.abort();currentRequest.current=null;setResult(null);setWeather('');setError('');setBusy(null);}
  async function consult(kind:'ais'|'weather'){
    currentRequest.current?.abort();const controller=new AbortController();currentRequest.current=controller;
    setBusy(kind);setError('');if(kind==='ais')setResult(null);else setWeather('');
    try{
      const session=await client?.auth.getSession();if(controller.signal.aborted)return;
      const response=await fetch(`/api/cockpit-${kind==='ais'?'ais':'weather'}?station=${encodeURIComponent(station.trim().toUpperCase())}&date=${encodeURIComponent(date)}`,{headers:{Authorization:`Bearer ${session?.data.session?.access_token||''}`},signal:controller.signal,cache:'no-store'});
      const data=await response.json();if(controller.signal.aborted)return;
      if(kind==='ais'&&data.source==='DECEA / AISWEB'){setResult(data);return;}
      if(!response.ok)throw Error(data.error||'Consulta indisponível. Tente novamente.');
      setWeather(JSON.stringify(data));
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Consulta indisponível.');}
    finally{if(currentRequest.current===controller){setBusy(null);currentRequest.current=null;}}
  }
  const normalized=station.trim().toUpperCase(),valid=/^[A-Z]{4}$/.test(normalized);
  return <div className="min-w-0 space-y-4 rounded-2xl border bg-white p-4">
    <AisClocks timezone={valueOf(locations.find(l=>valueOf(l.data,'icao')===normalized)?.data||{},'timezone')}/>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Aeródromo ICAO<input maxLength={4} className={input} value={station} onChange={e=>{clear();setStation(e.target.value.toUpperCase());}} placeholder="Ex.: SBJR" autoCapitalize="characters"/></label><label className="block text-sm font-semibold">Data para horários solares<input type="date" className={input} value={date} onChange={e=>{clear();setDate(e.target.value);}}/></label></div>
    <div className="flex flex-wrap gap-2"><button disabled={!!busy||!valid||!date} className={primary} onClick={()=>void consult('ais')}>Consultar / atualizar AISWEB</button><button disabled={!!busy||!valid} className={button} onClick={()=>void consult('weather')}>Consultar METAR / TAF</button><a className={button} target="_blank" rel="noopener noreferrer" href={valid?`https://aisweb.decea.mil.br/?i=aerodromos&codigo=${encodeURIComponent(normalized)}`:'https://aisweb.decea.mil.br/'}>Abrir AISWEB oficial</a><a className={button} target="_blank" rel="noopener noreferrer" href="https://redemet.decea.mil.br/">Abrir REDEMET</a></div>
    {busy?<p role="status" className="text-sm">Consultando {busy==='ais'?'AISWEB':'REDEMET'}…</p>:null}{error?<p role="alert" className="text-sm text-amber-800">{error}</p>:null}
    {result?<AisResults result={result}/>:null}{weather?<WeatherResults value={weather}/>:null}
    {locations.length?<details><summary className="cursor-pointer py-2 text-sm font-semibold">Locais cadastrados no aplicativo</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{locations.map(l=><article key={l.id} className="min-w-0 rounded-xl border p-3 text-sm"><b>{valueOf(l.data,'title')} · {valueOf(l.data,'icao')}</b><p>{valueOf(l.data,'latitude')}, {valueOf(l.data,'longitude')} · {valueOf(l.data,'timezone')}</p><small>Fonte cadastrada: {valueOf(l.data,'source')||'não informada'}</small>{['sunrise','sunset','nextSunrise'].map(key=><p key={key} className="mt-1 text-xs">{{sunrise:'Nascer do sol',sunset:'Pôr do sol',nextSunrise:'Próximo nascer do sol'}[key]}: {valueOf(l.data,key)?new Date(valueOf(l.data,key)).toLocaleString('pt-BR'):'Não informado no cadastro'}</p>)}{/^[A-Z]{4}$/.test(valueOf(l.data,'icao'))?<button className={button+' mt-2'} onClick={()=>{clear();setStation(valueOf(l.data,'icao'));}}>Selecionar local</button>:null}</article>)}</div></details>:null}
  </div>;
}
