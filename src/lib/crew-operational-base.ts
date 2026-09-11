type Assignment={id:string;prefix:string;date:string;departure:string;commander?:string;copilot?:string;flightAttendant?:string;cancelled?:boolean;deletedAt?:string;operationStartedAt?:string;operationEndedAt?:string;actualEngineStart?:string|null;actualShutdown?:string|null;shutdown?:string;compressorDryingTaskId?:string};
export function crewOperationalBase(employee:string,flights:Assignment[],aircraft:{prefix:string;base:string}[],day:string){
 const active=(f:Assignment)=>Boolean(f.operationStartedAt||f.actualEngineStart);
 const candidates=flights.filter(f=>[f.commander,f.copilot,f.flightAttendant].includes(employee)&&!f.cancelled&&!f.deletedAt&&!f.compressorDryingTaskId&&!f.operationEndedAt&&!f.actualShutdown&&f.shutdown!=="ok"&&(active(f)||f.date>=day));
 candidates.sort((a,b)=>Number(active(b))-Number(active(a))||(active(a)?(b.operationStartedAt||b.actualEngineStart||"").localeCompare(a.operationStartedAt||a.actualEngineStart||""):`${a.date}T${a.departure}`.localeCompare(`${b.date}T${b.departure}`))||a.id.localeCompare(b.id));
 const flight=candidates[0];return {flightId:flight?.id||"",prefix:flight?.prefix||"",base:aircraft.find(a=>a.prefix===flight?.prefix)?.base||""};
}

// Drying remains part of the day's work after the flight has ended.
export function crewDryingBase(employee:string,flights:Assignment[],aircraft:{prefix:string;base:string}[],day:string,fallback=""){
 const today=flights.filter(f=>f.date===day && !f.cancelled && !f.deletedAt && !f.compressorDryingTaskId && [f.commander,f.copilot,f.flightAttendant].includes(employee));
 const current=crewOperationalBase(employee,today,aircraft,day);
 if(current.base)return current.base;
 const latest=[...today].sort((a,b)=>(b.actualShutdown||b.operationEndedAt||`${b.date}T${b.departure}`).localeCompare(a.actualShutdown||a.operationEndedAt||`${a.date}T${a.departure}`)||a.id.localeCompare(b.id))[0];
 return aircraft.find(a=>a.prefix===latest?.prefix)?.base||fallback;
}
