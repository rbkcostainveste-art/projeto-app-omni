export type AudiencePerson={id:string;name:string;role:string;base:string;fleets?:string[];mission?:string;workShift?:string};
export type AudienceRule={base:string;fleet:string;shift:string;mission:string;role:string;area:string};
export type ChatAudience={rules:AudienceRule[];included:string[];excluded:string[]};
export const emptyAudienceRule=():AudienceRule=>({base:"",fleet:"",shift:"",mission:"",role:"",area:""});
export function chatArea(role:string){if(role==="mechanic"||role==="maintenance_assistant"||role.startsWith("maintenance_")||role==="leader_inspector")return "maintenance";if(role==="toolroom")return "toolroom";if(role==="coordination")return "coordination";if(["commander","copilot","flight_attendant"].includes(role))return "crew";if(role==="dispatch")return "dispatch";return "other";}
export function matchesAudience(p:AudiencePerson,r:AudienceRule){return (!r.base||p.base===r.base)&&(!r.fleet||p.fleets?.includes(r.fleet))&&(!r.shift||p.workShift===r.shift)&&(!r.mission||p.mission===r.mission)&&(!r.role||p.role===r.role)&&(!r.area||chatArea(p.role)===r.area);}
export function audiencePeople(people:AudiencePerson[],audience:ChatAudience){return people.filter(p=>!audience.excluded.includes(p.id)&&(audience.included.includes(p.id)||audience.rules.some(r=>matchesAudience(p,r))));}
