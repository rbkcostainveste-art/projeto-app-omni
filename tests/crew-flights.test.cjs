const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const lib = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/crew-flights.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(lib);
const { groupCrewFlights } = lib;

test('cancelled flights remain visible only to assigned crew in any role', () => {
  const flights = ['commander', 'copilot', 'flightAttendant'].map((role) => ({ id: role, [role]: '02140', cancelled: true }));
  flights.push({ id: 'other', commander: '0800', cancelled: true }, { id: 'unassigned', cancelled: true });
  assert.deepEqual(groupCrewFlights(flights, '02140').cancelled.map((flight) => flight.id), ['commander', 'copilot', 'flightAttendant']);
});

test('cancelled planned and confirmed flights belong only to cancelled totals', () => {
  const flights = [
    { id: 'planned', commander: '02140', planningStatus: 'planned' },
    { id: 'confirmed', commander: '02140', planningStatus: 'confirmed' },
    { id: 'cancelled-planned', commander: '02140', planningStatus: 'planned', cancelled: true },
    { id: 'cancelled-confirmed', commander: '02140', planningStatus: 'confirmed', cancelled: true },
  ];
  const groups = groupCrewFlights(flights, '02140');
  assert.deepEqual(groups.planned.map((flight) => flight.id), ['planned']);
  assert.deepEqual(groups.confirmed.map((flight) => flight.id), ['confirmed']);
  assert.equal(groups.cancelled.length, 2);
});

test('deleted, reassigned and unassigned flights never leak into the mural', () => {
  const flight = { commander: '02140', cancelled: true };
  assert.equal(groupCrewFlights([{ ...flight, deletedAt: '2026-09-05' }], '02140').visible.length, 0);
  assert.equal(groupCrewFlights([{ ...flight, commander: '0800' }], '02140').visible.length, 0);
  assert.equal(groupCrewFlights([{ commander: '', copilot: '' }], '').visible.length, 0);
  assert.equal(groupCrewFlights([flight], ' ').visible.length, 0);
});

test('operational outcome wins over confirmation and maintenance category', () => {
  const rows = [
    {id:'finished', actualShutdown:'11:20'},
    {id:'legacy-finished', shutdown:'ok'},
    {id:'maintenance-finished', maintenancePostId:'post', shutdown:'ok'},
    {id:'return', returned:true, shutdown:'ok'},
    {id:'return-in-progress', returned:true},
    {id:'cancelled', cancelled:true, planningStatus:'planned'},
    {id:'maintenance', maintenancePostId:'post'},
    {id:'confirmed'},
  ].map(f=>({commander:'P1',planningStatus:'confirmed',...f}));
  const groups=groupCrewFlights(rows,'P1');
  assert.deepEqual(groups.finished.map(f=>f.id), ['finished','legacy-finished','maintenance-finished']);
  assert.deepEqual(groups.returned.map(f=>f.id), ['return','return-in-progress']);
  assert.deepEqual(groups.confirmed.map(f=>f.id), ['confirmed']);
  assert.deepEqual(groups.maintenance.map(f=>f.id), ['maintenance']);
  const ids=['maintenance','confirmed','planned','cancelled','returned','finished'].flatMap(k=>groups[k].map(f=>f.id));
  assert.equal(new Set(ids).size,rows.length);
  assert.equal(ids.length,rows.length);
});

 test('completed maintenance remains in finished flights while drying stays separate',()=>{
 const flights=[{id:'dry',commander:'P1',compressorDryingTaskId:'dry',operationEndedAt:'2026-09-11T12:00:00Z'},{id:'giro',commander:'P1',maintenancePostId:'post',actualShutdown:'12:00'},{id:'normal',commander:'P1',shutdown:'ok'}];
 assert.deepEqual(groupCrewFlights(flights,'P1').finished.map(f=>f.id),['giro','normal']);
 assert.equal(flights.length,3);
 });

test('drying tasks stay out of flight groups even while pending',()=>{
 const flights=[{id:'dry-pending',commander:'P1',compressorDryingTaskId:'dry',shutdown:'pending'},{id:'flight',commander:'P1',planningStatus:'confirmed'}];
 assert.deepEqual(groupCrewFlights(flights,'P1').visible.map(f=>f.id),['flight']);
 assert.equal(flights.length,2);
});
