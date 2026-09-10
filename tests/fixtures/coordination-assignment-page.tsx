"use client";
import {useEffect,useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PeopleManagementModal} from '../../src/components/flight-board';

// Only mounted by a temporary test route; no production data or authentication.
export default function AssignmentFixture(){
 const [open,setOpen]=useState(true),[ready,setReady]=useState(false),[selfBase,setSelfBase]=useState('Jacarepaguá'),[calls,setCalls]=useState<unknown[]>([]);
 useEffect(()=>setReady(true),[]);
 const client=useMemo(()=>{
  const people=[{employee_number:'QA-C',display_name:'Coordenação QA',access_profile:'coordination',assigned_base:'Jacarepaguá',fleets:['S92'],mission:'mission_1',work_shift:'day',avatar_data_url:''},{employee_number:'QA-M',display_name:'Mecânico QA',access_profile:'mechanic',assigned_base:'Jacarepaguá',fleets:['S92'],mission:'mission_1',work_shift:'day',avatar_data_url:''}];
  return {rpc:async(name:string,args:Record<string,unknown>={})=>{
   if(name==='get_operational_assignments')return {data:structuredClone(people),error:null};
   setCalls(previous=>[...previous,{name,...args}]);const person=people.find(p=>p.employee_number===args.p_employee_number);
   if(person){if(name==='set_user_access_context')person.access_profile=args.p_access_profile as string;person.assigned_base=args.p_assigned_base as string;person.fleets=args.p_fleets as string[];if(person.access_profile==='coordination'){person.mission='';person.work_shift='';}else if(name==='update_user_operational_assignment'){person.mission=args.p_mission as string;person.work_shift=args.p_work_shift as string;}}
   return {data:null,error:null};
  }} as unknown as SupabaseClient;
 },[]);
 return <main data-hydrated={ready}><button onClick={()=>setOpen(true)}>Abrir gestão</button><output data-testid="base">{selfBase}</output><pre className="break-all whitespace-pre-wrap" data-testid="calls">{JSON.stringify(calls)}</pre>{open?<PeopleManagementModal client={client} bases={['Jacarepaguá','Macaé','Cabo Frio']} fleetOptions={['S92','AW139']} currentUser="QA-C" canChangeRoles canGrantAppManager={false} onSelfBaseChange={setSelfBase} onAvatarChange={()=>{}} onClose={()=>setOpen(false)}/>:null}</main>;
}
