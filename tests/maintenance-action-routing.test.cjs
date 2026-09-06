const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const lib={};
new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/maintenance-action-routing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(lib);
test('only the four flight and ground-run categories create independent flights',()=>{assert.deepEqual(lib.availableMaintenanceCategories('AW139').filter(lib.createsMaintenanceFlight),['Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção']);});
test('S92 excludes CT disk but keeps product washing',()=>{for(const model of ['S92','S-92','S 92']){assert.ok(!lib.availableMaintenanceCategories(model).includes('Lavagem da CT disk'));assert.ok(lib.availableMaintenanceCategories(model).includes('Lavagem com produto'));}});
test('optional washes need a matching aircraft/base request, preserving confirmed history',()=>{const item={prefix:'PR-CGO',base:'Jacarepaguá',model:'AW139',checks:{}};const request={prefix:'PR-CGO',base:'Jacarepaguá',key:'ctDiskWash'};assert.deepEqual(lib.visibleWashKeys(item,[]),[]);assert.deepEqual(lib.visibleWashKeys(item,[request]),['ctDiskWash']);assert.deepEqual(lib.visibleWashKeys(item,[{...request,prefix:'PR-CHT'}]),[]);assert.deepEqual(lib.visibleWashKeys(item,[{...request,base:'Outra'}]),[]);assert.deepEqual(lib.visibleWashKeys({...item,checks:{productWash:'yes'}},[]),['productWash']);});
