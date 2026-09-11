"use client";
import {useState,useEffect} from 'react';
import {FlightCoordination} from '@/components/flight-coordination';
const noop=()=>{};const save=async()=>true;
export default function Fixture(){const[ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);if(!ready)return null;return <FlightCoordination supabase={null} flights={[]} aircraft={[{prefix:'PR-QSC',model:'S92',base:'QA',available:true}]} people={[{employeeNumber:'P1',name:'Da base S92',profile:'commander',assignedBase:'QA',fleets:['S92']},{employeeNumber:'P2',name:'Outra base',profile:'commander',assignedBase:'OTHER',fleets:['S92']},{employeeNumber:'P3',name:'Outra frota',profile:'copilot',assignedBase:'QA',fleets:['AW139']},{employeeNumber:'C1',name:'Comissário da base',profile:'flight_attendant',assignedBase:'QA',fleets:['S92']}]} user="QA" onCreate={save} onConfirm={noop} onOpenTrail={noop} onOpenWaves={noop} onBack={noop}/>;}
