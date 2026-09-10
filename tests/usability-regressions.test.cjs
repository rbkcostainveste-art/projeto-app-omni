const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path');
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name));return exports;}
const {isScheduleValue}=load('src/lib/flight-destination.ts'),imports=load('src/lib/flight-import.ts'),planning=load('src/lib/flight-planning-validation.ts'),{parseFlightProposals}=load('src/lib/assistant-flight-proposals.ts');
const row={prefix:'PR-QAT',date:'2026-09-10',departure:'11:15',destination:'12:15',duration:null,fuelAmount:null,fuelUnit:null,notes:'Linha 30: saída 11:15, segundo horário 12:15'};
test('schedule cells cannot become platforms, while numeric platform identifiers remain valid',()=>{
 for(const value of ['12:15','06:30','9h15','12h','2026-09-10 12:15','10/09/2026 12:15','12:15 - 13:15','10/09/2026'])assert.equal(isScheduleValue(value),true,value);
 for(const value of ['P-66','P66','FPSO 12','Cliente 2026','Alpha 1',null,''])assert.equal(isScheduleValue(value),false,value);
});
test('import preserves ambiguous original time in notes and permits incomplete planning',()=>{
 const flight=imports.parseFlightImportAnswer({reply:'Encontrado',flights:[row]}).flights[0];assert.equal(flight.destination,null);assert.match(flight.notes,/12:15/);assert.match(flight.notes,/Linha 30/);
 const aircraft=[{prefix:'PR-QAT'}],draft=imports.importedDraftFields(flight,aircraft);assert.equal(draft.destination,'');assert.equal(draft.duration,'');assert.deepEqual(planning.planningErrors(draft,aircraft),[]);assert.ok(planning.confirmationMissing(draft).includes('destino'));
 assert.equal(imports.importedDraftFields(row,aircraft).destination,'');assert.ok(planning.planningErrors({...draft,destination:'06:30'},aircraft).length);assert.ok(planning.confirmationMissing({...draft,destination:'06:30'}).includes('destino'));
 const valid=imports.parseFlightImportAnswer({reply:'ok',flights:[{...row,destination:'P-66'}]}).flights[0];assert.equal(valid.destination,'P-66');
});
test('general AI tool refuses malformed destination so agent can correct it',()=>{
 assert.throws(()=>parseFlightProposals([{...row,base:'QA',duration:null}]),/horário ou data/);
 assert.equal(parseFlightProposals([{...row,base:'QA',destination:null}])[0].destination,null);
});
test('Enter sends once; Shift, composing, repeats and disabled states do not send',()=>{
 const {sendOnEnter}=load('src/lib/composer-keyboard.ts');let sent=0,prevented=0;
 const event=extra=>({key:'Enter',shiftKey:false,preventDefault:()=>prevented++,...extra});
 sendOnEnter(event(),()=>sent++);assert.equal(sent,1);assert.equal(prevented,1);
 for(const patch of [{shiftKey:true},{ctrlKey:true},{nativeEvent:{isComposing:true}},{nativeEvent:{keyCode:229}},{repeat:true},{key:'a'}])sendOnEnter(event(patch),()=>sent++);
 sendOnEnter(event(),()=>sent++,true);assert.equal(sent,1);
});
test('occurrences narrow by accents, compact prefix/code, period and creation order',()=>{
 const {searchOccurrences,occurrenceDay}=load('src/lib/occurrence-search.ts'),filters={query:'',prefix:'',model:'',base:'',status:'',type:'',from:'',until:''};
 const record=(id,createdAt,extra={})=>({id,createdAt,prefix:'PR-CHT',ticketCode:'PAN-PRCHT-202609-001',model:'S92',base:'QA',title:'Altímetro',description:'Intermitente em voo',tc:'TC-12',status:'open',recordType:'fault',...extra});
 const rows=[record('old','2026-09-09T14:00:00Z',{updatedAt:'2026-09-11T12:00:00Z'}),record('new','2026-09-10T14:00:00Z'),record('linked','2026-09-10T15:00:00Z'),record('self','2026-09-10T16:00:00Z'),record('other','2026-09-10T16:00:00Z',{prefix:'PR-XYZ',base:'OTHER'})],current={id:'self',links:['linked']};
 const search=patch=>searchOccurrences(rows,current,{...filters,...patch}).map(r=>r.id);
 assert.deepEqual(search({prefix:'cht',query:'altimetro intermitente',base:'QA'}),['new','old']);assert.deepEqual(search({query:'PANPRCHT202609001',prefix:'prcht',from:'2026-09-10',until:'2026-09-10'}),['new']);assert.deepEqual(search({query:'inexistente'}),[]);assert.deepEqual(search({model:'S92',base:'QA',status:'closed'}),[]);assert.equal(occurrenceDay('2026-09-10T01:00:00Z'),'2026-09-09');
});
