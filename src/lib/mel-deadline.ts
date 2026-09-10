export function calendarMelDeadline(discoveredAt:string, category:string, days:number, timeZone:string) {
 const cap=({B:3,C:10,D:120} as Record<string,number>)[category];
 if(!cap||!Number.isInteger(days)||days<1||days>cap||!Number.isFinite(Date.parse(discoveredAt)))return null;
 try {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(discoveredAt));
  const n=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
  const midnight=Date.UTC(n('year'),n('month')-1,n('day')+days+1);
  let result=midnight;
  for(let i=0;i<3;i++){
   const offset=new Intl.DateTimeFormat('en-US',{timeZone,timeZoneName:'longOffset'}).formatToParts(new Date(result)).find(p=>p.type==='timeZoneName')?.value||'GMT';
   const match=offset.match(/GMT([+-])(\d{2}):(\d{2})/);
   result=midnight-(match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]))*60000:0);
  }
  return new Date(result).toISOString();
 }catch{return null;}
}
export function deadlineRemaining(deadline:string,now=Date.now()){
 const left=Date.parse(deadline)-now;
 if(!Number.isFinite(left))return 'Prazo não informado';
 if(left<=0)return 'Prazo vencido · reavaliar';
 const minutes=Math.ceil(left/60000);return `Faltam ${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h ${minutes%60}min`;
}
