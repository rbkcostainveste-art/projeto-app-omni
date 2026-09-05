const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(`src/lib/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,()=>load('comment-attention'));return exports;}
const lib=load('maintenance-edit-read');
test('read applies to one user, later correction becomes unread again',()=>{
 const edit='2026-09-05T15:00:00Z',later='2026-09-05T16:00:00Z';
 assert.equal(lib.unreadMaintenanceEdit(edit,{edit_at:edit}),false);
 assert.equal(lib.unreadMaintenanceEdit(edit,undefined),true);
 assert.equal(lib.unreadMaintenanceEdit(later,{edit_at:edit}),true);
 assert.equal(lib.unreadMaintenanceEdit(edit,{content_at:later}),false);
 assert.equal(lib.unreadMaintenanceEdit(undefined,undefined),false);
});
test('reading safe purpose does not hide an unread technical result',()=>{
 const post={createdAt:'2026-09-05T12:00:00Z',actions:[{editedAt:'2026-09-05T15:00:00Z',executions:[{at:'2026-09-05T14:00:00Z'}]}]};
 assert.equal(lib.latestUnreadMaintenanceUpdate(post,'2026-09-05T13:00:00Z',()=>false).kind,'Novo resultado');
 assert.equal(lib.latestUnreadMaintenanceUpdate(post,'2026-09-05T14:00:00Z',()=>false),undefined);
 assert.equal(lib.latestUnreadMaintenanceUpdate(post,'2026-09-05T14:00:00Z',()=>true).kind,'Alteração');
});
test('position uppercases pasted text with accents without losing punctuation',()=>{
 assert.equal(lib.positionValue('pátio a-12 / posição 3'),'PÁTIO A-12 / POSIÇÃO 3');assert.equal(lib.positionValue(''),'');
});
