// Opt-in: real configured model, synthetic observations only, no database writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
for(const file of ['.env.local','.env'])if(fs.existsSync(file))process.loadEnvFile(file);
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const e={};cache.set(file,e);new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):require(n));return e;}
const {runAssistantAgent}=load('src/lib/assistant-agent.ts'),{technicalAssistantFields}=load('src/lib/assistant-technical-fields.ts');
const samples=[
 {name:'English with ATA in main description',title:'HSI miscompare',description:'HSI miscompare',message:'coloque em ingles e aplique, procure no conhecimento geral a referencia da ata e coloqe também e ja pode escrever novo texto com correções',check(p){assert.ok(p.description);assert.match(p.description,/HSI/i);assert.match(p.description,/ATA\s*34/i);assert.notEqual(p.description,'HSI miscompare');assert.doesNotMatch(p.description,/during (?:the )?flight|tested|replaced|AMM\s*\d|FIM\s*\d/i);}},
 {name:'Translation changes the description',title:'Altímetro',description:'intermitente em voo',message:'traduza o relato para inglês e aplique',check(p){assert.match(p.description,/altimeter/i);assert.match(p.description,/intermittent/i);assert.match(p.description,/flight/i);assert.doesNotMatch(p.description,/replaced|tested|AMM\s*\d/i);}},
 {name:'Explicit metadata-only request preserves main text',title:'HSI miscompare',description:'HSI miscompare',message:'preencha apenas o campo ATA com 34, mantenha o título e a descrição como estão e aplique',check(p){assert.equal(p.technical_ata,'34');assert.ok(p.title===undefined||p.title==='HSI miscompare');assert.ok(p.description===undefined||p.description==='HSI miscompare');}},
];
(async()=>{
 assert.ok(process.env.OPENAI_API_KEY,'OPENAI_API_KEY ausente');
 const model=process.env.OPENAI_MODEL||'gpt-5.4-mini';
 for(const sample of samples){
  const form={id:'synthetic-report',label:'Relato técnico · aeronave de teste',mode:'draft',fields:{title:{label:'Título principal exibido no card',value:sample.title,maxLength:500},description:{label:'Texto principal exibido no relato; redação final no idioma solicitado',value:sample.description,maxLength:12000},...Object.fromEntries(technicalAssistantFields.map(([key,label])=>['technical_'+key,{label,value:key==='ata'&&sample.name!=='Explicit metadata-only request preserves main text'?'34':'',maxLength:12000}]))}};
  const result=await runAssistantAgent({apiKey:process.env.OPENAI_API_KEY,model,message:sample.message,media:[],history:[],actor:{employeeNumber:'QA',accessProfile:'mechanic',assignedBase:'QA',fleets:['S92']},context:{area:'Relato técnico',screen:{model:'S92'}},form,navigationEnabled:false,signal:AbortSignal.timeout(110000),deps:{query:async()=>({status:'available',complete:true,items:[],cards:[]}),search:()=>[]}});
  const patch=result.draftPatch?.values;assert.ok(patch,'Modelo não preparou os campos');sample.check(patch);
  console.log(JSON.stringify({sample:sample.name,status:'PASS',model,title:patch.title,description:patch.description,ata:patch.technical_ata}));
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
