export type TechnicalRecordProposal={
 kind:'report'|'fault';
 prefix:string|null;
 title:string|null;
 description:string|null;
 tc:string|null;
 officialId:string|null;
 urgency:'routine'|'urgent'|null;
};

export type MaintenanceActionProposal={
 recordId:string|null;
 prefix:string|null;
 title:string|null;
 tc:string|null;
 category:string|null;
};

const nullableString={type:['string','null']};

export function technicalRecordProposalTool(allowDirectFault:boolean){
 return {type:'function',name:'preparar_registro_tecnico',description:'Prepara um relato técnico ou uma pane para conferência humana a partir de texto, voz, imagem ou PDF. Não salva. Para imagem de TC, extraia somente os dados visíveis e mantenha null quando algo estiver ausente.',strict:true,parameters:{type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:allowDirectFault?['report','fault']:['report']},prefix:nullableString,title:nullableString,description:nullableString,tc:nullableString,officialId:nullableString,urgency:{type:['string','null'],enum:['routine','urgent',null]}},required:['kind','prefix','title','description','tc','officialId','urgency']}};
}

export const maintenanceActionProposalTool={type:'function',name:'preparar_acao_manutencao',description:'Prepara uma ação pendente vinculada a um relato técnico existente. Não salva. Consulte maintenance antes e use o UUID interno exato do registro. Campos ausentes permanecem null.',strict:true,parameters:{type:'object',additionalProperties:false,properties:{recordId:nullableString,prefix:nullableString,title:nullableString,tc:nullableString,category:nullableString},required:['recordId','prefix','title','tc','category']}};

function optionalText(value:unknown,name:string,limit:number){
 if(value===null||value===undefined)return null;
 if(typeof value!=='string'||value.length>limit)throw Error(`${name} inválido.`);
 return value.trim()||null;
}

export function parseTechnicalRecordProposal(value:unknown,allowDirectFault:boolean):TechnicalRecordProposal{
 if(!value||typeof value!=='object')throw Error('Registro técnico inválido.');
 const row=value as Record<string,unknown>;
 if(row.kind!=='report'&&row.kind!=='fault')throw Error('Tipo de registro inválido.');
 if(row.kind==='fault'&&!allowDirectFault)throw Error('Seu perfil não pode abrir pane diretamente.');
 if(!['routine','urgent',null].includes(row.urgency as string|null))throw Error('Prioridade inválida.');
 return {kind:row.kind,prefix:optionalText(row.prefix,'Prefixo',24)?.toUpperCase()??null,title:optionalText(row.title,'Título',160),description:optionalText(row.description,'Descrição',12000),tc:optionalText(row.tc,'TC',160),officialId:optionalText(row.officialId,'Identificador oficial',160),urgency:row.urgency as 'routine'|'urgent'|null};
}

export function parseMaintenanceActionProposal(value:unknown):MaintenanceActionProposal{
 if(!value||typeof value!=='object')throw Error('Ação de manutenção inválida.');
 const row=value as Record<string,unknown>;
 const recordId=optionalText(row.recordId,'Registro',160);
 if(recordId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId))throw Error('Use o UUID interno do relato.');
 return {recordId,prefix:optionalText(row.prefix,'Prefixo',24)?.toUpperCase()??null,title:optionalText(row.title,'Título',4000),tc:optionalText(row.tc,'TC',160),category:optionalText(row.category,'Categoria',160)};
}
