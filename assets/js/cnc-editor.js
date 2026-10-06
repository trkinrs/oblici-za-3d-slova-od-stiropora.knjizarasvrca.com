(() => {
'use strict';
const $=id=>document.getElementById(id),canvas=$('editor-canvas'),g=canvas.getContext('2d'),items=[];let selected=-1,drag=null;
const change=()=>document.dispatchEvent(new Event('cnc-editor-change'));
function paint(ctx,scale=1){ctx.save();ctx.scale(scale,scale);ctx.fillStyle='#183d38';for(const e of items){if(e.image)ctx.drawImage(e.image,e.x,e.y,e.w,e.h);else if(e.kind==='ellipse'){ctx.beginPath();ctx.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,Math.PI*2);ctx.fill();}else ctx.fillRect(e.x,e.y,e.w,e.h);}ctx.restore();}
function draw(){g.clearRect(0,0,1000,700);paint(g);const e=items[selected];if(e){g.strokeStyle='#e56740';g.lineWidth=2;g.setLineDash([8,5]);g.strokeRect(e.x,e.y,e.w,e.h);g.setLineDash([]);g.fillStyle='#e56740';g.fillRect(e.x+e.w-7,e.y+e.h-7,14,14);}else if(!items.length){g.fillStyle='#64756b';g.font='22px sans-serif';g.textAlign='center';g.fillText('Dodaj trenutni oblik, pa postolje.',500,340);}
 $('editor-list').replaceChildren();items.forEach((e,i)=>{const o=document.createElement('option');o.value=i;o.textContent=e.name;$('editor-list').append(o);});$('editor-list').value=selected;
 for(const key of ['x','y','w','h']){$('editor-'+key).disabled=!e;if(e)$('editor-'+key).value=Math.round(e[key]);}
 $('editor-delete').disabled=!e;$('editor-duplicate').disabled=!e;
}
function add(e){if(items.length>=30)throw new Error('Najviše 30 elemenata u editoru.');items.push(e);selected=items.length-1;$('editor-use').checked=true;draw();change();}
function constrain(e){e.w=Math.max(10,Math.min(980,e.w));e.h=Math.max(10,Math.min(680,e.h));e.x=Math.max(0,Math.min(1000-e.w,e.x));e.y=Math.max(0,Math.min(700-e.h,e.y));}
function shape(kind){try{const e=items[selected],w=e?Math.min(900,e.w+40):500,h=kind==='ellipse'?90:60;const next={kind,name:kind==='ellipse'?'Ovalno postolje':'Pravougaono postolje',x:e?e.x-20:250,y:e?e.y+e.h-20:450,w,h};constrain(next);add(next);}catch(e){$('editor-note').textContent=e.message;}}
$('editor-rect').addEventListener('click',()=>shape('rect'));$('editor-ellipse').addEventListener('click',()=>shape('ellipse'));
$('editor-list').addEventListener('change',()=>{selected=Number($('editor-list').value);draw();});
$('editor-delete').addEventListener('click',()=>{if(selected<0)return;items.splice(selected,1);selected=items.length-1;draw();change();});
$('editor-duplicate').addEventListener('click',()=>{try{const e=items[selected];if(!e)return;const copy={...e,x:e.x+30,y:e.y+30,name:e.name+' · kopija'};constrain(copy);add(copy);}catch(e){$('editor-note').textContent=e.message;}});
for(const key of ['x','y','w','h'])$('editor-'+key).addEventListener('change',()=>{const e=items[selected],v=Number($('editor-'+key).value);if(!e||!Number.isFinite(v)){draw();return;}e[key]=v;constrain(e);draw();change();});
$('editor-use').addEventListener('change',change);
function point(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*1000/r.width,y:(event.clientY-r.top)*700/r.height};}
canvas.addEventListener('pointerdown',event=>{const p=point(event),current=items[selected];if(current&&Math.hypot(p.x-current.x-current.w,p.y-current.y-current.h)<22){drag={mode:'resize',p,initial:{...current}};}else{selected=items.findLastIndex(e=>p.x>=e.x&&p.x<=e.x+e.w&&p.y>=e.y&&p.y<=e.y+e.h);drag=selected<0?null:{mode:'move',p,initial:{...items[selected]}};}if(drag){canvas.setPointerCapture(event.pointerId);document.dispatchEvent(new Event('cnc-editor-drag-start'));}draw();});
canvas.addEventListener('pointermove',event=>{if(!drag)return;const p=point(event),e=items[selected],dx=p.x-drag.p.x,dy=p.y-drag.p.y;if(drag.mode==='move'){e.x=drag.initial.x+dx;e.y=drag.initial.y+dy;}else{e.w=drag.initial.w+dx;e.h=drag.initial.h+dy;}constrain(e);draw();});
function finish(){if(drag){drag=null;change();}}canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',finish);
canvas.addEventListener('keydown',event=>{const e=items[selected];if(!e)return;const d=event.shiftKey?10:1;if(event.key==='ArrowLeft')e.x-=d;else if(event.key==='ArrowRight')e.x+=d;else if(event.key==='ArrowUp')e.y-=d;else if(event.key==='ArrowDown')e.y+=d;else return;event.preventDefault();constrain(e);draw();change();});
window.CNCEditor={addLetters(text,font,spacing){
 const letters=Array.from(new Intl.Segmenter('sr',{granularity:'grapheme'}).segment(text.trim()),s=>s.segment);
 const visible=letters.filter(l=>!/^\s+$/u.test(l));
 if(!visible.length)throw new Error('Unesi tekst za sečenje.');
 if(items.length+visible.length>30)throw new Error('Najviše 30 elemenata u editoru. Skrati tekst ili obriši postojeće elemente.');
 const probe=document.createElement('canvas').getContext('2d');probe.font=font;
 let x=0;const entries=[];
 for(const letter of letters){const m=probe.measureText(letter);if(!/^\s+$/u.test(letter)){const left=Math.floor(x-m.actualBoundingBoxLeft),top=Math.floor(-m.actualBoundingBoxAscent),right=Math.ceil(x+m.actualBoundingBoxRight),bottom=Math.ceil(m.actualBoundingBoxDescent);entries.push({letter,x,left,top,right,bottom});}x+=m.width+spacing;}
 const minX=Math.min(...entries.map(e=>e.left)),minY=Math.min(...entries.map(e=>e.top)),maxX=Math.max(...entries.map(e=>e.right)),maxY=Math.max(...entries.map(e=>e.bottom)),factor=Math.min(800/Math.max(1,maxX-minX),350/Math.max(1,maxY-minY));
 const added=entries.map(e=>{const image=document.createElement('canvas');image.width=Math.max(1,e.right-e.left);image.height=Math.max(1,e.bottom-e.top);const ctx=image.getContext('2d');ctx.font=font;ctx.fillStyle='#183d38';ctx.fillText(e.letter,e.x-e.left,-e.top);return {image,name:'Slovo '+e.letter,x:100+(e.left-minX)*factor,y:80+(e.top-minY)*factor,w:image.width*factor,h:image.height*factor};});
 items.push(...added);selected=items.length-1;$('editor-use').checked=true;draw();change();
},addImage(image,name){const snapshot=document.createElement('canvas');snapshot.width=image.width;snapshot.height=image.height;snapshot.getContext('2d').drawImage(image,0,0);const factor=Math.min(600/image.width,400/image.height);add({image:snapshot,name:name||'Oblik',x:200+(items.length%6)*30,y:80+(items.length%6)*30,w:image.width*factor,h:image.height*factor});},render(){if(!items.length)throw new Error('Dodaj bar jedan element u editor.');const c=document.createElement('canvas');c.width=2000;c.height=1400;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);paint(ctx,2);return c;}};
draw();
})();
