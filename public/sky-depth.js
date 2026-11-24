// Draw translucent cloud banks at world-space positions. The perspective divide
// gives nearby banks a larger silhouette and more lateral movement than distant ones.
export function createCloudFlight(canvas) {
  const ctx = canvas.getContext('2d', {alpha: true});
  if (!ctx) return () => {};
  let seed = 4217;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

  // Each quadrant holds a distinct backlit cloud with transparent edges.
  const atlas = new Image();
  atlas.decoding = 'async';
  atlas.src = '/cloud-banks.webp';
  const span=12, nearest=.85;
  const banks=Array.from({length:12}, (_,i)=>({
    x:(i%2===0?-1:1)*(.55+random()*3.8),
    y:.42+random()*1.75,
    start:i/12*span,
    width:1.6+random()*2.1,
    tile:i%4
  }));
  let width=0,height=0,running=false,frame=0,lastTime=0,travel=0;
  let lookX=0,lookY=0,progress=0,aimX=0,aimY=0,aimProgress=0;
  function draw(time) {
    const dt=Math.min(.08,Math.max(0,(time-lastTime)/1000));
    lastTime=time;
    travel=(travel+dt*.66)%span;
    const ease=1-Math.exp(-5*dt);
    lookX+=(aimX-lookX)*ease;
    lookY+=(aimY-lookY)*ease;
    progress+=(aimProgress-progress)*ease;
    const focal=Math.min(width,height*1.65)*.9;
    const camera=travel+progress*3.3;
    ctx.clearRect(0,0,width,height);
    for(const bank of banks)bank.z=nearest+((bank.start-camera)%span+span)%span;
    banks.sort((a,b)=>b.z-a.z);
    for(const bank of banks) {
      const scale=focal/bank.z;
      const x=width*.54+(bank.x-lookX*.52)*scale;
      const y=height*.48+(bank.y-lookY*.21-progress*.15)*scale;
      const w=bank.width*scale,h=w*170/384;
      if(x+w/2<0 || x-w/2>width || y-h/2>height)continue;
      // Fade at both ends of the depth range for a seamless looping flight.
      ctx.globalAlpha=.57*Math.min(1,(bank.z-nearest)/.8,(span+nearest-bank.z)/1.9);
      if (atlas.naturalWidth && atlas.complete) {
        const tileW = atlas.naturalWidth / 2, tileH = atlas.naturalHeight / 2;
        ctx.drawImage(atlas,(bank.tile%2)*tileW,Math.floor(bank.tile/2)*tileH,tileW,tileH,x-w/2,y-h/2,w,h);
      }
    }
    ctx.globalAlpha=1;
    if(running)frame=requestAnimationFrame(draw);
  }
  const resize = new ResizeObserver(([entry])=>{
    width=Math.round(entry.contentRect.width);
    height=Math.round(entry.contentRect.height);
    const ratio=Math.min(window.devicePixelRatio||1,1,1300/Math.max(width,1));
    canvas.width=Math.max(1,Math.round(width*ratio));
    canvas.height=Math.max(1,Math.round(height*ratio));
    ctx.setTransform(ratio,0,0,ratio,0,0);
  });
  resize.observe(canvas);
  return (active,x,y,scroll)=>{
    aimX=x;aimY=y;aimProgress=scroll;
    if(active===running)return;
    running=active;
    if(running){lastTime=performance.now();frame=requestAnimationFrame(draw)}
    else cancelAnimationFrame(frame);
  };
}
