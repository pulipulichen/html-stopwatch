import {test} from 'node:test';
import assert from 'node:assert/strict';
import {miniWindowBounds,resizeMiniWindow} from '../popup.js';
test('native bounds stay finite and small even with invalid desktop frame metrics',()=>{
 for(const outerWidth of [1280,100000,Infinity,NaN]) {
  const bounds=miniWindowBounds({outerWidth,outerHeight:100000,innerWidth:180,innerHeight:128},180);
  assert.ok(bounds.width>=180 && bounds.width<=260);
  assert.equal(bounds.height,268);
 }
 assert.deepEqual(miniWindowBounds({outerWidth:1280,outerHeight:720,innerWidth:1280,innerHeight:660},180),{width:180,height:188});
});
test('correction uses an absolute target and never compounds previous sizes',()=>{
 const calls=[], win={innerWidth:1280,innerHeight:660,outerWidth:1280,outerHeight:720,resizeTo:(...args)=>calls.push(args)};
 resizeMiniWindow(win,180);resizeMiniWindow(win,180);
 assert.deepEqual(calls,[[180,188],[180,188]]);
 win.innerWidth=180;win.innerHeight=128;resizeMiniWindow(win,180);
 assert.equal(calls.length,2);
});
