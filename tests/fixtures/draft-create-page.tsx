'use client';
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {CreateRecord} from '@/components/maintenance-records';
const client={auth:{getSession:async()=>({data:{session:{access_token:'qa'}}})}} as unknown as SupabaseClient;
export default function Fixture(){const [saved,setSaved]=useState<unknown>(null);return saved?<pre data-testid="saved">{JSON.stringify(saved)}</pre>:<CreateRecord client={client} type="fault" aircraft={[{prefix:'PR-QAT',model:'S92',base:'QA'}]} people={[]} seed={{prefix:'PR-QAT',type:'fault',sourceFlightId:''}} user="QA" canAssign={false} onClose={()=>{}} onCreate={async record=>{setSaved(record);}}/>;}
