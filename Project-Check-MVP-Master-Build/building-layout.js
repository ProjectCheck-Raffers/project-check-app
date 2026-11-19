// Project Check — Page 15B Building Design.
// Uses the existing project geometry as the single source of truth. This page
// performs geometric placement checks only; it does not make structural, fire,
// planning or Building Regulations claims.

const BUILDING_DESIGN_UI_VERSION='figma-page-15b-2026-11-03';
const BUILDING_DESIGN_VIEWS={
  plan:{label:'Plan',short:'Plan',wall:null,side:'Building plan'},
  a:{label:'Elevation A',short:'A',wall:'front',side:'Front elevation'},
  b:{label:'Elevation B',short:'B',wall:'right',side:'Right sidewall'},
  c:{label:'Elevation C',short:'C',wall:'back',side:'Rear elevation'},
  d:{label:'Elevation D',short:'D',wall:'left',side:'Left sidewall'}
};
const BUILDING_DESIGN_WALL_VIEW={front:'a',right:'b',back:'c',left:'d'};
let activeBuildingDesign=null;
let activeBuildingDesignSiteMap=null;
let activeBuildingDesignSiteResizeObserver=null;
let activeBuildingDesignSiteMarkers=[];

function buildingDesignClone(value){return JSON.parse(JSON.stringify(value))}
function buildingDesignRound(value,places=2){
  const power=10**places;
  return Math.round((Number(value)||0)*power)/power
}
function buildingDesignClamp(value,min,max){return Math.min(max,Math.max(min,value))}
function buildingDesignSame(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function buildingDesignProjectFacts(p){return typeof projectFacts==='function'?projectFacts(p):(p.facts||{})}
function buildingDesignWallLength(geometry,wall){
  return wall==='front'||wall==='back'?Number(geometry.width)||0:Number(geometry.length)||0
}
function buildingDesignOpeningKind(door){
  if(door?.type==='skylight')return 'skylight';
  if(door?.type==='solar')return 'solar';
  if(door?.type==='window')return 'window';
  return door?.type==='personnel'&&door?.subtype==='double'?'double':door?.type
}
function buildingDesignDoorName(door){
  const number=String(door.ref||'').match(/\d+/)?.[0]||'';
  const kind=buildingDesignOpeningKind(door);
  return kind==='double'?'Double door '+number:kind==='personnel'?'Personnel door '+number:kind==='window'?'Casement window '+number:kind==='skylight'?'Skylight '+number:kind==='solar'?'Solar array '+number:'Roller door '+number
}
function buildingDesignViewForWall(wall){return BUILDING_DESIGN_WALL_VIEW[wall]||'a'}
function buildingDesignCurrent(){
  if(!activeBuildingDesign)return null;
  return {project:getP(activeBuildingDesign.projectId),state:activeBuildingDesign}
}
function buildingDesignFingerprint(p,geometry){
  const footprint=buildingDesignProjectFacts(p).buildingFootprint||{};
  const roofPitch=typeof projectRoofPitch==='function'?Number(projectRoofPitch(p)):(Number(buildingDesignProjectFacts(p).roofPitch)||0);
  const windLoad=buildingDesignWindLoad(p),steel=buildingDesignIsSteelProject(p);
  return [
    buildingDesignRound(geometry.width),buildingDesignRound(geometry.length),
    buildingDesignRound(geometry.eaveHeight),buildingDesignRound(geometry.ridgeHeight),
    buildingDesignRound(roofPitch),buildingDesignRound(footprint.angle),
    Number.isFinite(windLoad)?buildingDesignRound(windLoad,3):'unknown',steel?'steel':'non-steel'
  ].join('|')
}
function buildingDesignBearing(value){
  const normalised=((Number(value)||0)%360+360)%360;
  const points=['north','north-east','east','south-east','south','south-west','west','north-west'];
  return {degrees:buildingDesignRound(normalised,0),label:points[Math.round(normalised/45)%8]}
}
function buildingDesignWallBearing(wall){
  const current=buildingDesignCurrent();
  const angle=Number(buildingDesignProjectFacts(current?.project||{}).buildingFootprint?.angle)||0;
  const offsets={front:0,right:90,back:180,left:270};
  return buildingDesignBearing(angle+(offsets[wall]||0))
}
function buildingDesignWindLoad(project){
  const facts=buildingDesignProjectFacts(project||{}),loads=facts.loads||facts.designLoads||{};
  const candidates=[facts.windLoad,facts.windPressure,facts.siteWindLoad,facts.designWindLoad,loads.wind,loads.windLoad,loads.windPressure,project?.windLoad,project?.windPressure];
  for(const value of candidates){
    if(value===null||value===undefined||String(value).trim()==='')continue;
    const number=Number(value);
    if(Number.isFinite(number)&&number>=0)return number
  }
  return null
}
function buildingDesignIsSteelProject(project){
  const facts=buildingDesignProjectFacts(project||{});
  const material=[facts.constructionMaterial,facts.structuralMaterial,facts.frameMaterial,facts.material,facts.structureMaterial,facts.frameType,facts.structureType,project?.constructionMaterial].filter(value=>value!==undefined&&value!==null).join(' ').toLowerCase();
  if(/aluminium|aluminum/.test(material))return false;
  if(/steel|ipe|lattice|truss/.test(material))return true;
  // Page 15B is currently the steel-building path. An explicit aluminium
  // selection is excluded until its separate rules are supplied.
  return true
}
function buildingDesignGridForLength(wallLength,project=buildingDesignCurrent()?.project){
  const length=Math.max(0,Number(wallLength)||0),windLoad=buildingDesignWindLoad(project),steel=buildingDesignIsSteelProject(project);
  if(!length)return {count:1,spacing:0,wallLength:length,windLoad,steel,highWind:false};
  if(!steel){
    const facts=buildingDesignProjectFacts(project||{}),design=project?.buildingDesign||{},requested=Number(design.baySpacing||facts.baySpacing),target=Number.isFinite(requested)&&requested>0?requested:5.2;
    const count=Math.max(1,Math.round(length/target));
    return {count,spacing:length/count,wallLength:length,windLoad,steel:false,highWind:false}
  }
  const highWind=Number.isFinite(windLoad)&&windLoad>=.85;
  const count=highWind
    ?Math.max(1,Math.floor(length/5)+1)
    :Math.max(1,Math.ceil(length/6),Math.round(length/5.2));
  return {count,spacing:length/count,wallLength:length,windLoad,steel:true,highWind}
}
function buildingDesignSanitizeSkylights(geometry){
  if(!geometry)return geometry;
  const seen=new Set();
  geometry.skylights=(Array.isArray(geometry.skylights)?geometry.skylights:[]).filter(skylight=>skylight&&typeof skylight==='object'&&!Array.isArray(skylight)).map((skylight,index)=>{
    const safe={...skylight,type:'skylight'};
    if(typeof safe.id!=='string'||!/^sk[0-9]{1,18}$/.test(safe.id)||seen.has(safe.id))safe.id='sk'+Date.now()+index;
    seen.add(safe.id);
    return safe
  });
  return geometry
}
function buildingDesignSanitizeGeometry(geometry){
  if(!geometry)return geometry;
  if(typeof sanitizeDoorIds==='function')sanitizeDoorIds(geometry);
  if(typeof sanitizeDoorSources==='function')sanitizeDoorSources(geometry);
  buildingDesignSanitizeSolarArrays(geometry);
  return buildingDesignSanitizeSkylights(geometry)
}
function buildingDesignMarkOpeningCustomer(opening){
  if(opening&&opening.source==='generated')opening.source='customer';
  return opening
}
function buildingDesignBayInfo(geometry,wall){
  const current=buildingDesignCurrent(),project=current?.project,design=project?.buildingDesign||{};
  const wallLength=buildingDesignWallLength(geometry,wall);
  return buildingDesignGridForLength(wallLength,project)
}
function buildingDesignBayLabel(door,geometry){
  if(!door)return '—';
  const info=buildingDesignBayInfo(geometry,door.wall);
  if(['personnel','window'].includes(door.type)&&Number.isInteger(Number(door.bayIndex))){
    return 'B'+(buildingDesignClamp(Number(door.bayIndex),0,info.count-1)+1)
  }
  const start=buildingDesignClamp(Math.floor((Number(door.offset)||0)/info.spacing)+1,1,info.count);
  const end=buildingDesignClamp(Math.ceil(((Number(door.offset)||0)+(Number(door.width)||0))/info.spacing),start,info.count);
  return start===end?'B'+start:'B'+start+'–B'+end
}
function buildingDesignDoorBay(door,geometry){
  const info=buildingDesignBayInfo(geometry,door.wall);
  const centre=(Number(door.offset)||0)+(Number(door.width)||0)/2;
  const stored=Number(door.bayIndex);
  const index=Number.isInteger(stored)?buildingDesignClamp(stored,0,info.count-1):buildingDesignClamp(Math.floor(centre/info.spacing),0,info.count-1);
  return {info,index,start:index*info.spacing,end:(index+1)*info.spacing}
}
function buildingDesignSetDoorBayFromOffset(door,geometry){
  if(!door||!['personnel','window'].includes(door.type))return;
  const info=buildingDesignBayInfo(geometry,door.wall),centre=(Number(door.offset)||0)+(Number(door.width)||0)/2;
  door.bayIndex=buildingDesignClamp(Math.floor(centre/info.spacing),0,info.count-1)
}
function buildingDesignDoorBaySide(door,geometry){
  if(door?.type!=='personnel')return null;
  if(door.baySide==='left'||door.baySide==='right')return door.baySide;
  const bay=buildingDesignDoorBay(door,geometry);
  const centre=(Number(door.offset)||0)+(Number(door.width)||0)/2;
  return centre<=(bay.start+bay.end)/2?'left':'right'
}
function buildingDesignBaySideOffset(door,geometry,side,bayIndex=door?.bayIndex){
  const info=buildingDesignBayInfo(geometry,door.wall),index=Number.isInteger(Number(bayIndex))?buildingDesignClamp(Number(bayIndex),0,info.count-1):buildingDesignDoorBay(door,geometry).index;
  const bay={info,index,start:index*info.spacing,end:(index+1)*info.spacing},width=Number(door.width)||0,clearance=.1;
  const usable=Math.max(0,bay.end-bay.start-width);
  const inset=Math.min(clearance,usable/2);
  return buildingDesignRound(side==='right'?bay.end-width-inset:bay.start+inset,2)
}
function buildingDesignWindowBayBounds(door,geometry){
  const bay=buildingDesignDoorBay(door,geometry),clearance=.1;
  return {bay,min:buildingDesignRound(bay.start+clearance,2),max:buildingDesignRound(Math.max(bay.start+clearance,bay.end-(Number(door.width)||0)-clearance),2)}
}
function buildingDesignIsGableWall(wall){return wall==='front'||wall==='back'}
function buildingDesignIsFreeGableRoller(door){return door?.type==='roller'&&buildingDesignIsGableWall(door.wall)}
function buildingDesignShouldSnapDoor(door){return Boolean(activeBuildingDesign?.snap)&&door?.type==='roller'&&!buildingDesignIsFreeGableRoller(door)}
function buildingDesignSourceGeometry(p){
  const facts=buildingDesignProjectFacts(p),derived=deriveGeometryFromFacts(p),persisted=buildGeometry(p);
  const calculatedRidge=typeof projectRidgeHeight==='function'?Number(projectRidgeHeight(p)):Number(derived.ridgeHeight);
  if(Number.isFinite(calculatedRidge)&&calculatedRidge>0)derived.ridgeHeight=buildingDesignRound(calculatedRidge,2);
  const expected=[Number(facts.width)||0,Number(facts.length)||0,Number(facts.height)||0,Number(derived.ridgeHeight)||0];
  const actual=[Number(persisted.width)||0,Number(persisted.length)||0,Number(persisted.eaveHeight)||0,Number(persisted.ridgeHeight)||0];
  const hasPersisted=Boolean(p?.geometry&&Array.isArray(p.geometry.doors)&&Number(p.geometry.width)>0);
  const dimensionsChanged=hasPersisted&&expected.some((value,index)=>Math.abs(value-actual[index])>.001);
  const geometry=buildingDesignClone(hasPersisted?persisted:derived);
  if(hasPersisted){
    geometry.width=derived.width;
    geometry.length=derived.length;
    geometry.eaveHeight=derived.eaveHeight;
    geometry.ridgeHeight=derived.ridgeHeight;
    geometry.roofForm=derived.roofForm;
    geometry.structureType=derived.structureType;
    geometry.openWall=derived.openWall;
    geometry.connectionWall=derived.connectionWall
  }
  if(!Array.isArray(geometry.doors))geometry.doors=[];
  // The shared legacy geometry reader predates roof openings and returns only
  // doors. Preserve Page 15B skylights from the same persisted geometry record.
  geometry.skylights=hasPersisted&&Array.isArray(p.geometry.skylights)?buildingDesignClone(p.geometry.skylights):[];
  geometry.solarArrays=hasPersisted&&Array.isArray(p.geometry.solarArrays)?buildingDesignClone(p.geometry.solarArrays):[];
  return {geometry:buildingDesignSanitizeGeometry(geometry),dimensionsChanged}
}
function buildingDesignSnapshot(){
  if(!activeBuildingDesign)return null;
  return {
    geometry:buildingDesignClone(activeBuildingDesign.geometry),
    selectedDoorId:activeBuildingDesign.selectedDoorId,
    view:activeBuildingDesign.view,
    snap:activeBuildingDesign.snap,
    zoom:activeBuildingDesign.zoom,
    skylightAnchorId:activeBuildingDesign.skylightAnchorId||null,
    solarAnchorId:activeBuildingDesign.solarAnchorId||null
  }
}
function buildingDesignApplySnapshot(snapshot){
  if(!activeBuildingDesign||!snapshot)return;
  activeBuildingDesign.geometry=buildingDesignClone(snapshot.geometry);
  activeBuildingDesign.selectedDoorId=snapshot.selectedDoorId||null;
  activeBuildingDesign.view=BUILDING_DESIGN_VIEWS[snapshot.view]?snapshot.view:'b';
  activeBuildingDesign.snap=snapshot.snap!==false;
  activeBuildingDesign.zoom=Number(snapshot.zoom)||1;
  activeBuildingDesign.skylightAnchorId=snapshot.skylightAnchorId||null;
  activeBuildingDesign.solarAnchorId=snapshot.solarAnchorId||null;
  activeBuildingDesign.dirty=!buildingDesignSame(activeBuildingDesign.geometry,activeBuildingDesign.baseline.geometry);
  buildingDesignRenderInteractive()
}
function buildingDesignRecord(){
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  activeBuildingDesign.history.push(buildingDesignSnapshot());
  if(activeBuildingDesign.history.length>50)activeBuildingDesign.history.shift();
  activeBuildingDesign.future=[]
}
function buildingDesignMarkDirty(){
  if(activeBuildingDesign)activeBuildingDesign.dirty=!buildingDesignSame(activeBuildingDesign.geometry,activeBuildingDesign.baseline.geometry)
}
function buildingDesignSelectedDoor(){
  if(!activeBuildingDesign)return null;
  return activeBuildingDesign.geometry.doors.find(door=>door.id===activeBuildingDesign.selectedDoorId)||activeBuildingDesign.geometry.skylights?.find(skylight=>skylight.id===activeBuildingDesign.selectedDoorId)||activeBuildingDesign.geometry.solarArrays?.find(array=>array.id===activeBuildingDesign.selectedDoorId)||null
}
function buildingDesignSelectFirstDoor(){
  if(!activeBuildingDesign)return;
  const view=BUILDING_DESIGN_VIEWS[activeBuildingDesign.view];
  const openings=view.wall?activeBuildingDesign.geometry.doors.filter(door=>door.wall===view.wall):[...(activeBuildingDesign.geometry.skylights||[]),...(activeBuildingDesign.geometry.solarArrays||[])];
  activeBuildingDesign.selectedDoorId=openings[0]?.id||null
}
function buildingDesignEnsureSelection(){
  if(activeBuildingDesign&&!buildingDesignSelectedDoor())buildingDesignSelectFirstDoor()
}
function buildingDesignOpeningBottom(opening){return opening?.type==='window'?Number(opening.sillHeight)||0:0}
function buildingDesignWindowVerticalBounds(opening,geometry){
  return {min:0,max:buildingDesignRound(Math.max(0,(Number(geometry.eaveHeight)||0)-(Number(opening?.height)||0)),2)}
}
function buildingDesignSkylightBay(skylight,geometry){
  const info=buildingDesignBayInfo(geometry,'right'),centre=(Number(skylight?.offsetY)||0)+(Number(skylight?.length)||0)/2;
  const stored=Number(skylight?.bayIndex),index=Number.isInteger(stored)?buildingDesignClamp(stored,0,info.count-1):buildingDesignClamp(Math.floor(centre/info.spacing),0,info.count-1);
  return {info,index,start:index*info.spacing,end:(index+1)*info.spacing}
}
function buildingDesignSkylightBayLabel(skylight,geometry){return 'RF'+(buildingDesignSkylightBay(skylight,geometry).index+1)}
function buildingDesignSkylightBounds(skylight,geometry){
  const bay=buildingDesignSkylightBay(skylight,geometry),clearance=.15,width=Number(skylight?.width)||0,length=Number(skylight?.length)||0;
  return {
    bay,
    minX:clearance,maxX:Math.max(clearance,(Number(geometry.width)||0)-width-clearance),
    minY:buildingDesignRound(bay.start+clearance,2),maxY:buildingDesignRound(Math.max(bay.start+clearance,bay.end-length-clearance),2)
  }
}
function buildingDesignSkylightsOverlap(first,second){
  return Number(first.offsetX)<Number(second.offsetX)+Number(second.width)-.001&&Number(first.offsetX)+Number(first.width)>Number(second.offsetX)+.001&&Number(first.offsetY)<Number(second.offsetY)+Number(second.length)-.001&&Number(first.offsetY)+Number(first.length)>Number(second.offsetY)+.001
}
function buildingDesignSkylightPlacementClear(candidate,geometry){
  return (geometry.skylights||[]).filter(skylight=>skylight.id!==candidate.id).every(skylight=>!buildingDesignSkylightsOverlap(candidate,skylight))&&(geometry.solarArrays||[]).every(array=>!buildingDesignSkylightsOverlap(candidate,array))
}
function buildingDesignOpeningsOverlap(first,second){
  const horizontal=Number(first.offset)<Number(second.offset)+Number(second.width)-.001&&Number(first.offset)+Number(first.width)>Number(second.offset)+.001;
  const firstBottom=buildingDesignOpeningBottom(first),secondBottom=buildingDesignOpeningBottom(second);
  const vertical=firstBottom<secondBottom+Number(second.height)-.001&&firstBottom+Number(first.height)>secondBottom+.001;
  return horizontal&&vertical
}
function buildingDesignOpeningPlacementClear(candidate,geometry){
  return geometry.doors.filter(opening=>opening.id!==candidate.id&&opening.wall===candidate.wall).every(opening=>!buildingDesignOpeningsOverlap(candidate,opening))
}
function buildingDesignIssues(geometry){
  const legacyGeometry={...geometry,doors:geometry.doors.filter(opening=>opening.type!=='window')};
  const issues=typeof validateGeometry==='function'?validateGeometry(legacyGeometry).map(issue=>({...issue})):[];
  const validWalls=['front','right','back','left'];
  geometry.doors.forEach(door=>{
    const width=Number(door.width),height=Number(door.height),bottom=buildingDesignOpeningBottom(door),eaves=Number(geometry.eaveHeight)||0;
    if(!validWalls.includes(door.wall))issues.push({doorId:door.id,message:buildingDesignDoorName(door)+' is not assigned to a valid elevation.'});
    if(!Number.isFinite(width)||width<=0)issues.push({doorId:door.id,message:buildingDesignDoorName(door)+' needs a positive width.'});
    if(!Number.isFinite(height)||height<=0)issues.push({doorId:door.id,message:buildingDesignDoorName(door)+' needs a positive height.'});
    else if(eaves&&bottom+height>eaves+.001)issues.push({doorId:door.id,message:buildingDesignDoorName(door)+' extends above the recorded clear height ('+eaves+' m).'});
    if(buildingDesignIsFreeGableRoller(door)&&width>7.001)issues.push({doorId:door.id,message:buildingDesignDoorName(door)+' cannot exceed 7.0 m on a gable wall.'});
    if(door.type==='window'){
      if(!['right','left'].includes(door.wall))issues.push({doorId:door.id,message:'Casement windows are available on sidewalls B and D only.'});
      const bounds=buildingDesignWindowBayBounds(door,geometry);
      if(Number(door.offset)<bounds.min-.001||Number(door.offset)>bounds.max+.001)issues.push({doorId:door.id,message:buildingDesignDoorName(door)+' must remain inside '+('B'+(bounds.bay.index+1))+'.'});
    }
  });
  geometry.doors.forEach((opening,index)=>geometry.doors.slice(index+1).forEach(other=>{
    if(opening.wall===other.wall&&buildingDesignOpeningsOverlap(opening,other)){
      issues.push({doorId:opening.id,message:buildingDesignDoorName(opening)+' overlaps '+buildingDesignDoorName(other)+'.'});
      issues.push({doorId:other.id,message:buildingDesignDoorName(other)+' overlaps '+buildingDesignDoorName(opening)+'.'})
    }
  }));
  (geometry.skylights||[]).forEach((skylight,index,list)=>{
    const width=Number(skylight.width),length=Number(skylight.length),bounds=buildingDesignSkylightBounds(skylight,geometry);
    if(!Number.isFinite(width)||width<=0||!Number.isFinite(length)||length<=0)issues.push({doorId:skylight.id,message:buildingDesignDoorName(skylight)+' needs positive dimensions.'});
    else if(Number(skylight.offsetX)<bounds.minX-.001||Number(skylight.offsetX)>bounds.maxX+.001||Number(skylight.offsetY)<bounds.minY-.001||Number(skylight.offsetY)>bounds.maxY+.001)issues.push({doorId:skylight.id,message:buildingDesignDoorName(skylight)+' must remain inside '+buildingDesignSkylightBayLabel(skylight,geometry)+' and clear of its roof beams.'});
    list.slice(index+1).forEach(other=>{
      if(buildingDesignSkylightsOverlap(skylight,other)){
        issues.push({doorId:skylight.id,message:buildingDesignDoorName(skylight)+' overlaps '+buildingDesignDoorName(other)+'.'});
        issues.push({doorId:other.id,message:buildingDesignDoorName(other)+' overlaps '+buildingDesignDoorName(skylight)+'.'})
      }
    })
  });
  buildingDesignSolarIssues(geometry,issues);
  return issues
}
function buildingDesignIssueForDoor(door){
  const issues=buildingDesignIssues(activeBuildingDesign.geometry);
  return issues.find(issue=>issue.doorId===door?.id)||issues[0]||null
}
function buildingDesignNextRef(type){
  const prefix=type==='personnel'?'P':type==='double'?'D':type==='window'?'W':type==='skylight'?'S':type==='solar'?'PV':'R';
  const source=type==='skylight'?(activeBuildingDesign.geometry.skylights||[]):type==='solar'?(activeBuildingDesign.geometry.solarArrays||[]):activeBuildingDesign.geometry.doors;
  const values=source.filter(door=>buildingDesignOpeningKind(door)===type).map(door=>Number(String(door.ref||'').match(/\d+/)?.[0])||0);
  return prefix+(Math.max(0,...values)+1)
}
function buildingDesignFindOffset(wall,width){
  const geometry=activeBuildingDesign.geometry,wallLength=buildingDesignWallLength(geometry,wall);
  const doors=geometry.doors.filter(door=>door.wall===wall).slice().sort((a,b)=>a.offset-b.offset);
  for(let position=0;position<=wallLength-width+.001;position+=.1){
    const clear=doors.every(door=>position+width<=Number(door.offset)-.2||position>=Number(door.offset)+Number(door.width)+.2);
    if(clear)return buildingDesignRound(position,1)
  }
  return buildingDesignRound(Math.max(0,(wallLength-width)/2),1)
}
function buildingDesignFindBayPlacement(wall,width,height,type,sillHeight=0){
  const geometry=activeBuildingDesign.geometry,info=buildingDesignBayInfo(geometry,wall),clearance=.1;
  for(let bayIndex=0;bayIndex<info.count;bayIndex++){
    const start=bayIndex*info.spacing,end=(bayIndex+1)*info.spacing;
    const positions=type==='window'
      ?[buildingDesignRound(start+(info.spacing-width)/2,2)]
      :[buildingDesignRound(start+clearance,2),buildingDesignRound(end-width-clearance,2)];
    for(const offset of positions){
      const candidate={wall,offset,width,height,type,sillHeight};
      const fits=offset>=start+clearance-.001&&offset+width<=end-clearance+.001;
      const clear=fits&&geometry.doors.filter(opening=>opening.wall===wall).every(opening=>!buildingDesignOpeningsOverlap(candidate,opening));
      if(clear)return {bayIndex,offset}
    }
  }
  const fallback=buildingDesignClamp(buildingDesignFindOffset(wall,width),clearance,Math.max(clearance,info.wallLength-width-clearance));
  const bayIndex=buildingDesignClamp(Math.floor((fallback+width/2)/info.spacing),0,info.count-1);
  return {bayIndex,offset:buildingDesignRound(fallback,2)}
}
function buildingDesignSkylightCandidate(width,length,offsetX,bayIndex,geometry=activeBuildingDesign.geometry){
  const grid=buildingDesignBayInfo(geometry,'right'),clearance=.15;
  if(bayIndex<0||bayIndex>=grid.count||length>grid.spacing-clearance*2+.001)return null;
  const bayStart=bayIndex*grid.spacing,bayEnd=(bayIndex+1)*grid.spacing;
  const candidate={
    type:'skylight',width,length,bayIndex,
    offsetX:buildingDesignRound(buildingDesignClamp(offsetX,clearance,Math.max(clearance,(Number(geometry.width)||0)-width-clearance)),2),
    offsetY:buildingDesignRound(bayStart+(grid.spacing-length)/2,2)
  };
  return candidate.offsetY>=bayStart+clearance-.001&&candidate.offsetY+length<=bayEnd-clearance+.001&&buildingDesignSkylightPlacementClear(candidate,geometry)?candidate:null
}
function buildingDesignFindSkylightPlacement(width=1,length=2){
  const geometry=activeBuildingDesign.geometry,skylights=geometry.skylights||[],grid=buildingDesignBayInfo(geometry,'right'),roofWidth=Number(geometry.width)||0;
  const anchor=skylights.find(item=>item.id===activeBuildingDesign.skylightAnchorId)||skylights[skylights.length-1]||null;
  // First free bay on a line, from bay `from` onward.
  const scan=(offsetX,from)=>{for(let bay=from;bay<grid.count;bay++){const candidate=buildingDesignSkylightCandidate(width,length,offsetX,bay,geometry);if(candidate)return candidate}return null};
  if(anchor){
    // Continue along the moved/last skylight's line, then the default lines further across the roof.
    const along=scan(Number(anchor.offsetX),buildingDesignSkylightBay(anchor,geometry).index+1);
    if(along)return {...along,newRow:false};
    const across=Number(anchor.offsetX)+Number(anchor.width)/2;
    for(const offsetX of [.25,.5,.75].map(f=>roofWidth*f-width/2).filter(x=>x+width/2>across+.001)){
      const next=scan(offsetX,0);
      if(next)return {...next,newRow:true}
    }
  }
  const rowCandidates=[roofWidth*.25-width/2,roofWidth*.75-width/2,roofWidth*.5-width/2];
  for(const offsetX of rowCandidates){
    const seed=scan(offsetX,0);
    if(seed)return {...seed,newRow:Boolean(anchor)}
  }
  return null
}
function buildingDesignMutate(mutator,announcement){
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  buildingDesignRecord();
  mutator(activeBuildingDesign.geometry);
  buildingDesignMarkDirty();
  if(announcement)activeBuildingDesign.announcement=announcement;
  buildingDesignRenderInteractive()
}
function buildingDesignSetView(view){
  if(!activeBuildingDesign||!BUILDING_DESIGN_VIEWS[view])return;
  activeBuildingDesign.view=view;
  const wall=BUILDING_DESIGN_VIEWS[view].wall,current=buildingDesignSelectedDoor();
  if(wall&&current?.wall!==wall)activeBuildingDesign.selectedDoorId=activeBuildingDesign.geometry.doors.find(door=>door.wall===wall)?.id||null;
  if(!wall&&current?.type!=='skylight'&&current?.type!=='solar')activeBuildingDesign.selectedDoorId=activeBuildingDesign.geometry.skylights?.[0]?.id||activeBuildingDesign.geometry.solarArrays?.[0]?.id||null;
  activeBuildingDesign.announcement=BUILDING_DESIGN_VIEWS[view].label+' selected.';
  buildingDesignRenderInteractive()
}
function buildingDesignSelectDoor(id,openElevation=false){
  if(!activeBuildingDesign)return;
  const door=activeBuildingDesign.geometry.doors.find(item=>item.id===id)||activeBuildingDesign.geometry.skylights?.find(item=>item.id===id)||activeBuildingDesign.geometry.solarArrays?.find(item=>item.id===id);
  if(!door)return;
  activeBuildingDesign.selectedDoorId=id;
  if(door.type==='skylight'||door.type==='solar')activeBuildingDesign.view='plan';
  else if(openElevation)activeBuildingDesign.view=buildingDesignViewForWall(door.wall);
  activeBuildingDesign.announcement=buildingDesignDoorName(door)+' selected.';
  buildingDesignRenderInteractive()
}
function buildingDesignAddDoor(type){
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  let view=BUILDING_DESIGN_VIEWS[activeBuildingDesign.view];
  if(!view.wall){activeBuildingDesign.view=type==='window'?'b':'a';view=BUILDING_DESIGN_VIEWS[activeBuildingDesign.view]}
  if(type==='window'&&!['right','left'].includes(view.wall)){
    activeBuildingDesign.announcement='Casement windows can be added to sidewalls B and D only.';
    buildingDesignRenderInteractive();return
  }
  const personnel=type==='personnel'||type==='double';
  const windowOpening=type==='window';
  const height=windowOpening?0.8:personnel?2.1:buildingDesignRound(Math.max(2.4,Math.min(5,(Number(activeBuildingDesign.geometry.eaveHeight)||4)-.2)),1);
  const width=windowOpening?1.8:type==='double'?2:personnel?1:4.6,id=(personnel?'pd':'rd')+Date.now();
  const sillHeight=windowOpening?buildingDesignRound(Math.max(0,(Number(activeBuildingDesign.geometry.eaveHeight)||0)-height-.5),2):0;
  const placement=(personnel||windowOpening)?buildingDesignFindBayPlacement(view.wall,width,height,windowOpening?'window':'personnel',sillHeight):null;
  const door={id,ref:buildingDesignNextRef(type),type:windowOpening?'window':personnel?'personnel':'roller',wall:view.wall,offset:placement?.offset??buildingDesignFindOffset(view.wall,width),width,height,source:'customer',...(personnel?{baySide:'left'}:{}),...(type==='double'?{subtype:'double'}:{}),...(placement?{bayIndex:placement.bayIndex}:{}),...(windowOpening?{sillHeight}:{})};
  if(personnel)door.offset=buildingDesignBaySideOffset(door,activeBuildingDesign.geometry,'left',door.bayIndex);
  buildingDesignMutate(geometry=>geometry.doors.push(door),buildingDesignDoorName(door)+' added to '+view.label+'.');
  activeBuildingDesign.selectedDoorId=id;
  buildingDesignRenderInteractive()
}
function buildingDesignAddSkylight(){
  if(!activeBuildingDesign||activeBuildingDesign.locked||activeBuildingDesign.view!=='plan')return;
  const width=1,length=2,existing=activeBuildingDesign.geometry.skylights||[];
  let serial=existing.length,id='sk'+Date.now()+serial;
  while(existing.some(skylight=>skylight.id===id))id='sk'+Date.now()+(++serial);
  const placement=buildingDesignFindSkylightPlacement(width,length);
  if(!placement){
    activeBuildingDesign.announcement='No clear roof-grid position is available for another skylight.';
    alert('No clear roof-grid position is available for another skylight. Move an existing skylight or use another row.');
    buildingDesignRenderInteractive();return
  }
  const skylight={id,ref:buildingDesignNextRef('skylight'),type:'skylight',width,length,offsetX:placement.offsetX,offsetY:placement.offsetY,bayIndex:placement.bayIndex,source:'customer'};
  buildingDesignMutate(geometry=>{geometry.skylights=geometry.skylights||[];geometry.skylights.push(skylight)},buildingDesignDoorName(skylight)+(placement.newRow?' started a new roof row in ':' added one structural bay along in ')+buildingDesignSkylightBayLabel(skylight,activeBuildingDesign.geometry)+'.');
  activeBuildingDesign.selectedDoorId=id;
  activeBuildingDesign.skylightAnchorId=id;
  buildingDesignRenderInteractive()
}
function buildingDesignUpdateRollerAccess(value){
  const door=buildingDesignSelectedDoor();
  const {project}=buildingDesignCurrent()||{};
  if(door?.type!=='roller'||!project||!projectIsSteelFreeStanding(buildingDesignProjectFacts(project)))return;
  if(value!==''&&!ROLLER_ACCESS_OPTIONS.includes(value))return;
  buildingDesignMutate(geometry=>{
    const opening=geometry.doors.find(item=>item.id===door.id);
    buildingDesignMarkOpeningCustomer(opening).access=value;
  },'Drawing roller-door access updated.');
}
function buildingDesignDeleteDoor(){
  const door=buildingDesignSelectedDoor();
  if(!door||activeBuildingDesign.locked)return;
  const deletedType=door.type;
  buildingDesignMutate(geometry=>{
    if(door.type==='skylight')geometry.skylights=(geometry.skylights||[]).filter(item=>item.id!==door.id);
    else if(door.type==='solar')geometry.solarArrays=(geometry.solarArrays||[]).filter(item=>item.id!==door.id);
    else geometry.doors=geometry.doors.filter(item=>item.id!==door.id)
  },buildingDesignDoorName(door)+' deleted.');
  // Keep sequential deletes inside the same list (skylights or solar arrays)
  // instead of always jumping to the first skylight.
  const view=BUILDING_DESIGN_VIEWS[activeBuildingDesign.view];
  let next=null;
  if(!view.wall){
    if(deletedType==='skylight')next=(activeBuildingDesign.geometry.skylights||[])[0];
    else if(deletedType==='solar')next=(activeBuildingDesign.geometry.solarArrays||[])[0];
  }else if(deletedType!=='skylight'&&deletedType!=='solar'){
    next=activeBuildingDesign.geometry.doors.filter(d=>d.wall===view.wall)[0];
  }
  if(next)activeBuildingDesign.selectedDoorId=next.id;
  else buildingDesignSelectFirstDoor();
  buildingDesignRenderInteractive()
}
function buildingDesignUpdateSkylight(field,value){
  const skylight=buildingDesignSelectedDoor();
  if(!skylight||skylight.type!=='skylight'||activeBuildingDesign.locked||!['width','length'].includes(field))return;
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0){alert('Enter a valid '+field+' in metres.');buildingDesignRenderInteractive();return}
  const candidate=buildingDesignMarkOpeningCustomer({...skylight,[field]:buildingDesignRound(number,2)}),bounds=buildingDesignSkylightBounds(candidate,activeBuildingDesign.geometry);
  candidate.offsetX=buildingDesignRound(buildingDesignClamp(Number(candidate.offsetX),bounds.minX,bounds.maxX),2);
  candidate.offsetY=buildingDesignRound(buildingDesignClamp(Number(candidate.offsetY),bounds.minY,bounds.maxY),2);
  if(candidate.length>bounds.bay.info.spacing-.3+.001){alert('Keep the skylight between the structural roof beams.');buildingDesignRenderInteractive();return}
  if(!buildingDesignSkylightPlacementClear(candidate,activeBuildingDesign.geometry)){alert('Move the skylight clear of the other skylight before applying this change.');buildingDesignRenderInteractive();return}
  buildingDesignMutate(geometry=>Object.assign(geometry.skylights.find(item=>item.id===skylight.id),candidate),buildingDesignDoorName(skylight)+' '+field+' updated.')
}
function buildingDesignUpdateDoor(field,value){
  const door=buildingDesignSelectedDoor();
  if(!door||activeBuildingDesign.locked||!['width','height','sillHeight'].includes(field))return;
  const number=Number(value);
  if(!Number.isFinite(number)||(field==='sillHeight'?number<0:number<=0)){alert('Enter a valid '+field+' in metres.');buildingDesignRenderInteractive();return}
  if(field==='width'&&buildingDesignIsFreeGableRoller(door)&&number>7){alert('Gable roller doors can be up to 7.0 metres wide.');buildingDesignRenderInteractive();return}
  if(door.type==='window'){
    const candidate=buildingDesignMarkOpeningCustomer({...door,[field]:buildingDesignRound(number,2)});
    if(field==='width'){
      const bay=buildingDesignDoorBay(candidate,activeBuildingDesign.geometry);
      if(candidate.width>bay.info.spacing-.2+.001){alert('The window must fit inside its selected bay.');buildingDesignRenderInteractive();return}
      const bounds=buildingDesignWindowBayBounds(candidate,activeBuildingDesign.geometry);
      candidate.offset=buildingDesignRound(buildingDesignClamp(Number(candidate.offset),bounds.min,bounds.max),2)
    }
    const vertical=buildingDesignWindowVerticalBounds(candidate,activeBuildingDesign.geometry);
    if(Number(candidate.sillHeight)<vertical.min-.001||Number(candidate.sillHeight)>vertical.max+.001){
      alert('Keep the complete window between finished floor level and the eaves.');buildingDesignRenderInteractive();return
    }
    if(!buildingDesignOpeningPlacementClear(candidate,activeBuildingDesign.geometry)){
      alert('Move the window clear of the other opening before applying this change.');buildingDesignRenderInteractive();return
    }
    buildingDesignMutate(geometry=>Object.assign(geometry.doors.find(item=>item.id===door.id),candidate),buildingDesignDoorName(door)+' '+field+' updated.');
    return
  }
  buildingDesignMutate(geometry=>{
    const target=buildingDesignMarkOpeningCustomer(geometry.doors.find(item=>item.id===door.id)),side=buildingDesignDoorBaySide(target,geometry);
    target[field]=buildingDesignRound(number,2);
    if(field==='width'&&target.type==='personnel'&&side){target.baySide=side;target.offset=buildingDesignBaySideOffset(target,geometry,side,target.bayIndex)}
    if(field==='width'&&target.type==='window'){
      const bounds=buildingDesignWindowBayBounds(target,geometry);
      target.offset=buildingDesignRound(buildingDesignClamp(Number(target.offset),bounds.min,bounds.max),2)
    }
  },buildingDesignDoorName(door)+' '+field+' updated.')
}
function buildingDesignPlacePersonnelDoor(side){
  const door=buildingDesignSelectedDoor();
  if(!door||door.type!=='personnel'||activeBuildingDesign.locked||!['left','right'].includes(side))return;
  buildingDesignMutate(geometry=>{
    const target=buildingDesignMarkOpeningCustomer(geometry.doors.find(item=>item.id===door.id));
    target.baySide=side;
    if(!Number.isInteger(Number(target.bayIndex)))buildingDesignSetDoorBayFromOffset(target,geometry);
    target.offset=buildingDesignBaySideOffset(target,geometry,side,target.bayIndex)
  },buildingDesignDoorName(door)+' placed on the '+side+' side of '+buildingDesignBayLabel(door,activeBuildingDesign.geometry)+'.')
}
function buildingDesignMoveOpeningToBay(delta){
  const door=buildingDesignSelectedDoor();
  if(!door||!['personnel','window'].includes(door.type)||activeBuildingDesign.locked)return;
  buildingDesignMutate(geometry=>{
    const target=buildingDesignMarkOpeningCustomer(geometry.doors.find(item=>item.id===door.id)),current=buildingDesignDoorBay(target,geometry);
    const nextIndex=buildingDesignClamp(current.index+Number(delta),0,current.info.count-1);
    target.bayIndex=nextIndex;
    if(target.type==='personnel'){
      const side=buildingDesignDoorBaySide(target,geometry)||'left';
      target.baySide=side;target.offset=buildingDesignBaySideOffset(target,geometry,side,nextIndex)
    }else{
      const nextStart=nextIndex*current.info.spacing;
      target.offset=buildingDesignRound(nextStart+(current.info.spacing-Number(target.width))/2,2);
      const bounds=buildingDesignWindowBayBounds(target,geometry);
      target.offset=buildingDesignRound(buildingDesignClamp(target.offset,bounds.min,bounds.max),2)
    }
  },buildingDesignDoorName(door)+' moved to '+buildingDesignBayLabel({...door,bayIndex:buildingDesignClamp(buildingDesignDoorBay(door,activeBuildingDesign.geometry).index+Number(delta),0,buildingDesignDoorBay(door,activeBuildingDesign.geometry).info.count-1)},activeBuildingDesign.geometry)+'.')
}
function buildingDesignSetDoorOffset(offset,record=true){
  const door=buildingDesignSelectedDoor();
  if(!door||activeBuildingDesign.locked)return;
  const wallLength=buildingDesignWallLength(activeBuildingDesign.geometry,door.wall),previous=Number(door.offset)||0;
  let nextBayIndex=Number.isInteger(Number(door.bayIndex))?Number(door.bayIndex):null;
  let next=buildingDesignClamp(Number(offset)||0,0,Math.max(0,wallLength-(Number(door.width)||0)));
  if(buildingDesignShouldSnapDoor(door)){
    const bay=buildingDesignBayInfo(activeBuildingDesign.geometry,door.wall);
    next=Math.round(next/bay.spacing)*bay.spacing
  }
  if(door.type==='window'){
    const candidate={...door,offset:next};buildingDesignSetDoorBayFromOffset(candidate,activeBuildingDesign.geometry);
    const bounds=buildingDesignWindowBayBounds(candidate,activeBuildingDesign.geometry);
    nextBayIndex=candidate.bayIndex;
    next=buildingDesignClamp(next,bounds.min,bounds.max);
    candidate.offset=next;
    if(!buildingDesignOpeningPlacementClear(candidate,activeBuildingDesign.geometry))return
  }
  next=buildingDesignRound(buildingDesignClamp(next,0,Math.max(0,wallLength-(Number(door.width)||0))),2);
  if(Math.abs(next-previous)<.001)return;
  if(record)buildingDesignRecord();
  door.offset=next;
  buildingDesignMarkOpeningCustomer(door);
  if(door.type==='personnel'){delete door.baySide;buildingDesignSetDoorBayFromOffset(door,activeBuildingDesign.geometry)}
  if(door.type==='window')door.bayIndex=nextBayIndex;
  buildingDesignMarkDirty();
  activeBuildingDesign.announcement=buildingDesignDoorName(door)+' moved to '+next.toFixed(2)+' metres.';
  buildingDesignRenderInteractive()
}
function buildingDesignNudge(delta){
  const door=buildingDesignSelectedDoor();
  if(!door||activeBuildingDesign.locked)return;
  if(door.type==='skylight'){buildingDesignNudgeSkylight(Number(delta),0);return}
  if(door.type==='solar'){buildingDesignNudgeSolarArray(Number(delta),0);return}
  const wallLength=buildingDesignWallLength(activeBuildingDesign.geometry,door.wall),previous=Number(door.offset)||0;
  let nextBayIndex=Number.isInteger(Number(door.bayIndex))?Number(door.bayIndex):null;
  const maximum=Math.max(0,wallLength-(Number(door.width)||0));
  let next=buildingDesignRound(buildingDesignClamp(Number(door.offset)+Number(delta),0,maximum),2);
  if(door.type==='window'){
    const candidate={...door,offset:next};buildingDesignSetDoorBayFromOffset(candidate,activeBuildingDesign.geometry);
    const bounds=buildingDesignWindowBayBounds(candidate,activeBuildingDesign.geometry);
    nextBayIndex=candidate.bayIndex;
    next=buildingDesignRound(buildingDesignClamp(next,bounds.min,bounds.max),2);
    candidate.offset=next;
    if(!buildingDesignOpeningPlacementClear(candidate,activeBuildingDesign.geometry))return
  }
  if(Math.abs(next-previous)<.001)return;
  buildingDesignRecord();
  door.offset=next;
  buildingDesignMarkOpeningCustomer(door);
  if(door.type==='personnel'){delete door.baySide;buildingDesignSetDoorBayFromOffset(door,activeBuildingDesign.geometry)}
  if(door.type==='window')door.bayIndex=nextBayIndex;
  buildingDesignMarkDirty();
  activeBuildingDesign.announcement=buildingDesignDoorName(door)+' moved to '+next.toFixed(2)+' metres.';
  buildingDesignRenderInteractive()
}
function buildingDesignNudgeSkylight(deltaX,deltaY){
  const skylight=buildingDesignSelectedDoor();
  if(!skylight||skylight.type!=='skylight'||activeBuildingDesign.locked)return;
  const geometry=activeBuildingDesign.geometry,candidate={...skylight,offsetX:buildingDesignRound(Number(skylight.offsetX)+Number(deltaX),2),offsetY:buildingDesignRound(Number(skylight.offsetY)+Number(deltaY),2)};
  if(deltaY){
    const grid=buildingDesignBayInfo(geometry,'right'),centre=candidate.offsetY+Number(candidate.length)/2;
    candidate.bayIndex=buildingDesignClamp(Math.floor(centre/grid.spacing),0,grid.count-1)
  }
  const bounds=buildingDesignSkylightBounds(candidate,geometry);
  candidate.offsetX=buildingDesignRound(buildingDesignClamp(candidate.offsetX,bounds.minX,bounds.maxX),2);
  candidate.offsetY=buildingDesignRound(buildingDesignClamp(candidate.offsetY,bounds.minY,bounds.maxY),2);
  if(candidate.offsetX===skylight.offsetX&&candidate.offsetY===skylight.offsetY)return;
  if(!buildingDesignSkylightPlacementClear(candidate,geometry))return;
  buildingDesignRecord();Object.assign(skylight,buildingDesignMarkOpeningCustomer(candidate));buildingDesignMarkDirty();
  activeBuildingDesign.skylightAnchorId=skylight.id;
  activeBuildingDesign.announcement=buildingDesignDoorName(skylight)+' moved within '+buildingDesignSkylightBayLabel(skylight,geometry)+'.';
  buildingDesignRenderInteractive()
}
function buildingDesignMoveSkylightToBay(delta){
  const skylight=buildingDesignSelectedDoor();
  if(!skylight||skylight.type!=='skylight'||activeBuildingDesign.locked)return;
  const geometry=activeBuildingDesign.geometry,current=buildingDesignSkylightBay(skylight,geometry),nextIndex=buildingDesignClamp(current.index+Number(delta),0,current.info.count-1);
  if(nextIndex===current.index)return;
  const candidate={...skylight,bayIndex:nextIndex,offsetY:buildingDesignRound(nextIndex*current.info.spacing+(current.info.spacing-Number(skylight.length))/2,2)},bounds=buildingDesignSkylightBounds({...skylight,bayIndex:nextIndex},geometry);
  candidate.offsetY=buildingDesignRound(buildingDesignClamp(candidate.offsetY,bounds.minY,bounds.maxY),2);
  if(!buildingDesignSkylightPlacementClear(candidate,geometry))return;
  buildingDesignRecord();Object.assign(skylight,buildingDesignMarkOpeningCustomer(candidate));buildingDesignMarkDirty();
  activeBuildingDesign.skylightAnchorId=skylight.id;
  activeBuildingDesign.announcement=buildingDesignDoorName(skylight)+' moved to '+buildingDesignSkylightBayLabel(skylight,geometry)+'.';
  buildingDesignRenderInteractive()
}
function buildingDesignNudgeWindowVertical(delta){
  const windowOpening=buildingDesignSelectedDoor();
  if(!windowOpening||windowOpening.type!=='window'||activeBuildingDesign.locked)return;
  const bounds=buildingDesignWindowVerticalBounds(windowOpening,activeBuildingDesign.geometry);
  const next=buildingDesignRound(buildingDesignClamp(Number(windowOpening.sillHeight)+Number(delta),bounds.min,bounds.max),2);
  if(Math.abs(next-Number(windowOpening.sillHeight))<.001)return;
  const candidate={...windowOpening,sillHeight:next};
  if(!buildingDesignOpeningPlacementClear(candidate,activeBuildingDesign.geometry))return;
  buildingDesignRecord();windowOpening.sillHeight=next;buildingDesignMarkOpeningCustomer(windowOpening);buildingDesignMarkDirty();
  activeBuildingDesign.announcement=buildingDesignDoorName(windowOpening)+' sill height moved to '+next.toFixed(2)+' metres.';
  buildingDesignRenderInteractive()
}
function buildingDesignCentreDoor(){
  const door=buildingDesignSelectedDoor();
  if(!door||activeBuildingDesign.locked)return;
  if(door.type==='solar'){buildingDesignCentreSolarArray(door);return}
  if(door.type==='skylight'){
    const bounds=buildingDesignSkylightBounds(door,activeBuildingDesign.geometry),candidate={...door,offsetX:buildingDesignRound(((Number(activeBuildingDesign.geometry.width)||0)-Number(door.width))/2,2),offsetY:buildingDesignRound((bounds.bay.start+bounds.bay.end-Number(door.length))/2,2)};
    if(!buildingDesignSkylightPlacementClear(candidate,activeBuildingDesign.geometry))return;
    buildingDesignRecord();Object.assign(door,buildingDesignMarkOpeningCustomer(candidate));activeBuildingDesign.skylightAnchorId=door.id;buildingDesignMarkDirty();buildingDesignRenderInteractive();return
  }
  const wallLength=buildingDesignWallLength(activeBuildingDesign.geometry,door.wall);
  buildingDesignSetDoorOffset((wallLength-Number(door.width))/2,true)
}
function buildingDesignToggleSnap(){
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  activeBuildingDesign.snap=!activeBuildingDesign.snap;
  activeBuildingDesign.announcement='Snap to bay '+(activeBuildingDesign.snap?'on.':'off.');
  buildingDesignRenderInteractive()
}
function buildingDesignUndo(){
  if(!activeBuildingDesign||activeBuildingDesign.locked||!activeBuildingDesign.history.length)return;
  activeBuildingDesign.future.push(buildingDesignSnapshot());
  buildingDesignApplySnapshot(activeBuildingDesign.history.pop())
}
function buildingDesignRedo(){
  if(!activeBuildingDesign||activeBuildingDesign.locked||!activeBuildingDesign.future.length)return;
  activeBuildingDesign.history.push(buildingDesignSnapshot());
  buildingDesignApplySnapshot(activeBuildingDesign.future.pop())
}
function buildingDesignReset(){
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  buildingDesignRecord();
  buildingDesignApplySnapshot(activeBuildingDesign.baseline);
  activeBuildingDesign.announcement='The last saved building design has been restored.'
}
function buildingDesignZoom(delta){
  if(!activeBuildingDesign)return;
  activeBuildingDesign.zoom=buildingDesignClamp(buildingDesignRound(activeBuildingDesign.zoom+Number(delta),2),.75,1.5);
  activeBuildingDesign.announcement='Drawing zoom '+Math.round(activeBuildingDesign.zoom*100)+' percent.';
  buildingDesignRenderDrawing()
}
function buildingDesignFitView(){
  if(!activeBuildingDesign)return;
  activeBuildingDesign.zoom=1;
  activeBuildingDesign.announcement='Drawing fitted to the available space.';
  buildingDesignRenderDrawing()
}
function buildingDesignOpeningKey(event,id){
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))return;
  event.preventDefault();
  if(!activeBuildingDesign)return;
  activeBuildingDesign.selectedDoorId=id;
  const opening=buildingDesignSelectedDoor();
  if(opening?.type==='solar'){
    if(event.key==='ArrowLeft')buildingDesignNudgeSolarArray(-.1,0);
    else if(event.key==='ArrowRight')buildingDesignNudgeSolarArray(.1,0);
    else if(event.key==='ArrowUp')buildingDesignNudgeSolarArray(0,-.1);
    else if(event.key==='ArrowDown')buildingDesignNudgeSolarArray(0,.1)
  }else if(opening?.type==='skylight'){
    if(event.key==='ArrowLeft')buildingDesignNudgeSkylight(-.1,0);
    else if(event.key==='ArrowRight')buildingDesignNudgeSkylight(.1,0);
    else if(event.key==='ArrowUp')buildingDesignNudgeSkylight(0,-.1);
    else if(event.key==='ArrowDown')buildingDesignNudgeSkylight(0,.1)
  }else if(event.key==='ArrowLeft')buildingDesignNudge(-.1);
  else if(event.key==='ArrowRight')buildingDesignNudge(.1);
  else if(event.key==='ArrowUp')buildingDesignNudgeWindowVertical(.1);
  else if(event.key==='ArrowDown')buildingDesignNudgeWindowVertical(-.1)
}
function buildingDesignStartDrag(event,id){
  // Browsers emit both pointer and mouse events for a mouse press. Let the
  // dedicated mouse path own desktop dragging so preventDefault on pointerdown
  // cannot suppress the subsequent mousemove events.
  if(event.type==='pointerdown'&&event.pointerType==='mouse')return;
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  const door=activeBuildingDesign.geometry.doors.find(item=>item.id===id)||activeBuildingDesign.geometry.skylights?.find(item=>item.id===id)||activeBuildingDesign.geometry.solarArrays?.find(item=>item.id===id);
  if(!door)return;
  if((door.type==='skylight'||door.type==='solar')&&activeBuildingDesign.view!=='plan')return;
  if(door.type!=='skylight'&&door.type!=='solar'&&(activeBuildingDesign.view==='plan'||BUILDING_DESIGN_VIEWS[activeBuildingDesign.view].wall!==door.wall))return;
  event.preventDefault();
  activeBuildingDesign.selectedDoorId=id;
  activeBuildingDesign.drag={id,start:buildingDesignSnapshot(),moved:false};
  document.addEventListener('pointermove',buildingDesignDragMove);
  document.addEventListener('mousemove',buildingDesignDragMove);
  document.addEventListener('pointerup',buildingDesignEndDrag,{once:true});
  document.addEventListener('mouseup',buildingDesignEndDrag,{once:true})
}
function buildingDesignDragMove(event){
  const state=activeBuildingDesign,door=buildingDesignSelectedDoor(),svg=document.querySelector('#buildingDesignSvg');
  if(!state?.drag||!door||!svg||!state.canvas)return;
  const rect=svg.getBoundingClientRect(),point=(event.clientX-rect.left)*900/rect.width,pointY=(event.clientY-rect.top)*480/rect.height;
  if(door.type==='solar'){
    const {x,y,width,height,roofWidth,roofLength}=state.canvas;
    const across=state.canvas.planAxesTransposed?(pointY-y)/height*roofWidth:(point-x)/width*roofWidth;
    const along=state.canvas.planAxesTransposed?(point-x)/width*roofLength:(pointY-y)/height*roofLength;
    // Snap along the roof to a bay; across, follow the pointer and fit beside skylights.
    const drop=buildingDesignSolarDropCandidate(door,across,along,state.geometry),candidate=drop.candidate;
    state.solarNote={id:door.id,text:candidate?(drop.reduced?buildingDesignDoorName(door)+' reduced to 1 panel deep to clear the skylights.':''):'Roof bay '+drop.bay+' is blocked by skylights here.'};
    if(!candidate){buildingDesignRenderInteractive();return}
    if(candidate.offsetX===door.offsetX&&candidate.offsetY===door.offsetY&&candidate.rows===door.rows)return;
    if(drop.reduced)door.fullRows=drop.full;else delete door.fullRows;
    door.rows=candidate.rows;buildingDesignSolarApplySize(door);
    door.offsetX=candidate.offsetX;door.offsetY=candidate.offsetY;buildingDesignMarkOpeningCustomer(door);state.solarAnchorId=door.id;
    state.drag.moved=true;buildingDesignMarkDirty();buildingDesignRenderInteractive();return
  }
  if(door.type==='skylight'){
    const {x,y,width,height,roofWidth,roofLength}=state.canvas;
    const candidate=state.canvas.planAxesTransposed
      ?{...door,offsetX:(pointY-y)/height*roofWidth-Number(door.width)/2,offsetY:(point-x)/width*roofLength-Number(door.length)/2}
      :{...door,offsetX:(point-x)/width*roofWidth-Number(door.width)/2,offsetY:(pointY-y)/height*roofLength-Number(door.length)/2};
    const grid=buildingDesignBayInfo(state.geometry,'right'),centre=candidate.offsetY+Number(candidate.length)/2;
    candidate.bayIndex=buildingDesignClamp(Math.floor(centre/grid.spacing),0,grid.count-1);
    const bounds=buildingDesignSkylightBounds(candidate,state.geometry);
    candidate.offsetX=buildingDesignRound(buildingDesignClamp(candidate.offsetX,bounds.minX,bounds.maxX),2);
    candidate.offsetY=buildingDesignRound(buildingDesignClamp(candidate.offsetY,bounds.minY,bounds.maxY),2);
    if(!buildingDesignSkylightPlacementClear(candidate,state.geometry))return;
    if(candidate.offsetX===door.offsetX&&candidate.offsetY===door.offsetY)return;
    door.offsetX=candidate.offsetX;door.offsetY=candidate.offsetY;door.bayIndex=candidate.bayIndex;buildingDesignMarkOpeningCustomer(door);
    state.skylightAnchorId=door.id;
    state.drag.moved=true;buildingDesignMarkDirty();buildingDesignRenderInteractive();return
  }
  const previous=Number(door.offset)||0,previousSill=Number(door.sillHeight)||0;
  let nextBayIndex=Number.isInteger(Number(door.bayIndex))?Number(door.bayIndex):null;
  const {x0,x1,wallLength}=state.canvas;
  let next=(point-x0)/(x1-x0)*wallLength-Number(door.width)/2;
  let nextSill=previousSill;
  if(buildingDesignShouldSnapDoor(door)){
    const bay=buildingDesignBayInfo(state.geometry,door.wall);
    next=Math.round(next/bay.spacing)*bay.spacing
  }
  if(door.type==='window'){
    const candidate={...door,offset:next};buildingDesignSetDoorBayFromOffset(candidate,state.geometry);
    const bounds=buildingDesignWindowBayBounds(candidate,state.geometry);
    nextBayIndex=candidate.bayIndex;
    next=buildingDesignClamp(next,bounds.min,bounds.max);
    const vertical=buildingDesignWindowVerticalBounds(door,state.geometry),height=Number(door.height)||0;
    nextSill=buildingDesignRound(buildingDesignClamp((state.canvas.yFloor-pointY)/(state.canvas.yFloor-state.canvas.yEave)*state.canvas.eaveHeight-height/2,vertical.min,vertical.max),2)
  }
  next=buildingDesignRound(buildingDesignClamp(next,0,Math.max(0,wallLength-Number(door.width))),2);
  if(door.type==='window'&&!buildingDesignOpeningPlacementClear({...door,offset:next,sillHeight:nextSill},state.geometry))return;
  if(Math.abs(next-previous)<.001&&Math.abs(nextSill-previousSill)<.001)return;
  door.offset=next;
  buildingDesignMarkOpeningCustomer(door);
  if(door.type==='window')door.sillHeight=nextSill;
  state.drag.moved=true;buildingDesignMarkDirty();
  if(door.type==='personnel'){delete door.baySide;buildingDesignSetDoorBayFromOffset(door,state.geometry)}
  if(door.type==='window')door.bayIndex=nextBayIndex;
  buildingDesignRenderInteractive()
}
function buildingDesignEndDrag(){
  const state=activeBuildingDesign;
  document.removeEventListener('pointermove',buildingDesignDragMove);
  document.removeEventListener('mousemove',buildingDesignDragMove);
  if(!state?.drag)return;
  if(state.drag.moved){
    state.history.push(state.drag.start);state.future=[];
    state.announcement=buildingDesignDoorName(buildingDesignSelectedDoor())+' moved.'
  }
  state.drag=null;buildingDesignRenderInteractive()
}
function buildingDesignSaveModel(status){
  const current=buildingDesignCurrent(),p=current?.project,state=current?.state;
  if(!p||!state)return false;
  const original=p.geometry?.original?buildingDesignClone(p.geometry.original):buildingDesignClone(state.initialGeometry);
  p.geometry=buildingDesignClone(state.geometry);
  p.geometry.original=original;
  if(typeof sanitizeDoorIds==='function')sanitizeDoorIds(p.geometry);
  if(typeof sanitizeDoorSources==='function')sanitizeDoorSources(p.geometry);
  buildingDesignSanitizeSkylights(p.geometry);
  buildingDesignSanitizeSolarArrays(p.geometry);
  if(!projectIsSteelFreeStanding(buildingDesignProjectFacts(p))&&typeof syncFactsFromGeometry==='function'){
    syncFactsFromGeometry(p);
  }
  const timestamp=now();
  p.buildingDesign={
    ...(p.buildingDesign||{}),editing:undefined,status,uiVersion:BUILDING_DESIGN_UI_VERSION,
    sourceFingerprint:buildingDesignFingerprint(p,p.geometry),
    baySpacing:buildingDesignRound(buildingDesignBayInfo(p.geometry,'right').spacing,2),
    structuralGrid:{
      material:buildingDesignIsSteelProject(p)?'steel':'non-steel',
      windLoad:buildingDesignWindLoad(p),
      lengthBayCount:buildingDesignBayInfo(p.geometry,'right').count,
      lengthBaySpacing:buildingDesignRound(buildingDesignBayInfo(p.geometry,'right').spacing,2),
      gableBayCount:buildingDesignBayInfo(p.geometry,'front').count,
      gableBaySpacing:buildingDesignRound(buildingDesignBayInfo(p.geometry,'front').spacing,2),
      indicative:true
    },
    lastView:state.view,selectedDoorId:state.selectedDoorId,updatedAt:timestamp,
    confirmedAt:status==='confirmed'?timestamp:(p.buildingDesign?.confirmedAt||null),
    sourceSiteLayoutConfirmedAt:buildingDesignProjectFacts(p).siteLayoutConfirmedAt||null
  };
  // Stage 2 background checks (background-checks.js: boundary distance,
  // indicative fire exits, other flags) are stored apart from user openings at
  // p.backgroundChecks: any save deletes them, and only a confirmed design
  // re-runs them. They are never rendered on this page.
  // Building-regs calculation: openings changed, so fire exits are deleted and
  // everything re-runs now (fire exits only when the design is confirmed).
  if(typeof pcFireExitClear==='function')pcFireExitClear(p);
  if(status==='confirmed'&&typeof pcFireExitRefresh==='function')pcFireExitRefresh(p);
  else if(typeof pcBuildingRegsRun==='function')pcBuildingRegsRun(p);
  p.facts=p.facts||{};
  p.facts.buildingDesignStatus=status;
  p.history=p.history||[];
  p.history.push({at:timestamp,text:status==='confirmed'?'Building Design confirmed':'Building Design draft saved'});
  save();
  state.baseline=buildingDesignSnapshot();
  state.baseline.geometry=buildingDesignClone(state.geometry);
  state.savedStatus=status;
  state.dirty=false;
  return true
}
function saveBuildingDesignDraft(){
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  if(buildingDesignSaveModel('draft')){
    activeBuildingDesign.announcement='Building design draft saved.';
    buildingDesignRenderInteractive()
  }
}
function confirmBuildingDesign(){
  if(!activeBuildingDesign||activeBuildingDesign.locked)return;
  const updatingConfirmed=Boolean(activeBuildingDesign.editingConfirmed);
  const issues=buildingDesignIssues(activeBuildingDesign.geometry);
  if(issues.length){
    activeBuildingDesign.announcement='Resolve '+issues.length+' geometric issue'+(issues.length===1?'':'s')+' before confirming.';
    buildingDesignRenderInteractive();
    document.querySelector('#buildingDesignValidation')?.scrollIntoView({behavior:'smooth',block:'center'});
    alert('Resolve the highlighted opening issue'+(issues.length===1?'':'s')+' before confirming the building design.');
    return
  }
  if(buildingDesignSaveModel('confirmed')){
    activeBuildingDesign.locked=true;
    activeBuildingDesign.editingConfirmed=false;
    activeBuildingDesign.editOrigin=null;
    activeBuildingDesign.history=[];
    activeBuildingDesign.future=[];
    activeBuildingDesign.announcement=updatingConfirmed?'Updated building design confirmed and locked.':'Building design confirmed and locked.';
    buildingDesignRenderInteractive()
  }
}
function editConfirmedBuildingDesign(){
  if(!activeBuildingDesign||!activeBuildingDesign.locked)return;
  activeBuildingDesign.editOrigin=buildingDesignClone(activeBuildingDesign.baseline);
  activeBuildingDesign.editingConfirmed=true;
  activeBuildingDesign.history=[];
  activeBuildingDesign.future=[];
  activeBuildingDesign.locked=false;
  const editedProject=getP(activeBuildingDesign.projectId);
  // Delete auto-placed fire doors now and remember the edit, so a reload or
  // any other render path does not draw them until the design is confirmed again.
  if(typeof pcFireExitClear==='function')pcFireExitClear(editedProject);
  if(editedProject&&editedProject.buildingDesign)editedProject.buildingDesign.editing=true;
  save();
  activeBuildingDesign.announcement='Building design unlocked for editing.';
  buildingDesignRenderInteractive()
}
function cancelConfirmedBuildingDesignEdit(){
  const state=activeBuildingDesign,origin=state?.editOrigin;
  if(!state||!state.editingConfirmed||!origin)return;
  state.geometry=buildingDesignClone(origin.geometry);
  state.selectedDoorId=origin.selectedDoorId||null;
  state.view=BUILDING_DESIGN_VIEWS[origin.view]?origin.view:'b';
  state.snap=origin.snap!==false;
  state.zoom=Number(origin.zoom)||1;
  state.skylightAnchorId=origin.skylightAnchorId||null;
  state.solarAnchorId=origin.solarAnchorId||null;
  state.locked=true;
  state.editingConfirmed=false;
  state.editOrigin=null;
  state.savedStatus='confirmed';
  state.history=[];
  state.future=[];
  state.dirty=false;
  const cancelledProject=getP(state.projectId);
  if(cancelledProject&&cancelledProject.buildingDesign&&cancelledProject.buildingDesign.editing){delete cancelledProject.buildingDesign.editing;save()}
  state.announcement='Editing cancelled. The confirmed building design has been restored.';
  buildingDesignRenderInteractive()
}

