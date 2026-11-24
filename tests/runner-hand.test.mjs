import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RunnerHand} from '../public/runner-hand.js';
import {GaleRunner} from '../public/game-worlds.js';

function landmarks(x,pinch=false){
  const palm=Array.from({length:21},()=>({x,y:.55}));
  palm[0].y=.72;
  palm[5].x-=.055;palm[17].x+=.055;
  palm[4]={x:x-.05,y:.42};palm[8]={x:pinch?x-.05:x+.06,y:pinch?.42:.30};
  return palm;
}
function setup(){
  const runner=new RunnerHand(), game=new GaleRunner();
  let now=0;
  function feed(x,n=1,pinched=false){
    let ready;
    for(let i=0;i<n;i++){now+=33;ready=runner.update(x===null?null:landmarks(x,pinched),now,640,480,game);if(ready)game.update(.033)}
    return ready;
  }
  return {runner,game,feed};
}
test('sets a personal center and follows small movements continuously, in mirrored directions',()=>{
  const {game,feed}=setup();
  assert.equal(feed(.68,3),false);
  assert.equal(feed(.68,8),true);
  assert.ok(Math.abs(game.visualLane)<.01);
  feed(.61,8);assert.ok(game.visualLane>.25 && game.visualLane<.55);
  feed(.44,10);assert.ok(game.visualLane>.96);
  feed(.90,15);assert.ok(game.visualLane<-.96);
  feed(.68,15);assert.ok(Math.abs(game.visualLane)<.02);
});
test('losing and finding a hand preserves steering center and never jumps on reacquisition',()=>{
  const {runner,game,feed}=setup();
  feed(.60,10);feed(.74,10);
  const center=runner.center;
  feed(null,20);assert.equal(runner.position,null);
  feed(.43,3,true);assert.equal(runner.center,center);assert.ok(game.lane>.8);assert.equal(game.jumpTime,0);
  feed(.43,2);feed(.43,3,true);assert.ok(game.lift>0);
  feed(.43,30,true);assert.equal(game.jumpTime,0);
});
test('keyboard or touch can steer from a fractional hand position',()=>{
  const {game}=setup();
  game.followHand(.35);game.steer(-1);assert.equal(game.lane,-1);
  game.steer(1);assert.equal(game.lane,0);
});
