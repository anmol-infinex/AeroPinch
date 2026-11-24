// Bind the chrome artwork to its visible knuckles. Each triangle carries its
// original photograph coordinates while the joints move in 3D before projection.
const W=1000,H=563;
const index=[[790,142],[608,96],[482,134],[402,221]];
const thumb=[[755,354],[592,321],[468,259]];
const outlines=[
  [[371,236],[363,126],[481,57],[594,25],[649,54],[688,105],[726,157],[719,190],[618,154],[546,168],[487,202],[436,237]],
  [[438,242],[522,224],[605,247],[652,278],[694,299],[743,302],[761,327],[766,374],[743,407],[659,399],[587,354],[509,332],[445,279]]
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function mask(c,poly){
  c.beginPath();poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
}
function surface(){const el=document.createElement('canvas');el.width=W;el.height=H;return el}
function layer(image,part,box,nx,ny){
  const tex=surface(), c=tex.getContext('2d');
  if(part<0){
    c.drawImage(image,0,0,W,H);c.fillStyle='#010203';
    for(const poly of outlines){mask(c,poly);c.fill()}
  }else{
    mask(c,outlines[part]);c.clip();c.drawImage(image,0,0,W,H);
  }
  const [x,y,w,h]=box,verts=[],triangles=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const px=x+w*i/nx, py=y+h*j/ny;
    verts.push({x:px,y:py,bind:part<0?null:weights(part===0?index:thumb,px,py)});
    if(j&&i){
      const k=verts.length-1,a=k-nx-2,b=k-nx-1,d=k-1;
      triangles.push([a,b,k],[a,k,d]);
    }
  }
  return {tex,verts,triangles,part};
}
function weights(chain,x,y){
  let along=0,nearest=Infinity;
  for(let i=0;i<chain.length-1;i++){
    const [ax,ay]=chain[i],[bx,by]=chain[i+1],dx=bx-ax,dy=by-ay;
    const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
    const d=(ax+t*dx-x)**2+(ay+t*dy-y)**2;
    if(d<nearest){nearest=d;along=i+t}
  }
  const s=clamp(along-.5,0,chain.length-2),i=Math.floor(s),f=s-i;
  return [i,Math.min(i+1,chain.length-2),f*f*(3-2*f)];
}
function solve(chain,target,close){
  const n=chain.length, base=chain[n-3], elbow=chain[n-2], tip=chain[n-1];
  const tx=tip[0]+(target[0]-tip[0])*close,ty=tip[1]+(target[1]-tip[1])*close;
  const dx=tx-base[0],dy=ty-base[1],a=Math.hypot(elbow[0]-base[0],elbow[1]-base[1]),b=Math.hypot(tip[0]-elbow[0],tip[1]-elbow[1]);
  const distance=clamp(Math.hypot(dx,dy),Math.abs(a-b)+.01,a+b-.01);
  const cross=(elbow[0]-base[0])*(tip[1]-base[1])-(elbow[1]-base[1])*(tip[0]-base[0]);
  const angle=Math.atan2(dy,dx)-Math.sign(cross)*Math.acos(clamp((a*a+distance*distance-b*b)/(2*a*distance),-1,1));
  const posed=chain.slice();posed[n-2]=[base[0]+a*Math.cos(angle),base[1]+a*Math.sin(angle)];posed[n-1]=[tx,ty];
  return chain.slice(0,-1).map(([x,y],i)=>{
    const [u,v]=posed[i], end=posed[i+1], next=chain[i+1];
    const turn=Math.atan2(end[1]-v,end[0]-u)-Math.atan2(next[1]-y,next[0]-x);
    const c=Math.cos(turn),s=Math.sin(turn);
    return [c,s,u-c*x+s*y,v-s*x-c*y];
  });
}
function mapPoint(v,transforms){
  if(!transforms)return [v.x,v.y];
  const [i,j,t]=v.bind,a=transforms[i],b=transforms[j],{x,y}=v;
  const ax=a[0]*x-a[1]*y+a[2],ay=a[1]*x+a[0]*y+a[3];
  return [ax+t*(b[0]*x-b[1]*y+b[2]-ax),ay+t*(b[1]*x+b[0]*y+b[3]-ay)];
}
function drawTriangle(ctx,tex,source,dest,indices){
  const [i,j,k]=indices,a=source[i],b=source[j],c=source[k];
  const [p,q,r]=[dest[i],dest[j],dest[k]];
  const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-a.x,vy=c.y-a.y,det=ux*vy-uy*vx;
  const xx=((q[0]-p[0])*vy-(r[0]-p[0])*uy)/det,xy=(ux*(r[0]-p[0])-vx*(q[0]-p[0]))/det;
  const yx=((q[1]-p[1])*vy-(r[1]-p[1])*uy)/det,yy=(ux*(r[1]-p[1])-vx*(q[1]-p[1]))/det;
  const mx=(p[0]+q[0]+r[0])/3,my=(p[1]+q[1]+r[1])/3;
  ctx.save();ctx.beginPath();
  // Overlap subpixel edges to avoid hairlines between adjacent triangles.
  for(const [n,pt] of [p,q,r].entries()){
    const dx=pt[0]-mx,dy=pt[1]-my,expand=.7/Math.max(1,Math.hypot(dx,dy));
    const x=pt[0]+dx*expand,y=pt[1]+dy*expand;
    if(n)ctx.lineTo(x,y);else ctx.moveTo(x,y);
  }
  ctx.closePath();ctx.clip();
  ctx.transform(xx,yx,xy,yy,p[0]-xx*a.x-xy*a.y,p[1]-yx*a.x-yy*a.y);
  const x=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))-2),y=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))-2);
  const w=Math.ceil(Math.max(a.x,b.x,c.x))-x+2,h=Math.ceil(Math.max(a.y,b.y,c.y))-y+2;
  ctx.drawImage(tex,x,y,w,h,x,y,w,h);ctx.restore();
}

