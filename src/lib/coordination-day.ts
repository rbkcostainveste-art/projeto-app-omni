const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
export function operationalDay(at:Date=new Date()){return formatter.format(at);}
export function isOnOperationalDay(value:string|undefined|null,day:string){if(!value)return false;if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value===day;const at=new Date(value);return Number.isFinite(at.getTime())&&operationalDay(at)===day;}
export function millisecondsUntilNextOperationalDay(at:Date=new Date()){const start=new Date(`${operationalDay(at)}T00:00:00-03:00`).getTime();return Math.max(1,start+86400000-at.getTime());}
