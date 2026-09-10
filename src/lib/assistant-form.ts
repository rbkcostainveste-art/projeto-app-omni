export type AssistantFormField={label:string;value:string;options?:string[];maxLength?:number;multiple?:boolean};
export type AssistantFormContext={id:string;label:string;mode:'draft'|'record';revision?:number;fields:Record<string,AssistantFormField>};
export function parseAssistantForm(value:unknown):AssistantFormContext|null{
 if(value===undefined||value===null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw Error('Formulário inválido.');
 const f=value as AssistantFormContext;
 if(typeof f.id!=='string'||f.id.length>160||typeof f.label!=='string'||f.label.length>120||!['draft','record'].includes(f.mode)||!f.fields||typeof f.fields!=='object'||Array.isArray(f.fields)||Object.keys(f.fields).length>40)throw Error('Formulário inválido.');
 const fields:Record<string,AssistantFormField>={};
 for(const [key,field] of Object.entries(f.fields)){
  if(!/^[a-zA-Z][a-zA-Z0-9_]{0,60}$/.test(key)||['constructor','prototype','__proto__'].includes(key)||!field||typeof field.label!=='string'||field.label.length>180||typeof field.value!=='string'||field.value.length>12000)throw Error('Campo inválido.');
  const maxLength=typeof field.maxLength==='number'&&Number.isInteger(field.maxLength)?Math.max(1,Math.min(12000,field.maxLength)):4000;
  if(field.options&&(!Array.isArray(field.options)||field.options.length>400||field.options.some(x=>typeof x!=='string'||x.length>160)))throw Error('Opções inválidas.');
  if(field.multiple!==undefined&&typeof field.multiple!=='boolean'||field.multiple&&!field.options?.length)throw Error('Seleção múltipla inválida.');
  fields[key]={label:field.label,value:field.value,maxLength,...(field.options?{options:field.options}:{}),...(field.multiple?{multiple:true}:{})};
 }
 if(f.revision!==undefined&&(!Number.isSafeInteger(f.revision)||f.revision<0))throw Error('Versão inválida.');
 return {id:f.id,label:f.label,mode:f.mode,...(f.revision!==undefined?{revision:f.revision}:{}),fields};
}
export function formTool(form:AssistantFormContext){
 return {type:'function',name:'preparar_campos',description:`Prepara campos de ${form.label}. Não salva nada. Use null para manter um campo, string vazia ou lista vazia para limpar apenas a pedido. Na seleção múltipla retorne a lista final, preservando seleções anteriores salvo remoção solicitada. Extraia só fatos fornecidos. Não invente valores/medições/execuções. Em modo record, o usuário aplica as mudanças depois de revisar.`,strict:true,parameters:{type:'object',properties:Object.fromEntries(Object.entries(form.fields).map(([key,f])=>[key,f.multiple?{type:['array','null'],description:f.label,items:{type:'string',enum:[...new Set(f.options)]},maxItems:100}:{type:['string','null'],description:f.label,...(f.options?{enum:[...new Set(f.options),null]}:{})}])),required:Object.keys(form.fields),additionalProperties:false}};
}
export function parseFormPatch(form:AssistantFormContext,value:unknown):Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Campos inválidos.');
 const patch:Record<string,string>={};
 for(const [key,v] of Object.entries(value)){
  if(!Object.hasOwn(form.fields,key))throw Error('Campo não permitido.');
  if(v===null)continue;
  const field=form.fields[key];
  if(field.multiple){const selected=typeof v==='string'?JSON.parse(v):v;if(!Array.isArray(selected)||selected.length>100||selected.some(item=>typeof item!=='string'||!field.options?.includes(item)))throw Error('Seleção inválida.');const encoded=JSON.stringify([...new Set(selected)]);if(encoded.length>(field.maxLength||4000))throw Error('Seleção acima do limite.');patch[key]=encoded;continue;}
  if(typeof v!=='string'||v.length>(field.maxLength||4000)||field.options&&!field.options.includes(v))throw Error('Valor inválido.');
  patch[key]=v;
 }
 return patch;
}
export function formSnapshot(form:AssistantFormContext){return JSON.stringify({id:form.id,revision:form.revision,fields:Object.entries(form.fields).map(([key,f])=>[key,f.value])});}
