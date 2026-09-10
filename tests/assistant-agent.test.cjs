const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const e={};cache.set(file,e);new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):require(n));return e;}
const queries=load('src/lib/assistant-queries.ts'),selectors=load('src/lib/wall-selectors.ts'),agent=load('src/lib/assistant-agent.ts');
const actor={employeeNumber:'42',accessProfile:'mechanic',assignedBase:'Macaé',fleets:['S92']};
const args=(dataset,extra={})=>({dataset,query:null,prefix:null,base:null,from:null,until:null,status:'all',mine:false,offset:0,id:null,...extra});
const at='2026-09-09T20:00:00Z';

test('multiple-choice form tools accept only catalog entries and survive the server/client round trip',()=>{
 const helper=load('src/lib/assistant-form.ts'),form=helper.parseAssistantForm({id:'tools',label:'Ferramentas',mode:'draft',fields:{tools:{label:'Seleção',value:'[]',options:['Chave 10','Chave 12'],multiple:true}}});
 assert.deepEqual(helper.formTool(form).parameters.properties.tools.type,['array','null']);
 const patch=helper.parseFormPatch(form,{tools:['Chave 10','Chave 12','Chave 10']});assert.equal(patch.tools,'["Chave 10","Chave 12"]');assert.deepEqual(helper.parseFormPatch(form,patch),patch);assert.throws(()=>helper.parseFormPatch(form,{tools:['Chave 99']}));assert.throws(()=>helper.parseFormPatch(form,{tools:'not json'}));assert.equal(helper.parseFormPatch(form,{tools:[]}).tools,'[]');
});

test('coordination fields resolve named crew, validate recurrence and reject invented assignments',()=>{
 const helper=load('src/lib/assistant-coordination.ts'),item={id:'f1',prefix:'PR-CHT',date:'2026-09-10',departure:'08:00',destination:'',duration:'01:30',fuelAmount:'0',fuelUnit:'L',commander:'',copilot:'',flightAttendant:'',repeat:false,weekdays:[],weekdayTimes:{}};
 const planes=[{prefix:'PR-CHT',model:'S92'},{prefix:'PR-ABC',model:'AW139'}],people=[{employeeNumber:'42',name:'Carlos',profile:'commander'},{employeeNumber:'43',name:'Ana',profile:'copilot'}];
 const patch=helper.coordinationAssistantPatch(item,planes,people,{commander:'Carlos · 42',copilot:'Ana · 43',repeat:'Sim',day1:'08:30',day3:'09:00',fuelAmount:'12,5'});
 assert.equal(patch.commander,'42');assert.equal(patch.copilot,'43');assert.deepEqual(patch.weekdays,[1,3]);assert.equal(patch.weekdayTimes[3],'09:00');assert.equal(patch.fuelAmount,'12.5');
 assert.equal(helper.coordinationAssistantPatch(item,planes,people,{departure:''}).departure,'');
 for(const bad of [{date:'2026-02-30'},{departure:'25:00'},{commander:'Inventado'},{commander:'Carlos · 42',copilot:'Carlos · 42'},{day1:'amanhã'}])assert.throws(()=>helper.coordinationAssistantPatch(item,planes,people,bad));
});

test('notes use personal identity, keep attachments out of the model and do not substitute denial with empty data',async()=>{
 let denied=false;const c={rpc:(name,p)=>{assert.equal(name,'personal_note');assert.equal(p.p_payload.employee,'42');return {abortSignal:async()=>({error:denied?Error('denied'):null,data:[{id:'11111111-1111-4111-8111-111111111111',title:'Meu lembrete',body:'Conferir escala',prefix:'PR-CHT',updated_at:at,remind_at:null,attachments:[{url:'private-secret'}]}]})};}};
 const result=await queries.assistantQuery(c,actor,args('notes'),new AbortController().signal);assert.equal(result.items.length,1);assert.equal(result.cards[0].kind,'note');assert.equal(JSON.stringify(result).includes('private-secret'),false);
 denied=true;assert.equal((await queries.assistantQuery(c,actor,args('notes'),new AbortController().signal)).complete,false);
});

