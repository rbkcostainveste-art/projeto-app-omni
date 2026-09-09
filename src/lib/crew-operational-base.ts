type Assignment={id:string;prefix:string;date:string;departure:string;commander?:string;copilot?:string;flightAttendant?:string;cancelled?:boolean;deletedAt?:string;operationStartedAt?:string;operationEndedAt?:string;actualEngineStart?:string|null;actualShutdown?:string|null;shutdown?:string;compressorDryingTaskId?:string};
export function crewOperationalBase(employee:string,flights:Assignment[],aircraft:{prefix:string;base:string}[],day:string){
 const active=(f:Assignment)=>Boolean(f.operationStartedAt||f.actualEngineStart);
 const candidates=flights.filter(f=>[f.commander,f.copilot,f.flightAttendant].includes(employee)&&!f.cancelled&&!f.deletedAt&&!f.compressorDryingTaskId&&!f.operationEndedAt&&!f.actualShutdown&&f.shutdown!=="ok"&&(active(f)||f.date>=day));
 candidates.sort((a,b)=>Number(active(b))-Number(active(a))||(active(a)?(b.operationStartedAt||b.actualEngineStart||"").localeCompare(a.operationStartedAt||a.actualEngineStart||""):`${a.date}T${a.departure}`.localeCompare(`${b.date}T${b.departure}`))||a.id.localeCompare(b.id));
 const flight=candidates[0];return {flightId:flight?.id||"",prefix:flight?.prefix||"",base:aircraft.find(a=>a.prefix===flight?.prefix)?.base||""};
}
