import {elapsedAt, formatTime} from './timer.js';

export const HISTORY_PREFIX = 'html-stopwatch:history:v1:';
export const HISTORY_LIMIT = 500;

export function createHistoryEntry(state, action, time) {
  const kind = action.type === 'reset' ? 'reset'
    : action.type === 'toggle' && state.startedAt !== null ? 'pause' : null;
  const elapsedMs = Math.floor(elapsedAt(state, time));
  if (!kind || elapsedMs <= 0) return null;
  const unique = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return {
    id: `${time.toFixed(3)}-${unique}`,
    title: state.title.trim() || 'HTML Stopwatch',
    recordedAt: new Date(time).toISOString(),
    elapsedMs,
    action: kind
  };
}

export function validHistoryEntry(value) {
  return value && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 200
    && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 500
    && typeof value.recordedAt === 'string' && Number.isFinite(Date.parse(value.recordedAt))
    && Number.isSafeInteger(value.elapsedMs) && value.elapsedMs > 0
    && (value.action === 'pause' || value.action === 'reset');
}

export function formatHistoryDuration(ms) {
  return ms < 3600000 ? formatTime(ms).slice(3) : formatTime(ms);
}

export function formatHistoryDate(timestamp) {
  const date = new Date(timestamp), pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function newest(records) {
  return [...new Map(records.map(record => [record.id, record])).values()].sort((a, b) =>
    Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.id.localeCompare(a.id));
}

export function createHistoryStore({storage = () => localStorage, onError = () => {}} = {}) {
  let memory = [];
  const pending = new Map(), removed = new Set();

  function load() {
    try {
      const local = storage(), records = [];
      for (let i = 0; i < local.length; i++) {
        const key = local.key(i);
        if (!key?.startsWith(HISTORY_PREFIX)) continue;
        const raw = local.getItem(key);
        let record;
        try { record = JSON.parse(raw); } catch { continue; }
        if (validHistoryEntry(record) && key === HISTORY_PREFIX + record.id) records.push(record);
      }
      const all = newest([...records, ...pending.values()].filter(record => !removed.has(record.id)));
      memory = all.slice(0, HISTORY_LIMIT);
      return all;
    } catch { onError(); return memory; }
  }

  function remove(ids) {
    load();
    let saved = true;
    for (const id of ids) {
      pending.delete(id);
      try { storage().removeItem(HISTORY_PREFIX + id); removed.delete(id); }
      catch { saved = false; removed.add(id); onError(); }
    }
    const selected = new Set(ids);
    memory = memory.filter(record => !selected.has(record.id));
    return {type: 'remove', ids, saved};
  }

  function add(entry) {
    if (!validHistoryEntry(entry)) return null;
    const all = newest([...load(), entry]);
    // Separate keys make concurrent appends atomic even without Web Locks.
    // Prune before writing so the oldest record also frees quota for its replacement.
    const pruned = remove(all.slice(HISTORY_LIMIT).map(record => record.id));
    let saved = true;
    try { storage().setItem(HISTORY_PREFIX + entry.id, JSON.stringify(entry)); pending.delete(entry.id); }
    catch { saved = false; pending.set(entry.id, entry); onError(); }
    memory = all.slice(0, HISTORY_LIMIT);
    // A competing window may have appended after our initial read.
    const overflow = remove(load().slice(HISTORY_LIMIT).map(record => record.id));
    pruned.ids.push(...overflow.ids);
    pruned.saved = pruned.saved && overflow.saved;
    return {type: 'add', entry, saved, pruned};
  }

  // Broadcasts only update memory. They never replay user operations or write records again.
  function receive(message) {
    if (message?.type === 'add' && validHistoryEntry(message.entry)) {
      if (message.pruned) receive(message.pruned);
      if (!message.saved) pending.set(message.entry.id, message.entry);
      memory = newest([...memory, message.entry]).slice(0, HISTORY_LIMIT);
    } else if (message?.type === 'remove' && Array.isArray(message.ids)) {
      const ids = new Set(message.ids.filter(id => typeof id === 'string'));
      for (const id of ids) {
        pending.delete(id);
        if (!message.saved) removed.add(id);
      }
      memory = memory.filter(record => !ids.has(record.id));
    }
    if (message?.saved === false) onError();
  }

  return {read: () => load().slice(0, HISTORY_LIMIT), add, remove, receive,
    clear: () => remove(load().map(record => record.id))};
}
