"use client";
import {useState} from "react";
import {ServicePlanning} from "@/components/service-planning";
import {ServiceImportAssistant} from "@/components/service-import-assistant";
import type {MaintenanceRecord} from "@/components/maintenance-records";
import type {SupabaseClient} from "@supabase/supabase-js";
const seed={recordType:"inspection",base:"QA",model:"S92",prefix:"PR-QAA",status:"open",description:"Inspeção programada",tc:"123-456",assignedTo:["M1"],entries:[],createdBy:"I1",createdAt:'2026-09-11T12:00:00Z',updatedAt:'2026-09-11T12:00:00Z',revision:1,links:[],priority:"routine"} as Partial<MaintenanceRecord>;
const people=[{employeeNumber:"M1",displayName:"Mecânico QA",profile:"mechanic",assignedBase:"QA",fleets:["S92"],mission:"mission_1",workShift:"day"}];
export default function Page(){const[items,setItems]=useState([ {...seed,id:"day",ticketCode:"PRG-D",title:"Serviço diurno",lastWorkShift:"day"},{...seed,id:"night",ticketCode:"PRG-N",title:"Serviço noturno",lastWorkShift:"night"}] as MaintenanceRecord[]);const[result,setResult]=useState("");const client={auth:{getSession:async()=>({data:{session:{access_token:"fixture"}}})}} as unknown as SupabaseClient;
 return <main className="p-5"><ServiceImportAssistant client={client} user="I1" disabled={false} onAdd={rows=>{setResult(JSON.stringify(rows));}}/><output>{result}</output><ServicePlanning items={items} people={people} directory={{}} canManage canExecute onOpen={i=>setResult(`OPEN ${i.id}`)} onAction={async(selected,action,assigned,text)=>{setResult(JSON.stringify({ids:selected.map(i=>i.id),action,assigned,text}));if(action==="exclude"||action==="execute")setItems(current=>current.filter(i=>!selected.includes(i)));if(action==="tc")setItems(current=>current.map(i=>selected.includes(i)?{...i,tc:text}:i));}}/></main>;
}