test('incomplete washing evidence cannot omit its coverage limitation from the final answer',async()=>{
 let step=0;const result=await agent.runAssistantAgent({apiKey:'test',model:'test',message:'quais foram lavados hoje?',media:[],history:[],actor,context:{},navigationEnabled:false,signal:new AbortController().signal,deps:{query:async()=>({status:'available',items:[],cards:[],complete:false}),search:()=>[],fetcher:async()=>Response.json({status:'completed',output:step++===0?[{type:'function_call',call_id:'wash',name:'consultar_app',arguments:JSON.stringify(args('washing',{status:'open'}))}]:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Não encontrei registros.',targets:[],openTarget:null})}]}]})}});
 assert.match(result.reply,/não cobre todo esse período/);assert.match(result.reply,/não confirma a lista completa/);
});

test('Cockpit queries use authorized RPC, redact undeclared/media fields and preserve flight calendar dates',async()=>{
 const row={id:'duty:42:2026-09-10',kind:'preparation',subject:'42',created_by:'42',flight_id:'f1',data:{flightNumber:'101',secret:'never',mediaJson:'private file',plannedFuel:100},revision:1,updated_at:at};let denied=false;
 const c={rpc:(name,p)=>{assert.equal(name,'cockpit');assert.equal(p.p_action,'list');return {abortSignal:async()=>({data:[row],error:denied?Error('denied'):null})};},from:()=>({select:()=>({eq:()=>({abortSignal:()=>({maybeSingle:async()=>({data:{flights:[{id:'f1',date:'2026-09-10',prefix:'PR-CHT',base:'Macaé',sensitive:'never'}]},error:null})})})})})};
 const result=await queries.assistantQuery(c,actor,args('cockpit',{mine:true,from:'2026-09-10',prefix:'CHT'}),new AbortController().signal);
 assert.equal(result.items.length,1);assert.equal(result.items[0].date,'2026-09-10');assert.equal(result.items[0].fields.plannedFuel,100);assert.equal(JSON.stringify(result).includes('never'),false);assert.equal(JSON.stringify(result).includes('private file'),false);assert.equal(result.cards[0].kind,'cockpit');
 const targets=load('src/lib/assistant-targets.ts');assert.equal(targets.splitTargetLinks(`[Jornada](flight-ia://cockpit/${row.id})`).cards[0].id,row.id);assert.equal(queries.validateQuery(args('cockpit',{id:row.id})).id,row.id);
 denied=true;assert.equal((await queries.assistantQuery(c,actor,args('cockpit'),new AbortController().signal)).status,'unavailable');
});

test('passage patch preserves untouched checks, records explicit quantities and requires real wash confirmation',()=>{
 const helper=load('src/lib/assistant-passage.ts');const item={id:'p1',prefix:'PR-CHT',revision:3,updatedAt:at,checks:{compressorWash:'pending',hums:'no',discrepancy:'no'},actions:{},notes:'Anterior',discrepancyDetails:''};const labels={compressorWash:'Compressores lavados',hums:'HUMS',discrepancy:'Caso técnico'};
 const form=helper.passageAssistantForm(item,labels);assert.equal(form.mode,'record');assert.equal(form.fields.hums.value,'Não');
 const result=helper.passageAssistantPatch(item,labels,{compressorWash:'Sim',engine1Amount:'0,5',engine1Unit:'L'},'42',at);
 assert.deepEqual(result.washes,['compressorWash']);assert.equal(result.next.checks.hums,'no');assert.equal(result.next.notes,'Anterior');assert.deepEqual(result.next.oilAdditions.engine1,{amount:0.5,unit:'L'});assert.equal(result.next.actions.compressorWash.employeeNumber,'42');assert.equal(item.checks.compressorWash,'pending');
 assert.deepEqual(helper.passageAssistantPatch(result.next,labels,{compressorWash:'Sim'},'42',at).washes,[]);
 assert.throws(()=>helper.passageAssistantPatch(item,labels,{engine1Amount:'-2'},'42',at));assert.throws(()=>helper.passageAssistantPatch(item,labels,{dryingRun:'Sim'},'42',at));assert.throws(()=>helper.passageAssistantPatch(item,labels,{discrepancyDetails:'Vazamento'},'42',at));
 assert.equal(helper.passageAssistantPatch(item,labels,{discrepancy:'Sim',discrepancyDetails:'Vazamento'},'42',at).next.discrepancyDetails,'Vazamento');
});

test('wash queries preserve coverage, cycle cards and database authorization errors',async()=>{
 const id='11111111-1111-4111-8111-111111111111';let fail=false,parameters;
 const c={rpc:(name,p)=>{assert.equal(name,'assistant_wash_read');parameters=p;return {abortSignal:async()=>({error:fail?Error('denied'):null,data:{status:'available',items:[{prefix:'PR-CHT',base:'Macaé',dryingTaskId:id},{prefix:'PR-CHT',base:'Macaé',dryingTaskId:id}],complete:false,coverageStartsAt:at}})};}};
 const q=args('washing',{query:'S92',from:'2026-09-09',until:'2026-09-09',status:'open'});
 assert.equal(queries.validateQuery(q).dataset,'washing');
 const result=await queries.assistantQuery(c,actor,q,new AbortController().signal);
 assert.equal(result.complete,false);assert.equal(result.cards.length,1);assert.equal(result.coverageStartsAt,at);assert.equal(parameters.p_model,'S92');assert.equal(parameters.p_employee,'42');assert.equal(parameters.p_timezone,'America/Sao_Paulo');assert.equal(parameters.p_status,'open');
 fail=true;const denied=await queries.assistantQuery(c,actor,q,new AbortController().signal);assert.equal(denied.status,'unavailable');assert.equal(denied.complete,false);assert.deepEqual(denied.items,[]);
});

test('passage identifiers retain text IDs without allowing path traversal',()=>{
 const targets=load('src/lib/assistant-targets.ts');
 assert.deepEqual(targets.parseTarget({kind:'passage',id:'PR-CHT-2026-09-10'}),{kind:'passage',id:'PR-CHT-2026-09-10'});
 assert.equal(queries.validateQuery(args('passage',{id:'PR-CHT-2026-09-10'})).id,'PR-CHT-2026-09-10');
 assert.equal(targets.parseTarget({kind:'passage',id:'../secret'}),null);assert.throws(()=>queries.validateQuery(args('passage',{id:'../secret'})));
});
test('Cockpit drafts cover every declared kind without exposing signature or derived fields',()=>{
 const helper=load('src/lib/assistant-cockpit.ts'),cockpit=load('src/lib/cockpit.ts');
 for(const kind of Object.keys(cockpit.cockpitFields)){
  const entry={id:'entry1',kind,flight_id:null,revision:2,data:{}};
  const form=helper.cockpitAssistantForm(entry,{},[{prefix:'PR-CHT'}]);
  assert.ok(Object.keys(form.fields).length>0);assert.equal(form.revision,2);assert.equal(form.mode,'draft');
  for(const field of ['acknowledgment','preparedAt','maintenanceId','externalStatus','elapsedMinutes'])assert.equal(form.fields[field],undefined);
  assert.throws(()=>helper.cockpitAssistantPatch(form,entry,{acknowledgment:'signed'}));
 }
 const entry={id:'entry1',kind:'duty',revision:0,flight_id:null,data:{}},form=helper.cockpitAssistantForm(entry,{},[]);
 assert.deepEqual(helper.cockpitAssistantPatch(form,entry,{flightMinutes:'90',presentation:'2026-09-09T07:30:00-03:00'}),{flightMinutes:'90',presentation:'2026-09-09T07:30:00-03:00'});
 assert.throws(()=>helper.cockpitAssistantPatch(form,entry,{flightMinutes:'-2'}));assert.throws(()=>helper.cockpitAssistantPatch(form,entry,{presentation:'07:30'}));assert.throws(()=>helper.cockpitAssistantPatch(form,entry,{date:'2026-02-30'}));
 const occurrence={...entry,kind:'occurrence',flight_id:'flight1'};assert.equal(helper.cockpitAssistantForm(occurrence,{},[{prefix:'PR-CHT'}]).fields.prefix,undefined);
});
test('opening a historical card revalidates its current access and blocks revoked records',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 for(const allowed of [true,false]){
  let reads=0;
  const result=await agent.runAssistantAgent({apiKey:'test',model:'test',message:'abre esse relato',media:[],history:[{message:'tem relato do cht?',reply:`Sim.\n\n[PR-CHT](flight-ia://maintenance/${id})`}],actor,context:{},navigationEnabled:true,signal:new AbortController().signal,deps:{query:async q=>{reads++;assert.equal(q.id,id);assert.equal(q.dataset,'maintenance');assert.equal(q.status,'all');return {status:'available',items:[],complete:true,cards:allowed?[{kind:'maintenance',id,title:'PR-CHT',detail:'Macaé'}]:[]};},search:()=>[],fetcher:async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Abrindo o relato.',targets:[],openTarget:{kind:'maintenance',id}})}]}]})}});
  assert.equal(reads,1);assert.deepEqual(result.navigation,allowed?{kind:'maintenance',id}:null);
 }
});

test('open-and-fill forwards the original request only after current authorization succeeds',async()=>{
 const id='11111111-1111-4111-8111-111111111111',message='Abra o relato CHT e ajuste o título';
 for(const allowed of [true,false]){const result=await agent.runAssistantAgent({apiKey:'test',model:'test',message,media:[],history:[{message:'qual relato?',reply:`Sim.\n\n[CHT](flight-ia://maintenance/${id})`}],actor,context:{},navigationEnabled:true,signal:new AbortController().signal,deps:{query:async()=>({status:'available',items:[],complete:true,cards:allowed?[{kind:'maintenance',id,title:'CHT',detail:'Relato'}]:[]}),search:()=>[],fetcher:async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Abrindo.',targets:[],openTarget:{kind:'maintenance',id},continueInTarget:true})}]}]})}});assert.equal(result.continuation,allowed?message:undefined);}
});
test('calendar filters reject impossible dates rather than silently shifting the query',()=>{
 assert.throws(()=>queries.validateQuery(args('timeline',{from:'2026-02-30'})));
 assert.throws(()=>queries.validateQuery(args('timeline',{from:'2026-13-01'})));
 assert.equal(queries.validateQuery(args('timeline',{from:'2024-02-29'})).from,'2024-02-29');
});
function post(id,overrides={}){return {id,base:'Macaé',audienceArea:'maintenance',title:'Atividade de manutenção',body:'Inspeção visual',category:'Manutenção',createdBy:'99',createdAt:at,updatedAt:at,resolved:false,actions:[],history:[{event:'Criou atividade',at,employeeNumber:'99'}],comments:[],views:[],attachments:[],...overrides};}
function action(id,assignedTo,status='pending'){return {id,assignedTo,status,title:'Verificar luz',description:'Luz apagada',prefix:'PR-CHT',createdAt:at,executions:[],views:[],acknowledgements:[]};}
function client(posts,{error=null}={}){const filters=[];const q={};for(const name of ['select','order','limit','eq','in','gte','lte'])q[name]=(...a)=>{filters.push([name,...a]);return q;};q.abortSignal=async()=>({error,data:posts.map(p=>({id:p.id,base:p.base,audience_area:p.audienceArea,resolved:p.resolved,revision:1,created_at:p.createdAt,updated_at:p.updatedAt,data:p}))});return {filters,from:()=>q};}
test('timeline shares screen event rules and local date; open report is not automatically a timeline event',()=>{
 const posts=[post('task',{maintenanceRecordId:'report',actions:[action('a','42')]}),post('notice',{category:'Avisos'}),post('valid'),post('previous',{history:[{event:'Criou',at:'2026-09-09T01:00:00Z',employeeNumber:'42'}]})];
 assert.deepEqual(selectors.wallTimeline(posts,'2026-09-09','2026-09-09','America/Sao_Paulo').map(p=>p.id),['valid']);
 assert.equal(selectors.calendarDay('2026-09-10T01:00:00Z','America/Sao_Paulo'),'2026-09-09');
});
test('my pending assignments exclude other people, completed tasks and unrelated reports',async()=>{
 const c=client([post('one',{actions:[action('a','42'),action('b','142'),action('c','42','resolved')]}),post('report')]);
 const result=await queries.assistantQuery(c,actor,args('assignments',{mine:true,status:'open'}),new AbortController().signal);
 assert.deepEqual(result.items.map(r=>r.actionId),['a']);assert.equal(result.cards[0].kind,'activity');assert.equal(result.complete,true);
 assert.ok(c.filters.some(f=>f[0]==='in'&&f[1]==='base'&&f[2][0]==='Macaé'));
});
test('assignment matching supports explicit employee and teams without matching partial employee numbers',()=>{
 assert.equal(selectors.assignedToEmployee('Mat. 142','42',[]),false);assert.equal(selectors.assignedToEmployee('Mat. 42','42',[]),true);assert.equal(selectors.assignedToEmployee('Equipe S92','42',['S92']),true);
});
test('forged base and absent base fail closed before querying',async()=>{
 const c={from:()=>{throw Error('must not query');}};
 assert.equal((await queries.assistantQuery(c,actor,args('assignments',{base:'Outra'}),new AbortController().signal)).status,'not_authorized');
 assert.equal((await queries.assistantQuery(c,{...actor,assignedBase:''},args('timeline'),new AbortController().signal)).status,'not_authorized');
});
test('private recipient posts do not reach model; errors differ from empty and partial',async()=>{
 const signal=new AbortController().signal;
 let result=await queries.assistantQuery(client([post('private',{audienceRecipients:['99']})]),actor,args('notices'),signal);assert.equal(result.items.length,0);assert.equal(result.complete,true);
 result=await queries.assistantQuery(client([],{error:{message:'secret'}}),actor,args('assignments'),signal);assert.equal(result.status,'unavailable');assert.equal(result.complete,false);
 result=await queries.assistantQuery(client(Array.from({length:501},(_,i)=>post(String(i)))),actor,args('timeline',{from:'2026-09-09',until:'2026-09-09'}),signal);assert.equal(result.complete,false);assert.match(result.notice,/500/);
});
test('query validation rejects unknown tools, invalid ranges and malformed filters',()=>{
 for(const value of [args('sql'),args('assignments',{offset:-1}),args('timeline',{from:'yesterday'}),args('timeline',{from:'2026-09-10',until:'2026-09-09'}),args('timeline',{mine:'42'})])assert.throws(()=>queries.validateQuery(value));
});
test('agent executes chosen dataset only, keeps follow-up history, strips invented cards and never loads unrelated drying',async()=>{
 const sent=[],called=[];
 const result=await agent.runAssistantAgent({apiKey:'test',model:'test',message:'E as minhas?',media:[],history:[{message:'Atividades',reply:'Vamos consultar.'}],actor,context:{area:'Atividades'},navigationEnabled:true,signal:new AbortController().signal,deps:{search:()=>{throw Error('unrelated');},query:async q=>{called.push(q.dataset);return {status:'available',complete:true,items:[{title:'Verificar luz'}],cards:[{kind:'activity',id:'post_1',title:'Verificar luz',detail:'Macaé'}]};},fetcher:async(url,options)=>{const body=JSON.parse(options.body);sent.push(body);return Response.json({status:'completed',output:sent.length===1?[{type:'function_call',name:'consultar_app',call_id:'call1',arguments:JSON.stringify(args('assignments',{mine:true,status:'open'}))}]:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Você tem uma atividade pendente.',targets:[{kind:'activity',id:'post_1'},{kind:'activity',id:'forged'}]})}]}]});}}});
 assert.deepEqual(called,['assignments']);assert.match(result.reply,/post_1/);assert.ok(!result.reply.includes('forged'));assert.equal(sent[0].input[0].content,'Atividades');assert.ok(sent[1].input.some(i=>i.type==='function_call_output'));assert.equal(sent[0].store,false);
});
test('conversation without operational question need not query and unsupported actions cannot execute',async()=>{
 let calls=0;
 const result=await agent.runAssistantAgent({apiKey:'test',model:'test',message:'Bom dia',media:[],history:[],actor,context:{},navigationEnabled:false,signal:new AbortController().signal,deps:{query:async()=>{calls++;throw Error();},search:()=>[],fetcher:async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Bom dia!',targets:[]})}]}]})}});
 assert.equal(calls,0);assert.equal(result.reply,'Bom dia!');
});
test('form schemas reject unknown fields, invented choices and oversized values',()=>{
 const f=load('src/lib/assistant-form.ts');const form=f.parseAssistantForm({id:'draft1',label:'Atividade',mode:'draft',fields:{prefix:{label:'Prefixo',value:'',options:['','PR-CHT']},title:{label:'Título',value:'',maxLength:10}}});
 assert.deepEqual(f.parseFormPatch(form,{prefix:'PR-CHT',title:null}),{prefix:'PR-CHT'});
 assert.throws(()=>f.parseFormPatch(form,{prefix:'PR-XXX'}));assert.throws(()=>f.parseFormPatch(form,{approved:true}));assert.throws(()=>f.parseFormPatch(form,{title:'x'.repeat(11)}));
 assert.equal(f.formSnapshot(form),f.formSnapshot(structuredClone(form)));assert.notEqual(f.formSnapshot(form),f.formSnapshot({...form,fields:{...form.fields,title:{...form.fields.title,value:'manual'}}}));
});
test('form tool prepares only validated fields and does not execute a database write',async()=>{
 let turn=0;const form={id:'draft1',label:'Nova atividade',mode:'draft',fields:{title:{label:'Título',value:'',maxLength:100}}};
 const result=await agent.runAssistantAgent({apiKey:'test',model:'test',message:'verificar luz',media:[],history:[],actor,context:{},form,navigationEnabled:false,signal:new AbortController().signal,deps:{query:async()=>{throw Error('No database read needed');},search:()=>[],fetcher:async()=>Response.json({status:'completed',output:turn++===0?[{type:'function_call',name:'preparar_campos',call_id:'draft',arguments:JSON.stringify({title:'Verificar luz'})}]:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'Preparei os campos.',targets:[]})}]}]})}});
 assert.deepEqual(result.draftPatch,{id:'draft1',values:{title:'Verificar luz'}});assert.deepEqual(result.trace,[{tool:'preparar_campos',status:'prepared'}]);
});
test('operational fleet and flight queries enforce base before exposing shared state',async()=>{
 const q={select(){return this;},eq(){return this;},abortSignal(){return this;},async maybeSingle(){return {data:{catalogs:{aircraft:[{prefix:'PR-CHT',model:'S92',base:'Macaé'},{prefix:'PR-XYZ',model:'S92',base:'Outra'}]},flights:[{id:'f1',prefix:'PR-CHT',model:'S92',base:'Macaé',date:'2026-09-09',departure:'10:00'},{id:'f2',prefix:'PR-XYZ',model:'S92',base:'Outra',date:'2026-09-09',departure:'11:00'}]}};}};
 const c={from:()=>q},signal=new AbortController().signal;
 assert.deepEqual((await queries.assistantQuery(c,actor,args('fleet'),signal)).items.map(r=>r.prefix),['PR-CHT']);
 assert.deepEqual((await queries.assistantQuery(c,actor,args('flights'),signal)).items.map(r=>r.id),['f1']);
 assert.equal((await queries.assistantQuery(c,actor,args('flights',{base:'Outra'}),signal)).status,'not_authorized');
});
