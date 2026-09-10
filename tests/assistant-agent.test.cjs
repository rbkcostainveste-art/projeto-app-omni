const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const e={};cache.set(file,e);new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):require(n));return e;}
const queries=load('src/lib/assistant-queries.ts'),selectors=load('src/lib/wall-selectors.ts'),agent=load('src/lib/assistant-agent.ts');
const actor={employeeNumber:'42',accessProfile:'mechanic',assignedBase:'Macaé',fleets:['S92']};
const args=(dataset,extra={})=>({dataset,query:null,prefix:null,base:null,from:null,until:null,status:'all',mine:false,offset:0,id:null,...extra});
const at='2026-09-09T20:00:00Z';
test('opening a historical card revalidates its current access and blocks revoked records',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 for(const allowed of [true,false]){
  let turn=0,reads=0;
  const result=await agent.runAssistantAgent({apiKey:'test',model:'test',message:'abre esse relato',media:[],history:[{message:'tem relato do cht?',reply:`Sim.\n\n[PR-CHT](flight-ia://maintenance/${id})`}],actor,context:{},navigationEnabled:true,signal:new AbortController().signal,deps:{query:async q=>{reads++;assert.equal(q.id,id);assert.equal(q.dataset,'maintenance');assert.equal(q.status,'all');return {status:'available',items:[],complete:true,cards:allowed?[{kind:'maintenance',id,title:'PR-CHT',detail:'Macaé'}]:[]};},search:()=>[],fetcher:async()=>Response.json({status:'completed',output:turn++===0?[{type:'function_call',name:'abrir_registro',call_id:'open',arguments:JSON.stringify({kind:'maintenance',id})}]:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:allowed?'Abrindo o relato.':'Registro indisponível.',targets:[]})}]}]})}});
  assert.equal(reads,1);assert.deepEqual(result.navigation,allowed?{kind:'maintenance',id}:null);
 }
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
