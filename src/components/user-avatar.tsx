export type UserDirectory=Record<string,{name:string;avatar:string}>;

function initials(name:string,employeeNumber:string){
  const parts=name.trim().split(/\s+/).filter(Boolean);
  if(parts.length===1)return parts[0].slice(0,2).toLocaleUpperCase("pt-BR");
  if(parts.length>1)return `${parts[0][0]}${parts.at(-1)?.[0]??""}`.toLocaleUpperCase("pt-BR");
  return employeeNumber.slice(-2).toLocaleUpperCase("pt-BR");
}

export function UserAvatar({employeeNumber,directory,size="md",className=""}:{employeeNumber:string;directory:UserDirectory;size?:"xs"|"sm"|"md"|"lg";className?:string}){
  const person=directory[employeeNumber];
  const dimensions={xs:"h-5 w-5",sm:"h-7 w-7",md:"h-10 w-10",lg:"h-16 w-16"}[size];
  const fontSize={xs:"text-[8px]",sm:"text-[10px]",md:"text-xs",lg:"text-lg"}[size];
  return <span role="img" aria-label={person?.avatar?`Foto de ${person.name||employeeNumber}`:`Iniciais de ${person?.name||employeeNumber}`} title={person?.name?`${person.name} · Mat. ${employeeNumber}`:`Mat. ${employeeNumber}`} style={person?.avatar?{backgroundImage:`url(${person.avatar})`}:undefined} className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#1268d8] bg-cover bg-center font-black tracking-[-.02em] text-white ring-2 ring-white ${dimensions} ${fontSize} ${className}`}>{person?.avatar?null:initials(person?.name??"",employeeNumber)}</span>;
}
