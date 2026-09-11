"use client";
import {useState} from "react";
import {ChatAudienceForm} from "@/components/chat-audience-form";
const people=[{id:"GM",name:"Gestor QA",role:"maintenance_manager",base:"A"},{id:"I1",name:"Inspetor A",role:"maintenance_inspector",base:"A",fleets:["AW139"],workShift:"night",mission:"mission_2"},{id:"I2",name:"Inspetor B",role:"maintenance_inspector",base:"B",fleets:["S92"],workShift:"day",mission:"mission_1"},{id:"M1",name:"Mecânico QA",role:"mechanic",base:"A"}];
export default function Page(){const[result,setResult]=useState("");return <main className="mx-auto max-w-2xl p-4"><ChatAudienceForm people={people} actor={people[0]} allowFixed titleField submitLabel="Criar grupo QA" onCancel={()=>{}} onSubmit={async(ids,title,prefix,audience)=>setResult(JSON.stringify({ids,title,prefix,audience}))}/><output className="block break-all text-xs">{result}</output></main>;}
