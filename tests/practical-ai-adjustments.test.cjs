const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const e={};cache.set(file,e);new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):require(n));return e;}
const approval=load('src/lib/assistant-approval.ts'),planning=load('src/lib/flight-planning-validation.ts'),scope=load('src/lib/operational-scope.ts'),context=load('src/lib/contextual-assistant.ts'),media=load('src/lib/assistant-upload-content.ts'),imports=load('src/lib/flight-import.ts');
test('approval is explicit; questions and negations never apply a pending proposal',()=>{
 for(const text of ['pode aplicar','Sim, pode aplicar.','aplique no texto','autorizo','Pode preencher os campos'])assert.equal(approval.approvesAssistantProposal(text),true,text);
 for(const text of ['está tudo certo?','não pode aplicar','pode aplicar?','ok','acho que pode aplicar depois','pode apagar tudo'])assert.equal(approval.approvesAssistantProposal(text),false,text);
 assert.equal(approval.requestsTechnicalReview('Tá tudo certo assim?','Relato técnico'),true);
 assert.equal(approval.requestsTechnicalReview('Tem relato técnico?','Mural'),false);
});
test('extended form approval preserves qualifiers for a fresh proposal and reports actual application',()=>{
 const text='Pode aplicar a redação que sugeriu aos campos, deixando a referência em branco. Sem salvar o registro.';
 assert.equal(approval.requestsAssistantFieldApplication(text),true);
 assert.equal(approval.approvesAssistantProposal(text),false,'qualifiers must not apply an old cached suggestion');
 for(const value of ['Pode aplicar quando eu revisar','Pode aplicar se eu autorizar','Pode aplicar, mas deixe eu conferir','Pode aplicar?','Não pode aplicar','Pode aplicar depois','aplique antes de eu revisar'])assert.equal(approval.requestsAssistantFieldApplication(value),false,value);
 assert.match(approval.pendingAssistantProposalReply('Pronto, deixei a redação ajustada nos campos.'),/ainda não foi aplicada/);
 assert.equal(approval.pendingAssistantProposalReply('Como a intermitência se manifesta?'),'Como a intermitência se manifesta?');
});
test('compound natural-language authorization applies a fresh correction, never an older proposal',()=>{
 for(const text of ['coloque em ingles e aplique, procure no conhecimento geral a referencia da ata e coloqe também e ja pode escrever novo texto com correções','Traduza para inglês e aplique','Corrija a descrição. Agora pode aplicar','Pode atualizar o texto, sem salvar o registro.']){
  assert.equal(approval.requestsAssistantFieldApplication(text),true,text);
  assert.equal(approval.approvesAssistantProposal(text),false,text);
 }
 for(const text of ['Traduza, mas não aplique','se estiver correto, aplique','Ele disse "pode aplicar"','Eu pedi para aplicar ontem','Pode aplicar quando eu terminar?','melhore o relato','e a referência técnica'])assert.equal(approval.requestsAssistantFieldApplication(text),false,text);
 assert.equal(approval.assistantApplicationMayPersist('aplique sem salvar'),false);
 assert.equal(approval.assistantApplicationMayPersist('pode aplicar'),true);
});
test('technical correction preserves raw observation and authority state, and includes an audit reason',()=>{
 const {technicalCorrectionPayload}=load('src/lib/assistant-technical-correction.ts');
 const original={title:'hsi miscompaire',description:'hsi miscompaire',spoken:'original',at:'2026-09-10'};
 const value={report:'report',official:'evaluation',aircraft:'evaluation',investigation:'triage',originalObservation:original};
 const fields={title:'HSI miscompare',description:'HSI miscompare observed.',tc:'',technical:{ata:'34'}};
 const payload=technicalCorrectionPayload({revision:3,title:original.title,description:original.description,value},fields,'traduza e aplique');
 assert.equal(payload.revision,3);assert.equal(payload.case.document.ata,'34');assert.equal(payload.case.originalObservation,original);
 assert.equal(payload.case.aircraft,'evaluation');assert.equal(payload.case.report,'report');assert.ok(payload.case.reason);
 assert.throws(()=>technicalCorrectionPayload({revision:3,title:'x',description:'x',value},{...fields,technical:{confirmAprs:'true'}}));
 assert.equal(value.document,undefined);
});
test('application receipts never infer persistence from a void callback',()=>{
 const {applicationResult}=load('src/lib/assistant-application.ts');
 assert.equal(applicationResult(undefined,'record').status,'pending');
 assert.equal(applicationResult(undefined,'draft').status,'draft');
 assert.equal(applicationResult({status:'saved',message:'Confirmado pelo servidor'},'record').status,'saved');
});
test('partial plan is allowed, but missing operational fields prevent confirmation',()=>{
 const flight={prefix:'PR-QAT',date:'2026-09-10',departure:'',destination:'',duration:'',fuelAmount:''};
 assert.deepEqual(planning.planningErrors(flight,[{prefix:'PR-QAT'}]),[]);
 assert.deepEqual(planning.confirmationMissing(flight),['horário de saída','destino','duração']);
 assert.ok(planning.planningErrors({...flight,date:'2026-02-30'},[{prefix:'PR-QAT'}]).length);
 assert.ok(planning.planningErrors(flight,[{prefix:'PR-QAT',available:false}]).length);
 assert.deepEqual(planning.confirmationMissing({...flight,departure:'11:00',destination:'QA',duration:1}),[]);
});
test('active base and maintenance audience exclude undefined bases and crew, newest created notice first',()=>{
 const fleet=[{prefix:'A',base:'Jacarepaguá'},{prefix:'B',base:'Macaé'},{prefix:'C',base:'A definir'}];
 assert.deepEqual(scope.aircraftAtBase(fleet,'Jacarepaguá').map(x=>x.prefix),['A']);
 assert.deepEqual(scope.aircraftAtBase(fleet,'A definir'),[]);
 for(const role of ['commander','copilot','pilot','flight_attendant'])assert.equal(scope.audienceProfile(role,'maintenance'),false);
 assert.equal(scope.audienceProfile('mechanic','maintenance'),true);
 const posts=[{id:'old',createdAt:'2026-09-09',updatedAt:'2026-09-11',pinned:true},{id:'new',createdAt:'2026-09-10'}];
 assert.deepEqual(scope.newestNotices(posts).map(p=>p.id),['new','old']);assert.equal(posts[0].id,'old');
});
test('phonetic connector resolves only a unique actual registration',()=>{
 assert.deepEqual(context.resolveDraftAircraft('programe Charlie Golf e Oscar às 11',[{prefix:'PR-CGO',model:'S92'}]).map(x=>x.prefix),['PR-CGO']);
 assert.equal(context.resolveDraftAircraft('CHT',[{prefix:'PR-CHT',model:'S92'},{prefix:'PP-CHT',model:'S92'}]).length,2);
});
test('private media supports files above 2MB, validates content and never downloads arbitrary URLs',async()=>{
 const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',ref=`storage:${owner}/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png`,bytes=Buffer.alloc(3*1024*1024);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
 const calls=[];const client={storage:{from:bucket=>({download:async p=>{calls.push([bucket,p]);return {data:new Blob([bytes]),error:null};}})}};
 const result=await media.resolveAssistantMedia(client,context.parseAssistantAttachments([{name:'large.png',data:ref}]));
 assert.equal(result[0].type,'input_image');assert.equal(calls[0][0],'assistant-inputs');assert.equal(calls[0][1],ref.slice(8));
 await assert.rejects(()=>media.resolveAssistantMedia(client,[{name:'bad',data:'storage:../../other'}]));assert.equal(calls.length,1);
 await assert.rejects(()=>media.resolveAssistantMedia({storage:{from:()=>({download:async()=>({error:{message:'denied'}})})}},[{name:'other.png',data:ref}]),/sessão/);
 await assert.rejects(()=>media.resolveAssistantMedia({storage:{from:()=>({download:async()=>({data:new Blob(['fake png']),error:null})})}},[{name:'bad.png',data:ref}]));
});
test('conversational import carries row identity and prior fields for bulk date changes',()=>{
 const row={rowId:'draft-1',prefix:'PR-QAT',date:'2026-09-09',departure:'11:00',destination:null,duration:null,fuelAmount:null,fuelUnit:null,notes:'Original'};
 const parsed=imports.parseFlightImportRequest({message:'coloque todas as datas para hj',previous:[row],history:[{message:'Leia a imagem',reply:'Um voo.'}]});
 assert.equal(parsed.previous[0].rowId,'draft-1');assert.equal(parsed.previous[0].departure,'11:00');assert.equal(parsed.history.length,1);
 assert.throws(()=>imports.parseFlightImportAnswer({reply:'ok',flights:[{...row,planningStatus:'confirmed'}]}));
});
test('technical review fetches evidence before answering; operational chat does not trigger bibliography',async()=>{
 const {runAssistantAgent}=load('src/lib/assistant-agent.ts');let searches=0,payload;
 const form={id:'report-qa',label:'Relato técnico',mode:'draft',fields:{title:{label:'Título',value:'Altímetro'},description:{label:'Descrição',value:'intermitente em voo'}}};
 const options={apiKey:'synthetic',model:'test',message:'Tá tudo certo?',media:[],history:[],actor:{employeeNumber:'QA',accessProfile:'mechanic',assignedBase:'QA',fleets:[]},context:{model:'S92'},navigationEnabled:false,signal:new AbortController().signal,form,deps:{query:async()=>{throw Error('Unexpected query');},search:async()=>{searches++;return [];},fetcher:async(_url,req)=>{payload=JSON.parse(req.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({reply:'Descreva como a indicação oscila. Não encontrei referência aplicável.',targets:[],openTarget:null,continueInTarget:false})}]}]});}}};
 await runAssistantAgent(options);assert.equal(searches,1);assert.match(payload.instructions,/completude da observação/);assert.match(payload.instructions,/jamais preencha AMM/);assert.equal(payload.store,false);
 await runAssistantAgent({...options,form:null,message:'Bom dia'});assert.equal(searches,1);
});


