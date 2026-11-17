import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, transition} from '../timer.js';
import {HISTORY_PREFIX, HISTORY_LIMIT, createHistoryEntry, createHistoryStore,
  formatHistoryDate, formatHistoryDuration} from '../history.js';

function storage() {
  const data = new Map();
  return {get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)};
}
const entry = (index, overrides = {}) => ({id: `record-${index}`,
  title: 'Meeting', recordedAt: new Date(1700000000000 + index * 1000).toISOString(),
  elapsedMs: 72123, action: 'pause', ...overrides});

test('pause and reset snapshot the same pre-reset duration; start/resume/zero do not record', () => {
  const start = 1700000000000;
  let state = {...initialState(), title: 'Meeting'};
  assert.equal(createHistoryEntry(state, {type: 'toggle'}, start), null);
  state = transition(state, {type: 'toggle'}, start);
  const pause = createHistoryEntry(state, {type: 'toggle'}, start + 72123.9);
  assert.equal(pause.elapsedMs, 72123);
  assert.equal(pause.action, 'pause');
  state = transition(state, {type: 'toggle'}, start + 72123.9);
  const reset = createHistoryEntry(state, {type: 'reset'}, start + 80000);
  assert.equal(reset.elapsedMs, pause.elapsedMs);
  assert.equal(reset.action, 'reset');
  assert.notEqual(reset.id, pause.id);
  state.title = 'Changed';
  assert.equal(pause.title, 'Meeting');
  assert.equal(createHistoryEntry(state, {type: 'toggle'}, start + 90000), null);
  assert.equal(createHistoryEntry(state, {type: 'title'}, start + 90000), null);
  state = transition(state, {type: 'reset'}, start + 90000);
  assert.equal(createHistoryEntry(state, {type: 'reset'}, start + 100000), null);
  assert.equal(createHistoryEntry({elapsed: 1, startedAt: null, title: '  '},
    {type: 'reset'}, start).title, 'HTML Stopwatch');
});

test('duration keeps milliseconds and dates use the local timezone', () => {
  assert.equal(formatHistoryDuration(72123), '01:12.123');
  assert.equal(formatHistoryDuration(3599999), '59:59.999');
  assert.equal(formatHistoryDuration(3600000), '01:00:00.000');
  assert.equal(formatHistoryDuration(360000004), '100:00:00.004');
  const local = new Date(2026, 10, 17, 8, 41, 2);
  assert.equal(formatHistoryDate(local.toISOString()), '2026-11-17 08:41:02');
});

test('independent windows persist, remove and clear only application history', () => {
  const local = storage(), a = createHistoryStore({storage: () => local}),
    b = createHistoryStore({storage: () => local});
  local.setItem('another-app', 'keep');
  a.add(entry(1)); b.add(entry(2));
  assert.deepEqual(a.read().map(record => record.id), ['record-2', 'record-1']);
  assert.equal(createHistoryStore({storage: () => local}).read().length, 2);
  b.remove(['record-1']);
  assert.deepEqual(a.read().map(record => record.id), ['record-2']);
  a.clear();
  assert.deepEqual(b.read(), []);
  assert.equal(local.getItem('another-app'), 'keep');
});

test('a concurrent append between read and write is retained without Web Locks', () => {
  const local = storage(), other = createHistoryStore({storage: () => local});
  const original = local.setItem;
  local.setItem = (key, value) => {
    if (key === HISTORY_PREFIX + 'record-2') other.add(entry(3));
    original(key, value);
  };
  const store = createHistoryStore({storage: () => local});
  store.add(entry(1)); store.add(entry(2));
  assert.deepEqual(store.read().map(record => record.id), ['record-3', 'record-2', 'record-1']);
});

test('retain exactly the newest 500, including a competing append at capacity', () => {
  const local = storage();
  for (let i = 0; i < HISTORY_LIMIT; i++) local.setItem(HISTORY_PREFIX + entry(i).id, JSON.stringify(entry(i)));
  const original = local.setItem;
  let competed = false;
  local.setItem = (key, value) => {
    if (!competed) { competed = true; original(HISTORY_PREFIX + entry(501).id, JSON.stringify(entry(501))); }
    original(key, value);
  };
  const store = createHistoryStore({storage: () => local});
  store.add(entry(500));
  assert.equal(local.length, HISTORY_LIMIT);
  assert.equal(store.read()[0].id, 'record-501');
  assert.equal(store.read().at(-1).id, 'record-2');
});

test('malformed records, mismatched IDs and invalid fields cannot break valid history', () => {
  const local = storage(), store = createHistoryStore({storage: () => local});
  local.setItem(HISTORY_PREFIX + 'broken', '{');
  for (const [index, overrides] of [{elapsedMs: -1}, {title: 1}, {action: 'start'},
    {recordedAt: 'invalid'}, {elapsedMs: 1.5}, {id: 'mismatch'}].entries()) {
    local.setItem(HISTORY_PREFIX + `record-${index}`, JSON.stringify(entry(index, overrides)));
  }
  store.add(entry(100));
  assert.deepEqual(store.read().map(record => record.id), ['record-100']);
});

test('blocked storage retains volatile records and broadcasts without duplicate writes', () => {
  const blocked = () => { throw new Error('Storage blocked'); };
  let errors = 0;
  const a = createHistoryStore({storage: blocked, onError: () => errors++}),
    b = createHistoryStore({storage: blocked});
  const message = a.add(entry(1));
  b.receive(message); b.receive(message);
  assert.equal(b.read().length, 1);
  a.receive(b.remove(['record-1']));
  assert.equal(a.read().length, 0);
  a.add(entry(2)); a.clear();
  assert.equal(a.read().length, 0);
  assert.ok(errors > 0);
});

test('quota failures preserve saved and unsaved records until explicitly deleted', () => {
  const local = storage();
  local.setItem(HISTORY_PREFIX + 'record-1', JSON.stringify(entry(1)));
  local.setItem = () => { throw new Error('Quota exceeded'); };
  const a = createHistoryStore({storage: () => local}), b = createHistoryStore({storage: () => local});
  const message = a.add(entry(2)); b.receive(message);
  assert.equal(a.read().length, 2);
  assert.equal(b.read().length, 2);
  a.receive(b.clear());
  assert.deepEqual(a.read(), []);
  assert.deepEqual(b.read(), []);
});
