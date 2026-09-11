const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),ts=require('typescript');const lib={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/maintenance-display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(lib);
test('stored category takes precedence over contradictory purpose text',()=>{const task={category:'Giro em alta',title:'Comparar com o giro em baixa anterior'};assert.equal(lib.maintenanceCategory(task.category),'Giro em alta');assert.equal(lib.maintenanceCategory('Procedimentos'),'Procedimentos');});
test('maintenance urgency sorts critical and urgent ahead of routine',()=>{assert.ok(lib.maintenancePriorityRank('critical')<lib.maintenancePriorityRank('urgent'));assert.ok(lib.maintenancePriorityRank('urgent')<lib.maintenancePriorityRank());assert.equal(lib.maintenancePriorityRank('logged'),lib.maintenancePriorityRank('urgent'));});

test('loading and acknowledging a linked activity preserves its operation category',()=>{
 const stored={category:'Voo de manutenção',title:'Verificar se normalizou',actions:[{id:'action',status:'pending'}],technicalCase:{report:'report'}};
 const displayed={...stored,...lib.wallPostHeading(stored,'Relato Técnico')};
 const saved={...displayed,actions:[{...displayed.actions[0],status:'acknowledged'}]};
 assert.equal(saved.category,'Voo de manutenção');assert.equal(saved.title,stored.title);
 assert.deepEqual(lib.wallPostHeading({category:'Pane',title:'Pane · PR-OHG',actions:[]},'Relato Técnico'),{category:'Relato Técnico',title:'Relato Técnico · PR-OHG'});
});
