'use client';

import {useState} from 'react';
import {decodeWeather} from '@/lib/weather-decode';

type WeatherMessage={station:string;issuedAt:string;validFrom:string;validUntil:string;message:string};
type WeatherResponse={source:string;retrievedAt:string;products:{product:string;messages:WeatherMessage[]}[]};

function Bulletin({message,product,decoded}:{message:WeatherMessage;product:string;decoded:boolean}){
 const interpretation=decoded?decodeWeather(message.message,product):null;
 return <div className="mt-3 border-t border-slate-200 pt-3">
  {interpretation?<>
   <p className="mb-3 text-xs text-slate-600">Leitura auxiliar em português. Confira o boletim original para uso operacional. Os grupos de mudança mostram apenas o que está informado naquele trecho.</p>
   {interpretation.sections.map((section,index)=><section key={index} className="mb-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
    <h4 className="font-semibold text-blue-950">{section.title}</h4>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{section.detail}</p>
    <dl className="mt-3 space-y-3">{section.fields.map((field,i)=><div key={i} className="border-t border-blue-100 pt-2 first:border-0 first:pt-0">
     <dt className="text-xs font-semibold text-slate-600">{field.label} <code className="ml-1 break-all font-normal text-slate-500">{field.code}</code></dt>
     <dd className="mt-1 text-sm leading-relaxed text-slate-900">{field.text}</dd>
    </div>)}</dl>
    {section.unknown.length>0?<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-950"><p className="font-semibold">Trecho não decodificado — conferir no original</p><p className="mt-1 break-words font-mono">{section.unknown.join(' ')}</p></div>:null}
   </section>)}
   <details className="rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-blue-800">Ver boletim original · {product} {message.station}</summary><p className="mt-2 whitespace-pre-wrap break-words font-mono text-sm text-slate-900">{message.message}</p></details>
  </>:<p className="whitespace-pre-wrap break-words font-mono text-sm">{message.message}</p>}
  <p className="mt-2 text-xs text-slate-600">Referência da fonte (UTC): {message.issuedAt||'não informada'}{product==='TAF'&&message.validFrom?` · Validade: ${message.validFrom}${message.validUntil?` até ${message.validUntil}`:''}`:''}</p>
 </div>;
}

export function WeatherResults({value}:{value:string}){
 const [decoded,setDecoded]=useState(false);
 const result=JSON.parse(value) as WeatherResponse;
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <p className="text-xs text-slate-600">{result.source} · consultado em {new Date(result.retrievedAt).toLocaleString('pt-BR')}</p>
   <div role="group" aria-label="Formato dos boletins meteorológicos" className="flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
    {[{label:'Original',value:false},{label:'Decodificado',value:true}].map(option=><button key={option.label} type="button" aria-pressed={decoded===option.value} onClick={()=>setDecoded(option.value)} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${decoded===option.value?'bg-blue-700 text-white shadow-sm':'text-slate-700 hover:bg-white'}`}>{option.label}</button>)}
   </div>
  </div>
  {result.products.map(product=><article key={product.product} className="rounded-xl border border-slate-200 bg-white p-3">
   <h3 className="font-bold text-slate-900">{product.product} <span className="text-xs font-normal text-slate-600">{product.product==='TAF'?'Previsão do aeródromo':'Observação meteorológica'}</span></h3>
   {product.messages.length?product.messages.map((message,i)=><Bulletin key={`${message.station}-${i}`} message={message} product={product.product} decoded={decoded}/>):<p className="mt-2 text-sm">Nenhuma mensagem retornada. Confira o portal oficial.</p>}
  </article>)}
 </div>;
}
