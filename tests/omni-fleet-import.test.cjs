const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports:mod.exports,require:id=>id.endsWith('.json')?JSON.parse(fs.readFileSync('src/lib/omni-fleet-snapshot.json','utf8')):load('src/lib/aircraft-registry.ts')});return mod.exports;
}
const {importOmniFleet}=load('src/lib/omni-fleet-import.ts');
test('importa 77 faltantes preservando os 11 cadastros e permite repetição sem duplicação',()=>{
 const prefixes=['PR-CGO','PR-CHT','PR-OHD','PR-OHG','PR-OHI','PR-OHJ','PR-OHK','PR-OHL','PR-OOR','PR-OOV','PR-OTH'];
 const aircraft=prefixes.map(prefix=>({prefix,model:'existente',base:'Cabo Frio',available:false,registryData:{serialNumber:'preservado'}}));
 const catalogs={aircraft,models:['existente'],bases:['Cabo Frio'],users:['preservar']};
 const result=importOmniFleet(catalogs,'0001','2026-09-09');
 assert.equal(result.aircraft.length,88);assert.equal(result.users,catalogs.users);
 for(const p of aircraft) assert.equal(result.aircraft.find(a=>a.prefix===p.prefix),p);
 const additions=result.aircraft.filter(p=>!prefixes.includes(p.prefix));assert.equal(additions.length,77);
 for(const p of additions){assert.equal(p.available,true);assert.equal(p.base,'A definir');assert.ok(p.registryData.serialNumber);assert.equal(p.registryData.reviewStatus,'pending');assert.ok(p.registryData.rabStatus);assert.ok(result.models.includes(p.model));}
 assert.ok(result.bases.includes('A definir'));assert.equal(importOmniFleet(result,'x','y'),result);
 assert.equal(catalogs.aircraft.length,11);
});
