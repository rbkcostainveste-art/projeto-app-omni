'use client';
import {useState} from 'react';
import {CrewDashboard,type CrewFlight} from '@/components/crew-dashboard';
const noop=()=>{};
export default function Fixture(){
 const [opened,setOpened]=useState('');
 const date=new Date();const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const flights=[{id:'confirmed'},{id:'planned',planningStatus:'planned'},{id:'cancelled',cancelled:true},{id:'returned',returned:true,shutdown:'ok'},{id:'finished',actualShutdown:'12:00'},{id:'maintenance',maintenancePostId:'active',maintenanceCategory:'Voo de manutenção'},{id:'maintenance-finished',maintenancePostId:'closed',shutdown:'ok',maintenanceCategory:'Giro em baixa'},{id:'other',commander:'P2'}].map(f=>({prefix:f.id,model:'S92',base:'QA',date:day,departure:'08:00',duration:1,fuelAmount:0,fuelUnit:'L',commander:'P1',planningStatus:'confirmed',...f})) as CrewFlight[];
 return <main className="p-5"><CrewDashboard supabase={null} user="P1" base="QA" aircraft={[]} fleets={['S92']} flights={flights} requireSignature={async()=>true} onOpenTrail={f=>setOpened(f.id)} onError={noop}/><output>{opened}</output></main>;
}
