import {Controller, clamp, links} from './gestures.js';
import {createArcade} from './arcade.js';
const $ = id => document.getElementById(id);
const guide = [
  ['↖','Move','Point with your index finger.'],
  ['◎','Left click','Briefly pinch thumb and index.'],
  ['✥','Drag & drop','Hold an index pinch and move.'],
  ['◉','Right click','Pinch thumb and middle finger.'],
  ['↕','Scroll','Raise two fingers and move up or down.'],
  ['⊕','Zoom in','Hold an open palm.'],
  ['⊖','Zoom out','Hold a closed fist.']
];
$('guide').innerHTML = guide.map(([icon,name,hint])=>'<div class="row"><dt><i aria-hidden="true">'+icon+'</i>'+name+'</dt><dd>'+hint+'</dd></div>').join('');

function skeleton(canvas, pts, w, h, example = false) {
  const c = canvas.getContext('2d');
  c.clearRect(0,0,w,h);
  c.lineWidth = example ? 2.7 : 3;
  c.strokeStyle = '#d3b99f'; c.lineJoin = 'round';
  for (const line of links) {
    c.beginPath();
    line.forEach((id,index)=>c[index?'lineTo':'moveTo'](pts[id].x*w,pts[id].y*h));
    c.stroke();
  }
  pts.forEach(({x,y},i)=>{
    c.beginPath(); c.arc(x*w,y*h,[4,8,12,16,20].includes(i)?5.4:3.5,0,Math.PI*2);
    c.fillStyle = '#ffe1c1'; c.fill();
  });
}
const board=$('board'), puck=$('puck'), cursor=$('cursor'), menu=$('menu');
const colors=['#efbd8e','#b4c3ff','#ffb886','#f5a9cf'];
let color=0, scale=1, drag=null;
function report(value){$('activity').value=value}
function change(){color=(color+1)%colors.length;puck.style.background=colors[color];report('Color changed')}
function size(delta){
  scale=clamp(Math.round((scale+delta*.1)*10)/10,.5,2);
  board.style.setProperty('--zoom',scale);
  board.style.backgroundSize=16*scale+'px '+16*scale+'px';
  $('scale').textContent='ZOOM '+Math.round(scale*100)+'%';
  position(puck.offsetLeft,puck.offsetTop);report('Canvas zoom '+Math.round(scale*100)+'%');
}
function position(x,y){
  const half=puck.offsetWidth*scale/2;
  puck.style.left=clamp(x,half,board.clientWidth-half)+'px';
  puck.style.top=clamp(y,half,board.clientHeight-half)+'px';
}
function center(){puck.style.left=puck.style.top='50%';menu.hidden=true;report('Puck centered')}
function openMenu(x,y){
  const rect=board.getBoundingClientRect();
  if(x<rect.left || x>rect.right || y<rect.top || y>rect.bottom)return;
  menu.hidden=false;
  menu.style.left=clamp(x-rect.left,0,board.clientWidth-menu.offsetWidth)+'px';
  menu.style.top=clamp(y-rect.top,0,board.clientHeight-menu.offsetHeight)+'px';
  report('Options opened');
}
function dragStart(x,y){
  const rect=puck.getBoundingClientRect();
  if(document.elementFromPoint(x,y)===puck)drag={dx:x-rect.left-rect.width/2,dy:y-rect.top-rect.height/2};
}
function dragMove(x,y){if(drag){const rect=board.getBoundingClientRect();position(x-rect.left-drag.dx,y-rect.top-drag.dy)}}
function dragEnd(cancel){if(drag)report(cancel?'Drag ended':'Puck dropped');drag=null}
const actions={
  move(x,y){cursor.hidden=false;cursor.style.transform='translate('+x+'px,'+y+'px)'},
  click(x,y){const target=document.elementFromPoint(x,y);const control=target?.closest('button,a');if(control)control.click();else menu.hidden=true},
  context:openMenu,dragStart,dragMove,dragEnd,scroll:dy=>{if(!arcade.open)window.scrollBy(0,dy)},zoom:delta=>{if(!arcade.open)size(delta)}
};
const controller=new Controller(actions);
let manual=null,suppressClick=false;
puck.onpointerdown=e=>{if(e.button!==0)return;manual={x:e.clientX,y:e.clientY,moved:false};dragStart(e.clientX,e.clientY);puck.setPointerCapture(e.pointerId)};
puck.onpointermove=e=>{if(!manual)return;if(Math.hypot(e.clientX-manual.x,e.clientY-manual.y)>4)manual.moved=true;if(manual.moved)dragMove(e.clientX,e.clientY)};
puck.onpointerup=()=>{suppressClick=!!manual?.moved;dragEnd(false);manual=null};
puck.onpointercancel=()=>{manual=null;dragEnd(true)};
puck.onclick=()=>{if(!suppressClick)change();suppressClick=false};
board.oncontextmenu=e=>{e.preventDefault();openMenu(e.clientX,e.clientY)};
$('change').onclick=()=>{change();menu.hidden=true};$('center').onclick=center;
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.hidden=true});
$('reset').onclick=()=>{color=0;puck.style.background=colors[color];scale=1;size(0);center();report('Playground reset')};
window.addEventListener('resize',()=>{if(puck.style.left.endsWith('px'))position(puck.offsetLeft,puck.offsetTop)});

