const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const lib={};
new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/coordination-waves.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(lib);
test('waves retain planned and confirmed flights and exclude ended, cancelled, deleted and other days',()=>{
 const base={prefix:'PR-CHT',date:'2026-09-05',departure:'09:00',planningStatus:'planned'};
 const flights=[{...base,id:'planned',wave:2},{...base,id:'confirmed',wave:1,planningStatus:'confirmed'},{...base,id:'finished',shutdown:'ok'},{...base,id:'cut',actualShutdown:'10:00'},{...base,id:'ended',operationEndedAt:'2026-09-05T13:00:00Z'},{...base,id:'cancelled',cancelled:true},{...base,id:'deleted',deletedAt:'now'},{...base,id:'tomorrow',date:'2026-09-06'}];
 assert.deepEqual(lib.operationalWaves(flights,base.date).map(g=>g.items.map(f=>f.id)),[['confirmed'],['planned']]);
});
test('forty flights remain grouped and sorted without changing the source',()=>{
 const flights=Array.from({length:40},(_,i)=>({id:i,prefix:`PR-${i%10}`,date:'2026-09-05',departure:`${String(19-i%10).padStart(2,'0')}:00`,planningStatus:'planned',wave:4-Math.floor(i/10)}));
 const original=JSON.stringify(flights);const groups=lib.operationalWaves(flights,'2026-09-05');
 assert.deepEqual(groups.map(g=>g.wave),[1,2,3,4]);assert.ok(groups.every(g=>g.items.length===10&&g.items[0].departure==='10:00'));
 assert.equal(JSON.stringify(flights),original);
});

test('existing OHG copied from CHT appears in first wave without another edit',()=>{
 const base={date:'2026-09-06',planningStatus:'planned'};
 const flights=[{...base,id:'cht',prefix:'PR-CHT',departure:'08:00',wave:1,planningStatus:'confirmed'},
 {...base,id:'ohg',prefix:'PR-OHG',departure:'12:00',wave:2}];
 const groups=lib.operationalWaves(flights,base.date);
 assert.deepEqual(groups.map(g=>[g.wave,g.items.map(f=>f.id)]),[[1,['cht','ohg']]]);
 assert.equal(flights[1].wave,2);
});

test('completed flights count in aircraft sequence without being displayed',()=>{
 const base={date:'2026-09-06',planningStatus:'confirmed',prefix:'PR-CHT'};
 const groups=lib.operationalWaves([
 {...base,id:'first',departure:'08:00',wave:1,shutdown:'ok'},
 {...base,id:'second',departure:'12:00',wave:9},
 {...base,id:'other',prefix:'PR-OHG',departure:'13:00',wave:8},
 {...base,id:'cancelled',departure:'07:00',cancelled:true},
 {...base,id:'maintenance',departure:'06:00',maintenancePostId:'task'}],base.date);
 assert.deepEqual(groups.map(g=>[g.wave,g.items.map(f=>f.id)]),[[1,['other']],[2,['second']]]);
});