test('report correction distinguishes primary text, metadata and reason-only changes',()=>{
 const {technicalCorrectionChanges,verifyTechnicalCorrectionSaved}=load('src/lib/assistant-technical-correction.ts');
 const before={title:'HSI miscompare',description:'HSI miscompare',tc:'',technical:{ata:'34',reason:'Anterior'}};
 assert.deepEqual(technicalCorrectionChanges(before,{...before,technical:{ata:'34',reason:'Nova justificativa'}}),{text:false,details:false});
 assert.deepEqual(technicalCorrectionChanges(before,{...before,description:'HSI miscompare observed. ATA 34 — Navigation.'}),{text:true,details:false});
 assert.deepEqual(technicalCorrectionChanges(before,{...before,technical:{ata:'34',document:'Documento informado'}}),{text:false,details:true});
 const saved={title:before.title,data:{description:before.description},tc:'',technical_case:{document:{ata:'34'}}};
 assert.doesNotThrow(()=>verifyTechnicalCorrectionSaved(before,saved));
 assert.throws(()=>verifyTechnicalCorrectionSaved({...before,description:'HSI miscompare observed.'},saved),/não confirmou o conteúdo/);
 assert.throws(()=>verifyTechnicalCorrectionSaved({...before,technical:{ata:'22'}},saved),/não confirmou o conteúdo/);
});
