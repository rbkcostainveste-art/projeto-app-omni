const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const lib={};
new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/flight-operations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(lib);
const event=(type,at='2026-09-05T10:00:00Z')=>({id:crypto.randomUUID(),type,at,actor:'02140',recordedAt:at});
test('APU is available for S92 only and repeated starts require a stop',()=>{
 assert.equal(lib.eventAvailable([],'apu_on','S-92'),true);assert.equal(lib.eventAvailable([],'apu_on','AW139'),false);
 assert.equal(lib.eventAvailable([event('apu_on')],'apu_on','S92'),false);assert.equal(lib.eventAvailable([event('apu_on')],'apu_off','S92'),true);
});
test('multiple APU uses retain counts and elapsed minutes across midnight',()=>{
 const events=[event('apu_on','2026-09-06T02:55:00Z'),event('apu_off','2026-09-06T03:05:00Z'),event('apu_on','2026-09-06T03:10:00Z'),event('apu_off','2026-09-06T03:15:00Z')];
 assert.deepEqual(lib.operationTotals(events,'apu'),{activations:2,minutes:15,running:false});
});
test('takeoff, landing and finishing keep distinct states',()=>{
 const events=[event('engine1_on'),event('engine2_on')];assert.equal(lib.isAirborne(events),false);assert.equal(lib.eventAvailable(events,'takeoff','S92'),true);
 events.push(event('takeoff'));assert.equal(lib.isAirborne(events),true);assert.equal(lib.eventAvailable(events,'finish','S92'),false);assert.equal(lib.eventAvailable(events,'landing','S92'),true);
 events.push(event('landing'),event('engine1_off'),event('engine2_off'));assert.equal(lib.eventAvailable(events,'finish','S92'),true);
 events.push(event('finish'));assert.equal(lib.eventAvailable(events,'engine1_on','S92'),false);
});
test('maintenance signers never include auxiliary, pilots or administrative profiles',()=>{
 for(const role of ['maintenance_assistant','commander','copilot','admin','app_manager','legacy','coordination','toolroom'])assert.equal(lib.maintenanceSigners.includes(role),false);
 assert.equal(lib.maintenanceSigners.includes('mechanic'),true);assert.equal(lib.maintenanceSigners.includes('maintenance_inspector'),true);
});
test('closing guides the pilot through missing records without assuming cuts or landing',()=>{
 const events=[event('apu_on'),event('engine1_on'),event('engine2_on'),event('takeoff')];
 assert.deepEqual(lib.pendingEndEvents(events),['landing','engine1_off','engine2_off','apu_off']);
 events.push(event('landing'),event('rotor_brake'));
 assert.deepEqual(lib.pendingEndEvents(events),['engine1_off','engine2_off','apu_off']);
 assert.equal(lib.eventAvailable(events,'finish','S92'),false);
 events.push(event('engine1_off'),event('engine2_off'),event('apu_off'));
 assert.deepEqual(lib.pendingEndEvents(events),[]);
 assert.equal(lib.eventAvailable(events,'finish','S92'),true);
});