export function chromeHand(canvas,onReady){
  const ctx=canvas.getContext('2d',{alpha:false});let layers;
  if(!ctx)return ()=>{};
  const img=new Image();
  img.onload=()=>{
    const metal=surface(),brush=metal.getContext('2d');
    brush.drawImage(img,0,0,W,H);
    const pixels=brush.getImageData(0,0,W,H),rgba=pixels.data;
    for(let i=0;i<rgba.length;i+=4){
      if(rgba[i+1]>rgba[i]*1.02 && rgba[i+1]>rgba[i+2]*1.5){
        const level=rgba[i+1];rgba[i]=Math.min(255,level*1.09);rgba[i+1]=level*.78;rgba[i+2]=level*.49;
      }
    }
    brush.putImageData(pixels,0,0);
    layers=[layer(metal,-1,[0,0,W,H],9,4),layer(metal,0,[360,22,370,220],12,7),layer(metal,1,[435,218,335,195],12,7)];
    canvas.width=W;canvas.height=H;onReady();
  };
  img.src='/servo-studio.webp';
  return (time,lookX,lookY,scroll)=>{
    if(!layers)return;
    const wave=.5-.5*Math.cos(time*.90);
    const close=wave*wave*(3-2*wave);
    const transforms=[solve(index,[473,245],close),solve(thumb,[480,250],close)];
    const yaw=.13*Math.sin(time*.49)+lookX*.09,pitch=.075*Math.sin(time*.38)+lookY*.06;
    const roll=.036*Math.sin(time*.44)+scroll*.018;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
    ctx.fillStyle='#020304';ctx.fillRect(0,0,W,H);
    for(const item of layers){
      const posed=item.verts.map(v=>{
        const [x,y]=mapPoint(v,item.part<0?null:transforms[item.part]);
        const weight=clamp((v.x-260)/130,0,1);
        const z=item.part<0?0:(26+close*24)*clamp((750-v.x)/240,0,1);
        const dx=x-862,dy=y-307;
        const rx=cy*dx+sy*z,rz=-sy*dx+cy*z,ry=dy*cp-rz*sp;
        const depth=dy*sp+rz*cp, k=1100/(1100-depth);
        return [x+weight*(862+(rx*cr-ry*sr)*k-x),y+weight*(307+(rx*sr+ry*cr)*k-y)];
      });
      for(const tri of item.triangles)drawTriangle(ctx,item.tex,item.verts,posed,tri);
    }
    canvas.classList.add('posed');
  };
}

