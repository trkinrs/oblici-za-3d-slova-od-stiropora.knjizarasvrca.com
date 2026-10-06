(function (root) {
'use strict';
const fail = message => { throw new Error(message); };

// Douglas-Peucker simplification only within contour runs. Bridge endpoints stay fixed.
function simplify(points, tolerance) {
 if(points.length<3)return points;
 const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
 while(stack.length){const [lo,hi]=stack.pop(),a=points[lo],b=points[hi],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;let best=tolerance*tolerance,index=-1;
 for(let i=lo+1;i<hi;i++){const p=points[i],t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0,d=(p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;if(d>best){best=d;index=i;}}
 if(index>=0){keep.add(index);stack.push([lo,index],[index,hi]);}}
 const out=[...keep].sort((a,b)=>a-b).map(i=>points[i]);
 if(points[0].x===points.at(-1).x&&points[0].y===points.at(-1).y&&out.length<4)return points;
 return out;
}
// Filter pixel stairs in arc-length space before simplification. Each stage uses
// half the tolerance; entry/exit points and sharp corners remain fixed.
function smoothContour(points,tolerance){
 if(points.length<3)return points;
 const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 const total=distances.at(-1),radius=2*tolerance,anchors=[0];
 const sample=s=>{let lo=0,hi=distances.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(distances[mid]<=s)lo=mid;else hi=mid;}const span=distances[hi]-distances[lo],t=span?(s-distances[lo])/span:0;return {x:points[lo].x+(points[hi].x-points[lo].x)*t,y:points[lo].y+(points[hi].y-points[lo].y)*t};};
 const filtered=points.map((p,i)=>{
  if(!i||i===points.length-1)return p;
  const reach=Math.min(radius,distances[i],total-distances[i]);
  if(reach<1e-9)return p;
  const a=sample(distances[i]-reach),b=sample(distances[i]+reach),ux=p.x-a.x,uy=p.y-a.y,vx=b.x-p.x,vy=b.y-p.y;
  if(ux*vx+uy*vy<=.5*Math.hypot(ux,uy)*Math.hypot(vx,vy)){anchors.push(i);return p;}
  const dx=(a.x+b.x-2*p.x)/4,dy=(a.y+b.y-2*p.y)/4,length=Math.hypot(dx,dy),factor=length?Math.min(1,tolerance/(2*length)):0;
  return {...p,x:p.x+dx*factor,y:p.y+dy*factor};
 });
 anchors.push(points.length-1);const out=[filtered[0]];
 for(let i=1;i<anchors.length;i++)out.push(...simplify(filtered.slice(anchors[i-1],anchors[i]+1),tolerance/2).slice(1));
 // Keep tiny closed components from collapsing to a line.
 if(points[0].x===points.at(-1).x&&points[0].y===points.at(-1).y&&out.length<4)return points;
 return out;
}
function smoothMoves(moves,tolerance){const out=[moves[0]];for(let i=1;i<moves.length;){if(moves[i].type!=='contour'){out.push(moves[i++]);continue;}let j=i;while(j<moves.length&&moves[j].type==='contour')j++;out.push(...smoothContour(moves.slice(i-1,j),tolerance).slice(1));i=j;}return out;}
function collision(moves){
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
 const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;
 for(let i=1;i<moves.length;i++)for(let j=i+2;j<moves.length;j++){
 const a=moves[i-1],b=moves[i],c=moves[j-1],d=moves[j];
 if(Math.max(a.x,b.x)<Math.min(c.x,d.x)-1e-7||Math.max(c.x,d.x)<Math.min(a.x,b.x)-1e-7||Math.max(a.y,b.y)<Math.min(c.y,d.y)-1e-7||Math.max(c.y,d.y)<Math.min(a.y,b.y)-1e-7)continue;
 if((same(a,c)&&same(b,d))||(same(a,d)&&same(b,c)))continue;
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 if(abC*abD< -1e-12 && cdA*cdB< -1e-12)return true;
 if((on(a,b,c)&&!same(c,a)&&!same(c,b))||(on(a,b,d)&&!same(d,a)&&!same(d,b))||(on(c,d,a)&&!same(a,c)&&!same(a,d))||(on(c,d,b)&&!same(b,c)&&!same(b,d)))return true;
 }return false;
}


// Independent implementation of nearest-entry contour joining.
// Reject every connection that crosses an outline or an already selected bridge.
function crossing(a,b,c,d,allowEndpointOnEdge=false){
 const eps=1e-8,cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 if(Math.max(a.x,b.x)<Math.min(c.x,d.x)-eps||Math.max(c.x,d.x)<Math.min(a.x,b.x)-eps||Math.max(a.y,b.y)<Math.min(c.y,d.y)-eps||Math.max(c.y,d.y)<Math.min(a.y,b.y)-eps)return false;
 const u=cross(a,b,c),v=cross(a,b,d),r=cross(c,d,a),t=cross(c,d,b);
 if(u*v< -eps&&r*t< -eps)return true;
 const interior=(p,q,z)=>Math.abs(cross(p,q,z))<eps&&(z.x-p.x)*(z.x-q.x)+(z.y-p.y)*(z.y-q.y)<-eps;
 if(Math.abs(u)<eps&&Math.abs(v)<eps){const axis=Math.abs(a.x-b.x)>Math.abs(a.y-b.y)?'x':'y';if(Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]))>eps)return true;}
 return interior(a,b,c)||interior(a,b,d)||(!allowEndpointOnEdge&&(interior(c,d,a)||interior(c,d,b)));
}
function nearestConnections(contours,origin,at,horizontalCandidates){
 const root=contours.length,all=contours.concat([[origin]]),samples=[],segments=[];
 const budget=Math.max(16,Math.min(80,Math.floor(2400/Math.max(1,root))));
 all.forEach((loop,owner)=>{
  const step=Math.max(1,Math.ceil(loop.length/budget)),indices=new Set();
  for(let i=0;i<loop.length;i+=step)indices.add(i);
  // Include extrema, so nearest exterior entry is available even at low sampling density.
  for(const axis of ['x','y'])for(const sign of [-1,1]){let best=0;for(let i=1;i<loop.length;i++)if(sign*loop[i][axis]>sign*loop[best][axis])best=i;indices.add(best);}
  samples.push([...indices].map(index=>({...loop[index],owner,index})));
  if(owner!==root){const corners=loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x);});corners.forEach((p,i)=>segments.push([p,corners[(i+1)%corners.length]]));}
 });
 const candidates=horizontalCandidates.filter(e=>e.a.owner<root&&e.b.owner<root).map(e=>({...e,a:{...contours[e.a.owner][e.a.index],...e.a},b:{...contours[e.b.owner][e.b.index],...e.b},cost2:e.cost*e.cost}));
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const best=[];
  for(const a of samples[i])for(const b of samples[j]){
   const d2=(a.x-b.x)**2+(a.y-b.y)**2;if(!d2)continue;
   const solid=at(Math.floor((a.x+b.x)/2),Math.floor((a.y+b.y)/2));const cost2=d2*(solid?100:1);
   if(best.length===8&&cost2>=best[best.length-1].cost2)continue;
   best.push({a,b,solid,cost2,cost:Math.sqrt(cost2)});best.sort((a,b)=>a.cost2-b.cost2);if(best.length>8)best.pop();
  }candidates.push(...best);
 }
 candidates.sort((a,b)=>a.cost2-b.cost2);
 const parents=all.map((_,i)=>i),find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;},bridges=[],links=all.map(()=>[]);
 for(const e of candidates){const a=find(e.a.owner),b=find(e.b.owner);if(a===b)continue;
  if(segments.some(([c,d])=>crossing(e.a,e.b,c,d,true))||bridges.some(other=>crossing(e.a,e.b,other.a,other.b)))continue;
  parents[a]=b;bridges.push(e);links[e.a.owner].push({here:e.a.index,there:e.b.index,owner:e.b.owner,solid:e.solid});links[e.b.owner].push({here:e.b.index,there:e.a.index,owner:e.a.owner,solid:e.solid});if(bridges.length===root)return {bridges,links,frame:[origin]};
 }
 return null;
}


