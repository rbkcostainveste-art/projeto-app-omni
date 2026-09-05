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
