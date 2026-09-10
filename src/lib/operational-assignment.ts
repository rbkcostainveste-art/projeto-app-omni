/** Coordination belongs to a base, but is not assigned to a fleet, mission or shift. */
export function normalizeOperationalAssignment<T extends {profile:string;fleets:string[];mission:string;workShift:string}>(value:T):T {
 return value.profile==='coordination'?{...value,fleets:[],mission:'',workShift:''}:value;
}
