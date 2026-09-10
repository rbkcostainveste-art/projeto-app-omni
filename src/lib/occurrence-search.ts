type Occurrence={id:string;prefix:string;model:string;base:string;ticketCode:string;title:string;description:string;tc:string;status:string;recordType:string;createdAt:string};
export type OccurrenceFilters={query:string;prefix:string;model:string;base:string;status:string;type:string;from:string;until:string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const compact=(value:string)=>normalize(value).replace(/[^a-z0-9]/g,'');
export function occurrenceDay(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function searchOccurrences<T extends Occurrence>(records:T[],current:{id:string;links:string[]},filter:OccurrenceFilters){
 const tokens=normalize(filter.query).trim().split(/\s+/).filter(Boolean);
 return records.filter(record=>{
  if(record.id===current.id||current.links.includes(record.id))return false;
  if(filter.base&&record.base!==filter.base||filter.model&&record.model!==filter.model||filter.status&&record.status!==filter.status||filter.type&&record.recordType!==filter.type)return false;
  if(filter.prefix&&!compact(record.prefix).includes(compact(filter.prefix)))return false;
  const day=occurrenceDay(record.createdAt);if(filter.from&&day<filter.from||filter.until&&day>filter.until)return false;
  const content=normalize([record.prefix,record.ticketCode,record.title,record.description,record.tc,record.model].join(' '));
  return tokens.every(token=>content.includes(token)||[record.prefix,record.ticketCode,record.tc].some(value=>compact(value).includes(compact(token))));
 }).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id.localeCompare(a.id));
}
