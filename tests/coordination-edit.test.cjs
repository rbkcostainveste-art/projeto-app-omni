const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const lib = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/coordination-edit.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(lib);
const { flightToDraft, planFlightEdit, editableOccurrences } = lib;
const flight = {
  id: 'original', prefix: 'PR-CHT', model: 'S92', base: 'Base', date: '2026-09-05', departure: '09:00', destination: 'P-51',
  duration: 1.5, fuelAmount: 5000, fuelUnit: 'lb', commander: '02140', copilot: '0800', flightAttendant: '0900',
  fuel: 'ok', preflight: 'ok', hums: 'pending', engineStart: 'pending', shutdown: 'pending', planningStatus: 'planned',
  revision: 4, wave: 2, acknowledged: { '02140': 4 }, createdBy: '0600', updatedBy: '0600',
  recurrenceId: 'series', recurrenceLabel: 'Repetição ativa · Sex 09:00, Sáb 09:00',
};
const future = { ...flight, id: 'future', date: '2026-09-11', fuel: 'pending', preflight: 'pending', commander: '', copilot: '', flightAttendant: '' };

test('loads every field and the current weekday times', () => {
  const draft = flightToDraft(flight);
  assert.equal(draft.duration, '01:30');
  assert.equal(draft.fuelUnit, 'lb');
  assert.equal(draft.flightAttendant, '0900');
  assert.deepEqual(draft.weekdays, [5, 6]);
  assert.deepEqual(draft.weekdayTimes, { 5: '09:00', 6: '09:00' });
});
test('ordinary edit only updates the selected ID, preserving operational data', () => {
  const draft = { ...flightToDraft(flight), destination: 'P-52' };
  const operations = planFlightEdit(flight, { ...flight, destination: draft.destination }, draft, [future], [flight, future], '0600');
  assert.equal(operations.length, 1);
  assert.equal(operations[0].kind, 'update');
  assert.equal(operations[0].flight.id, flight.id);
  assert.equal(operations[0].flight.destination, 'P-52');
  assert.equal(operations[0].flight.revision, 4);
  assert.equal(operations[0].flight.fuel, 'ok');
  assert.equal(operations[0].flight.recurrenceId, 'series');
});
test('disabling recurrence keeps the selected flight and trashes future selected occurrences', () => {
  const draft = { ...flightToDraft(flight), repeat: false };
  const operations = planFlightEdit(flight, flight, draft, [future], [flight, future], '0600');
  assert.equal(operations.length, 2);
  assert.ok(operations.every((op) => op.kind === 'update'));
  assert.equal(operations[0].flight.deletedAt, undefined);
  assert.equal(operations[0].flight.recurrenceLabel, '');
  assert.ok(operations[1].flight.deletedAt);
});
test('changed weekday time retains existing IDs and preserves confirmed occurrences', () => {
  const confirmed = { ...future, id: 'confirmed', date: '2026-09-12', planningStatus: 'confirmed' };
  const draft = { ...flightToDraft(flight), weekdayTimes: { 5: '10:30', 6: '11:00' } };
  const operations = planFlightEdit(flight, flight, draft, [future], [flight, future, confirmed], '0600');
  assert.equal(operations.find((op) => op.flight.id === future.id).flight.departure, '10:30');
  assert.ok(!operations.some((op) => op.flight.date === confirmed.date));
  const created = operations.filter((op) => op.kind === 'create');
  assert.ok(created.length > 0);
  assert.ok(created.every((op) => op.flight.id !== flight.id && op.flight.fuel === 'pending' && op.flight.commander === ''));
  assert.equal(new Set(created.map((op) => op.flight.date)).size, created.length);
});
test('removed weekdays trash their planned occurrences', () => {
  const draft = { ...flightToDraft(flight), weekdays: [6] };
  const operations = planFlightEdit(flight, flight, draft, [future], [flight, future], '0600');
  assert.ok(operations.find((op) => op.flight.id === future.id).flight.deletedAt);
  assert.ok(operations.filter((op) => op.kind === 'create').every((op) => new Date(`${op.flight.date}T12:00:00`).getDay() === 6));
});
test('rescheduling leaves all future repetitions without crew and preserves the edited flight crew', () => {
  const draft = { ...flightToDraft(flight), weekdayTimes: { 5: '10:30', 6: '11:00' } };
  const operations = planFlightEdit(flight, flight, draft, [future], [flight, future], '0600');
  const edited = operations.find((op) => op.flight.id === flight.id).flight;
  assert.deepEqual([edited.commander, edited.copilot, edited.flightAttendant], ['02140', '0800', '0900']);
  const repetitions = operations.filter((op) => op.flight.id !== flight.id);
  assert.ok(repetitions.some((op) => op.kind === 'create'));
  assert.ok(repetitions.some((op) => op.kind === 'update' && op.flight.id === future.id));
  for (const { flight: repetition } of repetitions) {
    assert.deepEqual([repetition.commander, repetition.copilot, repetition.flightAttendant], ['', '', '']);
  }
});
test('legacy unselected occurrences are never deleted or duplicated', () => {
  const legacy = { ...flight, recurrenceId: undefined };
  const unselected = { ...future, recurrenceId: undefined };
  const draft = { ...flightToDraft(legacy), weekdayTimes: { 5: '10:00', 6: '09:00' } };
  const operations = planFlightEdit(legacy, legacy, draft, [], [legacy, unselected], '0600');
  assert.ok(!operations.some((op) => op.flight.id === unselected.id || op.flight.date === unselected.date));
  const unchanged = planFlightEdit(legacy, legacy, flightToDraft(legacy), [], [legacy, unselected], '0600');
  assert.equal(unchanged.length, 1);
  assert.equal(unchanged[0].flight.recurrenceId, '');
});
test('rescheduling preserves crew explicitly assigned to that individual future flight', () => {
  const assigned = { ...future, commander: '1100', copilot: '1200', flightAttendant: '1300' };
  const draft = { ...flightToDraft(flight), weekdayTimes: { 5: '10:30', 6: '11:00' } };
  const operations = planFlightEdit(flight, flight, draft, [assigned], [flight, assigned], '0600');
  const saved = operations.find((op) => op.flight.id === assigned.id).flight;
  assert.deepEqual([saved.commander, saved.copilot, saved.flightAttendant], ['1100', '1200', '1300']);
  assert.ok(operations.filter((op) => op.kind === 'create').every((op) => !op.flight.commander && !op.flight.copilot && !op.flight.flightAttendant));
});
test('only eligible future occurrences of the same series can be changed', () => {
  const ineligible = [
    { ...future, id: 'other', recurrenceId: 'other-series' },
    { ...future, id: 'confirmed', planningStatus: 'confirmed' },
    { ...future, id: 'started', actualEngineStart: '09:00' },
    { ...future, id: 'past', date: '2026-09-04' },
    { ...future, id: 'deleted', deletedAt: '2026-09-01' },
    { ...future, id: 'cancelled', cancelled: true },
  ];
  assert.deepEqual(editableOccurrences(flight, [flight, future, ...ineligible]).map((item) => item.id), ['future']);
});
