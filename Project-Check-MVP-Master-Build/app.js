
const KEY='projectcheck_master_v1';
const stage1ReviewRequested=new URLSearchParams(location.search).get('menu-preview')==='1';
const STAGE1_REVIEW_KEY='projectcheck_stage1_review_v1';
// PLACEHOLDER: Stuart to supply Teams/diary booking link (a full https:// address). This is the ONLY place to change it.
// While it is empty, every call button shows "Booking link coming soon" instead of opening a broken link.
const BOOK_CALL_URL='';
const BOOK_CALL_LABEL='Free 10-minute Teams call with Stuart';
function callButton(cls){return `<button type="button" class="${cls||'btn green simple-cta'}" onclick="bookCall(this)">${BOOK_CALL_LABEL}</button>`}
function bookCall(button){
if(/^https:\/\//i.test(BOOK_CALL_URL)){window.open(BOOK_CALL_URL,'_blank','noopener');return}
const row=button&&button.closest?button.closest('.simple-cta-row')||button.parentElement:null;
if(!row||(row.nextElementSibling&&row.nextElementSibling.classList.contains('simple-note')))return;
row.insertAdjacentHTML('afterend','<p class="simple-note" role="status">Booking link coming soon. Please check back shortly.</p>')
}
window.bookCall=bookCall;
// The seven questions a first-time client asks, in the order it usually happens. One list, used by the landing page and the Stage 1 report so they never drift apart.
const CLIENT_QUESTION_TITLES=['Will I need planning permission?','Do I need a structural engineer?','What about the base, roads, drainage, ground and services?','Will Building Regulations affect my building?','Do the CDM safety rules apply to me, and who runs the site?','What will I deal with on site, on the day?','Who pays the consultants?'];
// iPhone HEIC/HEIF photos cannot be read yet. Every client upload path in this file calls splitUnreadablePhotos() before uploading.
const HEIC_MESSAGE="iPhone HEIC photos can't be read yet. Please change your camera to 'Most Compatible' or send a JPEG or PDF.";
function isHeicFile(file){return /\.(heic|heif)$/i.test((file&&file.name)||'')||/^image\/hei[cf]/i.test((file&&file.type)||'')}
// Returns only the files that can be uploaded and tells the client plainly about any HEIC/HEIF files, which are never uploaded.
function splitUnreadablePhotos(fileList){
const all=[...(fileList||[])],ok=all.filter(file=>!isHeicFile(file));
if(ok.length!==all.length)alert(HEIC_MESSAGE);
return ok
}
// stage3ImpactRegister (Batch 5, 2026-08-26): a GLOBAL (not per-project),
// INTERNAL-only governance list — see createStage3ImpactRegisterEntry()/
// addStage3ImpactRegisterEntry() in evidence.js. Started empty at Batch 5;
// the Planning Batch 2 Impact Register correction (2026-08-26) seeds
// exactly four authorised entries on load (see
// seedPlanningBatch2ImpactRegisterEntries(), called just after loadState()
// below) — nothing else populates it.
const defaultState={user:null,users:[],projects:[],stage3ImpactRegister:[]};
// Malformed/corrupted localStorage (manual tampering, a partial write, a future
// schema change) must never crash the whole app on load with an uncaught
// JSON.parse throw — fail safe to a fresh empty state instead of a blank page.

// Shallow-copies obj without any own "__proto__"/"constructor"/"prototype"
// key. JSON.parse gives a tampered value like {"__proto__":{...}} an
// ordinary *own* property literally named "__proto__" — it doesn't rewrite
// the object's real prototype by itself — but spreading that property
// forward into runtime state would still carry the name into later code,
// where a plain `target[key]=value` assignment elsewhere could trigger the
// real accessor and pollute a genuine prototype. Stripped at the one point
// untrusted localStorage data enters the app, before anything downstream
// (including a future change) ever sees it. See loadState().
function stripProtoKeys(obj){
let out={};
for(let k of Object.keys(obj)){if(k==='__proto__'||k==='constructor'||k==='prototype')continue;out[k]=obj[k]}
return out;
}
function loadState(){
try{
let raw=localStorage.getItem(KEY);
if(!raw)return {...defaultState};
let parsed=JSON.parse(raw);
if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {...defaultState};
let clean=stripProtoKeys(parsed);
// Field-level shape check too — a tampered/partial value like {users:"oops"}
// would otherwise pass the object check above and crash later on
// state.users.find()/state.projects.filter(). Any wrong-shaped field falls
// back to its default rather than the whole load falling back. Being an
// array isn't enough either — a tampered entry like users:[null] still
// crashes the very next state.users.find(x=>x.email===email), so each
// entry is checked (and proto-key-stripped) the same way the top-level
// object and the user object already are; non-object entries are simply
// dropped rather than crashing the whole array.
let cleanArr=a=>a.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map(stripProtoKeys);
// A stored user record with a missing/empty id would still be found by
// email at sign-in (the #login handler looks up state.users by email
// only), then written to state.user.id — the same shape loadState()
// already requires for state.user itself — leaving every project the
// customer creates afterwards with owner:undefined. email can't be
// sensibly defaulted, so a record without one is simply dropped (it was
// never reachable by the email-lookup sign-in flow anyway); a missing/
// invalid id is healed with a fresh one, same as project ids above.
let cleanUser=u=>{
if(typeof u.email!=='string'||!u.email)return null;
let id=typeof u.id==='string'&&u.id?u.id:crypto.randomUUID();
return {...u,id};
};
let users=Array.isArray(clean.users)?cleanArr(clean.users).map(cleanUser).filter(Boolean):defaultState.users;
// A project's id is trusted enough elsewhere in the app to be interpolated
// raw into onclick="route('project','${p.id}')" on the dashboard project
// list (dashboard() below) — unlike every *route*-driven id, this one is
// read straight out of stored project data, not the URL, so render()'s own
// UUID guard never sees it; a tampered id could break out of that
// attribute the same way the route id and door ids could before their
// equivalent fixes. p.name is passed
// through esc() everywhere it's *displayed* (esc() coerces safely via
// String(s??'')), but downloadReport()'s PDF filename does
// p.name.replace(/\W+/g,'-') directly with no such coercion — a
// non-string name throws there and aborts the download. Both are
// normalized here, healing rather than crashing.
let cleanProject=p=>{
let id=typeof p.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)?p.id:crypto.randomUUID();
// Whole, non-negative numbers.
let clampDl=v=>Number.isFinite(v)?Math.max(0,Math.trunc(v)):0;
// Uploads are counted per stage per project (limit 2 each) and never decrease,
// so removing a file does not free a slot. Existing projects are seeded from the
// evidence already on record so the limit applies fairly to them too.
let u=p.uploads&&typeof p.uploads==='object'?p.uploads:{};
let ev=Array.isArray(p.evidence)?p.evidence:[];
let evKey=e=>{let t=e&&e.stage;return t==='Stage 1'?'s1':(typeof t==='string'&&/^Stage (1 complete|2)/.test(t))?'s2':null};
let uploads={s1:Math.max(clampDl(u.s1),ev.filter(e=>evKey(e)==='s1').length),s2:Math.max(clampDl(u.s2),ev.filter(e=>evKey(e)==='s2').length)};
let name=typeof p.name==='string'&&p.name?p.name:'Untitled project';
return {...p,id,name,uploads};
};
let projects=Array.isArray(clean.projects)?cleanArr(clean.projects).map(cleanProject):defaultState.projects;
// `typeof x==='object'` alone also admits arrays and objects missing the
// fields requireUser()/newProject() actually rely on — a truthy-but-
// malformed user would pass isLoggedIn checks and then write projects with
// owner:undefined. Require the exact shape a real signed-in user always
// has; anything else is treated as signed out rather than half-signed-in.
let cu=clean.user&&typeof clean.user==='object'&&!Array.isArray(clean.user)?stripProtoKeys(clean.user):null;
let user=cu&&typeof cu.id==='string'&&cu.id&&typeof cu.email==='string'&&cu.email?cu:defaultState.user;
// stage3ImpactRegister (Batch 5): same defensive shape-check style as
// users/projects above — a tampered/malformed value falls back to the
// empty default rather than crashing the internal ledger page that reads it.
let stage3ImpactRegister=Array.isArray(clean.stage3ImpactRegister)?cleanArr(clean.stage3ImpactRegister):defaultState.stage3ImpactRegister;
return {...defaultState,...clean,user,users,projects,stage3ImpactRegister};
}catch(e){return {...defaultState}}
}
let state=stage1ReviewRequested?{...defaultState}:loadState();
if(window.ProjectCheckPlatform?.enabled)state={...state,user:null,users:[],projects:[]};
// localStorage.setItem can throw (quota exceeded, private-browsing storage
// disabled) — a failed save must not crash the interaction the customer is
// mid-way through; the in-memory state still works for the rest of the session.
// Logged (not surfaced to the customer) so a real failure is diagnosable —
// this file has no other logging/telemetry path (see security-readiness.md).
const save=()=>{
  try {
    if(stage1ReviewRequested){
      if(state.user)sessionStorage.setItem(STAGE1_REVIEW_KEY,JSON.stringify(state));
    }else localStorage.setItem(KEY,JSON.stringify(state));
  } catch(e) {console.error('Project Check: could not save project state',e)}
  if(!stage1ReviewRequested&&window.ProjectCheckPlatform?.enabled)window.ProjectCheckPlatform.captureState(state).catch(e=>console.error('Project Check: platform sync failed',e));
};
// Planning Batch 2 — Controlled Stage 3 Impact Register Correction
// (2026-08-26): seeds exactly the four authorised Planning Batch 2 impact
// entries into the EXISTING, GLOBAL state.stage3ImpactRegister — see
// seedPlanningBatch2ImpactRegisterEntries()/PLANNING_BATCH2_IMPACT_ENTRIES
// in evidence.js. Safe to call on every load: the register's own
// dedupe_key mechanism means only the very first call ever appends
// anything; every later reload/revisit/rebuild appends nothing. Only
// saves when something actually changed, so a normal (already-seeded)
// reload never writes localStorage unnecessarily.
if(typeof seedPlanningBatch2ImpactRegisterEntries==='function'&&seedPlanningBatch2ImpactRegisterEntries(state))save();
// Planning Batch 3 (2026-08-26): reviews (never duplicates) the ONE
// existing Planning Batch 2 Impact Register entry this batch's own
// progression-advice work actually addresses — see
// reviewPlanningBatch3ImpactRegisterEntries() in evidence.js. Idempotent
// for the same reason as the seeding call above: a no-op after the first
// time it runs.
if(typeof reviewPlanningBatch3ImpactRegisterEntries==='function'&&reviewPlanningBatch3ImpactRegisterEntries(state))save();
// Planning Batch 4 (2026-08-26): reviews (never duplicates) the two further
// Planning Batch 2 Impact Register entries this batch now genuinely
// implements — see reviewPlanningBatch4ImpactRegisterEntries() in
// evidence.js. Idempotent, same as the two calls above.
if(typeof reviewPlanningBatch4ImpactRegisterEntries==='function'&&reviewPlanningBatch4ImpactRegisterEntries(state))save();
// Planning Batch 5 (2026-08-26): reviews (never duplicates) the final
// Planning Batch 2 Impact Register entry (portal evidence → future
// closure) — see reviewPlanningBatch5ImpactRegisterEntries() in
// evidence.js. Idempotent, same as the three calls above.
if(typeof reviewPlanningBatch5ImpactRegisterEntries==='function'&&reviewPlanningBatch5ImpactRegisterEntries(state))save();
const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const now=()=>new Date().toISOString();
// Prototype account credentials: salted SHA-256 client-side, so a customer's raw
// password never sits in plaintext in browser localStorage. This is still NOT a
// substitute for real server-side authentication (see security-readiness.md) —
// production must move authentication server-side (PRODUCTION SECURITY BLOCKER).
function randomSaltHex(){return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function hashPassword(pass,saltHex){
let data=new TextEncoder().encode(saltHex+':'+pass);
let digest=await crypto.subtle.digest('SHA-256',data);
return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')
}
// Loads the approved Project Check logo (assets/project-check-logo.png, unaltered)
// once as a data URI, so drawing.js can embed the real artwork in the drawing title
// block and downloadReport() can embed it in the PDF header. PC_LOGO_DATA_URL is
// declared in drawing.js (loaded before this file). Never falls back to a redrawn
// substitute — only to plain text — if the asset can't be loaded.
async function loadLogoDataUrl(){
try{
let res=await fetch('assets/project-check-logo.png');
let blob=await res.blob();
PC_LOGO_DATA_URL=await new Promise((resolve,reject)=>{let reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})
}catch(e){/* logo asset optional at runtime; title block/PDF fall back to text only */}
}
loadLogoDataUrl();
// Loads the approved illustrative industrial-building reference image
// (assets/project-check-building-reports.png, unaltered) once as a data URI so
// downloadReport() can embed it in the Stage 1/2 PDF alongside the on-screen report.
// Falls back to no image (never a substitute) if the asset can't be loaded.
let PC_BUILDING_REPORT_DATA_URL=null;
async function loadBuildingReportDataUrl(){
try{
let res=await fetch('assets/project-check-building-reports.png');
// fetch() only rejects on network failure, not on HTTP error status — an ok check
// is required or a 404/500 response body would otherwise be read as if it were
// the image and embedded as a broken/garbage data URI.
if(!res.ok)return;
let blob=await res.blob();
PC_BUILDING_REPORT_DATA_URL=await new Promise((resolve,reject)=>{let reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})
}catch(e){/* reference image optional at runtime; PDF simply omits it */}
}
loadBuildingReportDataUrl();
const SITE_SHELL_ROUTES=new Set(["home","signin","create","createProject","dashboard","project","projectSettings","projectDocuments","stage1Workspace","stage1","stage1Summary","stage1Confirm","siteLayout","buildingLayout","stage2","stage2Summary","quotes","quotationSummary","profile","profileEdit","terms","privacy"]);
let drawerReturnFocus=null;
function route(name,id){const next=id?`${name}/${id}`:name;if(location.hash.slice(1)===next)render();else location.hash=next}
function closeSiteDrawer(restoreFocus=true){
const drawer=document.querySelector("#siteDrawer"),backdrop=document.querySelector("#drawerBackdrop"),toggle=document.querySelector("#menuBtn");
if(!drawer||drawer.getAttribute("aria-hidden")==="true")return;
if(drawer.contains(document.activeElement))(drawerReturnFocus||toggle).focus();
drawer.inert=true;drawer.setAttribute("aria-hidden","true");backdrop.hidden=true;toggle.setAttribute("aria-expanded","false");document.body.classList.remove("drawer-open");
if(restoreFocus)(drawerReturnFocus||toggle).focus();drawerReturnFocus=null;
}
function openSiteDrawer(){
syncAuth();
const drawer=document.querySelector("#siteDrawer"),backdrop=document.querySelector("#drawerBackdrop"),toggle=document.querySelector("#menuBtn");
drawerReturnFocus=document.activeElement;drawer.inert=false;drawer.setAttribute("aria-hidden","false");backdrop.hidden=false;toggle.setAttribute("aria-expanded","true");document.body.classList.add("drawer-open");
drawer.querySelector(".drawer-project-journey button:not([hidden]),.drawer-nav button:not([hidden])")?.focus();
}
document.addEventListener('click',e=>{let r=e.target.closest('[data-route]');if(r){closeSiteDrawer(false);route(r.dataset.route,r.dataset.id)}});
document.querySelector("#menuBtn").onclick=openSiteDrawer;
document.querySelector("#drawerClose").onclick=()=>closeSiteDrawer();
document.querySelector("#drawerBackdrop").onclick=()=>closeSiteDrawer();
document.querySelector("#drawerSignIn").onclick=()=>{closeSiteDrawer(false);authModal("signin")};
document.querySelector("#drawerCreateAccount").onclick=()=>{closeSiteDrawer(false);authModal("create")};
document.querySelector("#authBtn").onclick=()=>{closeSiteDrawer(false);logout()};
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSiteDrawer()});

function drawerJourneyItem(label,status,tone,routeName,projectId,current=false,disabled=false,next=false,guest=false){
const routeAttributes=guest?' data-guest-step="1"':routeName&&!disabled?` data-route="${routeName}" data-id="${esc(projectId)}"`:"";
return `<button type="button" class="drawer-journey-item ${tone}${current?" current":""}${next&&!current?" next":""}"${routeAttributes}${current?' aria-current="page"':""}${disabled?" disabled":""}><span class="drawer-journey-dot" aria-hidden="true"></span><span class="drawer-journey-name">${esc(label)}</span><span class="drawer-journey-status">${esc(current?"Current":next?`Next · ${status}`:status)}</span></button>`
}
const DRAWER_STAGE1_STEPS=["Your project","Your details","Your answers","Your documents","Check your details","Site layout","Building design","Your probable problems"];
function drawerGuestStart(){closeSiteDrawer(false);if(state.user)newProject();else authModal("create")}
function drawerGuestStep(){closeSiteDrawer(false);if(state.user)newProject();else authModal("signin")}
function renderDrawerProjectJourney(p,currentRoute){
const drawer=document.querySelector("#siteDrawer"),context=document.querySelector("#drawerProjectContext"),journey=document.querySelector("#drawerProjectJourney"),card=document.querySelector("#drawerProjectCard"),guestIntro=document.querySelector("#drawerGuestIntro");
if(!context||!journey)return;
const visible=!!(state.user&&p);
drawer?.classList.toggle("has-project",visible);
drawer?.classList.toggle("has-guest-journey",!visible);
context.hidden=false;
if(card)card.hidden=!visible;
if(guestIntro)guestIntro.hidden=visible;
if(!visible){
journey.innerHTML=`
  <div class="drawer-stage-heading">Free check · find the problems</div>
  ${DRAWER_STAGE1_STEPS.map(label=>drawerJourneyItem(label,"To do","todo","","",false,false,false,true)).join("")}
  <div class="drawer-stage-heading">Paid stage · find the solutions</div>
  ${drawerJourneyItem("Paid stage","See what's included","todo","stage2","",false,false)}
`;
journey.querySelectorAll("[data-guest-step]").forEach(button=>button.onclick=drawerGuestStep);
const startButton=document.querySelector("#drawerGuestStart");if(startButton)startButton.onclick=drawerGuestStart;
return;
}
const facts=projectFacts(p);
const questions=stage1QuestionsFor(p),answered=questions.filter(question=>stage1QuestionAnswered(p,question)).length,total=questions.length;
const documents=stage1EvidenceCount(p);
const detailsComplete=[facts.role,facts.buildingUse,facts.buildingType,p.address,facts.length,facts.width,facts.height].every(stage1HasValue)&&projectSteelRequirementsComplete(facts);
const questionsComplete=total>0?answered===total:detailsComplete;
const questionsStatus=total>0?(questionsComplete?"Done":`${answered} of ${total} answered`):(questionsComplete?"Done":"Questions to answer");
const siteLayoutComplete=facts.siteLayoutStatus==="confirmed";
const buildingDesignComplete=siteLayoutComplete&&facts.buildingDesignStatus==="confirmed";
const currentKey=currentRoute==="project"?"stage1Workspace":currentRoute;
const summaryComplete=Boolean(p.stage1SummaryConfirmed);
const reportComplete=Boolean(p.stage1Complete);
const steps=[
  {key:"projectSettings",label:"Your details",done:detailsComplete,hint:"Details to add"},
  {key:"stage1",label:"Your answers",done:questionsComplete,status:questionsStatus,hint:questionsStatus},
  {key:"projectDocuments",label:"Your documents",done:documents>0,status:`${documents} file${documents===1?"":"s"}`,tone:"evidence",hint:"No documents yet"},
  {key:"stage1Confirm",label:"Check your details",done:summaryComplete,hint:"Not checked yet"},
  {key:"siteLayout",label:"Site layout",done:siteLayoutComplete,hint:"Site not placed yet"},
  {key:"buildingLayout",label:"Building design",done:buildingDesignComplete,hint:"Building not set up yet"}
];
steps.push({key:"stage1Summary",label:"Your probable problems",done:reportComplete,hint:"Not ready yet"});
const doneCount=steps.filter(step=>step.done).length;
const readiness=reportComplete?100:Math.max(0,Math.min(100,Math.round(doneCount/steps.length*100)))||0;
const nextKey=steps.find(step=>!step.done)?.key||"";
document.querySelector("#drawerProjectName").textContent=p.name||"Untitled project";
document.querySelector("#drawerProjectProgressLabel").textContent=`Free check · ${readiness}% done`;
document.querySelector("#drawerProjectProgressBar").style.width=`${readiness}%`;
journey.innerHTML=`
  <div class="drawer-stage-heading">Free check · find the problems</div>
  ${drawerJourneyItem("Your project",reportComplete?"Done":`${doneCount} of ${steps.length} steps done`,reportComplete?"complete":"pending","stage1Workspace",p.id,currentKey==="stage1Workspace")}
  ${steps.map(step=>drawerJourneyItem(step.label,step.done?(step.status||"Done"):step.hint,step.done?(step.tone||"complete"):"todo",step.key,p.id,currentKey===step.key,false,step.key===nextKey)).join("")}
  <div class="drawer-stage-heading">Paid stage · find the solutions</div>
  ${drawerJourneyItem("Paid stage","See what's included","todo","stage2",p.id,currentKey==="stage2")}
`;
}

function syncAuth(){
const on=!!state.user,parts=(location.hash.slice(1)||"home").split("/"),r=parts[0],id=parts[1],authenticatedPage=["createProject","dashboard","project","projectSettings","projectDocuments","stage1Workspace","stage1Confirm","siteLayout","buildingLayout","profile","profileEdit"].includes(r);
const included=SITE_SHELL_ROUTES.has(r),quick=document.querySelector("#quickActionBtn"),projectsButton=document.querySelector("#projectsBtn"),profileButton=document.querySelector("#profileBtn");
document.querySelector("#siteNavActions").hidden=!included;
if(!included)closeSiteDrawer(false);
projectsButton.hidden=!on;profileButton.hidden=!on;document.querySelector("#drawerSignIn").hidden=on;document.querySelector("#drawerCreateAccount").hidden=on;document.querySelector("#drawerSignoutSeparator").hidden=!on;document.querySelector("#authBtn").hidden=!on;
const activeProjectId=id&&["project","projectSettings","projectDocuments","stage1Workspace","stage1","stage1Summary","stage1Confirm","siteLayout","buildingLayout","stage2","stage2Summary","quotes","quotationSummary","profile","profileEdit"].includes(r)?id:(firstProject()?.id||"");
const activeProject=activeProjectId?getP(activeProjectId):firstProject();
renderDrawerProjectJourney(activeProject,r);
if(activeProjectId)profileButton.dataset.id=activeProjectId;else delete profileButton.dataset.id;
let quickLabel="My Projects",quickAction=()=>route("dashboard");
if(r==="terms"||r==="privacy"){quickLabel="Home";quickAction=()=>route("home")}
else if(!on){quickLabel="Start";quickAction=()=>authModal("create")}
else if(r==="dashboard"){quickLabel="Profile & Settings";quickAction=()=>route("profile",activeProjectId||undefined)}
else if(r==="profileEdit"){quickLabel="Profile Overview";quickAction=()=>route("profile",activeProjectId||undefined)}
else if(r==="profile"){quickLabel="My Projects";quickAction=()=>route("dashboard")}
else if(["project","stage1Workspace","stage1Confirm","siteLayout","buildingLayout","projectSettings","projectDocuments"].includes(r)){quickLabel="My Projects";quickAction=()=>route("dashboard")}
quick.textContent=quickLabel;quick.onclick=quickAction;
document.querySelectorAll("[data-drawer-route]").forEach(button=>{const activeRoute=r==="profileEdit"?"profile":["project","projectSettings","projectDocuments","stage1Workspace","stage1Confirm","siteLayout","buildingLayout"].includes(r)?"dashboard":r;const active=button.dataset.drawerRoute===activeRoute;button.classList.toggle("active",active);if(active)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current")});
const accountPanel=document.querySelector("#drawerAccount");accountPanel.hidden=true;document.querySelector("#drawerAccountName").textContent="";
}
async function restorePlatformSession(){if(stage1ReviewRequested||!window.ProjectCheckPlatform?.enabled)return;try{let remote=await ProjectCheckPlatform.hydrateState();if(!remote.user)return;state.user=remote.user;state.users=remote.users;state.projects=remote.projects;save();syncAuth();render()}catch(e){console.error('Project Check: session restore failed',e)}}
setTimeout(restorePlatformSession,0);
// Approved Four-Icon Set (2026-08-30): all four CHECK/UNDERSTAND/DECIDE/
// MOVE FORWARD icons now use Stuart's approved reference image
// ("9. Images/Home page rev 2/Check-Understand-Decide-MoveForward/
// Check-Understand-Decide_MoveForward.png"), cropped into four separate
// asset files (assets/project-check-icon-*.png) — pixel-cropped only
// (exact boundaries found by scanning the source for each icon's own
// circle vs. the white background/gap before its text label), never
// redrawn/redesigned/approximated. Each crop already includes its own
// pale-green circular background at consistent relative scale, so it is
// rendered via .journey-icon img{width/height:100%} (styles.css) to fill
// the same circle slot previously used by hand-authored inline SVGs
// (2026-08-29 Homepage Locked Visual Conformance Correction) and, before
// that, the emoji (📋🔍📄🤝) used in the first Homepage Rebuild pass —
// both fully superseded now. Reused for both the hero-card mini-journey
// and the four detailed cards below, and by PRICING_ICONS further down
// (the Pricing page has been removed).
const HOMEPAGE_JOURNEY_ICONS={
check:'<img src="assets/project-check-icon-check.png" alt="Clipboard with checklist, representing Check">',
understand:'<img src="assets/project-check-icon-understand.png" alt="Magnifying glass over a bar chart, representing Understand">',
decide:'<img src="assets/project-check-icon-decide.png" alt="Document with a checkmark, representing Decide">',
moveforward:'<img src="assets/project-check-icon-moveforward.png" alt="Handshake, representing Move forward / Support">'
};
// The locked CHECK -> UNDERSTAND -> DECIDE -> MOVE FORWARD journey data —
// one source of truth reused for both the hero-card mini-journey and the
// four detailed "How Project Check works" cards below, so the two
// placements can never drift out of sync on label/badge/sequence. Every
// string here is unchanged, locked wording carried over verbatim from the
// 2026-08-29 Homepage Rebuild.
const HOMEPAGE_JOURNEY=[
{icon:'check',label:'Free check · we show the problems',detail:'Tell us about your building and site. We show you the probable problems in plain words.'},
{icon:'decide',label:'Stage 2 · the answers and a plan',detail:'A Teams meeting with Stuart, solutions to each problem, a plain review of your documents, nearby planning history and Building Regulations guidance.'}
];
function home(){
const startAction=state.user?"route('dashboard')":"authModal('create')";
const startLabel=state.user?'Save your project':'Start your free check';
const ctaRow=`<div class="simple-cta-row">${callButton('btn green simple-cta simple-cta-main')}<button type="button" class="btn simple-cta simple-cta-alt" onclick="${startAction}">${startLabel}</button></div>`;
const surprisesHtml=CLIENT_QUESTION_TITLES.map(text=>`<li>${esc(text)}</li>`).join('');
app.innerHTML=`<div class="figma-homepage simple-home">
<section class="simple-hero" aria-label="Project Check introduction"><img class="home-figma-hero-logo" src="assets/project-check-logo.png" alt="Project Check — Know before you build."><h1>Want an industrial building? Find out what could trip you up before you spend a penny.</h1><p class="simple-lead">Project Check is built for people who just want a building and have not built one before. We tell you the probable problems in plain words.</p>${ctaRow}</section>
<section class="simple-section simple-surprises" aria-labelledby="simpleSurprisesTitle"><h2 id="simpleSurprisesTitle">Questions first-timers should ask</h2><p class="simple-lead">The free check gives you a probable answer to each of these, in plain words.</p><ul class="simple-list">${surprisesHtml}</ul></section>
<section class="simple-section simple-how" aria-labelledby="simpleHowTitle"><h2 id="simpleHowTitle">How it works</h2><div class="simple-steps"><article class="simple-step"><span class="simple-step-num" aria-hidden="true">1</span><h3>Free check</h3><p>Tell us about your building and site. We show you the probable problems in plain words.</p></article><article class="simple-step"><span class="simple-step-num" aria-hidden="true">2</span><h3>Stage 2: the answers and a plan</h3><p>A Teams meeting with Stuart. Solutions to each problem. Upload photos and documents as the job goes on and get a plain review each time. Nearby planning history and conditions. Building Regulations guidance.</p></article></div></section>
<section class="simple-section simple-closing" aria-labelledby="simpleClosingTitle"><h2 id="simpleClosingTitle">Know before you build.</h2><p>Talk to Stuart first, or start the free check now. Either order works.</p>${ctaRow}</section>
<footer class="home-footer"><img src="assets/project-check-banner-logo.png" alt="Project Check — Know before you build."><nav aria-label="Homepage footer"><button data-route="home">Home</button><button onclick="${state.user?"logout()":"authModal()"}">${state.user?'Sign out':'Sign in'}</button></nav><span></span><div class="home-footer-legal"><div></div><small>© 2026 Project Check</small></div></footer>
</div>`}
// Two-stage journey shared by the homepage and the sign-in sidebar.
// Green line-art shield/check icon for the new "confidence strip" (Rev 3)
// — same stroke family as the auth icons above.
const PRICING_SHIELD_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z"></path><path d="M9 12l2 2 4-4"></path></svg>';
// Account / Sign-in Experience (2026-08-30, Approved Visual Reference task)
// — replaces the earlier single combined guess-the-intent form with two
// explicit, clearly separated views (EXISTING CUSTOMER sign in / NEW
// CUSTOMER create account), matching the approved reference. The
// underlying account mechanism is UNCHANGED — same state.users records,
// same salted-hash verification (including the one-time plaintext-password
// migration below), same save()/syncAuth()/route('dashboard') completion —
// only the presentation and which fields are shown/required per explicit
// user choice (rather than inferred after submission by an email lookup)
// have changed. New required fields on account creation (Full name,
// Company name) are genuinely captured and stored on the user record, not
// decorative — the reference's own "Required fields" list demands they
// are real inputs.
//
// Terms acceptance vs. the Privacy Policy vs. marketing consent remain
// three deliberately separate things, exactly as before:
//  - #caTerms is the only REQUIRED legal-acceptance control (Terms &
//    Conditions only — the Privacy Policy is not something a customer
//    "accepts" or "consents to" as a condition of creating an account).
//  - The Privacy Policy link sits alongside as plain informational text,
//    in the shared footer below both views, with no checkbox and no
//    validation.
//  - #caMarketing is a separate, unticked-by-default, OPTIONAL control —
//    account creation must succeed whether or not it's ticked.
//
// One deliberate departure from the reference's exact illustrative
// wording/elements, explained at point of use below: the footer's privacy
// line does not use the reference's "your data is... never shared"
// wording, since the approved Privacy Policy explicitly describes several
// lawful sharing scenarios (suppliers, payment providers, legal
// authorities) — an unqualified "never shared" claim would be inaccurate.
//
// "Forgot your password?" (2026-09-10, Stuart's explicit instruction,
// account-panel review): inspected and confirmed dead — this is a static
// prototype with no email/backend of any kind, so no real recovery flow
// exists or could be "wired up" behind it. The earlier version kept it as
// a clickable control that revealed an inline disclaimer on click; that
// still visually promised a working action it didn't have. Replaced with
// plain, non-interactive text ("Password recovery coming soon") instead —
// same honest disclosure, no control that implies it does something.
//
// Mobile modal fix (2026-08-26): while this modal is open, the background
// page must not be the thing that scrolls in response to a touch/wheel
// gesture — only the modal card itself should (see the CSS fix on
// `.modal .card`, styles.css, for the actual reachability fix; this JS-side
// piece closes the remaining gap where a gesture starting on the backdrop,
// outside the card, would otherwise still scroll the hidden page behind a
// `position:fixed` modal). Scoped to authModal() only — the "New project"
// modal is untouched. Restored on every exit path (close and successful
// sign-in/account-creation) via closeAuthModal(), never left stuck hidden.
function closeAuthModal(d,previousBodyOverflow){document.body.style.overflow=previousBodyOverflow;d.remove()}
// Small, self-contained green line-art icons for this modal only (lock /
// building) — new supporting icons for new UI elements, distinct from the
// four APPROVED journey icons (Check/Understand/Decide/Move forward),
// which this modal reuses unmodified via HOMEPAGE_JOURNEY_ICONS.
const AUTH_LOCK_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
const AUTH_BUILDING_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="1"></rect><path d="M9 21v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path><line x1="8" y1="7" x2="8" y2="7.01"></line><line x1="12" y1="7" x2="12" y2="7.01"></line><line x1="16" y1="7" x2="16" y2="7.01"></line><line x1="8" y1="11" x2="8" y2="11.01"></line><line x1="12" y1="11" x2="12" y2="11.01"></line><line x1="16" y1="11" x2="16" y2="11.01"></line></svg>';
// Accessible show/hide password icons (2026-09-10, Stuart's explicit
// instruction): replaces the earlier eye-emoji toggle. Same inline-SVG,
// same-stroke-family technique as AUTH_LOCK_ICON/AUTH_BUILDING_ICON above
// — no external icon asset/library added. AUTH_EYE_ICON is shown when the
// password is currently hidden (click reveals it); AUTH_EYE_OFF_ICON is
// shown when it is currently visible (click hides it again) — swapped by
// the .pw-toggle click handler below, together with the button's own
// aria-label ("Show password" / "Hide password").
const AUTH_EYE_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const AUTH_EYE_OFF_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a13.1 13.1 0 0 1-3.05 3.94M6.5 6.53A13.1 13.1 0 0 0 1 12s4 7 11 7a10.9 10.9 0 0 0 5.47-1.47"></path><path d="M10.58 10.58a3 3 0 0 0 4.24 4.24"></path><path d="M3 3l18 18"></path></svg>';
function authModal(initialPanel='signin',embedded=false){
if(['signin','create'].includes(initialPanel)&&!embedded){route(initialPanel);return;}
let previousBodyOverflow=document.body.style.overflow;if(!embedded)document.body.style.overflow='hidden';
let d=document.createElement('div');d.className=embedded?'signin-screen':'modal';
const journeyHtml=HOMEPAGE_JOURNEY.map(j=>`<div class="journey-step"><div class="journey-icon">${HOMEPAGE_JOURNEY_ICONS[j.icon]}</div><div><div class="eyebrow">${j.label}</div></div></div>`).join('');
d.innerHTML=`<div class="card auth-modal">
<div class="auth-main">
<div class="auth-modal-header"><img class="auth-logo" src="assets/project-check-logo.png" alt="Project Check — Know before you build."><button type="button" class="auth-close" id="authClose" aria-label="Close">&times;</button></div>
<div class="auth-panel" id="authPanelSignin">
<div class="auth-intro"><span class="auth-badge">Sign in</span><h2>Welcome back</h2><p class="meta auth-center">Sign in to carry on with your free check.</p></div>
<button class="btn green full" id="adminQuickBtn" hidden>CEO Admin Access</button>
<div class="field"><label for="siEmail">Business email</label><input id="siEmail" type="email" autocomplete="email" placeholder="name@company.com"></div>
<div class="field"><label for="siPass">Password</label><div class="password-field"><input id="siPass" type="password" autocomplete="current-password" placeholder="Enter your password"><button type="button" class="pw-toggle" data-target="siPass" aria-label="Show password">${AUTH_EYE_ICON}</button></div></div>
<p class="field-note"><button type="button" class="linklike" id="showRecovery">Forgot your password?</button></p>
<button class="btn green full" id="signinBtn">Sign in</button>
<div class="auth-divider"><span>New to Project Check?</span></div>
<button class="btn outline-green full" id="showCreate">Create a free account</button>
</div>
<div class="auth-panel" id="authPanelRecovery" style="display:none">
<div class="auth-intro"><span class="auth-badge">Forgot your password?</span><h2>Reset your password</h2><p class="meta auth-center">Enter your business email. We will send you a link to reset it.</p></div>
<div class="field"><label>Business email</label><input id="recoveryEmail" type="email" autocomplete="email" placeholder="name@company.com"></div>
<button class="btn green full" id="requestRecoveryBtn">Send reset link</button>
<p class="auth-switch"><button type="button" class="linklike" id="cancelRecovery">Return to sign in</button></p>
</div>
<div class="auth-panel" id="authPanelReset" style="display:none">
<div class="auth-intro"><span class="auth-badge">New password</span><h2>Choose a new password</h2><p class="meta auth-center">Use at least 8 characters.</p></div>
<div class="field"><label>New password</label><div class="password-field"><input id="resetPass" type="password" autocomplete="new-password" placeholder="Enter a new password"><button type="button" class="pw-toggle" data-target="resetPass" aria-label="Show password">${AUTH_EYE_ICON}</button></div></div>
<div class="field"><label>Confirm new password</label><div class="password-field"><input id="resetPassConfirm" type="password" autocomplete="new-password" placeholder="Enter it again"><button type="button" class="pw-toggle" data-target="resetPassConfirm" aria-label="Show password">${AUTH_EYE_ICON}</button></div></div>
<button class="btn green full" id="resetPasswordBtn">Save new password</button>
</div>
<div class="auth-panel" id="authPanelCreate" style="display:none">
<div class="auth-intro"><h2>Create your free account</h2><p class="meta auth-center">Your project stays saved in one place, so you can come back to it.</p></div>
<div class="field"><label for="caName">Full name</label><input id="caName" type="text" autocomplete="name" placeholder="Enter your full name"></div>
<div class="field"><label for="caCompany">Company name</label><input id="caCompany" type="text" autocomplete="organization" placeholder="Enter your company name"></div>
<div class="field"><label for="caCompanyAddress">Company address</label><input id="caCompanyAddress" type="text" autocomplete="street-address" placeholder="Enter your company address including postcode"></div>
<div class="field"><label for="caEmail">Business email</label><input id="caEmail" type="email" autocomplete="email" placeholder="name@company.com"></div>
<div class="field"><label for="caMobile">Mobile number</label><input id="caMobile" type="tel" inputmode="tel" autocomplete="tel" required placeholder="e.g. 07700 900000"></div>
<div class="field"><label for="caPass">Password</label><div class="password-field"><input id="caPass" type="password" autocomplete="new-password" placeholder="Create a password"><button type="button" class="pw-toggle" data-target="caPass" aria-label="Show password">${AUTH_EYE_ICON}</button></div></div>
<div class="consent-row"><input type="checkbox" id="caTerms"><label for="caTerms">I agree to the <button type="button" class="linklike" data-route="terms">Terms &amp; Conditions</button> and <button type="button" class="linklike" data-route="privacy">Privacy Policy</button></label></div>
<div class="consent-row"><input type="checkbox" id="caMarketing"><label for="caMarketing">I'm happy to receive occasional marketing updates about Project Check <span class="meta">(optional)</span></label></div>
<button class="btn green full" id="createBtn">Create account and start your free check</button>
<p class="auth-switch">Already have an account? <button type="button" class="linklike" id="showSignin">Sign in</button></p>
</div>
<div class="auth-b2b-notice"><div class="auth-b2b-icon">${PRICING_SHIELD_ICON}</div><div><p><b>Project Check is for business projects only.</b></p><p class="meta">Please use your company details. It is not for homes or private projects.</p></div></div>
</div>
<div class="auth-sidebar">
<h3>One account for the free check and the paid stage.</h3>
<p class="meta">Your project stays saved in one place.</p>
<div class="journey-steps auth-journey">${journeyHtml}</div>
</div>
<div class="auth-footer"><span class="meta">Secure test-platform authentication. Access is by invitation.</span></div>
</div>`;
if(embedded){
app.replaceChildren(d);
d.querySelector('.auth-modal-header').hidden=true;
d.querySelector('.auth-sidebar').hidden=true;
const footer=document.createElement('footer');footer.className='home-footer';
footer.innerHTML='<img src="assets/project-check-banner-logo.png" alt="Project Check — Know before you build."><nav aria-label="Account footer"><button data-route="home">Home</button><button data-route="signin">Sign in</button></nav><span></span><div class="home-footer-legal"><div></div><small>© 2026 Project Check</small></div>';
app.appendChild(footer);
}else document.body.appendChild(d);
// Customer registration stays visible on the secure test platform. The existing\n// Create a free account control opens the established registration panel.
d.querySelector('#authClose').onclick=()=>closeAuthModal(d,previousBodyOverflow);
// Accessible show/hide password toggle (2026-09-10): a real <button>, so
// Enter/Space already activate it via this same click handler with no
// extra keydown wiring needed. Swaps the icon AND the aria-label together
// so assistive tech always announces the ACTION the next click performs
// ("Show password" while hidden, "Hide password" once revealed), not a
// static label that goes stale after the first toggle.
d.querySelectorAll('.pw-toggle').forEach(btn=>btn.onclick=()=>{
let inp=d.querySelector('#'+btn.dataset.target);
const reveal=inp.type==='password';
inp.type=reveal?'text':'password';
btn.setAttribute('aria-label',reveal?'Hide password':'Show password');
btn.innerHTML=reveal?AUTH_EYE_OFF_ICON:AUTH_EYE_ICON;
});
const showPanel=which=>{['Signin','Recovery','Reset','Create'].forEach(name=>{d.querySelector('#authPanel'+name).style.display=which===name.toLowerCase()?'block':'none'})};
d.querySelector('#showCreate').onclick=()=>embedded?route('create'):showPanel('create');
d.querySelector('#showSignin').onclick=()=>embedded?route('signin'):showPanel('signin');
d.querySelector('#showRecovery').onclick=()=>{d.querySelector('#recoveryEmail').value=d.querySelector('#siEmail').value.trim().toLowerCase();showPanel('recovery')};
d.querySelector('#cancelRecovery').onclick=()=>showPanel('signin');
d.querySelector('#requestRecoveryBtn').onclick=async()=>{
 const email=d.querySelector('#recoveryEmail').value.trim().toLowerCase();
 if(!email)return alert('Enter your business email.');
 if(!window.ProjectCheckPlatform?.enabled)return alert('Secure password recovery is unavailable.');
 try{await ProjectCheckPlatform.requestPasswordReset(email);alert('If a Project Check account exists for that email, a secure reset link has been sent.');showPanel('signin')}catch(e){alert(e.message||'Password recovery could not be started. Please try again.')}
};
d.querySelector('#resetPasswordBtn').onclick=async()=>{
 const password=d.querySelector('#resetPass').value,confirmation=d.querySelector('#resetPassConfirm').value;
 if(password.length<8)return alert('Use a password of at least 8 characters.');
 if(password!==confirmation)return alert('The passwords do not match.');
 if(!window.ProjectCheckPlatform?.enabled)return alert('Secure password recovery is unavailable.');
 try{
  await ProjectCheckPlatform.updatePassword(password);
  const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('recovery');cleanUrl.hash='';history.replaceState({},'',cleanUrl.pathname+cleanUrl.search);
  const remote=await ProjectCheckPlatform.hydrateState();state.user=remote.user;state.users=remote.users;state.projects=remote.projects;save();closeAuthModal(d,previousBodyOverflow);syncAuth();route('dashboard');
 }catch(e){alert(e.message||'Your password could not be updated. Please request a new reset link.')}
};
showPanel(initialPanel);
d.querySelector('#adminQuickBtn').onclick=async()=>{
if(!window.ProjectCheckPlatform?.enabled)return alert('Secure platform access is unavailable.');
try{
let remote=await ProjectCheckPlatform.hydrateState();
if(!remote.user)return alert('Sign in normally once on this device to activate CEO Admin Access.');
if(!remote.user.isCeo)return alert('This account is not authorised for CEO Admin Access.');
state.user=remote.user;state.users=remote.users;state.projects=remote.projects;save();closeAuthModal(d,previousBodyOverflow);syncAuth();route('dashboard')
}catch(e){alert(e.message||'CEO Admin Access failed. Sign in normally once to renew this device session.')}
};
d.querySelector('#signinBtn').onclick=async()=>{
let email=d.querySelector('#siEmail').value.trim().toLowerCase(),pass=d.querySelector('#siPass').value;
if(!email||!pass)return alert('Enter your business email and password.');
if(window.ProjectCheckPlatform?.enabled){
 try{await ProjectCheckPlatform.signIn(email,pass);let remote=await ProjectCheckPlatform.hydrateState();state.user=remote.user;state.users=remote.users;state.projects=remote.projects;save();closeAuthModal(d,previousBodyOverflow);syncAuth();route('dashboard')}catch(e){alert(e.message||'Sign in failed.')}
 return;
}
let u=state.users.find(x=>x.email===email);
if(!u)return alert('No Project Check account was found for that email. Use "Create a free account" below to get started.');
if(u.pass!==undefined){if(u.pass!==pass)return alert('Incorrect password.');let salt=randomSaltHex();u.salt=salt;u.passHash=await hashPassword(pass,salt);delete u.pass}
else if(await hashPassword(pass,u.salt)!==u.passHash)return alert('Incorrect password.');
state.user={id:u.id,email:u.email};save();closeAuthModal(d,previousBodyOverflow);syncAuth();route('dashboard')};
d.querySelector('#createBtn').onclick=async()=>{
let name=d.querySelector('#caName').value.trim(),company=d.querySelector('#caCompany').value.trim(),companyAddress=d.querySelector('#caCompanyAddress').value.trim(),email=d.querySelector('#caEmail').value.trim().toLowerCase(),pass=d.querySelector('#caPass').value;
if(!name||!company||!companyAddress)return alert('Enter your full name, company name and company address.');
if(!email||!d.querySelector('#caEmail').checkValidity())return alert('Enter a valid business email.');
if(pass.length<8)return alert('Use a password of at least 8 characters.');
const reusableTestEmail=["newcustomer@test.co.uk","testcustomer@test.co.uk"].includes(email);
if(!reusableTestEmail&&state.users.find(x=>x.email===email))return alert('An account already exists for that email. Use "Sign in" instead.');
// Mobile number changed back to REQUIRED (2026-09-10, Stuart's explicit
// instruction) — supersedes the 2026-08-30 Account Gate Final Correction,
// which had made it optional. The <input required> attribute above gives
// native browser validation on submit-style interaction; this explicit
// check is the actual gate on the button's own click handler (a plain
// button, not a <form> submit, so `required` alone would not block it).
let mobile=d.querySelector('#caMobile').value.trim();
if(!mobile)return alert('Enter your mobile number.');
if(!d.querySelector('#caTerms').checked)return alert('Please accept the Terms & Conditions to continue.');
let marketingConsent=d.querySelector('#caMarketing').checked;
if(window.ProjectCheckPlatform?.enabled){
 try{let result=await ProjectCheckPlatform.signUp({email,password:pass,name,company,companyAddress,mobile,marketingConsent});if(!result.session){alert('Account created. Check your business email to confirm the account, then sign in.');if(embedded)route('signin');else showPanel('signin');return}let remote=await ProjectCheckPlatform.hydrateState();state.user=remote.user;state.users=remote.users;state.projects=remote.projects;save();closeAuthModal(d,previousBodyOverflow);syncAuth();route('dashboard')}catch(e){alert(e.message||'Account creation failed.')}
 return;
}
let salt=randomSaltHex(),u={id:crypto.randomUUID(),email,name,company,companyAddress,mobile,salt,passHash:await hashPassword(pass,salt),termsAcceptedAt:now(),marketingConsent};
state.users.push(u);state.user={id:u.id,email:u.email};save();closeAuthModal(d,previousBodyOverflow);syncAuth();route('dashboard')};
}
// Full Business Terms & Conditions — Draft 5 (27 August 2026, Architect + SPA
// controlled legal-document update). This array (and termsPage() below) IS
// the authoritative source-of-truth document — there is no separate external
// file in this repository; the customer-facing page renders it directly, so
// the two can never drift apart. Draft 5 builds on the previous Draft 4
// (transcribed verbatim from "5. Project Check/11. Terms and Conditions/
// Project Check — Business Terms & Conditions — Draft 4.docx", 25 August
// 2026) — Draft 4's clause structure/wording is preserved throughout except
// where this update's own brief required a change (see CHANGELOG.md for the
// itemised list). Every [TO BE CONFIRMED]/[IF APPLICABLE]/liability-cap
// placeholder and the draft/legal-review status below are preserved exactly
// as supplied — do not fill them in or mark this final. STAGE 1 IS NOT
// LOCKED — clause 10.2 deliberately does not treat any particular question,
// question set or sequence as fixed; do not edit that clause to imply
// otherwise while Stuart's question-by-question Stage 1 review remains open.
const li=(items)=>`<ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul>`;
const ol=(items)=>`<ol>${items.map(x=>`<li>${x}</li>`).join('')}</ol>`;
const TERMS_SECTIONS=[
[1,'About Project Check','<p>1.1 Project Check is an independent project-assessment, risk-identification and project-support service for industrial building projects.</p><p>1.2 Project Check is intended to help businesses identify potential project issues earlier, gather relevant information and evidence, understand what requires further investigation and make better-informed decisions before and during an industrial building project.</p><p>1.3 Depending on the service being used, Project Check may provide:</p>'+li(['project questions and assessments','document review and analysis','preliminary plans and elevations','risk identification','recommended actions','project evidence records','Stage 1 and Stage 2 outputs','project-support services','review of developing project information','supplier identification and comparison','and access to protected supplier-payment arrangements'])+'<p>1.4 Project Check does not replace appropriately qualified professional advisers, contractors or statutory authorities.</p>'],
[2,'Business users only','<p>2.1 Project Check is provided exclusively for business use.</p><p>2.2 By creating an account, purchasing a service or using Project Check, you confirm that you are acting wholly or mainly for purposes relating to your trade, business, craft or profession and not as a consumer.</p><p>2.3 Where you use Project Check for a company or other organisation, you confirm that you have authority to act on its behalf.</p>'],
[3,'How Project Check assesses a project','<p>3.1 Project Check assesses available project information to identify potential risks, requirements, inconsistencies and matters requiring further investigation.</p><p>3.2 Project Check may use:</p>'+li(['information provided by you','documents uploaded by you','mapping and site information','third-party information',"Project Check's knowledge, rules and assessment systems",'automated analysis','and human review and relevant project experience'])+'<p>3.3 Project Check may identify matters that should subsequently be reviewed or determined by an appropriately qualified professional, contractor or statutory body.</p><p>3.4 Identification of a matter by Project Check is not itself formal professional certification, approval or statutory determination.</p><p>3.5 Depending on the project, the information Project Check reviews may relate to a number of different disciplines, including where applicable:</p>'+li(['planning','site constraints','building specification','supplier building information','structural information and structural reactions','foundations','civils','drainage','levels','surveys','ground/geotechnical information','utilities and services','Building Regulations and Building Control information','fire and access information','specialist layouts','quotations','and programme/project information'])+'<p>3.6 Project Check may identify a possible relationship, interface or dependency between different items of project information — for example, that structural information may be relevant to foundation information, or that a change in one project package may potentially affect another.</p><p>3.7 Identifying a possible interface or dependency is not, and must not be treated as, Project Check independently certifying structural adequacy, foundation adequacy, geotechnical suitability, drainage adequacy, Building Regulations compliance or any other professional design matter. Professional responsibility for those matters remains with the appropriately appointed party.</p><p>3.8 Reviewing information relating to a discipline listed in clause 3.5 does not make Project Check the appointed professional for that discipline.</p>'],
[4,'What Project Check does not do','<p>4.1 Unless expressly appointed under a separate written agreement, Project Check does not:</p>'+li(['approve or certify a building, site or design','provide structural, civil or geotechnical engineering certification','provide planning permission','provide Building Regulations approval','undertake Building Control functions','certify structural calculations','certify foundations or slabs','undertake physical site investigations or surveys','undertake topographical, drainage, utilities or geotechnical surveys','provide professional fire-engineering certification','guarantee regulatory compliance','guarantee planning approval','guarantee supplier performance','guarantee project cost or programme','or guarantee that every possible project risk has been identified'])+'<p>4.2 Project Check identifies and flags matters requiring attention. Where professional investigation, design, certification or statutory determination is required, that work must be undertaken by the appropriate competent person.</p><p>4.3 The absence of a Project Check warning does not mean that no project risk exists.</p>'],
[5,'Preliminary reports and drawings','<p>5.1 Unless expressly stated otherwise, Project Check reports, drawings, plans, elevations and other generated outputs are preliminary project-assessment information.</p><p>5.2 Preliminary drawings are not construction drawings.</p><p>5.3 Appropriate preliminary drawings will be identified:</p><p><b>PRELIMINARY — NOT FOR CONSTRUCTION</b></p><p>5.4 Project Check preliminary information must not be used as a substitute for final supplier, engineer, consultant or statutory design information required for construction.</p><p>5.5 Dimensions, levels, loads, ground conditions, structural requirements, boundaries, drainage, services and other material information must be appropriately verified before being relied upon for design, manufacture, procurement or construction.</p>'],
[6,'Information supplied by you','<p>6.1 Project Check relies on information supplied by you and by persons acting on your behalf.</p><p>6.2 You must use reasonable care to provide information that is accurate, complete and not misleading.</p><p>6.3 Where information is estimated, uncertain or incomplete, you should identify it accordingly.</p><p>6.4 You should update Project Check when material project information changes.</p><p>6.5 Project Check will not be responsible for an incorrect conclusion to the extent that it results directly from materially incorrect, incomplete or misleading information that Project Check could not reasonably have identified as incorrect.</p><p>6.6 Where you provide revised or updated project information, Project Check may compare it against earlier information already held and may identify matters such as:</p>'+li(['changed dimensions','changed assumptions','a changed status or revision','potential conflicts with other project information','information elsewhere in the project record that may have become out of date as a result','and matters that may require renewed professional review'])+'<p>6.7 Project Check does not guarantee that every revision, or every downstream consequence of a revision, will automatically be identified.</p>'],
[7,'Uploaded documents','<p>7.1 Project Check may receive information uploaded or otherwise supplied by you, by people acting for you, or — where relevant to the project — by suppliers, prospective suppliers, appointed consultants, professional advisers, contractors or other authorised project participants.</p><p>7.2 Uploaded or supplied material may include:</p>'+li(['drawings','CAD or PDF exports','surveys','calculations','reports','specifications','quotations','photographs','site information','structural reactions','foundation information','civils information','drainage information','correspondence','approval or authority documents','specialist layouts','supplier documents','revised or superseding project evidence','and other relevant project information'])+'<p>7.3 You confirm that you have the right or authority to provide those documents to Project Check for the purposes of the project, including where a document originates from, or relates to, a third party such as a supplier, consultant or contractor.</p><p>7.4 Ownership of source documents remains with you or the applicable third-party owner.</p><p>7.5 You grant Project Check permission to store, process, analyse and use those documents to the extent reasonably necessary to provide the Project Check service.</p><p>7.6 Where you ask Project Check to obtain supplier quotations or progress supplier discussions, you authorise Project Check to share project information reasonably necessary for that purpose with the relevant potential suppliers.</p>'],
[8,'Document status, provenance and evidence certainty','<p>8.1 The person who uploads a document is not necessarily the person who created or issued it (the <b>originator</b>), and uploading a document does not by itself establish that the uploader is its originator.</p><p>8.2 A document being uploaded to Project Check does not by itself establish that the document is approved, current, construction-ready, professionally certified or authority-approved.</p><p>8.3 Where reasonably possible, Project Check may seek to classify or assess uploaded information by reference to available evidence such as title blocks, document references, revision or status information, provenance, transmittals, authority decisions or professional confirmations. Project Check does not guarantee that this classification is complete or correct, and a customer should not rely on it in place of confirming document status directly with the relevant originator or authority.</p><p>8.4 Project Check may distinguish between information that is directly observed or stated in the evidence provided, information that is inferred from available evidence, and information that is confirmed by stronger documentary, professional or authority evidence.</p><p>8.5 Project Check does not represent an inference of this kind as professional certification, and a matter recorded as inferred or possible should not be treated as confirmed unless and until stronger evidence is obtained.</p>'],
[9,'How Project Check may analyse uploaded information','<p>9.1 As part of providing the service, Project Check may, where technically possible and appropriate, process uploaded evidence to:</p>'+li(['extract text','identify document metadata','identify drawing or document references','identify revision or status information','extract structured project facts','identify geometry or dimensions where technically supported','compare information against the existing project record','identify inconsistencies','identify potential missing information','identify possible dependencies between items of project information','identify potentially superseded information','and support the identification of risks and recommended actions'])+'<p>9.2 Project Check does not claim that every drawing or document can be automatically interpreted, and does not claim that automated drawing or geometry analysis is available for every document type or format.</p><p>9.3 Project Check’s current data-intelligence capability is under active development. Project Check does not currently represent that it:</p>'+li(['trains artificial-intelligence models on customer project information','permanently retains extracted project intelligence for reuse across other customers’ projects','anonymises and commercially reuses all uploaded information','automatically deletes source files once information has been extracted from them','operates a complete, general-purpose dependency-identification engine across every project discipline','operates a complete drawing-geometry extraction engine for every drawing type','or continuously monitors every revision to every item of project information without limitation'])+'<p>9.4 If Project Check later introduces a capability that retains or reuses information or intelligence derived from customer, supplier or professional evidence beyond the individual project it was provided for, Project Check will review and document the legal, confidentiality and data-protection basis for doing so — including purpose, lawful basis, transparency, de-identification, retention, data minimisation, customer/supplier rights and security — before that capability is introduced, and will update these Terms and the Privacy Notice accordingly where required.</p>'],
[10,'Stage 1 and Stage 2','<p>10.1 Project Check may support an evolving project record for an industrial building project across Stage 1 (free – shows the problems) and Stage 2 (paid – shows the solutions).</p><p>10.2 The precise functionality, questions and outputs available within each stage may develop and be reviewed as Project Check is improved. No particular question, question set or sequence within a stage is fixed or final, and Project Check may add, remove, reorder or reword questions or workflow steps from time to time.</p><p>10.3 Project Check may progressively assess and maintain project information as the project develops, rather than treating each stage as a one-off, disconnected exercise.</p><p>10.4 Any paid service will be identified before you incur a charge.</p>'],
[11,'Stage 2 Project Check Report and Assessment','<p>11.1 Stage 2 is a paid Project Check report and assessment service.</p><p>11.2 Before purchasing Stage 2, you may already have:</p>'+li(['supplied project information','answered Project Check questions','uploaded documents','and received earlier Project Check findings or outputs'])+'<p>11.3 Stage 2 provides further processing, assessment, analysis and generation of the applicable report and associated service.</p><p>11.4 Stage 2 is the paid stage of Project Check.</p><p>11.5 The precise scope and price of the Stage 2 service selected will be displayed before purchase.</p><p>11.6 The Stage 2 fee relates to Project Check’s report, assessment and associated service. It is not payment for a supplier introduction or building contract.</p>'],
[12,'Stage 2 payment and refunds','<p>12.1 Payment is required before substantive Stage 2 processing and report generation begins.</p><p>12.2 Once substantive Stage 2 assessment, processing or report generation has commenced, the Stage 2 fee is non-refundable.</p><p>12.3 This reflects the fact that Project Check has commenced providing the purchased service.</p><p>12.4 If Project Check is unable to provide the purchased Stage 2 service and the relevant substantive service has not been delivered, Project Check will provide an appropriate refund.</p><p>12.5 The Stage 2 fee is separate from any later supplier quotation, supplier appointment or building contract.</p><p>12.6 The Stage 2 fee is not refundable merely because:</p>'+li(['you choose not to proceed with a building','no supplier is appointed','you decide not to proceed with a supplier presented by Project Check','you appoint another supplier','or the project subsequently changes'])],
[13,'Supplier identification','<p>13.1 Where appropriate, Project Check may identify potential industrial building suppliers based on the project information available.</p><p>13.2 Project Check will normally seek to present <b>three suitable supplier options</b>.</p><p>13.3 There may be circumstances where fewer than three suitable options are reasonably available.</p><p>13.4 The final decision whether to progress with or appoint any supplier belongs to you.</p><p>13.5 Project Check does not guarantee that a supplier presented will:</p>'+li(['be the cheapest supplier available','accept the project','maintain an initial price indefinitely','meet every requirement without further development','obtain necessary approvals','remain financially solvent','or perform its contract without delay, defect or dispute'])+'<p>13.6 You remain entitled to undertake whatever commercial, financial, technical and legal due diligence you consider appropriate before appointing a supplier.</p>'],
[14,'Supplier relationships','<p>14.1 Project Check works with independent industrial building suppliers and may have separate commercial arrangements with suppliers participating in the Project Check supplier network.</p><p>14.2 Any supplier quotation presented to you will show the price offered for your project before you decide whether to proceed.</p><p>14.3 Project Check assesses potential suppliers against the requirements and information available for your project. A separate commercial relationship with a supplier does not alter Project Check’s project findings or the supplier’s responsibility for its own quotation and contract.</p><p>14.4 You remain free to decide whether to proceed with any supplier presented by Project Check.</p>'],
[15,'Supplier quotations and contracts','<p>15.1 Each supplier is responsible for its own quotation and contractual terms.</p><p>15.2 Supplier terms may cover matters including:</p>'+li(['scope','specification','exclusions','price','payment milestones','programme','detailed design','manufacturing','procurement','delivery','installation','warranties','snagging','and completion'])+'<p>15.3 Project Check does not impose a universal supplier payment schedule.</p><p>15.4 Payment arrangements will vary between suppliers and projects.</p><p>15.5 You must review and accept the selected supplier’s quotation and contract before proceeding.</p><p>15.6 Unless expressly agreed otherwise, the contract for the design, manufacture, supply and/or installation of the building will be between:</p><p><b>you and the selected supplier.</b></p><p>15.7 Project Check does not become the building supplier, manufacturer or contractor merely because it identified or introduced that supplier.</p>'],
[16,'Supplier price','<p>16.1 Before you decide whether to proceed, you will be shown the selected supplier’s proposed contract price and payment terms.</p><p>16.2 The supplier’s quotation or contract will identify the amount that you are being asked to pay for the project.</p><p>16.3 Any separate mandatory Project Check transaction-administration charge or third-party payment-provider charge payable by you will be disclosed before commitment.</p><p>16.4 No undisclosed mandatory charge will be added after you have accepted the applicable transaction terms.</p><p>16.5 Applicable VAT will be dealt with in accordance with the relevant supplier, Project Check and payment-provider documentation.</p>'],
[17,'Supplier payment milestones','<p>17.1 Supplier payment milestones are governed by the selected supplier’s contract.</p><p>17.2 Project Check does not represent that supplier contracts will follow any particular deposit, interim-payment or final-payment percentages.</p><p>17.3 Depending on the supplier and project, milestones may relate to matters including:</p>'+li(['supplier appointment','commencement of design','production information','engineering information','material procurement','manufacture','delivery','mobilisation','erection','completion','and snagging'])+'<p>17.4 The payment milestones that apply are those agreed in the selected supplier’s contract.</p>'],
[18,'Larger and more complex projects','<p>18.1 Some projects may involve a wider construction programme or separately appointed professional team.</p><p>18.2 This may include:</p>'+li(['a Quantity Surveyor','project manager','civil engineer','groundworks contractor','drainage works','utilities works','car parks','retaining structures','foundations','or other construction packages'])+'<p>18.3 Where those circumstances apply, the customer and its professional team may negotiate bespoke supplier payment arrangements and project milestones.</p><p>18.4 Project Check does not override properly agreed project-specific arrangements.</p><p>18.5 Where necessary, Project Check’s involvement in a larger or more complex project may also be documented separately.</p>'],
[19,'Protected Payment Service','<p>19.1 For certain supplier appointments, Project Check intends to offer a protected payment arrangement through an appropriately authorised, regulated or otherwise legally suitable third-party payment provider.</p><p>19.2 The exact form of the payment arrangement will depend upon the provider selected and the transaction structure.</p><p>19.3 Project Check will not describe a payment arrangement as regulated escrow unless that description is legally appropriate for the service being provided.</p><p>19.4 Before making the relevant payment, you will be told:</p>'+li(['the identity of the payment provider','the amount to be paid','any applicable payment-provider charge','the applicable release process','and any separate terms you must accept'])+'<p>19.5 Supplier-project funds handled through the payment provider are not treated as ordinary Project Check trading receipts merely because Project Check facilitates the transaction.</p>'],
[20,'First supplier payment','<p>20.1 Where the Protected Payment Service applies, the first payment required under the selected supplier’s contract will ordinarily be made through the applicable payment arrangement.</p><p>20.2 The amount of the first payment is determined by the supplier’s contract and is not fixed by Project Check.</p><p>20.3 Funds will be held, safeguarded, processed or released in accordance with the terms of the payment provider and the applicable supplier transaction.</p><p>20.4 Project Check does not intend routinely to receive the whole supplier payment into its ordinary operating account and then forward the supplier’s money itself.</p><p>20.5 Different arrangements may apply to unusual or larger projects where expressly documented.</p>'],
[21,'Five-Day Supplier Confirmation Period','<p>21.1 Where the Protected Payment Service applies, the first supplier payment will ordinarily be subject to a <b>5-Day Supplier Confirmation Period</b>.</p><p>21.2 The purpose of this period is to allow you and the selected supplier to communicate directly before the protected supplier payment is released.</p><p>21.3 During this period:</p>'+li(['you may speak directly with the supplier','the supplier may clarify its quotation, scope and working arrangements','Project Check may support those discussions where appropriate','protected supplier funds remain unreleased','and the supplier must not commence chargeable design, procurement or manufacturing work in reliance upon those unreleased funds'])+'<p>21.4 Direct communication between you and the selected supplier does not alter the contractual or commercial arrangements governing the Project Check introduction or supplier transaction.</p><p>21.5 The 5-Day Supplier Confirmation Period is a contractual business-to-business process and is not a statutory consumer cooling-off period.</p><p>21.6 Once you confirm that you wish to proceed and the applicable payment conditions have been satisfied, the protected supplier payment may be released.</p>'],
[22,'Deciding not to proceed during the Supplier Confirmation Period','<p>22.1 If you decide not to proceed with the selected supplier during the applicable Supplier Confirmation Period, unreleased supplier-project funds will be dealt with in accordance with the applicable supplier and payment-provider terms.</p><p>22.2 Any unavoidable non-refundable third-party transaction cost will be disclosed before the relevant payment is made.</p><p>22.3 The separate Stage 2 Project Check fee remains governed by clause 12.</p><p>22.4 Where appropriate, Project Check may continue helping you consider another supplier option.</p>'],
[23,'Subsequent supplier payments','<p>23.1 After the first payment process has completed, subsequent supplier payments are governed by the selected supplier’s contract.</p><p>23.2 Project Check does not require all future project payments to pass through Project Check.</p><p>23.3 Depending on the project, later payments may be made directly to the supplier or through another agreed mechanism.</p><p>23.4 The supplier remains responsible for satisfying the contractual requirements associated with its payment milestones.</p>'],
[24,'Project Check after supplier appointment','<p>24.1 Project Check’s involvement does not necessarily end when a supplier is appointed.</p><p>24.2 You may continue using Project Check as the project develops and additional information becomes available.</p><p>24.3 This may include:</p>'+li(['supplier drawings','elevations','structural reactions','engineering information','ground-investigation reports','topographical information','drainage information','utilities information','civils information','foundation information','slab information','revised project information','site discoveries','and other developing project evidence'])+'<p>24.4 Depending on the service available, Project Check may compare new information against the existing project record and identify:</p>'+li(['changed assumptions','inconsistencies','new risks','missing information','and matters requiring further professional or supplier action'])+'<p>24.5 As Project Support, Project Check may help you: maintain the project evidence record; identify new or revised information; identify apparent inconsistencies; understand outstanding actions or information; coordinate relevant project interfaces; and identify matters requiring supplier or professional attention.</p><p>24.6 Project Support does not automatically make Project Check your project manager, contract administrator, structural engineer, civil engineer, architect, Quantity Surveyor, Principal Designer, Principal Contractor or Building Control body, unless Project Check is separately appointed to that role under a legally appropriate written agreement.</p><p>24.7 Continued Project Check involvement does not make Project Check responsible for the selected supplier’s contractual obligations.</p>'],
[25,'Quantity Surveyors, project managers and professional advisers','<p>25.1 You may appoint your own Quantity Surveyor, project manager, engineer, architect or other professional adviser.</p><p>25.2 Project Check is intended to complement rather than replace properly appointed professionals.</p><p>25.3 Where a Quantity Surveyor, project manager or other professional is appointed, that person may take responsibility under their own appointment for matters such as:</p>'+li(['commercial management','payment assessment','programme management','package coordination','and contract administration'])+'<p>25.4 Project Check does not become the project’s Quantity Surveyor, contract administrator, engineer or project manager merely because it continues to review information relating to the project.</p><p>25.5 Project Check may work alongside your professional team and may receive or review information provided by them where authorised.</p>'],
[26,'Supplier responsibility','<p>26.1 The selected supplier remains responsible for the obligations it accepts under its own contract.</p><p>26.2 Depending upon that contract, those responsibilities may include:</p>'+li(['detailed design','engineering','production drawings','elevation drawings','structural reactions','material procurement','manufacture','delivery','erection','installation','quality','snagging','warranties','and agreed compliance obligations'])+'<p>26.3 Project Check is not responsible merely because a supplier introduced through Project Check subsequently breaches its separate contract with you.</p><p>26.4 Nothing in these Terms removes responsibility for Project Check’s own acts or omissions where liability cannot lawfully be excluded.</p>'],
[27,'Transaction administration and payment-provider charges','<p>27.1 Project Check may charge a modest administration charge where it administers a protected supplier transaction.</p><p>27.2 A third-party payment provider may separately charge for its payment, safeguarding, escrow or release service.</p><p>27.3 Any charge payable by you will be shown before you commit to the transaction.</p><p>27.4 The final Project Check transaction-administration charging method will be confirmed before production launch.</p>'],
[28,'Human project support','<p>28.1 Certain Project Check services may include human project support.</p><p>28.2 Unless separately agreed in writing, that support forms part of the Project Check assessment and project-support service.</p><p>28.3 It does not constitute a separate appointment as:</p>'+li(['engineer','architect','Quantity Surveyor','project manager','contract administrator','Building Control body','or other regulated or professionally appointed consultant'])+'<p>28.4 Project Check may help you understand information, identify issues and determine appropriate next actions.</p><p>28.5 Where specialist professional judgement, certification or design responsibility is required, Project Check may recommend that you obtain the appropriate professional advice.</p>'],
[29,'Intellectual property','<p>29.1 Project Check owns or licenses the software, methodologies, assessment structures, rules, systems, branding, report structures and other intellectual property used to provide Project Check.</p><p>29.2 You retain ownership of material you upload, subject to any rights belonging to third parties.</p><p>29.3 You may use Project Check reports and outputs for the project for which they were created.</p><p>29.4 You may share relevant outputs with:</p>'+li(['employees','professional advisers','consultants','contractors','and prospective or appointed suppliers'])+'<p>29.5 Project Check’s underlying methodology, software or risk logic must not be reproduced, resold, reverse engineered or used to create a competing service without written permission.</p><p>29.6 Project Check’s right to process your uploaded material, including the structured analysis and extraction described in clause 9, is limited to providing the Project Check service for your project. It does not grant Project Check an unrestricted licence to commercially reuse identifiable customer or supplier proprietary material outside that project.</p>'],
[30,'Confidentiality','<p>30.1 Project Check will take reasonable measures to protect confidential project information provided to it.</p><p>30.2 Project information may be shared where reasonably necessary to:</p>'+li(['provide the Project Check service','obtain supplier quotations','progress an authorised supplier transaction','work with authorised professional advisers','operate necessary technology and payment services','or comply with legal obligations'])+'<p>30.3 Personal information is handled separately under the Project Check Privacy Notice.</p>'],
[31,'Data protection and privacy','<p>31.1 Project Check will process personal information in accordance with applicable UK data-protection law.</p><p>31.2 The Project Check Privacy Notice will explain:</p>'+li(['what information is collected','why it is processed','applicable lawful bases','relevant recipients','retention','security','individual rights','and deletion requests'])+'<p>31.3 Project Check will maintain an appropriate process for valid requests for erasure of personal data, subject to any lawful retention requirements.</p>'],
[32,'Third-party systems and information','<p>32.1 Project Check may rely on third-party systems and information including:</p>'+li(['maps','satellite or aerial imagery','location services','payment providers','hosting providers','and external datasets'])+'<p>32.2 Third-party systems or information may occasionally be unavailable, incomplete or inaccurate.</p><p>32.3 Project Check does not guarantee the accuracy or continuous availability of third-party services.</p><p>32.4 Material project information should be independently verified where appropriate.</p>'],
[33,'Service availability','<p>33.1 Project Check will use reasonable efforts to provide its services reliably.</p><p>33.2 Project Check does not guarantee uninterrupted or error-free availability.</p><p>33.3 Services may temporarily be unavailable because of maintenance, upgrades, technical failures, security requirements, third-party outages or circumstances outside Project Check’s reasonable control.</p>'],
[34,'Liability','<p>34.1 Nothing in these Terms excludes or limits liability where doing so would be unlawful.</p><p>34.2 In particular, nothing excludes liability for:</p>'+li(['death or personal injury caused by negligence','fraud','fraudulent misrepresentation','or another liability that cannot lawfully be excluded'])+'<p>34.3 Subject to applicable law, Project Check will not be liable for indirect or consequential business losses including:</p>'+li(['loss of profit','loss of revenue','loss of business opportunity','or loss of anticipated savings'])+'<p>34.4 Project Check will not be liable for loss resulting directly from a decision to proceed contrary to an express Project Check recommendation that further professional investigation or verification is required.</p><p>34.5 Project Check will not be responsible for loss caused directly by materially incorrect information supplied by you where Project Check could not reasonably have identified that information as incorrect.</p><p>34.6 Project Check does not accept responsibility for a selected supplier’s independent contractual performance merely because that supplier was identified or introduced through Project Check.</p><p>34.7 Project Check remains responsible for its own contractual obligations subject to limitations permitted by law.</p><p>34.8 Project Check’s aggregate financial liability cap will be inserted after confirmation of:</p>'+li(['insurance arrangements','service exposure','supplier-transaction exposure','and external legal advice'])+'<p><b>[FINAL LIABILITY CAP TO BE INSERTED BEFORE PRODUCTION LAUNCH]</b></p>'],
[35,'Insurance','<p>35.1 Project Check’s insurance arrangements are to be confirmed before production launch.</p><p>35.2 Project Check will not make representations about insurance protection that has not actually been placed and verified.</p>'],
[36,'Accounts and security','<p>36.1 You are responsible for keeping your account credentials secure.</p><p>36.2 You should notify Project Check promptly if you believe your account has been accessed without authority.</p><p>36.3 Project Check will take reasonable technical and organisational measures to protect its systems and information.</p>'],
[37,'Suspension and termination','<p>37.1 Project Check may suspend or terminate access where:</p>'+li(['these Terms are materially breached','fraud or unlawful activity is reasonably suspected','continued use creates a material security or regulatory risk','properly due Project Check fees remain unpaid','or Project Check is legally required to act'])+'<p>37.2 Termination of Project Check access does not automatically terminate a separate contract already entered into between you and a supplier.</p><p>37.3 Rights and payment obligations arising before termination continue where applicable.</p>'],
[38,'Complaints','<p>38.1 Complaints concerning Project Check services should be raised directly with Project Check.</p><p>38.2 Project Check will investigate and respond within a reasonable period.</p><p>38.3 Complaints concerning a supplier’s design, manufacture, installation or contractual performance should ordinarily be addressed under that supplier’s contract.</p><p>38.4 Project Check may assist you in understanding or documenting an issue without thereby accepting responsibility for resolving the supplier’s contractual dispute.</p>'],
[39,'Relationship between the parties','<p>39.1 Nothing in these Terms creates a partnership or joint venture between you and Project Check.</p><p>39.2 Project Check does not become your engineer, architect, Quantity Surveyor, contract administrator, principal contractor or project manager unless separately appointed in writing for a specifically defined service.</p><p>39.3 Project Check may have separate commercial arrangements with suppliers participating in the Project Check supplier network.</p><p>39.4 Those arrangements are governed separately and do not make Project Check responsible for the supplier’s contractual performance.</p>'],
[40,'Changes to these Terms','<p>40.1 Each production version of these Terms will have an effective date and version number.</p><p>40.2 Project Check may amend these Terms where reasonably necessary.</p><p>40.3 Material changes affecting an ongoing paid service will be communicated appropriately.</p><p>40.4 Updated Terms will not retrospectively rewrite a completed transaction.</p><p>40.5 Project Check may retain evidence of the Terms version accepted for a relevant service or transaction.</p>'],
[41,'Acceptance and electronic records','<p>41.1 Before purchasing a paid Project Check service, you will be required to affirmatively accept the applicable Terms.</p><p>41.2 Project Check may retain an electronic record showing:</p>'+li(['the Terms version accepted','date and time of acceptance','relevant business or account identity','and associated project or transaction information'])+'<p>41.3 A supplier transaction may separately require acceptance of:</p>'+li(['the supplier quotation','supplier contract','supplier payment schedule','Protected Payment terms','and payment-provider terms'])],
[42,'Entire agreement','<p>42.1 These Terms, together with the applicable Project Check service description and any expressly incorporated transaction-specific terms, constitute the agreement for the relevant Project Check service.</p><p>42.2 The selected supplier’s contract is a separate agreement between you and that supplier.</p><p>42.3 Nothing in this clause limits liability for fraud or fraudulent misrepresentation.</p>'],
[43,'Severability and waiver','<p>43.1 If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will continue to apply.</p><p>43.2 A failure or delay in enforcing a contractual right does not automatically waive that right.</p>'],
[44,'Third-party rights','<p>44.1 Unless expressly stated otherwise, a person who is not a party to the relevant Project Check agreement has no right to enforce these Terms under the Contracts (Rights of Third Parties) Act 1999.</p>'],
[45,'Governing law and jurisdiction','<p>45.1 These Terms are intended to be governed by the laws of England and Wales.</p><p>45.2 Subject to confirmation of the final Project Check legal entity and formal legal review, the courts of England and Wales will have exclusive jurisdiction.</p>'],
[46,'Project Check legal details','<p>The following information must be completed before production launch:</p><p><b>Legal entity:</b> [TO BE CONFIRMED]<br><b>Trading name:</b> Project Check<br><b>Company number:</b> [TO BE CONFIRMED]<br><b>Registered office:</b> [TO BE CONFIRMED]<br><b>Country of registration:</b> [TO BE CONFIRMED]<br><b>VAT number:</b> [IF APPLICABLE]<br><b>Contact email:</b> [TO BE CONFIRMED]<br><b>Telephone:</b> [TO BE CONFIRMED]</p>'],
[47,'Required work before production launch','<p>Before these Terms are issued as final production Terms, Project Check must confirm:</p>'+ol(["Project Check’s operating legal entity",'VAT registration and accounting treatment','final Stage 2 service definition','the separate Project Check Supplier Agreement','supplier introduction and non-circumvention protection','supplier commercial arrangements','the protected-payment provider and legal payment structure','FCA/payment-services treatment','payment-provider charges','any Project Check transaction-administration charge','treatment of unusual or QS-managed larger projects','Project Check insurance',"Project Check’s liability cap",'the final Privacy Notice','data-retention and erasure procedures','the legal/privacy review required before any future cross-project data-intelligence or evidence-reuse capability (see clause 9.4) is introduced','and independent review and approval by an appropriately qualified UK solicitor'])+'<p><b>END OF DRAFT</b></p>']
];
function termsPage(){
app.innerHTML=`<div class="container"><div class="pagehead"><div><div class="eyebrow">Legal</div><h1>Project Check — Business Terms &amp; Conditions</h1><p class="meta">Version: Draft 5 · Date: 27 August 2026</p></div></div>
<div class="banner"><b>Status: DRAFT — REQUIRES FORMAL INDEPENDENT LEGAL REVIEW BEFORE PUBLIC PRODUCTION LAUNCH.</b><div class="meta" style="margin-top:6px">These Terms govern business use of Project Check. Project Check's final legal entity, company registration details, registered office, VAT details, insurance arrangements and payment-provider details will be inserted once formally confirmed. Stage 1 (and the other stages described below) reflects Project Check's current direction and remains under active review — see clause 10.2.</div></div>
${TERMS_SECTIONS.map(([n,title,body])=>`<div class="card legal-doc"><h2>${n}. ${title}</h2>${body}</div>`).join('')}</div>`}
// Full Privacy Policy — Draft 3 (27 August 2026, Architect + SPA controlled
// legal-document update). This array (and privacyPage() below) IS the
// authoritative source-of-truth document — there is no separate external
// file in this repository; the customer-facing page renders it directly.
// Draft 3 builds on Draft 2 (transcribed verbatim from "5. Project Check/12.
// Privacy Policy/Project Check Privacy Policy.docx", 25 August 2026) — Draft
// 2's structure/wording is preserved throughout except where this update's
// own brief required a change (see CHANGELOG.md). This is a separate
// document from TERMS_SECTIONS above — Terms & Conditions and the Privacy
// Policy are deliberately not combined.
// Every bracketed placeholder ([PROJECT CHECK LEGAL ENTITY / TRADING NAME]
// etc.), the prototype/local-storage accuracy wording, the "not yet
// implemented"/"not claimed" statements and the draft/legal-review status
// are preserved exactly as supplied — do not fill them in or mark this final.
const PRIVACY_SECTIONS=[
[1,'About this Privacy Policy','<p>This Privacy Policy explains how Project Check collects, uses, stores and shares personal information when you use the Project Check website, create an account, complete a project assessment, upload project information or evidence, purchase a Project Check service, request support, or ask us to help progress your project with a supplier.</p><p>Project Check is currently operating as a prototype/review build. The way information is stored in this prototype is materially different from the intended public production service. This is explained below.</p><p>The data controller for the production Project Check service will be:</p><p><b>[PROJECT CHECK LEGAL ENTITY / TRADING NAME]<br>[REGISTERED OR BUSINESS ADDRESS]<br>[PRIVACY CONTACT EMAIL]</b></p><p>These details must be completed and legally reviewed before public production launch.</p>'],
[2,'Who this notice applies to','<p>This notice applies to individuals whose personal information Project Check may process in connection with a business project, including:</p>'+li(['individuals using Project Check on behalf of a business customer','individuals working for or acting on behalf of a supplier or prospective supplier','consultants, engineers, contractors and other professional advisers involved in a project','and other individuals identified in project information or correspondence provided to Project Check'])+'<p>Project Check is a business-to-business service. It is not aimed at, and does not knowingly collect information directly from, individual consumers acting in a personal capacity.</p>'],
[3,'Information we collect','<p>Depending on how you use Project Check, we may collect or process:</p>'+li(['your name','business or organisation','role or position','email address','mobile telephone number','account details','assessment answers','project and site information','map or site selections','project geometry','uploaded files and evidence','drawings','quotations','supplier or professional information','correspondence and support information','activity or progress information, where the system records it','and other technical or project information that may incidentally contain personal data'])+'<p>We will only collect information that is reasonably required to provide, operate, improve, secure or administer the relevant Project Check service.</p>'],
[4,'How this prototype/review build stores information','<p><b>The current Project Check prototype/review build does not use the intended production account, database or file-storage architecture.</b></p><p>Account details, project answers and uploaded-file metadata are currently stored only within your own browser’s local storage on the device you use.</p><p>They are not currently stored in a Project Check production server or cloud database.</p><p>The production Project Check service will move authentication, account storage, project data and file handling to appropriate server-side systems before public launch.</p><p>The production infrastructure, processors, security controls, retention arrangements and international data-transfer position must be confirmed and reflected in this Privacy Policy before launch.</p><p>You should not treat this prototype/review build as production-grade data storage or security.</p>'],
[5,'Uploaded documents may contain other people’s personal data','<p>Business project files that you or others upload to Project Check may contain names, contact information or other personal data relating to people such as suppliers, consultants, engineers, employees, contractors or other project contacts.</p><p>If you upload or authorise the upload of a document that contains another person’s personal data, you confirm that you have an appropriate basis and authority to provide that information to Project Check for the purposes of the project.</p><p>Where Project Check becomes aware that uploaded material contains personal data relating to a third party, that data is handled in accordance with this Privacy Policy in the same way as other personal data described here.</p>'],
[6,'How uploaded information may be processed','<p>Where technically possible and appropriate, uploaded information may be read, parsed, analysed, classified, structured and compared in order to:</p>'+li(['identify project facts','identify revisions or status information','identify inconsistencies or dependencies','and generate Project Check outputs such as reports, findings and recommended actions'])+'<p>Project Check does not claim that every uploaded drawing or document is automatically understood, and processing capability varies by document type and format. Further detail on how Project Check may analyse project information is set out in the Project Check Terms &amp; Conditions.</p>'],
[7,'Why we use your information','<p>We may use your information to:</p>'+li(['create and operate your Project Check account','provide the Stage 1 assessment','provide the Stage 2 solutions report and associated project outputs','generate Project Check reports, drawings and other project outputs','respond to information, evidence or documents you submit','review project evidence you or others provide','provide support that you request','administer purchases of Project Check services','maintain appropriate transaction and customer-service records','identify potential project issues, risks, information gaps and possible next steps','help identify appropriate suppliers where this forms part of a service you request','facilitate supplier introductions or quotation requests where you ask us to do so','support supplier, customer and project interfaces where relevant','progress your project following your instructions','communicate with you about your account or project','protect the security and integrity of Project Check and prevent fraud','deal with complaints, disputes or legal claims','comply with legal and regulatory requirements','improve and administer the service where this is lawful and appropriately governed','and send marketing communications where we are legally permitted to do so'])+'<p>Using Project Check does not make Project Check the supplier or contractor for your building project merely because we assess your project, identify possible solutions, introduce suppliers or assist with quotation requests.</p><p>Where you later enter into a contract with a supplier, that supplier’s quotation, contract and terms govern the goods, works or services that supplier provides.</p>'],
[8,'Our lawful bases for using personal information','<p>The lawful basis will depend on why we are using your information.</p><p>Our intended production bases may include:</p><p><b>Contract</b> — where processing is necessary to provide a Project Check service you have requested or purchased, operate your account, respond to your service request or take steps at your request before entering into a contract.</p><p><b>Legitimate interests</b> — where reasonably necessary for legitimate business purposes such as administering Project Check, maintaining appropriate project and transaction records, improving the service, protecting the platform, preventing misuse and managing or defending legal claims, provided those interests are not overridden by your rights and interests.</p><p><b>Legal obligation</b> — where we need to retain, use or disclose information to comply with applicable law, regulation, taxation, accounting or other legal obligations.</p><p><b>Consent</b> — where we specifically ask for consent and consent is the appropriate lawful basis, including certain marketing activities.</p><p>The exact lawful-basis mapping must be reviewed against the final production system and customer journey before public launch.</p>'],
[9,'Service and project communications','<p>We may contact you where necessary in connection with:</p>'+li(['your Project Check account','an assessment you have started or completed','information or evidence you have submitted','a Project Check service you have requested or purchased','support you have requested','a supplier introduction or quotation process you have asked us to progress','security or important service information','or your existing Project Check project'])+'<p>These communications are service or project communications and are separate from optional marketing communications.</p>'],
[10,'Marketing communications','<p>Marketing is separate from accepting the Project Check Terms &amp; Conditions and separate from the communications required to provide the Project Check service.</p><p>Where consent is required for marketing, we will ask for it separately. Marketing consent will not be a condition of using Project Check.</p><p>You can withdraw marketing consent or unsubscribe from marketing communications at any time.</p><p>Where applicable law permits marketing without consent in specific circumstances, Project Check will still provide the required opportunity to opt out.</p><p>Project Check must comply with applicable UK data-protection and electronic-marketing requirements when operating the production service.</p>'],
[11,'Sharing information with suppliers','<p>Project Check is supplier-independent.</p><p>We do not sell your personal information to suppliers or provide suppliers with a general Project Check customer database.</p><p>Where you ask Project Check to obtain, facilitate or progress a supplier quotation or other supplier solution for your project, we may provide the relevant supplier with information reasonably required for that purpose.</p><p>Depending on the project, this may include:</p>'+li(['your name and relevant contact information','your company or organisation','project and site information','assessment information','building requirements','Project Check reports or drawings','and photographs, plans, documents or other project evidence that is relevant to the quotation or solution being requested'])+'<p>We will not treat a request for one supplier quotation as permission for unrelated suppliers to market to you.</p><p>Once information has been provided to a supplier for the requested purpose, that supplier may process relevant personal information for its own quotation, contracting, project-delivery, legal and administrative purposes.</p><p>Where it determines its own purposes and means of processing, the supplier may act as a separate data controller and should provide its own privacy information.</p><p>A supplier’s handling of personal information under its own contract and systems is separate from Project Check’s handling of that information.</p>'],
[12,'Other organisations we may share information with','<p>In the production service, Project Check may also need to use trusted third-party service providers for functions such as:</p>'+li(['website and application hosting','database and file storage','account authentication','email, SMS or communications','mapping and location services','payment processing','security and monitoring','customer support','document or report generation','and professional, accounting or legal services'])+'<p>Where necessary, potential recipients of information may also include authorised suppliers, professional advisers, consultants, contractors, and statutory or legal authorities where required by law.</p><p>Sharing is limited to what is reasonably necessary for the purpose in question.</p><p>Where an organisation processes personal information on Project Check’s behalf, appropriate data-protection arrangements will be required.</p><p>We may also disclose information where required by law, a regulator, a court or other lawful authority, or where reasonably necessary to establish, exercise or defend legal rights.</p><p>The actual production providers and processing arrangements must be confirmed before public launch.</p>'],
[13,'Payments','<p>Where you purchase a Project Check service, information necessary to administer the transaction may be processed by Project Check and its payment provider.</p><p>Project Check intends to use an appropriate third-party payment provider rather than storing full payment-card details itself.</p><p>The final payment provider and exact payment-data flow must be confirmed before production launch and this Privacy Policy updated accordingly.</p><p>Payments that you later make directly to an independent building supplier under that supplier’s quotation or contract are separate from payments for Project Check’s own services and will normally be processed under the supplier’s own systems and privacy arrangements.</p>'],
[14,'Retention','<p>We aim to keep personal information only for as long as reasonably necessary for the purpose for which it was collected.</p><p>Different information may need to be retained for different periods, and project, legal, accounting, dispute or security obligations may require different retention periods for different categories of information.</p><p>Factors affecting retention may include:</p>'+li(['whether your Project Check account or project remains active','whether information is needed to provide a service you requested','transaction and accounting requirements','supplier-introduction or project records','complaint or dispute handling','security and fraud-prevention requirements','applicable limitation periods','and legal or regulatory obligations'])+'<p>Closing an account or requesting deletion does not necessarily mean that every record can immediately be deleted where Project Check has a lawful reason or legal obligation to retain particular information.</p><p>A formal production retention schedule must be established before public launch. Any future lightweight evidence-identity record (recorded internally as future architecture) is not represented as already implemented by this notice unless it is actually in production use.</p>'],
[15,'Your data-protection rights','<p>Depending on the circumstances and the lawful basis being used, UK data-protection law may give you rights including:</p>'+li(['the right to be informed about how your information is used','the right to request access to personal information held about you','the right to have inaccurate information corrected','the right to request erasure of personal information','the right to request restriction of processing','the right to object to certain processing','the right to data portability where applicable','and the right to withdraw consent where processing is based on consent'])+'<p>These rights are not all absolute and may not apply in every circumstance.</p><h3>Your right to object</h3><p><b>Where Project Check relies on legitimate interests, you may have the right to object to that processing. You also have the right to object to the use of your personal information for direct marketing.</b></p>'],
[16,'Erasure — your right to be forgotten','<p>You may ask Project Check to delete personal information held about you.</p><p>The right to erasure is not absolute. Project Check may need to retain certain information where there is a lawful reason to do so, including where retention is required by law or is necessary for the establishment, exercise or defence of legal claims.</p><p><b>Prototype status: an automated data-erasure/request feature is not currently implemented in this prototype/review build.</b></p><p>To make a request during the prototype/review period, contact Project Check directly.</p><p>Do not assume that submitting information through the prototype automatically creates or completes a deletion request. Project Check does not promise instant deletion.</p><p><b>An operational deletion workflow is REQUIRED PRE-LAUNCH.</b></p>'],
[17,'International transfers','<p>The current prototype does not represent the final production hosting or data-processing architecture.</p><p>Before production launch, Project Check must establish whether any personal information will be processed or accessed outside the United Kingdom and, where applicable, ensure that appropriate lawful transfer mechanisms and safeguards are in place.</p><p>This Privacy Policy must then be updated to explain those arrangements.</p>'],
[18,'Security','<p>Project Check aims to use appropriate technical and organisational measures to protect personal information.</p><p>As part of the pre-launch compliance programme, Project Check intends to complete a formal security-readiness review and is targeting Cyber Essentials certification at the standard level.</p><p><b>Cyber Essentials certification is a target/pre-launch requirement — it has not been claimed by this prototype unless and until certification has actually been achieved.</b></p><p>The current prototype/review build should not be treated as having production-grade security.</p><p>Production Project Check must implement appropriate authentication, access controls, data storage, backup, security monitoring and other safeguards before public launch.</p>'],
[19,'Cookies, analytics and similar technologies','<p>The final production website may use technologies necessary for operation, security, authentication or user preferences and may later use analytics or other optional technologies.</p><p>Any use of cookies, analytics or similar technologies must be reviewed against applicable UK requirements before production launch.</p><p>Where consent is legally required, those technologies must not be activated until the appropriate consent has been obtained.</p><p>A separate Cookie Notice or consent mechanism will be implemented where required.</p>'],
[20,'Automated analysis and AI-assisted processing','<p>Project Check may use automated analysis, rules-based logic and AI-assisted processing to help analyse project evidence, identify project facts and support the outputs described in this notice.</p><p>Project Check does not use wholly automated processing to make legal or engineering decisions about you or your project without human involvement. Project Check outputs may require human or professional verification before being relied upon, and Project Check does not claim otherwise.</p>'],
[21,'Cross-project learning and future data intelligence','<p><b>Project Check does not currently operate broad cross-project learning from customer, supplier or professional evidence.</b> Data-intelligence capabilities beyond the individual project (sometimes referred to internally as DI-01 to DI-06) have been recorded as future architecture and are not all fully implemented production capabilities today.</p><p>Before Project Check introduces any future capability that retains or reuses knowledge derived from customer, supplier or professional evidence beyond the individual project it was provided for, Project Check must determine and document:</p>'+li(['the purpose of the processing','the lawful basis','how it will be made transparent to affected individuals and businesses','the anonymisation or de-identification approach','confidentiality and intellectual-property treatment','retention','data minimisation','the data-subject and customer/supplier rights implications','security','and whether this Privacy Policy or the Terms &amp; Conditions require updating'])+'<p>That review must take place, and any resulting update to this notice must be made, before such a capability is introduced or used.</p>'],
[22,'Changes to this Privacy Policy','<p>Project Check may update this Privacy Policy as the service develops, the production technology changes, new services are introduced or legal and regulatory requirements change.</p><p>The current version and its effective or last-updated date should be displayed on the Project Check website.</p><p>Where a change materially affects how personal information is used, Project Check will take appropriate steps to bring that change to users’ attention.</p>'],
[23,'Contacting Project Check','<p>For questions about this Privacy Policy, the use of your personal information or to exercise a data-protection right, contact:</p><p><b>[PROJECT CHECK PRIVACY CONTACT]<br>[EMAIL ADDRESS]<br>[POSTAL ADDRESS IF REQUIRED]</b></p><p>These details must be completed before public production launch.</p>'],
[24,'Complaints','<p>If you are unhappy with how Project Check has handled your personal information, please contact Project Check first so that we have an opportunity to investigate.</p><p>You also have the right to complain to the UK Information Commissioner’s Office (ICO).</p><p><b>Information about making a complaint is available from the ICO at www.ico.org.uk.</b></p><p>Whether Project Check has completed the ICO data-protection fee assessment/registration remains a <b>PRE-LAUNCH action</b> unless and until evidence confirms it has actually been completed.</p>'],
[25,'Pre-launch compliance status','<p><b>This Privacy Policy remains a draft and must not be treated as final legal approval for the public production service.</b></p><p>Before public production launch, Project Check must complete the relevant privacy and data-protection compliance work, including confirming:</p>'+li(['the legal identity of the Project Check data controller','controller and privacy contact details','the final production data architecture','the categories of personal information actually collected','the lawful basis for each processing activity','supplier and third-party data-sharing arrangements','production processors and contracts','payment processing arrangements','retention periods','data-subject rights procedures','deletion/erasure procedures','international-transfer arrangements where applicable','cookie and analytics arrangements','security controls','whether the UK ICO data-protection fee applies and, if required, registration/payment','Cyber Essentials readiness/certification work','the legal/privacy review described in clause 21 before any future cross-project data-intelligence capability is introduced','and final specialist UK legal/data-protection review'])+'<p><b>Status: DRAFT — requires legal review before public production launch.</b></p>']
];
function privacyPage(){
app.innerHTML=`<div class="container"><div class="pagehead"><div><div class="eyebrow">Legal</div><h1>Project Check Privacy Policy</h1><p class="meta">Version: Draft 3 · Last updated: 27 August 2026</p></div></div>
<div class="banner"><b>Status: DRAFT — requires legal review before public production launch.</b><div class="meta" style="margin-top:6px">This Privacy Policy explains how Project Check collects, uses, stores and shares personal information. It is a separate document from the Terms &amp; Conditions.</div></div>
${PRIVACY_SECTIONS.map(([n,title,body])=>`<div class="card legal-doc"><h2>${n}. ${title}</h2>${body}</div>`).join('')}</div>`}
function logout(){
  if(stage1ReviewRequested){
    sessionStorage.removeItem(STAGE1_REVIEW_KEY);
    const url=new URL(location.href);
    url.searchParams.delete('menu-preview');
    url.hash='';
    location.replace(url);
    return;
  }
  if(window.ProjectCheckPlatform?.enabled)ProjectCheckPlatform.signOut().catch(e=>console.error('Project Check: sign out failed',e));
  state.user=null;state.users=[];state.projects=[];save();syncAuth();route('home');
}
function requireUser(){if(!state.user){authModal();return false}return true}
function myProjects(){return state.projects.filter(p=>p.owner===state.user?.id)}
function firstProject(){return myProjects()[0]||null}
function pct(p){if(p.stage2Complete)return 85;if(p.stage1Complete)return 50;return 20}
function stage1Status(p){if(p.stage1Complete)return "Stage 1 complete";return "Stage 1 not started"}
const PROJECT_ROOF_PITCH_MIN=5;
const PROJECT_ROOF_PITCH_MAX=22;
const PROJECT_ROOF_PITCH_DEFAULT=10;
const BUILDING_USE_OPTIONS=["Warehousing and general storage","Distribution and logistics","Manufacturing or factory use","Workshop or vehicle repair","Vehicle or plant wash facility","Timber or materials storage","Food production or chilled storage","Spray room or process enclosure","Indoor sports or leisure use","Other industrial or commercial use"];
const BUILDING_TYPE_OPTIONS=["Free-standing building","Extension to an existing building","Building linked to existing premises","Loading or dispatch canopy","Covered loading bay","Service-yard canopy","Enclosed workshop or process building","Temporary or demountable building","Other building type"];
function projectFacts(p){if(!p.facts||typeof p.facts!=="object")p.facts={};if(p.facts.regsNation==="Northern Ireland")delete p.facts.regsNation;return p.facts}
function extractProjectPostcode(value){
 const match=String(value||"").toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
 return match?match[1].replace(/\s+/g," ").replace(/^(.*?)(\d[A-Z]{2})$/,(_,outward,inward)=>outward.trim()+" "+inward):""
}
function projectRoofPitch(p){let value=Number(projectFacts(p).roofPitch);return Number.isFinite(value)&&value>=PROJECT_ROOF_PITCH_MIN&&value<=PROJECT_ROOF_PITCH_MAX?value:PROJECT_ROOF_PITCH_DEFAULT}
function projectRidgeHeight(p,widthOverride,heightOverride,pitchOverride){
let facts=projectFacts(p),width=Number(widthOverride??facts.width),height=Number(heightOverride??facts.height),pitch=Number(pitchOverride??projectRoofPitch(p));
if(!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0||!Number.isFinite(pitch))return null;
return height+(width/2)*Math.tan(pitch*Math.PI/180)
}
function projectMeasure(value){let number=Number(value);return Number.isFinite(number)&&number>0?`${number} m`:"Not added"}
function projectOptionMarkup(options,current){
let values=current&&!options.includes(current)?[current,...options]:options;
return `<option value="">Select an option</option>${values.map(value=>`<option value="${esc(value)}" ${value===current?"selected":""}>${esc(value)}</option>`).join("")}`
}
function accountRecord(){return state.users.find(u=>u.id===state.user?.id)}
function customerBanner(buttons){return `<section class="customer-banner"><img src="assets/project-check-banner-logo.png" alt="Project Check — Know before you build."><div class="customer-banner-actions">${buttons}</div></section>`}
function dashboard(){
if(!requireUser())return;
const ps=myProjects(),u=accountRecord()||state.user,p=ps[0]||null;
const progress=item=>stage1WorkspaceReadiness(item);
const status=item=>item.stage1Complete?"Free check done":progress(item)>0?"Free check in progress":"Free check not started";
const nextStep=item=>item.stage1Complete?{label:"See your probable problems",route:"stage1Summary"}:{label:"Continue your free check",route:"stage1Workspace"};
const lastSaved=item=>{const dates=(item.history||[]).map(h=>Date.parse(h.at)).filter(Number.isFinite);return dates.length?`Last updated ${new Date(Math.max(...dates)).toLocaleDateString("en-GB")}`:""};
app.innerHTML=`<div class="container customer-area workspace-dashboard" data-customer-workspace>
<section class="workspace-progress card">
<div class="workspace-title-row"><div><div class="eyebrow">Your account</div><h1>My projects</h1><p class="workspace-stage">${p?"Welcome back":"Welcome"}, ${esc((u.name||"").split(" ")[0]||"there")}</p></div></div>
${p?`<h2 class="dashboard-active-name">${esc(p.name)}</h2><div class="stage-progress" aria-label="Free check progress: ${progress(p)} percent"><span style="width:${progress(p)}%"></span></div><div class="workspace-progress-label"><span>Free check · ${progress(p)}% done</span><strong>${status(p)}</strong></div>`:`<p class="meta">Your account is ready. Create your first project. You will need a project name, what the building is for and where it will go.</p><button class="btn secondary" onclick="newProject()">Create project</button>`}</section>
${p?`<section class="card dashboard-next"><div class="eyebrow">Your next step</div><h2>${nextStep(p).label}</h2><p>${p.stage1Complete?"Your free check is done. See the problems we think are likely for your project.":"Check your details, add any drawings you have, then see your probable problems."}</p><div class="simple-cta-row"><button class="btn green" onclick="route('${nextStep(p).route}','${p.id}')">${nextStep(p).label}</button>${callButton("btn secondary")}</div></section>`:""}
<section class="workspace-section"><div class="eyebrow">Your projects</div><div class="project-list">${ps.length?ps.map(function(item){return `<article class="project-summary card"><div><h2>${esc(item.name||"Untitled project")}</h2><p>${esc(item.address||"Site address not added")}</p><p class="meta">${lastSaved(item)}</p><p class="project-file-count">${(item.evidence||[]).length} document(s)</p></div><div class="project-summary-actions"><strong>${status(item)} · ${progress(item)}%</strong></div></article>`}).join(""):`<article class="project-summary project-summary-empty card"><div><h2>No projects yet</h2><p>Your first project will show here once you create it.</p></div><button class="btn green" onclick="newProject()">Create project</button></article>`}</div></section>
<details class="card dashboard-guide"><summary>How the free check works <span>View</span></summary><ol><li><strong>Check your details.</strong> Open your project and use Edit to change anything.</li><li><strong>Add any drawings you have.</strong> You can add them later if they are not ready.</li><li><strong>Place the building.</strong> Show where it will go on the site and mark the boundaries nearby.</li><li><strong>See your probable problems.</strong> We list them in plain words.</li></ol></details></div><footer class="home-footer"><img src="assets/project-check-banner-logo.png" alt="Project Check — Know before you build."><nav aria-label="Account footer"><button data-route="home">Home</button><button data-route="signin">Sign in</button></nav><span></span><div class="home-footer-legal"><div></div><small>© 2026 Project Check</small></div></footer>`;
}
function projectBriefModal(existingId,openUpload,embedded=false){
if(!requireUser())return;if(existingId)return route('projectDocuments',existingId);const account=accountRecord()||{};let d=document.createElement('div');d.className=embedded?'create-project-screen':'modal';
d.innerHTML=`<div class="card project-flow-modal"><div class="project-flow-head"><img src="assets/project-check-banner-logo.png" alt="Project Check — Know before you build."><button class="auth-close" id="npClose" aria-label="Close">&times;</button></div><div class="project-flow-intro"><div class="eyebrow">New project</div><h2>Tell us about your project</h2><p class="meta">Start with the main facts. You can add drawings after you create the project.</p></div>
<div id="briefFields"><div class="field"><label for="npName">Project name</label><input id="npName" placeholder="Enter your project name"></div><div class="field"><label for="npRole">Your role in this project</label><input id="npRole" placeholder="e.g. Managing Director, Facilities Manager or Project Manager"><p class="field-note">Use the role you have on this project. You can change it later.</p></div><div class="field"><label for="npUse">What will the building be used for?</label><select id="npUse"><option value="">Select building use</option><option>Warehousing and general storage</option><option>Distribution and logistics</option><option>Manufacturing or factory use</option><option>Workshop or vehicle repair</option><option>Vehicle or plant wash facility</option><option>Timber or materials storage</option><option>Food production or chilled storage</option><option>Spray room or process enclosure</option><option>Indoor sports or leisure use</option><option>Other industrial or commercial use</option></select></div><div class="field"><label for="npType">What type of building?</label><select id="npType"><option value="">Select building type</option><option>Free-standing building</option><option>Extension to an existing building</option><option>Building linked to existing premises</option><option>Loading or dispatch canopy</option><option>Covered loading bay</option><option>Service-yard canopy</option><option>Enclosed workshop or process building</option><option>Temporary or demountable building</option><option>Other building type</option></select></div><fieldset class="field project-address-choice"><legend>Is the proposed building at your company address?</legend><label><input type="radio" name="npSiteSame" value="yes"> Yes — use company address</label><label><input type="radio" name="npSiteSame" value="no"> No — enter a different site address</label><p class="field-note">Company address: ${esc(account.companyAddress||"Not added")}</p></fieldset><div class="field" id="npAddressField" hidden><label for="npAddress">Proposed building site address</label><input id="npAddress" autocomplete="street-address" placeholder="Enter the full proposed site address including postcode"><p class="field-note">This address is saved to this project and used for Site Layout.</p></div><div class="dimensions-grid"><div class="field"><label for="npLength">Length (m)</label><input id="npLength" type="number" min="0"></div><div class="field"><label for="npWidth">Width (m)</label><input id="npWidth" type="number" min="0"></div><div class="field"><label for="npHeight">Inside height needed (m)</label><input id="npHeight" type="number" min="0"></div></div></div>
<div class="actions"><button class="btn secondary" id="npCancel">Cancel</button><button class="btn green" id="npCreate">Create project</button></div></div>`;if(embedded){app.replaceChildren(d);const footer=document.createElement('footer');footer.className='home-footer';footer.innerHTML="<img src=\"assets/project-check-banner-logo.png\" alt=\"Project Check — Know before you build.\"><nav aria-label=\"Account footer\"><button data-route=\"home\">Home</button><button data-route=\"signin\">Sign in</button></nav><span></span><div class=\"home-footer-legal\"><div></div><small>© 2026 Project Check</small></div>";app.appendChild(footer)}else document.body.appendChild(d);
const close=()=>{if(embedded)route('dashboard');else d.remove()};d.querySelector('#npClose').onclick=close;d.querySelector('#npCancel').onclick=close;
const updateSiteAddressChoice=()=>{const choice=d.querySelector('input[name="npSiteSame"]:checked')?.value;d.querySelector('#npAddressField').hidden=choice!=="no"};
d.querySelectorAll('input[name="npSiteSame"]').forEach(input=>input.onchange=updateSiteAddressChoice);
d.querySelector('#npCreate').onclick=()=>{let name=d.querySelector('#npName').value.trim(),role=d.querySelector('#npRole').value.trim(),use=d.querySelector('#npUse').value,type=d.querySelector('#npType').value,siteChoice=d.querySelector('input[name="npSiteSame"]:checked')?.value;if(!name||!role||!use||!type||!siteChoice)return alert('Enter the project name, your role in this project, building use, building type and whether the site is your company address.');let address=siteChoice==='yes'?String(account.companyAddress||'').trim():d.querySelector('#npAddress').value.trim();if(siteChoice==='yes'&&!address)return alert('Your company address is not yet added. Choose "No" and enter the proposed building site address, or update your Profile first.');if(!address)return alert('Enter the proposed building site address.');let postcode=extractProjectPostcode(address);if(['npLength','npWidth','npHeight'].some(id=>{const v=d.querySelector('#'+id).value;return v!==''&&(!Number.isFinite(Number(v))||Number(v)<=0)}))return alert('Enter positive building dimensions, or leave unknown dimensions blank.');let p={id:crypto.randomUUID(),owner:state.user.id,name,address,postcode,status:'Active',stage:'Stage 1',created:now(),facts:{role,buildingUse:use,buildingType:type,length:d.querySelector('#npLength').value,width:d.querySelector('#npWidth').value,height:d.querySelector('#npHeight').value,roofPitch:String(PROJECT_ROOF_PITCH_DEFAULT)},stage2:{},evidence:[],quotes:[],supplierRequest:null,risks1:[],actions1:[],risks2:[],actions2:[],history:[{at:now(),text:'Project created'}],stage1Complete:false,stage2Complete:false,plan:null};state.projects.push(p);save();close();route('stage1Workspace',p.id)};
}
function newProject(){route('createProject')}
function uploadDrawings(id){route('projectDocuments',id)}
function profile(projectId){
if(!requireUser())return;
const u=accountRecord()||{},p=projectId?getP(projectId):firstProject();
app.innerHTML=`<div class="container customer-area profile-page">
<div class="customer-heading"><div><div class="eyebrow">Your account</div><h1>Your profile</h1><p class="meta">These details belong to your account. Each project keeps its own details.</p></div><div class="actions"><button class="btn secondary" onclick="route('dashboard')">My projects</button></div></div>
<section class="profile-identity card"><span class="profile-avatar">${esc((u.name||u.email||"P")[0].toUpperCase())}</span><div><h2>${esc(u.name||"Your profile")}</h2><p>${esc(u.company||"Company not added")}</p></div></section>
<section class="profile-card card"><div class="eyebrow">Your details</div><dl class="profile-details"><div><dt>Full name</dt><dd>${esc(u.name||"Not added")}</dd></div><div><dt>Company name</dt><dd>${esc(u.company||"Not added")}</dd></div><div><dt>Company address</dt><dd>${esc(u.companyAddress||"Not added")}</dd></div><div><dt>Business email</dt><dd>${esc(u.email||"Not added")} <span class="verified">Verified</span></dd></div><div><dt>Mobile number</dt><dd>${esc(u.mobile||"Not added")}</dd></div></dl><button class="btn green" onclick="route('profileEdit'${p?",'"+p.id+"'":""})">Edit profile</button></section>
<section class="profile-card card"><div class="eyebrow">Sign-in and password</div><div class="security-row"><div><h3>Email confirmed</h3><p>You sign in with your business email.</p></div><span class="verified">Confirmed</span></div><div class="security-row"><div><h3>Password</h3><p>We will email you a link to change your password.</p></div><button class="btn secondary" onclick="requestProfilePasswordReset()">Change password</button></div></section>
</div>`;
}
async function requestProfilePasswordReset(){
const u=accountRecord()||state.user;if(!u?.email)return alert('No verified business email is available.');
if(!window.ProjectCheckPlatform?.enabled)return alert('Secure password changes are unavailable.');
try{await ProjectCheckPlatform.requestPasswordReset(u.email);alert('A secure password-change link has been sent to your verified business email.')}catch(e){alert(e.message||'The password-change email could not be sent. Please try again.')}
}
function profileEdit(projectId){
if(!requireUser())return;
const u=accountRecord(),p=projectId?getP(projectId):firstProject();
if(!u)return route("profile",projectId);
const profileRoute=p?`route('profile','${p.id}')`:"route('profile')";
app.innerHTML=`<div class="container customer-area profile-page"><div class="customer-heading"><div><div class="eyebrow">Your account</div><h1>Edit your profile</h1><p class="meta">Change your name and company details.</p></div></div><section class="profile-card card"><div class="profile-form"><div class="field"><label for="pfName">Full name</label><input id="pfName" autocomplete="name" value="${esc(u.name||"")}"></div><div class="field"><label for="pfCompany">Company name</label><input id="pfCompany" autocomplete="organization" value="${esc(u.company||"")}"></div><div class="field"><label for="pfCompanyAddress">Company address</label><input id="pfCompanyAddress" autocomplete="street-address" value="${esc(u.companyAddress||"")}" placeholder="Enter your company address including postcode"></div><div class="field"><label for="pfEmail">Business email</label><input id="pfEmail" type="email" autocomplete="email" readonly aria-describedby="pfEmailHelp" value="${esc(u.email||"")}"><p class="field-note" id="pfEmailHelp">You sign in with this email, so it cannot be changed here.</p></div><div class="field"><label for="pfMobile">Mobile number</label><input id="pfMobile" type="tel" autocomplete="tel" value="${esc(u.mobile||"")}"></div></div><div class="actions"><button class="btn green" id="saveProfile">Save changes</button><button class="btn secondary" onclick="${profileRoute}">Cancel</button></div></section></div>`;
document.querySelector("#saveProfile").onclick=function(){
const name=pfName.value.trim(),company=pfCompany.value.trim(),companyAddress=pfCompanyAddress.value.trim(),mobile=pfMobile.value.trim();
if(!name||!company||!companyAddress||!mobile)return alert("Complete your full name, company name, company address and mobile number.");
Object.assign(u,{name,company,companyAddress,mobile});save();syncAuth();if(p)route("profile",p.id);else route("profile");
};
}
function getP(id){return state.projects.find(p=>p.id===id&&p.owner===state.user?.id)}
// Stage 1 free upload allowance is 2 files for the project, counted from
// evidence tagged with the stage it was actually uploaded during — so files
// added after Stage 1 completes (tagged with whatever stage was current then)
// don't count against it.
const STAGE1_UPLOAD_LIMIT=2;
function stage1EvidenceCount(p){return (p.evidence||[]).filter(e=>e.stage==='Stage 1').length}
// Per-stage upload allowance: 2 per stage per project, counted in p.uploads.{s1,s2}
// (lifetime count — removing/replacing a file never frees a slot). Stage 3 and later: no limit.
const UPLOAD_LIMIT=2;
const UPLOAD_LIMIT_MSG='The 2-upload limit for this stage has been reached. This does not block progression to the next stage.';
function uploadKey(stage){return stage==='Stage 1'?'s1':(typeof stage==='string'&&/^Stage (1 complete|2)/.test(stage))?'s2':null}
function uploadsUsed(p,stage){let k=uploadKey(stage);return k?((p.uploads&&p.uploads[k])||0):0}
function uploadsLabel(p,stage){return `Uploads (${Math.min(uploadsUsed(p,stage),UPLOAD_LIMIT)}/${UPLOAD_LIMIT})`}
// Single shared entry point for adding project evidence — used by the
// dashboard quick-upload, the project workspace "Project evidence" card and
// the Stage 1 site-evidence upload, so every upload location shares one
// store (p.evidence) and the same Stage 1 allowance rather than each
// building its own. Never removes/overwrites existing evidence.
//
// Evidence Intelligence Batch 1 + 1B (see EVIDENCE-INTELLIGENCE-SPEC.md and
// MASTER-SPEC.md § "Question, Evidence & Rule Development governance"):
// alongside the existing metadata-only record, every upload now has its
// real, extractable content read client-side (plain text directly; real PDF
// via pdf.js; real DOCX via a native unzip + DOMParser — see
// extractEvidenceText(), evidence.js, the single dispatcher for all three)
// and run through the stage-independent evidence ledger
// (buildProjectEvidenceLedger(), same file). This is purely additive and
// internal/dev-facing — upload limits, alerts, history text and every
// existing customer-visible behaviour of this function are unchanged.
// Nothing here pre-populates Stage 1, changes a customer answer, or creates
// a Stage 2/3 output; see the "evidenceLedger" internal review route in
// project() for how to inspect the result. async because file reading is
// asynchronous — every call site awaits this function (see
// dashboard()/project()/stage1's site-evidence panel/
// wireStage2EvidenceUpload()). extractEvidenceText() never throws (any
// failure becomes EXTRACTION_STATUS.EXTRACTION_FAILED), so a malformed
// upload can never abort this loop or crash the customer journey.
async function addEvidenceFiles(p,fileList,stage,historyPrefix){
let files=splitUnreadablePhotos(fileList);if(!files.length)return;
const uKey=uploadKey(stage);
if(uKey){
if(!p.uploads)p.uploads={s1:0,s2:0};
let room=UPLOAD_LIMIT-uploadsUsed(p,stage);
if(room<=0){alert(UPLOAD_LIMIT_MSG);return}
if(files.length>room){alert(UPLOAD_LIMIT_MSG+` Only the first ${room} file(s) were uploaded.`);files=files.slice(0,room)}
}
for(const f of files){
let entry={name:f.name,size:f.size,type:f.type,at:now(),stage,extractedText:null,extractionStatus:'UNSUPPORTED',extractionNote:''};
if(typeof extractEvidenceText==='function'){
let r=await extractEvidenceText(f);
entry.extractedText=r.text;entry.extractionStatus=r.status;entry.extractionNote=r.note||''
}
p.evidence.push(entry);if(uKey)p.uploads[uKey]=(p.uploads[uKey]||0)+1
}
p.history.push({at:now(),text:`${historyPrefix}: ${files.map(f=>f.name).join(', ')}`});
// Rebuild the stage-independent evidence ledger from every currently
// text-readable document on the project (see route('evidenceLedger', id) in
// project() for the internal/dev-only full inspection view), then the Stage 2
// findings derived from it (Batch 3 — restrained customer-facing summaries
// only, see stage2Summary()), then the Stage 3 actions derived from THOSE
// findings (Batch 4 — detailed customer-facing view gated on the existing
// p.plan entitlement, see stage3Actions()). Stage 1 evidence-assist (Batch 2)
// reads p.evidenceRecords directly and needs no separate rebuild call here.
if(typeof buildProjectEvidenceLedger==='function')buildProjectEvidenceLedger(p);
if(typeof buildStage2Findings==='function')buildStage2Findings(p);
if(typeof buildStage3Actions==='function')buildStage3Actions(p);
save()
}
function project(id){return stage1Workspace(id)}
function legacyProjectWorkspace(id){
if(!requireUser())return;let p=getP(id);if(!p)return route("dashboard");
const facts=projectFacts(p),pitch=projectRoofPitch(p),ridge=projectRidgeHeight(p);
app.innerHTML=`<div class="container project-page"><div class="pagehead"><div class="workspace-identity"><div><div class="eyebrow">Project workspace</div><h1>${esc(p.name)}</h1><p class="meta">${esc(p.address||"Address not yet confirmed")}${p.postcode?` · ${esc(p.postcode)}`:""}</p></div></div><button class="btn secondary project-settings-trigger" onclick="route('projectSettings','${p.id}')">Project Settings</button></div>
<section class="card project-details-card" aria-labelledby="projectDetailsTitle"><div class="project-details-head"><div><div class="eyebrow">Saved project information</div><h2 id="projectDetailsTitle">Project details</h2><p>Review the information supplied for this building at any time.</p></div><button class="btn secondary" onclick="route('projectSettings','${p.id}')">Edit project details</button></div><dl class="project-detail-grid"><div><dt>Building use</dt><dd>${esc(facts.buildingUse||"Not added")}</dd></div><div><dt>Building type</dt><dd>${esc(facts.buildingType||"Not added")}</dd></div><div class="project-detail-location"><dt>Building location</dt><dd>${esc(p.address||"Not added")}</dd></div><div><dt>Postcode</dt><dd>${esc(p.postcode||"Not added")}</dd></div><div><dt>Length</dt><dd>${projectMeasure(facts.length)}</dd></div><div><dt>Width</dt><dd>${projectMeasure(facts.width)}</dd></div><div><dt>Clear height needed</dt><dd>${projectMeasure(facts.height)}</dd></div><div><dt>Roof pitch</dt><dd>${pitch}°</dd><small>Permitted range 5°–22° · standard 10°</small></div><div class="project-detail-result"><dt>Calculated ridge height</dt><dd>${ridge===null?"Add width and clear height":`${ridge.toFixed(2)} m`}</dd><small>Clear height + roof rise at the selected pitch</small></div></dl></section>
<section class="project-position card"><div><div class="eyebrow">You are here</div><h2>${esc(stage1Status(p))}</h2><p>${p.stage1Complete?"Your first assessment is complete. Continue from the available project stages below.":"Your project has been created. Begin Stage 1 when you are ready."}</p></div><span class="pill">${esc(p.status||"Active")}</span></section>
<div class="grid4">
<div class="card stage1-entry-card" data-stage1-entry><span class="pill">Stage 1 ${p.stage1Complete?"complete":"ready"}</span><h3>Initial Project Check</h3><p>Building, site, use, access and the early checks.</p><button class="btn green" onclick="route('stage1Workspace','${p.id}')">${p.stage1Complete?"Review Stage 1":"Open Stage 1 workspace"}</button><p class="field-note">This control opens the Stage 1 workspace.</p></div>
<div class="card"><span class="pill blue">Stage 2 ${p.stage2Complete?"complete":p.stage1Complete?"available":"locked"}</span><h3>Deeper assessment</h3><p>Substrate, slab, surveys, planning, Building Regulations, fire and operational evidence.</p><button class="btn ${p.stage1Complete?"green":"secondary"}" ${p.stage1Complete?"":"disabled"} onclick="startStage2('${p.id}')">${p.stage2Complete?"Review Stage 2":"Open Stage 2"}</button></div>
<div class="card"><span class="pill">Stage 2</span><h3>Doors & drawing</h3><p>Review the preliminary drawing and reposition, add or remove doors.</p><button class="btn ${p.stage1Complete?"green":"secondary"}" ${p.stage1Complete?"":"disabled"} onclick="route('doors','${p.id}')">Review doors & drawing</button></div>
<div class="card"><span class="pill warn">Suppliers</span><h3>Quotations</h3><p>${p.quotes.length} quotation(s) recorded. ${p.supplierRequest?"Three-supplier request recorded.":"Request three suitable quotations after Stage 2."}</p><button class="btn" ${p.stage2Complete?"":"disabled"} onclick="route('quotes','${p.id}')">Supplier quotations</button></div>
</div>
<div class="grid3" style="margin-top:18px">
<div class="card"><h3>Reports</h3><div class="actions"><button class="btn" ${p.stage1Complete?"":"disabled"} onclick="downloadReport('${p.id}','s1')">Stage 1 PDF</button><button class="btn" ${p.stage2Complete?"":"disabled"} onclick="downloadReport('${p.id}','s2')">Stage 2 PDF</button></div></div>
<div class="card"><h3>Project Documents</h3><p class="meta">${(p.evidence||[]).length} document(s) recorded. Upload drawings, check revisions and keep the project document register together.</p><button class="btn secondary" onclick="route('projectDocuments','${p.id}')">Open Project Documents</button></div>
</div>
<div class="card" style="margin-top:20px"><h3>Project activity</h3><table><thead><tr><th>Date</th><th>Activity</th></tr></thead><tbody>${[...p.history].reverse().map(h=>`<tr><td>${new Date(h.at).toLocaleString()}</td><td>${esc(h.text)}</td></tr>`).join("")}</tbody></table></div></div>`;
}

function projectJourneyNav(p,current,returnRoute="stage1Workspace"){
const labels={overview:"Project overview",details:"Edit project details",documents:"Your documents",confirmation:"Project Summary",siteLayout:"Site Layout",buildingLayout:"Building Design"};
const label=labels[current]||"Project overview";
const backLabel=returnRoute==="stage1Confirm"?"Back to Project Summary":returnRoute==="siteLayout"?"Back to Site Layout":"Back to project overview";
let backControl;
if(current==="overview")backControl='<span aria-current="page">Project overview</span>';
else if(current==="documents")backControl=`<button class="btn secondary" onclick="returnFromProjectDocuments('${p.id}')">${backLabel}</button>`;
else backControl=`<button class="btn secondary" onclick="route('${returnRoute}','${p.id}')">${backLabel}</button>`;
return `<nav class="project-journey-nav" aria-label="Project navigation"><strong>${esc(p.name)}</strong><span>Stage 1 · ${label}</span><div>${backControl}</div></nav>`
}
const DOCUMENT_DISCIPLINES=["Architectural","Civils","Structural","Fire","Other"];
let projectDocumentFilter='All disciplines';
let projectEditFocus=null,projectEditReturnRoute="stage1Workspace",projectDocumentsReturnRoute="stage1Workspace";
function editProjectField(id,field,returnRoute="stage1Workspace"){
if(!getP(id))return;
projectEditFocus={id,field};
projectEditReturnRoute=returnRoute;
route('projectSettings',id);
}
function openProjectDocuments(id,returnRoute="stage1Workspace"){
if(!getP(id))return;
projectDocumentsReturnRoute=returnRoute;
route('projectDocuments',id)
}
function returnFromProjectDocuments(id){
const target=projectDocumentsReturnRoute||"stage1Workspace";
projectDocumentsReturnRoute="stage1Workspace";
route(target,id)
}

const PROJECT_STEEL_TEMPERATURE_OPTIONS=[
'Ambient working temperature — heated',
'Ambient storage — unheated',
'Other temperature requirement',
'Not sure yet'
];
const PROJECT_STEEL_BASE_OPTIONS=[
'Concrete slab or concrete hardstanding',
'Newly designed concrete base suitable for structure',
'Tarmac or asphalt',
'Hardcore or stone',
'Soil or grass',
'Mixed surfaces',
'Not sure'
];
const PROJECT_STEEL_REUSE_OPTIONS=[
'Yes — assess it for reuse',
'No — a new base is planned',
'Not sure'
];
const PROJECT_STEEL_EVIDENCE_OPTIONS=[
'Yes — upload them now',
'Yes — I will upload them later',
'No',
'Not sure'
];
// Linked / adjacent existing building (2026-11-18, Stuart). Optional, asked once
// in project details; a "Yes" answer adds the junction water-ingress card to
// the Stage 1 Free Report and PDF.
const PROJECT_ADJACENT_BUILDING_OPTIONS=[
'No — stands clear of other buildings',
'Yes — links or joins to an existing building',
'Yes — sits close to an existing building (within about 1 m)'
];
function projectAdjacentExistingBuilding(facts){return PROJECT_ADJACENT_BUILDING_OPTIONS.includes(facts?.adjacentExistingBuilding)?facts.adjacentExistingBuilding:''}
function projectAdjacentBuildingNeedsJunction(facts){return projectAdjacentExistingBuilding(facts).startsWith('Yes')}
function projectIsSteelFreeStanding(facts){
return facts?.buildingType==='Free-standing building'||(!facts?.buildingType&&facts?.structure==='Free-standing building')
}
function projectTemperatureCondition(facts){
if(facts?.temperatureCondition)return facts.temperatureCondition;
return ({Yes:'Ambient working temperature — heated',No:'Ambient storage — unheated','Not sure':'Not sure yet'})[facts?.heated]||''
}
function projectExistingBase(facts){
const value=facts?.base||'';
return ({'Concrete slab':'Concrete slab or concrete hardstanding','Tarmac / asphalt':'Tarmac or asphalt','Hardcore / stone':'Hardcore or stone','Soil / grass':'Soil or grass','Mixed':'Mixed surfaces','Existing foundations':'Not sure','Existing building':'Not sure','Existing building / structure':'Not sure'})[value]||value
}
function projectReuseIntention(facts){
return ({Yes:'Yes — assess it for reuse',No:'No — a new base is planned'})[facts?.intendsToReuseExistingBase]||facts?.intendsToReuseExistingBase||''
}
function projectSiteEvidenceAvailability(facts){return facts?.siteEvidenceAvailability||''}
function projectReuseNeedsEvidenceAnswer(facts){return projectReuseIntention(facts)!=='No — a new base is planned'}
function projectSteelRequirementsComplete(facts){
if(!projectIsSteelFreeStanding(facts))return true;
const condition=projectTemperatureCondition(facts),reuse=projectReuseIntention(facts);
if(!condition||!projectExistingBase(facts)||!reuse)return false;
if(condition==='Other temperature requirement'&&(facts.requiredTemperatureC===undefined||facts.requiredTemperatureC===null||String(facts.requiredTemperatureC).trim()===''||!Number.isFinite(Number(facts.requiredTemperatureC))))return false;
if(projectReuseNeedsEvidenceAnswer(facts)&&!projectSiteEvidenceAvailability(facts))return false;
return true
}
// Plain-English label for a saved temperature answer. The saved value itself never changes.
function projectTemperaturePlain(condition){
return ({'Ambient working temperature — heated':'Yes, it will be heated','Ambient storage — unheated':'No, it will not be heated','Other temperature requirement':'It needs a set temperature','Not sure yet':'Not sure yet'})[condition]||condition||''
}
// Plain-English version used by the Stage 1 pages and PDF. The original projectTemperatureSummary below is still used by the Site Layout / Building Design pages (unchanged).
function projectTemperatureSummaryPlain(facts){
const condition=projectTemperatureCondition(facts);
return condition==='Other temperature requirement'&&facts?.requiredTemperatureC!==undefined&&String(facts.requiredTemperatureC).trim()!==''?`${projectTemperaturePlain(condition)} — ${facts.requiredTemperatureC}°C`:projectTemperaturePlain(condition)
}
// ORIGINAL (origin/approved) text, kept byte-for-byte: site-layout.js and building-layout.js call the functions below. Do not reword.
function projectTemperatureSummary(facts){
const condition=projectTemperatureCondition(facts);
return condition==='Other temperature requirement'&&facts?.requiredTemperatureC!==undefined&&String(facts.requiredTemperatureC).trim()!==''?`${condition} — ${facts.requiredTemperatureC}°C`:condition
}
function stage1SteelEnvelope(facts){
  const condition=projectTemperatureCondition(facts);
  const use=facts.buildingUse||facts.use;
  const useNote={
    'Food production or chilled storage':' Confirm process or product temperature requirements.',
    'Vehicle or plant wash facility':' Check moisture and condensation from the wash process.',
    'Spray room or process enclosure':' Check process and ventilation requirements.',
    'Warehousing and general storage':' Check the goods’ temperature and moisture limits.'
  }[use]||'';
  if(condition==='Other temperature requirement'&&stage1HasValue(facts.requiredTemperatureC)&&Number.isFinite(Number(facts.requiredTemperatureC))){
    if(Number(facts.requiredTemperatureC)<2)return {label:'Get professional support',text:'Below 2°C: specialist controlled-temperature and envelope review is needed.'+useNote};
    return {label:'Needs checking',text:'Check the envelope and temperature control against the specified internal temperature and building use.'+useNote};
  }
  if(condition==='Ambient working temperature — heated')return {label:'Needs checking',text:'Allow for an insulated envelope at concept stage. Check the heating and insulation requirements for the intended use.'+useNote};
  if(condition==='Ambient storage — unheated')return {label:'Needs checking',text:'Heating is not requested. Check stored goods and condensation needs before assuming an uninsulated envelope is suitable.'+useNote};
  return {label:'Needs checking',text:'Confirm the required internal conditions before selecting an envelope.'+useNote};
}
function stage1SteelSiteObservations(facts){
  const observations=[];
  const surface=projectExistingBase(facts),reuse=projectReuseIntention(facts);
  if(reuse==='No — a new base is planned'){
    observations.push('A new base is planned. Its design and any anchoring still depend on support reactions and site evidence.');
  }else if(surface==='Tarmac or asphalt'){
    observations.push('Tarmac or asphalt records the visible surface. Check the construction below it and any concentrated loads before considering reuse.');
  }else if(surface==='Concrete slab or concrete hardstanding'){
    observations.push('Check slab construction, subbase, support reactions and anchoring before assuming the concrete can be reused.');
  }else if(surface){
    observations.push('The recorded surface does not establish foundation or anchoring suitability. Check the construction below it and the proposed support reactions.');
  }else observations.push('Record the existing surface and whether reuse is intended.');
  if(reuse==='Yes — assess it for reuse')observations.push('Reuse is requested and remains unverified.');
  if(reuse==='Not sure')observations.push('The reuse decision is open. Retain any available site evidence for review.');
  if(facts.level==='No')observations.push('The reported fall may affect the building position, perimeter sealing and water movement.');
  else if(facts.level!=='Yes')observations.push('Site levels are unconfirmed. A visual check does not establish a surveyed level.');
  if(facts.services==='Yes')observations.push('Check the reported drains or services against the footprint and proposed support positions.');
  else if(facts.services!=='No')observations.push('Drain and service locations are unconfirmed.');
  return observations;
}
function stage1SteelSiteMarkup(p){
  const facts=projectFacts(p);
  if(!projectIsSteelFreeStanding(facts))return '';
  return `<section class="stage1-tech-card stage1-site-observations" aria-label="Site observations"><h2>Stage 1 site observations</h2><ul>${stage1SteelSiteObservations(facts).map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`;
}
function stage1AdjacentJunctionApplies(p){const facts=projectFacts(p);return projectIsSteelFreeStanding(facts)&&projectAdjacentBuildingNeedsJunction(facts)}
// Walls are named A to D in the checker. Say which side of the building they mean, in plain words.
const PLAIN_WALL_NAMES={A:'front',B:'right',C:'back',D:'left'};
function plainWalls(text){
  const out=String(text??'').replace(/\belevations?\s+([A-D](?:(?:\s*,\s*|\s+and\s+)[A-D])*)\b/gi,(m,list)=>{
    const names=list.toUpperCase().match(/[A-D]/g).map(letter=>PLAIN_WALL_NAMES[letter]);
    return names.length===1?`the ${names[0]} wall`:`the ${names.slice(0,-1).join(', ')} and ${names[names.length-1]} walls`
  });
  return out.replace(/(^|[.!?]\s+)([a-z])/g,(m,pre,ch)=>pre+ch.toUpperCase())
}
// What the regs checker found, for the Stage 1 report and PDF. Returns null when nothing has been run.
// Only approved rules are ever in the saved results. Customer-scope items read "get professional support",
// missing data is listed as need info, and "no potential issues" is only said when nothing is need info.
function stage1RegsFindings(p){
  const saved=p.backgroundChecks&&p.backgroundChecks.regsChecker;
  if(!saved)return null;
  const results=(saved.results||[]).filter(item=>item.ruleId!=='PLAN_PD');
  if(saved.nation==='Scotland'||saved.nation==='Wales')return {problems:[],support:[saved.nation+' has different rules. Our checks cover England only. Ask a professional to check.'],needInfo:[],energy:false};
  if(!results.length)return null;
  const withSupport=text=>/professional/i.test(text)?text:text.replace(/[.\s]*$/,'')+'. Ask a professional to check.';
  const flagged=item=>item.result==='potential problem'||item.result==='note';
  const problems=results.filter(item=>item.result==='potential problem'&&item.scope!=='customer').map(item=>({text:plainWalls(item.stage1Problem),why:plainWalls(item.stage1WhyItMatters)}));
  const support=[...new Set(results.filter(item=>item.scope==='customer'&&flagged(item)).map(item=>withSupport(plainWalls(item.stage1Note||item.stage1Problem||''))).filter(Boolean))];
  const needInfo=[...new Set(results.filter(item=>item.result==='need info'&&item.needInfo).map(item=>plainWalls(item.needInfo)))];
  if(!saved.nation)needInfo.unshift('The site country (we set this from the postcode in Site Layout)');
  // Energy is only mentioned in the report when the checker flags it.
  const energy=results.some(item=>['L_ENERGY','L_2027_HEATED'].includes(item.ruleId)&&flagged(item));
  return {problems,support,needInfo,energy}
}
// Regs and planning answers still missing, for the Project Summary. Read from the project facts only.
function stage1RegsMissingInfo(p){
  const facts=projectFacts(p),missing=[];
  if(!facts.regsNation)missing.push('The site country (we set this from the postcode in Site Layout)');
  if(facts.siteBoundaryStatus!=='confirmed'||!(Array.isArray(facts.relevantBoundaries)&&facts.relevantBoundaries.length))missing.push('Every site boundary marked in Site Layout');
  if(!facts.regsStored)missing.push('What will be stored in the building (Building Design)');
  if(!facts.regsServices||facts.regsServices==='Not sure')missing.push('Whether the building will have heating, toilets, offices or other services (Building Design)');
  if(typeof buildingDesignLinksExisting==='function'&&buildingDesignLinksExisting(facts)){
    if(!stage1HasValue(facts.regsExistingArea))missing.push('The floor area of the existing building (Building Design)');
    if(!stage1HasValue(facts.regsExistingHeight))missing.push('The height of the existing building (Building Design)')
  }
  return missing
}
// Personnel doors come from Building Design (the saved drawing), not the retired Stage 1 question.
function stage1PersonnelDoorsText(p){
  const doors=Array.isArray(p.geometry&&p.geometry.doors)?p.geometry.doors.filter(Boolean):null;
  if(!doors)return 'Not yet set in Building Design';
  const single=doors.filter(door=>stage1SummaryDoorKind(door)==='personnel').length,double=doors.filter(door=>stage1SummaryDoorKind(door)==='double').length;
  return `${single} single${double?`, ${double} double`:''} (from Building Design)`
}
function stage1SteelEnvelopeMarkup(p){
  const facts=projectFacts(p);
  if(!projectIsSteelFreeStanding(facts))return '';
  const envelope=stage1SteelEnvelope(facts);
  return `<section class="stage1-tech-card stage1-envelope-context" aria-label="Building envelope context"><h2>Building envelope context</h2><p>${esc(stage1KnownValue(p,"use")||"Building use not supplied")} · ${esc(projectTemperatureSummary(facts)||"Temperature conditions not supplied")}</p><p><strong>${esc(envelope.label)}</strong> · ${esc(envelope.text)}</p></section>`;
}
const ROLLER_ACCESS_OPTIONS=['HGV','Van','Forklift','Other'];
function stage1RollerOpeningComparison(p,drawing=p.geometry){
  const facts=projectFacts(p);
  const requested=Array.isArray(facts.rollerDoors)?facts.rollerDoors.filter(Boolean):[];
  const count=stage1HasValue(facts.rollerCount)?String(facts.rollerCount):'Not recorded';
  const drawn=Array.isArray(drawing?.doors)?drawing.doors.filter(door=>door?.type==='roller'):null;
  const needsReview=[];
  const comparable=door=>Number(door.width)>0&&Number(door.height)>0&&stage1HasValue(door.access);
  const key=door=>JSON.stringify([Number(door.width),Number(door.height),String(door.access).trim().toLowerCase()]);
  if(count==='Not recorded'){
    needsReview.push('The customer vehicle-door count has not been recorded.');
  }else if(requested.length&&requested.some(door=>!comparable(door))){
    needsReview.push('Some saved roller-door requirements are missing a clear size or access type.');
  }
  if(requested.some(door=>door.widthSource==='geometry'||door.heightSource==='geometry')){
    needsReview.push('Some requirement values were previously copied from geometry. Confirm them with the customer.');
  }
  if(drawn&&count!=='Not recorded'&&drawn.length!==Number(count)){
    needsReview.push('The roller-door count differs between the requirements and the drawing.');
  }
  if(drawn?.some(door=>!comparable(door)))needsReview.push('Some drawing roller doors are missing a clear size or access type.');
  if(drawn&&requested.length&&drawn.length===requested.length&&drawn.every(comparable)&&requested.every(comparable)){
    const requestedKeys=requested.map(key).sort(),drawnKeys=drawn.map(key).sort();
    if(requestedKeys.some((value,index)=>value!==drawnKeys[index])){
      needsReview.push('The roller-door clear sizes or access types differ between the requirements and the drawing.');
    }
  }
  return {requested,count,drawn,needsReview};
}
function stage1RollerOpeningDetails(door){
  const width=Number(door.width)>0?`${door.width} m`:'width not recorded';
  const height=Number(door.height)>0?`${door.height} m`:'height not recorded';
  return `${width} wide × ${height} high · ${door.access||'Access not recorded'}`;
}
// Stage 1 Project Summary door sections: one dropdown per door type, labelled
// as on the Building Design elevations (door.ref: R1, P1, D1…). Selecting a door
// shows one line with its size and access type. Doors come from the saved
// drawing; roller doors fall back to the customer's requirements when no
// drawing has been saved.
function stage1SummaryDoorKind(door){
  if(!door)return null;
  if(door.type==='roller')return 'roller';
  if(door.type==='personnel')return door.subtype==='double'?'double':'personnel';
  if(door.type==='double')return 'double';
  return null;
}
function stage1SummaryDoorSize(door){
  const width=Number(door.width)>0?`${Number(door.width).toFixed(1)} m`:'width not recorded';
  const height=Number(door.height)>0?`${Number(door.height).toFixed(1)} m`:'height not recorded';
  return `${width} × ${height}`;
}
function stage1SummaryDoorLine(door,kind,label){
  const access=kind==='roller'?(door.access||'Access not recorded'):kind==='double'?'Double door':'Personnel door';
  return `${label} · ${stage1SummaryDoorSize(door)} (width × height) · ${access}`;
}
function stage1SummaryDoorSelect(sel){
  const line=sel?.closest('.stage1-door-section')?.querySelector('.stage1-door-line');
  if(line)line.textContent=sel.selectedOptions[0]?.dataset.line||'';
}
function stage1RollerOpeningMarkup(p,drawing=p.geometry){
  if(!projectIsSteelFreeStanding(projectFacts(p)))return '';
  const facts=projectFacts(p);
  const drawn=Array.isArray(drawing?.doors)?drawing.doors.filter(Boolean):null;
  const prefix={roller:'R',personnel:'P',double:'D'};
  const section=(kind,heading,doors)=>{
    const id=`stage1Doors-${kind}`;
    if(!doors.length)return `<section class="stage1-door-section" aria-label="${heading}" data-door-kind="${kind}"><h3>${heading}</h3><p class="meta">No ${heading.toLowerCase()} recorded.</p></section>`;
    const items=doors.map((door,index)=>{const label=String(door.ref||`${prefix[kind]}${index+1}`);return {label,size:stage1SummaryDoorSize(door),line:stage1SummaryDoorLine(door,kind,label)}});
    return `<section class="stage1-door-section" aria-label="${heading}" data-door-kind="${kind}" style="margin-top:12px"><h3><label for="${id}">${heading}</label></h3>
      <select id="${id}" class="stage1-door-select" onchange="stage1SummaryDoorSelect(this)" style="min-width:240px;max-width:100%;padding:8px 10px;border-radius:10px;border:1px solid #c9d6cf;background:#fff">${items.map((item,index)=>`<option value="${index}" data-line="${esc(item.line)}">${esc(item.label)} · ${esc(item.size)}</option>`).join('')}</select>
      <p class="stage1-door-line" aria-live="polite" style="margin:8px 0 0">${esc(items[0].line)}</p></section>`;
  };
  const rollers=drawn?drawn.filter(door=>stage1SummaryDoorKind(door)==='roller'):(Array.isArray(facts.rollerDoors)?facts.rollerDoors.filter(Boolean):[]);
  const personnel=drawn?drawn.filter(door=>stage1SummaryDoorKind(door)==='personnel'):[];
  const doubles=drawn?drawn.filter(door=>stage1SummaryDoorKind(door)==='double'):[];
  return `<div class="stage1-tech-card stage1-door-summary">
    ${section('roller','Roller doors',rollers)}
    ${drawn&&personnel.length?section('personnel','Personnel doors',personnel):''}
    ${drawn&&doubles.length?section('double','Double doors',doubles):''}</div>`;
}
// Free report page (stage1Summary) keeps its original roller-door lists.
function stage1RollerOpeningListMarkup(p,drawing=p.geometry,drawingLabel='Saved drawing'){
  if(!projectIsSteelFreeStanding(projectFacts(p)))return '';
  const {requested,count,drawn,needsReview}=stage1RollerOpeningComparison(p,drawing);
  const list=doors=>doors.length?`<ul>${doors.map((door,index)=>`<li><strong>${esc(door.ref||`Door ${index+1}`)}</strong> · ${esc(stage1RollerOpeningDetails(door))}</li>`).join('')}</ul>`:'';
  return `<section class="stage1-tech-card" aria-label="Roller doors"><h2>Roller doors</h2>
    <h3>Customer requirements · ${esc(count)}</h3>${list(requested)}
    <h3>${esc(drawingLabel)} · ${drawn?.length??'Not recorded'}</h3>${drawn?list(drawn):''}
    ${needsReview.length?`<p><strong>Needs checking</strong></p><ul>${needsReview.map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`:''}</section>`;
}
function projectSettings(id){
if(!requireUser())return;const p=getP(id);if(!p)return route("dashboard");const facts=projectFacts(p),pitch=projectRoofPitch(p),ridge=projectRidgeHeight(p),returnRoute=projectEditReturnRoute||"stage1Workspace";projectEditReturnRoute="stage1Workspace";
const temperatureCondition=projectTemperatureCondition(facts),existingBase=projectExistingBase(facts),steelFree=projectIsSteelFreeStanding(facts);
app.innerHTML=`<div class="container customer-area project-management-page ceo-project-settings">${projectJourneyNav(p,"details",returnRoute)}<div class="customer-heading"><div><div class="eyebrow">Project Settings</div><h1>Edit project details</h1><p class="meta">Change your building details below. Save to return to the project journey.</p></div></div>
<section class="card management-card"><div class="project-settings-section-head"><div><h2>Edit project details</h2><p class="meta">These are the details you entered when creating this project.</p></div><button class="btn secondary" id="cancelProjectSettingsTop">${returnRoute==="stage1Confirm"?"Back to Project Summary":"Back to project overview"}</button></div><div class="profile-form project-specification-form"><div class="field"><label for="psName">Project name</label><input id="psName" value="${esc(p.name||"")}"></div><div class="field"><label for="psRole">Your role in this project</label><input id="psRole" value="${esc(facts.role||"")}" placeholder="e.g. Managing Director, Facilities Manager or Project Manager"><p class="field-note">This belongs to this project, not your account profile.</p></div><div class="field"><label for="psStatus">Project status</label><select id="psStatus"><option ${p.status==="Active"||!p.status?"selected":""}>Active</option><option ${p.status==="On hold"?"selected":""}>On hold</option><option ${p.status==="Completed"?"selected":""}>Completed</option><option ${p.status==="Archived"?"selected":""}>Archived</option></select><p class="field-note">Put the project on hold, mark it completed or archive it here.</p></div><div class="field"><label for="psUse">Building use</label><select id="psUse">${projectOptionMarkup(BUILDING_USE_OPTIONS,facts.buildingUse||facts.use||"")}</select></div><div class="field"><label for="psType">Building type</label><select id="psType">${projectOptionMarkup(BUILDING_TYPE_OPTIONS,facts.buildingType||(projectIsSteelFreeStanding(facts)?"Free-standing building":""))}</select></div>
<section id="psSteelRequirements" class="project-requirements-group" ${steelFree?'':'hidden'}>
<div class="project-requirement-card">
<h3>Temperature and building envelope</h3>
<div class="field"><label for="psTemperatureCondition">Will the building be heated?</label><select id="psTemperatureCondition"><option value="">Choose…</option>${PROJECT_STEEL_TEMPERATURE_OPTIONS.map(value=>`<option value="${esc(value)}" ${temperatureCondition===value?'selected':''}>${esc(projectTemperaturePlain(value))}${value==='Other temperature requirement'?' — enter the °C':''}</option>`).join('')}</select></div>
<div class="field" id="psRequiredTemperatureWrap" ${temperatureCondition==='Other temperature requirement'?'':'hidden'}><label for="psRequiredTemperature">Required internal temperature (°C)</label><input id="psRequiredTemperature" type="number" step="0.1" inputmode="decimal" value="${esc(facts.requiredTemperatureC??'')}"><p class="field-note">A store colder than 2°C needs specialist design, so we will flag it.</p></div>
</div>
<div class="project-requirement-card">
<h3>Existing surface and supporting evidence</h3>
<div class="field"><label for="psExistingBase">What is currently on the proposed building area?</label><select id="psExistingBase"><option value="">Choose…</option>${PROJECT_STEEL_BASE_OPTIONS.map(value=>`<option value="${esc(value)}" ${existingBase===value?'selected':''}>${esc(value)}</option>`).join('')}</select></div>
<div class="field"><label for="psBaseReuse">Would you like to use the existing surface if it proves suitable?</label><select id="psBaseReuse"><option value="">Choose…</option>${PROJECT_STEEL_REUSE_OPTIONS.map(value=>`<option value="${esc(value)}" ${projectReuseIntention(facts)===value?'selected':''}>${esc(value)}</option>`).join('')}</select><p class="field-note">This only records what you would like. We will not assume the existing surface is suitable until it has been checked.</p></div>
<div class="field" id="psSiteEvidenceWrap" ${projectReuseIntention(facts)&&projectReuseNeedsEvidenceAnswer(facts)?'':'hidden'}><label for="psSiteEvidence">Do you have any drawings, surveys or other information for the proposed building area?</label><select id="psSiteEvidence"><option value="">Choose…</option>${PROJECT_STEEL_EVIDENCE_OPTIONS.map(value=>`<option value="${esc(value)}" ${projectSiteEvidenceAvailability(facts)===value?'selected':''}>${esc(value)}</option>`).join('')}</select><p class="field-note">Upload anything you have. This may include a topographical or level survey, utility survey, drainage or CCTV information, slab or foundation drawings, ground investigation, or an existing site/building survey. You do not need to classify or interpret it.</p></div>
</div>
<div class="project-requirement-card">
<h3>Existing buildings nearby</h3>
<div class="field"><label for="psAdjacentBuilding">Will the new building link to, or sit close to, an existing building?</label><select id="psAdjacentBuilding"><option value="">Choose… (optional)</option>${PROJECT_ADJACENT_BUILDING_OPTIONS.map(value=>`<option value="${esc(value)}" ${projectAdjacentExistingBuilding(facts)===value?'selected':''}>${esc(value)}</option>`).join('')}</select><p class="field-note">Optional. Joining onto another building adds complications, so we will flag it.</p></div>
</div>
</section>
<div class="field"><label for="psAddress">Proposed building site address</label><input id="psAddress" autocomplete="street-address" value="${esc(p.address||"")}" placeholder="Enter the full proposed site address including postcode"><p class="field-note">This project address is used for Site Layout. Changing it requires the site layout to be confirmed again.</p></div><div class="field"><label for="psLength">Length (m)</label><input id="psLength" type="number" min="0.1" step="0.1" value="${esc(facts.length||"")}"></div><div class="field"><label for="psWidth">Width (m)</label><input id="psWidth" type="number" min="0.1" step="0.1" value="${esc(facts.width||"")}"></div><div class="field"><label for="psHeight">Clear height needed (m)</label><input id="psHeight" type="number" min="0.1" step="0.1" value="${esc(facts.height||"")}"></div><div class="field"><label for="psPitch">Roof pitch (degrees)</label><input id="psPitch" type="number" min="${PROJECT_ROOF_PITCH_MIN}" max="${PROJECT_ROOF_PITCH_MAX}" step="0.5" value="${pitch}" aria-describedby="psPitchHelp"><p class="field-note" id="psPitchHelp">Minimum 5° · standard 10° · maximum 22°.</p></div><div class="project-ridge-preview" aria-live="polite"><span>Calculated ridge height</span><strong id="psRidgeHeight">${ridge===null?"Add width and clear height":`${ridge.toFixed(2)} m`}</strong><p>Calculated from the customer dimensions and selected roof pitch.</p></div></div><div class="actions"><button class="btn green" id="saveProjectSettings">${returnRoute==="stage1Confirm"?"Save and return to Project Summary":"Save and return to overview"}</button><button class="btn secondary" id="cancelProjectSettings">Cancel</button></div></section>
<section class="card management-card"><h2>Project Documents</h2><p class="meta">${(p.evidence||[]).length} document(s) are currently recorded for this project.</p><button class="btn secondary" onclick="openProjectDocuments('${p.id}','${returnRoute}')">Open Project Documents</button></section>
<section class="card management-card project-settings-danger"><h2>Delete project</h2><p>Deletion is permanent and requires a separate warning and confirmation.</p><button type="button" class="project-settings-delete" onclick="confirmProjectDeletion('${p.id}')">Delete project</button></section></div>`;
if(projectEditFocus?.id===id){const field=projectEditFocus.field;projectEditFocus=null;setTimeout(()=>{const target=document.getElementById(field);if(target){target.focus({preventScroll:true});target.scrollIntoView({block:"center",behavior:"smooth"})}},0)}
const returnToProject=()=>route(returnRoute,p.id);
document.querySelector("#cancelProjectSettingsTop").onclick=returnToProject;
document.querySelector("#cancelProjectSettings").onclick=returnToProject;
const updateRidgePreview=()=>{const next=projectRidgeHeight(p,psWidth.value,psHeight.value,psPitch.value);document.querySelector("#psRidgeHeight").textContent=next===null?"Add width and clear height":`${next.toFixed(2)} m`};
["psWidth","psHeight","psPitch"].forEach(fieldId=>document.querySelector(`#${fieldId}`).addEventListener("input",updateRidgePreview));
const steelRequirements=document.querySelector("#psSteelRequirements");
const updateSteelRequirementVisibility=()=>{steelRequirements.hidden=document.querySelector("#psType").value!=="Free-standing building"};
const updateTemperatureRequirementVisibility=()=>{
const condition=document.querySelector("#psTemperatureCondition").value;
document.querySelector("#psRequiredTemperatureWrap").hidden=condition!=="Other temperature requirement"
};
const updateSiteEvidenceVisibility=()=>{
const reuse=document.querySelector("#psBaseReuse").value;
document.querySelector("#psSiteEvidenceWrap").hidden=!reuse||reuse==="No — a new base is planned";
document.querySelector("#saveProjectSettings").textContent=reuse&&reuse!=="No — a new base is planned"&&document.querySelector("#psSiteEvidence").value==="Yes — upload them now"?"Save and upload documents":`${returnRoute==="stage1Confirm"?"Save and return to Project Summary":"Save and return to overview"}`
};
document.querySelector("#psType").addEventListener("change",updateSteelRequirementVisibility);
document.querySelector("#psTemperatureCondition").addEventListener("change",updateTemperatureRequirementVisibility);
document.querySelector("#psBaseReuse").addEventListener("change",updateSiteEvidenceVisibility);
document.querySelector("#psSiteEvidence").addEventListener("change",updateSiteEvidenceVisibility);
updateSiteEvidenceVisibility();
document.querySelector("#saveProjectSettings").onclick=()=>{
const name=psName.value.trim(),role=psRole.value.trim(),use=psUse.value,type=psType.value,address=psAddress.value.trim(),postcode=extractProjectPostcode(address),status=psStatus.value,length=psLength.value.trim(),width=psWidth.value.trim(),height=psHeight.value.trim(),roofPitch=Number(psPitch.value);
const steelFree=type==="Free-standing building";
const temperatureCondition=document.querySelector("#psTemperatureCondition").value;
const requiredTemperatureC=document.querySelector("#psRequiredTemperature").value.trim();
const existingBase=document.querySelector("#psExistingBase").value;
const intendsToReuseExistingBase=document.querySelector("#psBaseReuse").value;
const siteEvidenceAvailability=document.querySelector("#psSiteEvidence").value;
const adjacentExistingBuilding=document.querySelector("#psAdjacentBuilding").value;
if(!name||!role||!use||!type||!address)return alert("Enter the project name, your role in this project, building use, building type and proposed building site address.");
if(steelFree&&!temperatureCondition)return alert("Select the temperature conditions the building will need.");
if(steelFree&&temperatureCondition==="Other temperature requirement"&&(requiredTemperatureC===""||!Number.isFinite(Number(requiredTemperatureC))))return alert("Enter the required internal temperature in °C.");
if(steelFree&&!existingBase)return alert("Select what is currently on the proposed building area.");
if(steelFree&&!intendsToReuseExistingBase)return alert("Answer whether you would like to use the existing surface if it proves suitable.");
if(steelFree&&intendsToReuseExistingBase!=="No — a new base is planned"&&!siteEvidenceAvailability)return alert("Answer whether you have drawings, surveys or other information for the proposed building area.");
if([length,width,height].some(value=>value!==""&&(!Number.isFinite(Number(value))||Number(value)<=0)))return alert("Enter positive building dimensions, or leave an unknown dimension blank.");
if(!Number.isFinite(roofPitch)||roofPitch<PROJECT_ROOF_PITCH_MIN||roofPitch>PROJECT_ROOF_PITCH_MAX)return alert(`Roof pitch must be between ${PROJECT_ROOF_PITCH_MIN}° and ${PROJECT_ROOF_PITCH_MAX}°.`);
const siteAddressChanged=address!==p.address;
const nextFacts={...facts,role,buildingUse:use,buildingType:type,length,width,height,roofPitch:String(roofPitch)};
let nextAssessments={...(p.stage1Assessments&&typeof p.stage1Assessments==="object"?p.stage1Assessments:{})};
if(steelFree){
Object.assign(nextFacts,{temperatureCondition,base:existingBase,intendsToReuseExistingBase});
nextFacts.heated=({"Ambient working temperature — heated":"Yes","Ambient storage — unheated":"No","Other temperature requirement":"Not sure","Not sure yet":"Not sure"})[temperatureCondition];
if(temperatureCondition==="Other temperature requirement")nextFacts.requiredTemperatureC=requiredTemperatureC;else delete nextFacts.requiredTemperatureC;
delete nextFacts.ambientProtectionNeeded;
if(adjacentExistingBuilding)nextFacts.adjacentExistingBuilding=adjacentExistingBuilding;else delete nextFacts.adjacentExistingBuilding;
if(intendsToReuseExistingBase==="No — a new base is planned")delete nextFacts.siteEvidenceAvailability;else nextFacts.siteEvidenceAvailability=siteEvidenceAvailability;
nextAssessments={...nextAssessments,specialistLowTemperatureFlag:temperatureCondition==="Other temperature requirement"&&Number(requiredTemperatureC)<2,baseSuitabilityStatus:intendsToReuseExistingBase==="No — a new base is planned"?"NOT_ASSESSED":"UNVERIFIED",anchoringSuitabilityStatus:"UNVERIFIED"}
}
const steelSiteChanged=steelFree&&(siteAddressChanged||length!==String(facts.length||'')||width!==String(facts.width||''));
if((siteAddressChanged||steelSiteChanged)&&nextFacts.siteLayoutStatus){nextFacts.siteLayoutStatus="needs_reconfirmation";nextFacts.siteLayoutAddressChangedAt=now()}
if(steelFree&&(steelSiteChanged||height!==String(facts.height||'')||roofPitch!==projectRoofPitch(p))&&nextFacts.buildingDesignStatus){
  nextFacts.buildingDesignStatus="needs_reconfirmation";
}
const changed=name!==p.name||address!==p.address||postcode!==(p.postcode||"")||status!==(p.status||"Active")||JSON.stringify(nextFacts)!==JSON.stringify(facts)||JSON.stringify(nextAssessments)!==JSON.stringify(p.stage1Assessments||{});
Object.assign(p,{name,address,postcode,status,facts:nextFacts,stage1Assessments:nextAssessments});if(changed)p.history.push({at:now(),text:siteAddressChanged?"Project details updated — proposed building site address changed; Site Layout requires reconfirmation":"Project details updated"});if(typeof pcBuildingRegsRun==='function')pcBuildingRegsRun(p);if(steelFree&&p.backgroundChecks&&p.backgroundChecks.regsChecker&&typeof runRegsChecker==='function')runRegsChecker(p);save();if(steelFree&&projectReuseNeedsEvidenceAnswer(nextFacts)&&siteEvidenceAvailability==="Yes — upload them now")openProjectDocuments(p.id,returnRoute);else route(returnRoute,p.id)
};
}
async function uploadProjectFiles(p,input,refresh,status){
 const stage=p.stage1Complete?p.stage:'Stage 1';
 let files=splitUnreadablePhotos(input.files);if(!files.length){input.value='';return}
 const room=uploadKey(stage)?Math.max(0,UPLOAD_LIMIT-uploadsUsed(p,stage)):files.length;
 if(!room){alert(UPLOAD_LIMIT_MSG);input.value='';return}
 if(files.length>room){alert(UPLOAD_LIMIT_MSG+' Only the first '+room+' file(s) will be uploaded.');files=files.slice(0,room)}
 input.disabled=true;if(status)status.textContent='Uploading documents…';
 try{
  for(const file of files){
   if(!/\.(pdf|docx|dwg|png|jpe?g)$/i.test(file.name))throw new Error('Choose a PDF, DOCX, DWG, PNG or JPG file.');
   const path=window.ProjectCheckPlatform?.enabled?await ProjectCheckPlatform.uploadProjectDocument(p.id,file):null;
   const before=p.evidence.length;
   await addEvidenceFiles(p,[file],stage,'Project document uploaded');
   if(path&&p.evidence[before]){p.evidence[before].storagePath=path;save()}
  }
 }catch(error){alert(error.message||'Document upload failed. Please try again.')}
 finally{input.disabled=false;refresh()}
}
function projectDocuments(id){
if(!requireUser())return;const p=getP(id);if(!p)return route('dashboard');const docs=p.evidence||[],returnRoute=projectDocumentsReturnRoute||"stage1Workspace";
app.innerHTML=`<div class="container customer-area project-management-page">${projectJourneyNav(p,"documents",returnRoute)}<div class="customer-heading"><div><div class="eyebrow">Project Documents</div><h1>${esc(p.name)}</h1><p class="meta">Upload and review the drawings and supporting evidence supplied for this project.</p></div></div>
<section class="card document-upload-card"><div><h2>Upload documents</h2><p class="meta">PDF, DOCX, DWG, PNG or JPG. Upload anything you have for the proposed building area, including topographical or level surveys, utility surveys, drainage or CCTV information, slab or foundation drawings, ground investigations, or existing site/building surveys. You do not need to classify or interpret it. DWG files can be downloaded and opened in CAD software; online preview is not available.</p></div><label class="btn green" for="projectDocumentFiles">Choose files</label><p class="meta">${uploadsLabel(p,p.stage1Complete?p.stage:'Stage 1')}</p><p class="meta">${esc(UPLOAD_NOT_REVIEWED_TEXT)} Photos and CAD files (DWG) may not be readable, so please also send a PDF where you can.</p><input id="projectDocumentFiles" type="file" multiple accept=".pdf,.docx,.dwg,.png,.jpg,.jpeg" hidden></section>
<section class="card management-card"><div class="document-register-heading"><div><h2>Your uploaded documents</h2><p class="meta">${docs.length} document(s) recorded</p></div><label class="field document-filter"><span>Document type</span><select id="documentDiscipline"><option>All disciplines</option><option>Architectural</option><option>Civils</option><option>Structural</option><option>Fire</option><option>Other</option></select></label></div>${docs.length?`<div class="document-table-wrap"><table class="document-register"><thead><tr><th>Document</th><th>Added</th><th>Discipline</th><th>Status</th><th>Actions</th></tr></thead><tbody>${docs.map((e,index)=>`<tr data-discipline="${esc(e.discipline||"Other")}"><td><strong>${esc(e.name)}</strong><small class="simple-file-line">${uploadFileDetail(e.name)}</small><small>${e.revision?`Revision ${esc(e.revision)}`:"No revision letter read"}</small></td><td>${new Date(e.at).toLocaleDateString()}</td><td><select class="document-discipline" id="documentDisciplineRow${index}" aria-label="Discipline for ${esc(e.name)}">${DOCUMENT_DISCIPLINES.map(d=>`<option ${(e.discipline||"Other")===d?"selected":""}>${d}</option>`).join("")}</select></td><td><span class="pill">${esc(e.documentStatus||"Current")}</span></td><td><div class="document-actions"><button class="btn secondary" type="button" onclick="viewProjectDocument('${p.id}',${index})">${/\.dwg$/i.test(e.name||"")?"Download DWG":"View"}</button><label class="btn secondary" for="replaceDocument${index}">Replace</label><input id="replaceDocument${index}" type="file" accept=".pdf,.docx,.dwg,.png,.jpg,.jpeg" hidden></div></td></tr>`).join('')}</tbody></table><p class="meta document-filter-empty" id="documentFilterEmpty" hidden>No documents in this discipline. Change the filter or set a document's discipline in the list.</p></div>`:`<div class="document-empty"><h3>No documents uploaded yet</h3><p class="meta">Use Choose files above when drawings or supporting information are available.</p></div>`}</section>
<section class="card management-card simple-upload-host">${uploadReviewMarkup(p,'stage1')}</section>
<div class="actions"><button class="btn secondary" onclick="returnFromProjectDocuments('${p.id}')">${returnRoute==="stage1Confirm"?"Back to Project Summary":"Back to project"}</button></div></div>`;
const filter=document.querySelector('#documentDiscipline');
// Documents saved without a discipline (every upload before the per-row selector
// existed) are treated as "Other" — same fallback the register row uses.
const applyDocumentFilter=()=>{
 const rows=[...document.querySelectorAll('.document-register tbody tr[data-discipline]')];
 rows.forEach(row=>{row.hidden=filter.value!=='All disciplines'&&row.dataset.discipline!==filter.value});
 const none=document.querySelector('#documentFilterEmpty');
 if(none)none.hidden=!rows.length||rows.some(row=>!row.hidden)
};
filter.value=projectDocumentFilter;
filter.onchange=()=>{projectDocumentFilter=filter.value;applyDocumentFilter()};
docs.forEach((entry,index)=>{
 const select=document.querySelector('#documentDisciplineRow'+index);
 if(select)select.onchange=()=>{
  entry.discipline=select.value;save();
  select.closest('tr').dataset.discipline=select.value;applyDocumentFilter()
 }
});
applyDocumentFilter();
const input=document.querySelector('#projectDocumentFiles');
input.onchange=()=>uploadProjectFiles(p,input,()=>projectDocuments(id));
docs.forEach((entry,index)=>{
 document.querySelector('#replaceDocument'+index).onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  if(!splitUnreadablePhotos([file]).length){event.target.value='';return}
  event.target.disabled=true;
  try{
   if(!/\.(pdf|docx|dwg|png|jpe?g)$/i.test(file.name))throw new Error('Choose a PDF, DOCX, DWG, PNG or JPG file.');
   if(!window.ProjectCheckPlatform?.enabled)throw new Error('Sign in to the test platform to retain a replacement file.');
   const result=typeof extractEvidenceText==='function'?await extractEvidenceText(file):{text:null,status:'UNSUPPORTED',note:''};
   const path=await ProjectCheckPlatform.uploadProjectDocument(p.id,file);
   const {versions=[],...previous}=entry;
   p.evidence[index]={...entry,name:file.name,size:file.size,type:file.type,at:now(),storagePath:path,revision:String((Number(entry.revision)||1)+1),versions:[...versions,previous],extractedText:result.text,extractionStatus:result.status,extractionNote:result.note||''};
   p.history.push({at:now(),text:'Document revision added: '+file.name});
   if(typeof buildProjectEvidenceLedger==='function')buildProjectEvidenceLedger(p);
   if(typeof buildStage2Findings==='function')buildStage2Findings(p);
   if(typeof buildStage3Actions==='function')buildStage3Actions(p);
   save();
  }catch(error){alert(error.message||'Document replacement failed. The existing record was retained.')}
  finally{projectDocuments(id)}
 };
});
}
async function viewProjectDocument(id,index){
 const p=getP(id),entry=p?.evidence?.[index];if(!entry)return;
 if(!window.ProjectCheckPlatform?.enabled)return alert('Sign in to view the stored document.');
 const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
 try{
  const url=await ProjectCheckPlatform.projectDocumentUrl(id,entry);
  if(tab)tab.location.replace(url);else alert('Allow pop-ups for Project Check, then select View again.');
 }catch(error){if(tab)tab.close();alert(error.message||'The stored document could not be opened.')}
}
function confirmProjectDeletion(id){
const p=getP(id);if(!p)return route('dashboard');
const previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
const d=document.createElement('div');d.className='modal project-delete-modal';
d.innerHTML=`<div class="card delete-project-dialog" role="dialog" aria-modal="true" aria-labelledby="deleteProjectTitle" aria-describedby="deleteProjectWarning"><div class="eyebrow">Project settings</div><h2 id="deleteProjectTitle">Permanently delete ${esc(p.name||"this project")}?</h2><p id="deleteProjectWarning">This will permanently delete this project and its associated information. Once deleted, it cannot be retrieved.</p><div class="actions"><button type="button" class="btn secondary" id="cancelProjectDelete">Cancel</button><button type="button" class="btn delete-project-confirm" id="confirmProjectDelete">Delete permanently</button></div></div>`;
document.body.appendChild(d);
const close=()=>{d.remove();document.body.style.overflow=previousBodyOverflow};
const cancel=d.querySelector('#cancelProjectDelete'),confirm=d.querySelector('#confirmProjectDelete');
cancel.onclick=close;cancel.focus();
confirm.onclick=async()=>{
confirm.disabled=true;confirm.textContent='Deleting…';
try{
if(window.ProjectCheckPlatform?.enabled)await ProjectCheckPlatform.deleteProject(p.id);
state.projects=state.projects.filter(item=>!(item.id===p.id&&item.owner===state.user?.id));
save();close();route('dashboard')
}catch(e){confirm.disabled=false;confirm.textContent='Delete permanently';alert(e.message||'The project could not be deleted. Nothing else was changed.')}
};
}
// Evidence Intelligence Batch 1 — INTERNAL/DEV REVIEW SURFACE ONLY, not a
// customer-facing feature (see EVIDENCE-INTELLIGENCE-SPEC.md and
// MASTER-SPEC.md § "Question, Evidence & Rule Development governance").
// Rebuilds the ledger fresh on every visit (dev tool, not a persisted
// customer view) purely for inspection: which document produced which
// subject/value, its status/confidence, its page/section provenance, and
// whether it corroborates or conflicts with another document. This route
// reads p.evidenceRecords/p.evidence only — it never writes a Stage 1
// answer, Stage 2 finding, Stage 3 action or report.
function evidenceLedgerPage(id){
if(!requireUser())return;let p=getP(id);if(!p)return route('dashboard');
if(typeof buildProjectEvidenceLedger==='function')buildProjectEvidenceLedger(p);
if(typeof buildStage2Findings==='function')buildStage2Findings(p);
if(typeof buildStage3Actions==='function')buildStage3Actions(p);
let recs=p.evidenceRecords||[];
// Batch 3: one row per generated Stage 2 finding — internal/dev-only, full
// detail (never shown to customers; see stage2Summary() for the restrained
// customer-facing summary-only version).
// Batch 4 (2026-08-26): Package/scope, Discrepancy/Authority/Missing-
// evidence reference counts, and Apparent responsibility/Interface columns
// appended — internal/dev-only, same as every other Batch 1-4 addition to
// this page.
let findingRows=Object.values(p.stage2Findings||{}).map(f=>`<tr><td>${esc(f.finding_id)}</td><td>${esc(f.category)}</td><td><span class="pill">${esc(f.finding_status)}</span></td><td>${esc(f.customer_facing_summary)}</td><td class="meta">${esc(f.internal_detail)}</td><td>${f.supporting_evidence_ids.length}${f.conflicting_evidence_ids.length?` (conflict: ${f.conflicting_evidence_ids.length})`:''}</td><td>${esc(f.confidence)}</td><td class="meta">${f.information_still_required.map(esc).join('; ')||'—'}</td><td>${f.stage3_candidate?'Yes':'No'}</td><td class="meta">${f.resolved_at?'Resolved '+new Date(f.resolved_at).toLocaleString():'—'}</td><td class="meta">${(f.package||[]).join(', ')||'—'}${f.scope?' / '+esc(f.scope):''}</td><td class="meta">${(f.discrepancy_ids||[]).length}D / ${(f.authority_requirement_ids||[]).length}A / ${(f.missing_evidence_ids||[]).length}M</td><td class="meta">${esc(f.apparent_responsibility||'—')}${f.interface_summary?'<br>'+esc(f.interface_summary):''}</td><td class="meta">${esc(f.unresolved_reason||'—')}</td></tr>`).join('');
// Batch 4: one row per generated Stage 3 action — internal/dev-only, full
// detail (never shown to customers; see stage3Actions() for the restrained,
// entitlement-gated customer-facing version).
// Batch 4 (2026-08-26): Package/scope, Discrepancy/Authority/Missing-
// evidence reference counts, Interface, and Evidence required to close
// columns appended.
// Batch 5 (2026-08-26): Customer-facing status column appended, using the
// SAME stage3CustomerStatusLabel()/STAGE3_STATUS_LABEL mapping the real
// customer view uses — lets a reviewer directly compare internal vs.
// customer-facing status without opening the entitlement-gated page.
let actionRows=Object.values(p.stage3Actions||{}).map(a=>`<tr><td>${esc(a.action_id)}</td><td>${esc(a.source_finding_id)}</td><td>${esc(a.category)}</td><td><span class="pill">${esc(a.action_status)}</span></td><td class="meta">${esc(stage3CustomerStatusLabel(a,p))}</td><td>${esc(a.customer_facing_action)}</td><td class="meta">${(a.required_information||[]).map(esc).join('; ')||'—'}</td><td class="meta">${esc(a.likely_responsible_party||'—')}</td><td>${a.supporting_evidence_ids.length}</td><td class="meta">${esc(a.completion_criteria||'—')}</td><td>${a.completion_evidence_ids.length?a.completion_evidence_ids.join(', '):'—'}</td><td class="meta">${(a.history||[]).map(h=>new Date(h.at).toLocaleString()+': '+esc(h.text)).join('<br>')}</td><td class="meta">${(a.package||[]).join(', ')||'—'}${a.scope?' / '+esc(a.scope):''}</td><td class="meta">${(a.discrepancy_ids||[]).length}D / ${(a.authority_requirement_ids||[]).length}A / ${(a.missing_evidence_ids||[]).length}M</td><td class="meta">${esc(a.interface_summary||'—')}</td><td class="meta">${(a.evidence_required_to_close||[]).map(esc).join('; ')||'—'}</td><td class="meta">${esc(a.planning_gate||'—')}${a.approved_baseline_context&&a.approved_baseline_context.length?'<br>Baseline: '+a.approved_baseline_context.map(d=>esc(d.drawing_number+' Rev '+d.revision)).join(', '):''}</td></tr>`).join('');
// Evidence Meaning/Provenance/Maturity enhancement (2026-08-26): 3 extra
// internal-only columns — evidence function(s), evidence maturity (with a
// "(capped)" marker when a same-document integrity limitation held it back
// from its natural higher state — see deriveEvidenceMaturity(), evidence.js),
// and document integrity flags. Still the same internal/dev-only route as
// every other Batch 1-4 column on this page — no customer-facing surface.
// Batch 2A (2026-08-26): Package column appended to the Documents table
// (document-level, multi-label); Scope column appended to the extracted
// records table (fact-level, narrower than the document's package). Still
// the same internal/dev-only route as every other Batch 1/1B/2/2A column —
// no customer-facing surface.
// Planning Batch 1 (2026-08-26): Planning type/drawing-status column
// appended — internal/dev-only, same as every other addition to this page.
let docRows=(p.evidence||[]).map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.documentType||'—')}</td><td>${esc(e.documentTypeConfidence||'—')}</td><td><span class="pill">${esc(e.extractionStatus||'UNSUPPORTED')}</span></td><td class="meta">${esc(e.extractionNote||'')}</td><td class="meta">${(e.evidenceFunctions||[]).length?e.evidenceFunctions.map(f=>esc(f.function)+' ('+esc(f.confidence)+(f.source==='filename'?', filename':'')+')').join('<br>'):'—'}</td><td class="meta">${(e.evidenceMaturity||[]).length?e.evidenceMaturity.map(m=>esc(m.function)+' → '+esc(m.maturity)+(m.capped?' (capped)':'')).join('<br>'):'—'}</td><td class="meta">${(e.documentIntegrityFlags||[]).length?e.documentIntegrityFlags.map(f=>esc(f.detail)).join('<br>'):'—'}</td><td class="meta">${(e.packages||[]).length?e.packages.map(pk=>esc(pk.package)+' ('+esc(pk.confidence)+', '+esc(pk.source)+')').join('<br>'):'—'}</td><td class="meta">${e.planningDocumentType?esc(e.planningDocumentType)+(e.planningDocumentTypeConfidence?' ('+esc(e.planningDocumentTypeConfidence)+')':''):'—'}${e.planningDrawingStatus?'<br>'+esc(e.planningDrawingStatus):''}</td></tr>`).join('');
let recRows=recs.map(r=>`<tr><td>${esc(r.source_file)}</td><td>${esc(r.subject)}</td><td>${esc(r.extracted_value)}${r.unit?' '+esc(r.unit):''}</td><td><span class="pill">${esc(r.evidence_status)}</span></td><td>${esc(r.confidence)}</td><td>${esc(r.source_page_or_section)}</td><td>${r.corroborates.length?`Corroborates: ${r.corroborates.length}`:''}${r.corroborates.length&&r.conflicts_with.length?'<br>':''}${r.conflicts_with.length?`<b>Conflicts: ${r.conflicts_with.length}</b>`:''}</td><td class="meta">${esc(r.scope||'—')}</td></tr>`).join('');
// Batch 2B (2026-08-26): internal/dev-only Parties & Relationships tables —
// same not-customer-facing route as every other Batch 1/2A/2B column. Party
// names are shown alongside their type; relationships show type, package(s),
// scope, party_to/party_from (resolved back to a readable name), explicit/
// inferred/unclear, confidence, source, exclusion/limit and any interface
// cross-references — never anything beyond what buildProjectResponsibilityModel()
// (evidence.js) actually produced.
let parties=p.parties||{};
let partyName=id=>parties[id]?`${esc(parties[id].party_name)} (${esc(parties[id].party_type)})`:esc(id||'—');
let partyRows=Object.values(parties).map(pt=>`<tr><td>${esc(pt.party_name)}</td><td>${esc(pt.party_type)}</td><td>${esc(pt.confidence)}</td><td class="meta">${esc(pt.notes||'—')}</td><td>${(pt.source_evidence_ids||[]).length}</td></tr>`).join('');
let relRows=(p.relationships||[]).map(r=>`<tr><td><span class="pill${r.relationship_type==='RESPONSIBILITY_UNCLEAR'?' warn':''}">${esc(r.relationship_type)}</span></td><td class="meta">${(r.package||[]).join(', ')||'—'}</td><td class="meta">${esc(r.scope||'—')}</td><td>${partyName(r.party_to)}</td><td>${r.party_from?partyName(r.party_from):'—'}</td><td>${esc(r.explicit_or_inferred)}</td><td>${esc(r.confidence)}</td><td class="meta">${(r.source_files||[]).join(', ')}</td><td class="meta">${esc(r.exclusions_or_limits||'—')}</td><td class="meta">${(r.interface_with||[]).length?r.interface_with.map(partyName).join('<br>'):'—'}</td><td class="meta">${esc(r.notes||'—')}</td></tr>`).join('');
// Batch 3 (2026-08-26): internal/dev-only Discrepancies, Authority
// requirements and Missing evidence tables — same not-customer-facing route
// as every other Batch 1/2A/2B/3 section on this page.
let discRows=(p.discrepancies||[]).map(d=>`<tr><td><span class="pill${d.discrepancy_type==='MATERIAL_CONFLICT'?' warn':''}">${esc(d.discrepancy_type)}</span></td><td class="meta">${esc(d.subject)}</td><td class="meta">${(d.package||[]).join(', ')||'—'}${d.scope?' / '+esc(d.scope):''}</td><td class="meta">${(d.source_files||[]).join(', ')}</td><td class="meta">${esc(d.earlier_value)} → ${esc(d.later_value)}</td><td class="meta">${esc(d.comparison_basis)}</td><td class="meta">${esc(d.consequence_if_unresolved)}</td><td>${d.requires_human_confirmation?'Yes':'No'}</td></tr>`).join('');
let reqRows=(p.authorityRequirements||[]).map(r=>`<tr><td>${esc(r.authority_name)}</td><td class="meta">${esc(r.requirement_text)}</td><td class="meta">${(r.package||[]).join(', ')||'—'}${r.scope?' / '+esc(r.scope):''}</td><td><span class="pill">${esc(r.status)}</span></td><td class="meta">${(r.response_evidence_ids||[]).join(', ')||'—'}</td><td class="meta">${(r.apparent_acceptance_evidence_ids||[]).concat(r.closure_evidence_ids||[]).join(', ')||'—'}</td></tr>`).join('');
let missRows=(p.missingEvidence||[]).map(m=>`<tr><td class="meta">${esc(m.subject)}</td><td class="meta">${esc(m.expected_evidence_type)}</td><td class="meta">${esc(m.why_expected)}</td><td><span class="pill${m.status==='MISSING'?' warn':''}">${esc(m.status)}</span></td><td class="meta">${(m.related_requirement_ids||[]).length||(m.related_relationship_ids||[]).length?`${(m.related_requirement_ids||[]).length} requirement(s), ${(m.related_relationship_ids||[]).length} relationship(s)`:'—'}</td></tr>`).join('');
// Batch 2: one row per EXISTING Stage 1 question, purely read-only inspection
// of assessStage1QuestionEvidence() (evidence.js) — never mutates anything.
let s1Rows=(typeof assessStage1QuestionEvidence==='function'?stage1Questions:[]).map(q=>{
let a=assessStage1QuestionEvidence(p,q[0]);
let mapped=a.mapping?a.mapping.subjects.join(', '):(a.contextRecords&&a.contextRecords.length?'(context only) '+STAGE1_CONTEXT_MAP.find(m=>m.question===q[0]).subjects.join(', '):'—');
let evidenceStatusCol=a.proposedRecord?a.proposedRecord.evidence_status:(a.conflictingRecord?a.conflictingRecord.evidence_status:(a.conflictRecords?a.conflictRecords.map(r=>r.evidence_status).join(', '):'—'));
let confCol=a.proposedRecord?a.proposedRecord.confidence:(a.conflictingRecord?a.conflictingRecord.confidence:'—');
let proposedCol=a.proposedValue!=null?a.proposedValue:(a.conflictProposedValue!=null?a.conflictProposedValue:(a.conflictRecords?a.conflictRecords.map(r=>r.extracted_value).join(' / '):'—'));
let confirmCol=a.assistState?`${esc(a.assistState.status)}${a.assistState.confirmedAt?' ('+new Date(a.assistState.confirmedAt).toLocaleString()+')':''}${a.assistState.correctedAt?' ('+new Date(a.assistState.correctedAt).toLocaleString()+')':''}`:'—';
let conflictCol=a.status==='CONFLICTING_EVIDENCE'?'<b>CONFLICT</b>':'—';
return `<tr><td>${esc(q[1])}</td><td>${esc(a.existingAnswer||'—')}</td><td class="meta">${esc(mapped)}</td><td>${esc(String(evidenceStatusCol))}</td><td>${esc(String(confCol))}</td><td>${esc(String(proposedCol))}</td><td><span class="pill">${esc(a.status)}</span></td><td class="meta">${confirmCol}</td><td>${conflictCol}</td></tr>`
}).join('');
app.innerHTML=`<div class="container"><div class="pagehead"><div><div class="eyebrow">Internal / development review only — not shown to customers</div><h1>Evidence ledger — ${esc(p.name)}</h1><p class="meta">Evidence Intelligence Batch 1/1B/2/3/4: extraction, provenance, cross-document checking, Stage 1 evidence assistance, Stage 2 evidence reasoning and Stage 3 action generation. Detailed Stage 3 actions only ever become customer-visible via the existing paid Stage 3 Solutions entitlement (route('stage3', id), gated on p.plan) — this page does not affect pricing, maps, drawings or reports outside the specific restrained cards authorised in Batch 3/4.</p></div><button class="btn secondary" onclick="route('project','${esc(id)}')">Back to project</button></div>
<div class="card"><h3>Documents</h3><p class="meta">Plain-text files, real PDFs and real DOCX files have their actual content read and classified. Image-only/scanned PDFs are marked OCR_REQUIRED (not OCR'd here). Any other/malformed file is marked UNSUPPORTED or EXTRACTION_FAILED — no content is ever fabricated.</p>${p.evidence&&p.evidence.length?`<div style="overflow-x:auto"><table><thead><tr><th>File</th><th>Document type</th><th>Confidence</th><th>Extraction status</th><th>Extraction note</th><th>Evidence function</th><th>Evidence maturity</th><th>Integrity limitations</th><th>Package(s)</th><th>Planning type/drawing status</th></tr></thead><tbody>${docRows}</tbody></table></div>`:'<p class="meta">No files uploaded yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Stage 1 evidence assistance</h3><p class="meta">Question → Customer answer → Mapped evidence → Evidence status → Confidence → Proposed answer → Confirmation state → Conflict state. Only ${STAGE1_EVIDENCE_MAP.length} of ${stage1Questions.length} Stage 1 questions currently have a governed evidence mapping (see the task report for every question individually evaluated and why the rest were not mapped) — the other rows correctly show "—".</p>${s1Rows?`<div style="overflow-x:auto"><table><thead><tr><th>Question</th><th>Customer answer</th><th>Mapped evidence subject(s)</th><th>Evidence status</th><th>Confidence</th><th>Proposed answer</th><th>Assist status</th><th>Confirmation state</th><th>Conflict</th></tr></thead><tbody>${s1Rows}</tbody></table></div>`:'<p class="meta">Not available.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Stage 2 findings (${Object.keys(p.stage2Findings||{}).length})</h3><p class="meta">Finding → Category → Status → Customer-facing summary → Internal detail → Supporting evidence → Confidence → Information still required → Stage 3 candidate → Resolved. The customer only ever sees the "Customer-facing summary" column (via the Stage 2 "Evidence-based observations" card) — nothing else on this page is shown to customers.</p>${findingRows?`<div style="overflow-x:auto"><table><thead><tr><th>Finding</th><th>Category</th><th>Status</th><th>Customer-facing summary</th><th>Internal detail</th><th>Supporting evidence</th><th>Confidence</th><th>Information still required</th><th>Stage 3 candidate</th><th>Resolved</th><th>Package/scope</th><th>Discrepancy/Authority/Missing</th><th>Apparent responsibility/Interface</th><th>Unresolved reason</th></tr></thead><tbody>${findingRows}</tbody></table></div>`:'<p class="meta">No Stage 2 findings yet — none of the evidence subjects with a governed finding rule have matching (non-low-confidence) evidence on this project.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Extracted evidence records (${recs.length})</h3><p class="meta">Document → Subject → Extracted value → Status → Confidence → Page/section → Corroboration/conflict</p>${recs.length?`<div style="overflow-x:auto"><table><thead><tr><th>Document</th><th>Subject</th><th>Extracted value</th><th>Status</th><th>Confidence</th><th>Page/section</th><th>Corrob. / conflict</th><th>Scope</th></tr></thead><tbody>${recRows}</tbody></table></div>`:'<p class="meta">No text-readable evidence documents on this project yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Parties (${Object.keys(parties).length})</h3><p class="meta">Party → Type → Confidence → Notes → Mentioned by (relationship count). Never invented independently of a relationship that actually mentions the party.</p>${partyRows?`<div style="overflow-x:auto"><table><thead><tr><th>Party</th><th>Type</th><th>Confidence</th><th>Notes</th><th>Mentioned by</th></tr></thead><tbody>${partyRows}</tbody></table></div>`:'<p class="meta">No parties identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Relationships (${(p.relationships||[]).length})</h3><p class="meta">Type → Package(s) → Scope → Party → Party (from) → Explicit/Inferred/Unclear → Confidence → Source file(s) → Exclusion/limit → Interface → Notes. RESPONSIBILITY_UNCLEAR rows record a genuine cross-document conflict — both original relationships are preserved elsewhere in this table, never silently resolved. Assistance/information-provision relationships (ASSISTED_BY/INFORMATION_PROVIDED_BY) are never promoted into a responsibility relationship by any code in this system.</p>${relRows?`<div style="overflow-x:auto"><table><thead><tr><th>Type</th><th>Package(s)</th><th>Scope</th><th>Party</th><th>Party (from)</th><th>Explicit/Inferred</th><th>Confidence</th><th>Source file(s)</th><th>Exclusion/limit</th><th>Interface</th><th>Notes</th></tr></thead><tbody>${relRows}</tbody></table></div>`:'<p class="meta">No responsibility relationships identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Discrepancies (${(p.discrepancies||[]).length})</h3><p class="meta">Type → Subject → Package/scope → Sources → Earlier → Later value → Basis → Consequence if unresolved → Requires confirmation. Interprets pairs Batch 1's own cross-document conflict detection already linked — both original evidence records remain intact and unaltered elsewhere on this page; never a chosen winner.</p>${discRows?`<div style="overflow-x:auto"><table><thead><tr><th>Type</th><th>Subject</th><th>Package/scope</th><th>Sources</th><th>Earlier → Later value</th><th>Basis</th><th>Consequence if unresolved</th><th>Requires confirmation</th></tr></thead><tbody>${discRows}</tbody></table></div>`:'<p class="meta">No discrepancies identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Authority requirements (${(p.authorityRequirements||[]).length})</h3><p class="meta">Authority → Requirement → Package/scope → Status → Response evidence → Acceptance/closure evidence. A response does not automatically mean satisfied; acceptance/closure require genuine authority-acceptance wording from a document with no integrity limitation.</p>${reqRows?`<div style="overflow-x:auto"><table><thead><tr><th>Authority</th><th>Requirement</th><th>Package/scope</th><th>Status</th><th>Response evidence</th><th>Acceptance/closure evidence</th></tr></thead><tbody>${reqRows}</tbody></table></div>`:'<p class="meta">No authority requirements identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Missing evidence (${(p.missingEvidence||[]).length})</h3><p class="meta">Subject → Expected evidence → Why expected → Status → Related requirements/relationships. A small, context-triggered rule table — never an uncontrolled checklist; a rule only appears here at all when its specific triggering context exists on this project.</p>${missRows?`<div style="overflow-x:auto"><table><thead><tr><th>Subject</th><th>Expected evidence</th><th>Why expected</th><th>Status</th><th>Related</th></tr></thead><tbody>${missRows}</tbody></table></div>`:'<p class="meta">No missing-evidence context triggered on this project.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Planning lifecycle (internal only)</h3><p class="meta">Planning Batch 1-2 (2026-08-26): signal only — now also surfaced, restrained, on the customer-facing Stage 2 page (see "Planning" card there) as of Planning Batch 2. APPROVED-family statuses require a genuine, integrity-checked authority decision — never inferred from a form/acknowledgement/consultee support/officer correspondence/statement/drawing title/filename/customer statement. FAVOURABLE_FORMAL_DECISION_PENDING requires every one of the governing brief's 7 conditions (Planning Batch 2 §5) — never a thin signal like "time has passed" or "one consultee said no objection".</p>${p.planningLifecycle?`<p><span class="pill">${esc(p.planningLifecycle.status)}</span></p><p class="meta">${esc(p.planningLifecycle.reason)}</p>${(p.planningLifecycle.evidence_files||[]).length?`<p class="meta">Evidence: ${p.planningLifecycle.evidence_files.map(esc).join(', ')}</p>`:''}`:'<p class="meta">Not computed.</p>'}${p.planningPortalReference?`<p class="meta">Application reference: ${esc(p.planningPortalReference.application_reference||'—')} · Authority: ${esc(p.planningPortalReference.authority_name||'—')}</p>`:''}</div>
<div class="card" style="margin-top:16px"><h3>Planning portal source (internal only)</h3><p class="meta">Planning Batch 5 (2026-08-26): provider-independent portal-source model — identity/reference fields update automatically and safely (no network activity); an actual retrieval attempt only ever happens when explicitly triggered below. The only adapter shipped in production honestly reports MANUAL_REVIEW_REQUIRED/RETRIEVAL_BLOCKED — this application cannot safely reach a real council portal from the browser without an insecure proxy, which it deliberately does not use. A blocked/failed check is never shown as "no documents".</p>${p.planningPortalSource?`<p><span class="pill">${esc(p.planningPortalSource.retrieval_status)}</span> <span class="meta">Identity: ${esc(p.planningPortalSource.identity_confidence)}</span></p><p class="meta">Authority: ${esc(p.planningPortalSource.authority_name||'—')} · Reference: ${esc(p.planningPortalSource.application_reference||'—')} · Provider: ${esc(p.planningPortalSource.provider_type||'—')}</p><p class="meta">${esc(p.planningPortalSource.notes||'')}</p>${p.planningPortalSource.last_checked_at?`<p class="meta">Last checked: ${new Date(p.planningPortalSource.last_checked_at).toLocaleString()}</p>`:''}${(p.planningPortalSource.retrieval_limitations||[]).length?`<p class="meta"><b>Retrieval limitations:</b> ${p.planningPortalSource.retrieval_limitations.map(esc).join(' ')}</p>`:''}${(p.planningPortalSource.documents_discovered||[]).length?`<div style="overflow-x:auto"><table><thead><tr><th>Title</th><th>Category</th><th>Relevant</th><th>New</th><th>Ingested</th><th>Duplicate</th></tr></thead><tbody>${p.planningPortalSource.documents_discovered.map(d=>`<tr><td class="meta">${esc(d.title||d.source_document_id||'—')}</td><td class="meta">${esc(d.category||'—')}</td><td>${d.relevant?'Yes':'No'}</td><td>${d.is_new?'Yes':'No'}</td><td>${d.ingested?'Yes':'No'}</td><td>${d.duplicate_of_existing?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="meta">No documents discovered yet.</p>'}<div class="actions" style="margin-top:8px"><button class="btn secondary" onclick="checkPlanningPortalSource('${esc(id)}')">Check planning source</button></div>`:'<p class="meta">Not yet computed.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Planning consultee responses (${(p.planningConsulteeResponses||[]).length})</h3><p class="meta">Source file → Consultee body → Meaning(s) → Note. "No observations"/"no objection" are never rendered as planning approval; a recommended condition is never rendered as a refusal risk.</p>${(p.planningConsulteeResponses||[]).length?`<div style="overflow-x:auto"><table><thead><tr><th>Source file</th><th>Consultee body</th><th>Meaning(s)</th><th>Note</th></tr></thead><tbody>${p.planningConsulteeResponses.map(r=>`<tr><td>${esc(r.source_file)}</td><td>${esc(r.consultee_body||'—')}</td><td>${(r.meanings||[]).join(', ')}</td><td class="meta">${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="meta">None identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Public / community objections (${(p.planningObjections||[]).length})</h3><p class="meta">Recorded separately from technical/statutory consultee responses — never merged. Weight/reason (Planning Batch 2, 2026-08-26) assess planning relevance and corroboration only — never whether the objector is "right".</p>${(p.planningObjections||[]).length?`<div style="overflow-x:auto"><table><thead><tr><th>Source file</th><th>Source type</th><th>Subject(s)</th><th>Weight</th><th>Weight reason</th></tr></thead><tbody>${p.planningObjections.map(o=>`<tr><td>${esc(o.source_file)}</td><td>${esc(o.source_type)}</td><td>${(o.subjects||[]).join(', ')}</td><td><span class="pill">${esc(o.weight||'—')}</span></td><td class="meta">${esc(o.weight_reason||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="meta">None identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Sensitive receptors (${(p.planningSensitiveReceptors||[]).length})</h3><p class="meta">Planning Batch 2 (2026-08-26): only ever recorded where the evidence itself mentions a receptor — never assumed for every industrial project. ${p.planningNoReceptorEvidenceNoted?'This project\'s own evidence explicitly notes an established industrial/commercial estate context with no residential/sensitive receptor identified.':'No explicit "established industrial estate, no receptor" wording has been noted on this project yet.'}</p>${(p.planningSensitiveReceptors||[]).length?`<div style="overflow-x:auto"><table><thead><tr><th>Source file</th><th>Type</th><th>Relationship</th><th>Note</th></tr></thead><tbody>${p.planningSensitiveReceptors.map(r=>`<tr><td>${esc(r.source_file)}</td><td>${esc(r.type)}</td><td>${esc(r.relationship)}</td><td class="meta">${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="meta">None identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Planning conditions / informatives / requirements (${(p.planningRequirements||[]).length})</h3><p class="meta">Type(s) are read from the decision notice's own Condition/Informative structure — never guessed from an isolated keyword. A Building Control mention is flagged separately, never folded into planning approval.</p>${(p.planningRequirements||[]).length?`<div style="overflow-x:auto"><table><thead><tr><th>Source file</th><th>Item</th><th>Type(s)</th><th>Text</th><th>Building Control separate note</th></tr></thead><tbody>${p.planningRequirements.map(r=>`<tr><td>${esc(r.source_file)}</td><td>${esc(r.item_number||'—')}</td><td>${(r.types||[]).join(', ')}</td><td class="meta">${esc(r.requirement_text)}</td><td>${r.building_control_separate_note?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="meta">None identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Approved drawing baseline (${(p.planningDrawings||[]).length})</h3><p class="meta">The latest APPLICABLE authority-approved revision controls the baseline — never simply the newest file uploaded. Earlier revisions are retained here as historical evidence, never deleted.</p>${(p.planningDrawings||[]).length?`<div style="overflow-x:auto"><table><thead><tr><th>Drawing number</th><th>Revision</th><th>Title</th><th>Decision source</th><th>Decision date</th><th>Status</th><th>Current baseline?</th></tr></thead><tbody>${p.planningDrawings.map(d=>`<tr><td>${esc(d.drawing_number)}</td><td>${esc(d.revision)}</td><td class="meta">${esc(d.drawing_title)}</td><td class="meta">${esc(d.decision_source_file)}</td><td>${esc(d.decision_date||'—')}</td><td><span class="pill">${esc(d.status)}</span></td><td>${d.is_current_baseline?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="meta">None identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Activity progression (internal only)</h3><p class="meta">Planning Batch 3 (2026-08-26): COMMERCIAL/PROGRAMME-RISK guidance only — never a legal permission state. A favourable outlook alone never authorises physical commencement (governing safeguard, enforced structurally, not just documented).</p>${p.planningActivityProgression?`<div style="overflow-x:auto"><table><thead><tr><th>Activity</th><th>Status</th><th>Commercial exposure</th><th>Reason</th></tr></thead><tbody>${Object.keys(p.planningActivityProgression).map(k=>{const a=p.planningActivityProgression[k];return `<tr><td>${esc(k)}</td><td><span class="pill">${esc(a.status)}</span></td><td>${esc(a.commercial_exposure||'—')}</td><td class="meta">${esc(a.reason||'—')}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="meta">Not computed.</p>'}${p.planningMostRestrictiveGate?`<p class="meta">Most restrictive current applicable gate: <span class="pill">${esc(p.planningMostRestrictiveGate.gate)}</span> — ${esc(p.planningMostRestrictiveGate.reason)}</p>`:'<p class="meta">Most restrictive current applicable gate: none identified.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Planning issue gates (${(p.planningIssueGates||[]).length})</h3><p class="meta">"What does this issue actually stop?" — issue-level gates, never collapsed into one generic project status. Every gate remains individually inspectable here regardless of the single most-restrictive headline above.</p>${(p.planningIssueGates||[]).length?`<div style="overflow-x:auto"><table><thead><tr><th>Source type</th><th>Source</th><th>Gate</th><th>Reason</th></tr></thead><tbody>${p.planningIssueGates.map(g=>`<tr><td>${esc(g.source_type)}</td><td class="meta">${esc(g.source_file||g.source_id||'—')}</td><td><span class="pill">${esc(g.gate)}</span></td><td class="meta">${esc(g.reason)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="meta">None identified yet.</p>'}</div>
<div class="card" style="margin-top:16px"><h3>Raw ledger (JSON, for full inspection)</h3><pre style="white-space:pre-wrap;font-size:12px;max-height:420px;overflow:auto;background:var(--soft);padding:12px;border-radius:8px">${esc(JSON.stringify(recs,null,2))}</pre></div>
</div>`
}
// Planning Batch 5 (2026-08-26): the ONE explicit, deliberately-triggered
// refresh boundary — never called automatically (no timers/background
// monitoring/server cron anywhere in this app). Internal/dev-only button,
// see evidenceLedgerPage() above. Uses the default (null) adapter, so in
// this production build it always honestly reports MANUAL_REVIEW_REQUIRED/
// RETRIEVAL_BLOCKED rather than fabricating a retrieval — see
// createNullPlanningPortalAdapter() in evidence.js.
function checkPlanningPortalSource(id){
if(!requireUser())return;let p=getP(id);if(!p)return;
if(typeof refreshPlanningPortalSource==='function')refreshPlanningPortalSource(p);
save();
evidenceLedgerPage(id);
}

// Stage 1 Question Reduction (2026-09-01, Architect + SPA authorised —
// see MASTER-SPEC.md § "Stage 1" and CHANGELOG.md § "2026-09-01 — Stage 1
// question reduction (17 -> 12)" for the full audit trail): the sequential
// customer-facing questionnaire dropped from 17 to 12 questions. FIVE
// questions were removed from THIS array — 'name', 'role', 'width',
// 'length', 'height' — but their fact keys, reasoning, evidence mappings
// (see STAGE1_EVIDENCE_MAP/FACT_RULES in evidence.js — width/length are
// UNCHANGED and still fact-key-addressable there) and every piece of
// downstream logic that reads p.facts.width/length/height/name/role
// (geometry.js's deriveGeometryFromFacts(), drawing.js, buildingDims()
// below, the report renderer, the buildingFootprint re-derivation
// safeguard in saveStage1()) are DELIBERATELY UNTOUCHED — nothing was
// deleted, renamed or rebuilt. Classification:
// RETIRED FROM SEQUENTIAL QUESTIONNAIRE — PLANNED FOR CONSOLIDATED
// CLIENT INPUT PAGE. A future, separate task will collect these five
// inputs together on one consolidated page and write them into these
// exact same p.facts keys, at which point every downstream mechanism
// listed above reconnects automatically — no rebuild required. Until
// that page exists, p.facts.width/length/height/name/role are simply
// not populated by the sequential flow; buildingDims() (below) already
// has a safe numeric fallback, and deriveGeometryFromFacts() already
// declines to fabricate a drawing when width/length/height are absent
// (see geometry.js's own comment) rather than inventing one — this is
// existing, intentional behaviour, not something newly introduced here.
//
// Revised 12-question Stage 1 workflow (was 17 — see above), evidence-led
// sequencing preserved exactly: Q1-Q7 -> Map 1 (building position) ->
// Q8-Q10 -> Map 2 (site boundary) -> Q11-Q12 -> Stage 1 report. (2026-11-14: the
// clearSpan question was later removed, so the live count is 11 and every position
// after 'heated' is one lower — all trigger points are fact-key based.) The
// Map 1/Map 2 trigger points in saveStage1() below were recomputed for
// the new question count (was idx===11/idx===14, now idx===6/idx===9) —
// they are hardcoded array positions, not fact-key lookups, so this was
// a required, deliberate part of this same change, not a separate one.
const stage1Questions=[
['address','Where is the proposed building site?','text','Full address or postcode'],
['structure','What type of structure are you considering?','select',['Free-standing building','Extension','Canopy','Link / tunnel']],
['use','What will the building be used for?','textarea','Describe the operation in plain English'],
['heated','Will the building be heated?','select',['Yes','No','Not sure']],
// REMOVED 2026-11-14: the 'clearSpan' question ("completely clear inside, without
// internal columns?") was retired — its answer fed no risk trigger, calculation or
// geometry. Legacy p.facts.clearSpan values on saved projects are left untouched
// and still load; they are simply no longer asked, flagged or echoed.
// Reworded from "How many roller doors do you need?" — same fact key ('rollerCount').
// REMOVED 2026-11-14: the follow-on Stage 1 "Roller door sizes and access" page. This
// question is now just the count; door sizes/access are set in Building Design. Legacy
// p.facts.rollerDoors on saved projects still loads and still seeds the drawing.
// REMOVED 2026-11-14: the Stage 1 'rollerCount' (vehicle doors) question page. Vehicle
// doors are set in Building Design; legacy p.facts.rollerCount still loads and seeds the drawing.
// Wording corrected 2026-08-26 (Job B fire-strategy evidence — see
// EVIDENCE-INTELLIGENCE-SPEC.md § "Recorded project evidence" and MASTER-SPEC.md §
// "Personnel doors / means-of-escape responsibility split"): this captures ONLY the
// customer's requested normal-access personnel-door quantity. It is not, and must
// never be presented as, a means-of-escape/fire-exit calculation or count — that is a
// separate, currently-unimplemented assessment (see the same governance sections).
['personnelDoors','How many personnel doors do you expect to need?','number',''],
// --- MAP 1 (building position) is shown here by saveStage1()/buildingPositionMap()
// once Q7 (personnelDoors, index 6) is answered — see advanceStage1() above. ---
// Reworded from "What is currently on the proposed footprint?" and moved to
// after Map 1 — the customer answers with their own site's satellite image
// already on screen, not from memory. New options extend (not replace) the
// original civils-flag intent: 'Concrete slab' is the only no-flag answer,
// exactly like the original 'Concrete' — see runStage1Risks() below for the
// two new options' (Existing building/structure, Mixed) flag treatment.
['base','What is currently on the area where the building will sit?','select',['Concrete slab','Tarmac / asphalt','Hardcore / stone','Soil / grass','Existing building / structure','Mixed','Not sure']]
];

function controlFor(q,val){
if(q[2]==='select')return `<select id="answer"><option value="">Choose…</option>${q[3].map(x=>`<option ${val===x?'selected':''}>${x}</option>`).join('')}</select>`;
// 'select-other': a plain-English select with a free-text escape hatch. #answer
// stays the <select> itself (so saveStage1()'s existing #answer read still works
// for every ordinary option — the __other__ branch is the only special case, see
// saveStage1() below), plus a companion #answerOther text input shown only when
// "Other" is chosen or already answered with a value not in the option list
// (round-tripping correctly on Back/forward and on "Review Stage 1").
if(q[2]==='select-other'){
let isOther=val&&!q[3].includes(val);
return `<select id="answer" onchange="document.querySelector('#answerOtherWrap').style.display=this.value==='__other__'?'block':'none'"><option value="">Choose…</option>${q[3].map(x=>`<option ${val===x?'selected':''}>${esc(x)}</option>`).join('')}<option value="__other__" ${isOther?'selected':''}>Other</option></select><div id="answerOtherWrap" style="margin-top:8px;${isOther?'':'display:none'}"><input id="answerOther" type="text" placeholder="Please specify" value="${esc(isOther?val:'')}"></div>`
}
if(q[2]==='textarea')return `<textarea id="answer" placeholder="${q[3]}">${esc(val)}</textarea>`;
return `<input id="answer" type="${q[2]}" value="${esc(val)}" placeholder="${q[3]||''}">`
}
function progressBar(idx,total){return `<div class="progressbar" aria-hidden="true"><span style="width:${Math.round(((idx+1)/total)*100)}%"></span></div>`}
function stage1HasValue(value){return value!==undefined&&value!==null&&String(value).trim()!==""}
function stage1StructureFromProjectType(type){
if(type==="Free-standing building")return "Free-standing building";
if(type==="Extension to an existing building")return "Extension";
if(type==="Building linked to existing premises")return "Link / tunnel";
if(["Loading or dispatch canopy","Covered loading bay","Service-yard canopy"].includes(type))return "Canopy";
return ""
}
function stage1KnownValue(p,key){
const facts=projectFacts(p),direct=facts[key];
if(projectIsSteelFreeStanding(facts)){
  if(key==="use")return facts.buildingUse||direct||"";
  if(key==="structure")return "Free-standing building";
  if(key==="address")return p.address||direct||"";
}
if(stage1HasValue(direct))return direct;
if(key==="address"&&stage1HasValue(p.address))return p.address;
if(key==="use"&&stage1HasValue(facts.buildingUse))return facts.buildingUse;
if(key==="structure")return stage1StructureFromProjectType(facts.buildingType);
return ""
}
function stage1QuestionAnswered(p,question){return stage1HasValue(stage1KnownValue(p,question[0]))}
const stage1DetailsKeys=new Set(["address","structure","use","heated","base"]);
// REMOVED 2026-11-14: the personnel doors question page is no longer asked in the
// steel (free-standing) flow, leaving it with no question pages. Doors are set in
// Building Design; legacy p.facts.personnelDoors still loads.
const steelRemovedStage1Keys=new Set(["personnelDoors"]);
const steelStage1Questions=stage1Questions.filter(([key])=>!stage1DetailsKeys.has(key)&&!steelRemovedStage1Keys.has(key));
function stage1QuestionsFor(p){
  // One route for every building type: the details are collected in Project Details, Site Layout and Building Design.
  return steelStage1Questions;
}
function stage1QuestionIndex(p,key){
  return stage1QuestionsFor(p).findIndex(question=>question[0]===key);
}
function continueStage1From(id,startIdx=0){
const p=getP(id);if(!p)return;
const questions=stage1QuestionsFor(p);
for(let idx=Math.max(0,startIdx);idx<questions.length;idx++){
const question=questions[idx];
if(!stage1QuestionAnswered(p,question))return moveStage1(id,idx);
}
// One route for every building type: Project Summary, then Site Layout, then Building Design.
return route("stage1Confirm",id)
}
function continueStage1(id){
const p=getP(id);if(!p)return;
if(p.stage1Complete)return moveStage1(id,0);
return continueStage1From(id,0)
}

// AESTHETIC GROUPED PAGE EDIT — REV2. Illustration used to start at question 3
// (index 2) — the two questions before that ('name', 'role') were the ONLY
// ones ever excluded from illustration. Stage 1 Question Reduction
// (2026-09-01) removed exactly those two questions (along with width/
// length/height, which were already >=2/illustrated) from the sequential
// array — see stage1Questions[] above — so every surviving question keeps
// EXACTLY the illustrated/not-illustrated status it already had; none of
// the 12 survivors change category. The correct, position-independent way
// to preserve that is simply: every surviving question is illustrated.
function isIllustratedQuestion(i){return true}
// Alternation is computed from the ordinal among *illustrated* questions only (not the
// raw question index), so a run of non-illustrated questions can never desync the
// above/below pattern.
function illustratedOrdinal(idx){let n=0;for(let i=0;i<idx;i++)if(isIllustratedQuestion(i))n++;return n}
// UNRESOLVED — no approved canopy question-page illustration asset exists yet. Checked
// the OneDrive staging folder that holds the source files for the three approved
// standard-building photos already in assets/ (First Page/Building1.png,
// QuestionPages3to18/Building2.png, ReportsPage/Building3.png — byte-size-identical to
// the deployed assets) and found no canopy equivalent there or anywhere else supplied.
// Left null rather than fabricated: canopy customers see no illustration on these
// pages (never the wrong structure's photo) until an approved asset is supplied — see
// PR description. Dropping an asset in here is the only change needed once it exists.
const CANOPY_QUESTION_VISUAL=null; // e.g. {src:'assets/project-check-canopy-questions.png',alt:'Illustration of a canopy structure'}
// APPROVED/LOCKED: the existing standard-building question-page illustration, unchanged.
function questionVisualFor(p){
return stage1KnownValue(p,"structure")==="Canopy"?CANOPY_QUESTION_VISUAL:{src:'assets/project-check-building-questions.png',alt:'Illustration of a modern industrial building'}
}
function stage1WorkspaceReadiness(p){
const facts=projectFacts(p);
const present=value=>value!==undefined&&value!==null&&String(value).trim()!=="";
const basisValues=[facts.role,facts.buildingUse,facts.buildingType,p.address,facts.length,facts.width,facts.height,facts.roofPitch,projectRidgeHeight(p)];
if(projectIsSteelFreeStanding(facts)){
basisValues.push(projectTemperatureCondition(facts),projectExistingBase(facts),projectReuseIntention(facts));
if(projectTemperatureCondition(facts)==="Other temperature requirement")basisValues.push(facts.requiredTemperatureC);
if(projectReuseNeedsEvidenceAnswer(facts))basisValues.push(projectSiteEvidenceAvailability(facts))
}
const basis=basisValues.filter(present).length;
const basisScore=Math.round((basis/basisValues.length)*45);
const documentScore=Math.min(stage1EvidenceCount(p),2)*5;
const questions=stage1QuestionsFor(p);
const answered=questions.filter(question=>stage1QuestionAnswered(p,question)).length;
const checks=[
  Boolean(p.stage1SummaryConfirmed), facts.siteLayoutStatus==='confirmed',
  facts.siteLayoutStatus==='confirmed'&&facts.buildingDesignStatus==='confirmed'
];
const detailsScore=Math.round(basis/basisValues.length*35);
const questionsScore=Math.round((questions.length?answered/questions.length:1)*40);
return p.stage1Complete&&stage1SteelReportGaps(p).length===0?100:
  Math.min(99,detailsScore+questionsScore+Math.round(checks.filter(Boolean).length/3*24));
}
function stage1Workspace(id){
if(!requireUser())return;let p=getP(id);if(!p)return route("dashboard");
document.body.dataset.page="stage1Workspace";
const facts=projectFacts(p),pitch=projectRoofPitch(p),ridge=projectRidgeHeight(p),readiness=stage1WorkspaceReadiness(p);
const documents=(p.evidence||[]).filter(item=>item.stage==="Stage 1");
const projectLocation=p.address||"";
const basisComplete=[facts.role,facts.buildingUse,facts.buildingType,p.address,facts.length,facts.width,facts.height].every(value=>value!==undefined&&value!==null&&String(value).trim()!=="")&&projectSteelRequirementsComplete(facts);
const source=(label,type="customer")=>`<span class="stage1-source stage1-source--${type}"><span aria-hidden="true"></span>${label}</span>`;
const basisItem=(label,value,sourceLabel="Customer entered",type="customer",wide=false)=>`<div class="stage1-basis-item${wide?" stage1-basis-wide":""}"><dt>${label}</dt><dd>${value}</dd>${source(sourceLabel,type)}${label==="Project documents"?`<button class="btn secondary" onclick="route('projectDocuments','${p.id}')">View all documents</button>`:`<button class="btn secondary journey-edit" aria-label="${type==="calculated"?"Edit dimensions":`Edit ${label.toLowerCase()}`}" onclick="editProjectField('${p.id}','${({"Your role":"psRole","Building use":"psUse","Building type":"psType","Will the building be heated?":"psTemperatureCondition","What is on the ground now":"psExistingBase","Use what is already there?":"psBaseReuse","Site drawings or surveys":"psSiteEvidence","Proposed building site address":"psAddress","Length":"psLength","Width":"psWidth","Inside height needed":"psHeight","Roof pitch":"psPitch","Height to the top of the roof (calculated)":"psWidth"})[label]}')">Edit</button>`}</div>`;
const steelRequirementDetails=projectIsSteelFreeStanding(facts)?`
${basisItem("Will the building be heated?",esc(projectTemperatureSummaryPlain(facts)||"Not added"))}
${basisItem("What is on the ground now",esc(projectExistingBase(facts)||"Not added"))}
${basisItem("Use what is already there?",esc(projectReuseIntention(facts)||"Not answered"))}
${projectReuseNeedsEvidenceAnswer(facts)?basisItem("Site drawings or surveys",esc(projectSiteEvidenceAvailability(facts)||"Not answered")):""}`:"";
app.innerHTML=`<main class="container stage1-workspace">
${projectJourneyNav(p,"overview")}
<section class="stage1-technical-header" aria-labelledby="stage1WorkspaceTitle"><div><div class="eyebrow">Free check · Your project</div><h1 id="stage1WorkspaceTitle">${esc(p.name)}</h1><p>Check your details below. Change anything that is wrong, add documents if you have them, then carry on.</p></div><span class="pill">${p.stage1Complete?"Complete":"In progress"}</span></section>
<section class="stage1-readiness-card" aria-label="Free check progress"><div class="stage1-readiness-row"><div><span>Free check progress</span><strong>${readiness}%</strong></div><p>${p.stage1Complete?"Free check done":"Your details, documents and answers"}</p></div><div class="progressbar stage1-readiness-progress" aria-hidden="true"><span style="width:${readiness}%"></span></div></section>
<section class="stage1-source-legend" aria-label="Information sources">${source("Customer entered")}${source("Drawing evidence","drawing")}${source("Calculated","calculated")}</section>
<section class="stage1-tech-card" aria-labelledby="projectBasisTitle"><div class="stage1-section-heading"><span>01</span><div><h2 id="projectBasisTitle">Your project details</h2><p>Use Edit beside a detail to change it. Your changes return here automatically.</p></div><button class="btn secondary" onclick="route('projectSettings','${p.id}')">Edit project details</button></div>
<dl class="stage1-basis-grid">
${basisItem("Your role",esc(facts.role||"Not added"))}
${basisItem("Building use",esc(facts.buildingUse||"Not added"))}
${basisItem("Building type",esc(facts.buildingType||"Not added"))}
${steelRequirementDetails}
${basisItem("Proposed building site address",esc(projectLocation||"Not added"),"Customer entered","customer",true)}
${basisItem("Length",projectMeasure(facts.length))}
${basisItem("Width",projectMeasure(facts.width))}
${basisItem("Inside height needed",projectMeasure(facts.height))}
${basisItem("Roof pitch",`${pitch}°`,"Customer selected")}
${basisItem("Height to the top of the roof (calculated)",ridge===null?"Add width and clear height":`${ridge.toFixed(2)} m`,"Calculated","calculated")}
${basisItem("Project documents",`${stage1EvidenceCount(p)} file${stage1EvidenceCount(p)===1?"":"s"}`,"Document register","drawing")}
</dl></section>
<section class="stage1-tech-card" aria-labelledby="evidenceReceivedTitle"><div class="stage1-section-heading"><span>02</span><div><h2 id="evidenceReceivedTitle">Your documents</h2><p>Upload drawings or supporting information here. Select View to open a file.</p></div><button class="btn secondary" onclick="route('projectDocuments','${p.id}')">View all documents</button></div>
<button type="button" class="btn secondary" onclick="document.querySelector('#workspaceDocumentFiles').click()">Upload documents here</button><input id="workspaceDocumentFiles" type="file" multiple accept=".pdf,.docx,.dwg,.png,.jpg,.jpeg" hidden><p id="workspaceUploadStatus" role="status" aria-live="polite"></p><p class="meta">PDF, DOCX, DWG, PNG or JPG. ${uploadsLabel(p,p.stage1Complete?p.stage:'Stage 1')}. DWG files open in CAD software after downloading.</p><div class="stage1-evidence-list">${documents.length?documents.map((document,index)=>`<article class="stage1-evidence-row"><div><strong>${esc(document.name||`Project document ${index+1}`)}</strong><span class="simple-file-line">${uploadFileDetail(document.name)}</span></div><button class="btn secondary" onclick="viewProjectDocument('${p.id}',${p.evidence.indexOf(document)})">${/\.dwg$/i.test(document.name||"")?"Download DWG":"View"}</button></article>`).join(""):`<div class="stage1-empty-evidence"><p>No files have been uploaded yet.</p></div>`}</div><p class="meta">${esc(UPLOAD_NOT_REVIEWED_TEXT)}</p></section>
<section class="stage1-tech-card" aria-labelledby="initialChecksTitle"><div class="stage1-section-heading"><span>03</span><div><h2 id="initialChecksTitle">Quick checks</h2><p>Based only on what you have told us so far.</p></div></div>
<div class="stage1-check-list">
<article class="stage1-check-row ${basisComplete?"is-ready":"needs-input"}"><span aria-hidden="true"></span><div><strong>Project details ${basisComplete?"ready":"need information"}</strong><p>${basisComplete?"Use, type, location and dimensions are carried forward without re-entry.":"Use the Edit buttons above to add your missing details."}</p></div></article>
<article class="stage1-check-row ${ridge===null?"needs-input":"is-ready"}"><span aria-hidden="true"></span><div><strong>Roof height estimate</strong><p>${ridge===null?"Add the clear span and clear height to calculate the ridge height.":`${pitch}° roof pitch produces an indicative ridge height of ${ridge.toFixed(2)} m for a ${projectMeasure(facts.width)} span.`}</p></div></article>
</div></section>
<section class="stage1-workspace-action"><div><div class="eyebrow">Your next step</div><h2>${p.stage1Complete?"See your probable problems":"Continue your free check"}</h2><p>${p.stage1Complete?"Your free check is done. See the problems we think are likely.":"Check your details, place the building on the site, then see your probable problems."}</p></div><button class="btn green" onclick="route('${p.stage1Complete?"stage1Summary":"stage1Confirm"}','${p.id}')">${p.stage1Complete?"See your probable problems":"Continue your free check"}</button>${callButton("btn secondary")}</section>
</main>`;
const upload=document.querySelector('#workspaceDocumentFiles');
upload.onchange=()=>uploadProjectFiles(p,upload,()=>stage1Workspace(id),document.querySelector('#workspaceUploadStatus'));
}

function stage1ConfirmationOutstanding(p){
const facts=projectFacts(p),account=accountRecord()||state.user||{},missing=[];
const customerName=facts.name||p.customerName||account.name||"";
const projectStatus=p.status||"Active";
const structure=stage1KnownValue(p,"structure");
const requireValue=(value,label)=>{if(!stage1HasValue(value))missing.push(label)};
requireValue(p.name,"Project name");
requireValue(customerName,"Customer name");
requireValue(account.company,"Company");
requireValue(projectStatus,"Project status");
requireValue(facts.role,"Your role in this project");
requireValue(p.address,"Proposed building site address");
requireValue(facts.buildingUse,"Building use");
requireValue(facts.buildingType,"Building type");
requireValue(structure,"Type of structure");
requireValue(facts.length,"Building length");
requireValue(facts.width,"Building clear span / width");
requireValue(facts.height,"Building clear height");
requireValue(facts.roofPitch,"Roof pitch");
if(projectIsSteelFreeStanding(facts)){
requireValue(projectTemperatureCondition(facts),"Will the building be heated?");
if(projectTemperatureCondition(facts)==="Other temperature requirement")requireValue(facts.requiredTemperatureC,"Required internal temperature");
requireValue(projectExistingBase(facts),"What is on the ground now");
requireValue(projectReuseIntention(facts),"Intention to reuse the existing surface");
if(projectReuseNeedsEvidenceAnswer(facts))requireValue(projectSiteEvidenceAvailability(facts),"Drawings, surveys or other site information")
}
return missing
}
function stage1SteelReportGaps(p){
  const gaps=stage1ConfirmationOutstanding(p);
  const facts=projectFacts(p);
  if(!facts.buildingPositionStatus||!facts.siteBoundaryStatus)gaps.push('Site Layout');
  return gaps;
}
function confirmSteelStage1Summary(id,next){
  const p=getP(id);
  if(!p)return;
  p.stage1SummaryConfirmed=true;
  save();
  route(next,id);
}
function stage1ConfirmationEvidenceNotices(p){
if(typeof assessStage1QuestionEvidence!=="function")return [];
const notices=[];
stage1QuestionsFor(p).forEach(question=>{
try{
const assist=assessStage1QuestionEvidence(p,question[0]);
if(!assist)return;
if(assist.status==="NEEDS_CUSTOMER_CONFIRMATION"&&assist.proposedRecord){
notices.push({type:"proposal",label:question[1],value:assist.proposedValue,source:assist.proposedRecord.source_file||"Uploaded document",where:assist.proposedRecord.source_page_or_section||""})
}else if(assist.status==="CONFLICTING_EVIDENCE"){
const record=assist.conflictingRecord||(Array.isArray(assist.conflictRecords)?assist.conflictRecords[0]:null);
notices.push({type:"conflict",label:question[1],value:assist.conflictProposedValue||(record?.extracted_value)||"",source:record?.source_file||"Uploaded documents",where:record?.source_page_or_section||""})
}
}catch(e){}
});
return notices
}
function stage1Confirm(id){
if(!requireUser())return;const p=getP(id);if(!p)return route("dashboard");
document.body.dataset.page="stage1Confirm";
const facts=projectFacts(p),account=accountRecord()||state.user||{},ridge=projectRidgeHeight(p);
const docs=(p.evidence||[]).filter(item=>item.stage==="Stage 1"),evidenceNotices=stage1ConfirmationEvidenceNotices(p);
const tag=(label,type="customer")=>`<span class="stage1-source stage1-source--${type}"><span aria-hidden="true"></span>${esc(label)}</span>`;
const valueOr=value=>stage1HasValue(value)?esc(value):'<span class="confirmation-missing">Still required</span>';
const item=(label,value,sourceLabel="Customer entered",type="customer")=>`<div class="stage1-basis-item"><dt>${esc(label)}</dt><dd>${value}</dd>${tag(sourceLabel,type)}</div>`;
const steelRequirementItems=projectIsSteelFreeStanding(facts)?`
${item("Will the building be heated?",valueOr(projectTemperatureSummaryPlain(facts)),projectTemperatureCondition(facts)?"Customer entered":"Still required",projectTemperatureCondition(facts)?"customer":"pending")}
${item("What is on the ground now",valueOr(projectExistingBase(facts)),projectExistingBase(facts)?"Customer entered":"Still required",projectExistingBase(facts)?"customer":"pending")}
${item("Use what is already there?",valueOr(projectReuseIntention(facts)),projectReuseIntention(facts)?"Customer entered":"Still required",projectReuseIntention(facts)?"customer":"pending")}
${projectReuseNeedsEvidenceAnswer(facts)?item("Drawings, surveys or site information",valueOr(projectSiteEvidenceAvailability(facts)),projectSiteEvidenceAvailability(facts)?"Customer entered":"Still required",projectSiteEvidenceAvailability(facts)?"customer":"pending"):""}
${item("Link to or near an existing building",esc(projectAdjacentExistingBuilding(facts)||"Not answered (optional)"),projectAdjacentExistingBuilding(facts)?"Customer entered":"Optional",projectAdjacentExistingBuilding(facts)?"customer":"pending")}`:"";
app.innerHTML=`<main class="container stage1-workspace stage1-confirmation">
${projectJourneyNav(p,"confirmation","stage1Workspace")}
<section class="stage1-technical-header confirmation-intro" aria-labelledby="stage1ConfirmTitle"><div><div class="eyebrow">Free check · Check your details</div><h1 id="stage1ConfirmTitle">Let's check what we know so far</h1><p>Before we go through what you'll probably face, here is what we have for <strong>${esc(p.name)}</strong>: what it's for, how big, where, whether there's a base already, and who will run the site. If anything is wrong, go back to your project and change it there.</p></div></section>
<section class="stage1-source-legend confirmation-legend" aria-label="Information sources">${tag("Customer / project record")}${tag("Drawing evidence","drawing")}${tag("Calculated","calculated")}${tag("Still to confirm","pending")}</section>

<section class="stage1-tech-card confirmation-section"><div class="stage1-section-heading"><span>01</span><div><h2>Project</h2><p>Account and project information already held.</p></div></div><dl class="stage1-basis-grid">
${item("Project name",valueOr(p.name),"Project record","customer")}
${item("Customer name",valueOr(facts.name||p.customerName||account.name),"Account / project record")}
${item("Company",valueOr(account.company),"Account record")}
${item("Project status",valueOr(p.status||"Active"),"Project record","customer")}
${item("Your role",valueOr(facts.role),stage1HasValue(facts.role)?"Customer entered":"Still required",stage1HasValue(facts.role)?"customer":"pending")}
</dl></section>

<section class="stage1-tech-card confirmation-section"><div class="stage1-section-heading"><span>02</span><div><h2>Site</h2><p>The site information currently held for this project.</p></div></div><dl class="stage1-basis-grid">
${item("Proposed building site address",valueOr(p.address),"Project record","customer")}
</dl></section>

<section class="stage1-tech-card confirmation-section"><div class="stage1-section-heading"><span>03</span><div><h2>Building</h2><p>Project details carried into Stage 1 without re-entry.</p></div></div><dl class="stage1-basis-grid">
${item("Building use",valueOr(facts.buildingUse),"Project record","customer")}
${item("Building type",valueOr(facts.buildingType),"Project record","customer")}
${steelRequirementItems}
${item("Type of structure",valueOr(stage1KnownValue(p,"structure")),stage1HasValue(stage1KnownValue(p,"structure"))?"Carried forward from building type":"Still required",stage1HasValue(stage1KnownValue(p,"structure"))?"customer":"pending")}
${item("Length",stage1HasValue(facts.length)?esc(facts.length)+" m":'<span class="confirmation-missing">Still required</span>',"Project record","customer")}
${item("Width",stage1HasValue(facts.width)?esc(facts.width)+" m":'<span class="confirmation-missing">Still required</span>',"Project record","customer")}
${item("Clear height",stage1HasValue(facts.height)?esc(facts.height)+" m":'<span class="confirmation-missing">Still required</span>',"Project record","customer")}
${item("Roof pitch",stage1HasValue(facts.roofPitch)?esc(facts.roofPitch)+"°":'<span class="confirmation-missing">Still required</span>',stage1HasValue(facts.roofPitch)?"Customer selected":"Still required",stage1HasValue(facts.roofPitch)?"customer":"pending")}
${item("Height to the top of the roof (calculated)",ridge===null?'<span class="confirmation-missing">Waiting for dimensions</span>':esc(ridge.toFixed(2))+" m","Calculated from current dimensions and roof pitch","calculated")}
</dl></section>

${stage1OptionalMarkup(p)}

<section class="stage1-tech-card confirmation-section"><div class="stage1-section-heading"><span>04</span><div><h2>Your documents</h2><p>${docs.length} Stage 1 document${docs.length===1?"":"s"} currently attached. </p></div></div>
<div class="confirmation-document-list">${docs.length?docs.map(document=>`<article class="confirmation-document"><div><strong>${esc(document.name||"Project document")}</strong><p class="meta simple-file-line">${uploadFileDetail(document.name)}</p></div><button class="btn secondary journey-edit" onclick="viewProjectDocument('${p.id}',${p.evidence.indexOf(document)})">${/\.dwg$/i.test(document.name||"")?"Download DWG":"View"}</button></article>`).join(""):'<p class="meta">No Stage 1 project documents are attached yet.</p>'}</div>
<p class="meta">${esc(UPLOAD_NOT_REVIEWED_TEXT)}</p>
${evidenceNotices.length?`<div class="confirmation-evidence-notices"><h3>Evidence needing confirmation</h3>${evidenceNotices.map(notice=>`<article class="confirmation-evidence-notice"><strong>${esc(notice.label)}</strong><p>${notice.type==="conflict"?"Document evidence conflicts with information already held.":"Document evidence suggests"}${notice.value?`: <b>${esc(notice.value)}</b>`:""}</p><p class="meta">Source: ${esc(notice.source)}${notice.where?` · ${esc(notice.where)}`:""}</p>${tag(notice.type==="conflict"?"Conflict — confirmation required":"Unconfirmed document proposal","pending")}</article>`).join("")}</div>`:""}
</section>

<section class="stage1-tech-card confirmation-section confirmation-outstanding"><div class="stage1-section-heading"><span>05</span><div><h2>Information still required</h2><p>Gaps in your answers and in your documents. This is a list only. It is not an all-clear.</p></div></div>
${stage1KnowledgeMarkup(p)}</section>

<section class="stage1-workspace-action confirmation-actions"><div><div class="eyebrow">Next</div><h2>Place the building on your site</h2><p>Show where the building will go, using the sizes you gave us.</p></div><div class="confirmation-action-buttons"><button class="btn secondary" onclick="route('stage1Workspace','${p.id}')">Back to my project</button><button class="btn green" onclick="route('siteLayout','${p.id}')">Continue to site layout</button></div></section>
</main>`;
{
  const actions=app.querySelector('.confirmation-action-buttons');
  actions.querySelector('.btn.green').onclick=()=>confirmSteelStage1Summary(id,'siteLayout');
  // "Open Stage 1 Free Report" lives on the Building Design page (buildingDesignFreeReportMarkup).
}
}

function stage1(id){
if(!requireUser())return;
const p=getP(id);if(!p)return route("dashboard");
// Apply Locked Application Shell to Remaining Pages (2026-09-02):
// explicit reset, not just reliance on render()'s original assignment —
// stage1ClientInput()/stage1Summary() (both reached by direct call, like
// this function) set data-page="stage1-shell" for their own different
// banner treatment; a customer clicking "Back" from the consolidated
// page returns here via moveStage1()->stage1(), a direct call that
// never goes through render(), so without this line the locked Q1-12
// compact header would incorrectly stay on the shell treatment.
document.body.dataset.page='stage1';
const questions=stage1QuestionsFor(p),savedQuestion=sessionStorage.getItem('s1q_'+id);
if(!questions.length)return continueStage1From(id,0);
const savedIndex=stage1QuestionIndex(p,savedQuestion);
const legacyKey=savedQuestion!==null&&/^\d+$/.test(savedQuestion)?stage1Questions[Number(savedQuestion)]?.[0]:null;
const firstUnanswered=questions.findIndex(question=>!stage1QuestionAnswered(p,question));
const idx=[savedIndex,stage1QuestionIndex(p,legacyKey),firstUnanswered,0].find(index=>index>=0);
const q=questions[idx],val=stage1KnownValue(p,q[0]);
let hint='';
// Evidence Intelligence Batch 2 — Stage 1 evidence assistance ONLY (see
// EVIDENCE-INTELLIGENCE-SPEC.md § "Evidence Intelligence Batch 2" and
// MASTER-SPEC.md). Never silently fills p.facts — a NEEDS_CUSTOMER_
// CONFIRMATION proposal always waits for an explicit Confirm/Correct click,
// and any conflict is shown, never auto-resolved. This question (`q[1]`)
// itself, its order, its wording and its technical reasoning are unchanged —
// this only adds an optional banner above the same existing input.
if(typeof assessStage1QuestionEvidence==='function'){
let assist=assessStage1QuestionEvidence(p,q[0]);
let dismissed=stage1EvidenceDismissed.has(id+':'+q[0]);
if(assist.status==='NEEDS_CUSTOMER_CONFIRMATION'&&!dismissed){
hint=`<div class="banner green evidence-assist"><b>We found this in your uploaded documents</b><div class="meta" style="margin-top:6px">Proposed answer: <b>${esc(assist.proposedValue)}</b></div><div class="meta">Source: ${esc(assist.proposedRecord.source_file)} — ${esc(assist.proposedRecord.source_page_or_section)}</div><div class="actions" style="margin-top:10px"><button type="button" class="btn green" onclick="confirmStage1Evidence('${esc(id)}',${idx})">Confirm</button><button type="button" class="btn secondary" onclick="correctStage1Evidence('${esc(id)}',${idx})">Correct</button></div></div>`
}else if(assist.status==='CONFLICTING_EVIDENCE'&&assist.existingAnswer){
hint=`<div class="banner warn evidence-assist"><b>New document evidence differs from your existing answer.</b><div class="meta" style="margin-top:6px">Your answer: <b>${esc(assist.existingAnswer)}</b></div><div class="meta">Found in ${esc(assist.conflictingRecord.source_file)} — ${esc(assist.conflictingRecord.source_page_or_section)}: <b>${esc(assist.conflictProposedValue)}</b></div><div class="meta">Please check and update your answer below if needed.</div></div>`
}else if(assist.status==='CONFLICTING_EVIDENCE'&&assist.conflictRecords){
hint=`<div class="banner warn evidence-assist"><b>Different information has been found in your uploaded documents.</b><div class="meta" style="margin-top:6px">Please confirm the correct information below.</div><div class="meta">${assist.conflictRecords.map(r=>`${esc(r.source_file)} (${esc(r.source_page_or_section)}): <b>${esc(r.extracted_value)}</b>`).join('<br>')}</div></div>`
}
if(!assist.existingAnswer&&assist.contextRecords&&assist.contextRecords.length){
const statusLabel={ASSUMED_IN_DOCUMENT:'stated as an assumption in a document',PROVISIONAL:'a provisional figure in a document',DOCUMENT_INTERNAL_INCONSISTENCY:'inconsistently stated within a document'};
hint+=`<div class="banner evidence-assist"><b>Context from your uploaded documents</b>${assist.contextRecords.map(r=>`<div class="meta" style="margin-top:6px">"${esc(r.extracted_value)}" — ${esc(statusLabel[r.evidence_status]||r.evidence_status)}. Source: ${esc(r.source_file)} — ${esc(r.source_page_or_section)}.</div>`).join('')}<div class="meta" style="margin-top:6px">This is not a confirmed answer — please answer based on what you actually know.</div></div>`
}
}
// REMOVED 2026-08-26 (Job B fire-strategy evidence — see EVIDENCE-INTELLIGENCE-SPEC.md
// § "Recorded project evidence" and MASTER-SPEC.md § "Personnel doors / means-of-escape
// responsibility split"): this question no longer shows a "preliminary personnel/fire
// door allowance" banner derived from building perimeter ÷ 32 m. That calculation
// blurred customer-requested personnel doors, means-of-escape exit provision and
// fire-resisting doors into one invented number, which the Job B evidence shows is
// not how a real means-of-escape assessment works (travel distance/occupancy/exit
// direction, not perimeter ÷ 32). The customer's answer to this question is now stored
// exactly as given, with no suggested/calculated value offered or substituted. The old
// perimeter ÷ 32 m rule (`suggestedPersonnelDoorAllowance()`, geometry.js) is preserved
// unaltered for provenance/history but is no longer wired into any live customer-facing
// Stage 1 or Stage 2 output — see geometry.js for its retirement from validateGeometry().
let visual=isIllustratedQuestion(idx)?questionVisualFor(p):null;
let showBuilding=!!visual;
let imageAbove=showBuilding&&illustratedOrdinal(idx)%2===1;
// q[4] (Q14/Q16's helper text, 2026-08-27 revised workflow) — plain-English
// reassurance/Stage-2-boundary text shown under the question, separate from
// the evidence-assist `hint` banner above (which is data-driven, not static).
const steelHints={};
const questionHint=projectIsSteelFreeStanding(projectFacts(p))?(steelHints[q[0]]||q[4]):q[4];
let helperText=questionHint?`<p class="meta" style="margin-top:6px">${esc(questionHint)}</p>`:'';
const rollerQuestionIndex=stage1QuestionIndex(p,'rollerCount');
const editRollerRequirements=projectIsSteelFreeStanding(projectFacts(p))&&rollerQuestionIndex>=0&&idx!==rollerQuestionIndex&&stage1HasValue(projectFacts(p).rollerCount)
  ?`<button type="button" class="btn secondary" onclick="moveStage1('${esc(id)}',${rollerQuestionIndex})">Edit vehicle door requirements</button>`:'';
let questionContent=`<div class="q-content"><h2>${esc(q[1])}</h2>${helperText}${hint}<div class="field">${controlFor(q,val)}</div><div class="actions"><button class="btn secondary" ${idx===0?'disabled':''} onclick="moveStage1('${esc(id)}',${idx-1})">Back</button><button class="btn green" onclick="saveStage1('${esc(id)}',${idx})">Save & continue</button></div></div>`;
let illustration=showBuilding?`<div class="q-illustration"><img src="${esc(visual.src)}" alt="${esc(visual.alt)}"></div>`:'';
let questionCard=imageAbove?illustration+questionContent:questionContent+illustration;
app.innerHTML=`<div class="container"><div class="pagehead"><div><div class="eyebrow">Free check · Question ${idx+1} of ${questions.length}</div><h1>${esc(p.name)}</h1></div><button class="btn secondary" onclick="route('project','${esc(id)}')">Save and exit</button></div>${progressBar(idx,questions.length)}<div class="stage-layout"><div class="steps" tabindex="0" role="list" aria-label="Stage 1 questions">${questions.map((x,i)=>`<div class="step ${i===idx?'active':stage1QuestionAnswered(p,x)?'done':''}" role="listitem">${i+1}. ${esc(x[1].replace(/\?.*/,''))}</div>`).join('')}</div><div class="card${showBuilding?' q-card':''}">${questionCard}</div></div>${editRollerRequirements?`<div class="actions">${editRollerRequirements}</div>`:''}</div>`
// Question height varies (REV2 illustration alternates above/below, some
// questions carry an extra hint banner), and this is a full innerHTML
// replacement, not a navigation, so the browser never resets scroll on its
// own. Without this, advancing from a taller question to a shorter one
// leaves the view scrolled to wherever the previous (taller) question put
// it, which can push the question-navigation sidebar/header off-screen
// above the fold — confirmed via the Stage 1 Q4(tall)->Q5(short) case.
window.scrollTo(0,0);
}
function moveStage1(id,idx){
const p=getP(id),question=p&&stage1QuestionsFor(p)[idx];
if(question){sessionStorage.setItem('s1q_'+id,question[0]);stage1(id)}
}
// Batch 2: "Correct" on an evidence-assist banner never has its own save
// path — it only hides the banner (session-local, not persisted; a reload
// safely re-proposes the same evidence) so the customer types into the
// exact same #answer input and clicks the exact same "Save & continue"
// below, reusing every bit of existing validation/navigation. saveStage1()
// itself detects whether a live proposal existed for this question and
// records the divergence for provenance — it never blocks or alters the
// save.
let stage1EvidenceDismissed=new Set();
function correctStage1Evidence(id,idx){
const p=getP(id),question=p&&stage1QuestionsFor(p)[idx];
if(question){stage1EvidenceDismissed.add(id+':'+question[0]);stage1(id)}
}
// Confirm applies the SAME facts/history/navigation path as saveStage1()
// below (including the rollerCount/last-question special cases), so an
// evidence-confirmed answer behaves identically to a typed one from every
// other part of the app — the only difference is provenance is recorded via
// applyStage1EvidenceConfirm() (evidence.js) rather than the answer being
// bare. Re-derives the proposal itself rather than trusting stale UI state,
// so a stray/duplicate click can never confirm something no longer valid.
function confirmStage1Evidence(id,idx){
let p=getP(id),q=p&&stage1QuestionsFor(p)[idx];
if(!q)return;
if(typeof assessStage1QuestionEvidence!=='function')return;
let assist=assessStage1QuestionEvidence(p,q[0]);
if(!assist||assist.status!=='NEEDS_CUSTOMER_CONFIRMATION'||!assist.proposedRecord)return;
applyStage1EvidenceConfirm(p,q[0],assist.proposedRecord,assist.proposedValue);
if(q[0]==='address')p.address=assist.proposedValue;if(q[0]==='name')p.customerName=assist.proposedValue;
p.history.push({at:now(),text:`Stage 1 answer confirmed from uploaded evidence: ${q[1]}`});
save();
advanceStage1(id,idx,p)
}
// Shared block-transition logic for both saveStage1() and confirmStage1Evidence()
// (2026-08-27, revised 17-question workflow; indices recomputed 2026-09-01
// for the Stage 1 Question Reduction, 17 -> 12 — see stage1Questions[]
// above) — after an answer is saved/confirmed, decide what comes next: the
// vehicle-door sub-screen, Map 1 (after Q7/personnelDoors), Map 2 (after
// Q10/services), Stage 1 finalisation + report (after Q12/programme), or
// simply the next question. Kept in one place so the two save paths can
// never drift apart on where the maps sit in the sequence. These two
// indices are hardcoded ARRAY POSITIONS, not fact-key lookups, so removing
// five questions from stage1Questions[] required recomputing them here —
// this is the one genuinely position-dependent piece of downstream logic
// the question-reduction change had to touch (everything else in this
// file reads stage1Questions[idx][0] by fact key or stage1Questions.length
// generically, so it already adapts automatically).
function advanceStage1(id,idx,p){
return continueStage1From(id,idx+1)
}
// Geometry/data-continuity fix (2026-08-27, Customer Journey Completion —
// Stage 1 completion repair), extracted into its own function 2026-09-02
// (Consolidated Client Input Page) so it has exactly ONE implementation
// shared by saveStage1() (still dormant via the sequential flow — width/
// length can no longer be q[0] there) and saveStage1ClientInput() below —
// never two separate re-derivation code paths. A customer's width/length
// value reaching p.facts must never leave a silently stale
// buildingFootprint (old/default dimensions baked into its corners)
// sitting in the Project Record — recompute it from the SAME confirmed
// centre/rotation (metresToFootprintCorners(), the existing common-
// geometry helper — no second geometry model) with the CURRENT
// buildingDims(p), so the customer never has to redo their map placement
// merely because a dimension changed.
// WIDENED 2026-09-02: the original version only fired when an OLD value
// already existed and differed from the new one (old&&old!==v) — correct
// for the previous architecture, where width/length were answered BEFORE
// Map 1, so a genuine "edit" always had a real old value to compare
// against. In the new architecture, Map 1 is reached (and may be
// confirmed) BEFORE width/length are known at all — buildingDims()'s own
// safe ||10 fallback sizes that footprint provisionally, and the
// consolidated page's FIRST-ever save of the real width/length (where
// p.facts.width was previously undefined, not merely different) is
// exactly the case that most needs this safeguard to fire. Dropping the
// old&&old!==v gate and comparing the footprint's OWN stored dimensions
// against the current buildingDims(p) (the inner check already did this)
// covers both the original "genuine edit" case and this new "first real
// value arrives after a provisional placement" case identically, and
// still correctly no-ops whenever the footprint already matches (no
// spurious history entries) or is unconfirmed/absent (matches the
// existing "a SKIPPED building position is never affected" guarantee).
function reconcileFootprintWithCurrentDimensions(p){
if(p.facts.buildingPositionStatus==='confirmed'&&p.facts.buildingFootprint?.center){
let fp=p.facts.buildingFootprint,d=buildingDims(p);
if(String(fp.width)!==String(d.width)||String(fp.length)!==String(d.length)){
let corners=metresToFootprintCorners(fp.center,d.width,d.length,fp.angle).map(x=>({lat:x[0],lng:x[1]}));
p.facts.buildingFootprint={center:fp.center,width:d.width,length:d.length,angle:fp.angle,corners};
p.history.push({at:now(),text:`Building footprint re-derived on Map 1 after a dimension change (now ${d.width} m × ${d.length} m) — position and rotation retained.`})
}
}
// Building-regs calculation (and any saved regs-checker results) re-run after any building size change.
if(typeof pcBuildingRegsRun==='function')pcBuildingRegsRun(p);
if(p.backgroundChecks&&p.backgroundChecks.regsChecker&&typeof runRegsChecker==='function')runRegsChecker(p);
}
function saveStage1(id,idx){
let p=getP(id),q=p&&stage1QuestionsFor(p)[idx],v;
if(!q)return;
// 'select-other': #answer is the <select> itself; only when "Other" is
// chosen do we read the companion free-text #answerOther instead — every
// ordinary option still resolves from #answer exactly like a plain select.
// (Was Q2/role, the only question using this control type — 'role' was
// removed from the sequential array in the Stage 1 Question Reduction,
// 2026-09-01, so this branch is currently unreachable via the live flow;
// left fully intact, unrebuilt, in case a future question reuses this
// control type.)
if(q[2]==='select-other'){
let sel=document.querySelector('#answer').value;
v=sel==='__other__'?(document.querySelector('#answerOther')?.value||'').trim():sel
}else{
v=document.querySelector('#answer').value.trim()
}
if(!v)return alert('Please answer this question before continuing.');
if(q[0]==='rollerCount'&&projectIsSteelFreeStanding(projectFacts(p))){
  const count=Number(v);
  if(!Number.isInteger(count)||count<0||count>20)return alert('Enter a whole number from 0 to 20.');
  // The Stage 1 roller-door sizes/access page was removed (2026-11-14): only the
  // count is asked here. Door sizes are set in Building Design. Any previously
  // saved facts.rollerDoors entries are kept, trimmed only if beyond the new count.
  if(Array.isArray(p.facts.rollerDoors)&&p.facts.rollerDoors.length>count)p.facts.rollerDoors=p.facts.rollerDoors.slice(0,count);
}
let old=p.facts[q[0]];
// Batch 2: record (not block) when the customer's own typed/selected answer
// diverges from a live evidence proposal for this question — "Correct" or
// simply typing over an unconfirmed banner both land here. The original
// evidence record is untouched; only this small provenance note is added.
if(!old&&typeof assessStage1QuestionEvidence==='function'){
let assist=assessStage1QuestionEvidence(p,q[0]);
if(assist&&assist.status==='NEEDS_CUSTOMER_CONFIRMATION'&&assist.proposedRecord)recordStage1EvidenceCorrection(p,q[0],assist.proposedRecord,assist.proposedValue,v)
}
p.facts[q[0]]=v;if(q[0]==='address')p.address=v;if(q[0]==='name')p.customerName=v;
if(old&&old!==v)p.history.push({at:now(),text:`Stage 1 answer changed: ${q[1]}`});else if(!old)p.history.push({at:now(),text:`Stage 1 information added: ${q[1]}`});
// Geometry/data-continuity fix (2026-08-27, Customer Journey Completion —
// Stage 1 completion repair): a customer changing width/length AFTER already
// confirming the building footprint on Map 1 must never leave a silently
// stale buildingFootprint (old dimensions baked into its corners) sitting
// in the Project Record. Re-derive the footprint from the SAME confirmed
// centre/rotation (metresToFootprintCorners(), the existing common-geometry
// helper — no second geometry model) with the NEW dimensions, so the
// customer does not have to redo their map placement merely because they
// corrected a size — but this is never silent: it is recorded in history
// exactly like any other Stage 1 change, and only ever fires when a
// confirmed footprint with genuinely different dimensions already exists.
// DORMANT since the Stage 1 Question Reduction (2026-09-01): this block is
// gated on q[0]==='width'||q[0]==='length', and both were removed from
// stage1Questions[] — see above — so saveStage1() can no longer be called
// with either as q[0] via the live sequential flow. Left fully intact,
// unrebuilt, exactly per the retirement classification: a future
// consolidated client-input page writing into p.facts.width/length will
// Consolidated Client Input Page (2026-09-02 — see MASTER-SPEC.md/
// CHANGELOG.md): this reconnected the day this comment was written. Now
// calls the shared reconcileFootprintWithCurrentDimensions(p) helper
// (defined just above saveStage1ClientInput() below) instead of its own
// inline copy of this logic — same exact behaviour for this (still
// dormant via the sequential flow, since width/length can't be q[0]
// here), and the SAME helper the new consolidated page's save handler
// calls, so there is exactly one re-derivation code path, not two.
if(q[0]==='width'||q[0]==='length')reconcileFootprintWithCurrentDimensions(p);
// Regs checker reads Stage 1 answers (heated, use, base): re-run saved results so they never go stale.
if(p.backgroundChecks&&p.backgroundChecks.regsChecker&&typeof runRegsChecker==='function')runRegsChecker(p);
save();
advanceStage1(id,idx,p)
}
// Default roller door size for an access type. The size table lives in
// building-layout.js (pcDoorSizeDefault), next to the Building Design door code.
function doorRuleFor(access){
return typeof pcDoorSizeDefault==='function'?pcDoorSizeDefault(access):null
}
let activeBuildingMap=null,activeBuildingMarker=null,activeFootprintAngle=0;
// One shared measurement implementation, reused on whichever map screen is currently
// open (building-position or site-boundary) — see activeMeasureMap below. Not a second,
// incompatible measurement system. activeMeasureMap doubles as "whichever map is
// currently on screen" for the shared map-VIEW-bearing controls added in the Stage 1
// Map Architecture task (rotateMapView()/resetMapNorth() below) — there is only ever
// one live map at a time, so a second "current map" reference is not needed.
let measureMode=null,measurePoints=[],activeMeasureMap=null;
let activeBoundaryMap=null,activeBoundaryPoints=[],activeBoundaryFootprintAngle=0;
// --- Map renderer: MapLibre GL JS (2026-08-27, Stage 1 Map Architecture task) ---
// Replaces Leaflet. Leaflet's core has no map-bearing/rotation concept; MapLibre is
// rotation-native (true bearing, built-in two-finger touch rotate) while still using
// plain raster XYZ tile sources — the same Esri satellite / OSM street tiles as
// before, unchanged, no vector-tile migration. See CODE-MAP.md/CHANGELOG.md.
//
// GOVERNING SEPARATION for this whole section:
//   MAP BEARING (camera/view rotation, transient display state)
//     != BUILDING ROTATION (activeFootprintAngle — engineering/project geometry)
//     != stored geographic lat/lng of the building footprint or site boundary.
// Rotating the map view calls ONLY map.rotateTo()/map.getBearing() — it never reads
// or writes p.facts, activeFootprintAngle, activeBoundaryFootprintAngle, or any
// corner/coordinate array. Every function that touches those stays exactly as
// geography-only as it was under Leaflet.
function mapStyleSpec(){
return {
version:8,
sources:{
'osm-street':{type:'raster',tiles:['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png','https://b.tile.openstreetmap.org/{z}/{x}/{y}.png','https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'&copy; OpenStreetMap contributors'},
'esri-satellite':{type:'raster',tiles:['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Tiles &copy; Esri'}
},
layers:[
{id:'esri-satellite-layer',type:'raster',source:'esri-satellite',layout:{visibility:'visible'}},
{id:'osm-street-layer',type:'raster',source:'osm-street',layout:{visibility:'none'}}
]
}}
function setBaseLayer(map,which){
if(!map||!map.getLayer('esri-satellite-layer'))return;
map.setLayoutProperty('esri-satellite-layer','visibility',which==='satellite'?'visible':'none');
map.setLayoutProperty('osm-street-layer','visibility',which==='street'?'visible':'none')
}
// Map-view bearing is explicitly VIEW/display state, not project geometry — stored
// separately in sessionStorage (same idiom as the existing 's1q_'+id question-index
// state), never in p.facts, and never read back into activeFootprintAngle or any
// engineering calculation. Shared by both map screens so Map 1's chosen bearing
// carries into Map 2, and a "Save & exit" -> "Review Stage 1" round trip (this
// session only) preserves the last useful view rather than resetting to north.
function getSavedMapBearing(id){return Number(sessionStorage.getItem('pcMapBearing_'+id))||0}
function saveMapBearing(id,bearing){sessionStorage.setItem('pcMapBearing_'+id,String(((bearing%360)+360)%360))}
function updateBearingReadout(map){
let el=document.querySelector('#mapBearingReadout');if(!el||!map)return;
let b=Math.round(((map.getBearing()%360)+360)%360);
el.textContent=b===0?'Map view: facing North':`Map view: facing ${b}°`
}
// Shared MapLibre map factory for both Stage 1 map screens. pitch is hard-locked to 0
// three separate ways (maxPitch/minPitch/pitchWithRotate) — this task is map BEARING,
// not 3D/tilt. touchZoomRotate (pinch-zoom + two-finger rotate together) is left at
// its MapLibre default of enabled; touchPitch (two-finger vertical-drag tilt) is
// explicitly disabled so a rotate gesture can never also tilt the map.
function createProjectCheckMap(containerId,center,zoom,bearing){
let map=new maplibregl.Map({
container:containerId,style:mapStyleSpec(),
center:[center.lng,center.lat],zoom,bearing:bearing||0,
pitch:0,maxPitch:0,minPitch:0,pitchWithRotate:false,touchPitch:false,
attributionControl:true
});
map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true,visualizePitch:false}),'top-right');
map.on('rotate',()=>updateBearingReadout(map));
updateBearingReadout(map);
return map
}
function metresToFootprintCorners(center,widthM,lengthM,angleDeg){
const lat=center.lat,lng=center.lng,latRad=lat*Math.PI/180,mPerDegLat=111320,mPerDegLng=Math.max(1,111320*Math.cos(latRad)),halfW=(Number(widthM)||0)/2,halfL=(Number(lengthM)||0)/2,theta=(Number(angleDeg)||0)*Math.PI/180;
return [[-halfW,-halfL],[halfW,-halfL],[halfW,halfL],[-halfW,halfL]].map(([x,y])=>{const xr=x*Math.cos(theta)-y*Math.sin(theta),yr=x*Math.sin(theta)+y*Math.cos(theta);return [lat+(yr/mPerDegLat),lng+(xr/mPerDegLng)]})
}
function buildingDims(p){return {width:Math.max(1,Number(p.facts.width)||10),length:Math.max(1,Number(p.facts.length)||10)}}
// Draws/updates the building-footprint polygon as a GeoJSON source+layer pair
// (MapLibre has no L.polygon-style imperative shape API). metresToFootprintCorners()
// itself is completely unchanged — this only converts its [lat,lng] output into the
// [lng,lat] GeoJSON ring MapLibre expects, at the narrowest possible point, so no
// geometry math anywhere else in the app needs to know MapLibre exists. Guarded by
// isStyleLoaded() because addSource/addLayer (unlike Leaflet's addTo()) require the
// style to have finished its first load — see createProjectCheckMap() comment.
function updateBuildingLayer(p,map,center,angle,mode){
const d=buildingDims(p),corners=metresToFootprintCorners(center,d.width,d.length,angle);
const ring=corners.map(([lat,lng])=>[lng,lat]);ring.push(ring[0]);
const geojson={type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{}};
const srcId=mode==='building'?'building-footprint':'boundary-footprint',color=mode==='building'?'#1f6f5c':'#2f5ea8';
const apply=()=>{
const src=map.getSource(srcId);
if(src)src.setData(geojson);
else{
map.addSource(srcId,{type:'geojson',data:geojson});
map.addLayer({id:srcId+'-fill',type:'fill',source:srcId,paint:{'fill-color':color,'fill-opacity':mode==='building'?.22:.18}});
map.addLayer({id:srcId+'-line',type:'line',source:srcId,paint:{'line-color':color,'line-width':3}})
}
};
if(map.isStyleLoaded())apply();else map.once('load',apply);
return corners
}
async function geocode(q){let res=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error('search unavailable');let x=await res.json();return x[0]||null}

function runStage1Risks(p){
let f=p.facts,risks=[];
// `discipline` (2026-08-27, Stage 1 report restructuring — see MASTER-SPEC.md/
// CHANGELOG.md) is a PRESENTATION-ONLY grouping added alongside the existing
// `category` (issue/cost/programme, unchanged, still used by the internal
// review table). It does not change, remove, or add any trigger condition
// below — every existing rule fires on exactly the same facts as before.
// 'civils' = ground/base/level/services/drainage-adjacent; 'planning' =
// boundary/neighbour/approvals-adjacent; 'engineering' = building
// specification/compliance-adjacent; 'site' = the two site/map confirmation
// flags; 'general' = programme/commercial, not discipline-specific.
const add=(text,category,discipline)=>risks.push({text,category,discipline:discipline||'general'});
// Stage 1 answer checks (foundation/base, site levels, programme) come from the regs checker:
// rules FOUNDATION_BASE, SITE_LEVELS and PROGRAMME in regs-checker/rules.json, run by
// stage1AnswerChecks() in regs-checker/checker.js. Boundary, heating and services/drainage flags
// are covered by the regs-checker rules (B_BOUNDARY*, A_FRAME_BOUNDARY, L_ENERGY, L_2027_HEATED,
// H_DRAINAGE_QUOTE) and are not repeated here.
const answerChecks=typeof stage1AnswerChecks==='function'?stage1AnswerChecks(p):{risks:[],needInfo:[]};
answerChecks.risks.forEach(item=>add(item.text,item.category,item.discipline));
if(projectReuseIntention(f)==='Yes — assess it for reuse')add('You would like to reuse what is already there if it proves suitable. We don\'t yet know the levels, drainage, services or what the ground can carry.','cost','civils');
if(projectReuseIntention(f)==='Not sure')add('You have not decided whether to reuse what is already there. Nobody can say what it will cost until that is checked.','cost','civils');
const steel=projectIsSteelFreeStanding(f);
let specialistLowTemperatureFlag=steel?stage1SteelEnvelope(f).label==='Get professional support':Boolean(p.stage1Assessments?.specialistLowTemperatureFlag);
if(specialistLowTemperatureFlag)add('A store colder than 2°C needs specialist design.','cost','engineering');
if(!risks.length)add(steel?'Nothing big stood out from what you told us. The project still needs checking before you commit.':'Nothing big stood out from what you told us. More checks are still needed before you commit.','issue','general');
let actions=[steel?'Fill the gaps and get the checks done before you commit to a supplier.':'Do the paid stage before you commit to a supplier.'];
if(projectReuseNeedsEvidenceAnswer(f)&&!p.evidence.length)actions.push('Upload any surveys, drawings or reports you already have for the site.');
if(f.buildingPositionStatus==='skipped'||f.siteBoundaryStatus!=='confirmed')actions.push('Place the building and mark the site boundary on the map.');
if(projectReuseIntention(f)==='Yes — assess it for reuse')actions.push('Have the existing surface checked before you assume it can be reused.');
if(specialistLowTemperatureFlag)actions.push('Ask a specialist about the walls, floor, doors and temperature control.');
p.risks1=risks;p.actions1=actions
}
function stage1MissingInfo(p){
let f=p.facts,missing=[];
// 'Unknown' retained here for legacy projects saved before the 2026-08-27
// wording revision (base's 'Unknown' option became 'Not sure') — still a
// valid stored value on any pre-existing project, must keep being recognised.
const uncertain=v=>['Not sure','Unknown'].includes(v);
const check=(key,label)=>{if(f[key]&&uncertain(f[key]))missing.push(`${label}: you said "${f[key]}", so we treat this as not known yet.`)};
check('level','Ground levels');check('services','Drains and services');check('closeBoundary','Boundaries and nearby buildings');check('base','What is on the ground now');
// level's plain 'No' (not level / gradient present) is a level-specific
// uncertain signal — added separately rather than to the shared `uncertain()`
// list above, since a bare 'No' is a legitimate, CONFIDENT answer for other
// keys (services='No', closeBoundary='No' both mean "no issue", not
// "unconfirmed") and must not be flagged there.
// Level "No", building position and site boundary need-info lines come from the regs checker
// (rules SITE_LEVELS and MAP_NOT_CONFIRMED in regs-checker/rules.json).
(typeof stage1AnswerChecks==='function'?stage1AnswerChecks(p).needInfo:[]).forEach(item=>missing.push(item.text));
if(projectReuseIntention(f)==='Not sure')missing.push('Whether you want to reuse what is already on the ground: not decided yet.');
if(projectReuseIntention(f)==='Yes — assess it for reuse')missing.push('Whether the existing ground is suitable, plus levels, drainage and services: not checked yet.');
if(projectReuseNeedsEvidenceAnswer(f)&&projectSiteEvidenceAvailability(f)==='No')missing.push('You have no drawings, surveys or other site information for the building area.');
if(projectReuseNeedsEvidenceAnswer(f)&&projectSiteEvidenceAvailability(f)==='Not sure')missing.push('Whether you have drawings, surveys or other site information: not known yet.');
if(projectReuseNeedsEvidenceAnswer(f)&&projectSiteEvidenceAvailability(f)==='Yes — I will upload them later')missing.push('You said you have drawings or surveys, but they have not been uploaded yet.');
if(!p.evidence.length)missing.push('You have not added any photos or documents yet.');
return missing
}
// Stage 1 report restructuring (2026-08-27 — see MASTER-SPEC.md/CHANGELOG.md):
// groups the SAME p.risks1 entries by the `discipline` field added in
// runStage1Risks() above, purely for clearer presentation. No risk-trigger
// condition changes — this only changes how already-computed findings are
// labelled and ordered on the page/PDF.
function stage1DisciplineBlock(p,discipline,title,emptyNote){
let items=(p.risks1||[]).filter(r=>r.discipline===discipline);
if(!items.length)return emptyNote?`<div class="subhead">${esc(title)}</div><p class="meta">${esc(emptyNote)}</p>`:'';
return `<div class="subhead">${esc(title)}</div><div class="risk-list">${items.map(r=>`<div class="risk">${esc(r.text)}</div>`).join('')}</div>`
}
// Apply Locked Application Shell to Remaining Pages (2026-09-02): this
// report page (on-screen only — see below) now uses the locked Project
// Workspace shell. Reached by direct call from finalizeStage1() (never
// a hash change) so data-page is explicitly set here, same reasoning as
// stage1ClientInput() above. The complete logo moves from the standalone
// <img class="report-logo"> (kept, unchanged, for Stage 2's report —
// out of scope for this task) into .workspace-identity beside the
// heading, matching the locked example exactly. downloadReport() (PDF
// generation) does not read this DOM element at all — it builds the PDF
// independently via jsPDF text calls from p.facts/p.risks1 directly —
// so this is purely an on-screen layout change; the report's own
// content/data/PDF output is completely unaffected.
// ---------------------------------------------------------------------------
// Uploads, in plain words. The free check NEVER opens or reads a document: it only lists each file by name
// and guesses what it is from the file name and extension. Nothing here changes how files are stored.
// ---------------------------------------------------------------------------
const UPLOAD_NOT_REVIEWED_TEXT='Files are not reviewed in the free check. We list them by name only. A plain review of each file is part of Stage 2.';
function uploadTypeGuess(name){
  const n=String(name||'').toLowerCase(),ext=(n.match(/\.([a-z0-9]+)$/)||[])[1]||'';
  const image=['png','jpg','jpeg','gif','webp','heic','tif','tiff','bmp'].includes(ext);
  const cad=['dwg','dxf'].includes(ext),zip=['zip','rar','7z'].includes(ext);
  const kind=/site[\s_-]*plan|block[\s_-]*plan|location[\s_-]*plan/.test(n)?'site plan'
    :/survey|topo|levels?\b/.test(n)?'survey'
    :/decision|notice|permission|consent/.test(n)?'decision notice'
    :/engineer|calc|structural/.test(n)?'engineer letter'
    :(image||/photo|img[_-]?\d|dsc[_-]?\d|pxl[_-]|whatsapp/.test(n))?'photo'
    :(cad||/drawing|elevation|section|layout|plan/.test(n))?'drawing'
    :/report|investigation|ground|drain|cctv/.test(n)?'report'
    :'';
  const format=ext==='pdf'?'PDF':ext==='docx'||ext==='doc'?'Word document':cad?'CAD drawing':image?'image':zip?'zip file':ext?ext.toUpperCase()+' file':'file';
  const label=kind?`${kind.charAt(0).toUpperCase()+kind.slice(1)} · ${format}`:`${format.charAt(0).toUpperCase()+format.slice(1)}`;
  const unreadable=image||cad||zip;
  const note=!unreadable?'':kind==='photo'?'A photo is fine to keep, but we may not be able to read anything written on it. Please also send a PDF of any drawing or document.':'We may not be able to read this. Please also send a PDF.';
  return {kind,label,unreadable,note}
}
// "Site plan · PDF" plus a warning line when we may not be able to read it. Safe to place inside a list item or table cell.
function uploadFileDetail(name){
  const guess=uploadTypeGuess(name);
  return `<span class="simple-file-type">${esc(guess.label)}</span>${guess.unreadable?`<span class="simple-file-warn">${esc(guess.note)}</span>`:''}`
}
const KEY_DOCUMENT_REQUESTS=[
  {kind:'photo',text:'Site photos'},
  {kind:'site plan',text:'A site plan'},
  {kind:['drawing','survey'],text:'Any existing drawings or a survey of the site'},
  {kind:'decision notice',text:'A planning decision notice, if you already have one (with its conditions and dates)'},
  {kind:'engineer letter',text:"A structural engineer's written, dated confirmation, if you have one. A spoken or text OK isn't enough"}
];
// What we have, what is missing and what is unclear, for the report, the PDF and the confirm page.
// Missing data is always "need info", never an all-clear. Documents are never read in Stage 1.
// ---------------------------------------------------------------------------
// Client-facing upload result (display only).
// Uses existing extractEvidenceText results plus extractFactsFromText,
// detectDocumentRevisionToken, detectDocumentStatusToken and
// classifyDocumentType when those functions already exist. Does not change
// extraction, storage, the map or Building Design.
// Never invent a figure, never claim an image was checked, never state that
// something complies with Building Regulations or Approved Document B
// (guidance only; Stuart will go through guidance items in the Stage 2 meeting).
// Stage 1 only records that files were received and whether we could read text.
// A figures check is Stage 2, and only for values the existing extraction can find.
const UPLOAD_REVIEW_FOOTER='This is a check of what we could read in the file. It is not a Building Regulations or planning approval. Stuart will go through the guidance items with you in your Stage 2 meeting.';
const UPLOAD_DOC_TYPE_LABELS={
  site_investigation_geotechnical:'Ground investigation',
  structural_report_calculation:'Structural report or calculations',
  foundation_base_design:'Foundation or base drawing',
  groundworks_quotation:'Groundworks quotation',
  supplier_quotation:'Supplier quotation',
  planning_document:'Planning document',
  building_control_document:'Building Control document',
  fire_strategy:'Fire strategy',
  drainage_information:'Drainage information',
  utility_service_survey:'Utilities survey',
  drawing:'Drawing',
  specification:'Specification',
  other_project_evidence:'Document'
};
const UPLOAD_FACT_LABELS={
  building_footprint_dimensions:'Size (width × length)',
  overall_building_length:'Length',
  eaves_height:'Eaves height',
  slab_thickness:'Slab thickness',
  slab_reinforcement:'Slab reinforcement',
  foundation_pad_count:'Number of foundation pads',
  made_ground_depth:'Made-ground depth',
  allowable_bearing_pressure:'Allowable bearing pressure',
  concrete_core_count:'Concrete cores',
  concrete_core_depth_range:'Concrete core depth',
  concrete_compressive_strength_range:'Concrete strength',
  project_use_description:'Use described in the file'
};
const UPLOAD_SKIP_SUBJECTS=['drainage_provisional_sum','service_duct_provisional_sum','planning_site_address','quotation_basis'];
function uploadFormatLabel(name){
  const guess=typeof uploadTypeGuess==='function'?uploadTypeGuess(name):{label:'File',unreadable:false,note:''};
  if(/\.dwg$/i.test(name||''))return 'CAD file (DWG)';
  if(/\.pdf$/i.test(name||''))return 'PDF';
  if(/\.docx?$/i.test(name||''))return 'Word document';
  if(/\.(png|jpe?g)$/i.test(name||''))return 'Photo or image';
  return guess.label||'File'
}
function uploadReadState(entry){
  const name=entry&&entry.name||'This file';
  const status=String(entry&&entry.extractionStatus||'');
  const note=String(entry&&entry.extractionNote||'').trim();
  const isDwg=/\.dwg$/i.test(name);
  const isImage=/\.(png|jpe?g|gif|webp|heic|heif)$/i.test(name);
  if(isDwg||status==='UNSUPPORTED'&&isDwg){
    return {canRead:false,text:false,reason:`We couldn't read the text in ${name}. This is a CAD (DWG) file, and automatic reading isn't available yet. Please also send a dimensioned PDF.`}
  }
  if(isImage||status==='OCR_REQUIRED'){
    return {canRead:false,text:false,reason:`We couldn't read the text in ${name}. It looks like an image, and we have not measured anything from it. Please also send a PDF or a dimensioned drawing.`}
  }
  if(status==='EXTRACTION_FAILED'){
    return {canRead:false,text:false,reason:note?`We couldn't read ${name}: ${note}`:`We couldn't read ${name}. The file may be too large or damaged. Please also send a PDF.`}
  }
  if(status==='UNSUPPORTED'){
    return {canRead:false,text:false,reason:note?`We couldn't read ${name}: ${note}`:`We couldn't read ${name} automatically. Please also send a PDF.`}
  }
  if(status==='PARTIAL'){
    return {canRead:true,text:true,partial:true,reason:`We could only read some of the text in ${name}. Please also send a clearer PDF if you have one.`}
  }
  if(status==='EXTRACTED'&&entry&&entry.extractedText){
    return {canRead:true,text:true,reason:''}
  }
  if(entry&&entry.extractedText){
    return {canRead:true,text:true,reason:''}
  }
  return {canRead:false,text:false,reason:`We couldn't read the text in ${name}. Please also send a dimensioned PDF.`}
}
function uploadPlainType(entry){
  const confidence=String(entry&&entry.documentTypeConfidence||'');
  const type=entry&&entry.documentType;
  if(type&&UPLOAD_DOC_TYPE_LABELS[type]&&(confidence==='medium'||confidence==='high'))return UPLOAD_DOC_TYPE_LABELS[type];
  return uploadFormatLabel(entry&&entry.name||'')
}
function uploadParseMetres(value){
  const text=String(value||'');
  const nums=[];
  const re=/(\d+(?:\.\d+)?)\s*(?:m\b|mm\b)?/gi;
  let m;
  while((m=re.exec(text))){
    let n=parseFloat(m[1]);
    if(!Number.isFinite(n))continue;
    if(/mm/i.test(m[0])||(!/m/i.test(m[0])&&n>=100&&n%1===0))n=n/1000;
    nums.push(n)
  }
  return nums
}
function uploadValuesMatch(a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b))return false;
  const diff=Math.abs(a-b)*1000;
  const tol=Math.min(Math.abs(a)*10,50);
  return diff<=tol+1e-6
}
function uploadPairMatches(enteredW,enteredL,shown){
  if(shown.length<2||!Number.isFinite(enteredW)||!Number.isFinite(enteredL))return false;
  const [a,b]=shown;
  return (uploadValuesMatch(enteredW,a)&&uploadValuesMatch(enteredL,b))||(uploadValuesMatch(enteredW,b)&&uploadValuesMatch(enteredL,a))
}
function uploadFactsForFile(entry){
  if(!entry||!entry.extractedText||typeof extractFactsFromText!=='function')return [];
  try{
    return extractFactsFromText(entry.extractedText,{source_file:entry.name,source_document_type:entry.documentType||null})||[]
  }catch(err){
    return []
  }
}
function uploadRevisionOf(entry,read){
  if(!read.canRead||!entry||!entry.extractedText||typeof detectDocumentRevisionToken!=='function')return null;
  const found=detectDocumentRevisionToken(entry.extractedText);
  return found&&found.value?found.value:null
}
function uploadStatusOf(entry,read){
  if(!read.canRead||!entry||!entry.extractedText||typeof detectDocumentStatusToken!=='function')return null;
  const found=detectDocumentStatusToken(entry.extractedText);
  return found&&found.value?found.value:null
}
function uploadBuildReview(p){
  const docs=(p&&p.evidence||[]).filter(item=>item&&item.name).slice().sort((a,b)=>(a.at||0)-(b.at||0));
  const files=docs.map(entry=>{
    const read=uploadReadState(entry);
    const facts=read.canRead?uploadFactsForFile(entry).filter(fact=>fact&&fact.extracted_value&&!UPLOAD_SKIP_SUBJECTS.includes(fact.subject)):[];
    return {entry,name:entry.name,read,facts,type:uploadPlainType(entry),revision:uploadRevisionOf(entry,read),status:uploadStatusOf(entry,read),format:uploadFormatLabel(entry.name)}
  });
  const readable=files.filter(file=>file.read.canRead);
  const facts=p?projectFacts(p):{};
  const enteredW=Number(facts.width),enteredL=Number(facts.length);
  const hasW=stage1HasValue(facts.width)&&Number.isFinite(enteredW);
  const hasL=stage1HasValue(facts.length)&&Number.isFinite(enteredL);
  const sizeFacts=files.flatMap(file=>file.facts.filter(fact=>fact.subject==='building_footprint_dimensions'||fact.subject==='overall_building_length').map(fact=>({file:file.name,fact})));
  const eavesFacts=files.flatMap(file=>file.facts.filter(fact=>fact.subject==='eaves_height').map(fact=>({file:file.name,fact})));
  const rows=[];
  if(hasW||hasL||sizeFacts.length){
    const drawingParts=sizeFacts.map(item=>`${item.fact.extracted_value} (${item.file})`);
    const drawingText=drawingParts.length?drawingParts.join(' / '):'';
    let status='Not shown',wording;
    if(!readable.length){
      status='Not shown';
      wording="We couldn't read a written size from your files yet, so we haven't checked this."
    }else if(!sizeFacts.length){
      status='Not shown';
      wording='A written width and length were not found in the files we could read. We need this from a dimensioned PDF.'
    }else{
      const pairs=sizeFacts.map(item=>({file:item.file,nums:uploadParseMetres(item.fact.extracted_value),raw:item.fact.extracted_value}));
      const allAgree=pairs.every(item=>{
        const first=pairs[0];
        if(item.nums.length>=2&&first.nums.length>=2)return uploadPairMatches(first.nums[0],first.nums[1],item.nums);
        if(item.nums.length===1&&first.nums.length===1)return uploadValuesMatch(item.nums[0],first.nums[0]);
        return item.raw===first.raw
      });
      const matchesEntered=hasW&&hasL&&pairs.some(item=>item.nums.length>=2?uploadPairMatches(enteredW,enteredL,item.nums):false);
      if(!allAgree){
        status='Mismatch';
        wording='Your drawings disagree with each other. Which is right?'
      }else if(hasW&&hasL&&!matchesEntered){
        status='Mismatch';
        wording='The size on the drawings does not match the size you entered. Which is right?'
      }else if(matchesEntered){
        status='Match';
        wording='Matches your drawings.'
      }else{
        status='Not shown';
        wording='A size is written on the drawings. You have not entered a matching width and length yet.'
      }
    }
    rows.push({item:'Width and length',entered:hasW&&hasL?`${facts.width} m × ${facts.length} m`:'Not entered',drawings:drawingText||'Not found in the files we could read',status,wording})
  }
  if(eavesFacts.length){
    const drawingText=eavesFacts.map(item=>`${item.fact.extracted_value} (${item.file})`).join(' / ');
    const nums=eavesFacts.map(item=>uploadParseMetres(item.fact.extracted_value)[0]).filter(Number.isFinite);
    const disagree=nums.length>1&&nums.some(n=>!uploadValuesMatch(n,nums[0]));
    rows.push({item:'Eaves height',entered:'Not entered',drawings:drawingText,status:disagree?'Mismatch':'Not shown',wording:disagree?'Two different eaves heights are written on the drawings. Which is right?':'Eaves height is written on the drawings. You have not entered this figure separately (your clear height is a different measurement).'})
  }
  const needInfo=[];
  files.forEach(file=>{if(!file.read.canRead||file.read.partial)needInfo.push(file.read.reason)});
  if(readable.length&&!sizeFacts.length)needInfo.push('A written width and length – not found in the files we could read.');
  files.forEach(file=>{
    if(!file.read.canRead)return;
    if(!file.revision)needInfo.push(`${file.name}: no revision letter was found in the text we could read.`);
    if(file.status&&['PRELIMINARY','DRAFT','FOR APPROVAL','SUPERSEDED'].includes(file.status))needInfo.push(`${file.name} is marked "${file.status}". Please send the current issued version if you have one.`)
  });
  if(!files.length)needInfo.push('You have not uploaded any files yet.');
  const cards=files.map(file=>{
    const found=[];
    file.facts.forEach(fact=>{
      const label=UPLOAD_FACT_LABELS[fact.subject]||fact.subject.replace(/_/g,' ');
      found.push(`${label}: ${fact.extracted_value} (${file.name})`)
    });
    if(file.revision)found.push(`Revision ${file.revision} (${file.name})`);
    if(file.status)found.push(`Marked "${file.status}" (${file.name})`);
    const missing=[];
    const unclear=[];
    const questions=[];
    if(!file.read.canRead){
      missing.push(file.read.reason);
      questions.push(`Please send a dimensioned PDF of ${file.name}, or another file we can read.`)
    }else{
      if(file.read.partial)unclear.push(file.read.reason);
      if(!file.facts.some(fact=>fact.subject==='building_footprint_dimensions'||fact.subject==='overall_building_length'))missing.push('A written width and length – not found in the text we could read.');
      if(!file.revision)unclear.push('No revision letter was found in the text we could read, so we cannot tell if this is the latest version.');
      if(file.status&&['PRELIMINARY','DRAFT','FOR APPROVAL','SUPERSEDED'].includes(file.status))unclear.push(`This file is marked "${file.status}", so the figures on it may not be confirmed.`);
      file.facts.forEach(fact=>{
        if(fact.extraction_note&&/inconsistent/i.test(fact.extraction_note))unclear.push(`${UPLOAD_FACT_LABELS[fact.subject]||fact.subject}: the same file gives more than one value. Which is right?`)
      })
    }
    if(unclear.some(text=>/does not match|disagree/i.test(text)))questions.push('Which drawing is the one you are building from?');
    if(!file.revision&&file.read.canRead)questions.push(`Is ${file.name} the latest version?`);
    const unique=list=>[...new Set(list.filter(Boolean))].slice(0,6);
    return {name:file.name,type:file.type,format:file.format,revision:file.revision,status:file.status,read:file.read,found:unique(found),missing:unique(missing),unclear:unique(unclear),questions:unique(questions).slice(0,5)}
  });
  return {files,readableCount:readable.length,rows,needInfo:[...new Set(needInfo.filter(Boolean))],cards,sortedByUpload:true}
}
function uploadStatusChip(status){
  const cls=status==='Match'?'likely':status==='Mismatch'?'needinfo':'needinfo';
  return `<span class="simple-chip simple-chip--${cls}">${esc(status)}</span>`
}
function uploadFileCardMarkup(card,mode){
  const readLine=card.read.canRead?(card.read.partial?'We could only read some of the text.':'We could read the text in this file.'):card.read.reason;
  const rev=card.read.canRead?(card.revision?` · Rev ${esc(card.revision)}`:' · No revision letter'):'';
  const st=card.status?` · Marked "${esc(card.status)}"`:'';
  const block=(title,items,empty)=>`<div class="simple-qblock"><h4>${esc(title)}</h4>${items.length?`<ul class="simple-list simple-list-tight">${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:`<p class="meta">${esc(empty)}</p>`}</div>`;
  const foundEmpty=mode==='stage1'?'Not reviewed in the free check.':(card.read.canRead?'Nothing we can read automatically was found in this file.':'We could not read this file, so we have not listed any figures.');
  return `<article class="simple-qcard simple-draw-card"><div class="simple-qhead"><h3>${esc(card.type)} · ${esc(card.name)}${rev}${st}</h3></div><p class="meta">${esc(card.format)}. ${esc(readLine)}</p>${mode==='stage1'?`<p class="simple-file-line">Received, not reviewed in the free check.</p>`:''}${block('What we found',mode==='stage1'?[]:card.found,foundEmpty)}${block("What's missing – we need this from you",mode==='stage1'?(card.read.canRead?[]:card.missing):card.missing,mode==='stage1'?'A full list of what is missing is part of Stage 2.':'Nothing further listed from what we could read.')}${mode==='stage1'?'':block("What's unclear",card.unclear,'Nothing further listed from what we could read.')}${mode==='stage1'?'':block('Questions for your meeting with Stuart',card.questions,'No extra questions from this file.')}<p class="meta simple-qnote">${esc(UPLOAD_REVIEW_FOOTER)}</p></article>`
}
function uploadFiguresMarkup(review,mode){
  if(mode==='stage1'){
    return `<section class="simple-qcard simple-review-panel"><h3>Your figures checked against the drawings</h3><p>Not checked in this free check. A comparison of the sizes you entered with anything we can read on the drawings is part of Stage 2.</p><p class="meta">We only compare figures that are written as text in a file we can read. We cannot read CAD (DWG) files or photos automatically, and we never guess a number.</p></section>`
  }
  if(!review.rows.length){
    return `<section class="simple-qcard simple-review-panel"><h3>Your figures checked against the drawings</h3><p>We couldn't compare your figures with the drawings yet. We can only check sizes when they are written as text in a PDF or Word file we can read. We cannot read CAD (DWG) files or photos automatically, and we never guess a number.</p></section>`
  }
  const body=review.rows.map(row=>`<tr><th scope="row">${esc(row.item)}</th><td>${esc(row.entered)}</td><td>${esc(row.drawings)}</td><td>${uploadStatusChip(row.status)}</td><td>${esc(row.wording)}</td></tr>`).join('');
  return `<section class="simple-qcard simple-review-panel"><h3>Your figures checked against the drawings</h3><p class="meta">Status is only Match, Mismatch or Not shown. This is not a pass or a Building Regulations check.</p><div class="simple-review-table-wrap"><table class="simple-review-table"><thead><tr><th>Item</th><th>You entered</th><th>Drawings show</th><th>Status</th><th></th></tr></thead><tbody>${body}</tbody></table></div></section>`
}
function uploadReviewMarkup(p,mode){
  const review=uploadBuildReview(p);
  const header=mode==='stage1'
    ?`<p class="simple-know-status" role="status"><strong>Received, not reviewed in the free check.</strong> ${review.files.length?`We have ${review.files.length} file${review.files.length===1?'':'s'}. We could read text in ${review.readableCount}.`:'You have not uploaded any files yet.'} A plain review of each file is part of Stage 2.</p>${review.sortedByUpload&&review.files.length?`<p class="meta">Files are listed in the order you uploaded them, because we could not read a drawing date.</p>`:''}`
    :`<p class="simple-know-status" role="status">${review.files.length?`We received ${review.files.length} file${review.files.length===1?'':'s'}. We could read text in ${review.readableCount}. ${review.files.length-review.readableCount?`${review.files.length-review.readableCount} need your help (see below).`:''}`:'You have not uploaded any files yet.'}</p>${review.sortedByUpload&&review.files.length?`<p class="meta">Files are listed in the order you uploaded them, because we could not read a drawing date.</p>`:''}`;
  const need=`<section class="simple-qcard simple-review-panel"><h3>Need info</h3>${review.needInfo.length?`<ul class="simple-list simple-list-tight">${review.needInfo.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'<p class="meta">Nothing listed yet from the files. That is not an all-clear.</p>'}<p class="meta">Some checks, such as fire exits and boundary distances, cannot be read automatically yet. Stuart will go through those guidance items with you in your Stage 2 meeting. This is not a Building Regulations approval.</p></section>`;
  const cards=review.cards.length?`<div class="simple-qlist">${review.cards.map(card=>uploadFileCardMarkup(card,mode)).join('')}</div>`:'';
  return `<div class="simple-upload-review">${header}${uploadFiguresMarkup(review,mode)}${need}${cards}</div>`
}
function uploadExampleReviewMarkup(){
  const chip=status=>`<span class="simple-chip simple-chip--${status==='Match'?'likely':'needinfo'}">${esc(status)}</span>`;
  const block=(title,items)=>`<div class="simple-qblock"><h4>${esc(title)}</h4><ul class="simple-list simple-list-tight">${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></div>`;
  return `<div class="simple-upload-review simple-upload-example"><p class="simple-example-tag">EXAMPLE ONLY. Made-up content, not a real project or a real file.</p>
<section class="simple-qcard simple-review-panel"><h3>Your figures checked against the drawings</h3><p class="meta">Status is only Match, Mismatch or Not shown. This is not a pass or a Building Regulations check.</p>
<div class="simple-review-table-wrap"><table class="simple-review-table"><thead><tr><th>Item</th><th>You entered</th><th>Drawings show</th><th>Status</th><th></th></tr></thead><tbody>
<tr><th scope="row">Width and length</th><td>20 m × 25 m</td><td>20 m × 24.4 m (steel drawing) / 20 m × 25 m (planning drawing)</td><td>${chip('Mismatch')}</td><td>Your drawings disagree with each other and with you. Which is right?</td></tr>
<tr><th scope="row">Roof pitch</th><td>10°</td><td>Not found in the files we could read</td><td>${chip('Not shown')}</td><td>Roof pitch isn't written on the drawings we could read – we need it.</td></tr>
</tbody></table></div></section>
<section class="simple-qcard simple-review-panel"><h3>Need info</h3><ul class="simple-list simple-list-tight"><li>Which length is right: 24.4 m or 25 m?</li><li>Exit door widths – not found in the files we could read.</li><li>Distance from each wall to the site boundary – not found in the files we could read.</li></ul><p class="meta">Stuart will go through guidance items such as fire exits and boundary distances with you. This is not a Building Regulations approval.</p></section>
<article class="simple-qcard simple-draw-card"><div class="simple-qhead"><h3>Drawing · steel-general-arrangement.pdf · Rev A · 16 Apr 2026</h3></div><p class="meta">PDF. We could read the text in this file.</p>
${block('What we found',['Building 20 m wide × 24.4 m long (steel-general-arrangement.pdf)','Roller door: 4.0 m wide; height not written'])}
${block("What's missing – we need this from you",['Distance from each wall to the site boundary – not shown','Clear widths of any fire exit doors – not shown'])}
${block("What's unclear",['The planning drawing gives the length as 25 m; this drawing gives 24.4 m. Which is right?','No date was found for a second sheet in the same set.'])}
${block('Questions for your meeting with Stuart',['Which drawing is the one you are building from?','Is the small door on the front wall a fire exit? How wide is it?'])}
<p class="meta simple-qnote">${esc(UPLOAD_REVIEW_FOOTER)}</p></article></div>`
}

function stage1KnowledgeLists(p){
  const facts=projectFacts(p),docs=(p.evidence||[]).filter(item=>item&&item.name);
  const have=[],missing=[],unclear=[];
  const has=value=>stage1HasValue(value);
  const uncertain=value=>['Not sure','Unknown','Not sure yet'].includes(String(value||''));
  if(has(facts.buildingUse))have.push('Building use: '+facts.buildingUse);
  if(has(facts.buildingType))have.push('Building type: '+facts.buildingType);
  if(has(facts.width)&&has(facts.length)&&has(facts.height))have.push(`Size: ${facts.width} m wide × ${facts.length} m long, ${facts.height} m high inside`);
  const heated=projectTemperatureSummaryPlain(facts);
  if(heated&&!uncertain(heated))have.push('Heated: '+heated);
  const surface=projectExistingBase(facts);
  if(has(surface)&&!uncertain(surface))have.push('On the ground now: '+surface);
  if(has(p.address))have.push('Site address');
  if(facts.buildingPositionStatus==='confirmed')have.push('Building placed on the map');
  if(facts.siteBoundaryStatus==='confirmed')have.push('Site boundary marked on the map');
  const files=docs.map(item=>({name:item.name,guess:uploadTypeGuess(item.name),entry:item}));
  // Missing: questions not answered, map steps not done, then key documents not uploaded.
  try{stage1SteelReportGaps(p).forEach(gap=>missing.push(gap==='Site Layout'?'The building placed and the site boundary marked on the map (Site Layout)':`Not answered yet: ${gap}`))}catch(e){}
  stage1RegsMissingInfo(p).forEach(text=>missing.push(text));
  const regs=stage1RegsFindings(p);
  if(regs)regs.needInfo.forEach(text=>missing.push(text));
  try{(typeof stage1AnswerChecks==='function'?stage1AnswerChecks(p).needInfo:[]).forEach(item=>item&&item.text&&missing.push(plainWalls(item.text)))}catch(e){}
  if(!has(facts.level))missing.push('Whether the site is level');
  if(!has(facts.services))missing.push('Where the drains and services run');
  if(!files.length)missing.push('You have not uploaded any files yet');
  KEY_DOCUMENT_REQUESTS.forEach(request=>{
    const kinds=[].concat(request.kind);
    if(!files.some(file=>kinds.includes(file.guess.kind)))missing.push(request.text+(files.length?' (none of your files look like this from their names)':''))
  });
  // Unclear: "Not sure" answers and files we may not be able to read.
  const unsure=(value,text)=>{if(uncertain(value))unclear.push(text)};
  unsure(facts.level,'Whether the site is level: you said you are not sure');
  unsure(facts.services,'Where the drains and services run: you said you are not sure');
  unsure(facts.closeBoundary,'Boundaries and nearby buildings: you said you are not sure');
  unsure(surface,'What is on the ground now: you said you are not sure');
  unsure(projectReuseIntention(facts),'Whether to reuse what is on the ground: not decided yet');
  unsure(projectSiteEvidenceAvailability(facts),'Whether you have drawings or surveys: you said you are not sure');
  unsure(projectTemperatureCondition(facts),'Whether the building will be heated: you said you are not sure');
  if(projectReuseIntention(facts)==='Yes — assess it for reuse')unclear.push('Whether the existing ground is suitable: not checked yet');
  // Document gaps. A file being attached is never treated as complete, and nothing here reads as an all-clear.
  // detectDocumentStatusToken() lives in evidence.js (not changed); it is only CALLED here, and only when it exists.
  files.forEach(file=>{
    const entry=file.entry||{},status=String(entry.extractionStatus||''),text=String(entry.extractedText||'');
    if(['UNSUPPORTED','EXTRACTION_FAILED','OCR_REQUIRED','PARTIAL'].includes(status)||file.guess.unreadable)unclear.push(`${file.name}: we could not read all of this file. Please also send a dimensioned PDF of it.`);
    if(!text)return;
    const token=typeof detectDocumentStatusToken==='function'?detectDocumentStatusToken(text).value:null;
    if(['PRELIMINARY','DRAFT','FOR APPROVAL','SUPERSEDED'].includes(token))unclear.push(`${file.name} is marked "${token.charAt(0)+token.slice(1).toLowerCase()}", so the figures on it are not confirmed. Please send the current issued version.`);
    else if(/\b(TBC|TBD)\b|to be confirmed/i.test(text))unclear.push(`${file.name} has items marked "to be confirmed", so the figures on it are not confirmed. Please send the current issued version.`);
    if(/\bby others\b/i.test(text))unclear.push(`${file.name} says some of the work is "by others". That doesn't show what will be built. Please send the drawing from whoever owns that part.`)
  });
  try{stage1ConfirmationEvidenceNotices(p).forEach(notice=>unclear.push(`${notice.label}: your documents and your answers don't agree${notice.value?` (${notice.value})`:''}. Please tell us which is right.`))}catch(e){}
  if(has(facts.width)&&has(facts.length)&&has(facts.height))unclear.push('The size and height are what you entered. None of your files has been checked against them yet.');
  const unique=list=>[...new Set(list.filter(Boolean))];
  return {have:unique(have),missing:unique(missing),unclear:unique(unclear),files,
    fileNote:files.length?`We have received your file${files.length===1?'':'s'}. ${files.length===1?'It has':'They have'} not been reviewed in the free check. A plain review is part of Stage 2.`:''}
}
function stage1KnowledgeMarkup(p){
  const k=stage1KnowledgeLists(p);
  const list=(title,items,cls)=>`<div class="simple-know-block ${cls}"><h3>${esc(title)}</h3>${items.length?`<ul class="simple-list simple-list-tight">${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'<p class="meta">Nothing listed yet. That is not an all-clear.</p>'}</div>`;
  const open=k.missing.length+k.unclear.length;
  return `<p class="simple-know-status" role="status"><strong>${open} thing${open===1?'':'s'} still open.</strong> Until each one is answered it stays as "Need info", never an all-clear.</p>
${uploadReviewMarkup(p,'stage1')}
${list("What's missing",k.missing,'simple-know-missing')}${list("What's unclear",k.unclear,'simple-know-unclear')}
<div class="simple-know-block simple-know-have"><h3>What we have</h3>${k.have.length?`<ul class="simple-list simple-list-tight">${k.have.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'<p class="meta">No answers saved yet.</p>'}</div>
<p class="meta simple-know-foot">${esc(UPLOAD_NOT_REVIEWED_TEXT)} This is not an all-clear: it only shows what we know and don't know so far.</p>`
}

// ---------------------------------------------------------------------------
// Stage 1 as seven client questions, in the order it usually happens, each with a probable answer.
// Written as "what you will probably have to deal with to get approved". Problems only, never how to solve them.
// Past jobs are hidden reference only: they shaped the questions and the probable answers (Job letters in code comments only,
// never on a client page, the PDF or in a rule the client can see). Nothing on a client page may mention a past job.
//  Q1 Planning: full applications were the usual route, even for open canopies and tent halls (Jobs A, C, F, H, I, O); one extension
//     went the certificate route (Job G). Conditions seen: start within 3 years, approved plans, matching materials, outside
//     lighting details, piling or vibration works, biodiversity net gain, no surface water onto the road. A height change
//     after approval needed a new approval (Job C). Never say "permitted development" or "no planning needed".
//  Q2 Engineer, Q3 base and civils: a structural engineer designed the base on every job with a new base (Jobs C, D, G, L).
//  Q4 Building Regulations: boundary fire walls, fire strategy requests, accessible layout, energy statement for unheated halls (Jobs B, C, D, H).
//  Q5 CDM: Construction (Design and Management) Regulations 2015 reg 4 (client duties), reg 5 (appoint principal designer and
//     principal contractor in writing before work starts; if the client does not, the client's own duties include theirs), reg 6
//     (notify HSE: more than 30 working days with more than 20 people at once, or more than 500 person-days).
//     "Usually the client acts as, or appoints, the principal contractor, and is often also the principal designer" is house experience, NOT law, and is worded as "usually" / "often".
//     Source: https://www.legislation.gov.uk/uksi/2015/51. The legal references are deliberately not shown on the client page.
//  Q6 Site risks and access: general patterns only from the v2 research note on method statements for industrial and steel jobs (access and set-down, live yard, induction and permits incl. permit to dig, services that may not match drawings, old hardstanding of unknown strength, crane lift plans, wind, work at height, noise and vibration, fire-wall/boundary clear space, joining an existing building and opening vs door sizes, stock under a roof being replaced, planning conditions such as crane notification, contamination and working hours). Asbestos is a neutral question, not a finding. No job-specific details. Problems only. Do not mention RAMS, risk assessments or method statements on client pages. Project Check is guidance only and holds no CDM role. v1 template/gap wording is withdrawn.
//  Q7 Consultants: house position, not law. Say "Building Control (council or a registered approver)", never "Approved Inspector".
// Chips: Likely / Possibly / Unlikely / Need info. Missing input is always "Need info", never an all-clear.
// ---------------------------------------------------------------------------
const STAGE1_INTRO="Here's what you'll probably face to get your building approved, in the order it usually happens, and who you'll need. Think of it as the first chat across the table: no hard sell, and the answers and a plan come later, with Stuart.";
const QUESTION_CHIPS={likely:'Likely',possibly:'Possibly',unlikely:'Unlikely',needinfo:'Need info'};
const PLANNING_CONDITIONS=['Start building within 3 years of approval','Build to the approved plans','Materials and colour to match','Details of any outside lighting','Details of any piling or vibration works','Biodiversity net gain (leaving wildlife better off)','No surface water running onto the road','A new approval if the height changes','Working hours and a plan for lorries and noise while building','Noise limits once the building is in use','Drainage and flood control','Landscaping and protecting trees','Parking, lorry access and turning space','Checks if the ground may be contaminated'];
const PLANNING_REFUSAL_REASONS=['How it looks (size and design)','Effect on neighbours (noise, overlooking, loss of light)','Traffic, access and parking','Flood risk and drainage','Green Belt land','Listed buildings or conservation areas nearby','Harm to wildlife and trees'];
// Topic icons (inline SVG line icons, same stroke style as PRICING_SHIELD_ICON) and one accent colour per topic.
// Accents are built around the brand green and the dark ink in styles.css. Each one passes AA contrast as text on white.
const svgIcon=paths=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const S1_TOPICS=[
  {label:'Planning',rgb:[32,122,61],icon:svgIcon('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 14l2 2 4-4"/>')},
  {label:'Engineer',rgb:[29,58,95],icon:svgIcon('<path d="M5 5h14"/><path d="M5 19h14"/><path d="M12 5v14"/>')},
  {label:'Base and groundworks',rgb:[15,107,107],icon:svgIcon('<path d="M12 4l9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 16l9 4 9-4"/>')},
  {label:'Building Regulations',rgb:[59,91,146],icon:svgIcon('<path d="M4 21V8l8-5 8 5v13z"/><path d="M9 21v-6h6v6"/>')},
  {label:'CDM',rgb:[74,63,143],icon:svgIcon('<path d="M4 16a8 8 0 0116 0z"/><path d="M3 16h18v3H3z"/><path d="M12 8v3"/>')},
  {label:'Site risks and access',rgb:[85,112,31],icon:svgIcon('<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/>')},
  {label:'Consultants and fees',rgb:[43,95,117],icon:svgIcon('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 2 4 5"/>')}
];
// "How planning works" step view. Plain words, problems only. Time line source (code comment only): Town and Country Planning
// (Development Management Procedure) (England) Order 2015, article 34: 8 weeks, or 13 weeks for major development
// (1,000 m2 or more of floor space, or a site of 1 hectare or more). Wales and Scotland have their own rules.
const PLANNING_STEPS=[
  {title:'Ask the council for advice first',text:'This is called pre-application advice. It is optional and usually costs a fee.'},
  {title:'Apply online',text:'Use the Planning Portal (or apply on paper).'},
  {title:'Choose full or outline',text:'Outline means the details come later.'},
  {title:'Send the fee and the supporting documents',text:'Drawings, and reports such as flood, transport, noise or wildlife if needed.'},
  {title:'The council checks the application is complete',hold:'Missing documents stop the clock until they are sent.'},
  {title:'The council confirms it is valid',text:'The clock starts.'},
  {title:'Neighbours and other bodies are consulted',text:'This includes highways and drainage. A site notice goes up.',hold:'Objections and consultee requests can add time and changes.'},
  {title:'A planning officer decides',text:'Or a committee, if it is bigger or has been objected to.'},
  {title:'The decision',text:'Granted, granted with conditions, refused, or not decided in time.',hold:'Some conditions must be cleared before you start building.'}
];
const PLANNING_TIMELINE='Usually 8 weeks once the application is valid, 13 weeks for major schemes (e.g. 1,000 m² or more of floor space or a site of 1 hectare or more). It often takes longer.';
const PLANNING_NATIONS_NOTE='Wales and Scotland follow a similar process, but the rules differ.';
const HOLD_LABEL='Where people get held up';
function planningStepViewMarkup(){
  const steps=PLANNING_STEPS.map((step,i)=>`<li class="simple-flow-step${step.hold?' is-hold':''}"><span class="simple-flow-num" aria-hidden="true">${i+1}</span><div class="simple-flow-body"><strong>${esc(step.title)}</strong>${step.text?`<span class="simple-flow-text">${esc(step.text)}</span>`:''}${step.hold?`<span class="simple-hold"><span class="simple-hold-tag">${HOLD_LABEL}</span><span>${esc(step.hold)}</span></span>`:''}</div></li>`).join('');
  return `<section class="simple-flow" aria-label="How planning works"><h4>How planning works</h4><p class="simple-flow-key"><span class="simple-hold-dot" aria-hidden="true">!</span> ${HOLD_LABEL}</p><ol class="simple-flow-list">${steps}</ol><p class="simple-flow-time"><strong>How long?</strong> ${esc(PLANNING_TIMELINE)}</p><p class="meta simple-flow-nations">${PLANNING_NATIONS_NOTE}</p></section>`
}
function s1Jump(n){
  const el=document.getElementById('simpleQcard'+n);if(!el)return;
  const calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({behavior:calm?'auto':'smooth',block:'start'});
  const h=document.getElementById('simpleQ'+n);if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}
}
window.s1Jump=s1Jump;
function topicIconGridMarkup(list){
  return `<nav class="simple-topics" aria-label="Topics in this report">${list.map(q=>`<button type="button" class="simple-topic simple-topic-${q.n}" onclick="s1Jump(${q.n})"><span class="simple-topic-icon">${S1_TOPICS[q.n-1].icon}</span><span class="simple-topic-label">${esc(S1_TOPICS[q.n-1].label)}</span><span class="simple-chip simple-chip--${q.status}">${esc(q.chip)}</span></button>`).join('')}</nav>`
}
// Optional questions. Saved as new facts keys, never required, never part of the "still required" list.
const STAGE1_OPTIONAL_QUESTIONS=[
  {key:'existingBuildingOnSite',label:'Is there an existing building on the site?'},
  {key:'runsSiteYourself',label:'Will you run the site yourself (act as the principal contractor)?'}
];
const OPTIONAL_ANSWERS=['Yes','No','Not sure'];
function setStage1Optional(id,key,value){
  const p=getP(id);
  if(!p||!STAGE1_OPTIONAL_QUESTIONS.some(question=>question.key===key))return;
  const facts=projectFacts(p);
  if(OPTIONAL_ANSWERS.includes(value))facts[key]=value;else delete facts[key];
  save();render()
}
window.setStage1Optional=setStage1Optional;
function stage1OptionalMarkup(p){
  const facts=projectFacts(p);
  const rows=STAGE1_OPTIONAL_QUESTIONS.map(question=>`<div class="field"><label for="opt_${question.key}">${esc(question.label)}</label><select id="opt_${question.key}" onchange="setStage1Optional('${esc(p.id)}','${question.key}',this.value)"><option value="">Skip this one</option>${OPTIONAL_ANSWERS.map(value=>`<option ${facts[question.key]===value?'selected':''}>${value}</option>`).join('')}</select></div>`).join('');
  return `<section class="card simple-optional" aria-labelledby="simpleOptionalTitle"><h2 id="simpleOptionalTitle">Two quick questions (optional)</h2><p class="meta">These help us sharpen the planning, engineering and site safety answers. Skip them if you like.</p>${rows}</section>`
}
// The first things you would ask a new client: what is it for, how big, where, is there a base, who runs the site.
// Reuses the project fields already saved, so nothing is asked twice.
function stage1BasisList(p){
  const facts=projectFacts(p),has=stage1HasValue;
  const size=has(facts.width)&&has(facts.length)?`${facts.width} m wide × ${facts.length} m long${has(facts.height)?`, ${facts.height} m high inside`:''}`:'';
  const use=[facts.buildingUse,facts.buildingType].filter(has).join(' · ');
  const base=projectExistingBase(facts);
  const runs=facts.runsSiteYourself;
  return [
    ["What it's for",use],
    ['How big',size],
    ['Where',p.address],
    ['Is there a base already?',has(base)?base:''],
    ['Who runs the site?',runs==='Yes'?"You'll run it yourself":runs==='No'?'Someone else will run it':runs==='Not sure'?'Not sure yet':'']
  ].map(([label,value])=>({label,value:has(value)?String(value):'',known:has(value)&&value!=='Not sure'&&value!=='Not sure yet'}))
}
function stage1BasisMarkup(p){
  return `<section class="card simple-basis" aria-labelledby="simpleBasisTitle"><h2 id="simpleBasisTitle">What you've told us</h2><dl class="simple-told">${stage1BasisList(p).map(item=>`<div><dt>${esc(item.label)}</dt><dd>${item.known?esc(item.value):`<span class="confirmation-missing">Need info${item.value?` (${esc(item.value)})`:''}</span>`}</dd></div>`).join('')}</dl></section>`
}
// Stage 1 base answer, in three kinds: an existing slab, no usable base (a new one is needed) or not known.
// Accepts the old question value ("Concrete slab") and the project-details value ("Concrete slab or concrete hardstanding").
function stage1BaseKind(facts){
  const raw=String(facts&&facts.base||'');
  if(/^existing (building|foundations)/i.test(raw))return 'structure';
  const base=String(projectExistingBase(facts)||'');
  if(/^concrete slab/i.test(base)||base==='Concrete')return 'slab';
  if(!base||base==='Not sure')return 'unknown';
  return 'new'
}
function stage1ClientQuestions(p){
  const facts=projectFacts(p),saved=p.backgroundChecks&&p.backgroundChecks.regsChecker,regs=stage1RegsFindings(p);
  const nation=facts.regsNation||(saved&&saved.nation)||'';
  const onSite=facts.existingBuildingOnSite,runs=facts.runsSiteYourself;
  const linked=projectAdjacentBuildingNeedsJunction(facts);
  const baseKind=stage1BaseKind(facts);
  const list=[];
  const add=(status,answer,why,extra)=>list.push({n:list.length+1,title:CLIENT_QUESTION_TITLES[list.length],status,chip:QUESTION_CHIPS[status],answer,why,bullets:[],points:[],blocks:[],after:'',openMore:false,steps:false,...extra});
  // 1. Planning
  const planningMissing=[];
  if(!(stage1HasValue(facts.width)&&stage1HasValue(facts.length)))planningMissing.push('The size of the building');
  if(!nation)planningMissing.push('The site country (we set this from the postcode in Site Layout)');
  if(facts.siteBoundaryStatus!=='confirmed')planningMissing.push('Every site boundary marked in Site Layout');
  const planningPoints=[];
  if(onSite==='Yes')planningPoints.push("You've told us there is already a building on the site. Its size and use will matter, so expect to be asked about it.");
  else if(onSite==='No')planningPoints.push("You've told us there is no building on the site today, so this would be treated as a new building.");
  else planningPoints.push("We don't know yet whether there is an existing building on the site. It changes the answer, so it is worth finding out.");
  let planningStatus='likely',planningAnswer="Most new industrial buildings need a full planning application. You'll need professional support to confirm.";
  if(planningMissing.length){planningStatus='needinfo';planningAnswer="Most new industrial buildings need a full planning application. We can't say more until we have the details below.";planningMissing.forEach(text=>planningPoints.push(`Still needed: ${text}`))}
  else if(nation==='Wales')planningAnswer="Planning rules in Wales are different from England. Planning permission is likely to be needed. You'll need professional support.";
  else if(nation==='Scotland')planningAnswer="Planning rules in Scotland are different. Planning permission is likely to be needed. You'll need professional support.";
  else if(linked){planningStatus='possibly';planningAnswer="A small extension to an existing industrial site is sometimes dealt with differently from a full application, but it depends on details we don't have yet. Please don't assume. You'll need professional support to confirm."}
  const planningBullets=[];
  if(planningMissing.length)planningBullets.push('Most new industrial buildings need a full planning application',"We can't say more until we have your details");
  else if(nation==='Wales')planningBullets.push('Planning rules in Wales are different from England','Planning permission is likely to be needed');
  else if(nation==='Scotland')planningBullets.push('Planning rules in Scotland are different','Planning permission is likely to be needed');
  else if(linked)planningBullets.push('A small extension is sometimes treated differently',"It depends on details we don't have yet, so please don't assume");
  else planningBullets.push('Most new industrial buildings need a full planning application');
  planningBullets.push(onSite==='Yes'?'Existing building on site: its size and use will matter':onSite==='No'?'No building on the site today: treated as a new building':"Existing building on site: we don't know yet");
  planningBullets.push("You'll need professional support to confirm");
  add(planningStatus,planningAnswer,'Planning comes first. The other steps rely on what is approved, and changing the size or height later can mean applying again.',
    {bullets:planningBullets,steps:true,points:planningPoints,blocks:[{heading:'Conditions councils often attach (general)',items:PLANNING_CONDITIONS},{heading:'Common reasons councils refuse (general)',items:PLANNING_REFUSAL_REASONS}],
     blockNote:'These two lists are general. They are not specific to your site.',after:'Stage 2: Stuart checks which of these are likely for your site.'});
  // 2. Structural engineer
  const engineerPoints=[];
  if(linked)engineerPoints.push('Joining onto, or standing close to, an existing building usually means more engineering input at the join.');
  if(onSite==='Yes')engineerPoints.push("You've told us there is already a building on site, so the engineer will want to know about its foundations.");
  if(baseKind==='slab')engineerPoints.push('If you hope to reuse an existing slab, an engineer has to confirm it in writing first.');
  engineerPoints.push("If the size or height changes later, the engineer's design usually has to be redone.");
  add('likely',"Almost any steel building needs a structural engineer to design the base and the connections between the building and the base. Building Control will expect their calculations. This is separate from the building supplier. You'll need professional support.",
    'The base design can hold up the start of the building.',{bullets:['Almost any steel building needs one','They design the base and its connections','Separate from the building supplier',"You'll need professional support"],points:engineerPoints});
  // 3. Existing base, roads, drainage, ground and services
  const groundPoints=[];
  if(projectReuseIntention(facts)==='Yes — assess it for reuse'&&['No','Not sure'].includes(projectSiteEvidenceAvailability(facts)))groundPoints.push('Without drawings or surveys, nobody can say yet whether what is there can be used.');
  if(baseKind==='slab'&&projectReuseIntention(facts)==='No — a new base is planned')groundPoints.push('You told us you plan a new base instead.');
  if(facts.level==='No')groundPoints.push('You told us the site is not level. A sloping site can need retaining walls.');
  if(facts.services==='Yes')groundPoints.push('You told us there are drains or services on site. They may be under the building.');
  if(onSite==='Yes')groundPoints.push("You've told us there is a building on site already. Anything built near or against it adds checks.");
  groundPoints.push('Roads, hard standing and access for fire engines and delivery vehicles are your responsibility.');
  groundPoints.push('Surface water and foul drainage connections are separate from the building. They may need design and approval.');
  groundPoints.push('Old mining, made ground or gas can add work to the base.');
  groundPoints.push('Pipes and cables under the building area can affect where it goes and how the base is built.');
  const groundBullets=[baseKind==='structure'?'Building on or against an existing structure needs a structural check':baseKind==='slab'?'An existing slab may be usable, but only after a structural check':baseKind==='new'?'A new or strengthened base is likely':"We can't say what you're building on yet",
    'Roads, drainage and services are separate from the building',
    'Old mining, made ground or gas can add work',
    "You'll need professional support"];
  if(baseKind==='structure')add('likely',"Building on or against an existing structure needs a structural check. You'll need professional support.",'This is often the hidden part of the job, and it is usually outside the building price.',{bullets:groundBullets,points:groundPoints});
  else if(baseKind==='slab')add('possibly',"An existing slab may be usable, but it is unlikely to be accepted without a structural check of what is underneath and how thick it is. You'll need professional support.",'This is often the hidden part of the job, and it is usually outside the building price.',{bullets:groundBullets,points:groundPoints});
  else if(baseKind==='new')add('likely',"The surface alone doesn't show that it can carry a steel building. A new or strengthened base is likely. You'll need professional support.",'This is often the hidden part of the job, and it is usually outside the building price.',{bullets:groundBullets,points:groundPoints});
  else add('needinfo',"We can't say what you're building on yet. Tell us what is on the ground now.",'This is often the hidden part of the job, and it is usually outside the building price.',{bullets:groundBullets,points:groundPoints});
  // 4. Building Regulations (the live regs-checker flags are shown here, in plain words)
  const regsBlocks=[],regsPoints=[];
  const cold=projectIsSteelFreeStanding(facts)?stage1SteelEnvelope(facts).label==='Get professional support':Boolean(p.stage1Assessments&&p.stage1Assessments.specialistLowTemperatureFlag);
  if(cold)regsPoints.push('You asked for a store colder than 2°C. That needs specialist design and extra checks.');
  regsPoints.push('Later changes, such as adding a mezzanine floor, need their own checks.');
  regsPoints.push('Building Control signs the finished building off at the end, so expect inspections along the way.');
  if(regs){
    if(regs.problems.length)regsBlocks.push({heading:'What we have spotted for your building',items:regs.problems.map(item=>item.why?`${item.text} ${item.why}`:item.text)});
    if(regs.support.length)regsBlocks.push({heading:"Worth a professional's opinion",items:regs.support});
    if(regs.needInfo.length)regsBlocks.push({heading:"We can't check these yet",items:regs.needInfo});
  }else regsPoints.unshift('We have not run the boundary and fire checks yet. Finish Site Layout and Building Design first.');
  let regsStatus='likely',regsAnswer="Building Control will check fire safety (especially walls near a boundary), escape routes, access for disabled people and energy use. Even an unheated building may need a written energy statement. You'll need professional support.";
  if(nation==='Wales'){regsStatus='needinfo';regsAnswer="Wales has its own Building Regulations guidance. You'll need professional support."}
  else if(nation==='Scotland'){regsStatus='needinfo';regsAnswer="Scotland has a separate building warrant system. You'll need professional support."}
  else if(!nation){regsStatus='needinfo';regsAnswer="We need to know the site country before we can say. We set it from the postcode in Site Layout."}
  const regsBullets=[regsStatus==='needinfo'?(nation==='Wales'?'Wales has its own Building Regulations guidance':nation==='Scotland'?'Scotland has a separate building warrant system':'We need the site country first (set from the postcode in Site Layout)'):'Fire safety, especially walls near a boundary','Escape routes, disabled access and energy use','Building Control signs it off at the end',"You'll need professional support"];
  add(regsStatus,regsAnswer,'Building Control can hold up the job until it is satisfied.',{bullets:regsBullets,points:regsPoints,blocks:regsBlocks,openMore:regsBlocks.length>0});
  // 5. CDM: who runs the site
  const cdmPoints=['Ask early who will be principal designer and who will be principal contractor.',
    'If more than one contractor will work on site and nobody is appointed in writing, those duties fall on you.',
    'Larger jobs must be notified to the Health and Safety Executive (HSE) before work starts: more than 30 working days with more than 20 people on site at once, or more than 500 person-days.'];
  if(runs==='Yes')cdmPoints.unshift("You've told us you'll run the site yourself. In our experience that usually means you act as the principal contractor, and often as the principal designer too, so those duties sit with you and your own site safety team. That is our usual experience, not a legal rule.");
  else if(runs==='No')cdmPoints.unshift("You've told us someone else will run the site. They need to be appointed as principal contractor in writing before work starts, and a principal designer too.");
  else cdmPoints.unshift("Need info: we don't know yet who will run the site.");
  add('likely','CDM (the Construction (Design and Management) Regulations 2015) gives you, the client, legal duties for health and safety on your project, even when others do the work. In our experience the client usually acts as, or appoints, the principal contractor, and is often the principal designer as well. Bigger sites usually run their own permits through their own health and safety team. That is our usual experience, not a legal rule.',
    'These are legal duties, and they apply before work starts.',
    {bullets:['As the client, you have legal duties under CDM, even when others do the work','In our experience you often act as, or appoint, both the principal designer and the principal contractor','Ask early who will hold each role','Larger jobs must be notified to the HSE before work starts','Project Check is guidance only and holds no CDM role'],points:cdmPoints});
  // 6. Site risks and access. General patterns only (problems only). No job-specific details.
  // Do not mention RAMS, risk assessments or method statements on client pages, the report or the PDF. Project Check is guidance only and holds no CDM role. Never present these as statistics, and never name a past job on a client page.
  const siteBlocks=[
    {heading:'Getting in and unloading',items:['Vehicle access: a long lorry or a crane may not be able to reach or turn at the building position.','Deliveries: is there a clear, flat area close by to set down materials and lay them out?','Deliveries can compete with your own traffic and people.']},
    {heading:'Before work starts',items:['Your own site induction and permits are needed before anyone starts, including a permit to dig.','Buried and overhead services, and any overhead obstructions, must be checked. They may not be where the drawings say.','Is the ground or base really concrete, and firm enough? Old hardstanding or a buried base may be of unknown strength.']},
    {heading:'While it is being built',items:['Crane lifts need a lift plan, and the crane and its paperwork are often settled late.','Wind can stop work, especially crane lifts and roof sheeting, so a tight programme can slip.','Working at height on access platforms needs firm, level ground and clear routes.','Noise and vibration from tools can affect neighbours and people working nearby.','Planning conditions can cover crane notification, contamination and working hours.','Power and welfare (toilets) for the crew are normally yours to provide.']},
    {heading:'If the site stays in use, or you are joining an existing building',items:['A live yard or your own operations next to the work will limit when and where work can happen.','Joining onto an existing building: the opening size may not match the door size.','Stock or kit stored under a roof being replaced has to be moved or protected.','Clear space is often needed beside fire walls and boundaries.','Is there any asbestos or contamination information, and who holds it?']}
  ];
  const siteIntro=[];
  if(onSite==='Yes')siteIntro.push("You've told us there is a building on the site already, so it may well be a live site while the work goes on.");
  if(linked)siteIntro.push('Joining onto an existing building means the opening has to be planned, and it may not match the door size.');
  add('likely','Putting up a steel building is a big operation on your site. These are the things you will probably have to deal with on the day.',
    'If these are not ready, deliveries and the build can be held up.',
    {bullets:['Vehicle access, deliveries and space to set down materials','A live yard or your operations next to the work, and your induction and permits','Services or overhead obstructions that may not be where the drawings say','Crane lifts, wind, working at height, and ground or old hardstanding of unknown strength'],points:siteIntro,blocks:siteBlocks,openMore:true,
     blockNote:'This is general information about steel building jobs. Project Check is guidance only and holds no CDM role.'});
  // 7. Consultants and fees
  add('likely',"The building supplier supplies and erects the building. The independent professionals are normally appointed and paid by you, separately from the building price. Project Check does not appoint or pay them. You'll need professional support.",
    'These fees are extra to the building price.',
    {bullets:['Structural engineer and Building Control: likely','Principal designer for CDM: likely, appointed by you','Planning consultant, fire engineer, drainage and ground specialists: possibly','Appointed and paid by you, separately from the building price'],points:['Structural engineer: Likely','Building Control (the council or a registered approver): Likely','Principal designer for CDM: Likely','Planning consultant or architect: Possibly','Fire engineer: Possibly','Drainage and ground specialists: Possibly, depending on your site','Sometimes electrical and fire alarm designers for lighting and alarms.']});
  return list
}
function stage1QuestionCardMarkup(q){
  const blocks=q.blocks.map(block=>`<div class="simple-qblock"><h4>${esc(block.heading)}</h4><ul class="simple-list simple-list-tight">${block.items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></div>`).join('');
  const more=`<p class="simple-qanswer">${esc(q.answer)}</p>${q.points.length?`<ul class="simple-list simple-list-tight simple-qpoints">${q.points.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}${q.blockNote?`<p class="meta simple-qnote">${esc(q.blockNote)}</p>`:''}${blocks?`<div class="simple-qblocks">${blocks}</div>`:''}${q.after?`<p class="simple-qafter">${esc(q.after)}</p>`:''}`;
  return `<article id="simpleQcard${q.n}" class="simple-qcard simple-qcard--${q.status} simple-topic-${q.n}" aria-labelledby="simpleQ${q.n}">
<div class="simple-qhead"><span class="simple-qnum" aria-hidden="true">${q.n}</span><span class="simple-qicon">${S1_TOPICS[q.n-1].icon}</span><h3 id="simpleQ${q.n}">${esc(q.title)}</h3></div>
<p class="simple-chip-row"><span class="simple-chip-lead">Problem for you?</span><span class="simple-chip simple-chip--${q.status}">${esc(q.chip)}</span></p>
<ul class="simple-bullets">${q.bullets.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>
${q.steps?planningStepViewMarkup():''}
<details class="simple-more"${q.openMore?' open':''}><summary>More detail</summary>${more}</details>
<p class="simple-qwhy"><strong>Why it matters:</strong> ${esc(q.why)}</p></article>`
}
// The report ends gently: a free call first, saving the project second, Stage 2 only as an offer.
// Counts for the summary strip: things to deal with (not "Unlikely"), how many are likely, how many still need information.
function stage1SummaryCounts(list){
  const count=status=>list.filter(q=>q.status===status).length;
  return {deal:list.filter(q=>q.status!=='unlikely').length,likely:count('likely'),needinfo:count('needinfo')}
}
function stage1ReportActionsMarkup(id,list){
  const c=stage1SummaryCounts(list);
  return `<section class="simple-summary-strip" aria-labelledby="simpleNextTitle"><h2 id="simpleNextTitle">An easy next step</h2>
<ul class="simple-summary-stats"><li><strong>${c.deal}</strong><span>thing${c.deal===1?'':'s'} to deal with</span></li><li><strong>${c.likely}</strong><span>Likely</span></li><li><strong>${c.needinfo}</strong><span>Need info</span></li></ul>
<p class="simple-summary-note">If you'd like to talk it through, Stuart is happy to have a short chat. There's no pressure and no sales pitch.</p>
<div class="simple-cta-row">${callButton('btn green simple-cta simple-cta-main')}<button type="button" class="btn simple-cta simple-cta-alt" onclick="route('project','${esc(id)}')">Save your project</button><button type="button" class="btn simple-cta simple-cta-alt" onclick="downloadReport('${esc(id)}','s1')">Download PDF</button></div>
<p class="simple-summary-note simple-stage2-offer">When you're ready, there's also Stage 2, where Stuart goes through the answers and a plan with you. <button type="button" class="simple-linkbtn" onclick="route('stage2','${esc(id)}')">See what Stage 2 includes</button></p></section>`
}
function stage1Summary(id){
if(!requireUser())return;
let p=getP(id);if(!p)return route('dashboard');
{
  const gaps=stage1SteelReportGaps(p);
  if(gaps.length||!p.stage1SummaryConfirmed){
    app.innerHTML=`<main class="container stage1-workspace"><section class="stage1-tech-card"><h1>Your probable problems</h1><p>We need a few more answers before we can show them. Check your details first.</p><ul>${gaps.map(gap=>`<li>${esc(gap)}</li>`).join('')}</ul><button class="btn green" data-route="stage1Confirm" data-id="${esc(id)}">Check your details</button></section></main>`;
    return;
  }
  if(!p.stage1Complete){
    p.stage1Complete=true;
    p.stage='Stage 1 complete';
    p.history.push({at:now(),text:'Stage 1 assessment completed'});
    save();
  }
  runStage1Risks(p);
  syncAuth();
}
document.body.dataset.page='stage1-shell';
const today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
// An early check, not a design or an approval. Every card is a probable problem for the paid stage to deal with.
const questions=stage1ClientQuestions(p);
app.innerHTML=`<div class="container simple-report">
<header class="simple-report-head"><img class="workspace-logo" src="assets/project-check-logo.png" alt="Project Check — Know before you build."><div class="simple-report-title"><div class="eyebrow">Free check</div><h1>${esc(p.name)}</h1><p class="meta">${esc(today)}</p></div><button class="btn secondary" onclick="route('project','${esc(id)}')">Back to my project</button></header>
<p class="simple-lead simple-report-intro">${esc(STAGE1_INTRO)}</p>
${topicIconGridMarkup(questions)}
${stage1BasisMarkup(p)}
<section class="simple-qlist" aria-label="Your questions and probable answers">${questions.map(stage1QuestionCardMarkup).join('')}</section>
${stage1OptionalMarkup(p)}
<section class="card simple-know" aria-labelledby="simpleKnowTitle"><h2 id="simpleKnowTitle">What we still don't know</h2>${stage1KnowledgeMarkup(p)}</section>
${stage1ReportActionsMarkup(id,questions)}</div>`
}

const stage2Questions=[
['beneathSurface','What is known to be beneath the visible surface?','select',['Existing concrete slab','Hardcore / stone build-up','Made ground / fill','Natural ground','Mixed / uncertain','Unknown','New Base Design']],
['slabThickness','Is the existing slab thickness known?','select',['Yes','No','Not applicable','Not sure']],
['slabThicknessDetail','If known, what slab thickness information do you have?','text','e.g. 200 mm, variable, drawing reference, unknown'],
['reinforcement','Is the slab reinforcement known?','select',['Yes','No','Not applicable','Not sure']],
['groundTesting','Has any ground or slab investigation been completed?','select',['Yes — ground investigation','Yes — trial pits','Yes — core samples / slab testing','Yes — more than one of these','No','In progress','Not sure']],
['surfaceCondition','What is known about the condition of the footprint?','select',['No obvious issues reported','Cracking / settlement','Potholes / damaged surface','Standing water / drainage issue','Heavy vehicle damage','Multiple issues','Not assessed']],
['topo','Is a topographical/level survey available?','select',['Yes','No','In progress','Not sure']],
['drainInfo','Is reliable drainage information available?','select',['Yes — drawings / survey','Partly','No','Not sure']],
['serviceInfo','Is reliable underground-service information available?','select',['Yes — survey / verified drawings','Partly','No','Not sure']],
['planning','What is the planning position?','select',['Not started','Pre-application / advice stage','Application being prepared','Submitted','Approved','Permission believed not required','Not sure']],
['planningConstraints','Are any planning constraints or previous conditions known?','select',['Yes','No','Not sure']],
['planningDetail','Planning constraints / previous history details','textarea','Add anything known about conditions, neighbours, highways, height, appearance or previous applications'],
['buildingControl','What is the Building Regulations / Building Control position?','select',['Not started','Building Control route selected','Design information being prepared','Application / plans submitted','Approved / accepted stage reached','Not sure']],
['fireStrategy','Is a project fire strategy or fire-design review available?','select',['Yes','No','In progress','Not sure']],
['sprinklers','Are sprinklers required, proposed or expected?','select',['Yes','No','Not sure']],
['occupancy','Approximate maximum number of people expected in the building?','number',''],
['racking','Will the building contain significant racking?','select',['Yes','No','Not sure']],
['mezzanine','Is a mezzanine or internal upper floor proposed?','select',['Yes','No','Not sure']],
['crane','Is an overhead crane or other significant suspended load proposed?','select',['Yes','No','Not sure']],
['hazardous','Will hazardous, flammable or unusual materials/processes be present?','select',['Yes','No','Not sure']],
// 'wetProcess' ("Will there be washdown, valeting or another wet process?")
// removed 2026-08-24 per governance decision (MASTER-SPEC.md / CHANGELOG.md) —
// do not reinstate and do not add a replacement question merely to keep the
// question count the same. The label() mapping below is kept so that any
// project with a value already saved under the old key still renders
// correctly in the Stage 2 report instead of falling back to the raw key.
['ev','Is EV charging planned inside or immediately around the building?','select',['Yes','No','Not sure']],
['supplierQuotes','Do you already have supplier quotations for this project?','select',['Yes — one','Yes — two','Yes — three or more','No','Not yet']]
];
// Shared "evidence can be added at any time" panel rendered on every Stage 2
// question — this is the one place that panel is templated, so adding the
// upload control here covers all Stage 2 questions uniformly, not just the
// evidence-flavoured ones (topo/drainage/services etc.).
//
// Rendered separately from stage2()'s own full-page re-render, and re-wired
// in place after each upload, specifically so uploading never touches the
// #answer control — a full stage2(id) re-render would reset it back to the
// last SAVED answer (p.stage2[q[0]]), discarding a selection the customer
// made but hadn't clicked "Save & continue" on yet.
//
// Stage 2 uploads are tagged with p.stage (here always 'Stage 2', since
// startStage2() sets that before this screen is reachable), so they add to
// the same project.evidence array as every other upload location but are
// correctly excluded from the Stage 1 two-file allowance (stage1EvidenceCount
// only counts stage==='Stage 1'). There is no separate Stage 2 upload limit
// in the existing product — none is introduced here, per instruction.
// Stage 2 is not open for payment yet. Every Stage 2 link goes to the Stage 2 page, which explains it and offers the call.
function startStage2(id){route('stage2',id)}
function stage2EvidencePanelHTML(p){
return `<div class="actions"><label class="btn secondary" for="s2files" style="display:inline-block">Upload files</label></div><input type="file" id="s2files" multiple style="display:none"><p class="meta">${uploadsLabel(p,p.stage)}</p><p class="meta">${p.evidence.length?`${p.evidence.length} file(s) recorded for this project: ${p.evidence.map(e=>esc(e.name)).join(', ')}`:'No files uploaded yet for this project.'}</p>`
}
function wireStage2EvidenceUpload(p){
let inp=document.querySelector('#s2files');if(!inp)return;
inp.onchange=async()=>{
await addEvidenceFiles(p,inp.files,p.stage,'Evidence added (Stage 2)');
let st=document.querySelector('#s2evidenceStatus');if(st)st.innerHTML=stage2EvidencePanelHTML(p);
wireStage2EvidenceUpload(p)
}
}
function stage2(id){
if(!requireUser())return;let p=getP(id);if(!p)return;
let idx=Number(sessionStorage.getItem('s2q_'+id)||0);idx=Math.max(0,Math.min(stage2Questions.length-1,idx));let q=stage2Questions[idx],val=p.stage2[q[0]]||'';
app.innerHTML=`<div class="container"><div class="pagehead"><div><div class="eyebrow">Stage 2 · Question ${idx+1} of ${stage2Questions.length}</div><h1>${esc(p.name)}</h1><p class="meta">Deeper evidence and checks</p></div><button class="btn secondary" onclick="route('project','${esc(id)}')">Save & exit</button></div>${progressBar(idx,stage2Questions.length)}<div class="stage-layout"><div class="steps" tabindex="0" role="list" aria-label="Stage 2 questions">${stage2Questions.map((x,i)=>`<div class="step ${i===idx?'active':i<idx?'done':''}" role="listitem">${i+1}. ${esc(x[1].replace(/\?.*/,''))}</div>`).join('')}</div><div class="card"><h2>${esc(q[1])}</h2><div class="field">${controlFor(q,val)}</div><div class="banner"><b>Evidence can be added at any time.</b><div class="meta">Upload quotations, drawings, planning information, surveys, specifications and photographs in the project workspace.</div><div id="s2evidenceStatus" style="margin-top:10px">${stage2EvidencePanelHTML(p)}</div></div><div class="actions"><button class="btn secondary" ${idx===0?'disabled':''} onclick="moveStage2('${esc(id)}',${idx-1})">Back</button><button class="btn green" onclick="saveStage2('${esc(id)}',${idx})">${idx===stage2Questions.length-1?'Complete Stage 2':'Save & continue'}</button></div></div></div></div>`;
wireStage2EvidenceUpload(p)
// Same scroll-reset as stage1() (see the comment there) — question/evidence
// content height varies here too (uploaded-file list length), and this is a
// full innerHTML replacement with no navigation for the browser to reset
// scroll on its own.
window.scrollTo(0,0)
}
function moveStage2(id,idx){sessionStorage.setItem('s2q_'+id,idx);stage2(id)}
function saveStage2(id,idx){
let p=getP(id),q=stage2Questions[idx],v=document.querySelector('#answer').value.trim();if(!v)return alert('Please answer this question before continuing.');p.stage2[q[0]]=v;p.history.push({at:now(),text:`Stage 2 information added: ${q[1]}`});save();
if(idx===stage2Questions.length-1){sessionStorage.removeItem('s2q_'+id);p.stage2Complete=true;p.stage='Stage 2 complete';runStage2Risks(p);p.history.push({at:now(),text:'Stage 2 assessment completed'});save();stage2Summary(id)}else moveStage2(id,idx+1)
}
function runStage2Risks(p){
let s=p.stage2,f=p.facts,risks=[],actions=[];
if(['Unknown','Mixed / uncertain'].includes(s.beneathSurface)||s.groundTesting==='No'||s.groundTesting==='Not sure')risks.push('Ground/slab evidence is insufficient to confirm the correct foundation or base solution.');
if(['No','Not sure'].includes(s.slabThickness)&&/^Concrete/.test(f.base||''))risks.push('An existing concrete surface is present but its structural build-up/thickness is not confirmed.');
if(['No','Not sure'].includes(s.reinforcement)&&/^Concrete/.test(f.base||''))risks.push('Existing slab reinforcement is not confirmed, so load/foundation assumptions remain uncertain.');
if(s.surfaceCondition!=='No obvious issues reported'&&s.surfaceCondition!=='Not assessed')risks.push(`Footprint condition requires review: ${s.surfaceCondition}.`);
if(s.topo!=='Yes')risks.push('Reliable level/topographical evidence is not yet confirmed.');
if(s.drainInfo!=='Yes — drawings / survey')risks.push('Drainage information is incomplete or unverified.');
if(s.serviceInfo!=='Yes — survey / verified drawings')risks.push('Underground-service information is incomplete or unverified.');
if(['Not started','Not sure'].includes(s.planning))risks.push('Planning position is not yet sufficiently established for firm programme assumptions.');
if(['Not started','Not sure'].includes(s.buildingControl))risks.push('Building Regulations / Building Control position is not yet sufficiently established.');
if(s.fireStrategy!=='Yes')risks.push('Project-specific fire design information is not yet confirmed.');
if(s.racking==='Yes')risks.push('Significant racking can affect slab flatness/loading, layout, fire strategy and building coordination.');
if(s.mezzanine==='Yes')risks.push('A mezzanine/internal upper floor changes structural, fire, access and Building Regulations requirements.');
if(s.crane==='Yes')risks.push('Crane/suspended loads require specific structural coordination and must not be treated as a standard building load case.');
if(s.hazardous!=='No')risks.push('Hazardous/unusual processes may materially affect fire, ventilation, separation and compliance requirements.');
if(s.ev==='Yes')risks.push('EV charging should be coordinated with electrical capacity, layout and fire-risk considerations.');
if(!risks.length)risks.push('No major Stage 2 issue was triggered by the answers supplied, but supplier quotations and final design information still require comparison and verification.');
actions.push('Compare supplier quotations on a like-for-like basis before selecting a provider.');
if(s.groundTesting==='No'||s.groundTesting==='Not sure')actions.push('Obtain appropriate ground/slab evidence before final foundation design.');
if(s.topo!=='Yes')actions.push('Obtain reliable level/topographical information.');
if(s.serviceInfo!=='Yes — survey / verified drawings')actions.push('Verify underground services before excavation/foundation work.');
if(s.drainInfo!=='Yes — drawings / survey')actions.push('Verify drainage routes and any conflicts with the proposed footprint.');
if(['Not started','Not sure'].includes(s.planning))actions.push('Establish the planning route and programme before treating supplier lead times as the whole project programme.');
if(['Not started','Not sure'].includes(s.buildingControl))actions.push('Establish the Building Control route and required design submissions.');
p.risks2=risks;p.actions2=actions
}
// Planning Batch 2 (2026-08-26): short, plain-English "pill" label for the
// Stage 2 Planning card's status — mirrors STAGE3_STATUS_LABEL's placement
// (short customer-wording map lives in app.js; the longer restrained
// paragraph per status is computed in evidence.js's
// PLANNING_LIFECYCLE_POSITION_TEXT/buildPlanningStage2Summary()). Never a
// raw enum string is shown to the customer.
const PLANNING_LIFECYCLE_CUSTOMER_LABEL={PREPARATION:'Planning preparation',SUBMITTED:'Planning application submitted',VALIDATED:'Planning application validated',CONSULTATION_IN_PROGRESS:'Planning consultation underway',CONSULTATION_REVIEW:'Planning consultation being assessed',FAVOURABLE_FORMAL_DECISION_PENDING:'Planning progressing positively — formal decision pending',UNCERTAIN_MATERIAL_ISSUE_OUTSTANDING:'Planning issue requires attention',APPROVED_WITH_CONDITIONS:'Planning approved with conditions',APPROVED_PRE_START_ACTIONS_OUTSTANDING:'Planning approved — actions required before work starts',APPROVED_BASELINE_VARIED_OR_AMENDED:'Planning approval updated'};

function stage2Summary(id){
let p=getP(id);
if(typeof buildStage2Findings==='function')buildStage2Findings(p);
// Evidence Intelligence Batch 3 — deliberately restrained, additive-only:
// this card shows ONLY each finding's customer_facing_summary (never
// internal_detail/evidence IDs/source files/why_it_matters, and never a
// final engineering solution, supplier instruction, commercial remedy or
// pass/fail conclusion). It sits entirely separately from, and never
// modifies, the existing "Deeper risks"/"Recommended actions" cards above
// (still driven only by the existing, unchanged runStage2Risks()). Shows
// nothing at all when no evidence-derived findings exist yet, so a project
// with no uploaded evidence sees no change at all.
let stage2Findings=(p.stage2Findings?Object.values(p.stage2Findings):[]);
// Stage 2 background checks on the confirmed Building Design (background-checks.js).
let backgroundChecksCard=typeof pcBackgroundChecksRender==='function'?pcBackgroundChecksRender(p):'';
let evidenceObservationsCard=stage2Findings.length?`<div class="card" style="margin-top:18px"><h3>Evidence-based observations</h3><p class="meta">Based on the documents you have uploaded so far. This is separate from, and does not replace, the deeper risks above or a full technical review.</p><div class="risk-list">${stage2Findings.map(f=>`<div class="risk">${esc(f.customer_facing_summary)}</div>`).join('')}</div></div>`:'';
// Planning Batch 2 (2026-08-26): restrained, additive-only Stage 2
// "Planning" card — renders only when buildPlanningStage2Summary() returns
// something (i.e. genuine planning evidence exists; NOT_ASSESSED renders
// nothing at all, unchanged from before this batch). Shows only the short
// customer label, the one restrained position paragraph, and a small
// number of plain-English observation/attention bullets — never a raw
// enum, evidence ID, confidence value or consultee-by-consultee table.
let planningSummary=(typeof buildPlanningStage2Summary==='function')?buildPlanningStage2Summary(p):null;
// Planning Batch 3 (2026-08-26): "What can you do now?" — a DISTINCT
// sub-section of the same Planning card, deliberately kept visually/
// structurally separate from the planning status pill/paragraph above it
// (governing brief §16: status and progression advice are never merged).
// Plain-English activity labels only — the raw PROJECT_ACTIVITY codes
// computed in evidence.js are never shown to the customer. Rendered only
// when buildPlanningStage2Summary() actually returned a `progression`
// object (never invented when evidence is insufficient).
const PROJECT_ACTIVITY_CUSTOMER_LABEL={DESIGN_DEVELOPMENT:'Design development',QUOTATIONS:'Quotations',SURVEYS_AND_INVESTIGATIONS:'Surveys and investigations',BUILDING_CONTROL_PREPARATION:'Building Control preparation',SUPPLIER_COORDINATION:'Supplier coordination',PROCUREMENT_OR_ORDER:'Ordering / non-refundable commitments',MANUFACTURE:'Manufacture',SITE_ENABLING_WORKS:'Site enabling works',PHYSICAL_CONSTRUCTION_COMMENCEMENT:'Physical construction',OCCUPATION_OR_USE:'Occupation / use'};
function planningProgressionSectionHtml(progression){
if(!progression)return'';
const list=(keys,label)=>keys.length?`<div class="meta" style="margin-top:6px"><b>${esc(label)}:</b></div><ul style="margin:4px 0 0 18px;padding:0">${keys.map(k=>`<li>${esc(PROJECT_ACTIVITY_CUSTOMER_LABEL[k]||k)}</li>`).join('')}</ul>`:'';
return `<div class="meta" style="margin-top:12px"><b>What can you do now?</b></div>${list(progression.can,'Can continue')}${list(progression.careful,'Proceed carefully')}${list(progression.wait,'Wait')}`;
}
// Planning Batch 5 (2026-08-26): a single restrained source/update line —
// never a scraper error, HTTP code, adapter name, raw URL or raw evidence
// ID (governing brief §26). Absent entirely once genuinely NOT_IDENTIFIED
// (no line is better than a confusing one for a project with no planning
// reference at all).
function planningSourceCustomerLine(src){
if(!src||src.retrieval_status==='NOT_IDENTIFIED')return null;
if((src.documents_ingested_evidence_names||[]).length)return'Planning application evidence reviewed.';
return'Planning application reference identified — public documents require review.';
}
let planningSourceLine=planningSourceCustomerLine(p.planningPortalSource);
let planningCard=planningSummary?`<div class="card" style="margin-top:18px"><h3>Planning</h3><p><span class="pill">${esc(PLANNING_LIFECYCLE_CUSTOMER_LABEL[planningSummary.status]||'Planning under review')}</span></p><p>${esc(planningSummary.position_text)}</p>${planningSourceLine?`<p class="meta">${esc(planningSourceLine)}</p>`:''}${planningSummary.observations.length?`<div class="meta" style="margin-top:8px"><b>What Project Check found:</b></div><div class="risk-list">${planningSummary.observations.map(x=>`<div class="risk">${esc(x)}</div>`).join('')}</div>`:''}${planningSummary.attention.length?`<div class="meta" style="margin-top:8px"><b>What needs attention:</b></div><div class="action-list">${planningSummary.attention.map(x=>`<div class="action-item">${esc(x)}</div>`).join('')}</div>`:''}${planningProgressionSectionHtml(planningSummary.progression)}</div>`:'';
app.innerHTML=`<div class="container"><img class="report-logo" src="assets/project-check-logo.png" alt="Project Check — Know before you build."><div class="pagehead"><div><div class="eyebrow">Stage 2 complete</div><h1>Deeper Project Check</h1><p class="meta">${esc(p.name)} · ${esc(p.address)}</p></div><button class="btn secondary" onclick="route('project','${esc(id)}')">Project workspace</button></div>
<div class="card"><h3>Industrial building reference visual</h3><p class="meta">Illustrative reference image of a modern industrial/warehouse-style building, shown for general context only — this is not a depiction of your specific proposed building. Your project-specific preliminary plan and elevations are reviewed in the doors &amp; drawing step below.</p><img class="report-building" src="assets/project-check-building-reports.png" alt="Illustrative modern industrial building, shown for general reference only"></div>
<div class="grid2"><div class="card"><h3>Deeper risks</h3><div class="risk-list">${p.risks2.map(x=>`<div class="risk">${esc(x)}</div>`).join('')}</div></div><div class="card"><h3>Recommended actions</h3><div class="action-list">${p.actions2.map(x=>`<div class="action-item">${esc(x)}</div>`).join('')}</div></div></div>
${evidenceObservationsCard}
${backgroundChecksCard}
${planningCard}
<div class="card" style="margin-top:18px"><span class="pill blue">Drawing review</span><h2>Review & position doors</h2><p>Check the preliminary plan and elevations, then reposition, add or remove roller and personnel doors before finalising this stage.</p><div class="actions"><button class="btn green" onclick="route('doors','${esc(id)}')">Review doors & drawing</button></div></div>
<div class="card" style="margin-top:18px"><span class="pill warn">Next step</span><h2>Compare suppliers before you commit</h2><p>If you already have quotations, add them to this project and compare inclusions, exclusions, lead time and price. If you do not, Project Check can record a request for <b>three quotations from three suitable suppliers</b>.</p><div class="actions"><button class="btn" onclick="downloadReport('${esc(id)}','s2')">Download Stage 2 PDF</button><button class="btn green" onclick="route('quotes','${esc(id)}')">Supplier quotations</button></div></div></div>`
}

function quotes(id){
if(!requireUser())return;let p=getP(id);if(!p)return;if(!p.stage2Complete)return alert('Complete Stage 2 first.');
// Stage 2 background checks (boundary distance, indicative fire exits, other
// flags) for a confirmed Building Design. See background-checks.js.
const fireExitCard=typeof pcBackgroundChecksRender==='function'?pcBackgroundChecksRender(p):'';
app.innerHTML=`<div class="container"><div class="pagehead"><div><div class="eyebrow">Supplier comparison</div><h1>Quotations</h1><p class="meta">${esc(p.name)}</p></div><button class="btn secondary" onclick="route('project','${esc(id)}')">Project workspace</button></div>
<div class="grid2"><div class="card"><h3>Add a quotation you already have</h3><div class="field"><label>Supplier</label><input id="qsupplier" placeholder="Supplier name"></div><div class="grid2"><div class="field"><label>Quoted price (£)</label><input id="qprice" type="number" step="1"></div><div class="field"><label>Lead time</label><input id="qlead" placeholder="e.g. 12 weeks"></div></div><div class="field"><label>What is included / excluded?</label><textarea id="qscope" placeholder="Main scope, exclusions, assumptions, optional items"></textarea></div><div class="field"><label>Quotation file</label><input id="qfile" type="file"></div><button class="btn green" onclick="addQuote('${esc(id)}')">Add quotation</button></div>
<div class="card"><span class="pill">Three suppliers</span><h3>Request three suitable quotations</h3><p>Record a request for three quotations from three different suitable building suppliers. This prototype records the request; production will route the project through the supplier-matching workflow.</p>${p.supplierRequest?`<div class="banner green"><b>Request recorded</b><div class="meta">${new Date(p.supplierRequest.at).toLocaleString()}</div></div>`:`<button class="btn green" onclick="requestThreeSuppliers('${esc(id)}')">Request 3 quotations</button>`}</div></div>
${fireExitCard}
<div class="card" style="margin-top:18px"><h3>Quotation comparison</h3>${p.quotes.length?`<table><thead><tr><th>Supplier</th><th>Price</th><th>Lead time</th><th>Scope / exclusions</th><th>File</th></tr></thead><tbody>${p.quotes.map(q=>`<tr><td>${esc(q.supplier)}</td><td>${q.price?`£${Number(q.price).toLocaleString()}`:'—'}</td><td>${esc(q.lead||'—')}</td><td>${esc(q.scope||'—')}</td><td>${esc(q.file||'—')}</td></tr>`).join('')}</tbody></table>`:`<p class="meta">No quotations recorded yet.</p>`}</div></div>`
}
// Stage 2 design summary for quotation (#quotationSummary/<project id>). Shows the
// confirmed Building Design with the Stage 2 background checks (background-
// checks.js): distance to boundary, indicative fire exits (industrial only) and
// other flags. Read-only; not part of Stage 1, the free report, Site Layout or
// Building Design, and reachable for free-standing (steel) projects, which the
// legacy Stage 2 routes redirect away from.
function quotationSummary(id){
if(!requireUser())return;let p=getP(id);if(!p)return route('dashboard');
document.body.dataset.page='quotationSummary';
const confirmed=typeof pcFireExitDesignConfirmed==='function'&&pcFireExitDesignConfirmed(p);
const card=typeof pcBackgroundChecksRender==='function'?pcBackgroundChecksRender(p,{drawingOpen:true}):'';
const body=!confirmed
  ?`<div class="card"><h3>Building Design not confirmed</h3><p>The Stage 2 design summary is available once the Building Design has been confirmed.</p><button class="btn green" onclick="route('buildingLayout','${esc(id)}')">Open Building Design</button></div>`
  :card;
app.innerHTML=`<div class="container quotation-summary"><div class="pagehead"><div><div class="eyebrow">Stage 2 · Quotation design summary</div><h1>Stage 2 design summary</h1><p class="meta">${esc(p.name)} · ${esc(p.address||'')}</p></div><button class="btn secondary" onclick="route('stage1Workspace','${esc(id)}')">Project overview</button></div>${body}</div>`;
}
function addQuote(id){let p=getP(id),supplier=document.querySelector('#qsupplier').value.trim(),price=document.querySelector('#qprice').value.trim(),lead=document.querySelector('#qlead').value.trim(),scope=document.querySelector('#qscope').value.trim(),file=document.querySelector('#qfile').files[0];if(!supplier)return alert('Enter the supplier name.');if(file&&!splitUnreadablePhotos([file]).length)return;p.quotes.push({id:crypto.randomUUID(),supplier,price,lead,scope,file:file?.name||'',at:now()});if(file)p.evidence.push({name:file.name,size:file.size,type:file.type,at:now(),stage:'Quotation'});p.history.push({at:now(),text:`Supplier quotation added: ${supplier}`});save();quotes(id)}
function requestThreeSuppliers(id){let p=getP(id);p.supplierRequest={at:now(),count:3,status:'Requested'};p.history.push({at:now(),text:'Requested three quotations from three suitable suppliers'});save();quotes(id)}

// Evidence Intelligence Batch 4 — customer-facing Stage 3 action detail. This
// AUGMENTS the existing Stage 3 architecture (pricing() § £99/£249,
// selectPlan()'s existing p.plan entitlement flag) rather than replacing or
// duplicating it: no new price, no new entitlement mechanism, no change to
// selectPlan() or the £99/£249 amounts. Gated on the exact same p.plan flag
// selectPlan() already sets — if it isn't set, this route shows nothing and
// silently returns to the project workspace, so detailed actions are never
// visible before the existing Stage 3 Solutions entitlement/access condition
// is met (never reachable from Stage 1 or Stage 2, and not linked from
// either). Customer view exposes ONLY: action title/what's needed, why,
// information required, status and likely responsible party — never raw
// evidence IDs, internal_detail, source files/pages or confidence (see
// evidenceLedgerPage() for the full internal detail, dev-only as before).
// Batch 4 (2026-08-26): 5 new statuses added for evidence-gated closure of
// Batch-3-derived actions — APPARENTLY_RESOLVED deliberately stays out of
// the "resolved" bucket below (see open/resolved split) since an apparent
// acceptance is explicitly NOT yet confirmed closure.
// Batch 5 (2026-08-26): customer-facing status wording consolidated so the
// legacy 'RESOLVED' status (still used, unrenamed, by every existing
// ACTION_RULES-derived action — see evidence.js) and the newer 'CLOSED'
// status (Batch-3-derived actions) read as the SAME concept to a customer
// ("Closed"), even though the two remain genuinely distinct, unrenamed
// values internally (preserving every existing stored project's data and
// the accepted Batch 4 test suite, which asserts the literal enum values).
// 'SUPERSEDED' is grouped the same way — no longer actionable, from the
// customer's point of view. This is the ONLY change in this map versus the
// Batch 4 version; every other key's wording is unchanged.
const STAGE3_STATUS_LABEL={OPEN:'Open',INFORMATION_REQUIRED:'Information required',AWAITING_SPECIALIST:'Awaiting specialist input',AWAITING_SUPPLIER:'Awaiting supplier',AWAITING_CUSTOMER:'Awaiting your input',AWAITING_DESIGN:'Awaiting design',AWAITING_CONFIRMATION:'Awaiting confirmation',RESOLVED:'Closed',SUPERSEDED:'Closed',EVIDENCE_REQUESTED:'Waiting for information',EVIDENCE_RECEIVED:'Evidence received — under review',UNDER_REVIEW:'Under review',APPARENTLY_RESOLVED:'Apparently resolved — pending confirmation',CLOSED:'Closed'};
// Batch 5: the ONE case where "evidence received but not yet accepted" (the
// brief's EVIDENCE_RECEIVED concept) can be shown SAFELY and RELIABLY,
// without inventing a general-purpose relevant-but-insufficient detector —
// an authority-requirement-sourced action whose linked Batch 3 requirement
// has already reached RESPONSE_SUPPLIED. This is a PRESENTATION-layer
// override only: the stored `action_status` stays exactly 'OPEN' (so the
// accepted Batch 4 regression suite's own assertion — RESPONSE_SUPPLIED
// alone does not advance the stored status — is completely unaffected);
// only the customer-facing LABEL differs. A general EVIDENCE_RECEIVED/
// UNDER_REVIEW detector for discrepancy- or missing-evidence-sourced
// actions was deliberately NOT attempted — there is no existing, reliable
// signal to distinguish "an uploaded document is relevant but insufficient"
// from "irrelevant" for those two categories without risking false
// positives (see the task report, § M).
function stage3CustomerStatusLabel(a,p){
if(a.action_status==='OPEN'&&a.category==='authority_requirement'){
let req=(p.authorityRequirements||[]).find(r=>(a.authority_requirement_ids||[]).includes(r.requirement_id));
if(req&&req.status==='RESPONSE_SUPPLIED')return'Evidence received — under review'
}
return STAGE3_STATUS_LABEL[a.action_status]||a.action_status
}
function stage3StatusIsClosedLike(a){return a.action_status==='RESOLVED'||a.action_status==='CLOSED'||a.action_status==='SUPERSEDED'}

// buildingDrawingSVG() and svgToPngDataUrl() now live in drawing.js, driven by
// buildGeometry()/ensureGeometry() in geometry.js — the single project-geometry
// source of truth (Sprint 2). Loaded before this file; see index.html.

// --- Stage 2 door review: Generate -> Review -> Adjust -> Confirm -> Regenerate ---
let doorReviewSelected=null;
function wallName(w){return ({front:'Front (gable)',back:'Back (gable)',left:'Left (side)',right:'Right (side)'})[w]||w}
function renderGeomIssues(issues){return issues.length?`<div class="risk-list">${issues.map(i=>`<div class="risk">${esc(i.message)}</div>`).join('')}</div>`:'<p class="meta">No obvious geometry conflicts (overlaps, off-wall or over-wide openings) detected in the basic check.</p>'}
function doorReview(id){
if(!requireUser())return;let p=getP(id);if(!p)return;
if(!p.stage1Complete)return alert('Complete Stage 1 first so Project Check has dimensions to draw from.');
ensureGeometry(p);
if((doorReviewSelected===null||!p.geometry.doors.some(d=>d.id===doorReviewSelected))&&p.geometry.doors.length)doorReviewSelected=p.geometry.doors[0].id;
renderDoorReview(id)
}
function renderDoorReview(id,justConfirmed){
let p=getP(id);if(!p)return;
const geom=p.geometry,issues=validateGeometry(geom),sel=geom.doors.find(d=>d.id===doorReviewSelected)||null,svg=buildingDrawingSVG(p);
app.innerHTML=`<div class="container"><div class="pagehead"><div><div class="eyebrow">Stage 2 · Doors & drawing review</div><h1>${esc(p.name)}</h1><p class="meta">Generate → review → adjust → confirm → regenerate.</p></div><button class="btn secondary" onclick="route('project','${esc(id)}')">Save & exit</button></div>
${justConfirmed?'<div class="banner green"><b>Confirmed.</b><div class="meta">Door positions are saved. Every plan and elevation view now reflects this project geometry.</div></div>':''}
<div class="card"><div class="svg-wrap">${svg||'<p class="meta">Add width, length and clear height in Stage 1 to generate a drawing.</p>'}</div></div>
<div class="card" style="margin-top:16px"><h3>Basic geometry check</h3><p class="meta">Basic geometric check only — not a structural, fire or Building Regulations check.</p><div id="geomIssues">${renderGeomIssues(issues)}</div></div>
<div class="card" style="margin-top:16px"><h3>Doors</h3><div class="actions" style="margin-bottom:12px"><button class="btn secondary" onclick="addDoor('${esc(id)}','roller')">+ Add roller door</button><button class="btn secondary" onclick="addDoor('${esc(id)}','personnel')">+ Add personnel door</button></div>
<div class="door-list">${geom.doors.map(d=>`<div class="door-list-row ${d.id===doorReviewSelected?'selected':''}" onclick="selectDoor('${esc(id)}','${d.id}')"><div><strong>${esc(doorLabel(d))}</strong><div class="meta" id="doorMeta-${d.id}">${esc(wallName(d.wall))} wall · ${d.offset} m from left-hand corner · ${d.width} m wide${d.type==='roller'?` × ${d.height} m high (${esc(d.access||'access not set')})`:''}</div></div><button class="btn secondary small" onclick="event.stopPropagation();removeDoor('${esc(id)}','${d.id}')">Remove</button></div>`).join('')||'<p class="meta">No doors recorded yet.</p>'}</div></div>
${sel?`<div class="card" style="margin-top:16px"><h3>Position ${esc(doorLabel(sel))}</h3>
<div class="field"><label>Wall</label><select id="doorWall" onchange="changeDoorWall('${esc(id)}','${sel.id}')"><option value="front" ${sel.wall==='front'?'selected':''}>Front (gable)</option><option value="back" ${sel.wall==='back'?'selected':''}>Back (gable)</option><option value="left" ${sel.wall==='left'?'selected':''}>Left (side)</option><option value="right" ${sel.wall==='right'?'selected':''}>Right (side)</option></select></div>
<div class="field"><label>Position along the ${esc(wallName(sel.wall))} wall — visual</label><input id="doorSlider" type="range" min="0" max="${Math.max(0,wallLengthFor(geom,sel.wall)-sel.width).toFixed(2)}" step="0.1" value="${sel.offset}" oninput="moveDoor('${esc(id)}','${sel.id}',this.value)"></div>
<div class="field"><label>Position along the ${esc(wallName(sel.wall))} wall — numeric (metres from left-hand corner)</label><input id="doorNumeric" type="number" step="0.1" min="0" max="${Math.max(0,wallLengthFor(geom,sel.wall)-sel.width).toFixed(2)}" value="${sel.offset}" oninput="moveDoor('${esc(id)}','${sel.id}',this.value)"></div>
<p class="map-status" id="doorStatus">${esc(doorLabel(sel))}: approximately ${sel.offset} m from the left-hand corner of the ${esc(wallName(sel.wall))} wall.</p>
</div>`:''}
<div class="card" style="margin-top:16px"><div class="actions"><button class="btn green" onclick="confirmDoors('${esc(id)}')">Confirm & regenerate drawing</button></div><p class="meta">Confirming saves door positions to the project and regenerates the plan and elevations from the same project geometry used everywhere else in Project Check.</p></div>
</div>`
}
function selectDoor(id,doorId){doorReviewSelected=doorId;renderDoorReview(id)}
function moveDoor(id,doorId,val){
let p=getP(id),geom=p.geometry,d=geom&&geom.doors.find(x=>x.id===doorId);if(!d)return;
let max=Math.max(0,wallLengthFor(geom,d.wall)-Number(d.width));
d.offset=Math.max(0,Math.min(max,Math.round(Number(val)*10)/10));
d.source='customer';
let slider=document.querySelector('#doorSlider'),numeric=document.querySelector('#doorNumeric');
if(slider)slider.value=d.offset;if(numeric)numeric.value=d.offset;
let wrap=document.querySelector('.svg-wrap');if(wrap)wrap.innerHTML=buildingDrawingSVG(p);
let status=document.querySelector('#doorStatus');if(status)status.textContent=`${doorLabel(d)}: approximately ${d.offset} m from the left-hand corner of the ${wallName(d.wall)} wall.`;
let meta=document.querySelector('#doorMeta-'+d.id);if(meta)meta.textContent=`${wallName(d.wall)} wall · ${d.offset} m from left-hand corner · ${d.width} m wide${d.type==='roller'?` × ${d.height} m high (${d.access||'access not set'})`:''}`;
let issuesBox=document.querySelector('#geomIssues');if(issuesBox)issuesBox.innerHTML=renderGeomIssues(validateGeometry(geom))
}
function changeDoorWall(id,doorId){
let p=getP(id),geom=p.geometry,d=geom&&geom.doors.find(x=>x.id===doorId);if(!d)return;
d.wall=document.querySelector('#doorWall').value;d.offset=0;d.source='customer';
renderDoorReview(id)
}
function addDoor(id,type){
let p=getP(id);ensureGeometry(p);let geom=p.geometry,n=geom.doors.filter(x=>x.type===type).length+1;
let d=type==='roller'
?{id:'rd'+Date.now(),ref:'RD'+n,type:'roller',wall:'front',offset:0,width:4.6,height:4.0,access:'Van',source:'customer'}
:{id:'pd'+Date.now(),ref:'PD'+n,type:'personnel',wall:'left',offset:0,width:1.0,height:2.1,source:'customer'};
geom.doors.push(d);doorReviewSelected=d.id;
p.history.push({at:now(),text:`${type==='roller'?'Roller':'Personnel'} door added in drawing review`});
renderDoorReview(id)
}
function removeDoor(id,doorId){
let p=getP(id),geom=p.geometry,d=geom.doors.find(x=>x.id===doorId);
geom.doors=geom.doors.filter(x=>x.id!==doorId);
if(doorReviewSelected===doorId)doorReviewSelected=geom.doors.length?geom.doors[0].id:null;
if(d)p.history.push({at:now(),text:`${d.type==='roller'?'Roller':'Personnel'} door removed in drawing review`});
renderDoorReview(id)
}
function confirmDoors(id){
let p=getP(id),geom=p.geometry,issues=validateGeometry(geom);
syncFactsFromGeometry(p);
p.history.push({at:now(),text:`Door positions confirmed and drawing regenerated${issues.length?` (${issues.length} basic geometry note(s) still flagged)`:''}`});
save();
renderDoorReview(id,true)
}

async function downloadReport(id,stage){
let p=getP(id),k=stage==='s1'?'s1':'s2';
if(!p)return;
{
  if(stage!=='s1'||!p.stage1Complete||!p.stage1SummaryConfirmed||stage1SteelReportGaps(p).length)return;
  runStage1Risks(p);
}

if(!window.jspdf||!window.jspdf.jsPDF)return alert('PDF generator did not load. Check the internet connection and try again.');
const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});let y=18;const left=18,width=174;
const pageBorder=()=>{doc.setDrawColor(168,216,170);doc.setLineWidth(1);doc.rect(10,10,190,277)};
const newPage=()=>{doc.addPage();pageBorder();y=18};
const add=(text,size=10,bold=false,gap=5.4)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);let lines=doc.splitTextToSize(String(text??''),width);if(y+lines.length*gap>280){newPage()}doc.text(lines,left,y);y+=lines.length*gap};
const heading=t=>{y+=2;add(t,12,true,7)};
const subhead=t=>add(t,10,true,5.6);
pageBorder();
// Approved Project Check logo (assets/project-check-logo.png, unaltered, 1:1) in the
// PDF header. Falls back to plain text only — never a redrawn substitute — if the
// asset has not finished loading when the customer clicks download.
if(PC_LOGO_DATA_URL){doc.addImage(PC_LOGO_DATA_URL,'PNG',left,y,22,22);y+=26}
else{add('PROJECT CHECK',20,true,8);add('Know before you build',11,true,7)}
doc.setDrawColor(210);doc.line(left,y,192,y);y+=8;
if(stage==='s1'){
add(p.name||'Your project',18,true,8);
add(`Free check · ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`,10,false,6);
if(p.address)add(`Site: ${p.address}`,9,false,6);
}else{
add(`Project: ${p.name}`,12,true,7);
add(`Customer: ${p.facts.name||p.customerName||(accountRecord()||state.user||{}).name||'Not supplied'}${p.facts.role?(' — '+p.facts.role):''}`,10,false,6);
add(`Site: ${p.address||'Not confirmed'}`,10,false,6);
add('Report: Stage 2 Deeper Project Check',10,false,6);
add(`Generated: ${new Date().toLocaleString()}`,9,false,8);
}
// Illustrative industrial-building reference image — general context only, never a
// depiction of the customer's actual proposed building. Omitted (never substituted)
// if the asset hasn't finished loading. Not used in the clean Stage 1 report.
if(stage!=='s1'&&PC_BUILDING_REPORT_DATA_URL){
try{
add('Illustrative reference image of a modern industrial/warehouse-style building — shown for general context only, not a depiction of your specific proposed building.',8,false,4.6);
let refW=80,refH=refW*1024/1536;
if(y+refH>270){doc.addPage();y=18}
doc.addImage(PC_BUILDING_REPORT_DATA_URL,'PNG',left,y,refW,refH);y+=refH+8
}catch(e){/* optional reference image only — a malformed data URI must not abort the whole report */}
}
const RETIRED_ANSWER_KEYS=['regsFireAccessElevations','regsFireAccessWidth'];
const excludeKeys=['buildingPosition','buildingFootprint','siteBoundary','rollerDoors','buildingPositionStatus','siteBoundaryStatus','addressConfirmedOnly',...RETIRED_ANSWER_KEYS];
if(stage==='s1'){
// Clean Stage 1 report: intro, the seven questions with status and answer, what we still don't know, next steps.
{
const ink=[16,24,40],muted=[71,84,103];
const chipColour={likely:[180,60,10],possibly:[150,100,0],unlikely:[40,110,70],needinfo:muted};
const ensure=h=>{if(y+h>278)newPage()};
const put=(text,o={})=>{
  const size=o.size||9.5,gap=o.gap||5,ind=o.indent||0;
  doc.setFont('helvetica',o.bold?'bold':(o.italic?'italic':'normal'));doc.setFontSize(size);doc.setTextColor(...(o.color||ink));
  doc.splitTextToSize(String(text??''),width-ind).forEach(line=>{ensure(gap);doc.text(line,left+ind,y);y+=gap})
};
const bullet=(text,o={})=>{
  const size=o.size||9.5,gap=o.gap||5,ind=o.indent||0;
  doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(...ink);
  doc.splitTextToSize(String(text??''),width-ind-5).forEach((line,i)=>{ensure(gap);if(i===0)doc.text('•',left+ind+1,y);doc.text(line,left+ind+5,y);y+=gap})
};
const section=title=>{ensure(24);y+=5;put(title,{size:13,bold:true,gap:7});doc.setDrawColor(210);doc.setLineWidth(0.3);doc.line(left,y-3,left+width,y-3);y+=2};
y+=2;
put(STAGE1_INTRO,{size:10.5,gap:5.8,color:muted});
y+=3;
const questions=stage1ClientQuestions(p);
// Topic grid: one small coloured tile per topic with its number, label and status. Plain drawn shapes, no images.
{
  const cols=4,gutter=3,cw=(width-gutter*(cols-1))/cols,ch=17,rows=Math.ceil(questions.length/cols);
  ensure(rows*(ch+gutter)+4);
  questions.forEach((q,i)=>{
    const x=left+(i%cols)*(cw+gutter),top=y+Math.floor(i/cols)*(ch+gutter),rgb=S1_TOPICS[i].rgb;
    doc.setFillColor(246,248,247);doc.setDrawColor(217,224,219);doc.setLineWidth(0.2);doc.roundedRect(x,top,cw,ch,1.5,1.5,'FD');
    doc.setFillColor(...rgb);doc.rect(x,top+0.4,1.8,ch-0.8,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...rgb);
    doc.splitTextToSize(`${q.n}. ${S1_TOPICS[i].label}`,cw-6).slice(0,2).forEach((line,li)=>doc.text(line,x+4,top+5+li*3.8));
    doc.setFontSize(8);doc.setTextColor(...chipColour[q.status]);doc.text(q.chip,x+4,top+ch-2.4)
  });
  y+=rows*(ch+gutter)+2
}
section("What you've told us");
stage1BasisList(p).forEach(item=>bullet(`${item.label} ${item.known?item.value:'Need info'}`,{size:9.5,gap:5}));
y+=2;
// The planning step view as a numbered list. Each step is kept whole on one page; hold-up steps get an amber marker and label.
const stepViewPdf=rgb=>{
  ensure(30);y+=1;put('How planning works',{bold:true,size:10.5,gap:5.6});
  doc.setFillColor(194,120,3);doc.circle(left+2.2,y-1.3,1.9,'F');doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(255,255,255);doc.text('!',left+2.2,y-0.4,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(92,58,0);doc.text(HOLD_LABEL,left+6,y);y+=6;
  PLANNING_STEPS.forEach((step,i)=>{
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);const titleLines=doc.splitTextToSize(step.title,width-10);
    doc.setFont('helvetica','normal');doc.setFontSize(9);const textLines=step.text?doc.splitTextToSize(step.text,width-10):[];
    doc.setFontSize(8.5);const holdLines=step.hold?doc.splitTextToSize(`${HOLD_LABEL}: ${step.hold}`,width-16):[];
    ensure(titleLines.length*4.8+textLines.length*4.6+(holdLines.length?holdLines.length*4.4+4:0)+3);
    doc.setFillColor(...rgb);doc.circle(left+3.5,y-1.3,3,'F');doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(255,255,255);doc.text(String(i+1),left+3.5,y-0.2,{align:'center'});
    doc.setFontSize(9.5);doc.setTextColor(...ink);titleLines.forEach(line=>{doc.text(line,left+10,y);y+=4.8});
    doc.setFont('helvetica','normal');doc.setFontSize(9);textLines.forEach(line=>{doc.text(line,left+10,y);y+=4.6});
    if(holdLines.length){
      const hh=holdLines.length*4.4+2;
      doc.setFillColor(255,244,214);doc.setDrawColor(240,213,138);doc.setLineWidth(0.2);doc.roundedRect(left+10,y-2.6,width-10,hh,1,1,'FD');
      doc.setFillColor(194,120,3);doc.rect(left+10,y-2.6,1.6,hh,'F');
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(92,58,0);holdLines.forEach(line=>{doc.text(line,left+14,y);y+=4.4});y+=1.4
    }
    y+=2.2
  });
  doc.setTextColor(...ink);
  put(`How long? ${PLANNING_TIMELINE}`,{size:9,gap:4.8});
  put(PLANNING_NATIONS_NOTE,{size:8.5,italic:true,color:muted,gap:4.6})
};
questions.forEach(q=>{
  const rgb=S1_TOPICS[q.n-1].rgb;
  // Keep the coloured heading band together with the first bullets that follow it.
  doc.setFont('helvetica','bold');doc.setFontSize(11.5);
  const titleLines=doc.splitTextToSize(`${q.n}.  ${q.title}`,width-34),bandH=titleLines.length*5.6+3.6;
  ensure(bandH+26);y+=4;
  doc.setFillColor(...rgb);doc.roundedRect(left,y,width,bandH,1.8,1.8,'F');
  doc.setTextColor(255,255,255);titleLines.forEach((line,li)=>doc.text(line,left+3,y+5.6+li*5.6));
  doc.setFillColor(255,255,255);doc.roundedRect(left+width-27,y+(bandH-6)/2,24,6,3,3,'F');
  doc.setFontSize(8.5);doc.setTextColor(...chipColour[q.status]);doc.text(q.chip,left+width-15,y+(bandH-6)/2+4.2,{align:'center'});
  y+=bandH+5;
  q.bullets.forEach(text=>bullet(text,{indent:1,size:10,gap:5.2}));
  if(q.steps)stepViewPdf(rgb);
  y+=1.5;put('More detail',{bold:true,size:9.5,gap:5,color:rgb});
  put(q.answer,{size:9,gap:4.8});
  if(q.points.length){y+=1;q.points.forEach(text=>bullet(text,{indent:2,size:9,gap:4.8}))}
  if(q.blockNote){y+=1;put(q.blockNote,{size:8.5,italic:true,color:muted,gap:4.6})}
  q.blocks.forEach(block=>{y+=1.5;ensure(14);put(block.heading,{bold:true,size:9.5,gap:5});block.items.forEach(text=>bullet(text,{indent:2,size:9,gap:4.8}))});
  if(q.after){y+=1.5;put(q.after,{bold:true,size:9,gap:5})}
  y+=1.5;put(`Why it matters: ${q.why}`,{size:8.5,italic:true,color:muted,gap:4.6});
  y+=2
});
section("What we still don't know");
{
  const k=stage1KnowledgeLists(p);
  const block=(title,items,empty)=>{ensure(14);y+=2;put(title,{bold:true,size:10.5,gap:5.6});if(items.length)items.forEach(text=>bullet(text,{indent:2,size:9,gap:4.8}));else put(empty,{size:9,color:muted,gap:4.8})};
  block("What's missing",k.missing,'Nothing listed yet. That is not an all-clear.');
  block("What's unclear",k.unclear,'Nothing listed yet. That is not an all-clear.');
  block('What we have',k.have,'No answers saved yet.');
  if(k.files.length){y+=1;put('Your files – received, not reviewed in the free check',{bold:true,size:9.5,gap:5});put('A check of your figures against the drawings is part of Stage 2. We never guess a number.',{size:8.5,color:muted,gap:4.6});k.files.forEach(file=>{const read=uploadReadState(file.entry||{name:file.name});bullet(`${file.name} (${file.guess.label}) – ${read.canRead?((read.partial?'We could only read some of the text. ':'')+'Received, not reviewed in the free check.'):read.reason}`,{indent:2,size:9,gap:4.8})});put(k.fileNote,{size:9,gap:4.8,color:muted})}
  y+=2;put(`${UPLOAD_NOT_REVIEWED_TEXT} This is not an all-clear: it only shows what we know and don't know so far.`,{size:8.5,italic:true,color:muted,gap:4.6})
}
// Summary box: counts, then the next step. The call is first, saving the project second, Stage 2 only as a gentle offer.
{
  const c=stage1SummaryCounts(questions),inner=width-10;
  const callText=`${BOOK_CALL_LABEL}: ${/^https:\/\//i.test(BOOK_CALL_URL)?BOOK_CALL_URL:'booking link coming soon. Open Project Check for the latest.'}`;
  doc.setFont('helvetica','bold');doc.setFontSize(10);const callLines=doc.splitTextToSize(callText,inner);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  const saveLines=doc.splitTextToSize('Save your project: it is saved in Project Check, so you can open this report again at any time.',inner);
  const stage2Lines=doc.splitTextToSize("When you're ready, there's also Stage 2, where Stuart goes through the answers and a plan with you. It isn't open for payment yet.",inner);
  const boxH=7+9+17+callLines.length*5.2+saveLines.length*4.8+stage2Lines.length*4.8+6;
  ensure(boxH+8);y+=6;
  doc.setFillColor(16,24,40);doc.roundedRect(left,y,width,boxH,2.5,2.5,'F');
  doc.setFillColor(32,122,61);doc.rect(left,y+2,2.2,boxH-4,'F');
  let by=y+8;
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('An easy next step',left+5,by);by+=9;
  [[String(c.deal),c.deal===1?'thing to deal with':'things to deal with'],[String(c.likely),'Likely'],[String(c.needinfo),'Need info']].forEach(([num,text],i)=>{
    const x=left+5+i*(inner/3);
    doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(255,255,255);doc.text(num,x,by+4);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(208,213,221);doc.text(text,x,by+9.5)
  });
  by+=17;
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(255,255,255);callLines.forEach(line=>{doc.text(line,left+5,by);by+=5.2});
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(208,213,221);
  saveLines.forEach(line=>{doc.text(line,left+5,by);by+=4.8});stage2Lines.forEach(line=>{doc.text(line,left+5,by);by+=4.8});
  y+=boxH+2
}
doc.setTextColor(0,0,0);
}
}else{
heading('PROJECT FACTS');
Object.entries(p.facts).forEach(([key,val])=>{if(excludeKeys.includes(key)||val===''||val==null||(key==='heated'&&p.facts.temperatureCondition))return;let shown=Array.isArray(val)?val.join(', '):val;add(`${label(key)}: ${shown}`,9,false,5)});
if(p.facts.rollerDoors?.length){subhead('Roller doors:');p.facts.rollerDoors.forEach((d,i)=>add(`Door ${i+1}: ${d.width} m wide × ${d.height} m high — ${d.access}`,9,false,5))}
if(p.facts.buildingFootprint)add(`Building footprint: ${p.facts.buildingFootprint.width} m × ${p.facts.buildingFootprint.length} m, rotation ${p.facts.buildingFootprint.angle}°`,9,false,6);
heading('STAGE 2 EVIDENCE / STATUS');Object.entries(p.stage2).filter(([key])=>!RETIRED_ANSWER_KEYS.includes(key)).forEach(([key,val])=>add(`${label(key)}: ${val}`,9,false,5));
heading('DEEPER RISKS');p.risks2.forEach(r=>add(`• ${r}`,9,false,6));
heading('RECOMMENDED ACTIONS');p.actions2.forEach(a=>add(`• ${a}`,9,false,6));
heading('SUPPLIER POSITION');add(`${p.quotes.length} supplier quotation(s) currently recorded.`,9,false,5);add(p.supplierRequest?'A request for three suitable supplier quotations has been recorded.':'No three-supplier quotation request is currently recorded.',9,false,6)
}
heading('IMPORTANT');add('This is an early check based on what you told us. It is not a design, an approval or a survey, and it does not replace advice from the professionals on your project.',8,false,5);
if(stage==='s1'){const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(71,84,103);doc.text(`Project Check · Free check · page ${i} of ${pages}`,left,284)}doc.setTextColor(0,0,0)}
p.history.push({at:now(),text:`${stage==='s1'?'Stage 1':'Stage 2'} PDF report downloaded`});save();
doc.save(`Project-Check-${p.name.replace(/\W+/g,'-')}-${stage==='s1'?'Stage-1':'Stage-2'}.pdf`)
}
// wetProcess: no longer an active question (removed 2026-08-24, see
// stage2Questions above) but kept mapped here so a Stage 2 report for a
// project that saved an answer under the old key still renders a readable
// label instead of the raw key — legacy-display only, not a live question.
// hgvRoute: same pattern, no longer an active question (removed 2026-08-26,
// see stage1Questions above) — kept mapped here purely so a legacy project's
// PDF facts dump still renders "Site access width" instead of the raw key.
function label(k){return ({name:'Your name',role:'Role',structure:'Structure type',address:'Site',use:'Intended use',buildingUse:'Building use',buildingType:'Building type',heated:'Heated',temperatureCondition:'Temperature conditions',requiredTemperatureC:'Required internal temperature (°C)',ambientProtectionNeeded:'Frost/condensation/temperature-change protection (legacy)',intendsToReuseExistingBase:'Intention to reuse existing surface',adjacentExistingBuilding:'Link to or near an existing building',siteEvidenceAvailability:'Drawings, surveys or site information',width:'Width',length:'Length',height:'Clear height',clearSpan:'Clear span',base:'Existing surface',level:'Level',services:'Services/drains',closeBoundary:'Boundaries/nearby buildings',hgvRoute:'Site access width',rollerCount:'Roller doors',personnelDoors:'Personnel doors',programme:'Programme',beneathSurface:'Below visible surface',slabThickness:'Slab thickness known',slabThicknessDetail:'Slab thickness detail',reinforcement:'Slab reinforcement known',groundTesting:'Ground/slab investigation',surfaceCondition:'Footprint condition',topo:'Topographical survey',drainInfo:'Drainage information',serviceInfo:'Underground services',planning:'Planning position',planningConstraints:'Planning constraints',planningDetail:'Planning details',buildingControl:'Building Regulations / Building Control',fireStrategy:'Fire strategy',sprinklers:'Sprinklers',occupancy:'Expected occupancy',racking:'Racking',mezzanine:'Mezzanine',crane:'Crane/suspended loads',hazardous:'Hazardous/unusual processes',wetProcess:'Wet process',ev:'EV charging',supplierQuotes:'Existing quotations'})[k]||k}

// esc() (HTML-entity encoding) protects the HTML-parsing context that every
// route-render function inserts `id` into via onclick="...('${esc(id)}')" —
// but browsers decode HTML entities in an attribute BEFORE compiling that
// attribute's content as the JS event-handler body, so an apostrophe in a
// malicious id could still break out of the intended JS string literal
// there, independent of the HTML-level escaping. Real project ids are
// always crypto.randomUUID() — a fixed 36-character 8-4-4-4-12 hex shape —
// so reject anything else at this single dispatch point, before any route
// handler (or the getP()-based guards most of them already have) ever sees
// it. Matching the exact UUID shape (not just "hex digits and hyphens",
// which admits arbitrary-length strings) also closes a trivial client-side
// DoS: an attacker-length hex/hyphen fragment could otherwise still reach
// dozens of onclick attributes on the rendered page.
//
// The route name `r` is equally attacker-controlled (the segment of
// location.hash before '/'). It was previously used as a computed lookup
// key into a dispatch-table object. That had a real problem: a plain
// object literal inherits from Object.prototype, so a crafted hash like
// #__proto__ resolves to an inherited property instead of undefined —
// Object.prototype itself, which isn't callable, so calling it threw an
// uncaught TypeError and crashed render() (and therefore navigation) on
// every subsequent hash change, a real "crash the whole journey" bug. That
// was closed with `__proto__:null` on the table — but CodeQL's
// js/unvalidated-dynamic-method-call query correctly flags the *pattern*
// itself (any `obj[userControlledName](...)`) independent of how the
// object is built, since nothing about the shape of an object literal
// proves every value on it is safe to invoke, today or after a future
// edit. A `switch` on `r` removes that pattern entirely: every call target
// below is a literal identifier at a fixed call site, `r` is only ever
// compared with `===`, and it is never used to look up or invoke anything
// — unrecognised routes fall through to `default` exactly like the old
// `||home` fallback did.
// Stage 2 sales page, shown for the stage2 / stage2Summary / quotes / quotationSummary routes. No prices.
// PLACEHOLDER: there is no payment code yet. "Get Stage 2" only explains that payments are not switched on and offers the call.
// Works signed out (no project id). It never reads project data other than the project name for the back link.
// Content sources (code comment only): regs-planning draft List A (planning file) and List B (Building Regulations guidance),
// upload-bot draft section 2 (plain review per document type). Plain words only: no numbers, prices, test counts or paragraph references.
const STAGE2_FEATURES=[
  {title:'A Teams meeting with Stuart',text:'Go through your project together, in plain words, and ask anything you like.'},
  {title:'Upload as the job goes on',text:'Add site photos and documents whenever you have them. Each time you get a plain review: what is there, what is missing, what is unclear and what to ask next.'},
  {title:'A planning history file',text:'Nearby industrial planning applications and the conditions the councils attached to them.'},
  {title:'Building Regulations guidance',text:'Guidance for your building on fire near boundaries, access and energy.'},
  {title:'Solutions to each problem',text:'For every problem found in your free check, what you can do about it.'},
  {title:'Stuart makes it real for your site',text:'Stuart shows which planning conditions and refusal reasons are likely where you are, using nearby applications.'}
];
const STAGE2_PLANNING_FILE=[
  'Nearby industrial applications: the same estate and the roads around it first, then a little further out',
  'What was decided for each one, and whether the decision came from officers or a committee',
  'The conditions and notes attached, including any that must be met before work starts and any time limits',
  'The reports the council asked for, such as flood risk, traffic, noise, wildlife, ground or mining',
  'Refused and withdrawn applications, and the reasons given: often the best early warning',
  'Whether a certificate of lawfulness was used instead of a full application',
  'What neighbours and the council\'s advisers (highways, environmental health, drainage, wildlife) said',
  'Any later changes to an approval, and what changed',
  'Where we looked and the date we looked, because planning websites change'
];
const STAGE2_REGS_GUIDANCE=[
  'Fire and boundaries: how close walls can be, and what the walls and openings need to be made of',
  'Rooflights and portal frames near a boundary',
  'Exits and how far people travel to reach one',
  'Fire engine access and water supply',
  'Energy rules for your building, including the changes coming in 2027',
  'Access for disabled people, from the road to the door',
  'Whether a very small or temporary building is treated differently',
  'Where the rules in Wales or Scotland differ, checked against the right local guidance',
  'Which planning route might apply to an extension, and what has to be known before anyone can say'
];
// Made-up examples only. Each is clearly marked in the page. [Square brackets] show where real details would go.
const STAGE2_EXAMPLE_REVIEWS=[
  {type:'Steel drawings',present:'A general arrangement drawing, revision [rev], dated [date], with the grid, eaves and ridge levels.',missing:'A current, dimensioned drawing with door sizes. Please send it as a PDF.',unclear:'The title block gives one size and the grid gives another. Which one is final?',next:'Can you confirm each door as width × height?'},
  {type:'Base and groundworks drawings',present:'A foundation drawing, revision [rev], dated [date].',missing:'A drawing for the final building size and height, and any ground investigation report.',unclear:'The foundation drawing is older than the latest steel drawing. Which one were the foundations designed on?',next:'Who is appointing the groundworker, and is there a setting-out drawing tied to the steel grid?'},
  {type:'Planning drawings and decision notices',present:'Planning drawings, revision [rev], dated [date].',missing:'The decision notice and its conditions.',unclear:'The planning drawings show a different eaves height from the steel drawings. Which is final?',next:'Was the building supplier involved in the planning drawings?'},
  {type:'Building Control',present:'An application dated [date] and the council or approver it went to.',missing:'Who the principal designer and principal contractor will be.',unclear:'Whether the fire strategy was written from the planning drawings or the steel drawings.',next:'Which set of drawings does Building Control hold?'},
  {type:"Engineer's calculations and letters",present:"Calculations dated [date] for the final height and size.",missing:"A written, dated confirmation from the engineer.",unclear:'A phone call or text saying the foundations are fine. That is not written confirmation.',next:"Can the engineer send a dated letter for the final design?"},
  {type:'Site surveys',present:'A measured survey dated [date] with the proposed building drawn on it.',missing:'A measured survey of the site.',unclear:'A hand sketch where opposite sides do not match.',next:'Can a surveyor measure and square the site?'},
  {type:'Quotes and contracts',present:'A quote, revision [rev], dated [date], for a building of [size].',missing:'The order, or a record of later changes.',unclear:'The same length appears with three different values across the papers. Which is final?',next:'Is there a record of each design change?'},
  {type:'Site photos',present:'Photos dated [date] showing [the area / the groundworks / the steel].',missing:'A date we can read on each photo, so they can be put in order.',unclear:'Photos that may belong to a different site.',next:'Which photos belong to this site, and when were they taken?'}
];
function stage2GetClicked(button){
  const box=document.querySelector('#stage2Notice');
  if(!box)return;
  box.hidden=false;
  box.innerHTML=`<p><strong>Payments aren't switched on yet.</strong> Book a call with Stuart to start Stage 2.</p><div class="simple-cta-row">${callButton('btn green simple-cta')}</div>`;
  if(button&&button.setAttribute)button.setAttribute('aria-expanded','true')
}
window.stage2GetClicked=stage2GetClicked;
function paidStagePage(id){
  const p=state.user&&id?getP(id):null;
  const backAction=p?`route('project','${esc(p.id)}')`:(state.user?"route('dashboard')":"route('home')");
  const backLabel=p?'Back to my project':(state.user?'Back to my projects':'Back to home');
  document.body.dataset.page='paidStage';
  const features=STAGE2_FEATURES.map((item,index)=>`<article class="simple-step"><span class="simple-step-num" aria-hidden="true">${index+1}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join('');
  const plainList=items=>`<ul class="simple-list simple-list-tight">${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`;
  app.innerHTML=`<div class="container simple-paid simple-stage2">
<section class="simple-hero simple-stage2-hero" aria-labelledby="stage2Title"><div class="eyebrow">Stage 2</div><h1 id="stage2Title">Stage 2: the answers and a plan</h1><p class="simple-lead">Your free check showed what you'll probably have to deal with. Stage 2 goes through what to do about it, with Stuart alongside you. There's no rush: have a read, and book a chat when you're ready.</p></section>
<section class="simple-section" aria-labelledby="stage2GetTitle"><h2 id="stage2GetTitle">What you get</h2><div class="simple-steps">${features}</div></section>
<section class="simple-section" aria-labelledby="stage2PlanTitle"><h2 id="stage2PlanTitle">Your planning history file</h2><p class="simple-lead">So you and your planning consultant can see what the council has approved nearby, and what it asked for.</p>${plainList(STAGE2_PLANNING_FILE)}</section>
<section class="simple-section" aria-labelledby="stage2RegsTitle"><h2 id="stage2RegsTitle">Building Regulations guidance</h2><p class="simple-lead">Guidance for your building, in plain words.</p>${plainList(STAGE2_REGS_GUIDANCE)}</section>
${p?`<section class="simple-section" aria-labelledby="stage2ReviewTitle"><h2 id="stage2ReviewTitle">Review of your uploads</h2><p class="simple-lead">Shown in this order: your figures checked against the drawings, the need-info list, then a card for each file. We only show figures written as text in a file we could read. We never guess a number, and this is not a Building Regulations or planning approval.</p>${uploadReviewMarkup(p,'stage2')}</section>`:''}
<section class="simple-section" aria-labelledby="stage2ExampleTitle"><h2 id="stage2ExampleTitle">What a plain review of your uploads looks like</h2>
<p class="simple-example-tag">EXAMPLES ONLY. Made-up content, not a real project or a real file.</p>
<p class="meta">Each review starts with your figures (Match, Mismatch or Not shown), then a need-info list, then a card for each drawing: what we found, what's missing, what's unclear, and questions for your meeting with Stuart.</p>
${uploadExampleReviewMarkup()}
<p class="meta">Please send photos as JPEG or PNG and drawings as PDF. iPhone HEIC photos can't be read yet: change your camera to "Most Compatible" first.</p></section>
<section class="card simple-actions simple-stage2-cta" aria-labelledby="stage2CtaTitle"><h2 id="stage2CtaTitle">Ready to start?</h2>
<div class="simple-cta-row"><button type="button" class="btn green simple-cta" aria-expanded="false" aria-controls="stage2Notice" onclick="stage2GetClicked(this)">Get Stage 2 <span class="simple-badge">Placeholder: payments not on yet</span></button>${callButton('btn simple-cta simple-cta-alt')}<button type="button" class="btn secondary simple-cta" onclick="${backAction}">${backLabel}</button></div>
<div id="stage2Notice" class="simple-notice" role="status" hidden></div></section>
</div><footer class="home-footer"><img src="assets/project-check-banner-logo.png" alt="Project Check — Know before you build."><nav aria-label="Account footer"><button data-route="home">Home</button><button data-route="signin">Sign in</button></nav><span></span><div class="home-footer-legal"><div></div><small>© 2026 Project Check</small></div></footer>`;
}
function render(){syncAuth();let [r,id]=(location.hash.slice(1)||'home').split('/');if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))id=undefined;
// Pricing Back/Home Navigation Fix (2026-08-30) continued: exposes the
// current route on <body> so the mobile Home-nav-button exemption below
// (styles.css) can be scoped to ONLY the public pages that share this
// header without a signed-in state (pricing/terms/privacy) — NOT to
// dashboard/project/stage/etc. Those protected workflows must not be
// altered by this rule, and a first regression-suite run proved why:
// once signed in, #projectsBtn also becomes visible on mobile (inline
// style in syncAuth()), and Home + My Projects + Sign out together
// overflowed the 390-428px viewport. Scoping by data-page keeps Home
// visible only where it was actually requested.
document.body.dataset.page=r;
if(SITE_SHELL_ROUTES.has(r))document.body.dataset.reviewShell='true';else delete document.body.dataset.reviewShell;
if(r==='doors'){
  const p=id&&getP(id);
  if(p)return route('stage1Workspace',id);
}
switch(r){
case 'signin':authModal('signin',true);break;
case 'create':authModal('create',true);break;
case 'dashboard':dashboard(id);break;
case 'createProject':projectBriefModal(undefined,false,true);break;
case 'profile':profile(id);break;
case 'profileEdit':profileEdit(id);break;
case 'project':project(id);break;
case 'projectSettings':projectSettings(id);break;
case 'projectDocuments':projectDocuments(id);break;
case 'stage1Workspace':stage1Workspace(id);break;
case 'stage1Confirm':stage1Confirm(id);break;
case 'siteLayout':siteLayout(id);break;
case 'buildingLayout':buildingLayout(id);break;
case 'stage1':stage1(id);break;
case 'stage1Summary':stage1Summary(id);break;
case 'stage2':
case 'stage2Summary':
case 'quotes':
case 'quotationSummary':paidStagePage(id);break;
case 'doors':doorReview(id);break;
case 'evidenceLedger':evidenceLedgerPage(id);break;
case 'terms':termsPage();break;
case 'privacy':privacyPage();break;
default:home(id)
}
const sharedFooter=document.querySelector('.sitefooter');
if(sharedFooter)sharedFooter.hidden=!!app.querySelector('.home-footer');
document.querySelectorAll(':is(.home-footer nav,.sitefooter-primary) button:is([data-route="signin"],[data-route="dashboard"])').forEach(button=>{button.dataset.route=state.user?'dashboard':'signin';button.textContent=state.user?'My Projects':'Sign in'});
// Pricing/Navigation Model Fix (2026-08-30): render() previously left the
// scroll position exactly where it was on the PREVIOUS page/route. A
// customer scrolled down on Pricing (or Terms/Privacy, which share this
// same persistent header) who then navigated Home landed on the correct
// new page content, but the viewport stayed scrolled to the same pixel
// offset — often showing a lower section of the new page, or nothing
// recognisable at all, which looked exactly like "clicking Home did
// nothing" even though the route/DOM had genuinely changed (confirmed by
// reproducing: scrollY stayed at 2000 across a Pricing -> Home
// navigation). render() is the single place every route lands (in-app
// nav clicks via route(), browser back/forward and manual hash edits via
// the hashchange listener, and first load) — scrolling to top here once
// fixes it everywhere without touching the Stage 1 in-page
// question-to-question flow, which calls stage1(id) directly and never
// goes through render() for its own internal steps.
window.scrollTo(0,0)}
window.route=route;window.startStage2=startStage2;window.stage1SummaryDoorSelect=stage1SummaryDoorSelect;window.quotationSummary=quotationSummary;window.authModal=authModal;window.newProject=newProject;window.uploadDrawings=uploadDrawings;window.moveStage1=moveStage1;window.saveStage1=saveStage1;window.confirmStage1Evidence=confirmStage1Evidence;window.correctStage1Evidence=correctStage1Evidence;window.moveStage2=moveStage2;window.saveStage2=saveStage2;window.addQuote=addQuote;window.requestThreeSuppliers=requestThreeSuppliers;window.downloadReport=downloadReport;
window.doorReview=doorReview;window.selectDoor=selectDoor;window.moveDoor=moveDoor;window.changeDoorWall=changeDoorWall;window.addDoor=addDoor;window.removeDoor=removeDoor;window.confirmDoors=confirmDoors;
async function initializeStage1Review(){
  try {
    const response=await fetch('/api/stage1-review',{cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error('Review is unavailable on this deployment.');
    const {user,project}=await response.json();
    if(!user?.id||!project?.id||project.owner!==user.id)throw new Error('Review fixture is unavailable.');
    let saved;
    try {saved=JSON.parse(sessionStorage.getItem(STAGE1_REVIEW_KEY));} catch {}
    const savedProjects=saved?.user?.id===user.id&&Array.isArray(saved.projects)
      ?saved.projects.filter(entry=>entry.owner===user.id):[];
    state={...defaultState,user,users:[user],projects:savedProjects.length?savedProjects:[project]};
    if(!location.hash)history.replaceState(null,'','#stage1Workspace/'+state.projects[0].id);
    render();
    if(location.hash==='#stage1Workspace/'+project.id)openSiteDrawer();
  } catch(error) {
    app.textContent=error.message;
  }
}
window.addEventListener('hashchange',()=>{if(!stage1ReviewRequested||state.user)render()});
// The Stage 1 answer checks read regs-checker/rules.json; if the report was drawn before it loaded, draw it again.
if(typeof loadRegsRules==='function')loadRegsRules().then(rules=>{if(rules&&/^stage1Summary\//.test(location.hash.slice(1)))render()});
if(stage1ReviewRequested)initializeStage1Review();
else {
  render();
  if(new URLSearchParams(location.search).get('recovery')==='1')setTimeout(()=>authModal('reset'),0);
}
