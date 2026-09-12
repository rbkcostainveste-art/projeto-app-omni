'use client';
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AisPanel} from '../../src/components/ais-panel';
import type {AisResult} from '../../src/lib/aisweb';

const result:AisResult={station:'SBJR',date:'2026-09-12',source:'DECEA / AISWEB',sourceUrl:'https://aisweb.decea.mil.br/?i=aerodromos&codigo=SBJR',retrievedAt:'2026-09-12T19:30:00Z',aerodrome:{ok:true,updatedAt:'2026-09-10',data:{station:'SBJR',name:'Aeródromo de teste',city:'Rio de Janeiro',state:'RJ',status:'Active',latitude:'-22.9875',longitude:'-43.37',utcOffset:'-3',elevationFeet:'10',operation:'VFR',runways:[{identifier:'03/21',length:'900',width:'30',surface:'ASPH'}],communications:[{type:'Torre',callsign:'Teste',frequencies:['118.050']}],remarks:['Observação de teste; conferir a publicação original.'],complements:[]}},sun:{ok:true,updatedAt:'',data:[{date:'2026-09-12',station:'SBJR',sunrise:'08:52',sunset:'20:46'},{date:'2026-09-13',station:'SBJR',sunrise:'08:51',sunset:'20:47'}]},notams:{ok:true,updatedAt:'2026-09-12 19:30:00',data:[{id:'test',number:'E0123/26',station:'SBJR',type:'NOTAMR',status:'ACTIVE',reference:'E0100/26',issuedAt:'2026-09-10 12:00:00',from:'2609120800',until:'2609222200',schedule:'DAILY 0800-2200',text:'RWY CLSD — TEXTO DE TESTE\nSegunda linha do texto original.',lower:'SFC',upper:'500FT AMSL',code:'QMRLC'}]}};
const client={auth:{getSession:async()=>({data:{session:{access_token:'test-only'}}})}} as unknown as SupabaseClient;
export default function AiswebFixture(){
  const [fail,setFail]=useState(false),[ready,setReady]=useState(false);
  useEffect(()=>{
    const original=window.fetch;
    window.fetch=(async(input,init)=>{
      if(String(input).includes('/api/cockpit-ais'))return Response.json(fail?{...result,notams:{ok:false,error:'Falha de consulta de teste.'}}:result);
      return original(input,init);
    }) as typeof fetch;
    queueMicrotask(()=>setReady(true));
    return()=>{window.fetch=original;};
  },[fail]);
  return <main className="mx-auto max-w-5xl p-3 text-slate-900"><h1 className="mb-3 text-xl font-bold">Verificação AISWEB · dados simulados</h1><label className="mb-3 block"><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/> Simular falha de NOTAM</label>{ready?<AisPanel locations={[]} initialStation="SBJR" initialDate="2026-09-12" client={client}/>:null}</main>;
}
