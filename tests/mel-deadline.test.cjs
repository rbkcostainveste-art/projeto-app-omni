const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const lib={};
new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/mel-deadline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(lib);
test('ANAC example category C excludes discovery day',()=>assert.equal(lib.calendarMelDeadline('2026-10-14T10:00:00Z','C',10,'UTC'),'2026-10-25T00:00:00.000Z'));
test('UTC and local discovery days can differ',()=>{
 assert.equal(lib.calendarMelDeadline('2026-09-10T01:00:00Z','B',3,'UTC'),'2026-09-14T00:00:00.000Z');
 assert.equal(lib.calendarMelDeadline('2026-09-10T01:00:00Z','B',3,'America/Sao_Paulo'),'2026-09-13T03:00:00.000Z');
});
test('category A and invalid or extended intervals are never guessed',()=>{
 for(const [category,days] of [['A',3],['B',4],['C',11],['D',121],['B',0],['B',2.5]])assert.equal(lib.calendarMelDeadline('2026-09-10T01:00:00Z',category,days,'UTC'),null);
});
test('expired deadline and remaining minutes',()=>{
 assert.match(lib.deadlineRemaining('2026-09-10T10:00:00Z',Date.parse('2026-09-10T10:00:00Z')),/vencido/);
 assert.equal(lib.deadlineRemaining('2026-09-12T16:15:00Z',Date.parse('2026-09-10T10:00:00Z')),'Faltam 2d 6h 15min');
});
