'use client';
import {useRef,useState,useEffect,useCallback} from 'react';
import {type CockpitData,valueOf} from '@/lib/cockpit';

export function OccurrenceLocation({data,onChange,disabled,autoLocate=false}:{autoLocate?:boolean;data:CockpitData;onChange:(update:Partial<CockpitData>)=>void;disabled:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const lat=valueOf(data,'latitude'),lon=valueOf(data,'longitude');
 const valid=lat!==''&&lon!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lon))<=180;
 const locate=useCallback(()=>{
  if(!navigator.geolocation){setMessage('Localização indisponível. Você pode informar o local ou salvar sem localização.');return;}
  const request=++generation.current;setBusy(true);setMessage('');
  navigator.geolocation.getCurrentPosition(position=>{
   if(request!==generation.current)return;
   onChange({latitude:position.coords.latitude,longitude:position.coords.longitude,locationAccuracy:Math.round(position.coords.accuracy),locationCapturedAt:new Date(position.timestamp).toISOString(),locationSource:'Aparelho · posição atual'});
   setBusy(false);setMessage('Posição atual obtida. Confira se corresponde ao local da ocorrência.');
  },()=>{if(request!==generation.current)return;setBusy(false);setMessage('Não foi possível obter a localização. Informe o local manualmente ou salve sem localização.');},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
 },[onChange]);
 const attempted=useRef(false);
 useEffect(()=>{if(!autoLocate||attempted.current||disabled)return;const timer=setTimeout(()=>{attempted.current=true;locate();},0);return()=>clearTimeout(timer);},[autoLocate,disabled,locate]);
 return <div className="my-3 rounded-xl border bg-slate-50 p-3 text-sm">
  <button type="button" disabled={disabled||busy} className="min-h-11 rounded-xl border bg-white px-3 disabled:opacity-40" onClick={locate}>{busy?'Obtendo localização…':'Usar minha localização atual'}</button>
  <p className="mt-2">O horário e o local da ocorrência podem ser corrigidos abaixo se o fato aconteceu antes ou em outro lugar. A localização é opcional.</p>
  {valueOf(data,'locationAccuracy')?<p>Precisão estimada: {valueOf(data,'locationAccuracy')} m · {valueOf(data,'locationSource')}</p>:null}
  {valid?<a className="mt-2 inline-block min-h-11 py-2 text-blue-700 underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`} target="_blank" rel="noreferrer">Ver local no mapa</a>:null}
  {message?<p role="status" className="mt-2">{message}</p>:null}
 </div>;
}
