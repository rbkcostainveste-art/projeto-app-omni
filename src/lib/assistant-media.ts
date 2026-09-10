import type {AssistantAttachment} from './contextual-assistant';
export function assistantMediaContent(attachments:AssistantAttachment[]){
 let total=0;
 return attachments.map(({name,data})=>{
  const bytes=Buffer.from(data.slice(data.indexOf(',')+1),'base64');total+=bytes.length;
  const pdf=data.startsWith('data:application/pdf;');
  const valid=pdf?bytes.subarray(0,5).toString()==='%PDF-':data.startsWith('data:image/png;')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data.startsWith('data:image/jpeg;')?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:data.startsWith('data:image/webp;')&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!valid||total>2000000)throw Error('Anexo inválido ou acima de 2 MB.');
  return pdf?{type:'input_file',filename:name.endsWith('.pdf')?name:'documento.pdf',file_data:data}:{type:'input_image',image_url:data,detail:'high'};
 });
}
