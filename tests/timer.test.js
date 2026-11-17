import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,elapsedAt,formatTime,validState} from '../timer.js';
test('pause and resume exclude paused time without accumulating tick drift',()=>{
 let s=transition(initialState(),{type:'toggle'},1000);
 assert.equal(elapsedAt(s,2234),1234);
 s=transition(s,{type:'toggle'},2500);
 assert.equal(elapsedAt(s,9000),1500);
 s=transition(s,{type:'toggle'},10000);
 assert.equal(elapsedAt(s,10234),1734);
 s=transition(s,{type:'reset'},11000);
 assert.equal(elapsedAt(s,12000),0);assert.equal(s.startedAt,null);
});
test('millisecond and compact titles at hour boundaries',()=>{
 assert.equal(formatTime(72345),'00:01:12.345');
 assert.equal(formatTime(72345,true),'01:12');
 assert.equal(formatTime(3599999,true),'59:59');
 assert.equal(formatTime(3600000,true),'01:00:00');
 assert.equal(formatTime(3723004),'01:02:03.004');
 assert.equal(formatTime(360000000,true),'100:00:00');
});
test('title updates preserve running clock; malformed storage is rejected',()=>{
 const s=transition({elapsed:12,startedAt:100,title:''},{type:'title',title:'Meeting'},500);
 assert.deepEqual(s,{elapsed:12,startedAt:100,title:'Meeting'});
 assert.ok(validState(s));assert.ok(!validState({elapsed:-1,startedAt:null,title:''}));
 assert.ok(!validState({elapsed:0,startedAt:'broken',title:''}));
});
