import {chromeHand,previewHand} from "./hand-rig.js";

// Perspective projection keeps the mechanical foreground animated even on devices
// running the camera tracker without WebGL.
const TAU = Math.PI * 2;

function ringMesh(radius, bore, height, segments, toothed) {
  const faces = [];
  const makeLoop = (inner, top) => Array.from({length:segments}, (_,i) => {
    const angle = i / segments * TAU;
    const r = inner ? bore : radius * (toothed && i % 4 < 2 ? .91 : 1);
    return [r*Math.cos(angle), top ? height/2 : -height/2, r*Math.sin(angle)];
  });
  const top = makeLoop(false,true), bottom = makeLoop(false,false);
  const inside = makeLoop(true,true), under = makeLoop(true,false);
  for(let i=0;i<segments;i++){
    const j=(i+1)%segments;
    faces.push([top[i],top[j],bottom[j],bottom[i]], [inside[j],inside[i],under[i],under[j]],
      [top[j],top[i],inside[i],inside[j]], [bottom[i],bottom[j],under[j],under[i]]);
  }
  return faces;
}
const rotors = [
  {mesh:ringMesh(1.02,.78,.20,64,true),height:-.52,spin:.20},
  {mesh:ringMesh(.78,.60,.09,40,false),height:-.16,spin:-.16},
  {mesh:ringMesh(.65,.33,.30,48,true),height:.18,spin:.22},
  {mesh:ringMesh(.84,.68,.09,40,false),height:.62,spin:-.12}
];

export function createServoScene(backdrop) {
  const canvas = backdrop.querySelector('#servo-scene'), ctx = canvas.getContext('2d');
  if(!ctx) return {setMotion(){}};
  const shell=backdrop.parentElement, plate=backdrop.querySelector('.robot-plate');
  const video=document.getElementById('video'),game=document.getElementById('arcade');
  let width=1,height=1,frame=0,time=0,last=0,onScreen=false,enabled=false;
  let lookX=0,lookY=0,pointerX=0,pointerY=0,scroll=0;

  const posePreview=previewHand(document.getElementById('diagram'));
  const poseHand=chromeHand(document.getElementById('articulated-hand'),()=>{render();sync()});

  function assembly(cx,cy,scale,mirror) {
    const yaw=mirror*.38+lookX*.22+scroll*.60, tilt=.82+lookY*.15;
    const roll=mirror*.53+Math.sin(time*.16)*.08;
    const cosY=Math.cos(yaw),sinY=Math.sin(yaw),cosT=Math.cos(tilt),sinT=Math.sin(tilt);
    const cosR=Math.cos(roll),sinR=Math.sin(roll);
    const gap=1+scroll*.9+.17*Math.sin(time*.44);
    function project(x,y,z) {
      const xx=x*cosY+z*sinY, zz=z*cosY-x*sinY;
      const yy=y*cosT-zz*sinT, depth=y*sinT+zz*cosT;
      const k=scale*4.5/(4.5-depth);
      return [cx+(xx*cosR-yy*sinR)*k,cy+(xx*sinR+yy*cosR)*k,depth];
    }
    const faces=[];
    for(const part of rotors){
      const angle=time*part.spin+part.height, c=Math.cos(angle),s=Math.sin(angle);
      const cache=new Map();
      function vertex(point){
        if(cache.has(point))return cache.get(point);
        const [x,y,z]=point;
        const out=project(x*c-z*s,y+part.height*gap,x*s+z*c);
        cache.set(point,out);
        return out;
      }
      for(const meshFace of part.mesh){
        const p=meshFace.map(vertex);
        const edgeX=p[1][0]-p[0][0],edgeY=p[1][1]-p[0][1];
        const area=edgeX*(p[2][1]-p[0][1])-edgeY*(p[2][0]-p[0][0]);
        const depth=(p[0][2]+p[1][2]+p[2][2]+p[3][2])/4;
        const facing=Math.atan2(edgeY,edgeX);
        const light=.5+.5*Math.cos(facing+.9);
        const shade=Math.round(29+light*62+147*Math.pow(light,14)+(area<0?12:0));
        faces.push({p,depth,shade});
      }
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const {p,shade} of faces) {
      ctx.fillStyle='rgb('+shade+','+Math.min(255,shade+4)+','+Math.min(255,shade+5)+')';
      ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);
      for(let i=1;i<4;i++)ctx.lineTo(p[i][0],p[i][1]);
      ctx.closePath();ctx.fill();
    }
    for(const offset of [-.32,.48]) {
      ctx.beginPath();
      for(let i=0;i<=72;i++){
        const angle=i/72*TAU, p=project(1.38*Math.cos(angle),offset*gap,1.38*Math.sin(angle));
        if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);
      }
      ctx.lineWidth=.9;ctx.strokeStyle='rgba(211,213,219,.5)';ctx.setLineDash(offset>0?[3,6]:[]);ctx.stroke();ctx.setLineDash([]);
      const a=time*.48+offset*5, p=project(1.38*Math.cos(a),offset*gap,1.38*Math.sin(a));
      ctx.fillStyle='#fac091';ctx.fillRect(p[0]-2,p[1]-2,4,4);
    }
  }
  function render(){
    poseHand(time,lookX,lookY,scroll);
    posePreview(time,lookX);
    ctx.clearRect(0,0,width,height);
    const scale=Math.min(width*.16,height*.23);
    assembly(width*.045+lookX*5,height*(.57-scroll*.12),scale,-1);
    if(width>720)assembly(width*.97,height*(.77-scroll*.17),scale*.67,1);
    plate.style.setProperty('--servo-x',(-lookX*14+Math.sin(time*.12)*7)+'px');
    plate.style.setProperty('--servo-y',(-lookY*9+scroll*14)+'px');
  }
  function canMove(){
    return enabled&&onScreen&&!document.hidden&&!game.open&&!(video.srcObject&&!video.paused);
  }
  function tick(now){
    frame=0;
    if(!canMove())return;
    // Cap decorative work at 24 fps. Tracking and games use their own schedules.
    if(now-last>=1000/24){
      const dt=Math.min((now-last)/1000,.1);last=now;time+=dt;
      const alpha=1-Math.exp(-4*dt);
      lookX+=(pointerX-lookX)*alpha;lookY+=(pointerY-lookY)*alpha;
      const range=Math.max(1,shell.offsetHeight-height);
      scroll=Math.min(1,Math.max(0,-shell.getBoundingClientRect().top/range));
      render();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    if(canMove()){
      if(!frame){last=performance.now();frame=requestAnimationFrame(tick)}
    }else if(frame){cancelAnimationFrame(frame);frame=0;}
  }
  new ResizeObserver(([entry])=>{
    width=entry.contentRect.width;height=entry.contentRect.height;
    const ratio=Math.min(1.25,window.devicePixelRatio||1,1600/Math.max(1,width));
    canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    ctx.setTransform(ratio,0,0,ratio,0,0);render();sync();
  }).observe(backdrop);
  new IntersectionObserver(([e])=>{onScreen=e.isIntersecting;sync()}).observe(shell);
  shell.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'||!enabled)return;
    pointerX=e.clientX/Math.max(1,width)*2-1;pointerY=e.clientY/Math.max(1,height)*2-1;
  },{passive:true});
  shell.addEventListener('pointerleave',()=>{pointerX=pointerY=0});
  new MutationObserver(sync).observe(game,{attributes:true,attributeFilter:['open']});
  for(const event of ['play','pause','emptied','ended'])video.addEventListener(event,sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pageshow',sync);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0});
  return {setMotion(active){enabled=active;sync()}};
}
