// Both worlds use an 800 × 450 logical canvas for consistent input across devices.
import {clamp} from './gestures.js';
const W=800, H=450, TAU=2*Math.PI;
function polygon(c, color, points) {
  c.fillStyle=color; c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.closePath(); c.fill();
}
function disc(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
function line(c,x,y,xx,yy,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke()}
function sky(c,top,bottom){const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,top);g.addColorStop(1,bottom);c.fillStyle=g;c.fillRect(0,0,W,H)}

export class OrbitBlaster {
  constructor(random=Math.random){
    this.random=random;this.score=0;this.time=0;this.shots=0;this.hits=0;
    this.aim={x:400,y:208};this.effects=[];this.over=false;this.targets=[];
    for(let slot=0;slot<4;slot++)this.targets.push(this.spawn(slot));
  }
  spawn(slot){
    return {x:80+(slot%2)*350+this.random()*220,y:65+Math.floor(slot/2)*145+this.random()*80,
      phase:this.random()*TAU, r:25+this.random()*6, slot};
  }
  location(t){return {x:t.x+17*Math.sin(this.time*1.3+t.phase),y:t.y+12*Math.cos(this.time*1.7+t.phase)}}
  point(x,y){this.aim={x:clamp(x,0,W),y:clamp(y,0,H)}}
  fire(){
    if(this.over)return;
    this.shots++;
    const {x,y}=this.aim;
    const index=this.targets.findIndex(t=>{const at=this.location(t);return Math.hypot(x-at.x,y-at.y)<=t.r+5});
    this.effects.push({x,y,age:0,hit:index>=0});
    if(index>=0){this.hits++;this.score+=100;this.targets[index]=this.spawn(index)}
  }
  update(dt){
    this.time=Math.min(30,this.time+dt);
    this.effects=this.effects.filter(e=>(e.age+=dt)<.26);
    this.over=this.time>=30;
  }
  get metric(){return Math.ceil(30-this.time)+' s'}
  get result(){return this.score+' points · '+this.hits+' of '+this.shots+' shots hit.'}
  draw(c){
    sky(c,'#151735','#4a345a');
    for(let i=0;i<90;i++)disc(c,(i*133.7)%800,(i*i*7.11)%390,i%6===0?1.8:.9,i%3?'#b1bdd8':'#f3d3b0');
    c.save();c.translate(661,90);c.rotate(-.28);
    c.strokeStyle='#cba1ad';c.lineWidth=5;c.beginPath();c.ellipse(0,0,82,15,0,0,TAU);c.stroke();
    const planet=c.createLinearGradient(0,-44,0,44);planet.addColorStop(0,'#ffa88b');planet.addColorStop(1,'#ae6b95');disc(c,0,0,43,planet);
    c.beginPath();c.ellipse(0,0,82,15,0,0,Math.PI);c.stroke();c.restore();
    polygon(c,'#34314e',[[0,335],[65,302],[126,333],[200,305],[292,354],[433,315],[511,338],[675,291],[800,323],[800,450],[0,450]]);
    polygon(c,'#27273e',[[0,370],[97,349],[185,372],[270,349],[380,379],[512,350],[660,374],[752,348],[800,362],[800,450],[0,450]]);
    for(const t of this.targets){
      const {x,y}=this.location(t);c.save();c.translate(x,y);
      disc(c,0,0,t.r+6,'#a8fff119');disc(c,0,0,t.r,'#6be2d2');disc(c,0,0,t.r-4,'#25445b');
      disc(c,0,0,t.r*.58,'#94fff1');disc(c,0,0,t.r*.38,'#376778');disc(c,0,0,t.r*.17,'#e3fff7');
      c.restore();
    }
    const a=this.aim;
    c.save();c.translate(400,447);c.rotate(Math.atan2(a.y-447,a.x-400)+Math.PI/2);
    polygon(c,'#788da5',[[-17,5],[-11,-53],[-7,-67],[7,-67],[11,-53],[17,5]]);
    c.fillStyle='#9dfff2';c.fillRect(-8,-59,16,5);c.restore();disc(c,400,451,24,'#32374f');
    for(const e of this.effects){c.save();c.globalAlpha=1-e.age/.26;line(c,400,425,e.x,e.y,'#9effec',3);
      c.strokeStyle=e.hit?'#ffe397':'#aeb5cb';c.lineWidth=3;c.beginPath();c.arc(e.x,e.y,9+e.age*120,0,TAU);c.stroke();c.restore()}
    c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.arc(a.x,a.y,11,0,TAU);c.stroke();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])line(c,a.x+dx*7,a.y+dy*7,a.x+dx*17,a.y+dy*17,'#fff',1.5);
  }
}
function project(lane,z){
  const depth=.10+.90*z*z;
  return {x:400+lane*190*depth,y:161+250*depth,s:depth};
}
function turbine(c,x,y,s,time){
  line(c,x,y,x,y+60*s,'#446666',3*s);
  for(let k=0;k<3;k++){
    const a=time*.38+k*TAU/3;
    polygon(c,'#edf1d3',[[x,y],[x+Math.cos(a+.21)*14*s,y+Math.sin(a+.21)*14*s],[x+Math.cos(a)*34*s,y+Math.sin(a)*34*s]]);
  }
}
export class GaleRunner {
  constructor(random=Math.random){
    this.random=random;this.score=0;this.time=0;this.distance=0;this.lane=0;this.visualLane=0;
    this.jumpTime=0;this.over=false;this.spawnIn=1.35;
    this.items=[{lane:0,z:.12,kind:'gate',checked:false}];
  }
  steer(direction){this.lane=clamp(Math.round(this.lane)+direction,-1,1)}
  followHand(position){this.lane=clamp(position,-1,1)}
  jump(){if(!this.jumpTime)this.jumpTime=.88}
  get lift(){return this.jumpTime ? 90*Math.sin(Math.PI*this.jumpTime/.88) : 0}
  update(dt){
    if(this.over)return;
    this.time+=dt;
    const speed=.32+Math.min(.19,this.time*.0025);
    this.distance+=dt*speed*65;this.score=Math.floor(this.distance);
    this.visualLane+=(this.lane-this.visualLane)*(1-Math.exp(-16*dt));
    this.jumpTime=Math.max(0,this.jumpTime-dt);this.spawnIn-=dt;
    if(this.spawnIn<=0){
      this.items.push({lane:Math.floor(this.random()*3)-1,z:.01,kind:this.random()<.55?'gate':'crate',checked:false});
      this.spawnIn=1.20+this.random()*.45;
    }
    for(const item of this.items){
      item.z+=speed*dt;
      if(!item.checked && item.z>=.89){
        item.checked=true;
        if(Math.abs(this.visualLane-item.lane)<.55 && (item.kind==='crate'||this.lift<37))this.over=true;
      }
    }
    this.items=this.items.filter(item=>item.z<1.23);
  }
  get metric(){return Math.floor(this.time)+' s'}
  get result(){return 'You ran '+this.score+' metres.'}
  draw(c){
    sky(c,'#58a4a7','#ffe6b0');disc(c,574,115,54,'#ffe6a4');
    polygon(c,'#83b0a3',[[0,140],[84,91],[134,127],[249,65],[384,161],[472,110],[560,144],[677,74],[800,130],[800,226],[0,226]]);
    polygon(c,'#679686',[[0,170],[73,138],[157,166],[268,130],[410,176],[534,140],[595,161],[709,120],[800,151],[800,218],[0,218]]);
    turbine(c,99,104,.87,this.time);turbine(c,190,130,.50,this.time+1);turbine(c,694,102,.70,this.time+2);
    c.fillStyle='#80b7ab';c.fillRect(0,180,W,270);
    for(let i=0;i<26;i++){
      const x=(i*177.6)%800,y=196+(i*i*19)%241;
      line(c,x,y,x+12+i%19,y,'#a2cabe',2);
    }
    polygon(c,'#537b65',[[0,205],[101,192],[179,204],[222,223],[0,279]]);
    polygon(c,'#446e61',[[800,209],[750,190],[676,210],[624,244],[800,275]]);
    polygon(c,'#b78363',[[365,174],[435,174],[800,450],[0,450]]);
    polygon(c,'#dcb488',[[367,174],[433,174],[775,450],[25,450]]);
    for(let i=0;i<18;i++){
      const z=((i/16+this.distance*.013)%1.1);
      const l=project(-1.70,z),r=project(1.70,z);
      line(c,l.x,l.y,r.x,r.y,'#bf976f',Math.max(1,l.s*3));
    }
    for(const lane of [-.5,.5]){const a=project(lane,0),b=project(lane,1.13);line(c,a.x,a.y,b.x,b.y,'#ead1a2',2)}
    const avatar=()=>{
      const {x,y,s}=project(this.visualLane,.89);
      c.fillStyle='rgba(56,59,51,.23)';c.beginPath();c.ellipse(x,y,20,6,0,0,TAU);c.fill();
      c.save();c.translate(x,y-this.lift);c.scale(s*1.14,s*1.14);
      const step=this.jumpTime?5:Math.sin(this.time*15)*8;
      line(c,-5,-19,-10,-3-step,'#263e45',7);line(c,5,-19,9,-4+step,'#263e45',7);
      polygon(c,'#1d7777',[[-11,-39],[9,-39],[13,-16],[-12,-16]]);
      polygon(c,'#f17d50',[[-7,-39],[-16,-35],[-34,-41+step*.3],[-26,-32],[-12,-29],[1,-36]]);
      disc(c,0,-48,11,'#edb57e');disc(c,-1,-53,10,'#354f4b');c.fillStyle='#f6c66f';c.fillRect(-13,-52,25,4);
      c.restore();
    };
    const obstacle=item=>{
      const {x,y,s}=project(item.lane,item.z);c.save();c.translate(x,y);c.scale(s,s);
      if(item.kind==='gate'){
        c.fillStyle='#624d43';c.fillRect(-35,-36,8,36);c.fillRect(27,-36,8,36);
        c.fillStyle='#e78053';c.fillRect(-38,-37,76,15);
        for(let i=-32;i<29;i+=19)polygon(c,'#fff0c4',[[i,-36],[i+8,-36],[i+1,-23],[i-7,-23]]);
      }else{
        c.fillStyle='#945b46';c.fillRect(-32,-78,64,78);c.strokeStyle='#e1a473';c.lineWidth=5;c.strokeRect(-29,-75,58,72);
        line(c,-25,-69,25,-9,'#d19869',6);line(c,25,-69,-25,-9,'#d19869',6);
      }
      c.restore();
    };
    const sorted=[...this.items].sort((a,b)=>a.z-b.z);
    sorted.filter(i=>i.z<=.89).forEach(obstacle);avatar();sorted.filter(i=>i.z>.89).forEach(obstacle);
  }
}
