import {clamp} from './gestures.js';

// Coordinates arrive in the camera's original orientation. Mirror once, then
// measure travel relative to the player's comfortable starting position.
export class RunnerHand {
  constructor(){ this.reset(); }
  reset(){
    this.center=null;
    this.lastSeen=null;
    this.start=null;
    this.position=null;
    this.armed=false;
    this.pinchFrames=0;
  }
  lost(){
    this.start=null;
    this.position=null;
    this.armed=false;
    this.pinchFrames=0;
  }
  update(points,time,width,height,game){
    if(!points){
      if(this.lastSeen===null || time-this.lastSeen>250)this.lost();
      return false;
    }
    const previous=this.lastSeen;
    if(previous!==null && time-previous>450)this.lost();
    this.lastSeen=time;
    const palmX=1-(points[0].x+points[5].x+points[9].x+points[13].x+points[17].x)/5;
    if(this.center===null){
      if(this.start===null || Math.abs(palmX-this.start.x)>.045)this.start={time,x:palmX};
      if(time-this.start.time<220)return false;
      this.center=(this.start.x+palmX)/2;
    }
    const dx=palmX-this.center;
    const span=dx<0?Math.min(.18,this.center*.8):Math.min(.18,(1-this.center)*.8);
    const target=Math.sign(dx)*clamp((Math.abs(dx)-.009)/Math.max(.04,span-.009),0,1);
    const dt=previous===null?1/30:clamp((time-previous)/1000,.001,.15);
    this.position=this.position===null?target:this.position+(target-this.position)*(1-Math.exp(-32*dt));
    game.followHand(this.position);

    const dist=(a,b)=>Math.hypot((points[a].x-points[b].x)*width,(points[a].y-points[b].y)*height);
    const pinch=dist(4,8)/Math.max(1,dist(0,9),dist(5,17));
    if(pinch>.43)this.armed=true;
    this.pinchFrames=this.armed&&pinch<.28?this.pinchFrames+1:0;
    if(this.pinchFrames>=2){
      game.jump();this.armed=false;this.pinchFrames=0;
    }
    return true;
  }
}
