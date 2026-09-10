export function aircraftAtBase<T extends {base:string}>(aircraft:T[],base:string){
 return base&&base!=='A definir'?aircraft.filter(a=>a.base===base):[];
}
export function audienceProfile(profile:string,area:string){
 if(area==='general')return true;
 if(['admin','app_manager','legacy'].includes(profile))return true;
 if(area==='maintenance')return ['mechanic','maintenance_assistant','toolroom','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'].includes(profile);
 if(area==='pilots')return ['commander','copilot','pilot','flight_attendant'].includes(profile);
 return area==='coordination'&&['coordination','dispatch'].includes(profile);
}
export function newestNotices<T extends {createdAt:string;id:string}>(rows:T[]){
 return [...rows].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id.localeCompare(a.id));
}
