// Native frame metrics can be unreliable while a window is being restored.
// Use absolute, bounded targets; never feed the current outer size back into itself.
export function miniWindowBounds(win,width,height=128) {
  const bounded=(value,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):min;
  const contentWidth=bounded(width,180,480), contentHeight=bounded(height,128,200);
  const frameWidth=bounded(win.outerWidth-win.innerWidth,0,80);
  const frameHeight=bounded(win.outerHeight-win.innerHeight,0,140);
  return {width:Math.ceil(contentWidth+frameWidth),height:Math.ceil(contentHeight+frameHeight)};
}
export function resizeMiniWindow(win,width,height=128) {
  if(Math.abs(win.innerWidth-width)<=4 && Math.abs(win.innerHeight-height)<=4)return;
  const bounds=miniWindowBounds(win,width,height);
  try { win.resizeTo(bounds.width,bounds.height); } catch { /* Browser policy may prevent resizing. */ }
}