function buildingDesignAddress(p){return String(p.address||'Site address not added')}
function buildingDesignSvgGrid(){
  let output='';
  for(let x=0;x<=900;x+=75)output+='<line x1="'+x+'" y1="0" x2="'+x+'" y2="480" class="bd-grid-line"/>';
  for(let y=0;y<=480;y+=60)output+='<line x1="0" y1="'+y+'" x2="900" y2="'+y+'" class="bd-grid-line"/>';
  return output
}
function buildingDesignGableColumnPositions(geometry,wall,bay){
  const wallLength=buildingDesignWallLength(geometry,wall);
  if(!buildingDesignIsSteelProject(buildingDesignCurrent()?.project))return Array.from({length:bay.count+1},(_,index)=>({metres:index*bay.spacing,adjusted:false}));
  const rollerSpans=geometry.doors.filter(door=>door.wall===wall&&door.type==='roller').map(door=>({start:buildingDesignClamp(Number(door.offset)||0,0,wallLength),end:buildingDesignClamp((Number(door.offset)||0)+(Number(door.width)||0),0,wallLength)})).sort((a,b)=>a.start-b.start);
  const rollers=rollerSpans.reduce((merged,span)=>{
    const previous=merged[merged.length-1];
    if(previous&&span.start<=previous.end+.001)previous.end=Math.max(previous.end,span.end);
    else merged.push({...span});
    return merged
  },[]);
  if(!rollers.length)return Array.from({length:bay.count+1},(_,index)=>({metres:index*bay.spacing,adjusted:false}));
  let positions=[{metres:0,adjusted:false}],cursor=0;
  const addBalancedGap=(start,end)=>{
    const span=end-start;
    if(span<=.001)return;
    const grid=buildingDesignGridForLength(span);
    for(let index=1;index<=grid.count;index++)positions.push({metres:start+span*index/grid.count,adjusted:false})
  };
  rollers.forEach(door=>{
    if(door.start>cursor+.001)addBalancedGap(cursor,door.start);
    positions.push({metres:door.start,adjusted:true},{metres:door.end,adjusted:true});
    cursor=Math.max(cursor,door.end)
  });
  if(cursor<wallLength-.001)addBalancedGap(cursor,wallLength);
  return positions.sort((a,b)=>a.metres-b.metres).reduce((result,position)=>{
    const previous=result[result.length-1];
    if(previous&&Math.abs(previous.metres-position.metres)<=.001)previous.adjusted=previous.adjusted||position.adjusted;
    else result.push({...position});
    return result
  },[])
}
function buildingDesignGableDoorFrames(geometry,wall,x0,x1,yFloor,yEave,wallLength){
  if(!buildingDesignIsSteelProject(buildingDesignCurrent()?.project))return '';
  const scaleX=(x1-x0)/wallLength,scaleY=(yFloor-yEave)/(Number(geometry.eaveHeight)||1);
  return geometry.doors.filter(door=>door.wall===wall&&door.type==='roller').map(door=>{
    const start=x0+(Number(door.offset)||0)*scaleX,end=start+(Number(door.width)||0)*scaleX,head=yFloor-(Number(door.height)||0)*scaleY;
    return '<g class="bd-gable-door-frame"><line x1="'+start+'" y1="'+head+'" x2="'+start+'" y2="'+yEave+'"/><line x1="'+end+'" y1="'+head+'" x2="'+end+'" y2="'+yEave+'"/><line x1="'+start+'" y1="'+head+'" x2="'+end+'" y2="'+head+'"/></g>'
  }).join('')
}
// Leaf-style door elevation (matches assets/page15b-personnel.svg): white frame,
// light-green leaf panel and a handle. Double doors are two equal leaves meeting
// in the middle with handles near the centre. Fire doors add a green horizontal
// push bar (across both leaves on a double); the FE1/FE2 label sits above.
function buildingDesignLeafDoorSvg(x,y,w,h,opts={}){
  const leaves=opts.double?2:1,lw=w/leaves,fire=Boolean(opts.fire);
  let out='<g class="bd-leaf-door'+(opts.double?' is-double':'')+(fire?' is-fire':'')+'"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="1" class="bd-personnel-fill"/>';
  for(let index=0;index<leaves;index++){
    const lx=x+index*lw;
    out+='<rect x="'+(lx+lw*.14)+'" y="'+(y+h*.11)+'" width="'+(lw*.72)+'" height="'+(h*.78)+'" class="bd-door-panel"/>';
    const hx=opts.double?(index===0?lx+lw*.8:lx+lw*.2):lx+lw*.74;
    out+='<circle cx="'+hx+'" cy="'+(y+h*.535)+'" r="'+Math.max(1.5,Math.min(2.5,lw*.05))+'" class="bd-door-handle"/>'
  }
  if(opts.double)out+='<line x1="'+(x+w/2)+'" y1="'+y+'" x2="'+(x+w/2)+'" y2="'+(y+h)+'" class="bd-double-door-split"/>';
  if(fire){
    const barY=y+h*.47;
    out+='<line x1="'+(x+w*.08)+'" y1="'+barY+'" x2="'+(x+w*.92)+'" y2="'+barY+'" class="bd-fire-pushbar"/>'
  }
  return out+'</g>'
}
// Auto-placed indicative fire exits (background-checks.js, p.backgroundChecks):
// shown read-only on the Building Design plan and elevations ONLY while the design
// is confirmed and locked. Never stored in geometry.doors; Edit Building Design
// deletes them (editConfirmedBuildingDesign -> pcFireExitClear).
function buildingDesignAutoFireDoors(){
  const state=activeBuildingDesign;
  // Fire doors draw only on a confirmed (locked) design — never while unlocked
  // for editing, and never from a preview or cached checks.
  if(!state||!state.locked||state.editingConfirmed||typeof pcBackgroundChecksFor!=='function')return [];
  const p=getP(state.projectId);
  if(!p||!(typeof pcFireExitDesignConfirmed!=='function'||pcFireExitDesignConfirmed(p)))return [];
  const before=p.backgroundChecks?p.backgroundChecks.sourceFingerprint:null;
  let checks=null;
  try{checks=pcBackgroundChecksFor(p)}catch(error){return []}
  if((checks?checks.sourceFingerprint:null)!==before)save();
  return ((checks&&checks.fireExits&&checks.fireExits.doors)||[]).map(door=>({...door,type:'fireExit',height:Number(door.height)||2.1}));
}
function buildingDesignSvgFireDoor(door,geometry,x0,x1,yFloor,yEave,wallLength){
  const width=Math.max(10,(Number(door.width)||0)/wallLength*(x1-x0));
  const height=Math.max(16,(Number(door.height)||2.1)/(Number(geometry.eaveHeight)||1)*(yFloor-yEave));
  const x=x0+(Number(door.offset)||0)/wallLength*(x1-x0),y=yFloor-height,title='Indicative fire exit '+door.ref+(door.subtype==='double'?' (double fire door)':' (single fire door)');
  return '<g class="bd-auto-fire-door" data-fire-exit="'+esc(door.ref)+'" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title>'+buildingDesignLeafDoorSvg(x,y,width,height,{double:door.subtype==='double',fire:true})+
    '<text x="'+(x+width/2)+'" y="'+Math.max(24,y-10)+'" text-anchor="middle" class="bd-opening-label bd-fire-label">'+esc(door.ref)+'</text></g>'
}
function buildingDesignPlanFireDoor(door,geometry,x,y,width,height){
  const {x1,y1,x2,y2}=buildingDesignPlanOpeningGeometry(door,geometry,x,y,width,height);
  const inward=door.wall==='front'?[-1,0]:door.wall==='back'?[1,0]:door.wall==='left'?[0,1]:[0,-1];
  const nx=inward[0],ny=inward[1],title='Indicative fire exit '+door.ref;
  const leafDoor={...door,type:'personnel',subtype:door.subtype==='double'?'double':undefined};
  const bar='<line x1="'+(x1+nx*5)+'" y1="'+(y1+ny*5)+'" x2="'+(x2+nx*5)+'" y2="'+(y2+ny*5)+'" class="bd-plan-fire-pushbar"/>';
  // Tag outside the wall, except Elevation C where the width dimension sits outside.
  const tagSide=door.wall==='back'?-1:1,cx=(x1+x2)/2-nx*30*tagSide,cy=(y1+y2)/2-ny*30*tagSide;
  return '<g class="bd-plan-opening bd-auto-fire-door is-fire" data-fire-exit="'+esc(door.ref)+'" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title>'+buildingDesignPlanOpeningSymbol(leafDoor,x1,y1,x2,y2)+bar+
    '<rect x="'+(cx-15)+'" y="'+(cy-7)+'" width="30" height="14" rx="3" class="bd-fire-badge"/><text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" class="bd-fire-badge-text">'+esc(door.ref)+'</text></g>'
}
function buildingDesignSvgOpening(door,geometry,x0,x1,yFloor,yEave,wallLength){
  const width=Math.max(4,(Number(door.width)||0)/wallLength*(x1-x0));
  const height=Math.max(8,(Number(door.height)||0)/(Number(geometry.eaveHeight)||1)*(yFloor-yEave));
  const bottom=Math.max(0,buildingDesignOpeningBottom(door))/(Number(geometry.eaveHeight)||1)*(yFloor-yEave);
  const x=x0+(Number(door.offset)||0)/wallLength*(x1-x0),y=yFloor-bottom-height;
  const selected=door.id===activeBuildingDesign.selectedDoorId;
  const issue=buildingDesignIssues(geometry).some(item=>item.doorId===door.id);
  const klass='bd-opening '+(selected?'is-selected ':'')+(issue?'has-issue ':'')+(activeBuildingDesign.locked?'is-locked':'');
  const label=esc(door.ref||buildingDesignDoorName(door));
  const doorBody=door.type==='window'
    ?'<g><rect x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" rx="1" class="bd-window-fill"/><line x1="'+(x+width/2)+'" y1="'+y+'" x2="'+(x+width/2)+'" y2="'+(y+height)+'" class="bd-window-mullion"/><line x1="'+x+'" y1="'+(y+height/2)+'" x2="'+(x+width)+'" y2="'+(y+height/2)+'" class="bd-window-mullion"/></g>'
    :door.type==='personnel'
    ?(door.subtype==='double'
      ?buildingDesignLeafDoorSvg(x,y,width,height,{double:true})
      :'<image href="assets/page15b-personnel.svg" x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" preserveAspectRatio="none"/>')
    :'<g><rect x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" rx="2" class="bd-roller-fill"/>'+Array.from({length:6},(_,index)=>'<line x1="'+(x+5)+'" y1="'+(y+(index+1)*height/7)+'" x2="'+(x+width-5)+'" y2="'+(y+(index+1)*height/7)+'" class="bd-door-slat"/>').join('')+'</g>';
  return '<g class="'+klass+'" data-door-id="'+esc(door.id)+'" role="button" tabindex="0" aria-label="'+esc(buildingDesignDoorName(door))+'" onclick="buildingDesignSelectDoor(\''+esc(door.id)+'\')" onpointerdown="buildingDesignStartDrag(event,\''+esc(door.id)+'\')" onmousedown="buildingDesignStartDrag(event,\''+esc(door.id)+'\')">'+
    doorBody+'<text x="'+(x+width/2)+'" y="'+Math.max(24,y-10)+'" text-anchor="middle" class="bd-opening-label">'+label+'</text>'+
    (selected&&!activeBuildingDesign.locked?'<image href="assets/page15b-drag.svg" x="'+(x+width/2-10)+'" y="'+(y-10)+'" width="20" height="20"/>':'')+
    '</g>'
}
function buildingDesignElevationSvg(){
  const state=activeBuildingDesign,geometry=state.geometry,view=BUILDING_DESIGN_VIEWS[state.view],wall=view.wall;
  const wallLength=Math.max(.1,buildingDesignWallLength(geometry,wall));
  const eaveHeight=Math.max(.1,Number(geometry.eaveHeight)||0),overallHeight=Math.max(eaveHeight,Number(geometry.ridgeHeight)||eaveHeight);
  const drawingLeft=105,drawingRight=795,drawingTop=98,drawingBottom=408,drawingCentreX=(drawingLeft+drawingRight)/2,drawingCentreY=(drawingTop+drawingBottom)/2;
  const metresToPixels=Math.min((drawingRight-drawingLeft)/wallLength,(drawingBottom-drawingTop)/overallHeight);
  const drawnWidth=wallLength*metresToPixels,drawnHeight=overallHeight*metresToPixels;
  const x0=drawingCentreX-drawnWidth/2,x1=drawingCentreX+drawnWidth/2,ridgeY=drawingCentreY-drawnHeight/2,yFloor=drawingCentreY+drawnHeight/2,yEave=yFloor-eaveHeight*metresToPixels;
  state.canvas={x0,x1,wallLength,yFloor,yEave,eaveHeight,overallHeight,metresToPixels};
  const bay=buildingDesignBayInfo(geometry,wall),bearing=buildingDesignWallBearing(wall),selected=buildingDesignSelectedDoor(),gable=buildingDesignIsGableWall(wall);
  let bays='';
  const columns=gable?buildingDesignGableColumnPositions(geometry,wall,bay):Array.from({length:bay.count+1},(_,index)=>({metres:index*bay.spacing,adjusted:false}));
  columns.forEach((column,index)=>{
    const x=x0+(x1-x0)*column.metres/wallLength;
    const edge=index===0||index===columns.length-1;
    bays+='<line x1="'+x+'" y1="'+yEave+'" x2="'+x+'" y2="'+yFloor+'" class="'+(edge?'bd-wall-edge':column.adjusted?'bd-gable-column is-adjusted':'bd-bay-line')+'"/>';
    if(index<columns.length-1){
      const next=columns[index+1],nextX=x0+(x1-x0)*next.metres/wallLength,span=next.metres-column.metres;
      bays+='<text x="'+((x+nextX)/2)+'" y="'+(yFloor+19)+'" text-anchor="middle" class="bd-bay-label">B'+(index+1)+' '+span.toFixed(1)+' m</text>'
    }
  });
  const doors=geometry.doors.filter(door=>door.wall===wall).map(door=>buildingDesignSvgOpening(door,geometry,x0,x1,yFloor,yEave,wallLength)).join('')+buildingDesignAutoFireDoors().filter(door=>door.wall===wall).map(door=>buildingDesignSvgFireDoor(door,geometry,x0,x1,yFloor,yEave,wallLength)).join('');
  const gableFrames=gable?buildingDesignGableDoorFrames(geometry,wall,x0,x1,yFloor,yEave,wallLength):'';
  const roofRisePixels=Math.max(0,(overallHeight-eaveHeight)*metresToPixels),roofInset=Math.min(24,roofRisePixels);
  const roof=gable
    ?'<path d="M '+x0+' '+yEave+' L '+((x0+x1)/2)+' '+ridgeY+' L '+x1+' '+yEave+'" class="bd-roof-profile"/><line x1="'+x0+'" y1="'+yEave+'" x2="'+x1+'" y2="'+yEave+'" class="bd-eaves-line"/>'
    :'<path d="M '+x0+' '+yEave+' L '+(x0+roofInset)+' '+ridgeY+' L '+(x1-roofInset)+' '+ridgeY+' L '+x1+' '+yEave+' Z" class="bd-roof-profile"/><line x1="'+x0+'" y1="'+yEave+'" x2="'+x1+'" y2="'+yEave+'" class="bd-eaves-line"/>';
  return '<svg id="buildingDesignSvg" data-elevation-kind="'+(gable?'gable':'sidewall')+'" data-metres-scale="'+metresToPixels.toFixed(6)+'" data-horizontal-scale="'+((x1-x0)/wallLength).toFixed(6)+'" data-vertical-scale="'+((yFloor-yEave)/eaveHeight).toFixed(6)+'" viewBox="0 0 900 480" role="img" aria-label="'+esc(view.label+' '+view.side)+'" style="width:'+(state.zoom*100)+'%">'+
    buildingDesignSvgGrid()+
    '<text x="18" y="26" class="bd-canvas-title">'+esc(view.label.toUpperCase()+' — '+view.side.toUpperCase())+'</text>'+
    '<rect x="690" y="10" width="190" height="30" rx="8" class="bd-orientation-badge"/><text x="785" y="30" text-anchor="middle" class="bd-orientation-label">Facing '+bearing.label+' '+bearing.degrees+'°</text>'+
    '<line x1="'+x0+'" y1="62" x2="'+x1+'" y2="62" class="bd-dimension-line"/><line x1="'+x0+'" y1="52" x2="'+x0+'" y2="72" class="bd-dimension-line"/><line x1="'+x1+'" y1="52" x2="'+x1+'" y2="72" class="bd-dimension-line"/><text x="450" y="53" text-anchor="middle" class="bd-dimension-label">'+wallLength.toFixed(1)+' m overall '+(wall==='front'||wall==='back'?'width':'length')+'</text>'+
    '<rect x="'+x0+'" y="'+yEave+'" width="'+(x1-x0)+'" height="'+(yFloor-yEave)+'" class="bd-wall"/>'+roof+bays+doors+gableFrames+
    '<line x1="70" y1="'+yEave+'" x2="70" y2="'+yFloor+'" class="bd-dimension-line"/><line x1="60" y1="'+yEave+'" x2="80" y2="'+yEave+'" class="bd-dimension-line"/><line x1="60" y1="'+yFloor+'" x2="80" y2="'+yFloor+'" class="bd-dimension-line"/><text x="55" y="'+((yEave+yFloor)/2)+'" text-anchor="middle" transform="rotate(-90 55 '+((yEave+yFloor)/2)+')" class="bd-dimension-label">'+Number(geometry.eaveHeight).toFixed(1)+' m clear height</text>'+
    '<text x="450" y="'+Math.max(82,ridgeY-8)+'" text-anchor="middle" class="bd-ridge-label">INDICATIVE RIDGE '+Number(geometry.ridgeHeight).toFixed(2)+' m</text>'+
    '<rect x="18" y="438" width="864" height="32" rx="8" class="bd-canvas-status"/><text x="30" y="459" class="bd-canvas-status-text">'+esc(view.label+(selected?' · '+buildingDesignDoorName(selected)+' selected · '+buildingDesignBayLabel(selected,geometry):' · No opening selected')+(buildingDesignIsFreeGableRoller(selected)?' · Free position on gable':' · Snap to bay: '+(state.snap?'ON':'OFF')))+'</text>'+
    '</svg>'
}
function buildingDesignPlanOpeningGeometry(door,geometry,x,y,width,height){
  const wallLength=buildingDesignWallLength(geometry,door.wall),offset=Number(door.offset)||0,openingWidth=Number(door.width)||0;
  if(door.wall==='front')return {x1:x+width,y1:y+offset/wallLength*height,x2:x+width,y2:y+(offset+openingWidth)/wallLength*height};
  if(door.wall==='back')return {x1:x,y1:y+height-offset/wallLength*height,x2:x,y2:y+height-(offset+openingWidth)/wallLength*height};
  if(door.wall==='left')return {x1:x+width-offset/wallLength*width,y1:y,x2:x+width-(offset+openingWidth)/wallLength*width,y2:y};
  return {x1:x+offset/wallLength*width,y1:y+height,x2:x+(offset+openingWidth)/wallLength*width,y2:y+height}
}
function buildingDesignPlanOpeningRef(door){
  const number=String(door?.ref||'').match(/\d+/)?.[0]||'';
  const kind=buildingDesignOpeningKind(door);
  return kind==='window'?'W'+number:kind==='roller'?'RD'+number:kind==='double'?'DD'+number:'PD'+number
}
function buildingDesignPlanOpeningTitle(door){
  return buildingDesignDoorName(door)+' · '+Number(door.width).toFixed(2)+' m wide × '+Number(door.height).toFixed(2)+' m high'
}
function buildingDesignPlanLabelLanes(doors,geometry,x,y,width,height){
  const result={};
  ['front','back','left','right'].forEach(wall=>{
    const horizontal=wall==='left'||wall==='right';
    const items=doors.filter(door=>door.wall===wall).map(door=>{
      const point=buildingDesignPlanOpeningGeometry(door,geometry,x,y,width,height);
      return {door,position:horizontal?(point.x1+point.x2)/2:(point.y1+point.y2)/2}
    }).sort((a,b)=>a.position-b.position);
    const laneLast=[-Infinity,-Infinity,-Infinity],minimumGap=horizontal?42:26;
    items.forEach(item=>{
      let lane=laneLast.findIndex(last=>item.position-last>=minimumGap);
      if(lane<0)lane=laneLast.indexOf(Math.min(...laneLast));
      result[item.door.id]=lane;
      laneLast[lane]=item.position
    })
  });
  return result
}
function buildingDesignPlanLabel(door,x1,y1,x2,y2,lane){
  const cx=(x1+x2)/2,cy=(y1+y2)/2,step=12,sideStep=22,label=esc(buildingDesignPlanOpeningRef(door));
  let lx=cx,ly=cy,anchor='middle',leaderX=cx,leaderY=cy;
  if(door.wall==='left'){ly=y1-12-lane*step;leaderY=ly+4}
  else if(door.wall==='right'){ly=y1+16+lane*step;leaderY=ly-7}
  else if(door.wall==='back'){lx=x1-18-lane*sideStep;anchor='end';leaderX=lx+5}
  else{lx=x1+18+lane*sideStep;anchor='start';leaderX=lx-5}
  return '<line x1="'+cx+'" y1="'+cy+'" x2="'+leaderX+'" y2="'+leaderY+'" class="bd-plan-opening-leader"/>'+
    '<text x="'+lx+'" y="'+ly+'" text-anchor="'+anchor+'" dominant-baseline="middle" class="bd-plan-opening-label">'+label+'</text>'
}
function buildingDesignPlanOpeningSymbol(door,x1,y1,x2,y2){
  const kind=buildingDesignOpeningKind(door);
  const inward=door.wall==='front'?[-1,0]:door.wall==='back'?[1,0]:door.wall==='left'?[0,1]:[0,-1];
  const nx=inward[0],ny=inward[1];
  if(kind==='window'){
    const innerFace=7,secondLine=10;
    return '<line x1="'+(x1+nx*innerFace)+'" y1="'+(y1+ny*innerFace)+'" x2="'+(x2+nx*innerFace)+'" y2="'+(y2+ny*innerFace)+'" class="bd-plan-window-line"/>'+
      '<line x1="'+(x1+nx*secondLine)+'" y1="'+(y1+ny*secondLine)+'" x2="'+(x2+nx*secondLine)+'" y2="'+(y2+ny*secondLine)+'" class="bd-plan-window-line"/>'+
      '<line x1="'+(x1+nx*secondLine)+'" y1="'+(y1+ny*secondLine)+'" x2="'+(x1+nx*innerFace)+'" y2="'+(y1+ny*innerFace)+'" class="bd-plan-window-cap"/>'+
      '<line x1="'+(x2+nx*secondLine)+'" y1="'+(y2+ny*secondLine)+'" x2="'+(x2+nx*innerFace)+'" y2="'+(y2+ny*innerFace)+'" class="bd-plan-window-cap"/>'
  }
  if(kind==='roller'){
    let slats='';
    [0.25,0.5,0.75].forEach(portion=>{
      const sx=x1+(x2-x1)*portion,sy=y1+(y2-y1)*portion;
      slats+='<line x1="'+(sx-nx*4)+'" y1="'+(sy-ny*4)+'" x2="'+(sx+nx*4)+'" y2="'+(sy+ny*4)+'" class="bd-plan-roller-slat"/>'
    });
    return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" class="bd-plan-roller-line"/>'+slats
  }
  const doorGap='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" class="bd-plan-opening-gap"/>';
  const outwardX=-nx,outwardY=-ny,openingLength=Math.max(8,Math.hypot(x2-x1,y2-y1)),leafLength=Math.min(22,openingLength);
  if(kind==='double'){
    const firstEnd=[x1+outwardX*leafLength/2,y1+outwardY*leafLength/2],secondEnd=[x2+outwardX*leafLength/2,y2+outwardY*leafLength/2],mx=(x1+x2)/2,my=(y1+y2)/2;
    return doorGap+'<line x1="'+x1+'" y1="'+y1+'" x2="'+firstEnd[0]+'" y2="'+firstEnd[1]+'" class="bd-plan-personnel-leaf"/>'+
      '<path d="M '+mx+' '+my+' Q '+x1+' '+y1+' '+firstEnd[0]+' '+firstEnd[1]+'" class="bd-plan-personnel-swing"/>'+
      '<line x1="'+x2+'" y1="'+y2+'" x2="'+secondEnd[0]+'" y2="'+secondEnd[1]+'" class="bd-plan-personnel-leaf"/>'+
      '<path d="M '+mx+' '+my+' Q '+x2+' '+y2+' '+secondEnd[0]+' '+secondEnd[1]+'" class="bd-plan-personnel-swing"/>'
  }
  const leafEnd=[x1+outwardX*leafLength,y1+outwardY*leafLength];
  return doorGap+'<line x1="'+x1+'" y1="'+y1+'" x2="'+leafEnd[0]+'" y2="'+leafEnd[1]+'" class="bd-plan-personnel-leaf"/>'+
    '<path d="M '+x2+' '+y2+' Q '+x1+' '+y1+' '+leafEnd[0]+' '+leafEnd[1]+'" class="bd-plan-personnel-swing"/>'
}
function buildingDesignPlanDoor(door,geometry,x,y,width,height,labelLane=0){
  const selected=door.id===activeBuildingDesign.selectedDoorId,kind=buildingDesignOpeningKind(door);
  const {x1,y1,x2,y2}=buildingDesignPlanOpeningGeometry(door,geometry,x,y,width,height),title=buildingDesignPlanOpeningTitle(door);
  return '<g class="bd-plan-opening is-'+esc(kind)+' '+(selected?'is-selected':'')+'" data-door-id="'+esc(door.id)+'" data-wall="'+esc(door.wall)+'" data-offset="'+esc(Number(door.offset)||0)+'" data-opening-width="'+esc(Number(door.width)||0)+'" role="button" tabindex="0" aria-label="'+esc(title)+'" onclick="buildingDesignSelectDoor(\''+esc(door.id)+'\',true)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();buildingDesignSelectDoor(\''+esc(door.id)+'\',true)}"><title>'+esc(title)+'</title>'+buildingDesignPlanOpeningSymbol(door,x1,y1,x2,y2)+buildingDesignPlanLabel(door,x1,y1,x2,y2,labelLane)+'</g>'
}
function buildingDesignPlanSkylight(skylight,geometry,x,y,width,height){
  const selected=skylight.id===activeBuildingDesign.selectedDoorId,roofWidth=Number(geometry.width)||1,roofLength=Number(geometry.length)||1;
  const sx=x+Number(skylight.offsetY)/roofLength*width,sy=y+Number(skylight.offsetX)/roofWidth*height,sw=Math.max(10,Number(skylight.length)/roofLength*width),sh=Math.max(10,Number(skylight.width)/roofWidth*height);
  const issue=buildingDesignIssues(geometry).some(item=>item.doorId===skylight.id);
  return '<g class="bd-plan-skylight '+(selected?'is-selected ':'')+(issue?'has-issue ':'')+(activeBuildingDesign.locked?'is-locked':'')+'" data-skylight-id="'+esc(skylight.id)+'" role="button" tabindex="0" aria-label="'+esc(buildingDesignDoorName(skylight))+'" onclick="buildingDesignSelectDoor(\''+esc(skylight.id)+'\')" onpointerdown="buildingDesignStartDrag(event,\''+esc(skylight.id)+'\')" onmousedown="buildingDesignStartDrag(event,\''+esc(skylight.id)+'\')"><rect x="'+sx+'" y="'+sy+'" width="'+sw+'" height="'+sh+'" rx="2"/><line x1="'+(sx+sw*.25)+'" y1="'+sy+'" x2="'+(sx+sw*.25)+'" y2="'+(sy+sh)+'"/><line x1="'+(sx+sw*.75)+'" y1="'+sy+'" x2="'+(sx+sw*.75)+'" y2="'+(sy+sh)+'"/><text x="'+(sx+sw/2)+'" y="'+Math.max(y+12,sy-6)+'" text-anchor="middle">'+esc(skylight.ref||'Skylight')+'</text></g>'
}
function buildingDesignPlanSvg(){
  const state=activeBuildingDesign,geometry=state.geometry,x=175,y=64,width=550,height=330;
  const angle=Number(buildingDesignProjectFacts(buildingDesignCurrent().project).buildingFootprint?.angle)||0;
  state.canvas={x,y,width,height,roofWidth:Number(geometry.width)||0,roofLength:Number(geometry.length)||0,planAxesTransposed:true};
  const lengthBay=buildingDesignBayInfo(geometry,'right'),widthBay=buildingDesignBayInfo(geometry,'front');
  let bays='';
  for(let index=1;index<lengthBay.count;index++){
    const xx=x+width*index/lengthBay.count;
    bays+='<line x1="'+xx+'" y1="'+y+'" x2="'+xx+'" y2="'+(y+height)+'" class="bd-plan-bay bd-roof-frame-line" data-frame-index="'+index+'"/>'
  }
  const backColumns=buildingDesignGableColumnPositions(geometry,'back',widthBay),frontColumns=buildingDesignGableColumnPositions(geometry,'front',widthBay);
  backColumns.slice(1,-1).forEach(column=>{const yy=y+height*(1-column.metres/(Number(geometry.width)||1));bays+='<line x1="'+x+'" y1="'+yy+'" x2="'+(x+26)+'" y2="'+yy+'" class="bd-plan-bay bd-gable-grid-line '+(column.adjusted?'is-adjusted':'')+'"/>'});
  frontColumns.slice(1,-1).forEach(column=>{const yy=y+height*column.metres/(Number(geometry.width)||1);bays+='<line x1="'+(x+width-26)+'" y1="'+yy+'" x2="'+(x+width)+'" y2="'+yy+'" class="bd-plan-bay bd-gable-grid-line '+(column.adjusted?'is-adjusted':'')+'"/>'});
  const labelLanes=buildingDesignPlanLabelLanes(geometry.doors,geometry,x,y,width,height);
  const planOpeningOrder={window:0,personnel:1,double:1,roller:2};
  const doors=geometry.doors.slice().sort((first,second)=>(planOpeningOrder[buildingDesignOpeningKind(first)]||0)-(planOpeningOrder[buildingDesignOpeningKind(second)]||0)).map(door=>buildingDesignPlanDoor(door,geometry,x,y,width,height,labelLanes[door.id]||0)).join('');
  const skylights=(geometry.skylights||[]).map(skylight=>buildingDesignPlanSkylight(skylight,geometry,x,y,width,height)).join('');
  const fireDoors=buildingDesignAutoFireDoors().map(door=>buildingDesignPlanFireDoor(door,geometry,x,y,width,height)).join('');
  const solarArrays=(geometry.solarArrays||[]).map(array=>buildingDesignPlanSolarArray(array,geometry,x,y,width,height)).join('');
  const selected=buildingDesignSelectedDoor();
  return '<svg id="buildingDesignSvg" viewBox="0 0 900 480" role="img" aria-label="Building plan" style="width:'+(state.zoom*100)+'%">'+
    buildingDesignSvgGrid()+'<text x="18" y="26" class="bd-canvas-title">PLAN — CONFIRMED SITE ORIENTATION</text>'+
    '<rect x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" class="bd-plan-footprint"/>'+bays+doors+fireDoors+solarArrays+skylights+
    '<text x="450" y="16" text-anchor="middle" class="bd-dimension-label">'+Number(geometry.length).toFixed(1)+' m length</text>'+
    '<text x="145" y="229" text-anchor="middle" transform="rotate(-90 145 229)" class="bd-dimension-label">'+Number(geometry.width).toFixed(1)+' m width</text>'+
    '<g transform="translate(790 62)"><image href="assets/page15b-compass.svg" width="54" height="54"/><text x="27" y="22" text-anchor="middle" class="bd-compass-n">N</text><text x="27" y="43" text-anchor="middle" class="bd-compass-arrow">↑</text></g>'+
    '<g transform="rotate('+angle+' 450 240)"><line x1="450" y1="205" x2="450" y2="275" class="bd-orientation-axis"/><path d="M450 190 l-9 18 h18 z" class="bd-orientation-arrow"/></g>'+
    '<rect x="18" y="444" width="864" height="28" rx="8" class="bd-canvas-status"/>'+
    '<g class="bd-plan-legend" transform="translate(34 450)"><path d="M0 14 L0 2 L12 14" class="bd-plan-legend-personnel"/><text x="18" y="13">PD Personnel door</text><line x1="130" y1="7" x2="148" y2="7" class="bd-plan-legend-window"/><line x1="130" y1="12" x2="148" y2="12" class="bd-plan-legend-window"/><text x="154" y="13">W Casement window</text><line x1="285" y1="9" x2="307" y2="9" class="bd-plan-legend-roller"/><text x="314" y="13">RD Roller door</text></g>'+
    '<text x="530" y="460" class="bd-plan-status-text">'+esc(selected?.type==='solar'?(activeBuildingDesign.solarNote?.id===selected.id&&activeBuildingDesign.solarNote.text||buildingDesignDoorName(selected)+' selected · '+buildingDesignSolarPanelCount(selected)+' panels'):selected&&selected.type!=='skylight'?buildingDesignPlanOpeningTitle(selected):selected?.type==='skylight'?buildingDesignDoorName(selected)+' selected · '+buildingDesignSkylightBayLabel(selected,geometry):'Roof frames '+lengthBay.count+' × '+lengthBay.spacing.toFixed(2)+' m · Rotation '+buildingDesignRound(angle,0)+'°')+'</text>'+
    '</svg>'
}
function buildingDesignRenderDrawing(){
  if(!activeBuildingDesign)return;
  const host=document.querySelector('#buildingDesignCanvas');
  if(host){
    host.innerHTML=activeBuildingDesign.view==='plan'?buildingDesignPlanSvg():buildingDesignElevationSvg();
    host.querySelectorAll('.bd-opening[data-door-id]').forEach(node=>node.addEventListener('keydown',event=>buildingDesignOpeningKey(event,node.dataset.doorId)));
    host.querySelectorAll('.bd-plan-skylight[data-skylight-id]').forEach(node=>node.addEventListener('keydown',event=>buildingDesignOpeningKey(event,node.dataset.skylightId)));
    host.querySelectorAll('.bd-plan-solar[data-solar-id]').forEach(node=>node.addEventListener('keydown',event=>buildingDesignOpeningKey(event,node.dataset.solarId)))
  }
  const zoom=document.querySelector('#buildingDesignZoom');
  if(zoom)zoom.textContent=Math.round(activeBuildingDesign.zoom*100)+'%'
}
function buildingDesignTabsMarkup(){
  return Object.entries(BUILDING_DESIGN_VIEWS).map(([key,view])=>'<button type="button" class="bd-view-tab '+(activeBuildingDesign.view===key?'is-active':'')+'" data-view-key="'+key+'" aria-label="'+esc(view.label)+'" aria-pressed="'+(activeBuildingDesign.view===key)+'" onclick="buildingDesignSetView(\''+key+'\')"><span class="bd-tab-desktop">'+esc(view.label)+'</span><span class="bd-tab-mobile" aria-hidden="true">'+esc(view.short)+'</span></button>').join('')
}
function buildingDesignSiteReferenceMarkup(){
  return '<section class="bd-site-reference" aria-labelledby="buildingDesignSiteReferenceTitle">'+
    '<div class="bd-site-reference-copy"><div class="eyebrow">Confirmed Site Layout</div><h2 id="buildingDesignSiteReferenceTitle">Match openings to the site</h2><p id="buildingDesignSiteReferenceDescription">This is the saved Page 14 satellite view. Select the elevation that faces the required access point.</p><strong id="buildingDesignSiteReferenceCurrent"></strong><div class="bd-site-reference-key" role="group" aria-label="Site elevation orientation">'+
    [['a','A','Gable'],['b','B','Sidewall'],['c','C','Gable'],['d','D','Sidewall']].map(([view,label,type])=>'<button type="button" data-site-elevation="'+view+'" onclick="buildingDesignSetView(\''+view+'\')"><b>'+label+'</b><span>'+type+'</span></button>').join('')+
    '</div></div><div id="buildingDesignSiteMap" class="bd-site-reference-map" role="img" aria-label="Confirmed Site Layout satellite view with Elevations A, B, C and D marked"></div></section>'
}
function buildingDesignMidpoint(first,second){return {lat:(Number(first.lat)+Number(second.lat))/2,lng:(Number(first.lng)+Number(second.lng))/2}}
function buildingDesignRenderSiteReferenceState(){
  if(!activeBuildingDesign)return;
  const view=BUILDING_DESIGN_VIEWS[activeBuildingDesign.view],current=document.querySelector('#buildingDesignSiteReferenceCurrent');
  if(current)current.textContent=view.wall?'Current opening elevation: '+view.label+' — '+view.side:'Plan view — choose A, B, C or D before adding an opening';
  document.querySelectorAll('[data-site-elevation]').forEach(button=>{const active=button.dataset.siteElevation===activeBuildingDesign.view;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});
  activeBuildingDesignSiteMarkers.forEach(({view:markerView,element})=>element.classList.toggle('is-active',markerView===activeBuildingDesign.view))
}
function renderConfirmedSitePlan(host,view,center,corners,boundaries,showElevations=false){
  const longitudeScale=Math.cos(Number(center.lat)*Math.PI/180);
  const zoom=Number(view.zoom)||19,bearing=Number(view.bearing)||0;
  const scale=444000*2**(zoom-19),radians=bearing*Math.PI/180;
  const sin=Math.sin(radians),cos=Math.cos(radians);
  const point=({lat,lng})=>{
    const east=(Number(lng)-Number(center.lng))*longitudeScale*scale;
    const north=(Number(lat)-Number(center.lat))*scale;
    return [buildingDesignRound(160+east*cos-north*sin),buildingDesignRound(108-east*sin-north*cos)]
  };
  const footprint=corners.map(point);
  const boundaryLines=(boundaries||[]).map(line=>line.map(point).join(' '));
  host.setAttribute('aria-label','Confirmed site plan showing the saved building footprint and boundary'+(showElevations?', with elevations A, B, C and D':''));
  host.innerHTML=`<svg width="100%" height="100%" viewBox="0 0 320 215" aria-hidden="true">
    ${boundaryLines.map(line=>`<polyline points="${line}" fill="none" stroke="#a15c00" stroke-width="3"/>`).join('')}
    <polygon points="${footprint.join(' ')}" fill="#b8d6c3" stroke="#087532" stroke-width="3"/>
    ${showElevations?footprint.map(([x,y],index)=>{
      const [nextX,nextY]=footprint[(index+1)%4],cx=(x+nextX)/2,cy=(y+nextY)/2;
      const label='ABCD'[index];
      return `<g data-review-site-elevation="${label}"><circle cx="${cx}" cy="${cy}" r="12" fill="#0c263b" stroke="#fff" stroke-width="2"/><text x="${cx}" y="${cy+4}" fill="#fff" text-anchor="middle" font-size="12" font-weight="bold">${label}</text></g>`;
    }).join(''):''}
    <text x="286" y="32" transform="rotate(${-bearing} 286 32)" text-anchor="middle" fill="#0c263b" font-size="14" font-weight="bold">↑ N</text>
  </svg>`;
}
function buildingDesignInitSiteReference(){
  const current=buildingDesignCurrent(),facts=buildingDesignProjectFacts(current?.project||{}),host=document.querySelector('#buildingDesignSiteMap');
  if(!host)return;
  if(activeBuildingDesignSiteResizeObserver){activeBuildingDesignSiteResizeObserver.disconnect();activeBuildingDesignSiteResizeObserver=null}
  if(activeBuildingDesignSiteMap){try{activeBuildingDesignSiteMap.remove()}catch(e){}activeBuildingDesignSiteMap=null}
  activeBuildingDesignSiteMarkers=[];
  const footprint=facts.buildingFootprint||{},corners=Array.isArray(footprint.corners)?footprint.corners:[],view=facts.siteLayoutMapView||{};
  const center=view.center||footprint.center;
  if(!center||corners.length!==4){
    host.innerHTML='<p class="bd-site-reference-fallback">The saved Site Layout reference is unavailable. Return to Site Layout and reconfirm it.</p>';
    buildingDesignRenderSiteReferenceState();return
  }
  try{
    const map=new maplibregl.Map({container:host,style:mapStyleSpec(),center:[Number(center.lng),Number(center.lat)],zoom:Number(view.zoom)||18,bearing:Number(view.bearing)||0,pitch:0,maxPitch:0,minPitch:0,interactive:false,attributionControl:true});
    activeBuildingDesignSiteMap=map;
    const bounds=corners.reduce((result,point)=>result.extend([Number(point.lng),Number(point.lat)]),new maplibregl.LngLatBounds());
    let siteReferenceFrameRequest=null;
    const resizeSiteReferenceMap=()=>{
      if(siteReferenceFrameRequest!==null)cancelAnimationFrame(siteReferenceFrameRequest);
      siteReferenceFrameRequest=requestAnimationFrame(()=>{
        siteReferenceFrameRequest=null;
        if(activeBuildingDesignSiteMap!==map)return;
        map.resize();
        if(!map.loaded()||view.center)return;
        const padding=Math.max(36,Math.min(52,Math.round(Math.min(host.clientWidth,host.clientHeight)*.18)));
        map.fitBounds(bounds,{padding,maxZoom:19,duration:0,bearing:Number(view.bearing)||0,pitch:0})
      })
    };
    if(typeof ResizeObserver==='function'){
      activeBuildingDesignSiteResizeObserver=new ResizeObserver(resizeSiteReferenceMap);
      activeBuildingDesignSiteResizeObserver.observe(host)
    }
    requestAnimationFrame(()=>requestAnimationFrame(resizeSiteReferenceMap));
    map.on('load',()=>{
      resizeSiteReferenceMap();
      if(view.baseLayer==='street'&&typeof setBaseLayer==='function')setBaseLayer(map,'street');
      const ring=corners.map(point=>[Number(point.lng),Number(point.lat)]);ring.push(ring[0]);
      map.addSource('building-design-site-reference',{type:'geojson',data:{type:'FeatureCollection',features:[
        {type:'Feature',properties:{kind:'building'},geometry:{type:'Polygon',coordinates:[ring]}},
        ...(Array.isArray(facts.relevantBoundaries)?facts.relevantBoundaries.filter(line=>Array.isArray(line)&&line.length>=2).map(line=>({type:'Feature',properties:{kind:'boundary'},geometry:{type:'LineString',coordinates:line.map(point=>[Number(point.lng),Number(point.lat)])}})):[])
      ]}});
      map.addLayer({id:'building-design-site-reference-fill',type:'fill',source:'building-design-site-reference',filter:['==',['get','kind'],'building'],paint:{'fill-color':'#078632','fill-opacity':.25}});
      map.addLayer({id:'building-design-site-reference-outline',type:'line',source:'building-design-site-reference',filter:['==',['get','kind'],'building'],paint:{'line-color':'#078632','line-width':3}});
      map.addLayer({id:'building-design-site-reference-boundaries',type:'line',source:'building-design-site-reference',filter:['==',['get','kind'],'boundary'],paint:{'line-color':'#a15c00','line-width':4}})
    });
    const walls=[['a','A',corners[0],corners[1]],['b','B',corners[1],corners[2]],['c','C',corners[2],corners[3]],['d','D',corners[3],corners[0]]];
    walls.forEach(([markerView,label,first,second])=>{
      const element=document.createElement('button');element.type='button';element.className='bd-site-elevation-marker';element.textContent=label;element.title='Open Elevation '+label;element.setAttribute('aria-label','Open Elevation '+label);element.onclick=()=>buildingDesignSetView(markerView);
      new maplibregl.Marker({element,anchor:'center'}).setLngLat([buildingDesignMidpoint(first,second).lng,buildingDesignMidpoint(first,second).lat]).addTo(map);
      activeBuildingDesignSiteMarkers.push({view:markerView,element})
    });
  }catch(error){
    renderConfirmedSitePlan(host,view,center,corners,facts.relevantBoundaries,true);
    document.querySelector('#buildingDesignSiteReferenceDescription').textContent=`Saved site plan. Bearing ${Number(view.bearing)||0}°, zoom ${Number(view.zoom)||19}. Use A, B, C or D to open an elevation.`
  }
  buildingDesignRenderSiteReferenceState()
}
function buildingDesignSkylightControls(skylight){
  const state=activeBuildingDesign,locked=state.locked,geometry=state.geometry,issue=buildingDesignIssueForDoor(skylight),roofBay=buildingDesignSkylightBay(skylight,geometry),bay=buildingDesignSkylightBayLabel(skylight,geometry);
  return '<section class="bd-selected-card">'+
    '<div class="bd-selected-heading"><div><div class="eyebrow">Selected roof opening</div><h3>'+esc(buildingDesignDoorName(skylight))+'</h3></div><span class="bd-bay-badge">'+esc(bay)+'</span></div>'+
    '<div class="bd-door-fields"><label>Width<input id="buildingDesignSkylightWidth" type="number" min="0.1" step="0.1" value="'+esc(Number(skylight.width).toFixed(2))+'" '+(locked?'disabled':'')+' onchange="buildingDesignUpdateSkylight(\'width\',this.value)"><span>metres</span></label><label>Length<input id="buildingDesignSkylightLength" type="number" min="0.1" step="0.1" value="'+esc(Number(skylight.length).toFixed(2))+'" '+(locked?'disabled':'')+' onchange="buildingDesignUpdateSkylight(\'length\',this.value)"><span>metres</span></label></div>'+
    '<p class="bd-opening-guidance">Skylights are positioned in Plan view only. Drag or nudge the skylight within a roof zone; it cannot cross a structural roof beam.</p>'+
    '<div class="bd-position-label">Selected roof bay</div><div class="bd-bay-navigation"><button type="button" class="btn secondary" '+(locked||roofBay.index===0?'disabled':'')+' onclick="buildingDesignMoveSkylightToBay(-1)">← Previous bay</button><strong>'+esc(bay)+'</strong><button type="button" class="btn secondary" '+(locked||roofBay.index===roofBay.info.count-1?'disabled':'')+' onclick="buildingDesignMoveSkylightToBay(1)">Next bay →</button></div>'+
    '<div class="bd-position-label">Position across roof</div><div class="bd-position-controls"><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSkylight(-.1,0)">← 0.1 m</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignCentreDoor()">Centre</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSkylight(.1,0)">0.1 m →</button></div>'+
    '<div class="bd-position-label">Position along roof</div><div class="bd-window-height-controls"><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSkylight(0,-.1)">↑ 0.1 m</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSkylight(0,.1)">↓ 0.1 m</button></div>'+
    '<div class="bd-selected-footer bd-selected-meta"><span class="bd-free-position">Between roof frames</span></div>'+
    '</section><section id="buildingDesignValidation" class="bd-validation '+(issue?'has-issue':'is-valid')+'" role="status"><strong>'+(issue?'!':'✓')+'</strong><div><b>'+esc(issue?issue.message:'Skylight fits within '+bay)+'</b><span>'+esc(issue?'Adjust the skylight before confirming.':'Clear of the building perimeter and structural roof beams.')+'</span></div></section>'
}
function buildingDesignOpeningControls(){
  const state=activeBuildingDesign,door=buildingDesignSelectedDoor(),locked=state.locked,geometry=state.geometry;
  if(!door)return '<section class="bd-selected-card is-empty"><div class="eyebrow">Selected opening</div><h3>No opening selected</h3><p>Choose an opening in the drawing, or add one to the current elevation.</p></section>';
  if(door.type==='skylight')return buildingDesignSkylightControls(door);
  if(door.type==='solar')return buildingDesignSolarControls(door);
  const issue=buildingDesignIssueForDoor(door),bay=buildingDesignBayLabel(door,geometry);
  const baySide=buildingDesignDoorBaySide(door,geometry);
  const freeGableRoller=buildingDesignIsFreeGableRoller(door);
  const windowOpening=door.type==='window';
  const bayControlled=door.type==='personnel'||windowOpening,openingBay=bayControlled?buildingDesignDoorBay(door,geometry):null;
  const windowVertical=windowOpening?buildingDesignWindowVerticalBounds(door,geometry):null;
  const project=buildingDesignCurrent()?.project;
  const rollerAccess=door.type==='roller'&&project&&projectIsSteelFreeStanding(buildingDesignProjectFacts(project))
    ?`<label class="field">Drawing access type<select id="buildingDesignRollerAccess" ${locked?'disabled':''} onchange="buildingDesignUpdateRollerAccess(this.value)"><option value="">Not recorded</option>${[...new Set([door.access,...ROLLER_ACCESS_OPTIONS].filter(Boolean))].map(access=>`<option value="${esc(access)}" ${door.access===access?'selected':''}>${esc(access)}</option>`).join('')}</select></label>`:'';
  return '<section class="bd-selected-card">'+
    '<div class="bd-selected-heading"><div><div class="eyebrow">Selected opening</div><h3>'+esc(buildingDesignDoorName(door))+'</h3></div><span class="bd-bay-badge">'+esc(bay)+'</span></div>'+
    '<div class="bd-door-fields '+(windowOpening?'has-sill':'')+'"><label>Width<input id="buildingDesignDoorWidth" type="number" min="0.1" '+(freeGableRoller?'max="7" ':'')+'step="0.1" value="'+esc(Number(door.width).toFixed(2))+'" '+(locked?'disabled':'')+' onchange="buildingDesignUpdateDoor(\'width\',this.value)"><span>metres</span></label><label>Height<input id="buildingDesignDoorHeight" type="number" min="0.1" '+(windowOpening?'max="'+esc(buildingDesignRound((Number(geometry.eaveHeight)||0)-Number(door.sillHeight||0),2))+'" ':'')+'step="0.1" value="'+esc(Number(door.height).toFixed(2))+'" '+(locked?'disabled':'')+' onchange="buildingDesignUpdateDoor(\'height\',this.value)"><span>metres</span></label>'+(windowOpening?'<label>Sill height<input id="buildingDesignWindowSill" type="number" min="0" max="'+esc(windowVertical.max)+'" step="0.1" value="'+esc(Number(door.sillHeight||0).toFixed(2))+'" '+(locked?'disabled':'')+' onchange="buildingDesignUpdateDoor(\'sillHeight\',this.value)"><span>metres</span></label>':'')+'</div>'+
    rollerAccess+
    (freeGableRoller?'<p class="bd-opening-guidance">Gable roller doors can be positioned freely and may be up to 7.0 m wide. Indicative columns adjust around the opening.</p>':'')+
    (windowOpening?'<p class="bd-opening-guidance">Casement windows are available on sidewalls B and D only. Drag in any direction to position the window anywhere within '+esc(bay)+', from low level to near the eaves.</p>':'')+
    (bayControlled?'<div class="bd-position-label">Selected bay</div><div class="bd-bay-navigation"><button type="button" class="btn secondary" '+(locked||openingBay.index===0?'disabled':'')+' onclick="buildingDesignMoveOpeningToBay(-1)">← Previous bay</button><strong>'+esc(bay)+'</strong><button type="button" class="btn secondary" '+(locked||openingBay.index===openingBay.info.count-1?'disabled':'')+' onclick="buildingDesignMoveOpeningToBay(1)">Next bay →</button></div>':'')+
    (door.type==='personnel'?'<div class="bd-position-label">Side of '+esc(bay)+'</div><div class="bd-bay-side-controls" role="group" aria-label="'+esc(buildingDesignDoorName(door))+' side within '+esc(bay)+'"><button type="button" class="btn secondary '+(baySide==='left'?'is-active':'')+'" aria-pressed="'+(baySide==='left')+'" '+(locked?'disabled':'')+' onclick="buildingDesignPlacePersonnelDoor(\'left\')">Left side of bay</button><button type="button" class="btn secondary '+(baySide==='right'?'is-active':'')+'" aria-pressed="'+(baySide==='right')+'" '+(locked?'disabled':'')+' onclick="buildingDesignPlacePersonnelDoor(\'right\')">Right side of bay</button></div>':'')+
    (windowOpening?'<div class="bd-position-label">Height on sidewall</div><div class="bd-window-height-controls"><button type="button" class="btn secondary" '+(locked||Number(door.sillHeight)<=windowVertical.min?'disabled':'')+' onclick="buildingDesignNudgeWindowVertical(-.1)">↓ Lower 0.1 m</button><button type="button" class="btn secondary" '+(locked||Number(door.sillHeight)>=windowVertical.max?'disabled':'')+' onclick="buildingDesignNudgeWindowVertical(.1)">↑ Raise 0.1 m</button></div>':'')+
    '<div class="bd-position-label">Position along elevation</div><div class="bd-position-controls"><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudge(-.1)">← 0.1 m</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignCentreDoor()">Centre</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudge(.1)">0.1 m →</button></div>'+
    '<div class="bd-selected-footer bd-selected-meta">'+(freeGableRoller?'<span class="bd-free-position">Free position on gable</span>':windowOpening?'<span class="bd-free-position">Free position within '+esc(bay)+'</span>':'<button type="button" class="bd-snap" aria-pressed="'+state.snap+'" '+(locked?'disabled':'')+' onclick="buildingDesignToggleSnap()">Snap to bay&nbsp; '+(state.snap?'ON':'OFF')+'</button>')+'</div>'+
    '</section><section id="buildingDesignValidation" class="bd-validation '+(issue?'has-issue':'is-valid')+'" role="status"><strong>'+(issue?'!':'✓')+'</strong><div><b>'+esc(issue?issue.message:'Opening fits within '+bay)+'</b><span>'+esc(issue?'Adjust the opening before confirming.':'No geometric overlap or wall-edge issue detected.')+'</span></div></section>'
}
function buildingDesignFindOpeningMarkup(){
  // One compact dropdown listing every opening, skylight and solar array,
  // grouped by elevation and roof. Choosing one jumps to its view and selects it.
  const state=activeBuildingDesign,geometry=state.geometry,selectedId=state.selectedDoorId;
  const kindOrder={roller:0,personnel:1,double:2,window:3};
  const option=item=>'<option value="'+esc(item.id)+'"'+(item.id===selectedId?' selected':'')+'>'+esc((item.ref?item.ref+' · ':'')+buildingDesignDoorName(item))+'</option>';
  const groups=['a','b','c','d'].map(key=>{
    const wall=BUILDING_DESIGN_VIEWS[key].wall;
    const items=geometry.doors.filter(door=>door.wall===wall).sort((first,second)=>(kindOrder[buildingDesignOpeningKind(first)]??9)-(kindOrder[buildingDesignOpeningKind(second)]??9)||(Number(first.offset)||0)-(Number(second.offset)||0));
    return items.length?'<optgroup label="'+esc(BUILDING_DESIGN_VIEWS[key].label)+'">'+items.map(option).join('')+'</optgroup>':''
  }).join('');
  const roofItems=[...(geometry.skylights||[]),...(geometry.solarArrays||[])];
  const roof=roofItems.length?'<optgroup label="Roof (Plan)">'+roofItems.map(option).join('')+'</optgroup>':'';
  const total=geometry.doors.length+roofItems.length;
  return '<div class="bd-find-opening"><label class="bd-add-label" for="buildingDesignFindOpening">Find an opening</label><select id="buildingDesignFindOpening" class="bd-find-select" '+(total?'':'disabled')+'><option value="">'+(total?'Choose from '+total+' item'+(total===1?'':'s')+'…':'No openings yet')+'</option>'+groups+roof+'</select></div>'
}
function buildingDesignRenderControls(){
  const state=activeBuildingDesign,view=BUILDING_DESIGN_VIEWS[state.view],host=document.querySelector('#buildingDesignControls');
  if(!host)return;
  const project=buildingDesignCurrent().project,facts=buildingDesignProjectFacts(project);
  const openingNavigation=buildingDesignFindOpeningMarkup();
  const bearing=view.wall?buildingDesignWallBearing(view.wall):buildingDesignBearing(Number(facts.buildingFootprint?.angle)||0);
  const windowUnavailable=Boolean(view.wall&&!['right','left'].includes(view.wall)),planView=!view.wall,selectedOpening=buildingDesignSelectedDoor(),deleteOpeningDisabled=state.locked||!selectedOpening||selectedOpening.type==='skylight'||selectedOpening.type==='solar',deleteSkylightDisabled=state.locked||!selectedOpening||selectedOpening.type!=='skylight',deleteSolarDisabled=state.locked||!selectedOpening||selectedOpening.type!=='solar';
  const wallGrid=view.wall?buildingDesignBayInfo(state.geometry,view.wall):null,lengthGrid=buildingDesignBayInfo(state.geometry,'right'),gableGrid=buildingDesignBayInfo(state.geometry,'front'),windLoad=buildingDesignWindLoad(project);
  const gridSummary=buildingDesignIsSteelProject(project)
    ?(planView
      ?'Indicative steel grid · '+lengthGrid.count+' roof-frame bays at '+lengthGrid.spacing.toFixed(2)+' m · '+gableGrid.count+' gable bays at '+gableGrid.spacing.toFixed(2)+' m'
      :'Indicative steel grid · '+wallGrid.count+' equal bays at '+wallGrid.spacing.toFixed(2)+' m')+(Number.isFinite(windLoad)?' · Wind '+windLoad.toFixed(2)+' kN/m²':' · Wind load not yet recorded')
    :'Separate non-steel framing rules apply to this construction.';
  host.innerHTML='<div class="eyebrow">Building controls</div><div class="bd-controls-title"><div><h2>'+esc(view.label)+'</h2><p>'+esc(view.side)+(view.wall?' · '+buildingDesignBayInfo(state.geometry,view.wall).count+' bays':'')+'</p></div>'+(state.locked?'<span class="bd-locked-badge">Confirmed</span>':'')+'</div>'+
    '<p class="bd-grid-summary">'+esc(gridSummary)+'</p>'+
    (planView
      ?'<div class="bd-add-label">Add a roof opening</div><div class="bd-add-buttons is-plan"><button type="button" class="btn green" '+(state.locked?'disabled':'')+' onclick="buildingDesignAddSkylight()">＋ Skylight</button><button type="button" class="bd-delete bd-delete-placement" '+(deleteSkylightDisabled?'disabled':'')+' onclick="buildingDesignDeleteDoor()">Delete skylight</button></div><p class="bd-opening-guidance">Skylights are available in Plan view only and sit between the indicative structural roof frames.</p>'+
        '<div class="bd-add-label">Add solar panels</div><div class="bd-add-buttons is-plan"><button type="button" class="btn green" '+(state.locked?'disabled':'')+' onclick="buildingDesignAddSolarArray()">＋ Solar panels</button><button type="button" class="btn secondary bd-fill-solar" '+(state.locked?'disabled':'')+' onclick="buildingDesignFillRoofSolar()">Fill roof with solar</button><button type="button" class="bd-delete bd-delete-placement" '+(deleteSolarDisabled?'disabled':'')+' onclick="buildingDesignDeleteDoor()">Delete solar array</button></div><p class="bd-opening-guidance">Each click fills the next free roof bay with a solar array, between the roof frames and clear of the skylight rows. Drag an array to snap it to another free bay, or use Fill roof with solar to fill every free bay.</p>'
      :'<div class="bd-add-label">Add an opening</div><div class="bd-add-buttons"><button type="button" class="btn green" '+(state.locked?'disabled':'')+' onclick="buildingDesignAddDoor(\'roller\')">＋ Roller door</button><button type="button" class="btn secondary" '+(state.locked?'disabled':'')+' onclick="buildingDesignAddDoor(\'personnel\')">＋ Personnel door</button><button type="button" class="btn secondary" '+(state.locked?'disabled':'')+' onclick="buildingDesignAddDoor(\'double\')">＋ Double door</button><button type="button" class="btn secondary" '+(state.locked||windowUnavailable?'disabled':'')+' '+(windowUnavailable?'title="Casement windows are available on sidewalls B and D only"':'')+' onclick="buildingDesignAddDoor(\'window\')">＋ Casement window</button>'+buildingDesignFireExitOptionMarkup(state)+'<button type="button" class="bd-delete bd-delete-placement" '+(deleteOpeningDisabled?'disabled':'')+' onclick="buildingDesignDeleteDoor()">Delete opening</button>'+buildingDesignFireExitInfoMarkup(state)+'</div>')+
    openingNavigation+
    '<section class="bd-selected-orientation"><strong>'+esc(view.label)+'</strong><span>'+esc(view.side)+(view.wall?' · Facing '+esc(bearing.label)+' '+bearing.degrees+'°':'')+'</span></section>'+
    buildingDesignOpeningControls()+
    (state.locked?'<button type="button" class="btn secondary bd-edit-confirmed" onclick="editConfirmedBuildingDesign()">Edit confirmed design</button>':'');
  // Confirmed design: left/right choice for each fire exit beside a roller door.
  const fireSides=buildingDesignFireExitSideControls(state,project);
  if(fireSides)host.insertAdjacentHTML('afterbegin',fireSides);
  const finder=host.querySelector('#buildingDesignFindOpening');
  if(finder)finder.onchange=()=>{
    if(!finder.value)return;
    buildingDesignSelectDoor(finder.value,true);
    document.querySelector('.bd-selected-card')?.scrollIntoView({block:'nearest'});
  };
  buildingDesignRenderRollerComparison(project,state.geometry);
}
const BD_ROLLER_REQUIREMENT_GAP='Some saved roller-door requirements are missing a clear size or access type.';
const BD_ROLLER_GEOMETRY_COPY='Some requirement values were previously copied from geometry. Confirm them with the customer.';
const BD_ROLLER_COUNT_DIFF='The roller-door count differs between the requirements and the drawing.';
const BD_ROLLER_DRAWING_GAP='Some drawing roller doors are missing a clear size or access type.';
const BD_ROLLER_MISMATCH='The roller-door clear sizes or access types differ between the requirements and the drawing.';
function buildingDesignRollerBoxData(project,drawing){
  const {requested,count,drawn,needsReview}=stage1RollerOpeningComparison(project,drawing);
  const drawnList=drawn||[];
  const comparable=door=>Number(door.width)>0&&Number(door.height)>0&&stage1HasValue(door.access);
  const key=door=>JSON.stringify([Number(door.width),Number(door.height),String(door.access).trim().toLowerCase()]);
  const has=note=>needsReview.includes(note);
  const pairs=Array.from({length:Math.max(requested.length,drawnList.length)},(_,index)=>{
    const requirement=requested[index]||null,drawingDoor=drawnList[index]||null,notes=[];
    const requirementName=requirement?(requirement.ref||'Door '+(index+1)):'',drawingName=drawingDoor?(drawingDoor.ref||'Drawing door '+(index+1)):'';
    if(requirement&&has(BD_ROLLER_REQUIREMENT_GAP)&&!comparable(requirement))notes.push('This requirement is missing a clear size or access type.');
    if(requirement&&(requirement.widthSource==='geometry'||requirement.heightSource==='geometry'))notes.push('These requirement values were previously copied from geometry. Confirm them with the customer.');
    if(drawingDoor&&!comparable(drawingDoor))notes.push('This drawing roller door is missing a clear size or access type.');
    if(requirement&&drawingDoor&&has(BD_ROLLER_MISMATCH)&&comparable(requirement)&&comparable(drawingDoor)&&key(requirement)!==key(drawingDoor))notes.push('The clear size or access type differs between this requirement and the drawing.');
    if(has(BD_ROLLER_COUNT_DIFF)&&requirement&&!drawingDoor)notes.push('This requirement is not shown on the drawing.');
    if(has(BD_ROLLER_COUNT_DIFF)&&drawingDoor&&!requirement)notes.push('This drawing door has no matching customer requirement.');
    const label=requirement&&drawingDoor?requirementName+' / '+drawingName:requirement?requirementName+' (not drawn)':drawingName+' (no requirement)';
    return {index,requirement,drawingDoor,requirementName,drawingName,label,notes};
  });
  const perDoor=[BD_ROLLER_REQUIREMENT_GAP,BD_ROLLER_GEOMETRY_COPY,BD_ROLLER_DRAWING_GAP,BD_ROLLER_MISMATCH];
  const globalNotes=needsReview.filter(note=>!perDoor.includes(note));
  return {requested,count,drawn,needsReview,pairs,globalNotes,toCheck:pairs.filter(pair=>pair.notes.length).length};
}
function buildingDesignRollerDoorFacts(door,emptyText){
  if(!door)return '<p class="bd-roller-empty">'+esc(emptyText)+'</p>';
  return '<dl><div><dt>Width</dt><dd>'+esc(Number(door.width)>0?door.width+' m':'Not recorded')+'</dd></div><div><dt>Height</dt><dd>'+esc(Number(door.height)>0?door.height+' m':'Not recorded')+'</dd></div><div><dt>Access</dt><dd>'+esc(door.access||'Not recorded')+'</dd></div></dl>';
}
function buildingDesignRollerDoorDetail(data,index,drawingLabel){
  const pair=data.pairs[index];
  if(!pair)return '';
  return '<div class="bd-roller-pair"><section><h4>Customer requirement'+(pair.requirementName?' · '+esc(pair.requirementName):'')+'</h4>'+buildingDesignRollerDoorFacts(pair.requirement,'No customer requirement for this door.')+'</section>'+
    '<section><h4>'+esc(drawingLabel)+(pair.drawingName?' · '+esc(pair.drawingName):'')+'</h4>'+buildingDesignRollerDoorFacts(pair.drawingDoor,'Not shown on the drawing.')+'</section></div>'+
    (pair.notes.length?'<div class="bd-roller-notes"><strong>Needs checking</strong><ul>'+pair.notes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul></div>':'<p class="bd-roller-ok">Nothing to check for this door.</p>');
}
function buildingDesignRollerBoxMarkup(project,drawing,drawingLabel,open,selectedIndex){
  if(!projectIsSteelFreeStanding(projectFacts(project)))return '';
  const data=buildingDesignRollerBoxData(project,drawing);
  const index=data.pairs[selectedIndex]?selectedIndex:0;
  const flagged=data.toCheck>0||data.globalNotes.length>0;
  const summary=['Roller doors',data.count==='Not recorded'?'required not recorded':data.count+' required',data.drawn?data.drawn.length+' drawn':'drawing not recorded'];
  if(data.toCheck)summary.push(data.toCheck+' to check');
  else if(data.globalNotes.length)summary.push('needs checking');
  return '<section class="bd-roller-section" aria-label="Roller doors"><details class="bd-roller-box'+(flagged?' has-checks':'')+'"'+(open?' open':'')+'><summary><span class="bd-roller-summary-text">'+esc(summary.join(' · '))+'</span>'+(flagged?'<span class="bd-roller-badge" aria-hidden="true">!</span>':'')+'</summary><div class="bd-roller-body">'+
    (data.globalNotes.length?'<div class="bd-roller-notes is-global"><strong>Needs checking · all roller doors</strong><ul>'+data.globalNotes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul></div>':'')+
    (data.pairs.length
      ?'<label class="bd-add-label" for="buildingDesignRollerPick">Choose a roller door</label><select id="buildingDesignRollerPick" class="bd-find-select">'+data.pairs.map(pair=>'<option value="'+pair.index+'"'+(pair.index===index?' selected':'')+'>'+esc(pair.label+(pair.notes.length?' · needs checking':''))+'</option>').join('')+'</select><div id="buildingDesignRollerDetail" class="bd-roller-detail">'+buildingDesignRollerDoorDetail(data,index,drawingLabel)+'</div>'
      :'<p class="bd-roller-empty">No roller doors are recorded in the requirements or the drawing.</p>')+
    '</div></details></section>';
}
function buildingDesignRenderRollerComparison(project,drawing){
  const host=document.querySelector('#buildingDesignRollerComparison');
  if(!host||!project)return;
  const previous=host.querySelector('.bd-roller-box'),pick=host.querySelector('#buildingDesignRollerPick');
  const open=previous?previous.open:false,selected=pick?Number(pick.value)||0:0,hadFocus=pick&&document.activeElement===pick;
  host.innerHTML=buildingDesignRollerBoxMarkup(project,drawing,'Drawing',open,selected);
  const select=host.querySelector('#buildingDesignRollerPick');
  if(!select)return;
  select.onchange=()=>{
    const detail=host.querySelector('#buildingDesignRollerDetail');
    if(detail)detail.innerHTML=buildingDesignRollerDoorDetail(buildingDesignRollerBoxData(project,activeBuildingDesign?.geometry||drawing),Number(select.value)||0,'Drawing');
  };
  if(hadFocus)select.focus();
}
// Client option: use personnel doors as fire exits (stored at p.facts.personnelDoorsAsFireExits).
const BUILDING_DESIGN_FIRE_EXIT_LABEL='Fire exits can also be used as personnel doors';
function buildingDesignFireExitOptionMarkup(state){
  const p=state&&getP(state.projectId);
  if(!p||typeof pcFireExitIsIndustrial!=='function'||!pcFireExitIsIndustrial(p))return '';
  const on=typeof pcFireExitPersonnelOption==='function'&&pcFireExitPersonnelOption(p);
  const open=buildingDesignFireInfoOpen;
  return '<div class="bd-fire-option" id="buildingDesignFireExitOption"><div class="bd-fire-option-row"><label><input type="checkbox" id="buildingDesignPdFireExits" '+(on?'checked ':'')+(state.locked?'disabled ':'')+'onchange="buildingDesignSetPdFireExits(this.checked)"><span class="bd-fire-option-text">'+esc(BUILDING_DESIGN_FIRE_EXIT_LABEL)+'</span></label><button type="button" class="bd-fire-info" id="buildingDesignFireExitInfoButton" aria-expanded="'+open+'" aria-controls="buildingDesignFireExitInfo" aria-label="About fire exits and personnel doors" title="About fire exits and personnel doors" onclick="buildingDesignToggleFireInfo()">&#9432;</button></div></div>'
}
// 2026-11-19 (Stuart): the ⓘ explanation sits beside the Delete opening button.
function buildingDesignFireExitInfoMarkup(state){
  const p=state&&getP(state.projectId);
  if(!p||typeof pcFireExitIsIndustrial!=='function'||!pcFireExitIsIndustrial(p))return '';
  return '<p class="bd-fire-info-text" id="buildingDesignFireExitInfo"'+(buildingDesignFireInfoOpen?'':' hidden')+'>'+esc(PC_FIRE_EXIT_PD_NOTE)+'</p>'
}
// The ⓘ explanation stays open or closed across re-renders of the panel.
let buildingDesignFireInfoOpen=false;
function buildingDesignToggleFireInfo(){
  buildingDesignFireInfoOpen=!buildingDesignFireInfoOpen;
  const button=document.getElementById('buildingDesignFireExitInfoButton'),info=document.getElementById('buildingDesignFireExitInfo');
  if(button)button.setAttribute('aria-expanded',String(buildingDesignFireInfoOpen));
  if(info)info.hidden=!buildingDesignFireInfoOpen;
}
// Confirmed design: each indicative fire exit beside a roller door can sit on the
// left or right of that roller door (viewed from outside) — nowhere else. The
// choice is stored at p.buildingDesign.fireExitRollerSides and placement re-runs.
function buildingDesignFireExitSideControls(state,p){
  if(!state.locked||state.editingConfirmed)return '';
  const doors=buildingDesignAutoFireDoors().filter(door=>door.rollerAdjacent&&door.forRollerId);
  if(!doors.length)return '';
  return '<div class="bd-fire-side-controls" id="buildingDesignFireExitSides"><strong>Fire exit beside each roller door</strong>'+doors.map(door=>{
    const label=esc(door.ref)+' beside '+esc(door.forRoller||'roller door');
    const button=(side,text)=>'<button type="button" class="btn secondary'+(door.rollerSide===side?' is-active':'')+'" aria-pressed="'+(door.rollerSide===side)+'" data-fire-side="'+side+'" data-roller-id="'+esc(door.forRollerId)+'" onclick="buildingDesignSetFireExitSide(\''+esc(door.forRollerId)+'\',\''+side+'\')">'+text+'</button>';
    return '<div class="bd-fire-side-row" data-fire-exit="'+esc(door.ref)+'"><span>'+label+(door.sideFallback?' <em>(no room on the '+esc(door.rollerSidePreferred)+')</em>':'')+'</span><div class="bd-bay-side-controls">'+button('left','Left of roller')+button('right','Right of roller')+'</div></div>'
  }).join('')+'</div>'
}
function buildingDesignSetFireExitSide(rollerId,side){
  const state=activeBuildingDesign;
  if(!state||!state.locked||state.editingConfirmed||(side!=='left'&&side!=='right'))return;
  const p=getP(state.projectId);
  if(!p||!p.buildingDesign||typeof pcFireExitRefresh!=='function')return;
  p.buildingDesign.fireExitRollerSides={...(p.buildingDesign.fireExitRollerSides||{}),[rollerId]:side};
  const checks=pcFireExitRefresh(p);
  save();
  const door=((checks&&checks.fireExits&&checks.fireExits.doors)||[]).find(item=>item.forRollerId===rollerId);
  state.announcement=door?(door.sideFallback?door.ref+' stays on the '+door.rollerSide+' of '+door.forRoller+' — there is no clear room on the '+side+'.':door.ref+' moved to the '+side+' of '+door.forRoller+'.'):'';
  buildingDesignRenderInteractive()
}
window.buildingDesignSetFireExitSide=buildingDesignSetFireExitSide;
function buildingDesignSetPdFireExits(on){
  const state=activeBuildingDesign;
  if(!state||state.locked)return;
  const p=getP(state.projectId);
  if(!p)return;
  p.facts=p.facts||{};
  p.facts.personnelDoorsAsFireExits=Boolean(on);
  if(typeof pcFireExitClear==='function')pcFireExitClear(p);
  // Ticking the option deletes the customer's single personnel doors (double
  // doors stay): removed from the drawing as one Undo step, and from the saved
  // p.geometry. Unticking does not bring them back (use Undo).
  const isSingle=door=>door&&door.type==='personnel'&&door.subtype!=='double';
  const removed=on?state.geometry.doors.filter(isSingle):[];
  if(removed.length){
    buildingDesignMutate(geometry=>{geometry.doors=geometry.doors.filter(door=>!isSingle(door))},removed.length+' personnel door'+(removed.length===1?'':'s')+' deleted — fire exits are used as personnel doors. Use Undo to restore.');
    if(removed.some(door=>door.id===state.selectedDoorId))buildingDesignSelectFirstDoor();
    if(p.geometry&&Array.isArray(p.geometry.doors))p.geometry.doors=p.geometry.doors.filter(door=>!isSingle(door));
  }
  save();
  buildingDesignRenderInteractive()
}
window.buildingDesignSetPdFireExits=buildingDesignSetPdFireExits;
function buildingDesignRenderActions(){
  const state=activeBuildingDesign,door=buildingDesignSelectedDoor(),view=BUILDING_DESIGN_VIEWS[state.view],issues=buildingDesignIssues(state.geometry),host=document.querySelector('#buildingDesignActions');
  if(!host)return;
  const editingConfirmed=Boolean(state.editingConfirmed);
  const status=state.locked?'Confirmed design':editingConfirmed?(state.dirty?'● Unsaved confirmed-design changes':'Editing confirmed design'):state.dirty?'● Unsaved changes':state.savedStatus==='draft'?'Draft saved':'Ready to edit';
  const actions=state.locked
    ?'<button type="button" class="btn secondary bd-back" onclick="route(\'siteLayout\',\''+esc(state.projectId)+'\')">Back to Site Layout</button><button type="button" class="btn secondary" disabled>Design confirmed</button><button type="button" class="btn green" onclick="editConfirmedBuildingDesign()">Edit Building Design</button>'
    :editingConfirmed
      ?'<button type="button" class="btn secondary bd-back" onclick="route(\'siteLayout\',\''+esc(state.projectId)+'\')">Back to Site Layout</button><button type="button" class="btn secondary" onclick="cancelConfirmedBuildingDesignEdit()">Cancel editing</button><button type="button" class="btn green" onclick="confirmBuildingDesign()">Confirm Updated Building Design</button>'
      :'<button type="button" class="btn secondary bd-back" onclick="route(\'siteLayout\',\''+esc(state.projectId)+'\')">Back to Site Layout</button><button type="button" class="btn secondary" '+(!state.dirty?'disabled':'')+' onclick="saveBuildingDesignDraft()">Save draft</button><button type="button" class="btn green" onclick="confirmBuildingDesign()">Confirm Building Design</button>';
  // 2026-11-19 (Stuart): the fire-exit toggle now sits in the Add an opening
  // panel, so the bar holds only the current view and the action buttons.
  // Phones keep the slim one-row bar with the free report at the end of the page.
  const phone=buildingDesignIsPhone(),fireHost=document.querySelector('#buildingDesignPhoneFire'),reportHost=phone?document.querySelector('#buildingDesignPhoneReport'):null;
  if(fireHost)fireHost.innerHTML='';
  if(phone&&reportHost){
    host.innerHTML='<div class="bd-action-buttons">'+actions+'</div>';
    reportHost.innerHTML=buildingDesignFreeReportMarkup(state);
    return;
  }
  if(reportHost)reportHost.innerHTML='';
  host.innerHTML='<div class="bd-current-view"><span>Current view</span><strong>'+esc(view.label+(door?' · '+buildingDesignDoorName(door)+' selected':''))+'</strong><em class="'+(state.dirty?'is-dirty':'')+'">'+esc(status)+(issues.length?' · '+issues.length+' issue'+(issues.length===1?'':'s'):'')+'</em></div>'+
    '<div class="bd-action-buttons">'+actions+'</div>'+buildingDesignFreeReportMarkup(state);
}
const BUILDING_DESIGN_PHONE_QUERY=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(max-width: 800px)'):null;
function buildingDesignIsPhone(){return Boolean(BUILDING_DESIGN_PHONE_QUERY&&BUILDING_DESIGN_PHONE_QUERY.matches)}
if(BUILDING_DESIGN_PHONE_QUERY){
  const onPhoneChange=()=>{if(activeBuildingDesign&&document.querySelector('#buildingDesignActions'))buildingDesignRenderActions()};
  if(BUILDING_DESIGN_PHONE_QUERY.addEventListener)BUILDING_DESIGN_PHONE_QUERY.addEventListener('change',onPhoneChange);else if(BUILDING_DESIGN_PHONE_QUERY.addListener)BUILDING_DESIGN_PHONE_QUERY.addListener(onPhoneChange);
}
// Bring an existing fire-exit toggle up to date (checked, greyed when the design
// is confirmed, ⓘ state) without rebuilding it. Returns false if it can't.
function buildingDesignSyncFireExitOption(el,state){
  const p=state&&getP(state.projectId),box=el.querySelector('#buildingDesignPdFireExits'),label=el.querySelector('label span'),info=el.querySelector('#buildingDesignFireExitInfoButton'),text=el.querySelector('#buildingDesignFireExitInfo');
  if(!p||!box||!label||!info||!text)return false;
  const on=typeof pcFireExitPersonnelOption==='function'&&pcFireExitPersonnelOption(p);
  if(box.checked!==on)box.checked=on;
  if(box.disabled!==Boolean(state.locked))box.disabled=Boolean(state.locked);
  if(label.textContent!==BUILDING_DESIGN_FIRE_EXIT_LABEL)label.textContent=BUILDING_DESIGN_FIRE_EXIT_LABEL;
  info.setAttribute('aria-expanded',String(buildingDesignFireInfoOpen));
  text.hidden=!buildingDesignFireInfoOpen;
  return true;
}
// "Open Stage 1 Free Report" (moved from the Stage 1 Project Summary): enabled
// only when Site Layout and Building Design are both confirmed — Building Design
// counts as not confirmed while unlocked for editing.
function buildingDesignFreeReportReady(state){
  const p=state&&getP(state.projectId);
  if(!p)return false;
  const siteLayoutConfirmed=buildingDesignProjectFacts(p).siteLayoutStatus==='confirmed';
  const designConfirmed=Boolean(state.locked&&!state.editingConfirmed&&p.buildingDesign&&p.buildingDesign.status==='confirmed'&&!p.buildingDesign.editing);
  return siteLayoutConfirmed&&designConfirmed
}
function buildingDesignFreeReportMarkup(state){
  const ready=buildingDesignFreeReportReady(state);
  return '<div class="bd-free-report" id="buildingDesignFreeReport"><button type="button" id="buildingDesignFreeReportButton" class="btn secondary" '+(ready?'':'disabled aria-describedby="buildingDesignFreeReportNote" ')+'onclick="buildingDesignOpenFreeReport()">Open Stage 1 Free Report</button>'+
    (ready?'':'<p id="buildingDesignFreeReportNote" class="meta">Complete Site Layout and Building Design to open the free report.</p>')+'</div>'
}
function buildingDesignOpenFreeReport(){
  const state=activeBuildingDesign;
  if(!buildingDesignFreeReportReady(state))return;
  confirmSteelStage1Summary(state.projectId,'stage1Summary')
}
window.buildingDesignOpenFreeReport=buildingDesignOpenFreeReport;
function buildingDesignFocusToken(){
  const focused=document.activeElement;
  if(!focused||focused===document.body)return null;
  if(focused.dataset?.doorId)return {kind:'door',value:focused.dataset.doorId};
  if(focused.dataset?.skylightId)return {kind:'skylight',value:focused.dataset.skylightId};
  if(focused.dataset?.solarId)return {kind:'solar',value:focused.dataset.solarId};
  if(focused.dataset?.viewKey)return {kind:'view',value:focused.dataset.viewKey};
  if(focused.id)return {kind:'id',value:focused.id};
  return null
}
function buildingDesignRestoreFocus(token){
  if(!token)return;
  const value=typeof CSS!=='undefined'&&CSS.escape?CSS.escape(token.value):String(token.value).replace(/[^a-zA-Z0-9_-]/g,'');
  const selectors={door:'[data-door-id="'+value+'"]',skylight:'[data-skylight-id="'+value+'"]',solar:'[data-solar-id="'+value+'"]',view:'[data-view-key="'+value+'"]',id:'#'+value};
  document.querySelector(selectors[token.kind])?.focus({preventScroll:true})
}
function buildingDesignRenderInteractive(){
  if(!activeBuildingDesign)return;
  const focusToken=buildingDesignFocusToken();
  buildingDesignEnsureSelection();
  const tabs=document.querySelector('#buildingDesignTabs');
  if(tabs)tabs.innerHTML=buildingDesignTabsMarkup()+'<strong>'+esc(BUILDING_DESIGN_VIEWS[activeBuildingDesign.view].side.toUpperCase())+'</strong>';
  buildingDesignRenderDrawing();
  buildingDesignRenderControls();
  buildingDesignRenderActions();
  const undo=document.querySelector('#buildingDesignUndo'),redo=document.querySelector('#buildingDesignRedo');
  const reset=document.querySelector('#buildingDesignResetButton');
  if(undo)undo.disabled=activeBuildingDesign.locked||!activeBuildingDesign.history.length;
  if(redo)redo.disabled=activeBuildingDesign.locked||!activeBuildingDesign.future.length;
  if(reset)reset.disabled=activeBuildingDesign.locked;
  const live=document.querySelector('#buildingDesignLive');
  if(live&&activeBuildingDesign.announcement){live.textContent=activeBuildingDesign.announcement;activeBuildingDesign.announcement=''}
  buildingDesignRenderSiteReferenceState();
  buildingDesignRestoreFocus(focusToken)
}

// ---- Solar panel arrays on the Plan view (2026-11-14) -----------------------
// Added and positioned like skylights; stored at geometry.solarArrays as
// [{id,ref,type:'solar',columns,rows,length,width,offsetX,offsetY,source}].
// offsetX/width run across the roof width; offsetY/length run along the roof
// length (same axes as skylights). Panels are laid portrait: 1.1 m along the
// building, 2.3 m up the slope. Indicative planning figures only.
// Assumptions: panel 2.2-2.4 m x 1.1 m = 2.42-2.64 m2; roof area 5-6 m2 per kWp.
const BUILDING_DESIGN_SOLAR_PANEL_AREA=[2.2*1.1,2.4*1.1];
const BUILDING_DESIGN_SOLAR_AREA_PER_KWP=[5,6];
const BUILDING_DESIGN_SOLAR_PANEL_ALONG=1.1;
const BUILDING_DESIGN_SOLAR_PANEL_ACROSS=2.3;
const BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE=.4;
const BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE=60;
function buildingDesignSolarCount(value,fallback){
  const number=Math.floor(Number(value));
  return Number.isFinite(number)&&number>=1?Math.min(number,BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE):fallback
}
function buildingDesignSolarApplySize(array){
  array.columns=buildingDesignSolarCount(array.columns,4);
  array.rows=buildingDesignSolarCount(array.rows,2);
  array.length=buildingDesignRound(array.columns*BUILDING_DESIGN_SOLAR_PANEL_ALONG,2);
  array.width=buildingDesignRound(array.rows*BUILDING_DESIGN_SOLAR_PANEL_ACROSS,2);
  return array
}
function buildingDesignSanitizeSolarArrays(geometry){
  if(!geometry)return geometry;
  const seen=new Set();
  geometry.solarArrays=(Array.isArray(geometry.solarArrays)?geometry.solarArrays:[]).filter(array=>array&&typeof array==='object'&&!Array.isArray(array)).map((array,index)=>{
    const safe=buildingDesignSolarApplySize({...array,type:'solar'});
    if(typeof safe.id!=='string'||!/^pv[0-9]{1,18}$/.test(safe.id)||seen.has(safe.id))safe.id='pv'+Date.now()+index;
    seen.add(safe.id);
    safe.offsetX=Number.isFinite(Number(safe.offsetX))?Number(safe.offsetX):0;
    safe.offsetY=Number.isFinite(Number(safe.offsetY))?Number(safe.offsetY):0;
    return safe
  });
  return geometry
}
function buildingDesignSolarPanelCount(array){return buildingDesignSolarCount(array?.columns,0)*buildingDesignSolarCount(array?.rows,0)}
function buildingDesignSolarKwp(panels){
  const [pLo,pHi]=BUILDING_DESIGN_SOLAR_PANEL_AREA,[kLo,kHi]=BUILDING_DESIGN_SOLAR_AREA_PER_KWP;
  return [panels*pLo/kHi,panels*pHi/kLo]
}
function buildingDesignSolarRange(range,places,unit){
  const a=buildingDesignRound(range[0],places),b=buildingDesignRound(range[1],places);
  return (a===b?String(a):a.toFixed(places)+'–'+b.toFixed(places))+(unit?' '+unit:'')
}
function buildingDesignSolarBounds(array,geometry){
  const clearance=BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE,width=Number(array?.width)||0,length=Number(array?.length)||0;
  return {
    minX:clearance,maxX:Math.max(clearance,(Number(geometry.width)||0)-width-clearance),
    minY:clearance,maxY:Math.max(clearance,(Number(geometry.length)||0)-length-clearance),
    fits:width<=(Number(geometry.width)||0)-clearance*2+.001&&length<=(Number(geometry.length)||0)-clearance*2+.001
  }
}
function buildingDesignSolarClampPosition(candidate,geometry){
  const bounds=buildingDesignSolarBounds(candidate,geometry);
  return {...candidate,offsetX:buildingDesignRound(buildingDesignClamp(Number(candidate.offsetX)||0,bounds.minX,bounds.maxX),2),offsetY:buildingDesignRound(buildingDesignClamp(Number(candidate.offsetY)||0,bounds.minY,bounds.maxY),2)}
}
function buildingDesignSolarPlacementClear(candidate,geometry){
  return (geometry.solarArrays||[]).filter(array=>array.id!==candidate.id).every(array=>!buildingDesignSkylightsOverlap(candidate,array))&&(geometry.skylights||[]).every(skylight=>!buildingDesignSkylightsOverlap(candidate,skylight))
}
function buildingDesignSolarIssues(geometry,issues){
  (geometry.solarArrays||[]).forEach((array,index,list)=>{
    const bounds=buildingDesignSolarBounds(array,geometry);
    if(!bounds.fits)issues.push({doorId:array.id,message:buildingDesignDoorName(array)+' is larger than the roof. Reduce the number of panels.'});
    else if(Number(array.offsetX)<bounds.minX-.001||Number(array.offsetX)>bounds.maxX+.001||Number(array.offsetY)<bounds.minY-.001||Number(array.offsetY)>bounds.maxY+.001)issues.push({doorId:array.id,message:buildingDesignDoorName(array)+' must stay on the roof, '+BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE+' m clear of the edges.'});
    (geometry.skylights||[]).forEach(skylight=>{
      if(buildingDesignSkylightsOverlap(array,skylight)){
        issues.push({doorId:array.id,message:buildingDesignDoorName(array)+' overlaps '+buildingDesignDoorName(skylight)+'.'});
        issues.push({doorId:skylight.id,message:buildingDesignDoorName(skylight)+' overlaps '+buildingDesignDoorName(array)+'.'})
      }
    });
    list.slice(index+1).forEach(other=>{
      if(buildingDesignSkylightsOverlap(array,other)){
        issues.push({doorId:array.id,message:buildingDesignDoorName(array)+' overlaps '+buildingDesignDoorName(other)+'.'});
        issues.push({doorId:other.id,message:buildingDesignDoorName(other)+' overlaps '+buildingDesignDoorName(array)+'.'})
      }
    })
  });
  return issues
}
function buildingDesignFindSolarPlacement(array,geometry){
  const bounds=buildingDesignSolarBounds(array,geometry);
  if(!bounds.fits)return null;
  const step=.5;
  for(let offsetX=bounds.minX;offsetX<=bounds.maxX+.001;offsetX+=step){
    for(let offsetY=bounds.minY;offsetY<=bounds.maxY+.001;offsetY+=step){
      const candidate=buildingDesignSolarClampPosition({...array,offsetX,offsetY},geometry);
      if(buildingDesignSolarPlacementClear(candidate,geometry))return candidate
    }
  }
  const last=buildingDesignSolarClampPosition({...array,offsetX:bounds.maxX,offsetY:bounds.maxY},geometry);
  return buildingDesignSolarPlacementClear(last,geometry)?last:null
}
// Roof-bay slots (2026-11-14): arrays sit inside one roof bay between the
// dashed roof-frame lines, in rows that run between the skylight rows (the
// skylight rows sit at 25% and 75% of the roof width) and either side of the
// ridge. Slots are listed in reading order: along the roof bays, then next row.
const BUILDING_DESIGN_SOLAR_BAY_MARGIN=.2;
const BUILDING_DESIGN_SOLAR_SKYLIGHT_LANE=.8;
const BUILDING_DESIGN_SOLAR_RIDGE_GAP=.15;
function buildingDesignSolarRowBands(geometry){
  const roofWidth=Number(geometry?.width)||0,edge=BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE,lane=BUILDING_DESIGN_SOLAR_SKYLIGHT_LANE,ridge=BUILDING_DESIGN_SOLAR_RIDGE_GAP;
  const usable=bands=>bands.filter(([start,end])=>end-start>=BUILDING_DESIGN_SOLAR_PANEL_ACROSS-.001);
  const between=usable([[edge,roofWidth*.25-lane],[roofWidth*.25+lane,roofWidth/2-ridge],[roofWidth/2+ridge,roofWidth*.75-lane],[roofWidth*.75+lane,roofWidth-edge]]);
  return between.length===4?between:usable([[edge,roofWidth/2-ridge],[roofWidth/2+ridge,roofWidth-edge]])
}
function buildingDesignSolarSlots(geometry){
  if(!geometry)return [];
  const grid=buildingDesignBayInfo(geometry,'right');
  if(!(grid.spacing>0))return [];
  const columns=Math.min(BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE,Math.floor((grid.spacing-BUILDING_DESIGN_SOLAR_BAY_MARGIN*2+.001)/BUILDING_DESIGN_SOLAR_PANEL_ALONG));
  if(columns<1)return [];
  const slots=[];
  buildingDesignSolarRowBands(geometry).forEach(([start,end],row)=>{
    const rows=Math.min(BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE,Math.floor((end-start+.001)/BUILDING_DESIGN_SOLAR_PANEL_ACROSS));
    if(rows<1)return;
    const sized=buildingDesignSolarApplySize({columns,rows});
    const offsetX=buildingDesignRound(start+(end-start-sized.width)/2,2);
    for(let bay=0;bay<grid.count;bay++)slots.push({row,bay,columns,rows,width:sized.width,length:sized.length,offsetX,offsetY:buildingDesignRound(buildingDesignClamp(bay*grid.spacing+(grid.spacing-sized.length)/2,BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE,Math.max(BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE,(Number(geometry.length)||0)-sized.length-BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE)),2)})
  });
  return slots
}
function buildingDesignSolarSlotCandidate(slot,array,geometry){
  // Centre an array (keeping its own size) on a slot, clamped to the roof.
  const centreX=slot.offsetX+slot.width/2,centreY=slot.offsetY+slot.length/2;
  return buildingDesignSolarClampPosition({...array,offsetX:centreX-Number(array.width)/2,offsetY:centreY-Number(array.length)/2},geometry)
}
function buildingDesignSolarSlotDraft(slot,id,ref){
  return buildingDesignSolarApplySize({id,ref,type:'solar',columns:slot.columns,rows:slot.rows,offsetX:slot.offsetX,offsetY:slot.offsetY,source:'customer'})
}
function buildingDesignSolarFreeSlots(geometry){
  return buildingDesignSolarSlots(geometry).filter(slot=>{
    const draft=buildingDesignSolarSlotDraft(slot,'__slot__','');
    return buildingDesignSolarBounds(draft,geometry).fits&&buildingDesignSolarPlacementClear(draft,geometry)
  })
}
function buildingDesignSolarNewId(existing,serial){
  let id='pv'+Date.now()+serial;
  while(existing.some(array=>array.id===id))id='pv'+Date.now()+(++serial);
  return id
}
function buildingDesignSnapSolarToSlot(array,acrossCentre,alongCentre,geometry){
  let best=null,bestDistance=Infinity;
  buildingDesignSolarSlots(geometry).forEach(slot=>{
    const distance=Math.hypot(slot.offsetX+slot.width/2-acrossCentre,slot.offsetY+slot.length/2-alongCentre);
    if(distance>=bestDistance)return;
    const candidate=buildingDesignSolarSlotCandidate(slot,array,geometry);
    if(!buildingDesignSolarPlacementClear(candidate,geometry))return;
    best=candidate;bestDistance=distance
  });
  return best
}
function buildingDesignSolarDropCandidate(array,across,along,geometry){
  // Bay along the roof from the pointer; across, the nearest clear spot on that roof side
  // near the pointer. Full depth first, then 1 panel deep beside skylights.
  const grid=buildingDesignBayInfo(geometry,'right'),roofWidth=Number(geometry.width)||0,roofLength=Number(geometry.length)||0,edge=BUILDING_DESIGN_SOLAR_EDGE_CLEARANCE,ridge=BUILDING_DESIGN_SOLAR_RIDGE_GAP;
  const bay=grid.spacing>0?buildingDesignClamp(Math.floor(along/grid.spacing),0,grid.count-1):0,full=buildingDesignSolarCount(array.fullRows||array.rows,2);
  const [sideMin,sideMax]=across<roofWidth/2?[edge,roofWidth/2-ridge]:[roofWidth/2+ridge,roofWidth-edge];
  for(const rows of full>1?[full,1]:[1]){
    const sized=buildingDesignSolarApplySize({...array,rows}),w=sized.width;
    const offsetY=buildingDesignRound(buildingDesignClamp(bay*grid.spacing+(grid.spacing-sized.length)/2,edge,Math.max(edge,roofLength-sized.length-edge)),2);
    const lo=Math.max(sideMin,across-w*1.5),hi=Math.min(sideMax-w,across+w*.5),ideal=buildingDesignClamp(across-w/2,lo,hi);
    for(let step=0;lo<=hi+.001&&step<=Math.ceil((hi-lo)*10)+1;step++)for(const offsetX of step?[ideal-step/10,ideal+step/10]:[ideal]){
      const candidate={...sized,offsetX:buildingDesignRound(offsetX,2),offsetY};
      if(offsetX>=lo-.001&&offsetX<=hi+.001&&buildingDesignSolarPlacementClear(candidate,geometry))return {candidate,reduced:rows<full,full,bay:'RF'+(bay+1)}
    }
  }
  return {candidate:null,bay:'RF'+(bay+1)}
}
function buildingDesignFillRoofSolar(){
  if(!activeBuildingDesign||activeBuildingDesign.locked||activeBuildingDesign.view!=='plan')return;
  const free=buildingDesignSolarFreeSlots(activeBuildingDesign.geometry);
  if(!free.length){
    activeBuildingDesign.announcement='Every free roof bay already has a solar array.';
    alert('Every free roof bay already has a solar array or a skylight.');
    buildingDesignRenderInteractive();return
  }
  let added=0,lastId=null;
  buildingDesignMutate(geometry=>{
    geometry.solarArrays=geometry.solarArrays||[];
    buildingDesignSolarSlots(geometry).forEach(slot=>{
      const draft=buildingDesignSolarSlotDraft(slot,buildingDesignSolarNewId(geometry.solarArrays,geometry.solarArrays.length),buildingDesignNextRef('solar'));
      if(!buildingDesignSolarBounds(draft,geometry).fits||!buildingDesignSolarPlacementClear(draft,geometry))return;
      geometry.solarArrays.push(draft);added++;lastId=draft.id
    })
  },null);
  activeBuildingDesign.announcement=added+' solar arrays added to fill the roof.';
  if(lastId)activeBuildingDesign.selectedDoorId=lastId;
  buildingDesignRenderInteractive()
}
function buildingDesignSolarNextPlacement(id,ref,geometry){
  // Next bays along the last placed/moved array's line (fitting beside skylights),
  // then free bays further across the roof, then the first free bay anywhere.
  const arrays=geometry.solarArrays||[],free=buildingDesignSolarFreeSlots(geometry),grid=buildingDesignBayInfo(geometry,'right');
  const anchor=arrays.find(array=>array.id===activeBuildingDesign.solarAnchorId)||arrays[arrays.length-1];
  if(anchor&&grid.spacing>0){
    const across=Number(anchor.offsetX)+Number(anchor.width)/2,bay=Math.floor((Number(anchor.offsetY)+Number(anchor.length)/2)/grid.spacing);
    const draft=buildingDesignSolarApplySize({id,ref,type:'solar',columns:anchor.columns,rows:anchor.fullRows||anchor.rows,source:'customer'});
    for(let next=bay+1;next<grid.count;next++){
      const drop=buildingDesignSolarDropCandidate(draft,across,(next+.5)*grid.spacing,geometry);
      if(drop.candidate)return drop.reduced?{...drop.candidate,fullRows:drop.full}:drop.candidate
    }
    const below=free.find(slot=>slot.offsetX>=Number(anchor.offsetX)+Number(anchor.width)-.001);
    if(below)return buildingDesignSolarSlotDraft(below,id,ref)
  }
  return free[0]?buildingDesignSolarSlotDraft(free[0],id,ref):null
}
function buildingDesignAddSolarArray(){
  if(!activeBuildingDesign||activeBuildingDesign.locked||activeBuildingDesign.view!=='plan')return;
  const existing=activeBuildingDesign.geometry.solarArrays||[];
  const id=buildingDesignSolarNewId(existing,existing.length),ref=buildingDesignNextRef('solar');
  // Continue from the last placed/moved array; fall back to any clear roof space.
  const placement=buildingDesignSolarNextPlacement(id,ref,activeBuildingDesign.geometry)||buildingDesignFindSolarPlacement(buildingDesignSolarApplySize({id,ref,type:'solar',columns:4,rows:2,offsetX:0,offsetY:0,source:'customer'}),activeBuildingDesign.geometry);
  if(!placement){
    activeBuildingDesign.announcement='No clear roof space is available for another solar array.';
    alert('No clear roof space is available for another solar array. Move or reduce an existing array or skylight.');
    buildingDesignRenderInteractive();return
  }
  buildingDesignMutate(geometry=>{geometry.solarArrays=geometry.solarArrays||[];geometry.solarArrays.push(placement)},buildingDesignDoorName(placement)+' added to the roof ('+buildingDesignSolarPanelCount(placement)+' panels).');
  activeBuildingDesign.selectedDoorId=id;activeBuildingDesign.solarAnchorId=id;
  buildingDesignRenderInteractive()
}
function buildingDesignUpdateSolarArray(field,value){
  const array=buildingDesignSelectedDoor();
  if(!array||array.type!=='solar'||activeBuildingDesign.locked||!['columns','rows'].includes(field))return;
  const number=Math.floor(Number(value));
  if(!Number.isFinite(number)||number<1||number>BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE){alert('Enter a whole number of panels between 1 and '+BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE+'.');buildingDesignRenderInteractive();return}
  const geometry=activeBuildingDesign.geometry,sized=buildingDesignSolarApplySize(buildingDesignMarkOpeningCustomer({...array,[field]:number,...(field==='rows'?{fullRows:undefined}:{})}));
  if(!buildingDesignSolarBounds(sized,geometry).fits){alert('That many panels will not fit on the roof.');buildingDesignRenderInteractive();return}
  const candidate=buildingDesignSolarClampPosition(sized,geometry);
  if(!buildingDesignSolarPlacementClear(candidate,geometry)){alert('Move the solar array clear of other solar arrays and skylights before applying this change.');buildingDesignRenderInteractive();return}
  buildingDesignMutate(next=>Object.assign(next.solarArrays.find(item=>item.id===array.id),candidate),buildingDesignDoorName(array)+' updated to '+buildingDesignSolarPanelCount(candidate)+' panels.')
}
function buildingDesignNudgeSolarArray(deltaX,deltaY){
  const array=buildingDesignSelectedDoor();
  if(!array||array.type!=='solar'||activeBuildingDesign.locked)return;
  const geometry=activeBuildingDesign.geometry;
  const candidate=buildingDesignSolarClampPosition({...array,offsetX:Number(array.offsetX)+Number(deltaX),offsetY:Number(array.offsetY)+Number(deltaY)},geometry);
  if(candidate.offsetX===array.offsetX&&candidate.offsetY===array.offsetY)return;
  if(!buildingDesignSolarPlacementClear(candidate,geometry))return;
  buildingDesignRecord();Object.assign(array,buildingDesignMarkOpeningCustomer(candidate));buildingDesignMarkDirty();
  activeBuildingDesign.solarAnchorId=array.id;
  activeBuildingDesign.announcement=buildingDesignDoorName(array)+' moved.';
  buildingDesignRenderInteractive()
}
function buildingDesignCentreSolarArray(array){
  const geometry=activeBuildingDesign.geometry;
  const candidate=buildingDesignSolarClampPosition({...array,offsetX:((Number(geometry.width)||0)-Number(array.width))/2,offsetY:((Number(geometry.length)||0)-Number(array.length))/2},geometry);
  if(!buildingDesignSolarPlacementClear(candidate,geometry))return;
  buildingDesignRecord();Object.assign(array,buildingDesignMarkOpeningCustomer(candidate));buildingDesignMarkDirty();
  activeBuildingDesign.solarAnchorId=array.id;
  activeBuildingDesign.announcement=buildingDesignDoorName(array)+' centred on the roof.';
  buildingDesignRenderInteractive()
}
function buildingDesignPlanSolarArray(array,geometry,x,y,width,height){
  const selected=array.id===activeBuildingDesign.selectedDoorId,roofWidth=Number(geometry.width)||1,roofLength=Number(geometry.length)||1;
  const sx=x+Number(array.offsetY)/roofLength*width,sy=y+Number(array.offsetX)/roofWidth*height,sw=Math.max(10,Number(array.length)/roofLength*width),sh=Math.max(10,Number(array.width)/roofWidth*height);
  const columns=buildingDesignSolarCount(array.columns,1),rows=buildingDesignSolarCount(array.rows,1);
  const issue=buildingDesignIssues(geometry).some(item=>item.doorId===array.id);
  let grid='';
  for(let index=1;index<columns;index++)grid+='<line x1="'+(sx+sw*index/columns)+'" y1="'+sy+'" x2="'+(sx+sw*index/columns)+'" y2="'+(sy+sh)+'"/>';
  for(let index=1;index<rows;index++)grid+='<line x1="'+sx+'" y1="'+(sy+sh*index/rows)+'" x2="'+(sx+sw)+'" y2="'+(sy+sh*index/rows)+'"/>';
  const label=esc(array.ref||'PV');
  return '<g class="bd-plan-solar '+(selected?'is-selected ':'')+(issue?'has-issue ':'')+(activeBuildingDesign.locked?'is-locked':'')+'" data-solar-id="'+esc(array.id)+'" role="button" tabindex="0" aria-label="'+esc(buildingDesignDoorName(array)+' · '+buildingDesignSolarPanelCount(array)+' panels')+'" onclick="buildingDesignSelectDoor(\''+esc(array.id)+'\')" onpointerdown="buildingDesignStartDrag(event,\''+esc(array.id)+'\')" onmousedown="buildingDesignStartDrag(event,\''+esc(array.id)+'\')"><title>'+esc(buildingDesignDoorName(array)+' · '+buildingDesignSolarPanelCount(array)+' panels')+'</title><rect x="'+sx+'" y="'+sy+'" width="'+sw+'" height="'+sh+'" rx="1"/>'+grid+'<text x="'+(sx+sw/2)+'" y="'+(sy+sh/2+4)+'" text-anchor="middle">'+label+'</text></g>'
}
function buildingDesignSolarControls(array){
  const state=activeBuildingDesign,locked=state.locked,geometry=state.geometry,issue=buildingDesignIssueForDoor(array);
  const panels=buildingDesignSolarPanelCount(array),kwp=buildingDesignSolarKwp(panels),area=[panels*BUILDING_DESIGN_SOLAR_PANEL_AREA[0],panels*BUILDING_DESIGN_SOLAR_PANEL_AREA[1]];
  const allPanels=(geometry.solarArrays||[]).reduce((total,item)=>total+buildingDesignSolarPanelCount(item),0),allKwp=buildingDesignSolarKwp(allPanels);
  return '<section class="bd-selected-card">'+
    '<div class="bd-selected-heading"><div><div class="eyebrow">Selected solar array</div><h3>'+esc(buildingDesignDoorName(array))+'</h3></div><span class="bd-bay-badge">'+esc(array.ref||'PV')+'</span></div>'+
    '<div class="bd-door-fields"><label>Panels along roof<input id="buildingDesignSolarColumns" type="number" min="1" max="'+BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE+'" step="1" value="'+esc(buildingDesignSolarCount(array.columns,1))+'" '+(locked?'disabled':'')+' onchange="buildingDesignUpdateSolarArray(\'columns\',this.value)"><span>columns</span></label><label>Panels up slope<input id="buildingDesignSolarRows" type="number" min="1" max="'+BUILDING_DESIGN_SOLAR_MAX_PANELS_PER_SIDE+'" step="1" value="'+esc(buildingDesignSolarCount(array.rows,1))+'" '+(locked?'disabled':'')+' onchange="buildingDesignUpdateSolarArray(\'rows\',this.value)"><span>rows</span></label></div>'+
    '<dl class="bd-solar-summary" id="buildingDesignSolarSummary"><div><dt>Panels</dt><dd>'+panels+'</dd></div><div><dt>Indicative capacity</dt><dd>'+esc(buildingDesignSolarRange(kwp,1,'kWp'))+'</dd></div><div><dt>Panel area</dt><dd>'+esc(buildingDesignSolarRange(area,0,'m²'))+'</dd></div><div><dt>Array size</dt><dd>'+esc(Number(array.length).toFixed(1)+' × '+Number(array.width).toFixed(1)+' m')+'</dd></div></dl>'+
    ((geometry.solarArrays||[]).length>1?'<p class="bd-opening-guidance">All solar arrays: '+allPanels+' panels · '+esc(buildingDesignSolarRange(allKwp,1,'kWp'))+'.</p>':'')+
    '<p class="bd-opening-guidance">Drag the array on the plan to snap it to another free roof bay, or fine-tune it below. It stays on the roof and clear of skylights.</p>'+
    '<div class="bd-position-label">Position across roof</div><div class="bd-position-controls"><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSolarArray(-.1,0)">← 0.1 m</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignCentreDoor()">Centre</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSolarArray(.1,0)">0.1 m →</button></div>'+
    '<div class="bd-position-label">Position along roof</div><div class="bd-window-height-controls"><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSolarArray(0,-.1)">↑ 0.1 m</button><button type="button" class="btn secondary" '+(locked?'disabled':'')+' onclick="buildingDesignNudgeSolarArray(0,.1)">↓ 0.1 m</button></div>'+
    '<p class="bd-solar-assumptions">Assumes panels of 2.2–2.4 m × 1.1 m (2.42–2.64 m²) and 5–6 m² of roof per kWp. Indicative only.</p>'+
    '</section><section id="buildingDesignValidation" class="bd-validation '+(issue?'has-issue':'is-valid')+'" role="status"><strong>'+(issue?'!':'✓')+'</strong><div><b>'+esc(issue?issue.message:'Solar array fits on the roof')+'</b><span>'+esc(issue?'Adjust the solar array before confirming.':'Clear of the roof edges and skylights.')+'</span></div></section>'
}
function buildingLayout(id){
  if(activeBuildingDesignSiteMap){try{activeBuildingDesignSiteMap.remove()}catch(e){}activeBuildingDesignSiteMap=null;activeBuildingDesignSiteMarkers=[]}
  if(!requireUser())return;
  const p=getP(id);
  if(!p)return route('dashboard');
  document.body.dataset.page='buildingLayout';
  const facts=buildingDesignProjectFacts(p),footprint=facts.buildingFootprint;
  const currentWidth=Number(facts.width),currentLength=Number(facts.length);
  const footprintMatches=Boolean(footprint)&&Number.isFinite(currentWidth)&&Number.isFinite(currentLength)&&Math.abs(Number(footprint.width)-currentWidth)<.001&&Math.abs(Number(footprint.length)-currentLength)<.001;
  const hasConfirmedSite=facts.siteLayoutStatus==='confirmed'&&facts.buildingPositionStatus==='confirmed'&&Boolean(footprint?.center)&&footprintMatches;
  if(!hasConfirmedSite){
    app.innerHTML='<main class="container stage1-workspace building-design-gate">'+projectJourneyNav(p,'buildingLayout','siteLayout')+'<section class="stage1-tech-card"><div class="eyebrow">Stage 1 · Building Design</div><h1>Confirm Site Layout first</h1><p>Building Design uses the confirmed footprint orientation and saved project dimensions. Complete Site Layout before positioning doors and reviewing elevations.</p><button type="button" class="btn green" onclick="route(\'siteLayout\',\''+esc(p.id)+'\')">Open Site Layout</button></section></main>';
    return
  }
  const source=buildingDesignSourceGeometry(p),geometry=source.geometry;
  if(!(Number(geometry.width)>0&&Number(geometry.length)>0&&Number(geometry.eaveHeight)>0)){
    app.innerHTML='<main class="container stage1-workspace building-design-gate">'+projectJourneyNav(p,'buildingLayout','stage1Workspace')+'<section class="stage1-tech-card"><div class="eyebrow">Stage 1 · Building Design</div><h1>Building dimensions required</h1><p>Add the building length, width and clear height in Project Overview before opening Building Design.</p><button type="button" class="btn green" onclick="route(\'stage1Workspace\',\''+esc(p.id)+'\')">Back to Project Overview</button></section></main>';
    return
  }
  const saved=p.buildingDesign||{},fingerprint=buildingDesignFingerprint(p,geometry),sourceMatches=!saved.sourceFingerprint||saved.sourceFingerprint===fingerprint;
  const selected=saved.selectedDoorId&&(geometry.doors.some(door=>door.id===saved.selectedDoorId)||(geometry.skylights||[]).some(skylight=>skylight.id===saved.selectedDoorId)||(geometry.solarArrays||[]).some(array=>array.id===saved.selectedDoorId))?saved.selectedDoorId:null;
  const defaultView=BUILDING_DESIGN_VIEWS[saved.lastView]?saved.lastView:((geometry.skylights||[])[0]||(geometry.solarArrays||[])[0]?'plan':geometry.doors[0]?buildingDesignViewForWall(geometry.doors[0].wall):'b');
  const roofPitch=typeof projectRoofPitch==='function'?Number(projectRoofPitch(p)):(Number(facts.roofPitch)||Number(facts.pitch)||0);
  activeBuildingDesign={
    projectId:id,geometry,initialGeometry:buildingDesignClone(geometry),
    baseline:{geometry:buildingDesignClone(geometry),selectedDoorId:selected,view:defaultView,snap:true,zoom:1,skylightAnchorId:selected&&geometry.skylights.some(skylight=>skylight.id===selected)?selected:null},
    selectedDoorId:selected,view:defaultView,
    snap:true,zoom:1,history:[],future:[],dirty:false,
    skylightAnchorId:selected&&geometry.skylights.some(skylight=>skylight.id===selected)?selected:(geometry.skylights[geometry.skylights.length-1]?.id||null),
    locked:saved.status==='confirmed'&&sourceMatches&&!source.dimensionsChanged&&!saved.editing,
    editingConfirmed:Boolean(saved.editing&&saved.status==='confirmed'&&sourceMatches&&!source.dimensionsChanged),editOrigin:null,
    savedStatus:saved.status||null,
    announcement:source.dimensionsChanged?'Project dimensions or roof pitch changed. Review and save the refreshed design.':''
  };
  // Resumed edit of a confirmed design (Edit clicked before a reload): Cancel restores the confirmed version.
  if(activeBuildingDesign.editingConfirmed)activeBuildingDesign.editOrigin=buildingDesignClone(activeBuildingDesign.baseline);
  buildingDesignSelectFirstDoor();
  activeBuildingDesign.baseline.selectedDoorId=activeBuildingDesign.selectedDoorId;
  app.innerHTML='<main class="building-design-page">'+projectJourneyNav(p,'buildingLayout','siteLayout')+
    '<header class="bd-page-header"><div><div class="bd-breadcrumb">'+esc(p.name)+' / Stage 1 / Building Design</div><h1>Design your building</h1><p>Position doors on the correct elevation, check the dimensions, then confirm the preliminary design.</p></div><dl class="bd-project-facts"><div><dt>'+esc(p.name)+'</dt><dd>'+esc(buildingDesignAddress(p))+'</dd><span>'+Number(geometry.length).toFixed(1)+' m × '+Number(geometry.width).toFixed(1)+' m · Clear height '+Number(geometry.eaveHeight).toFixed(1)+' m'+(roofPitch?' · Roof pitch '+buildingDesignRound(roofPitch,1)+'°':'')+' · Indicative ridge '+Number(geometry.ridgeHeight).toFixed(2)+' m</span></div></dl></header>'+
    (source.dimensionsChanged?'<div class="bd-source-warning">Project dimensions or roof pitch changed after the last saved geometry. This design has been refreshed from the current project facts and must be reviewed again.</div>':'')+
    stage1SteelEnvelopeMarkup(p)+buildingDesignSiteReferenceMarkup()+'<div class="building-design-grid"><section class="bd-workspace" aria-label="Building drawing workspace"><div id="buildingDesignTabs" class="bd-view-tabs" role="toolbar" aria-label="Drawing views"></div><div class="bd-canvas-shell"><div id="buildingDesignCanvas" class="bd-canvas"></div></div><div class="bd-workspace-footer"><p>Drag an opening along the elevation or enter exact dimensions in the control panel.</p><div><button id="buildingDesignUndo" type="button" class="btn secondary" onclick="buildingDesignUndo()">Undo</button><button id="buildingDesignRedo" type="button" class="btn secondary" onclick="buildingDesignRedo()">Redo</button><button type="button" class="btn secondary" onclick="buildingDesignFitView()">Fit view</button><span class="bd-zoom-controls"><button type="button" aria-label="Zoom out" onclick="buildingDesignZoom(-.1)">−</button><b id="buildingDesignZoom">100%</b><button type="button" aria-label="Zoom in" onclick="buildingDesignZoom(.1)">＋</button></span><button id="buildingDesignResetButton" type="button" class="btn secondary" '+(activeBuildingDesign.locked?'disabled':'')+' onclick="buildingDesignReset()">Reset</button></div></div></section><aside id="buildingDesignControls" class="bd-controls" aria-label="Building controls"></aside></div><div id="buildingDesignPhoneFire" class="bd-phone-only"></div>'+
    (projectIsSteelFreeStanding(facts)?'<div id="buildingDesignRollerComparison"></div>':'')+
    '<p class="bd-disclaimer">Preliminary geometry only. This page does not verify structural design, fire safety, planning, Building Regulations or surveyed setting-out.</p><div id="buildingDesignPhoneReport" class="bd-phone-only"></div>'+
    '<section id="buildingDesignActions" class="bd-persistent-actions" aria-label="Building design actions"></section><div id="buildingDesignLive" class="sr-only" aria-live="polite"></div></main>';
  buildingDesignRenderInteractive();
  buildingDesignInitSiteReference()
}

window.buildingLayout=buildingLayout;
window.buildingDesignSetView=buildingDesignSetView;
window.buildingDesignSelectDoor=buildingDesignSelectDoor;
window.buildingDesignAddDoor=buildingDesignAddDoor;
window.buildingDesignAddSkylight=buildingDesignAddSkylight;
window.buildingDesignAddSolarArray=buildingDesignAddSolarArray;
window.buildingDesignFillRoofSolar=buildingDesignFillRoofSolar;
window.buildingDesignUpdateSolarArray=buildingDesignUpdateSolarArray;
window.buildingDesignNudgeSolarArray=buildingDesignNudgeSolarArray;
window.buildingDesignDeleteDoor=buildingDesignDeleteDoor;
window.buildingDesignUpdateDoor=buildingDesignUpdateDoor;
window.buildingDesignUpdateSkylight=buildingDesignUpdateSkylight;
window.buildingDesignPlacePersonnelDoor=buildingDesignPlacePersonnelDoor;
window.buildingDesignMoveOpeningToBay=buildingDesignMoveOpeningToBay;
window.buildingDesignNudgeWindowVertical=buildingDesignNudgeWindowVertical;
window.buildingDesignNudgeSkylight=buildingDesignNudgeSkylight;
window.buildingDesignMoveSkylightToBay=buildingDesignMoveSkylightToBay;
window.buildingDesignPlanOpeningGeometry=buildingDesignPlanOpeningGeometry;
window.buildingDesignNudge=buildingDesignNudge;
window.buildingDesignCentreDoor=buildingDesignCentreDoor;
window.buildingDesignToggleSnap=buildingDesignToggleSnap;
window.buildingDesignUndo=buildingDesignUndo;
window.buildingDesignRedo=buildingDesignRedo;
window.buildingDesignReset=buildingDesignReset;
window.buildingDesignZoom=buildingDesignZoom;
window.buildingDesignFitView=buildingDesignFitView;
window.buildingDesignOpeningKey=buildingDesignOpeningKey;
window.buildingDesignStartDrag=buildingDesignStartDrag;
window.saveBuildingDesignDraft=saveBuildingDesignDraft;
window.confirmBuildingDesign=confirmBuildingDesign;
window.editConfirmedBuildingDesign=editConfirmedBuildingDesign;
window.cancelConfirmedBuildingDesignEdit=cancelConfirmedBuildingDesignEdit;



