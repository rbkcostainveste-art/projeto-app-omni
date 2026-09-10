"use client";
import {useState} from "react";
import {FlightCoordination,type CoordinatedFlight} from "@/components/flight-coordination";
import type {SupabaseClient} from "@supabase/supabase-js";
const client={auth:{getSession:async()=>({data:{session:{access_token:"synthetic"}}})},from:()=>({select:()=>({eq:()=>({order:async()=>({data:[],error:null})})})})} as unknown as SupabaseClient;
const initial={id:"existing",prefix:"PR-TEST",model:"S92",base:"Teste",date:"2026-09-10",departure:"08:00",destination:"P-1",duration:1,fuelAmount:0,fuelUnit:"L",fuel:"pending",preflight:"pending",hums:"pending",engineStart:"pending",shutdown:"pending",revision:1,acknowledged:{},createdBy:"TEST",updatedBy:"TEST",planningStatus:"planned"} as CoordinatedFlight;
export default function TestPage(){const [saved,setSaved]=useState<CoordinatedFlight[]>([]);return <main className="p-4"><FlightCoordination supabase={client} flights={[initial,...saved]} aircraft={[{prefix:"PR-TEST",model:"S92",base:"Teste",available:true}]} people={[]} user="TEST" onCreate={async flight=>{setSaved(old=>[...old,flight]);return true;}} onConfirm={()=>{}} onOpenTrail={()=>{}} onOpenWaves={()=>{}} onBack={()=>{}}/><pre data-testid="saved">{JSON.stringify(saved)}</pre></main>;}
