const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const lib = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/drying-visibility.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(lib);

test('pending drying survives midnight and subsequent days', () => {
  for (const day of ['2026-09-05', '2026-09-06', '2026-10-01']) {
    assert.equal(lib.dryingVisibleToday({ status: 'pending', completed_at: null }, day), true);
  }
});

test('completed drying disappears at the next Brazilian midnight', () => {
  const task = { status: 'completed', completed_at: '2026-09-06T02:59:59Z' };
  assert.equal(lib.dryingVisibleToday(task, '2026-09-05'), true);
  assert.equal(lib.dryingVisibleToday(task, '2026-09-06'), false);
});

test('completion after midnight belongs to the new day regardless of wash date', () => {
  const task = { status: 'completed', completed_at: '2026-09-06T03:00:01Z' };
  assert.equal(lib.dryingVisibleToday(task, '2026-09-05'), false);
  assert.equal(lib.dryingVisibleToday(task, '2026-09-06'), true);
  assert.equal(lib.dryingVisibleToday(task, '2026-09-07'), false);
  assert.equal(lib.dryingDay(new Date(task.completed_at)), '2026-09-06');
  assert.equal(lib.dryingDayStart('2026-09-06'), '2026-09-06T03:00:00.000Z');
});

test('invalid completion timestamps are not displayed as completed today', () => {
  for (const completed_at of [null, 'invalid']) {
    assert.equal(lib.dryingVisibleToday({ status: 'completed', completed_at }, '2026-09-06'), false);
  }
});
