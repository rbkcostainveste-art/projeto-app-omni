export type OperationEvent = { id: string; type: string; at: string; recordedAt: string; actor: string; corrections?: { at: string; actor: string; recordedAt: string }[] };
export type MaintenanceCheck = { kind: string; targetFlightId: string; execution?: { actor: string; at: string }; approval?: { actor: string; at: string; result: 'ok'|'no' } };
export type OperationData = { events: OperationEvent[]; checks: Record<string, MaintenanceCheck>; revision: number; first: boolean; previousFlightId: string|null; nextFlightId: string|null; day: string; canPilot: boolean; canSign: boolean; canExecute: boolean; closed: boolean };
export const eventLabels: Record<string,string> = { apu_on:'Ligar APU',apu_off:'Desligar APU',engine1_on:'Acionar motor 1',engine1_off:'Cortar motor 1',engine2_on:'Acionar motor 2',engine2_off:'Cortar motor 2',takeoff:'Decolar',landing:'Pousar',rotor_brake:'Aplicar freio rotor',finish:'Encerrar operação' };
export const maintenanceSigners=['mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'];
export function isS92(model:string){return model.toUpperCase().replace(/[^A-Z0-9]/g,'').includes('S92');}
export function activeEquipment(events:OperationEvent[],equipment:string){return events.filter(e=>e.type===`${equipment}_on`||e.type===`${equipment}_off`).at(-1)?.type===`${equipment}_on`;}
export function isAirborne(events:OperationEvent[]){return events.filter(e=>e.type==='takeoff'||e.type==='landing').at(-1)?.type==='takeoff';}
export function pendingEndEvents(events:OperationEvent[]){
 return [...(isAirborne(events)?['landing']:[]),...['engine1','engine2','apu'].filter(equipment=>activeEquipment(events,equipment)).map(equipment=>`${equipment}_off`)];
}
export function eventAvailable(events:OperationEvent[],type:string,model:string){
 if(events.some(e=>e.type==='finish'))return false;
 if(type.startsWith('apu_')&&!isS92(model))return false;
 const flying=isAirborne(events);
 if(type==='takeoff')return !flying&&activeEquipment(events,'engine1')&&activeEquipment(events,'engine2');
 if(type==='landing')return flying;
 if(type==='finish')return events.length>0&&!flying&&!['apu','engine1','engine2'].some(e=>activeEquipment(events,e));
 if(type==='rotor_brake')return !flying;
 const equipment=type.replace(/_(on|off)$/,'');
 if(type.endsWith('_on'))return !activeEquipment(events,equipment);
 if(type.endsWith('_off'))return activeEquipment(events,equipment)&&(!equipment.startsWith('engine')||!flying);
 return false;
}
export function operationTotals(events:OperationEvent[],equipment:string){
 let start:number|null=null;let milliseconds=0;let activations=0;
 for(const event of events){if(event.type===`${equipment}_on`){start=Date.parse(event.at);activations++;}if(event.type===`${equipment}_off`&&start!==null){milliseconds+=Math.max(0,Date.parse(event.at)-start);start=null;}}
 return {activations,minutes:Math.floor(milliseconds/60000),running:start!==null};
}
