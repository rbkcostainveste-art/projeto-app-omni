import type {Draft} from '@/components/flight-coordination';
import {parseFormPatch,type AssistantFormContext} from './assistant-form';
type Person={employeeNumber:string;name:string;profile?:string};
const days=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const personLabel=(person:Person)=>`${person.name.slice(0,110)} · ${person.employeeNumber}`;
export function coordinationAssistantForm(item:Draft,planes:{prefix:string;model:string}[],people:Person[]):AssistantFormContext{
 const fields:AssistantFormContext['fields']={};
 for(const [key,label] of Object.entries({prefix:'Prefixo',date:'Data YYYY-MM-DD',departure:'Saída HH:mm',destination:'Destino / plataforma',duration:'Duração HH:mm',fuelAmount:'Quantidade de combustível informada',fuelUnit:'Unidade de combustível',spot:'Posição no pátio'}))fields[key]={label,value:String(item[key as keyof Draft]??''),maxLength:500};
 fields.prefix.options=['',...planes.map(p=>p.prefix)];fields.fuelUnit.options=['L','kg','lb'];
 for(const key of ['commander','copilot','flightAttendant'] as const){const eligible=people.filter(p=>key==='flightAttendant'?p.profile==='flight_attendant':['commander','copilot','pilot'].includes(p.profile||''));const current=people.find(p=>p.employeeNumber===item[key]);fields[key]={label:{commander:'Comandante',copilot:'Copiloto',flightAttendant:'Comissário, somente S92'}[key],value:current?personLabel(current):item[key],options:[...new Set(['',...(item[key]?[current?personLabel(current):item[key]]:[]),...eligible.map(personLabel)])]};}
 fields.repeat={label:'Repetição do voo, somente quando solicitada',value:item.repeat?'Sim':'Não',options:['Sim','Não']};
 days.forEach((day,index)=>fields[`day${index}`]={label:`Repetição ${day}: HH:mm ou vazio para não repetir nesse dia`,value:item.repeat&&item.weekdays.includes(index)?item.weekdayTimes[index]||'':'',maxLength:5});
 return {id:`coordination:${item.id}`,label:`Programação · ${item.prefix||'novo voo'}`,mode:'draft',fields};
}
export function coordinationAssistantPatch(item:Draft,planes:{prefix:string;model:string}[],people:Person[],input:Record<string,string>):Partial<Draft>{
 const values=parseFormPatch(coordinationAssistantForm(item,planes,people),input),patch:Partial<Draft>={};
 for(const key of ['prefix','date','departure','destination','duration','fuelAmount','fuelUnit','spot'] as const)if(values[key]!==undefined)Object.assign(patch,{[key]:values[key]});
 if(patch.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(patch.date)||!Number.isFinite(Date.parse(patch.date))||new Date(patch.date).toISOString().slice(0,10)!==patch.date))throw Error('Data de voo inválida.');
 for(const key of ['departure','duration'] as const)if(patch[key]!==undefined&&patch[key]!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(patch[key]!))throw Error('Informe horários no formato HH:mm.');
 if(patch.duration==='00:00')throw Error('Duração precisa ser maior que zero.');
 if(patch.fuelAmount!==undefined){const n=Number(patch.fuelAmount.replace(',','.'));if(!Number.isFinite(n)||n<0)throw Error('Combustível inválido.');patch.fuelAmount=patch.fuelAmount===''?'':String(n);}
 for(const key of ['commander','copilot','flightAttendant'] as const)if(values[key]!==undefined)patch[key]=people.find(p=>personLabel(p)===values[key])?.employeeNumber||values[key];
 const next={...item,...patch};if(next.commander&&next.commander===next.copilot)throw Error('Comandante e copiloto precisam ser pessoas diferentes.');
 if(!planes.find(p=>p.prefix===next.prefix)?.model.replace(/[^a-z0-9]/gi,'').toUpperCase().includes('S92')){if(patch.flightAttendant)throw Error('Comissário está disponível somente para S92 neste formulário.');if(patch.prefix!==undefined)patch.flightAttendant='';}
 if(values.repeat!==undefined)patch.repeat=values.repeat==='Sim';
 if(days.some((_,i)=>values[`day${i}`]!==undefined)){const times={...item.weekdayTimes},weekdays=new Set(item.weekdays);days.forEach((_,i)=>{const time=values[`day${i}`];if(time===undefined)return;if(time===''){weekdays.delete(i);delete times[i];}else {if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Horário da repetição inválido.');weekdays.add(i);times[i]=time;}});patch.weekdays=[...weekdays].sort();patch.weekdayTimes=times;}
 if(patch.repeat===false){patch.weekdays=[];patch.weekdayTimes={};}
 return patch;
}
