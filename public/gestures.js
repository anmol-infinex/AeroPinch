export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const links = [[0,1,2,3,4],[0,5,6,7,8],[5,9,13,17,0],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
const fingers = [[8,6,5],[12,10,9],[16,14,13],[20,18,17]];

class OneEuro {
  update(value, time) {
    if (this.time === undefined) {
      this.value = value;
      this.velocity = 0;
    } else {
      const dt = clamp((time - this.time) / 1000, 0.001, 0.15);
      const alpha = cutoff => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
      this.velocity += alpha(1) * ((value - this.value) / dt - this.velocity);
      this.value += alpha(1.2 + 0.012 * Math.abs(this.velocity)) * (value - this.value);
    }
    this.time = time;
    return this.value;
  }
}

export class Controller {
  constructor(actions) {
    this.actions = actions;
    this.reset();
  }
  reset() {
    if (this.dragging) this.actions.dragEnd(true);
    this.pinch = ''; this.candidate = ''; this.frames = 0; this.dragging = false;
    this.pose = ''; this.poseFrames = 0; this.lastZoom = -Infinity;
    this.previousY = null; this.history = []; this.aim = null;
    this.fx = new OneEuro(); this.fy = new OneEuro();
    this.lastSeen = -Infinity;
  }
  lost(now) {
    if (now - this.lastSeen >= 300 && this.lastSeen !== -Infinity) this.reset();
    return 'Waiting for hand';
  }
  update(points, now, width, height, screenW, screenH) {
    if (now - this.lastSeen > 300 && this.lastSeen !== -Infinity) this.reset();
    this.lastSeen = now;
    const distance = (a,b) => Math.hypot((points[a].x-points[b].x)*width, (points[a].y-points[b].y)*height);
    const palm = Math.max(1,distance(0,9));
    const ext = fingers.map(([tip,pip])=>distance(tip,0)>1.15*distance(pip,0));
    const ti = distance(4,8)/palm, tm = distance(4,12)/palm;
    const handX = (1 - (points[4].x + points[8].x)/2) * screenW/.72;
    const handY = (points[4].y + points[8].y)/2 * screenH/.64;
    const next = ti <= tm ? 'left' : 'right';
    const valid = next === 'left' ? distance(8,0)>1.35*distance(5,0) : distance(12,0)>1.35*distance(9,0);
    if (this.pinch && (this.pinch === 'left' ? ti : tm) > .42) {
      if (this.dragging) this.actions.dragEnd(false);
      else if (this.pinch === 'left' && this.aim) this.actions.click(...this.aim);
      this.pinch = ''; this.dragging = false; this.frames = 0;
    }
    if (!this.pinch && Math.min(ti,tm) < .26 && valid) {
      this.frames = this.candidate === next ? this.frames + 1 : 1;
      this.candidate = next;
      if (this.frames >= 2 && this.aim) {
        this.pinch = next;
        this.since = now;
        const before = this.history.filter(p=>now-p.time<600 && now-p.time>=120).at(-1);
        this.origin = before ? before.aim : this.aim;
        this.anchor = [handX,handY]; this.aim = this.origin;
        this.actions.move(...this.aim);
        if (next === 'right') this.actions.context(...this.aim);
      }
    } else this.frames = 0;
    if (this.pinch) {
      this.pose = ''; this.poseFrames = 0; this.previousY = null;
      if (this.pinch === 'right') return 'Right click';
      const dx = handX - this.anchor[0], dy = handY - this.anchor[1];
      if (!this.dragging && (now-this.since >= 300 || Math.hypot(dx,dy)>25)) {
        this.dragging = true; this.actions.dragStart(...this.origin);
      }
      if (this.dragging) {
        this.aim = [clamp(this.origin[0]+dx,0,screenW-1),clamp(this.origin[1]+dy,0,screenH-1)];
        this.actions.move(...this.aim); this.actions.dragMove(...this.aim);
        return 'Drag';
      }
      return 'Pinch';
    }
    const [i,m,r,p] = ext;
    const pose = i && !m && !r && !p ? 'Point' : i && m && !r && !p ? 'Scroll' :
      ext.every(Boolean) ? 'Zoom in' : ext.every(v=>!v) ? 'Zoom out' : 'Hand detected';
    if (pose !== this.pose) {
      this.pose = pose; this.poseFrames = 0; this.poseSince = now; this.previousY = null;
      this.fx = new OneEuro(); this.fy = new OneEuro();
    }
    if (++this.poseFrames < 3) return 'Hand detected';
    if (pose === 'Point') {
      const x = clamp((1-points[8].x-.14)/.72,0,1)*(screenW-1);
      const y = clamp((points[8].y-.18)/.64,0,1)*(screenH-1);
      const aim = [this.fx.update(x,now),this.fy.update(y,now)];
      if (!this.aim || Math.hypot(aim[0]-this.aim[0],aim[1]-this.aim[1])>=1.5) this.aim = aim;
      this.actions.move(...this.aim);
      this.history = this.history.filter(p=>now-p.time<650);
      this.history.push({time:now,aim:this.aim});
    } else if (pose === 'Scroll') {
      const y = (points[8].y+points[12].y)*height/2;
      if (this.previousY !== null && Math.abs(y-this.previousY)>.8) this.actions.scroll((y-this.previousY)*7);
      this.previousY = y;
    } else if (pose.startsWith('Zoom') && now-this.poseSince>=350 && now-this.lastZoom>=300) {
      this.actions.zoom(pose === 'Zoom in' ? 1 : -1); this.lastZoom = now;
    }
    return pose;
  }
}
