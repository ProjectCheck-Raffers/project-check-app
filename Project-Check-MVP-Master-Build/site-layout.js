let activeSiteLayoutMap=null,activeSiteLayoutMarker=null,activeSiteLayoutAngle=0,activeSiteLayoutOrigin=null;
let activeSiteLayoutBoundaries=[],activeSiteLayoutBoundaryDraft=[],activeSiteLayoutBuildingConfirmed=false,activeSiteLayoutRotateHandle=null;
let activeSiteLayoutBaseLayer='satellite',activeSiteLayoutProjectId=null;

function siteLayoutDims(p){
const width=Number(projectFacts(p).width),length=Number(projectFacts(p).length);
return {width,length,ready:Number.isFinite(width)&&width>0&&Number.isFinite(length)&&length>0}
}
function normaliseSiteAddress(value){return String(value||"").trim().replace(/\s+/g," ").toLowerCase()}
function siteLayoutPostcode(p){
 const fromAddress=typeof extractProjectPostcode==="function"?extractProjectPostcode(p.address):"";
 return fromAddress||String(p.postcode||"").trim().toUpperCase()
}
async function geocodeSitePostcode(postcode){
 if(!postcode)return null;
 const response=await fetch("https://api.postcodes.io/postcodes/"+encodeURIComponent(postcode.replace(/\s+/g,"")),{headers:{Accept:"application/json"}});
 if(!response.ok)return null;
 const payload=await response.json();
 const result=payload?.result;
 if(!result||!Number.isFinite(Number(result.latitude))||!Number.isFinite(Number(result.longitude)))return null;
 return {lat:Number(result.latitude),lng:Number(result.longitude),label:result.postcode||postcode,source:"postcode"}
}
async function resolveProposedSite(p){
 const address=String(p.address||"").trim();
 if(!address)return null;
 try{
  const full=await geocode(address);
  if(full)return {lat:parseFloat(full.lat),lng:parseFloat(full.lon),label:full.display_name||address,source:"address"}
 }catch(e){}
 const postcode=siteLayoutPostcode(p);
 if(postcode){
  try{const byPostcode=await geocodeSitePostcode(postcode);if(byPostcode)return byPostcode}catch(e){}
  try{
   const fallback=await geocode(postcode);
   if(fallback)return {lat:parseFloat(fallback.lat),lng:parseFloat(fallback.lon),label:fallback.display_name||postcode,source:"postcode"}
  }catch(e){}
 }
 return null
}
function siteLayoutBoundaryGeoJSON(){
const features=[];
activeSiteLayoutBoundaries.forEach((line,index)=>{
 if(Array.isArray(line)&&line.length>=2)features.push({type:'Feature',geometry:{type:'LineString',coordinates:line.map(point=>[point.lng,point.lat])},properties:{kind:'saved',index}})
});
if(activeSiteLayoutBoundaryDraft.length){
 if(activeSiteLayoutBoundaryDraft.length===1){
  const p=activeSiteLayoutBoundaryDraft[0];
  features.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{kind:'draft'}})
 }else{
  features.push({type:'Feature',geometry:{type:'LineString',coordinates:activeSiteLayoutBoundaryDraft.map(point=>[point.lng,point.lat])},properties:{kind:'draft'}})
 }
}
return {type:'FeatureCollection',features}
}
function redrawSiteLayoutBoundaries(){
if(!activeSiteLayoutMap)return;
const srcId='site-layout-boundaries',data=siteLayoutBoundaryGeoJSON();
const apply=()=>{
 let src=activeSiteLayoutMap.getSource(srcId);
 if(src){src.setData(data);return}
 activeSiteLayoutMap.addSource(srcId,{type:'geojson',data});
 activeSiteLayoutMap.addLayer({id:srcId+'-line',type:'line',source:srcId,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#a15c00','line-width':4}});
 activeSiteLayoutMap.addLayer({id:srcId+'-point',type:'circle',source:srcId,filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':7,'circle-color':'#a15c00','circle-stroke-color':'#ffffff','circle-stroke-width':2}})
};
if(activeSiteLayoutMap.isStyleLoaded())apply();else activeSiteLayoutMap.once('load',apply)
}
function siteLayoutStatus(message){
const el=document.querySelector('#siteLayoutStatus');if(el)el.textContent=message
}
function siteLayoutBoundaryStatus(message){
const el=document.querySelector('#siteLayoutBoundaryStatus');if(el)el.textContent=message
}
function invalidateSiteLayoutHandoff(){
const p=getP(activeSiteLayoutProjectId);
if(p&&p.facts&&p.facts.siteLayoutStatus==='confirmed'){
 p.facts.siteLayoutStatus='in_progress';
 p.facts.siteBoundaryStatus='in_progress';
 save()
}
refreshSiteLayoutBoundaryUI()
}
function siteLayoutStep(){
const project=getP(activeSiteLayoutProjectId);
if(project?.facts?.siteLayoutStatus==='confirmed')return 'done';
return activeSiteLayoutBuildingConfirmed?'boundaries':'building'
}
function refreshSiteLayoutBoundaryUI(){
const panel=document.querySelector('#siteLayoutBoundaryStep'),main=document.querySelector('#siteLayoutMainBtn');
const confirmedState=document.querySelector('#siteLayoutBuildingConfirmedState');
const step=siteLayoutStep();
if(confirmedState)confirmedState.hidden=!activeSiteLayoutBuildingConfirmed;
if(panel)panel.hidden=!activeSiteLayoutBuildingConfirmed;
if(main){
 main.dataset.step=step;
 main.textContent=step==='building'?'Confirm building position':step==='boundaries'?'Confirm site layout':'Continue to Building Design'
}
const count=document.querySelector('#siteLayoutBoundaryCount');
if(count)count.textContent=activeSiteLayoutBoundaries.length?activeSiteLayoutBoundaries.length+' boundar'+(activeSiteLayoutBoundaries.length===1?'y':'ies')+' marked.':'No boundaries marked (optional).';
const finish=document.querySelector('#finishSiteLayoutBoundaryBtn');
if(finish)finish.disabled=activeSiteLayoutBoundaryDraft.length<2;
const undo=document.querySelector('#undoSiteLayoutBoundaryBtn');
if(undo)undo.disabled=!activeSiteLayoutBoundaryDraft.length&&!activeSiteLayoutBoundaries.length;
updateSiteLayoutReadouts()
}
function siteLayoutPointInPolygon(point,polygon){
let inside=false;
for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const xi=polygon[i].x,yi=polygon[i].y,xj=polygon[j].x,yj=polygon[j].y;
 const crosses=((yi>point.y)!==(yj>point.y))&&(point.x<(xj-xi)*(point.y-yi)/((yj-yi)||1e-9)+xi);
 if(crosses)inside=!inside
}
return inside
}
function siteLayoutBuildingScreenPolygon(p){
if(!activeSiteLayoutMap||!activeSiteLayoutMarker)return [];
const c=activeSiteLayoutMarker.getLngLat(),dims=siteLayoutDims(p);
if(!dims.ready)return [];
return metresToFootprintCorners({lat:c.lat,lng:c.lng},dims.width,dims.length,activeSiteLayoutAngle).map(([lat,lng])=>{
 const point=activeSiteLayoutMap.project([lng,lat]);return {x:point.x,y:point.y}
})
}
function normaliseSiteLayoutAngle(value){
 const number=Number(value)||0;
 return ((number%360)+360)%360
}
function siteLayoutMapViewSnapshot(){
 if(!activeSiteLayoutMap)return null;
 const center=activeSiteLayoutMap.getCenter();
 return {
  center:{lat:Number(center.lat),lng:Number(center.lng)},
  zoom:Number(activeSiteLayoutMap.getZoom()),
  bearing:normaliseSiteLayoutAngle(activeSiteLayoutMap.getBearing()),
  baseLayer:activeSiteLayoutBaseLayer
 }
}
function updateSiteLayoutBuildingGeometry(){
 const p=getP(activeSiteLayoutProjectId);
 if(!p||!activeSiteLayoutMap||!activeSiteLayoutMarker)return;
 const center=activeSiteLayoutMarker.getLngLat();
 updateBuildingLayer(p,activeSiteLayoutMap,{lat:center.lat,lng:center.lng},activeSiteLayoutAngle,'building');
 updateSiteLayoutReadouts()
}
function siteLayoutStepHint(){
 const step=siteLayoutStep();
 return step==='building'?'Drag the green handle to move. Drag ↻ to rotate.':step==='boundaries'?'Boundaries are optional.':'Saved.'
}
function updateSiteLayoutReadouts(){
 const building=normaliseSiteLayoutAngle(activeSiteLayoutAngle);
 const zoom=activeSiteLayoutMap?activeSiteLayoutMap.getZoom():0;
 const buildingText=document.querySelector('#siteLayoutBuildingAngle');
 if(buildingText)buildingText.textContent=Math.round(building)+'°';
 const zoomText=document.querySelector('#siteLayoutMapZoom');
 if(zoomText)zoomText.textContent=zoom.toFixed(1);
 const summary=document.querySelector('#siteLayoutActionSummary');
 if(summary)summary.textContent=siteLayoutStepHint()
}
function configureSiteLayoutMapInteractions(){
 if(!activeSiteLayoutMap)return;
 // Standard map gestures: drag to pan, pinch/scroll to zoom, two-finger twist (touch) or right-click/Ctrl-drag (desktop) to rotate the map view.
 // Map bearing is view state only; the building angle is real-world and is never changed by it. Pitch stays locked flat (see createProjectCheckMap).
 if(activeSiteLayoutMap.dragPan)activeSiteLayoutMap.dragPan.enable();
 if(activeSiteLayoutMap.dragRotate)activeSiteLayoutMap.dragRotate.enable();
 if(activeSiteLayoutMap.boxZoom)activeSiteLayoutMap.boxZoom.disable();
 if(activeSiteLayoutMap.scrollZoom)activeSiteLayoutMap.scrollZoom.enable();
 if(activeSiteLayoutMap.doubleClickZoom)activeSiteLayoutMap.doubleClickZoom.enable();
 if(activeSiteLayoutMap.keyboard)activeSiteLayoutMap.keyboard.enable();
 if(activeSiteLayoutMap.touchZoomRotate){
  activeSiteLayoutMap.touchZoomRotate.enable();
  activeSiteLayoutMap.touchZoomRotate.enableRotation()
 }
 // Once confirmed the handle must not swallow taps meant for boundary drawing.
 if(activeSiteLayoutMarker)activeSiteLayoutMarker.getElement().style.pointerEvents=activeSiteLayoutBuildingConfirmed?'none':'';
 const handleEl=activeSiteLayoutRotateHandle?.getElement();
 if(handleEl)handleEl.hidden=activeSiteLayoutBuildingConfirmed
}
function setSiteLayoutBaseLayer(layer){
 if(!['satellite','street'].includes(layer))return;
 activeSiteLayoutBaseLayer=layer;
 if(activeSiteLayoutMap){
  const apply=()=>setBaseLayer(activeSiteLayoutMap,layer);
  if(activeSiteLayoutMap.getLayer('esri-satellite-layer')&&activeSiteLayoutMap.getLayer('osm-street-layer'))apply();
  else activeSiteLayoutMap.once('load',apply)
 }
 document.querySelectorAll('input[name="siteLayoutMapLayer"]').forEach(input=>{input.checked=input.value===layer});
 updateSiteLayoutReadouts()
}
function setSiteLayoutBuildingVisibility(visible){
 if(!activeSiteLayoutMap)return;
 ['building-footprint-fill','building-footprint-line'].forEach(id=>{
  if(activeSiteLayoutMap.getLayer(id))activeSiteLayoutMap.setLayoutProperty(id,'visibility',visible?'visible':'none')
 });
 if(activeSiteLayoutMarker)activeSiteLayoutMarker.getElement().style.display=visible?'':'none'
}
function setSiteLayoutBoundaryVisibility(visible){
 if(!activeSiteLayoutMap)return;
 ['site-layout-boundaries-line','site-layout-boundaries-point'].forEach(id=>{
  if(activeSiteLayoutMap.getLayer(id))activeSiteLayoutMap.setLayoutProperty(id,'visibility',visible?'visible':'none')
 })
}
function siteLayoutRotateHandleLngLat(){
 const p=getP(activeSiteLayoutProjectId);
 if(!p||!activeSiteLayoutMarker)return null;
 const c=activeSiteLayoutMarker.getLngLat(),dims=siteLayoutDims(p);
 const reach=dims.length/2+Math.max(3,dims.length*0.15),theta=activeSiteLayoutAngle*Math.PI/180;
 // Same axes as metresToFootprintCorners: local +y (length axis) rotated by the building angle.
 const east=-reach*Math.sin(theta),north=reach*Math.cos(theta);
 return [c.lng+east/Math.max(1,111320*Math.cos(c.lat*Math.PI/180)),c.lat+north/111320]
}
function syncSiteLayoutRotateHandle(){
 const at=siteLayoutRotateHandleLngLat();
 if(at&&activeSiteLayoutRotateHandle)activeSiteLayoutRotateHandle.setLngLat(at)
}
function setSiteLayoutMapGesturesLocked(map,locked){
 // While a handle is dragged the map must not pan or rotate under the pointer.
 const act=locked?'disable':'enable';
 if(map.dragPan)map.dragPan[act]();
 if(map.dragRotate)map.dragRotate[act]();
 if(map.touchZoomRotate){map.touchZoomRotate[act]();if(!locked)map.touchZoomRotate.enableRotation()}
}
function bindSiteLayoutHandleDrag(marker,onMove,onEnd){
 // Pointer Events (mouse, touch, pen). MapLibre's own Marker drag uses mouse/touch events and its touchstart also reaches the map's pan handler.
 const el=marker.getElement();
 el.style.touchAction='none';
 ['mousedown','touchstart'].forEach(type=>el.addEventListener(type,event=>event.stopPropagation(),{passive:true}));
 el.addEventListener('pointerdown',down=>{
  const map=activeSiteLayoutMap;
  if(activeSiteLayoutBuildingConfirmed||!map||(down.pointerType==='mouse'&&down.button!==0))return;
  down.preventDefault();down.stopPropagation();
  const id=down.pointerId,box=map.getCanvasContainer().getBoundingClientRect(),start=map.project(marker.getLngLat());
  const grab={x:down.clientX-box.left-start.x,y:down.clientY-box.top-start.y};
  try{el.setPointerCapture(id)}catch(e){}
  setSiteLayoutMapGesturesLocked(map,true);
  const move=event=>{
   if(event.pointerId!==id)return;
   const rect=map.getCanvasContainer().getBoundingClientRect();
   onMove(map.unproject([event.clientX-rect.left-grab.x,event.clientY-rect.top-grab.y]))
  };
  const end=event=>{
   if(event.pointerId!==id)return;
   el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);
   try{el.releasePointerCapture(id)}catch(e){}
   if(activeSiteLayoutMap===map)setSiteLayoutMapGesturesLocked(map,false);
   onEnd(event.type==='pointercancel')
  };
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)
 })
}
function createSiteLayoutRotateHandle(id){
 const element=document.createElement('button');
 element.type='button';element.className='site-layout-rotate-handle';element.setAttribute('aria-label','Building rotation handle');element.title='Drag to rotate';
 element.innerHTML='<span aria-hidden="true">↻</span>';
 activeSiteLayoutRotateHandle=new maplibregl.Marker({element}).setLngLat(siteLayoutRotateHandleLngLat()).addTo(activeSiteLayoutMap);
 bindSiteLayoutHandleDrag(activeSiteLayoutRotateHandle,ll=>{
  if(!activeSiteLayoutMarker)return;
  const c=activeSiteLayoutMarker.getLngLat();
  const east=(ll.lng-c.lng)*Math.max(1,111320*Math.cos(c.lat*Math.PI/180)),north=(ll.lat-c.lat)*111320;
  if(!east&&!north)return;
  activeSiteLayoutAngle=normaliseSiteLayoutAngle(Math.atan2(-east,north)*180/Math.PI);
  activeSiteLayoutRotateHandle.setLngLat([ll.lng,ll.lat]);
  updateSiteLayoutBuildingGeometry()
 },()=>{syncSiteLayoutRotateHandle();siteLayoutStatus('Rotation '+Math.round(activeSiteLayoutAngle)+'°.')})
}
function placeSiteLayoutBuilding(p,ll){
 if(activeSiteLayoutMarker)activeSiteLayoutMarker.setLngLat([ll.lng,ll.lat]);
 else{
  const element=document.createElement('button');
  element.type='button';element.className='site-layout-building-handle';element.setAttribute('aria-label','Building handle');
  element.innerHTML='<span aria-hidden="true"></span>';
  activeSiteLayoutMarker=new maplibregl.Marker({element}).setLngLat([ll.lng,ll.lat]).addTo(activeSiteLayoutMap);
  bindSiteLayoutHandleDrag(activeSiteLayoutMarker,at=>{
   activeSiteLayoutMarker.setLngLat([at.lng,at.lat]);
   updateBuildingLayer(p,activeSiteLayoutMap,{lat:at.lat,lng:at.lng},activeSiteLayoutAngle,'building');
   syncSiteLayoutRotateHandle();
   updateSiteLayoutReadouts()
  },()=>{if(!activeSiteLayoutBuildingConfirmed)siteLayoutStatus('Building placed. Rotation '+Math.round(activeSiteLayoutAngle)+'°.')})
 }
 if(!activeSiteLayoutRotateHandle)createSiteLayoutRotateHandle(p.id);
 else syncSiteLayoutRotateHandle();
 updateBuildingLayer(p,activeSiteLayoutMap,ll,activeSiteLayoutAngle,'building');
 configureSiteLayoutMapInteractions();
 updateSiteLayoutReadouts()
}
async function locateSiteLayoutAddress(id,placeInitial){
const p=getP(id),status=document.querySelector('#siteLayoutAddressStatus'),mapEl=document.querySelector('#siteLayoutMap');
if(!p)return;
const address=String(p.address||'').trim();
if(!address){if(status)status.textContent='No site address saved. Add it in Project Overview.';mapEl?.classList.remove('is-locating');return}
if(status)status.textContent='Locating site…';
try{
 const best=await resolveProposedSite(p);
 if(!best){if(status)status.textContent='Site not found. Tap the map to place the building.';mapEl?.classList.remove('is-locating');return}
 activeSiteLayoutOrigin={lat:best.lat,lng:best.lng};
 if(status)status.textContent=best.source==='address'?'Site located.':'Site located from postcode.';
 if(placeInitial){
  activeSiteLayoutMap.jumpTo({center:[activeSiteLayoutOrigin.lng,activeSiteLayoutOrigin.lat],zoom:19});
  if(!activeSiteLayoutMarker)placeSiteLayoutBuilding(p,activeSiteLayoutOrigin);
  siteLayoutStatus('Drag the green handle to move. Drag ↻ to rotate.')
 }
 mapEl?.classList.remove('is-locating');
 updateSiteLayoutReadouts()
}catch(e){
 if(status)status.textContent='Site not found. Tap the map to place the building.';
 mapEl?.classList.remove('is-locating')
}
}
function confirmSiteLayoutBuilding(id){
const p=getP(id),dims=siteLayoutDims(p);
if(!p||!dims.ready)return alert('Add building length and width first.');
if(!activeSiteLayoutMarker)return alert('Wait for the site to load, or tap the map to place the building.');
const c=activeSiteLayoutMarker.getLngLat(),center={lat:c.lat,lng:c.lng};
const corners=metresToFootprintCorners(center,dims.width,dims.length,activeSiteLayoutAngle).map(point=>({lat:point[0],lng:point[1]}));
p.facts.buildingPosition=center;
p.facts.buildingFootprint={center,width:dims.width,length:dims.length,angle:normaliseSiteLayoutAngle(activeSiteLayoutAngle),corners};
p.facts.siteLayoutMapView=siteLayoutMapViewSnapshot();
p.facts.siteLayoutUiVersion='figma-site-layout-redesign-2026-11-02';
p.facts.buildingPositionStatus='confirmed';
p.facts.addressConfirmedOnly=false;
p.facts.siteLayoutStatus='in_progress';
p.facts.siteLayoutSiteAddress=String(p.address||'').trim();
p.history.push({at:now(),text:'Proposed building position confirmed in Site Layout ('+dims.width+' m × '+dims.length+' m, '+Math.round(activeSiteLayoutAngle)+'°)'});
if(typeof pcBuildingRegsRun==='function')pcBuildingRegsRun(p);
save();
activeSiteLayoutBuildingConfirmed=true;
configureSiteLayoutMapInteractions();
siteLayoutStatus('Building confirmed.');
siteLayoutBoundaryStatus('Tap the map to mark a boundary (optional).');
refreshSiteLayoutBoundaryUI();
document.querySelector('#siteLayoutBoundaryStep')?.scrollIntoView({behavior:'smooth',block:'nearest'})
}
function editSiteLayoutBuilding(){
if(!activeSiteLayoutMarker)return;
activeSiteLayoutBuildingConfirmed=false;
const p=getP(activeSiteLayoutProjectId);
if(p){p.facts=p.facts||{};p.facts.siteLayoutStatus='in_progress';save()}
configureSiteLayoutMapInteractions();
siteLayoutStatus('Move or rotate, then confirm.');
refreshSiteLayoutBoundaryUI()
}
function undoSiteLayoutBoundaryPoint(){
if(activeSiteLayoutBoundaryDraft.length){
 activeSiteLayoutBoundaryDraft.pop();
 siteLayoutBoundaryStatus(activeSiteLayoutBoundaryDraft.length?'Point removed.':'Nothing drawn.')
}else if(activeSiteLayoutBoundaries.length){
 invalidateSiteLayoutHandoff();
 activeSiteLayoutBoundaries.pop();
 siteLayoutBoundaryStatus('Boundary removed.')
}
redrawSiteLayoutBoundaries();
refreshSiteLayoutBoundaryUI()
}
function finishSiteLayoutBoundary(){
if(activeSiteLayoutBoundaryDraft.length<2)return;
activeSiteLayoutBoundaries.push(activeSiteLayoutBoundaryDraft.map(point=>({lat:point.lat,lng:point.lng})));
activeSiteLayoutBoundaryDraft=[];
redrawSiteLayoutBoundaries();
siteLayoutBoundaryStatus('Boundary added. Draw another, or confirm.');
refreshSiteLayoutBoundaryUI()
}
function skipSiteLayoutBoundaries(id){
activeSiteLayoutBoundaryDraft=[];redrawSiteLayoutBoundaries();
confirmSiteLayout(id,true)
}
function confirmSiteLayout(id,skip){
const p=getP(id),dims=siteLayoutDims(p);
if(!p||!dims.ready)return alert('Building length and width are required.');
if(!activeSiteLayoutBuildingConfirmed||!p.facts.buildingFootprint?.center)return alert('Confirm the building position first.');
// Boundaries are optional: a finished-enough draft is kept, a stray single point is dropped.
if(activeSiteLayoutBoundaryDraft.length>=2)finishSiteLayoutBoundary();
else if(activeSiteLayoutBoundaryDraft.length){activeSiteLayoutBoundaryDraft=[];redrawSiteLayoutBoundaries()}
if(skip)activeSiteLayoutBoundaries=[];
const count=activeSiteLayoutBoundaries.length;
p.facts.relevantBoundaries=activeSiteLayoutBoundaries.map(line=>line.map(point=>({lat:point.lat,lng:point.lng})));
p.facts.siteBoundaryStatus=count?'confirmed':'skipped';
p.facts.siteLayoutStatus='confirmed';
p.facts.siteLayoutSiteAddress=String(p.address||'').trim();
p.facts.siteLayoutMapView=siteLayoutMapViewSnapshot();
p.facts.siteLayoutUiVersion='figma-site-layout-redesign-2026-11-02';
p.facts.siteLayoutConfirmedAt=now();
p.history.push({at:now(),text:'Site Layout confirmed '+(count?'with '+count+' boundar'+(count===1?'y':'ies'):'without boundaries')});
if(typeof pcBuildingRegsRun==='function')pcBuildingRegsRun(p);
save();
siteLayoutBoundaryStatus('Saved.');
refreshSiteLayoutBoundaryUI()
}
function siteLayoutMainAction(id){
const step=siteLayoutStep();
if(step==='building')return confirmSiteLayoutBuilding(id);
if(step==='boundaries')return confirmSiteLayout(id);
route('buildingLayout',id)
}
function siteLayout(id){
if(!requireUser())return;const p=getP(id);if(!p)return route('dashboard');
document.body.dataset.page='siteLayout';
const facts=projectFacts(p),dims=siteLayoutDims(p),saved=facts.buildingFootprint,savedView=facts.siteLayoutMapView;
if(activeSiteLayoutMap){try{activeSiteLayoutMap.remove()}catch(e){}}
activeSiteLayoutMap=null;activeSiteLayoutMarker=null;activeSiteLayoutOrigin=null;activeSiteLayoutBoundaryDraft=[];activeSiteLayoutRotateHandle=null;
activeSiteLayoutProjectId=id;
measureMode=null;measurePoints=[];
const currentSiteAddress=normaliseSiteAddress(p.address),savedSiteAddress=normaliseSiteAddress(facts.siteLayoutSiteAddress);
const restoreSavedBuilding=['in_progress','confirmed'].includes(facts.siteLayoutStatus)&&facts.buildingPositionStatus==='confirmed'&&Boolean(saved?.center)&&Boolean(savedSiteAddress)&&savedSiteAddress===currentSiteAddress;
const restoreConfirmedLayout=facts.siteLayoutStatus==='confirmed'&&restoreSavedBuilding;
activeSiteLayoutAngle=restoreSavedBuilding?(Number(saved?.angle)||0):0;
activeSiteLayoutBaseLayer=['satellite','street'].includes(savedView?.baseLayer)?savedView.baseLayer:'satellite';
activeSiteLayoutBoundaries=restoreConfirmedLayout&&Array.isArray(facts.relevantBoundaries)?facts.relevantBoundaries.filter(line=>Array.isArray(line)&&line.length>=2).map(line=>line.map(point=>({lat:Number(point.lat),lng:Number(point.lng)}))):[];
const savedMatches=restoreSavedBuilding&&dims.ready&&Number(saved.width)===dims.width&&Number(saved.length)===dims.length;
activeSiteLayoutBuildingConfirmed=Boolean(savedMatches);
if(!dims.ready){
 app.innerHTML=`<main class="container stage1-workspace site-layout-page">${projectJourneyNav(p,"siteLayout","stage1Confirm")}<section class="stage1-technical-header site-layout-intro"><div><div class="eyebrow">Stage 1 · Site Layout</div><h1>Position your proposed building</h1><p>This page uses the building length and width already saved in your project. Add the missing dimensions before using the site map.</p></div></section><section class="stage1-tech-card"><h2>Building dimensions required</h2><p>${!Number.isFinite(dims.length)||dims.length<=0?'Building length is missing. ':''}${!Number.isFinite(dims.width)||dims.width<=0?'Building width / clear span is missing.':''}</p><button class="btn green" onclick="route('stage1Workspace','${p.id}')">Back to Project Overview</button></section></main>`;
 return
}
const addressText=String(p.address||'').trim();
const changedDimensions=restoreSavedBuilding&&!savedMatches;
app.innerHTML=`<main class="container stage1-workspace site-layout-page site-layout-workspace site-layout-redesign">
${projectJourneyNav(p,"siteLayout","stage1Confirm")}
<section class="stage1-technical-header site-layout-intro site-layout-redesign-hero" aria-labelledby="siteLayoutTitle">
 <div><div class="eyebrow">Stage 1 · Site Layout</div><h1 id="siteLayoutTitle">Position your building</h1><p>Place the footprint, then optionally mark nearby boundaries.</p></div>
 <dl class="site-layout-project-summary"><div><dt>Site</dt><dd>${esc(addressText||'No address')}</dd></div><div><dt>Building</dt><dd class="site-layout-dimensions"><strong>${esc(String(dims.length))} m × ${esc(String(dims.width))} m</strong></dd></div></dl>
</section>
${stage1SteelSiteMarkup(p)}
<section class="stage1-tech-card site-layout-map-card">
 ${changedDimensions?'<div class="site-layout-warning">Dimensions changed. Confirm the position again.</div>':''}
 <p id="siteLayoutAddressStatus" class="site-layout-note" role="status" aria-live="polite">Locating site…</p>
 <details class="site-layout-map-config">
  <summary>Map options</summary>
  <div class="site-layout-config-grid">
   <fieldset><legend>Base map</legend><label><input type="radio" name="siteLayoutMapLayer" value="satellite" ${activeSiteLayoutBaseLayer==='satellite'?'checked':''} onclick="setSiteLayoutBaseLayer('satellite')"> Satellite</label><label><input type="radio" name="siteLayoutMapLayer" value="street" ${activeSiteLayoutBaseLayer==='street'?'checked':''} onclick="setSiteLayoutBaseLayer('street')"> Street</label></fieldset>
   <fieldset><legend>Layers</legend><label><input type="checkbox" checked onchange="setSiteLayoutBuildingVisibility(this.checked)"> Building</label><label><input type="checkbox" checked onchange="setSiteLayoutBoundaryVisibility(this.checked)"> Boundaries</label></fieldset>
   <dl><div><dt>Rotation</dt><dd id="siteLayoutBuildingAngle">${Math.round(activeSiteLayoutAngle)}°</dd></div><div><dt>Zoom</dt><dd id="siteLayoutMapZoom">—</dd></div></dl>
  </div>
 </details>
 <div class="site-layout-map-frame">
  <div id="siteLayoutMap" class="mapbox site-layout-map${restoreConfirmedLayout?'':' is-locating'}" aria-label="Site map"></div>
  <div class="site-layout-map-key" aria-hidden="true"><span><i class="is-building"></i> Building</span><span><i class="is-boundary"></i> Boundary</span></div>
 </div>
 <p id="siteLayoutStatus" class="map-status">${savedMatches?'Saved position loaded.':'Drag the green handle to move. Drag ↻ to rotate.'}</p>
 <div id="siteLayoutBuildingConfirmedState" class="site-layout-building-confirmed" ${activeSiteLayoutBuildingConfirmed?'':'hidden'}><strong>✓ Building confirmed</strong><button class="btn secondary" onclick="editSiteLayoutBuilding()">Edit</button></div>
 <p class="site-layout-disclaimer">Approximate layout only, not surveyed or approved.</p>
</section>
<section id="siteLayoutBoundaryStep" class="stage1-tech-card site-layout-boundary-card" ${activeSiteLayoutBuildingConfirmed?'':'hidden'}>
 <h2>Boundaries <small>(optional)</small></h2>
 <p id="siteLayoutBoundaryCount" class="map-status"></p>
 <p id="siteLayoutBoundaryStatus" class="map-status">Tap the map to mark a boundary, then Done.</p>
 <div class="site-layout-boundary-controls"><button id="undoSiteLayoutBoundaryBtn" class="btn secondary" onclick="undoSiteLayoutBoundaryPoint()">Undo</button><button id="finishSiteLayoutBoundaryBtn" class="btn secondary" onclick="finishSiteLayoutBoundary()">Done</button><button class="btn secondary" onclick="skipSiteLayoutBoundaries('${esc(id)}')">Skip</button></div>
</section>
<div class="site-layout-sticky-actions">
 <span id="siteLayoutActionSummary"></span>
 <button id="siteLayoutMainBtn" type="button" class="btn green" onclick="siteLayoutMainAction('${esc(id)}')">Confirm building position</button>
</div>
</main>`;
const restoredCenter=restoreSavedBuilding?{lat:Number(saved.center.lat),lng:Number(saved.center.lng)}:null;
const mapCenter=savedView?.center&&restoreSavedBuilding?{lat:Number(savedView.center.lat),lng:Number(savedView.center.lng)}:(restoredCenter||{lat:54.5,lng:-3});
const mapZoom=Number.isFinite(Number(savedView?.zoom))&&restoreSavedBuilding?Number(savedView.zoom):(restoreSavedBuilding?19:6);
// Map bearing is view state: restore the saved view's bearing alongside the saved building. The building angle is stored separately (real-world).
const mapBearing=restoreSavedBuilding&&Number.isFinite(Number(savedView?.bearing))?Number(savedView.bearing):0;
try{
 activeSiteLayoutMap=createProjectCheckMap('siteLayoutMap',mapCenter,mapZoom,mapBearing);
}catch(error){
 const host=document.querySelector('#siteLayoutMap');
 host.textContent='';
 if(restoreConfirmedLayout&&savedView?.center&&saved.corners?.length===4){
  host.setAttribute('role','img');
  renderConfirmedSitePlan(host,savedView,savedView.center,saved.corners,activeSiteLayoutBoundaries);
 }
 document.querySelector('#siteLayoutAddressStatus').textContent='Map unavailable. '+(restoreConfirmedLayout?'Your saved layout is kept.':'A working map is needed to edit.');
  document.querySelector('.site-layout-map-config').inert=true;
 document.querySelector('.site-layout-sticky-actions').hidden=true;
 document.querySelector('.site-layout-boundary-controls').inert=true;
 document.querySelector('#siteLayoutBuildingConfirmedState button').disabled=true;
 if(!restoreConfirmedLayout)document.querySelector('#siteLayoutBoundaryStep').hidden=true;
 return
}
activeMeasureMap=activeSiteLayoutMap;
activeSiteLayoutMap.on('load',()=>{setSiteLayoutBaseLayer(activeSiteLayoutBaseLayer);redrawSiteLayoutBoundaries();updateSiteLayoutReadouts()});
activeSiteLayoutMap.on('moveend',updateSiteLayoutReadouts);
activeSiteLayoutMap.on('zoomend',updateSiteLayoutReadouts);
if(restoredCenter)placeSiteLayoutBuilding(p,restoredCenter);
activeSiteLayoutMap.on('click',event=>{
 const point={lat:event.lngLat.lat,lng:event.lngLat.lng};
 if(activeSiteLayoutBuildingConfirmed){
  if(siteLayoutStep()==='done')invalidateSiteLayoutHandoff();
  activeSiteLayoutBoundaryDraft.push(point);redrawSiteLayoutBoundaries();
  siteLayoutBoundaryStatus('Points: '+activeSiteLayoutBoundaryDraft.length+'. Keep tapping, then Done.');refreshSiteLayoutBoundaryUI();return
 }
 if(!activeSiteLayoutMarker){placeSiteLayoutBuilding(p,point);siteLayoutStatus('Building placed. Drag to adjust.')}
});
redrawSiteLayoutBoundaries();
configureSiteLayoutMapInteractions();
refreshSiteLayoutBoundaryUI();
locateSiteLayoutAddress(id,!restoreSavedBuilding)
}
