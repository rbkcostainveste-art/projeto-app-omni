export type AssignmentPerson={employeeNumber:string;displayName:string;profile:string;assignedBase:string;fleets:string[];mission:string;workShift:string};

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');

export function filterAssignmentPeople(people:AssignmentPerson[],filters:{fleet?:string;mission?:string;shift?:string;search?:string;audience?:boolean}){
 const needle=normalize(filters.search??'');
 return people.filter(person=>(filters.audience||person.profile==='mechanic'||person.profile==='maintenance_assistant')
  &&(!filters.fleet||person.fleets.includes(filters.fleet))
  &&(!filters.mission||person.mission===filters.mission)
  &&(!filters.shift||person.workShift===filters.shift)
  &&(!needle||normalize(`${person.displayName} ${person.employeeNumber}`).includes(needle)));
}
