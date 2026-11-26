/* 
 * Project Check secure test-platform adapter.
 * Supabase Auth provides real accounts; Postgres RLS isolates customer data;
 * project_events is an append-only chronological record.
 */
(function(){
// The signed-out review runs entirely in its own browser session.
if(new URLSearchParams(location.search).get('menu-preview')==='1')return;
const cfg=window.PROJECT_CHECK_PLATFORM_CONFIG||{};
const enabled=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase);
const client=enabled?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const PENDING_PROFILE_KEY="projectcheck_pending_profile_v1";
const hasText=value=>typeof value==="string"&&value.trim().length>0;
function rememberPendingProfile(profile){
 try{localStorage.setItem(PENDING_PROFILE_KEY,JSON.stringify({...profile,savedAt:Date.now()}))}catch(e){console.error("Project Check: could not retain pending registration profile",e)}
}
function pendingProfileFor(user){
 try{
  const raw=localStorage.getItem(PENDING_PROFILE_KEY),pending=raw?JSON.parse(raw):null;
  if(!pending||typeof pending!=="object")return {};
  if(Date.now()-Number(pending.savedAt||0)>7*24*60*60*1000){localStorage.removeItem(PENDING_PROFILE_KEY);return {}}
  if(String(pending.email||"").toLowerCase()!==String(user.email||"").toLowerCase()||pending.userId!==user.id){localStorage.removeItem(PENDING_PROFILE_KEY);return {}}
  return {name:pending.name,company:pending.company,companyAddress:pending.companyAddress,email:pending.email,mobile:pending.mobile};
 }catch(e){return {}}
}
function clearPendingProfile(){try{localStorage.removeItem(PENDING_PROFILE_KEY)}catch(e){}}

const isCeoUser=user=>user?.app_metadata?.project_check_role==="ceo";
let lastSnapshot="";
function assert(error){if(error)throw error}
function profileFromUser(user,overrides={}){
 const m=user.user_metadata||{},first=(...values)=>{const found=values.find(hasText);return found?found.trim():""};
 return {id:user.id,full_name:first(overrides.name,m.full_name),company_name:first(overrides.company,m.company_name),company_address:first(overrides.companyAddress,m.company_address),business_email:first(overrides.email,user.email),mobile_number:first(overrides.mobile,m.mobile_number),updated_at:new Date().toISOString()};
}
// project_events must stay small: the full project already lives in
// projects.project_data, so an update event records only WHICH fields changed
// (names, capped), never their values, document text or map images.
const EVENT_NAME_CAP=40,EVENT_LIST_CAP=25;
const sameValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function changedNames(old,next){
 const names=[],keys=new Set([...Object.keys(old||{}),...Object.keys(next||{})]);
 for(const k of keys)if(!sameValue(old?.[k],next?.[k]))names.push(String(k).slice(0,EVENT_NAME_CAP));
 return names;
}
function changeSummary(old,next){
 const top=changedNames(old,next),facts=changedNames(old?.facts,next?.facts);
 return {changed:top.slice(0,EVENT_LIST_CAP),facts_changed:facts.slice(0,EVENT_LIST_CAP),more:Math.max(0,top.length-EVENT_LIST_CAP)+Math.max(0,facts.length-EVENT_LIST_CAP),stage:next?.stage||null};
}
function chronologicalChanges(previous,next){
 const events=[],at=new Date().toISOString(),before=previous||{projects:[]};
 const oldProjects=new Map((before.projects||[]).map(p=>[p.id,p]));
 for(const p of next.projects||[]){
  const old=oldProjects.get(p.id);
  if(!old)events.push({project_id:p.id,event_type:"project.created",occurred_at:p.created||at,payload:{name:p.name,address:p.address||"",stage:p.stage}});
  else if(JSON.stringify(old)!==JSON.stringify(p))events.push({project_id:p.id,event_type:"project.updated",occurred_at:at,payload:changeSummary(old,p)});
 }
 return events;
}
async function signIn(email,password){
 if(!enabled)throw new Error("Platform is not configured");
 email=String(email||"").trim().toLowerCase();
 const {data,error}=await client.auth.signInWithPassword({email,password});assert(error);
 
 return data.user
}
async function requestPasswordReset(email){
 if(!enabled)throw new Error("Platform is not configured");
 const redirectTo=new URL(window.location.href);redirectTo.search="";redirectTo.hash="";redirectTo.searchParams.set("recovery","1");
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:redirectTo.toString()});assert(error);
}
async function updatePassword(password){
 if(!enabled)throw new Error("Platform is not configured");
 const {data:{session},error:se}=await client.auth.getSession();assert(se);if(!session)throw new Error("This password recovery link is invalid or has expired.");
 const {data,error}=await client.auth.updateUser({password});assert(error);return data.user;
}
async function signUp({email,password,name,company,companyAddress,mobile,marketingConsent}){
if(!enabled)throw new Error("Platform is not configured");
email=String(email||"").trim().toLowerCase();
const metadata={full_name:name,company_name:company,company_address:companyAddress,mobile_number:mobile,marketing_consent:Boolean(marketingConsent)};

const {data,error}=await client.auth.signUp({email,password,options:{data:metadata}});assert(error);
const identities=data.user?.identities;
if(!data.user||!Array.isArray(identities)||identities.length===0){clearPendingProfile();throw new Error("This email is already linked to an account. Sign in instead, then update your details in Profile & Settings.")}
rememberPendingProfile({userId:data.user.id,email,name,company,companyAddress,mobile});
if(data.session){const {error:pe}=await client.from("profiles").upsert(profileFromUser(data.user,{email,name,company,companyAddress,mobile}));assert(pe);clearPendingProfile()}
return data;
}
async function signOut(){if(enabled){const {error}=await client.auth.signOut();assert(error)}}
async function hydrateState(){
 if(!enabled)return {enabled:false,user:null,users:[],projects:[]};
 const {data:{session},error:se}=await client.auth.getSession();assert(se);const user=session?.user;if(!user)return {enabled:true,user:null,users:[],projects:[]};
 let {data:profile,error:pe}=await client.from("profiles").select("*").eq("id",user.id).maybeSingle();assert(pe);
 const pending=pendingProfileFor(user),registration=profileFromUser(user,pending);
 if(!profile){profile=registration;const {error:ie}=await client.from("profiles").insert(profile);assert(ie)}
 else{
  // Auth metadata belongs to this exact signed-in user and is the source
  // recorded during registration/profile updates. Prefer it (and the
  // short-lived matching pending registration record) over a stale profile
  // row so details from an earlier test/customer can never win by fallback.
  const repaired={...profile,full_name:hasText(registration.full_name)?registration.full_name:profile.full_name,company_name:hasText(registration.company_name)?registration.company_name:profile.company_name,company_address:hasText(registration.company_address)?registration.company_address:(profile.company_address||""),business_email:hasText(registration.business_email)?registration.business_email:profile.business_email,mobile_number:hasText(registration.mobile_number)?registration.mobile_number:profile.mobile_number};
  if(repaired.full_name!==profile.full_name||repaired.company_name!==profile.company_name||repaired.company_address!==(profile.company_address||"")||repaired.business_email!==profile.business_email||repaired.mobile_number!==profile.mobile_number){repaired.updated_at=new Date().toISOString();const {error:ue}=await client.from("profiles").upsert(repaired);assert(ue);profile=repaired}
 }
 if(hasText(profile.full_name)&&hasText(profile.company_name)&&hasText(profile.business_email)&&hasText(profile.mobile_number))clearPendingProfile();
 const {data:rows,error:re}=await client.from("projects").select("project_data").eq("owner_id",user.id).order("created_at",{ascending:true});assert(re);
 const projects=(rows||[]).map(r=>({...r.project_data,owner:user.id}));
 const localUser={id:user.id,email:profile.business_email||user.email,name:profile.full_name||"",company:profile.company_name||"",companyAddress:profile.company_address||"",mobile:profile.mobile_number||""};
 lastSnapshot=JSON.stringify({projects,users:[localUser]});
 return {enabled:true,user:{id:user.id,email:localUser.email,isCeo:isCeoUser(user)},users:[localUser],projects};
}
async function captureState(state){
 if(!enabled)return {enabled:false};
 const {data:{user},error:ue}=await client.auth.getUser();assert(ue);if(!user)return {enabled:true,synced:false,reason:"signed-out"};
 const rawCurrent=JSON.parse(JSON.stringify(state)),current={...rawCurrent,user:rawCurrent.user?.id===user.id?rawCurrent.user:{id:user.id,email:user.email},users:(rawCurrent.users||[]).filter(item=>item.id===user.id),projects:(rawCurrent.projects||[]).filter(project=>project.owner===user.id)},previous=lastSnapshot?JSON.parse(lastSnapshot):null;
 const account=(state.users||[]).find(u=>u.id===state.user?.id)||{};
 let {error}=await client.from("profiles").upsert(profileFromUser(user,account));assert(error);
 const metadata=user.user_metadata||{},metadataChanged=(hasText(account.name)&&account.name!==metadata.full_name)||(hasText(account.company)&&account.company!==metadata.company_name)||(hasText(account.companyAddress)&&account.companyAddress!==metadata.company_address)||(hasText(account.mobile)&&account.mobile!==metadata.mobile_number);
 if(metadataChanged){const {error:me}=await client.auth.updateUser({data:{full_name:account.name||"",company_name:account.company||"",company_address:account.companyAddress||"",mobile_number:account.mobile||""}});assert(me);clearPendingProfile()}
 // Only upsert projects that have actually changed since the last snapshot.
 // This prevents a stale in-memory copy of another project from overwriting
 // a newer edit that was saved in a different session.
 const previousProjects=new Map((previous?.projects||[]).map(p=>[p.id,p]));
 for(const p of (current.projects||[])){
  const old=previousProjects.get(p.id);
  if(old && JSON.stringify(old)===JSON.stringify(p)) continue; // unchanged
  ({error}=await client.from("projects").upsert({id:p.id,owner_id:user.id,name:p.name,building_use:p.facts?.buildingUse||null,site_address:p.address||null,dimensions:{length:p.facts?.length||null,width:p.facts?.width||null,height:p.facts?.height||null,roofPitch:p.facts?.roofPitch||null},stage:p.stage,project_data:p,updated_at:new Date().toISOString()}));assert(error)
 }
 const events=chronologicalChanges(previous,current);
 if(events.length){({error}=await client.from("project_events").insert(events.map(e=>({...e,actor_id:user.id}))));assert(error)}
 lastSnapshot=JSON.stringify(current);return {enabled:true,synced:true,eventCount:events.length};
}
async function deleteProject(projectId){
 if(!enabled)throw new Error("Platform is not configured");
 const {data:{user},error:ue}=await client.auth.getUser();assert(ue);if(!user)throw new Error("Sign in required");
 const {data:owned,error:oe}=await client.from("projects").select("id").eq("id",projectId).eq("owner_id",user.id).maybeSingle();assert(oe);
 if(!owned)throw new Error("Project not found or you do not have permission to delete it.");
 const prefix=`${user.id}/${projectId}`,paths=[];let offset=0;
 while(true){
  const {data:objects,error:le}=await client.storage.from("project-documents").list(prefix,{limit:100,offset,sortBy:{column:"name",order:"asc"}});assert(le);
  const batch=(objects||[]).filter(item=>item&&item.name).map(item=>`${prefix}/${item.name}`);paths.push(...batch);
  if(!objects||objects.length<100)break;offset+=objects.length;
 }
 if(paths.length){const {error:re}=await client.storage.from("project-documents").remove(paths);assert(re)}
 const {data:deleted,error:de}=await client.from("projects").delete().eq("id",projectId).eq("owner_id",user.id).select("id").maybeSingle();assert(de);
 if(!deleted)throw new Error("Project deletion was not completed.");
 lastSnapshot="";return {deleted:true,id:projectId,removedDocuments:paths.length};
}
async function uploadProjectDocument(projectId,file){
 if(!enabled)throw new Error("Platform is not configured");
 const {data:{user},error:ue}=await client.auth.getUser();assert(ue);if(!user)throw new Error("Sign in required");
 const contentType=/\.dwg$/i.test(file.name)?"image/vnd.dwg":(file.type||"application/octet-stream");
 const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=`${user.id}/${projectId}/${crypto.randomUUID()}-${safe}`;
 let {error}=await client.storage.from("project-documents").upload(path,file,{contentType});assert(error);
 ({error}=await client.from("documents").insert({project_id:projectId,owner_id:user.id,storage_path:path,original_name:file.name,mime_type:contentType,size_bytes:file.size}));assert(error);
 ({error}=await client.from("project_events").insert({project_id:projectId,actor_id:user.id,event_type:"document.uploaded",payload:{name:file.name,type:contentType,size:file.size}}));assert(error);
 return path;
}
async function projectDocumentUrl(projectId,entry){
 if(!enabled)throw new Error("Platform is not configured");
 const {data:{user},error:ue}=await client.auth.getUser();assert(ue);if(!user)throw new Error("Sign in required");
 let path=entry.storagePath;
 if(!path){
  const {data:rows,error}=await client.from("documents").select("storage_path").eq("project_id",projectId).eq("owner_id",user.id).eq("original_name",entry.name).limit(2);assert(error);
  if(!rows?.length)throw new Error("This older record has no stored file. Use Replace to attach it.");
  if(rows.length!==1)throw new Error("More than one stored file has this name. Use Replace to attach the correct revision.");
  path=rows[0].storage_path;
 }
 if(!path.startsWith(user.id+"/"+projectId+"/"))throw new Error("Document does not belong to this project.");
 const isDwg=/\.dwg$/i.test(entry.name||"");
 const signed=isDwg
  ?await client.storage.from("project-documents").createSignedUrl(path,60,{download:true})
  :await client.storage.from("project-documents").createSignedUrl(path,60);
 const {data,error}=signed;assert(error);
 return data.signedUrl;
}
window.ProjectCheckPlatform={projectDocumentUrl,enabled,client,signIn,requestPasswordReset,updatePassword,signUp,signOut,hydrateState,captureState,deleteProject,uploadProjectDocument};
})();
