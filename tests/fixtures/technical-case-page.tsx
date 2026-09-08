'use client';
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {TechnicalCasePanel,TechnicalDraftReview,TechnicalOperatorSettings} from '@/components/technical-case';
import {initialTechnicalCase} from '@/lib/technical-case';
const client={rpc:async(name:string,args:unknown)=>(await fetch('/__technical_test',{method:'POST',body:JSON.stringify({name,args})})).json()} as unknown as SupabaseClient;
export default function Test(){const [saved,setSaved]=useState(false);return <main className="mx-auto max-w-4xl p-3"><h1>Relato Técnico · PR-CHT · HSI</h1><TechnicalCasePanel client={client} id="00000000-0000-4000-8000-000000000123" revision={1} value={initialTechnicalCase()} tc="" title="HSI intermitente" description="Sintoma observado" onSaved={()=>setSaved(true)} requireSignature={async action=>{await action();return true;}}/><TechnicalDraftReview text="teste não realizado"/><TechnicalOperatorSettings client={client}/>{saved?<p>Confirmação registrada</p>:null}</main>}