const video=$('video'),overlay=$('overlay'),start=$('start'),gesture=$('gesture');
let stream=null,model=null,frame=0,lastVideo=-1,paused=false,generation=0;
const arcade=createArcade({cancelCameraStart:()=>idle(),camera:state=>{if(state==='Camera live')idle();else if(state==='Paused')togglePause();else launch()},resetPointer:()=>{controller.reset();cursor.hidden=true}});
function status(label,live=false,description){arcade.state(label,description);$('session').innerHTML='<b></b> '+label;$('session').classList.toggle('live',live)}
function idle(title='Start your camera',hint='Keep one hand in view to begin tracking.'){
  generation++;cancelAnimationFrame(frame);controller.reset();cursor.hidden=true;
  if(stream)stream.getTracks().forEach(t=>t.stop());
  stream=null;video.srcObject=null;model?.close();model=null;paused=false;lastVideo=-1;
  overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);
  $('controls').hidden=gesture.hidden=true;$('standby').hidden=false;start.disabled=false;
  start.innerHTML='<span aria-hidden="true">▷</span> Start camera';
  $('camtitle').textContent=title;$('camhint').textContent=hint;status('Camera off',false,title==='Start your camera'?null:hint);
}
function track(){
  if(!stream)return;
  try{
    if(!paused && video.readyState>=2 && video.currentTime!==lastVideo){
      lastVideo=video.currentTime;
      const now=performance.now(),pts=model.detectForVideo(video,now).landmarks[0];
      if(overlay.width!==video.videoWidth || overlay.height!==video.videoHeight){overlay.width=video.videoWidth;overlay.height=video.videoHeight}
      if(pts){
        skeleton(overlay,pts,overlay.width,overlay.height);
        gesture.textContent=arcade.capturesHand?arcade.track(pts,now,video.videoWidth,video.videoHeight):controller.update(pts,now,video.videoWidth,video.videoHeight,innerWidth,innerHeight);
      }else{
        gesture.textContent=arcade.capturesHand?arcade.track(null,now,video.videoWidth,video.videoHeight):controller.lost(now);cursor.hidden=true;
        overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);
      }
    }
    if(stream)frame=requestAnimationFrame(track);
  }catch{idle('Tracking interrupted','Restart the camera to try again.')}
}
async function launch(){
  const token=++generation;
  start.disabled=true;start.textContent='Starting…';status('Starting');
  $('camhint').textContent='Allow camera access when your browser asks.';
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('This browser needs HTTPS and camera support.');
    const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30}}});
    if(token!==generation){media.getTracks().forEach(t=>t.stop());return}
    stream=media;video.srcObject=media;
    media.getVideoTracks()[0].onended=()=>idle('Camera disconnected','Reconnect your camera and try again.');
    await video.play();
    if(token!==generation)return;
    $('camhint').textContent='Loading the hand tracker for this device…';
    const {HandLandmarker,FilesetResolver}=await import('/vision.mjs');
    const files=await FilesetResolver.forVisionTasks('/wasm');
    if(token!==generation)return;
    const make=delegate=>HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minTrackingConfidence:.55});
    let next;
    try{next=await make('GPU')}catch{if(token!==generation)return;next=await make('CPU')}
    if(token!==generation){next.close();return}
    model=next;$('standby').hidden=true;$('controls').hidden=gesture.hidden=false;
    $('pause').textContent='Pause';gesture.textContent='Waiting for hand';status('Camera live',true);track();
  }catch(error){
    if(token!==generation)return;
    const hints={NotAllowedError:'Allow camera access in your browser’s site settings, then try again.',NotFoundError:'Connect a webcam or open AeroPinch on a device with a camera.',NotReadableError:'Close other apps using the camera, then try again.'};
    idle('Camera unavailable',hints[error.name]||'Check your connection and camera support, then try again.');
  }
}
function togglePause(){
  if(!stream||!model)return;
  paused=!paused;controller.reset();cursor.hidden=true;
  overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);
  $('pause').textContent=paused?'Resume':'Pause';gesture.textContent=paused?'Paused':'Waiting for hand';status(paused?'Paused':'Camera live',!paused);
}
start.onclick=launch;$('pause').onclick=togglePause;$('stop').onclick=()=>idle();
document.addEventListener('keydown',e=>{if(arcade.open||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key.toLowerCase()==='p')togglePause();if(e.key==='Escape'){menu.hidden=true;if(stream)idle()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden && (stream||start.disabled))idle()});
window.addEventListener('pagehide',()=>idle());
