export type AssistantFormField={label:string;value:string;options?:string[];maxLength?:number};
export type AssistantFormContext={id:string;label:string;mode:'draft'|'record';fields:Record<string,AssistantFormField>};
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
  fields[key]={label:field.label,value:field.value,maxLength,...(field.options?{options:field.options}:{})};
 }
 return {id:f.id,label:f.label,mode:f.mode,fields};
}
export function formTool(form:AssistantFormContext){
 return {type:'function',name:'preparar_campos',description:`Prepara campos de ${form.label}. Não salva nada. Use null para manter um campo, string vazia para limpar apenas a pedido. Extraia só fatos fornecidos. Não invente valores/medições/execuções. Em modo record, o usuário aplica as mudanças depois de revisar.`,strict:true,parameters:{type:'object',properties:Object.fromEntries(Object.entries(form.fields).map(([key,f])=>[key,{type:['string','null'],description:f.label,...(f.options?{enum:[...new Set(f.options),null]}:{})}])),required:Object.keys(form.fields),additionalProperties:false}};
}
export function parseFormPatch(form:AssistantFormContext,value:unknown):Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Campos inválidos.');
 const patch:Record<string,string>={};
 for(const [key,v] of Object.entries(value)){
  if(!Object.hasOwn(form.fields,key))throw Error('Campo não permitido.');
  if(v===null)continue;
  const field=form.fields[key];
  if(typeof v!=='string'||v.length>(field.maxLength||4000)||field.options&&!field.options.includes(v))throw Error('Valor inválido.');
  patch[key]=v;
 }
 return patch;
}
export function formSnapshot(form:AssistantFormContext){return JSON.stringify(Object.entries(form.fields).map(([key,f])=>[key,f.value]));}
