export type OperationalCrewRow={
 employee_number:string;display_name:string;access_profile:string;
 fleets:string[]|null;active:boolean;assigned_base?:string|null;
};
export type MaintenanceCrewPerson={employeeNumber:string;name:string;profile:string};
const fleetKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();

// Use the operational roster, not the contact catalog (name and employee number only).
// Scheduling requires both the current registered base and fleet qualification.
export function maintenanceCrewOptions(rows:OperationalCrewRow[],model:string,base:string):MaintenanceCrewPerson[]{
 const fleet=fleetKey(model);
 return rows.filter(row=>row.active&&['commander','copilot'].includes(row.access_profile)
  &&!!base&&fleetKey(row.assigned_base??'')===fleetKey(base)&&!!fleet&&(row.fleets??[]).some(value=>fleetKey(value)===fleet))
  .map(row=>({employeeNumber:row.employee_number,name:row.display_name,profile:row.access_profile}))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.employeeNumber.localeCompare(b.employeeNumber));
}

export function crewAtBaseAndFleet<T extends {assignedBase?:string;fleets?:string[];active?:boolean}>(people:T[],base:string,model:string):T[]{
 return people.filter(p=>p.active!==false&&!!base&&!!model&&fleetKey(p.assignedBase??'')===fleetKey(base)&&(p.fleets??[]).some(f=>fleetKey(f)===fleetKey(model)));
}
