export const STORAGE_KEY = 'html-stopwatch:v1';
export const now = () => performance.timeOrigin + performance.now();
export const initialState = () => ({elapsed:0, startedAt:null, title:''});
export function validState(value) {
  return value && Number.isFinite(value.elapsed) && value.elapsed >= 0
    && (value.startedAt === null || (Number.isFinite(value.startedAt) && value.startedAt >= 0))
    && typeof value.title === 'string' && value.title.length <= 500;
}
export function elapsedAt(state, time) {
  return Math.max(0, state.elapsed + (state.startedAt === null ? 0 : Math.max(0, time - state.startedAt)));
}
export function transition(state, action, time) {
  if(action.type === 'toggle') return state.startedAt === null
    ? {...state, startedAt:time} : {...state, elapsed:elapsedAt(state,time), startedAt:null};
  if(action.type === 'reset') return {...state, elapsed:0, startedAt:null};
  if(action.type === 'title') return {...state, title:action.title.slice(0,500)};
  return state;
}
export function formatTime(ms, compact=false) {
  const total = Math.floor(Math.max(0,ms));
  const seconds = Math.floor(total/1000);
  const h = Math.floor(seconds/3600);
  const m = Math.floor(seconds/60)%60;
  const s = seconds%60;
  const pad = n => String(n).padStart(2,'0');
  const clock = (compact && h===0 ? '' : pad(h)+':')+pad(m)+':'+pad(s);
  return compact ? clock : clock+'.'+String(total%1000).padStart(3,'0');
}
