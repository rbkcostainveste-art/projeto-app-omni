'use client';
import {useState,useEffect} from 'react';
import {PlannedTimesEditor} from '@/components/planned-times-editor';
export default function Fixture(){const [saved,setSaved]=useState('');const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);if(!ready)return null;return <main className="p-4"><PlannedTimesEditor flight={{id:'QA',revision:3,departure:'23:30',duration:1}} onSave={async(...args)=>{const r=await fetch('/__times_test',{method:'POST',body:JSON.stringify(args)});if(!r.ok)throw Error('Voo atualizado, confira antes de salvar.');setSaved(JSON.stringify(args));return true;}} onClose={()=>{}}/><output>{saved}</output></main>;}
