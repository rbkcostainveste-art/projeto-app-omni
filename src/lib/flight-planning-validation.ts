import {validDate,validClock} from './flight-import';
import {isScheduleValue} from './flight-destination';
type Plan={prefix:string;date:string;departure:string;destination?:string;duration:string|number;fuelAmount?:string|number};
/** Unknown fields remain empty in a plan. They must be supplied before confirmation. */
export function planningErrors(flight:Plan,aircraft:{prefix:string;available?:boolean}[]){
 const errors:string[]=[];
 if(!aircraft.some(a=>a.prefix===flight.prefix&&a.available!==false))errors.push('Selecione uma aeronave disponível');
 if(!validDate(flight.date))errors.push('Informe a data da programação');
 if(flight.departure&&!validClock(flight.departure))errors.push('Horário de saída inválido');
 if(isScheduleValue(flight.destination))errors.push('Cliente/plataforma deve identificar o destino, não um horário ou data');
 if(typeof flight.duration==='string'&&flight.duration&&!validClock(flight.duration))errors.push('Duração inválida');
 if(flight.fuelAmount!==undefined&&flight.fuelAmount!==''&&(!Number.isFinite(Number(flight.fuelAmount))||Number(flight.fuelAmount)<0))errors.push('Abastecimento inválido');
 return errors;
}
export function confirmationMissing(flight:Plan){
 return [!validDate(flight.date)&&'data',!validClock(flight.departure)&&'horário de saída',(!flight.destination?.trim()||isScheduleValue(flight.destination))&&'destino',!(typeof flight.duration==='number'?flight.duration>0:validClock(flight.duration)&&flight.duration!=='00:00')&&'duração'].filter(Boolean) as string[];
}
