import { UserRound } from "lucide-react";

export type UserDirectory=Record<string,{name:string;avatar:string}>;

export function UserAvatar({employeeNumber,directory,size="md",className=""}:{employeeNumber:string;directory:UserDirectory;size?:"xs"|"sm"|"md"|"lg";className?:string}){
  const person=directory[employeeNumber];
  const dimensions={xs:"h-5 w-5",sm:"h-7 w-7",md:"h-10 w-10",lg:"h-16 w-16"}[size];
  const icon={xs:11,sm:14,md:19,lg:27}[size];
  return <span role="img" aria-label={person?.name?`Foto de ${person.name}`:`Usuário matrícula ${employeeNumber}`} title={person?.name?`${person.name} · Mat. ${employeeNumber}`:`Mat. ${employeeNumber}`} style={person?.avatar?{backgroundImage:`url(${person.avatar})`}:undefined} className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#1268d8] bg-cover bg-center text-white ring-2 ring-white ${dimensions} ${className}`}>{person?.avatar?null:<UserRound size={icon}/>}</span>;
}
