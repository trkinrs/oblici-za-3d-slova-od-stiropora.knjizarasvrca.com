(() => {
'use strict';
const $=id=>document.getElementById(id), canvas=$('preview'),ctx=canvas.getContext('2d');
let source=null,result=null,raster=null,loadVersion=0,outlineNote="",autoTimer=null,gcodePoints=[],playFrame=null;
function status(message,error=false){$('status').textContent=message;$('status').dataset.error=String(error);}
function scheduleGenerate(){clearTimeout(autoTimer);if(!$('auto-generate').checked||(!source&&$('source-mode').value!=='text'&&!$('editor-use').checked))return;autoTimer=setTimeout(()=>{$('generate').click();},500);}
function invalidate(){clearTimeout(autoTimer);stopGcode();gcodePoints=[];$('gcode-play').disabled=true;$('gcode-step').disabled=true;$('gcode-position').textContent='Generiši putanju za pregled.';$('gcode-preview').getContext('2d').clearRect(0,0,1100,500);result=null;raster=null;$('confirm').checked=false;$('confirm').disabled=true;$('download').disabled=true;$('progress').disabled=true;$('stats').replaceChildren();$('code').textContent='Generiši novu putanju.';$('code-line-count').textContent='(0 linija)';draw();}
function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 if(!result){ctx.fillStyle='#82978c';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText(source?'Slika je učitana. Generiši putanju.':'Tvoja sledeća ideja počinje ovde.',550,380);return;}
 const fit=Math.min(980/result.totalX,640/result.totalY),ox=(1100-result.totalX*fit)/2,oy=(760-result.totalY*fit)/2;
 const point=p=>({x:ox+p.x*fit,y:oy+(result.direction==='down'?-p.y:result.totalY-p.y)*fit});
 if($('show-image').checked && raster){ctx.globalAlpha=.2;ctx.imageSmoothingEnabled=true;const m=result.pad*result.scale;for(const p of result.placements||[{x:0,y:0}])ctx.drawImage(raster,ox+(p.x+m)*fit,oy+(result.direction==='down'?p.y+m:result.totalY-p.y-m-result.shapeHeight)*fit,raster.width*result.scale*fit,raster.height*result.scale*fit);ctx.globalAlpha=1;}
 ctx.strokeStyle='#c6d2c8';ctx.lineWidth=1;ctx.strokeRect(ox,oy,result.totalX*fit,result.totalY*fit);
 const target=result.length*Number($('progress').value)/1000;let traveled=0,last=point(result.moves[0]);
 for(let i=1;i<result.moves.length;i++){
  const a=result.moves[i-1],b=result.moves[i],length=Math.hypot(b.x-a.x,b.y-a.y),fraction=Math.min(1,Math.max(0,(target-traveled)/length));if(fraction<=0)break;
  const p=point(a),q=point({x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction});
  ctx.strokeStyle=b.type==='entry'?'#e56740':b.type==='contour'?'#157866':b.type==='frame'?'#8355b5':'#8b99a0';ctx.lineWidth=b.type==='entry'?2.5:1.5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();last=q;traveled+=length;if(fraction<1)break;
 }
 ctx.fillStyle='#183d38';ctx.beginPath();ctx.arc(last.x,last.y,5,0,Math.PI*2);ctx.fill();ctx.font='13px sans-serif';ctx.textAlign='left';ctx.fillText('X0 Y0 · početak / kraj',ox,result.direction==='down'?oy-12:oy+result.totalY*fit+24);
}
function textStyle(){const [weight,family]=$('text-font').value.split('|');return {weight,family};}
function textPreview(){const {weight,family}=textStyle();$('text-sample').textContent=$('text-input').value||'Tvoj tekst';$('text-sample').style.fontFamily=family;$('text-sample').style.fontWeight=weight;}
function renderText(){
 const text=$('text-input').value.trim();if(!text)throw new Error('Unesi tekst za sečenje.');
 if(!$('text-spacing').checkValidity())throw new Error('Razmak slova mora biti od 0 do 40 px.');
 const {weight,family}=textStyle(),c=document.createElement('canvas'),g=c.getContext('2d'),font=weight+' 720px '+family;g.font=font;
 const letters=Array.from(text),spacing=Number($('text-spacing').value)*4,widths=letters.map(l=>g.measureText(l).width);
 c.width=Math.ceil(widths.reduce((a,b)=>a+b,0)+spacing*(letters.length-1)+320);c.height=1280;
 g.font=font;g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';g.textBaseline='alphabetic';let x=160;letters.forEach((l,i)=>{g.fillText(l,x,940);x+=widths[i]+spacing;});return c;
}
function prepareOutline(){
 outlineNote='';
 if($('source-mode').value!=='image'||$('image-treatment').value==='silhouette')return source;
 const factor=Math.min(1,2048/Math.max(source.width,source.height)),w=Math.round(source.width*factor),h=Math.round(source.height*factor),c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='white';g.fillRect(0,0,w,h);g.drawImage(source,0,0,w,h);
 const pixels=g.getImageData(0,0,w,h),data=pixels.data,mask=new Uint8Array(w*h),outside=new Uint8Array(w*h),queue=new Int32Array(w*h),threshold=Number($('threshold').value),invert=$('invert').checked;let ink=0,head=0,tail=0;
 for(let i=0;i<mask.length;i++){const k=i*4;mask[i]=((.2126*data[k]+.7152*data[k+1]+.0722*data[k+2])<threshold)!==invert?1:0;ink+=mask[i];}
 const visit=i=>{if(!mask[i]&&!outside[i]){outside[i]=1;queue[tail++]=i;}};
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w;if(x>0)visit(i-1);if(x<w-1)visit(i+1);if(i>=w)visit(i-w);if(i<w*(h-1))visit(i+w);}
 let enclosed=0;for(let i=0;i<mask.length;i++)if(!mask[i]&&!outside[i])enclosed++;
 const explicit=$('image-treatment').value==='outline';
 if(!explicit&&enclosed<=ink*4)return source;
 if(enclosed===0)throw new Error('Obris nije zatvoren. Zatvori prekid linije ili izaberi obradu „Silueta”.');
 for(let i=0;i<mask.length;i++){const k=i*4,v=outside[i]?255:0;data[k]=data[k+1]=data[k+2]=v;data[k+3]=255;}g.putImageData(pixels,0,0);
 outlineNote='Prepoznat zatvoren obris: unutrašnjost je popunjena. Za očuvanje rupa izaberi Silueta. ';return c;
}
function removeSpecks(mask,w,h,limit){
 if(!limit)return 0;
 const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let removed=0;
 for(let start=0;start<mask.length;start++){if(!mask[start]||seen[start])continue;let head=0,tail=1;queue[0]=start;seen[start]=1;
  while(head<tail){const i=queue[head++],x=i%w;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i<w*(h-1)?i+w:-1])if(j>=0&&mask[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
  if(tail<=limit){for(let i=0;i<tail;i++)mask[queue[i]]=0;removed++;}
 }return removed;
}
function makeMask(useEditor=true){
 const editing=useEditor&&$('editor-use').checked;if(editing)outlineNote='';const prepared=editing?CNCEditor.render():prepareOutline(),normalized=editing||prepared!==source;
 const resolution=Number($('resolution').value),factor=Math.min(1,resolution/Math.max(prepared.width,prepared.height)),w=Math.max(1,Math.round(prepared.width*factor)),h=Math.max(1,Math.round(prepared.height*factor));
 const c=document.createElement('canvas');c.width=w;c.height=h;const cx=c.getContext('2d',{willReadFrequently:true});cx.fillStyle='white';cx.fillRect(0,0,w,h);cx.drawImage(prepared,0,0,w,h);
 const data=cx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h),threshold=normalized?128:Number($('threshold').value),invert=normalized?false:$('invert').checked;
 let minX=w,minY=h,maxX=-1,maxY=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,k=i*4;const dark=(.2126*data[k]+.7152*data[k+1]+.0722*data[k+2])<threshold;if(dark!==invert){mask[i]=1;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 const removed=removeSpecks(mask,w,h,Number($('specks').value));
 if(removed){outlineNote+='Uklonjeno sitnih tačaka: '+removed+'. ';minX=w;minY=h;maxX=maxY=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 if(maxX<0)throw new Error('Nenađeni oblici: promeni prag ili obrni boje.');
 const W=maxX-minX+1,H=maxY-minY+1,cropped=new Uint8Array(W*H);raster=document.createElement('canvas');raster.width=W;raster.height=H;const rc=raster.getContext('2d'),pixels=rc.createImageData(W,H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;cropped[i]=mask[(y+minY)*w+x+minX];if(cropped[i]){pixels.data[i*4]=24;pixels.data[i*4+1]=61;pixels.data[i*4+2]=56;pixels.data[i*4+3]=255;}}
 if(editing){let components=0;const seen=new Uint8Array(cropped.length),queue=new Int32Array(cropped.length);for(let start=0;start<cropped.length;start++){if(!cropped[start]||seen[start])continue;if(++components>1)throw new Error('Elementi u editoru nisu spojeni u jedan komad. Pomeri ih tako da se oblik i postolje preklapaju.');let head=0,tail=1;queue[0]=start;seen[start]=1;while(head<tail){const i=queue[head++],x=i%W;for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,i>=W?i-W:-1,i<W*(H-1)?i+W:-1])if(j>=0&&cropped[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}}}
 rc.putImageData(pixels,0,0);return {mask:cropped,w:W,h:H};
}
$('generate').addEventListener('click',()=>{
 clearTimeout(autoTimer);
 invalidate();if($('source-mode').value==='text'&&!$('editor-use').checked){try{source=renderText();}catch(error){status(error.message,true);return;}}if(!source&&!$('editor-use').checked){status('Prvo učitaj sliku ili izaberi primer.',true);return;}
 try{
  const options={};for(const id of ['width','margin','feed','heat','bedX','bedY']){if(!$(id).checkValidity())throw new Error('Proveri opseg polja: '+$(id).parentElement.firstChild.textContent);options[id]=Number($(id).value);}
  options.positioning=$('positioning').value;options.direction=$('direction').value;options.segmentLength=Number($('segment-length').value);options.sheet=$('sheet').value;options.copies=Number($('copies').value);options.copyGap=Number($('copy-gap').value);options.packagingFrame=$('packaging-frame').checked;options.frameShape=$('frame-shape').value;options.route=$('route').value;options.smoothing=Number($('smoothing').value);const {mask,w,h}=makeMask();result=FoamCNC.plan(mask,w,h,options);$('code').textContent=result.code;$('code-line-count').textContent='('+result.code.trimEnd().split(/\r?\n/).length.toLocaleString('sr-Latn')+' linija)';$('progress').disabled=false;$('progress').value=1000;$('confirm').disabled=false;loadGcode();
  const stats=[[result.count,'zatvorenih kontura'],[result.entries,'ulaznih proreza'],[result.totalX.toFixed(1)+' × '+result.totalY.toFixed(1),result.copies?'mm · ploča':'mm sa marginama'],[result.minutes.toFixed(1),'min · bez ubrzanja'],[(result.length/1000).toFixed(2),'m ukupne putanje']];
  if(result.copies)stats.unshift([result.copies+' / '+result.capacity,'kopija / kapacitet ploče']);
  for(const [value,label] of stats){const box=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');b.textContent=value;small.textContent=label;box.append(b,small);$('stats').append(box);}
  status(outlineNote+result.routeNote+'Povezana putanja je spremna: '+result.count+' kontura, '+result.moves.length+' tačaka. Rezolucija '+result.scale.toFixed(3)+' mm/px. Zaglađivanje '+(result.smoothing*result.scale).toFixed(3)+' mm ('+result.originalPoints+' → '+result.moves.length+' tačaka). Pregledaj narandžaste ulaze i simulaciju.');draw();
 }catch(error){invalidate();status(error.message,true);}
});
$('file').addEventListener('change',async()=>{
 const version=++loadVersion;source=null;invalidate();const file=$('file').files[0];if(!file)return;
 $('filename').textContent=file.name;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024){status('Izaberi PNG, JPG ili WebP sliku do 15 MB.',true);return;}
 const url=URL.createObjectURL(file);status('Učitavanje slike…');
 try{const img=new Image();img.src=url;await img.decode();if(version!==loadVersion)return;if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('Slika je prevelika. Smanji je na manje od 40 megapiksela.');source=img;status('Slika je učitana. Podesi dimenzije i generiši putanju.');draw();scheduleGenerate();}catch(error){if(version===loadVersion)status('Slika nije učitana. '+error.message,true);}finally{URL.revokeObjectURL(url);}
});
$('demo').addEventListener('click',()=>{
 ++loadVersion;const c=document.createElement('canvas');c.width=260;c.height=160;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,260,160);g.fillStyle='black';g.fillRect(15,15,95,130);g.fillRect(145,15,95,130);g.fillStyle='white';g.fillRect(40,40,45,80);g.fillRect(170,35,45,35);g.fillRect(170,90,45,35);source=c;$('file').value='';$('filename').textContent='Primer · dva oblika, tri otvora';$('invert').checked=false;invalidate();$('generate').click();
});
for(const id of ['threshold','invert','resolution','width','margin','feed','heat','bedX','bedY','smoothing','positioning','direction','segment-length','route','packaging-frame','frame-shape','sheet','copies','copy-gap','specks','image-treatment','text-input','text-font','text-spacing'])$(id).addEventListener('input',()=>{invalidate();textPreview();$('sheet-settings').hidden=$('sheet').value==='none';$('threshold-value').value=$('threshold').value;status($('auto-generate').checked?'Podešavanja su promenjena. Pripremam novu putanju…':'Podešavanja su promenjena. Ponovo generiši putanju.');scheduleGenerate();});
$('source-mode').addEventListener('change',()=>{++loadVersion;source=null;invalidate();const text=$('source-mode').value==='text';$('text-panel').hidden=!text;$('image-panel').hidden=$('source-mode').value!=='image';$('gallery-panel').hidden=$('source-mode').value!=='gallery';$('image-treatment').disabled=$('source-mode').value!=='image';$('file').value='';$('invert').checked=false;textPreview();status(text?'Unesi tekst, izaberi font i generiši putanju.':$('source-mode').value==='gallery'?'Izaberi oblik iz galerije.':'Učitaj sliku.');scheduleGenerate();});
$('auto-generate').addEventListener('change',()=>{clearTimeout(autoTimer);if($('auto-generate').checked)scheduleGenerate();});
textPreview();
$('progress').addEventListener('input',draw);$('show-image').addEventListener('change',draw);
$('confirm').addEventListener('change',()=>{$('download').disabled=!result||!$('confirm').checked;});
$('download').addEventListener('click',()=>{if(!result||!$('confirm').checked)return;const url=URL.createObjectURL(new Blob([result.code],{type:'text/plain'})),a=document.createElement('a');a.href=url;const sourceName=$('editor-use').checked?'oblik-sa-postoljem':$('source-mode').value==='text'?$('text-input').value:($('file').files[0]?.name||$('filename').textContent);
const base=sourceName.replace(/\.(png|jpe?g|webp|svg)$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim().replace(/[. ]+$/,'').slice(0,120)||'oblik';
const dimension=n=>Number(n.toFixed(1)).toString();
a.download=base+'_'+dimension(result.shapeWidth)+'x'+dimension(result.shapeHeight)+'mm'+(result.positioning==='relative'?'_relative':'')+(result.copies?'_'+result.copies+'kom_'+result.totalX+'x'+result.totalY+'mm':'')+'.gcode';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
const exampleButtons=[...document.querySelectorAll('.cnc-example[data-image]')];
function clearExample(){for(const button of exampleButtons)button.setAttribute('aria-pressed','false');}
// Queue every click so loading a second shape never cancels the first addition.
let galleryQueue=Promise.resolve();
for(const button of exampleButtons)button.addEventListener('click',()=>{
 galleryQueue=galleryQueue.then(async()=>{
  status('Učitavanje oblika…');
  const img=new Image();img.src=button.dataset.image;await img.decode();
  if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('Slika je prevelika.');
  $('source-mode').value='gallery';$('source-mode').dispatchEvent(new Event('change'));
  $('filename').textContent=button.dataset.title;
  $('threshold').value='128';$('threshold-value').value='128';
  source=img;makeMask(false);CNCEditor.addImage(raster,button.dataset.title);
  clearExample();button.setAttribute('aria-pressed','true');
  $('editor-note').textContent=button.dataset.title+' je dodat. Prevuci element na željeno mesto; donji desni ugao menja veličinu. Svaki klik u galeriji dodaje novi element.';
  status('Oblik je dodat u editor. Rasporedi elemente po želji.');
 }).catch(error=>{status('Oblik nije dodat. '+error.message,true);});
});
$('file').addEventListener('change',clearExample);$('demo').addEventListener('click',clearExample);$('source-mode').addEventListener('change',clearExample);

function stopGcode(){if(playFrame!==null)cancelAnimationFrame(playFrame);playFrame=null;$('gcode-play').textContent='▶ Pokreni pregled';}
function loadGcode(){gcodePoints=[];let relative=false,x=0,y=0;result.code.split(/\r?\n/).forEach((line,i)=>{if(line==='G91')relative=true;if(line==='G90')relative=false;const m=line.match(/^G1 X(-?[\d.]+) Y(-?[\d.]+)/);if(m){const nx=Number(m[1]),ny=Number(m[2]);x=relative?(Math.round(x*1000)+Math.round(nx*1000))/1000:nx;y=relative?(Math.round(y*1000)+Math.round(ny*1000))/1000:ny;gcodePoints.push({x,y,line:i+1});}});$('gcode-step').max=Math.max(0,gcodePoints.length-1);$('gcode-step').value=gcodePoints.length-1;$('gcode-step').disabled=false;$('gcode-play').disabled=false;drawGcode();}
function drawGcode(){if(!result||!gcodePoints.length)return;const c=$('gcode-preview'),g=c.getContext('2d'),fit=Math.min(1000/result.totalX,400/result.totalY),ox=(1100-result.totalX*fit)/2,oy=(500-result.totalY*fit)/2,point=p=>({x:ox+p.x*fit,y:oy+(result.direction==='down'?-p.y:result.totalY-p.y)*fit}),step=Number($('gcode-step').value);g.clearRect(0,0,1100,500);g.strokeStyle='#b8c8c1';g.strokeRect(ox,oy,result.totalX*fit,result.totalY*fit);g.lineWidth=1.5;g.strokeStyle='#2377aa';g.beginPath();for(let i=0;i<=step;i++){const p=point(gcodePoints[i]);if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.stroke();const current=gcodePoints[step],p=point(current);g.fillStyle='#e56740';g.beginPath();g.arc(p.x,p.y,5,0,Math.PI*2);g.fill();$('gcode-position').textContent='Linija '+current.line+' · X '+current.x.toFixed(3)+' · Y '+current.y.toFixed(3)+' mm';}
$('gcode-step').addEventListener('input',()=>{stopGcode();drawGcode();});
$('gcode-play').addEventListener('click',()=>{if(playFrame!==null){stopGcode();return;}if(!result)return;if(Number($('gcode-step').value)>=gcodePoints.length-1)$('gcode-step').value=0;let last=performance.now(),position=Number($('gcode-step').value);$('gcode-play').textContent='Ⅱ Pauziraj';const tick=now=>{position+=(now-last)*.15;last=now;$('gcode-step').value=Math.min(gcodePoints.length-1,Math.floor(position));drawGcode();if(position>=gcodePoints.length-1)stopGcode();else playFrame=requestAnimationFrame(tick);};playFrame=requestAnimationFrame(tick);});

for(const id of ['editor-add','editor-image-add'])$(id).addEventListener('click',()=>{try{if($('source-mode').value==='text')source=renderText();if(!source)throw new Error('Prvo izaberi sliku, tekst ili galerijski oblik.');makeMask(false);CNCEditor.addImage(raster,$('source-mode').value==='text'?$('text-input').value:$('filename').textContent);$('editor-note').textContent='Oblik je dodat. Dodaj postolje i prevuci elemente da se preklapaju.';}catch(error){$('editor-note').textContent=error.message;}});
 document.addEventListener('cnc-editor-drag-start',invalidate);
 $('editor-letters').addEventListener('click',()=>{try{
 if($('source-mode').value!=='text')throw new Error('Izaberi izvor Tekst i unesi slova koja želiš da rasporediš.');
 if(!$('text-spacing').checkValidity())throw new Error('Razmak slova mora biti od 0 do 40 px.');
 const {weight,family}=textStyle();CNCEditor.addLetters($('text-input').value,weight+' 720px '+family,Number($('text-spacing').value)*4);
 $('editor-note').textContent='Svako slovo je poseban element. Prevuci slova na postolje tako da se preklapaju. Tačke i kvačice pomeraju se zajedno sa slovom, ali moraju biti spojene za sečenje jednog komada.';
 }catch(error){$('editor-note').textContent=error.message;}});
 document.addEventListener('cnc-editor-change',()=>{invalidate();scheduleGenerate();});
 draw();
})();