// The standby model uses the same open/pinch rhythm as the chrome backdrop.
// Flexion angles accumulate down each digit so its fingertip follows the knuckles.
export function previewHand(canvas){
  const c=canvas.getContext('2d');
  if(!c)return ()=>{};
  const fingers=[
    {x:-.39,y:.03,z:.08,spread:-.88,lengths:[.36,.31,.24]},
    {x:-.30,y:-.28,z:.00,spread:-.14,lengths:[.43,.32,.22]},
    {x:-.09,y:-.33,z:-.04,spread:-.01,lengths:[.48,.35,.25]},
    {x:.15,y:-.30,z:-.04,spread:.10,lengths:[.44,.33,.24]},
    {x:.36,y:-.20,z:-.01,spread:.28,lengths:[.34,.25,.20]}
  ];
  return (time,look)=>{
    c.clearRect(0,0,canvas.width,canvas.height);
    const beat=(1-Math.cos(time*.90))*.5,close=beat*beat*(3-2*beat);
    const yaw=-.34+Math.sin(time*.46)*.33+look*.13;
    function project([x,y,z]){
      const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
      const k=98/(1-zz*.13);return [160+xx*k,151+y*k-zz*22,zz];
    }
    const parts=[];
    function bar(a,b,r){
      const [x,y,z]=project(a),[xx,yy,zz]=project(b);
      const dx=xx-x,dy=yy-y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
      parts.push({z:(z+zz)*.5,draw(){
        const g=c.createLinearGradient(x-r*nx,y-r*ny,x+r*nx,y+r*ny);
        g.addColorStop(0,'#373c45');g.addColorStop(.32,'#a0a7ae');g.addColorStop(.51,'#f5efe7');g.addColorStop(.68,'#848890');g.addColorStop(1,'#41464e');
        c.fillStyle=g;c.beginPath();
        [[x+nx*r,y+ny*r],[xx+nx*r*.69,yy+ny*r*.69],[xx-nx*r*.69,yy-ny*r*.69],[x-nx*r,y-ny*r]].forEach(([u,v],i)=>i?c.lineTo(u,v):c.moveTo(u,v));
        c.closePath();c.fill();
      }});
    }
    function joint(point,r){
      const [x,y,z]=project(point);
      parts.push({z:z+.016,draw(){
        c.fillStyle='#414751';c.strokeStyle='#b9bdc1';c.lineWidth=1.7;
        c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke();
        c.fillStyle='#e5b68c';c.beginPath();c.arc(x,y,r*.32,0,Math.PI*2);c.fill();
      }});
    }
    for(const [i,f] of fingers.entries()){
      let p=[f.x,f.y,f.z],bend=.05;
      bar([f.x*.50,.51,0],p,i===0?8:9);
      joint(p,6);
      for(const [j,length] of f.lengths.entries()){
        bend+=(i===0?.18:i===1?.24:.14)+close*(i===0?.44:i===1?.58:.74);
        const spread=i===0?f.spread+close*1.2:f.spread;
        const direction=[Math.sin(spread)*Math.cos(bend),-Math.cos(spread)*Math.cos(bend),Math.sin(bend)];
        const next=p.map((value,k)=>value+length*direction[k]);
        bar(p,next,6.5-j*.8);joint(next,j===2?3.2:4.5);p=next;
      }
    }
    bar([0,.72,0],[0,.50,0],17);
    parts.sort((a,b)=>a.z-b.z).forEach(part=>part.draw());
  };
}
