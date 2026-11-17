import {STORAGE_KEY,now,initialState,validState,elapsedAt,transition,formatTime} from './timer.js';
import {HISTORY_PREFIX,createHistoryEntry,createHistoryStore,formatHistoryDate,formatHistoryDuration} from './history.js';
const $ = id => document.getElementById(id);
const mini = new URLSearchParams(location.search).has('mini');
document.body.classList.toggle('mini',mini);
$('popup').hidden = mini;
$('history-open').hidden = mini;
let volatileState=initialState();
let stateSaved=true;
function read() {
  if(!stateSaved)return volatileState;
  try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)); return validState(value)?value:volatileState; }
  catch { return volatileState; }
}
let state=read(), editing=false, animation=null, popup=null, installPrompt=null, statusTimeout;
function status(message) {
  $('status').textContent=message;
  clearTimeout(statusTimeout);
  statusTimeout=setTimeout(()=>$('status').textContent='',3000);
}
let historyUnavailable=false, historyChannel=null, historyRenderPending=false;
const history=createHistoryStore({onError:()=>{
  $('history-warning').hidden=false;
  if(!historyUnavailable)status('歷史紀錄無法保存，僅暫存於開啟的視窗');
  historyUnavailable=true;
}});
try {
  historyChannel=new BroadcastChannel('html-stopwatch:history:v1');
  historyChannel.onmessage=event=>{history.receive(event.data);scheduleHistoryRender();};
} catch { /* Storage events still synchronize persisted history. */ }
function publishHistory(message) {
  if(!message)return;
  try { historyChannel?.postMessage(message); } catch { /* Local history remains usable. */ }
  renderHistory();
}
function scheduleHistoryRender() {
  if(historyRenderPending)return;
  historyRenderPending=true;
  setTimeout(()=>{historyRenderPending=false;renderHistory();},0);
}
function renderHistory() {
  if(!$('history-dialog').open)return;
  const records=history.read(), list=document.createDocumentFragment();
  $('history-count').textContent=`${records.length} 筆紀錄`;
  $('history-empty').hidden=records.length>0;
  $('history-clear').disabled=records.length===0;
  for(const record of records) {
    const row=document.createElement('li'); row.className='history-entry';
    const details=document.createElement('div'); details.className='history-details';
    const title=document.createElement('div'); title.className='history-title';title.textContent=record.title;
    const date=document.createElement('time');date.dateTime=record.recordedAt;date.textContent=formatHistoryDate(record.recordedAt);
    const result=document.createElement('div');result.className='history-result';
    const duration=document.createElement('span');duration.className='history-duration';duration.textContent=formatHistoryDuration(record.elapsedMs);
    const action=document.createElement('span');action.className='history-action';action.textContent=record.action==='pause'?'暫停':'重設';
    const remove=document.createElement('button');remove.type='button';remove.textContent='刪除';
    remove.setAttribute('aria-label',`刪除紀錄：${record.title}，${date.textContent}`);
    remove.onclick=()=>withLock(()=>publishHistory(history.remove([record.id])));
    result.append(duration,action);details.append(title,date,result);row.append(details,remove);list.append(row);
  }
  $('history-list').replaceChildren(list);
}
function withLock(apply) {
  return navigator.locks ? navigator.locks.request(STORAGE_KEY,apply) : Promise.resolve(apply());
}
function marquee() {
  animation?.cancel(); animation=null;
  $('title-repeat').hidden=true;
  if(editing) return;
  const width=$('title-button').clientWidth;
  const textWidth=$('title-text').getBoundingClientRect().width;
  if(textWidth<=width || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $('title-repeat').hidden=false;
  const end=Math.max(0,textWidth-width), distance=textWidth+40;
  const travel=distance/30*1000, duration=travel+2000;
  animation=$('title-track').animate([
    {transform:'translateX(0)',offset:0},
    {transform:'translateX(0)',offset:1000/duration},
    {transform:'translateX(-'+end+'px)',offset:(1000+end/30*1000)/duration},
    {transform:'translateX(-'+end+'px)',offset:(2000+end/30*1000)/duration},
    {transform:'translateX(-'+distance+'px)',offset:1}
  ],{duration,iterations:Infinity,easing:'linear'});
}
function renderState() {
  const title=state.title || 'HTML Stopwatch';
  $('title-text').textContent=title;
  $('title-repeat').textContent=title;
  $('title-button').setAttribute('aria-label','編輯標題：'+title);
  $('toggle').textContent=state.startedAt===null?'開始':'暫停';
  requestAnimationFrame(marquee);
  renderTime();
}
function renderTime() {
  const elapsed=elapsedAt(state,now()), formatted=formatTime(elapsed);
  const [whole,fraction]=formatted.split('.');
  $('whole').textContent=whole; $('fraction').textContent='.'+fraction;
  const title=formatTime(elapsed,true)+' - '+(state.title || 'HTML Stopwatch');
  if(document.title!==title) document.title=title;
}
async function dispatch(action) {
  const apply=()=>{
    const before=read(), time=now();
    const record=createHistoryEntry(before,action,time);
    state=transition(before,action,time);
    volatileState=state;
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state));stateSaved=true; }
    catch { stateSaved=false;status('無法保存，請允許網站儲存'); }
    renderState();
    if(record)publishHistory(history.add(record));
  };
  // Serialize read/modify/write across same-origin windows when supported.
  await withLock(apply);
}
window.addEventListener('storage',event=>{
  if(event.key===STORAGE_KEY || event.key===null){stateSaved=true;state=read();renderState();}
  if(event.key===null || event.key?.startsWith(HISTORY_PREFIX))scheduleHistoryRender();
});
window.addEventListener('pageshow',()=>{state=read();renderState();renderHistory();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){state=read();renderState();renderHistory();}});
$('history-open').onclick=()=>{$('history-dialog').showModal();renderHistory();};
$('history-close').onclick=()=>$('history-dialog').close();
$('history-clear').onclick=()=>{
  if(window.confirm('確定要清除所有歷史紀錄嗎？此操作無法復原。'))withLock(()=>publishHistory(history.clear()));
};
$('toggle').onclick=()=>dispatch({type:'toggle'});
$('reset').onclick=()=>dispatch({type:'reset'});
function startEditing() {
  editing=true; animation?.cancel();
  $('title-button').hidden=true; $('title-input').hidden=false;
  $('title-input').value=state.title; $('title-input').focus(); $('title-input').select();
}
function finishEditing(save) {
  if(!editing)return;
  editing=false;
  const title=$('title-input').value.trim();
  $('title-input').hidden=true; $('title-button').hidden=false;
  if(save) dispatch({type:'title',title});
  else renderState();
}
$('title-button').onclick=startEditing;
$('title-input').addEventListener('blur',()=>finishEditing(true));
$('title-input').addEventListener('keydown',event=>{
  if(event.key==='Enter' || event.key==='Escape') {
    event.preventDefault(); event.stopPropagation();
    finishEditing(event.key==='Enter'); $('title-button').focus();
  }
});
document.addEventListener('keydown',event=>{
  if($('history-dialog').open)return;
  if(event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
  if(event.code==='Space' || event.key===' ') {
    if(event.target.closest('#history-open'))return;
    event.preventDefault();dispatch({type:'toggle'});
  }
  if(event.key==='Escape'){event.preventDefault();dispatch({type:'reset'});}
});
$('copy').onclick=async()=>{
  const text=formatTime(elapsedAt(state,now()));
  try { await navigator.clipboard.writeText(text); status('已複製'); }
  catch { status('複製失敗'); window.prompt('請複製目前時間',text); }
};
$('popup').onclick=()=>{
  if(popup && !popup.closed){popup.focus();return;}
  const url=new URL('./',location.href);url.searchParams.set('mini','1');
  popup=window.open(url.href,'html-stopwatch-mini','popup=yes,width=300,height=145,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no');
  if(!popup)status('請允許彈出式視窗');
};
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();installPrompt=event;$('install').hidden=false;
});
$('install').onclick=async()=>{
  if(!installPrompt)return;
  await installPrompt.prompt();await installPrompt.userChoice;
  installPrompt=null;$('install').hidden=true;
};
window.addEventListener('appinstalled',()=>{$('install').hidden=true;installPrompt=null;});
new ResizeObserver(marquee).observe($('title-button'));
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',marquee);
function frame(){if(!document.hidden)renderTime();requestAnimationFrame(frame);}
renderState();requestAnimationFrame(frame);
setInterval(renderTime,250);
