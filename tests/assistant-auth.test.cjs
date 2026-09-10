const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

test('general assistant rejects denied sessions before reading content or calling provider',async()=>{
 const exports={};let allowed=false,checks=0,providerCalls=0,searchCalls=0,sent;
 const deps={
  'next/server':{NextResponse:Response},
  '@/lib/assistant-access':{assistantAccess:async request=>{checks++;assert.equal(request.headers.get('x-employee'),'test-user');if(!allowed)throw Error('private database error');return {employee:'test-user',history:[{message:'Tem pane aberta?',reply:'Vamos consultar.'}]};}},
  '@/lib/assistant-records':{assistantRecords:async()=>({status:'available',records:[{prefix:'PR-CHT',title:'Relato existente'}]})},
  '@/lib/assistant-conversation':{assistantConversationPolicy:'conversation policy'},
  '@/lib/technical-case':{technicalAssistantPolicy:'policy'},
  '@/lib/technical-library':{searchTechnicalLibrary:()=>{searchCalls++;return [];}}
 };
 new Function('exports','require',ts.transpileModule(fs.readFileSync('src/app/api/ai/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,name=>{assert.ok(name in deps,name);return deps[name];});
 const priorFetch=global.fetch,priorKey=process.env.OPENAI_API_KEY;
 const request=body=>new Request('http://local/api/ai',{method:'POST',headers:{'x-employee':'test-user',Authorization:'Bearer synthetic'},body});
 try{
  process.env.OPENAI_API_KEY='test-only';
  global.fetch=async(url,options)=>{providerCalls++;sent=JSON.parse(options.body);return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({reply:'Resposta simulada',proposedFlights:[]})}]}]});};
  const denied=await exports.POST(request('{invalid-json'));
  assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'no-store');
  assert.ok(!(await denied.text()).includes('private database error'));
  assert.equal(providerCalls,0);assert.equal(searchCalls,0);
  allowed=true;
  const result=await exports.POST(request(JSON.stringify({message:'E relato técnico?'})));
  assert.equal(result.status,200);assert.equal((await result.json()).reply,'Resposta simulada');
  assert.equal(providerCalls,1);assert.equal(checks,2);
  assert.equal(sent.input[1].content[0].text,'Tem pane aberta?');assert.equal(sent.input[2].role,'assistant');assert.match(sent.input.at(-1).content[0].text,/PR-CHT/);assert.equal(sent.store,false);
 }finally{global.fetch=priorFetch;if(priorKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=priorKey;}
});
