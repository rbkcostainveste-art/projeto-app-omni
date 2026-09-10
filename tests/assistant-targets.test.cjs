const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(path,deps={}){const e={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,n=>{assert.ok(n in deps,n);return deps[n];});return e;}
const lib=load('src/lib/assistant-targets.ts'),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
test('model selects only authorized cards, deduplicates and cannot supply labels or links',()=>{
 const cards=[{kind:'maintenance',id,title:'PR-CHT · Altímetro',detail:'Relato técnico'}];
 const reply=lib.appendTargetLinks(`Achei.\n\n[Forjado](flight-ia://maintenance/${other})`,[{kind:'maintenance',id,title:'Forjado'},{kind:'maintenance',id},{kind:'maintenance',id:other},{kind:'release',id}],cards);
 const parsed=lib.splitTargetLinks(reply);assert.equal(parsed.text,'Achei.');assert.equal(parsed.cards.length,1);assert.equal(parsed.cards[0].id,id);assert.match(parsed.cards[0].label,/Altímetro/);assert.ok(!reply.includes('Forjado'));
 assert.equal(lib.splitTargetLinks('[URL](https://example.com)').cards.length,0);assert.equal(lib.parseTarget({kind:'maintenance',id:'../../private'}),null);
});
test('drying context fails closed, scopes mechanics to current base and preserves pending semantics',async()=>{
 const {assistantDryingContext}=load('src/lib/assistant-drying-context.ts');let role='mechanic',base='Macaé',filters=[],reads=0,error=null;
 const q={};for(const name of ['select','eq','order','limit'])q[name]=(...args)=>{filters.push([name,...args]);return q;};q.abortSignal=async()=>({data:[{id,status:'pending'}],error});
 const client={rpc:async()=>({data:{employeeNumber:'42',accessProfile:role,assignedBase:base}}),from:()=>{reads++;return q;}};
 let result=await assistantDryingContext(client,'42',new AbortController().signal);assert.equal(result.status,'available');assert.ok(filters.some(f=>f[0]==='eq'&&f[1]==='base'&&f[2]==='Macaé'));assert.ok(filters.some(f=>f[1]==='status'&&f[2]==='pending'));assert.match(result.notice,/não comprova lavagem hoje/);
 filters=[];await assistantDryingContext(client,'42',new AbortController().signal,id);assert.ok(filters.some(f=>f[1]==='id'&&f[2]===id));assert.ok(!filters.some(f=>f[1]==='status'));
 reads=0;base='';assert.equal((await assistantDryingContext(client,'42',new AbortController().signal)).status,'not_authorized');assert.equal(reads,0);
 base='Macaé';role='toolroom';assert.equal((await assistantDryingContext(client,'42',new AbortController().signal)).status,'not_authorized');assert.equal(reads,0);
 role='commander';filters=[];await assistantDryingContext(client,'42',new AbortController().signal);assert.ok(!filters.some(f=>f[1]==='base')); // Dynamic operational base stays enforced by existing RLS.
 role='mechanic';error={message:'private'};assert.equal((await assistantDryingContext(client,'42',new AbortController().signal)).status,'unavailable');
});
test('navigation revalidates access, ignores client scope and rejects absent or revoked targets',async()=>{
 let allowed=false,status='available',rows=[{id}],args;
 const route=load('src/app/api/ai/targets/route.ts',{'@/lib/assistant-queries':{},'@/lib/assistant-access':{assistantAccess:async()=>{if(!allowed)throw Error();return {client:'JWT client',employee:'42'};}},'@/lib/assistant-records':{assistantRecords:async(...a)=>{args=a;return {status,records:rows};}},'@/lib/assistant-drying-context':{assistantDryingContext:async(...a)=>{args=a;return {status,items:rows};}},'@/lib/assistant-targets':lib});
 const req=kind=>new Request(`http://localhost/api/ai/targets?kind=${kind}&id=${id}&base=Forged&role=admin`);
 assert.equal((await route.GET(req('maintenance'))).status,401);allowed=true;assert.equal((await route.GET(req('release'))).status,400);
 let result=await route.GET(req('maintenance'));assert.equal(result.status,200);assert.deepEqual((await result.json()).target,{kind:'maintenance',id});assert.equal(args[0],'JWT client');assert.equal(args[1],'42');assert.equal(args[3],id);
 status='not_authorized';assert.equal((await route.GET(req('maintenance'))).status,404);status='available';rows=[];assert.equal((await route.GET(req('drying'))).status,404);status='unavailable';assert.equal((await route.GET(req('drying'))).status,503);
});