function repeatOnSheet(part,options){
 const sizes={'1000x500':[1000,500],'1200x600':[1200,600]};
 if(!options.sheet||options.sheet==='none')return part;
 if(!sizes[options.sheet])fail('Nepoznata veličina ploče.');
 const [sheetWidth,sheetHeight]=sizes[options.sheet],copies=Number(options.copies),gap=Number(options.copyGap);
 if(!Number.isInteger(copies)||copies<1||copies>500)fail('Broj kopija mora biti ceo broj od 1 do 500.');
 if(!Number.isFinite(gap)||gap<1||gap>100)fail('Razmak kopija mora biti od 1 do 100 mm.');
 const columns=Math.max(0,Math.floor((sheetWidth-gap)/(part.totalX+gap))),rows=Math.max(0,Math.floor((sheetHeight-gap)/(part.totalY+gap))),capacity=columns*rows;
 if(copies>capacity)fail('Na ploču staje najviše '+capacity+' kopija sa ovim dimenzijama, marginom i razmakom. Smanji broj kopija ili širinu oblika.');
 const placements=Array.from({length:copies},(_,i)=>({x:gap+(i%columns)*(part.totalX+gap),y:gap+Math.floor(i/columns)*(part.totalY+gap)}));
 const usedX=Math.max(...placements.map(p=>p.x+part.totalX)),usedY=Math.max(...placements.map(p=>p.y+part.totalY));
 if(usedX>options.bedX||usedY>options.bedY)fail('Raspored kopija prelazi zadati radni hod mašine. Proveri X i Y hod.');
 if(part.moves.length*copies>500000)fail('Previše tačaka za jedan fajl. Smanji broj kopija ili povećaj zaglađivanje.');
 const moves=[{x:0,y:0,type:'start'}];
 const push=p=>{const last=moves[moves.length-1];if(Math.hypot(last.x-p.x,last.y-p.y)>1e-9)moves.push(p);};
 for(let i=0;i<placements.length;i++){
  const offset=placements[i],previous=placements[i-1],corridor=offset.y-gap/2;
  // Connect in row gaps, changing rows along the outside right edge.
  if(!previous)push({x:0,y:corridor,type:'travel'});
  else if(previous.y!==offset.y){
   push({x:moves.at(-1).x,y:previous.y-gap/2,type:'travel'});
   push({x:usedX,y:previous.y-gap/2,type:'travel'});
   push({x:usedX,y:corridor,type:'travel'});
  }else push({x:moves.at(-1).x,y:corridor,type:'travel'});
  push({x:offset.x,y:corridor,type:'travel'});
  push({x:offset.x,y:offset.y,type:'travel'});
  for(const p of part.moves.slice(1))push({...p,x:p.x+offset.x,y:p.y+offset.y});
 }
 const last=placements.at(-1);
 push({x:moves.at(-1).x,y:last.y-gap/2,type:'travel'});
 push({x:usedX,y:last.y-gap/2,type:'travel'});
 push({x:usedX,y:0,type:'travel'});
 let length=0;for(let i=1;i<moves.length;i++)length+=Math.hypot(moves[i].x-moves[i-1].x,moves[i].y-moves[i-1].y);
 const code=['(OBLIK - GRBL XY repeated shapes)','(Sheet '+sheetWidth+' x '+sheetHeight+' mm; copies '+copies+')','(Origin bottom left of sheet; heat M3 S1000 and M5)','G21','G90','G94','M3 S1000','G1 X0.000 Y0.000 F'+options.feed.toFixed(3),...moves.slice(1).map(p=>'G1 X'+p.x.toFixed(3)+' Y'+p.y.toFixed(3)),'(End at maximum X on entry Y height)','M5'].join('\n')+'\n';
 return {...part,moves,length,minutes:length/options.feed,code,placements,copies,capacity,usedX,usedY,partTotalX:part.totalX,partTotalY:part.totalY,totalX:sheetWidth,totalY:sheetHeight,count:part.count*copies,entries:part.entries*copies,originalPoints:part.originalPoints*copies};
}

