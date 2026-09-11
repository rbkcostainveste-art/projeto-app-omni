'use client';
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {DraftReviewEditor} from '@/components/draft-review-editor';
const client={auth:{getSession:async()=>({data:{session:{access_token:'qa'}}})}} as unknown as SupabaseClient;
export default function Fixture(){const [title,setTitle]=useState(''),[description,setDescription]=useState('');return <main className="p-4"><DraftReviewEditor client={client} user="QA" model="S92" title={title} description={description} onChange={(t,d)=>{setTitle(t);setDescription(d);}} onActive={()=>{}}/><output data-testid="final">{JSON.stringify({title,description})}</output></main>;}
