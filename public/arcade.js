import {RunnerHand} from './runner-hand.js';
import {clamp} from './gestures.js';
import {OrbitBlaster,GaleRunner} from './game-worlds.js';
const $=id=>document.getElementById(id);
const games={
  orbit:{name:'Orbit Blaster',world:OrbitBlaster,intro:'Hit as many orbiting targets as you can in 30 seconds.',help:'Point to aim and pinch thumb and index to fire. You can also tap a target, or aim with the arrow keys and fire with Space.'},
  gale:{name:'Gale Runner',world:GaleRunner,intro:'Run the windfarm boardwalk. Jump striped gates and switch lanes around tall crates.',help:'Hold one hand comfortably to set the center. Move it sideways and the runner follows. Pinch thumb and index to jump. You can also swipe, use the on-screen buttons, or press ← / → to steer and ↑ or Space to jump.'}
};

export class GameHand {
  reset(){this.held=false;this.frames=0;this.ready=false;this.x=null;this.y=null;this.lastSeen=-Infinity}
  update(points,time,w,h,game){
    if(!points){if(time-this.lastSeen>250)this.reset();return 'Show one hand to play'}
    if(time-this.lastSeen>250)this.reset();
    const dt=this.x===null?1:clamp((time-this.lastSeen)/1000,.001,.15);
    this.lastSeen=time;
    const distance=(a,b)=>Math.hypot((points[a].x-points[b].x)*w,(points[a].y-points[b].y)*h);
    const ratio=distance(4,8)/Math.max(1,distance(0,9));
    if(ratio>.43){this.held=false;this.frames=0;this.ready=true}
    const pressed=this.ready&&!this.held&&ratio<.28;
    this.frames=pressed?this.frames+1:0;
    const fire=this.frames>=2;
    if(fire)this.held=true;
    if(ratio>.32 || this.x===null){
      const tx=clamp((.88-points[8].x)/.76,0,1)*800;
      const ty=clamp((points[8].y-.14)/.70,0,1)*450;
      const a=1-Math.exp(-27*dt);
      this.x=this.x===null?tx:this.x+(tx-this.x)*a;
      this.y=this.y===null?ty:this.y+(ty-this.y)*a;
      game.point(this.x,this.y);
    }
    if(fire)game.fire();
    return 'Hand tracked';
  }
}
export function createArcade({camera,cancelCameraStart,resetPointer}){
  const dialog=$('arcade'),screen=$('game-screen'),ctx=screen.getContext('2d'),overlay=$('game-overlay');
  const hand=new GameHand();hand.reset();
  const video=$('video'), feed=$('runner-feed');
  const videoHome=video.parentNode, videoNext=video.nextSibling;
  function syncFeed(){
    const active=key==='gale'&&handRun&&['playing','tracking'].includes(phase);
    feed.hidden=!active;
    if(active && video.parentNode!==feed)feed.append(video);
    else if(!active && video.parentNode===feed)videoHome.insertBefore(video,videoNext);
    else return;
    if(video.srcObject && video.paused)video.play().catch(()=>{});
  }
  let game,key,phase='closed',frame=0,last=0,touch=null,returnTo=null;
  const runner=new RunnerHand();
  let handRun=false,startedCameraHere=false;
  let camState='Camera off',handStatus='';const held=new Set();
  function cameraLabel(){
    const label=camState==='Camera live'?(handStatus||'Camera ready'):camState;
    if($('game-input').textContent!==label)$('game-input').textContent=label;
    $('game-camera').textContent=camState==='Camera live'?'Turn camera off':camState==='Paused'?'Resume camera':'Enable camera';
    $('game-camera').disabled=camState==='Starting';
  }
  function state(label,description){
    camState=label;hand.reset();handStatus='';
    cameraLabel();
    if(key==='gale' && handRun && phase!=='closed'){
      if(label==='Camera live' && phase==='tracking')trackingMessage();
      if((label==='Camera off'||label==='Paused') && ['tracking','playing'].includes(phase)){
        handRun=false;show('paused');
        $('round-message').textContent=description||'Camera stopped. Choose how to resume.';
      }
    }
    if(description)$('game-input').textContent=description;
  }
  function hud(){
    const score=key==='gale'?game.score+' m':game.score+' pts';
    if($('game-score').textContent!==score)$('game-score').textContent=score;
    if($('game-time').textContent!==game.metric)$('game-time').textContent=game.metric;
  }
  function tick(time){
    if(phase!=='playing')return;
    if(handRun && key==='gale' && runner.lastSeen!==null && time-runner.lastSeen>600){
      runner.lost();show('tracking');return;
    }
    const dt=clamp((time-last)/1000,0,.06);last=time;
    if(key==='orbit' && held.size){
      const dx=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft'));
      const dy=Number(held.has('ArrowDown'))-Number(held.has('ArrowUp'));
      if(dx||dy)game.point(game.aim.x+dx*420*dt,game.aim.y+dy*420*dt);
    }
    game.update(dt);game.draw(ctx);hud();
    if(game.over){show('over');return}
    frame=requestAnimationFrame(tick);
  }
  function show(next){
    cancelAnimationFrame(frame);phase=next;syncFeed();held.clear();touch=null;hand.reset();resetPointer();
    const isRunner=key==='gale';
    $('runner-manual').hidden=!isRunner || next==='playing';
    $('hand-steering').hidden=!isRunner || !handRun || !['tracking','playing'].includes(next);
    $('game-pause').hidden=next!=='playing';
    $('runner-buttons').hidden=key!=='gale'||next!=='playing';
    overlay.hidden=next==='playing';
    if(next==='playing'){
      handStatus='';cameraLabel();last=performance.now();screen.focus({preventScroll:true});frame=requestAnimationFrame(tick);return;
    }
    if(next==='tracking'){
      cursorOff();$('round-action').hidden=true;trackingMessage();
      return;
    }
    $('round-action').hidden=false;
    const labels={ready:['Ready to play?',games[key].intro,'Start game'],paused:['Paused','Resume when you’re ready.','Resume'],over:[key==='gale'?'Run complete':'Time’s up!',game.result,'Play again']};
    const [title,message,action]=labels[next];
    $('round-title').textContent=title;$('round-message').textContent=message;$('round-action').textContent=isRunner?(next==='paused'?'Resume with hand':'Play with hand'):action;
    $('round-action').focus({preventScroll:true});
  }
  function cursorOff(){$('cursor').hidden=true}
  function steering(text,position){
    if($('steer-status').textContent!==text)$('steer-status').textContent=text;
    $('hand-steering').style.setProperty('--steer',((position+1)*50).toFixed(1)+'%');
  }
  function trackingMessage(){
    const live=camState==='Camera live';
    $('round-title').textContent=live?'Show one hand':'Starting camera';
    $('round-message').textContent=live
      ? (runner.center===null?'Hold your hand still for a moment. This sets your center.':'Bring your hand back into view to resume.')
      :'Allow camera access in your browser. The run starts when your hand is detected.';
    steering(live?'Looking for hand':'Waiting for camera',runner.position??0);
  }
  function startHand(){
    if(phase==='over')game=new games.gale.world();
    runner.reset();handRun=true;show('tracking');
    if(camState!=='Camera live' && camState!=='Starting'){
      startedCameraHere=camState==='Camera off';camera(camState);
    }
  }
  function manual(){
    if(phase==='over')game=new games.gale.world();
    handRun=false;
    if(startedCameraHere && camState==='Starting')cancelCameraStart();
    startedCameraHere=false;
    hud();show('playing');
  }
  function close(){
    cancelAnimationFrame(frame);phase='closed';handRun=false;syncFeed();if(startedCameraHere && camState==='Starting')cancelCameraStart();startedCameraHere=false;held.clear();touch=null;hand.reset();resetPointer();
    const pointer=$('cursor');pointer.hidden=true;document.body.append(pointer);
    if(dialog.open)dialog.close();
    returnTo?.focus({preventScroll:true});
  }
  for(const card of document.querySelectorAll('[data-game]')){
    const id=card.dataset.game,preview=new games[id].world(()=>.46);
    if(id==='gale'){preview.items=[{lane:-1,z:.78,kind:'gate'},{lane:1,z:.62,kind:'crate'}];preview.time=2.2}
    preview.draw(card.querySelector('canvas').getContext('2d'));
    card.onclick=()=>{
      returnTo=card;key=id;handRun=false;runner.reset();game=new games[key].world();
      $('game-title').textContent=games[key].name;$('game-help').textContent=games[key].help;
      dialog.showModal();dialog.append($('cursor'));handStatus='';cameraLabel();game.draw(ctx);hud();show('ready');
    };
  }
  $('runner-manual').onclick=manual;
  $('round-action').onclick=()=>{if(key==='gale'){startHand();return}if(phase==='over')game=new games[key].world();hud();show('playing')};
  $('game-pause').onclick=()=>show('paused');$('game-close').onclick=close;
  $('game-camera').onclick=()=>{
    if(key==='gale'&&camState!=='Camera live'){startHand();return}
    if(phase==='playing')show('paused');
    camera(camState);
  };
  dialog.oncancel=e=>{e.preventDefault();close()};
  function run(action){
    if(phase!=='playing'||key!=='gale')return;
    if(action==='jump')game.jump();else game.steer(action==='left'?-1:1);
  }
  for(const button of $('runner-buttons').querySelectorAll('button'))button.onclick=()=>run(button.dataset.action);
  function local(e){const r=screen.getBoundingClientRect();return [(e.clientX-r.left)*800/r.width,(e.clientY-r.top)*450/r.height]}
  screen.onpointermove=e=>{if(phase==='playing'&&key==='orbit')game.point(...local(e))};
  screen.onpointerdown=e=>{
    if(phase!=='playing'||!e.isPrimary||e.button!==0)return;
    screen.focus({preventScroll:true});
    if(key==='orbit'){game.point(...local(e));game.fire();return}
    touch={x:e.clientX,y:e.clientY};screen.setPointerCapture(e.pointerId);
  };
  screen.onpointerup=e=>{
    if(!touch||!e.isPrimary)return;
    const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;
    if(Math.abs(dx)>22&&Math.abs(dx)>Math.abs(dy))run(dx>0?'right':'left');else if(dy<12)run('jump');
  };
  screen.onpointercancel=()=>{touch=null};
  dialog.addEventListener('keydown',e=>{
    if(e.altKey||e.metaKey||e.ctrlKey)return;
    if(e.code==='KeyP' && ['paused','playing'].includes(phase)){e.preventDefault();if(!e.repeat){if(phase==='paused'&&handRun)startHand();else show(phase==='playing'?'paused':'playing')}return}
    if(phase!=='playing'||(!e.code.startsWith('Arrow')&&e.code!=='Space'))return;
    if(e.code==='Space'&&e.target.closest('button'))return;
    e.preventDefault();held.add(e.code);if(e.repeat)return;
    if(key==='orbit'){if(e.code==='Space')game.fire()}
    else if(e.code==='ArrowUp'||e.code==='Space')run('jump');
    else if(e.code==='ArrowLeft'||e.code==='ArrowRight')run(e.code==='ArrowLeft'?'left':'right');
  });
  window.addEventListener('keyup',e=>held.delete(e.code));
  function background(){if(phase==='playing')show('paused')}
  window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background()});
  return {get open(){return phase!=='closed'},
    get capturesHand(){return phase==='playing'||(key==='gale'&&phase==='tracking')},
    state,
    track(points,time,w,h){
      if(key!=='gale'){handStatus=hand.update(points,time,w,h,game);cameraLabel();return handStatus}
      if(!handRun)return 'Keyboard or touch';
      const ready=runner.update(points,time,w,h,game);
      if(ready){
        if(phase==='tracking')show('playing');
        const side=game.lane<-.38?'Left':game.lane>.38?'Right':'Center';
        handStatus='Hand tracked';steering(side,game.lane);
      }else{
        handStatus=points?'Centering hand':'Show one hand';
        if(phase==='playing' && (runner.lastSeen===null||time-runner.lastSeen>450))show('tracking');
        steering(handStatus,runner.position??0);
      }
      cameraLabel();return handStatus;
    }
  };
}