function planBase(mask, w, h, options) {
  const {width, margin, feed, bedX, bedY} = options;
  if (![width,margin,feed,bedX,bedY].every(n=>Number.isFinite(n)&&n>0)) fail('Sve dimenzije i brzina moraju biti pozitivni brojevi.');
  if (mask.length!==w*h || w<1 || h<1) fail('Neispravna slika.');
  const at=(x,y)=>x>=0&&y>=0&&x<w&&y<h ? !!mask[y*w+x] : false;
  for(let y=0;y<h-1;y++) for(let x=0;x<w-1;x++) {
    const a=at(x,y),b=at(x+1,y),c=at(x,y+1),d=at(x+1,y+1);
    if(a===d && b===c && a!==b) fail('Konture se dodiruju u jednoj tački. Promeni prag ili rezoluciju, ili razdvoji dodir u izvornoj slici.');
  }
  const scale=width/w, pad=margin/scale,shapeWidth=width,shapeHeight=h*scale;
  const packagingFrame=options.packagingFrame===true,squareFrame=packagingFrame&&options.frameShape==='square';
  const totalX=squareFrame?Math.max(width,h*scale)+2*margin:width+2*margin,totalY=squareFrame?totalX:h*scale+2*margin;
  const extraX=(totalX-width-2*margin)/scale,extraY=(totalY-h*scale-2*margin)/scale;
  if(totalX>bedX || totalY>bedY) fail('Putanja sa marginama prelazi zadati radni hod mašine.');
  if(scale<0.002) fail('Premala dimenzija za rezoluciju koordinata od 0,001 mm.');
  const key=p=>p.x+','+p.y, edges=new Map();
  const edge=(x,y,X,Y)=>{ const p={x,y}; const k=key(p); if(edges.has(k)) fail('Dvosmislena kontura. Promeni prag slike.'); edges.set(k,{a:p,b:{x:X,y:Y}}); };
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(at(x,y)) {
    if(!at(x,y-1)) edge(x,y,x+1,y);
    if(!at(x+1,y)) edge(x+1,y,x+1,y+1);
    if(!at(x,y+1)) edge(x+1,y+1,x,y+1);
    if(!at(x-1,y)) edge(x,y+1,x,y);
  }
  if(!edges.size) fail('Nema tamnih oblika. Promeni prag ili obrni boje.');
  const loops=[];
  while(edges.size) {
    const first=edges.values().next().value.a, points=[]; let p=first;
    do {
      const e=edges.get(key(p)); if(!e) fail('Otvorena kontura.');
      edges.delete(key(p)); points.push(p);
      if(e.a.x===e.b.x) points.push({x:p.x,y:(p.y+e.b.y)/2});
      p=e.b;
    } while(key(p)!==key(first));
    loops.push(points);
    if(loops.length>250) fail('Previše kontura (više od 250). Očisti šum na slici ili smanji rezoluciju.');
  }
  const count=loops.length; let frame=[{x:-pad,y:h+pad}];
  for(let y=h-1;y>=0;y--) frame.push({x:-pad,y:y+.5});
  frame.push({x:-pad,y:-pad-extraY},{x:w+pad+extraX,y:-pad-extraY});
  for(let y=0;y<h;y++) frame.push({x:w+pad+extraX,y:y+.5});
  frame.push({x:w+pad+extraX,y:h+pad});
  loops.push(frame);
  const rows=Array.from({length:h},()=>[]);
  loops.forEach((pts,owner)=>pts.forEach((p,index)=>{
    if(p.y%1===.5 && p.y>=0 && p.y<h) rows[Math.floor(p.y)].push({x:p.x,owner,index});
  }));
  const candidates=[];
  rows.forEach((row,y)=>{
    row.sort((a,b)=>a.x-b.x);
    for(let i=1;i<row.length;i++) {
      const a=row[i-1],b=row[i]; if(a.owner===b.owner) continue;
      const solid=at(Math.floor((a.x+b.x)/2),y);
      candidates.push({a,b,solid,cost:(b.x-a.x)*(solid?10:1)});
    }
  });
  candidates.sort((a,b)=>a.cost-b.cost);
  const parents=loops.map((_,i)=>i), find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  let links=loops.map(()=>[]), bridges=[];
  for(const e of candidates){
    const a=find(e.a.owner),b=find(e.b.owner);if(a===b)continue;parents[a]=b;
    links[e.a.owner].push({here:e.a.index,there:e.b.index,owner:e.b.owner,solid:e.solid});
    links[e.b.owner].push({here:e.b.index,there:e.a.index,owner:e.a.owner,solid:e.solid});
    bridges.push(e);if(bridges.length===count)break;
  }
  if(bridges.length!==count) fail('Nije pronađena povezana putanja bez presecanja kontura.');
  const requestedRoute=options.route||'horizontal';
  if(!['horizontal','nearest'].includes(requestedRoute))fail('Nepoznat način povezivanja kontura.');
  let routeUsed='horizontal',routeNote='';
  if(requestedRoute==='nearest'){
   const optimized=nearestConnections(loops.slice(0,count),frame[0],at,candidates);
   if(optimized){links=optimized.links;bridges=optimized.bridges;frame=optimized.frame;loops[count]=frame;routeUsed='nearest';}
   else routeNote='Za ovaj raspored nije pronađen potpun skup kraćih spojeva; upotrebljen je horizontalni obilazak sa okvirom. ';
  }
  const moves=[];
  const push=(p,type)=>moves.push({x:(p.x+pad)*scale,y:(h+pad-p.y)*scale,type});
  push(frame[0],'start');
  function walk(owner,start,parent){
    const pts=loops[owner], attachments=new Map();
    for(const link of links[owner])if(link.owner!==parent){if(!attachments.has(link.here))attachments.set(link.here,[]);attachments.get(link.here).push(link);}
    for(let j=0;j<pts.length;j++){
      const i=(start+j)%pts.length;
      for(const link of attachments.get(i)||[]){
        const type=link.solid?'entry':'travel';
        push(loops[link.owner][link.there],type);walk(link.owner,link.there,owner);push(pts[i],type);
      }
      if(pts.length>1)push(pts[(i+1)%pts.length],owner===count?'frame':'contour');
    }
  }
  walk(count,0,-1);
  // The packaging perimeter is cut last, after the wire returns through its entry cuts.
  if(packagingFrame&&routeUsed==='nearest'){
   for(const p of [{x:w+pad+extraX,y:h+pad},{x:w+pad+extraX,y:-pad-extraY},{x:-pad,y:-pad-extraY},frame[0]])push(p,'frame');
  }
  // End at the right corner on the entry Y height.
  const beforeLast=moves.at(-2),lastMove=moves.at(-1);
  if(lastMove.type==='frame'&&lastMove.x===0&&lastMove.y===0&&beforeLast.x===totalX&&beforeLast.y===0)moves.pop();
  else moves.push({x:totalX,y:0,type:'travel'});
  // Only merge collinear forward moves of the same kind; preserve every reversal.
  const compact=[];
  for(const p of moves){
    while(compact.length>=2){const b=compact[compact.length-1],a=compact[compact.length-2];
      if(p.type!==b.type)break;
      const ux=b.x-a.x,uy=b.y-a.y,vx=p.x-b.x,vy=p.y-b.y;
      if(Math.abs(ux*vy-uy*vx)>1e-8 || ux*vx+uy*vy<=0)break;
      compact.pop();
    }compact.push(p);
  }
  const smoothing=Number(options.smoothing||0);
  if(!Number.isFinite(smoothing)||smoothing<0||smoothing>2)fail('Zaglađivanje mora biti između 0 i 2 piksela.');
  let output=compact;
  if(smoothing>0){output=smoothMoves(compact,smoothing*scale);if(collision(output))fail('Zaglađivanje bi spojilo ili preseklo konture. Smanji zaglađivanje ili povećaj rezoluciju.');}
  // Validate unsmoothed optimized geometry too; repeated out-and-back bridges are intentional.
  if(routeUsed==='nearest'&&collision(output))fail('Povezana putanja ima nedozvoljen presek. Izaberi horizontalno povezivanje.');
  const originalPoints=compact.length;
  if(output!==compact){compact.length=0;for(const p of output)compact.push(p);}
  const segmentLength=Number(options.segmentLength||0);
  if(!Number.isFinite(segmentLength)||segmentLength<0||segmentLength>10)fail('Neispravan korak G-code tačaka.');
  if(segmentLength>0){const dense=[compact[0]];for(let i=1;i<compact.length;i++){const a=compact[i-1],b=compact[i],steps=b.type==='contour'?Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/segmentLength)):1;if(dense.length+steps>500000)fail('Previše G-code tačaka. Izaberi veći korak ili manji oblik.');for(let j=1;j<=steps;j++)dense.push(j===steps?b:{x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps,type:b.type});}compact.length=0;for(const p of dense)compact.push(p);}
  let length=0;for(let i=1;i<compact.length;i++)length+=Math.hypot(compact[i].x-compact[i-1].x,compact[i].y-compact[i-1].y);
  const code=['(OBLIK - GRBL XY hot wire)','(Set work origin at entry X0 Y0; heat M3 S1000 and M5)','(Review entry slits and run cold before cutting)','G21','G90','G94','M3 S1000','G1 X0.000 Y0.000 F'+feed.toFixed(3),...compact.slice(1).map(p=>'G1 X'+p.x.toFixed(3)+' Y'+p.y.toFixed(3)),'(End at maximum X on entry Y height)','M5'].join('\n')+'\n';
  return repeatOnSheet({packagingFrame:packagingFrame||routeUsed==='horizontal',shapeWidth,shapeHeight,routeUsed,routeNote,originalPoints,smoothing,moves:compact,loops:loops.slice(0,count),count,bridges,entries:bridges.filter(b=>b.solid).length,length,totalX,totalY,scale,pad,code,minutes:length/feed},options);
}
function plan(mask,w,h,options){
 const heat=options.heat===undefined?1000:Number(options.heat);if(!Number.isInteger(heat)||heat<0||heat>1000)fail('Snaga grejanja mora biti ceo broj od 0 do 1000.');
 const direction=options.direction||'up';if(!['up','down'].includes(direction))fail('Nepoznat smer sečenja.');
 let input=mask;if(direction==='down'){input=new Uint8Array(mask.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++)input[(h-1-y)*w+x]=mask[y*w+x];}
 const result=planBase(input,w,h,options);result.direction=direction;
 if(direction==='down'){result.moves=result.moves.map(p=>({...p,y:p.y===0?0:-p.y}));result.code=result.code.replace(/Y(-?\d+\.\d+)/g,(_,y)=>'Y'+(-Number(y)).toFixed(3)).replace(/\(Origin bottom left of sheet; heat M3 S1000 and M5\)/,'(Origin TOP LEFT of sheet; negative Y down)');result.code='(TOP LEFT origin X0 Y0; cutting DOWN in negative Y)\n'+result.code;}
 const positioning=options.positioning||'absolute';if(!['absolute','relative'].includes(positioning))fail('Nepoznat način pozicioniranja.');result.positioning=positioning;
 if(positioning==='relative'){
  let x=0,y=0;
  result.code=result.code.split('\n').filter(line=>!/^\((Set work origin|Origin |TOP LEFT|End at work origin)/.test(line)).map(line=>{
   if(line==='G90')return 'G91';
   const m=line.match(/^G1 X(-?[\d.]+) Y(-?[\d.]+)(.*)$/);if(!m)return line;
   // Difference rounded endpoints in integer micrometers, avoiding cumulative rounding drift.
   const nx=Math.round(Number(m[1])*1000),ny=Math.round(Number(m[2])*1000),dx=nx-x,dy=ny-y;x=nx;y=ny;
   return 'G1 X'+(dx/1000).toFixed(3)+' Y'+(dy/1000).toFixed(3)+m[3];
  }).join('\n').trimEnd();
  result.code='(RELATIVE G91 - start at current wire position; no work-zero travel)\n'+result.code+'\nG90\n';
 }
 result.heat=heat;result.code=result.code.replace(/^M3 S1000$/m,heat===0?'M5':'M3 S'+heat).replace(/heat M3 S1000 and M5/g,heat===0?'heat OFF':'heat M3 S'+heat+' and M5');
 return result;
}
const api={plan};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoamCNC=api;
})(typeof window!=='undefined'?window:globalThis);
