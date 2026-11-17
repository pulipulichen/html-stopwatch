import {STORAGE_KEY,now,initialState,validState,elapsedAt,transition,formatTime} from './timer.js';
const $ = id => document.getElementById(id);
const mini = new URLSearchParams(location.search).has('mini');
document.body.classList.toggle('mini',mini);
$('popup').hidden = mini;
let volatileState=initialState();
function read() {
  try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)); return validState(value)?value:volatileState; }
  catch { return volatileState; }
}
let state=read(), editing=false, animation=null, popup=null, installPrompt=null, statusTimeout;
function status(message) {
  $('status').textContent=message;
  clearTimeout(statusTimeout);
  statusTimeout=setTimeout(()=>$('status').textContent='',3000);
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
    state=transition(read(),action,now());
    volatileState=state;
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
    catch { status('無法保存，請允許網站儲存'); }
    renderState();
  };
  // Serialize read/modify/write across same-origin windows when supported.
  if(navigator.locks) await navigator.locks.request(STORAGE_KEY,apply);
  else apply();
}
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY || event.key===null){state=read();renderState();}});
window.addEventListener('pageshow',()=>{state=read();renderState();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){state=read();renderState();}});
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
  if(event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
  if(event.code==='Space' || event.key===' ') {event.preventDefault();dispatch({type:'toggle'});}
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
