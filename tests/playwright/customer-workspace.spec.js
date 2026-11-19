// Current baseline labels follow 819d945 (approved fuller My Projects)
// and 83adb36 (pre-checkpoint journey). Fixture ids must be valid UUIDs.
const {test,expect}=require('@playwright/test');

const KEY='projectcheck_master_v1';
const user={id:'customer-a',email:'customer-a@example.com'};
const account={id:user.id,name:'Customer Alpha',company:'Industrial Build Check',email:user.email,mobile:'07700 900001'};

function project(id='11111111-1111-4111-8111-111111111111',name='Spray Room'){
 return {id,owner:user.id,name,address:'Test Site',postcode:'WA12 9XX',status:'Active',stage:'Stage 1',created:new Date().toISOString(),facts:{buildingUse:'Manufacturing or factory use',buildingType:'Free-standing building',length:'30',width:'20',height:'6',roofPitch:'10'},stage2:{},evidence:[],quotes:[],supplierRequest:null,risks1:[],actions1:[],risks2:[],actions2:[],history:[],downloads:{s1:0,s2:0},stage1Complete:false,stage2Complete:false,plan:null};
}

async function openWithState(page,{projects=[],hash='dashboard'}={}){
 await page.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:KEY,state:{user,users:[account],projects,stage3ImpactRegister:[]}});
 await page.goto('/#'+hash);
}

test('approved My Projects gives each project card one overview action',async({page})=>{
 await openWithState(page,{projects:[project()]});
 await expect(page.getByRole('heading',{name:'My Projects'})).toBeVisible();
 const card=page.locator('.project-summary');
 await expect(card).toHaveCount(1);
 await expect(card.getByRole('button',{name:'Open project overview',exact:true})).toHaveCount(1);
 await expect(card.getByRole('button')).toHaveCount(1);
 await card.getByRole('button',{name:'Open project overview',exact:true}).click();
 await expect(page).toHaveURL(/#stage1Workspace\/11111111-1111-4111-8111-111111111111$/);
 await expect(page.locator('.stage1-workspace').getByRole('heading',{name:'Spray Room',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Continue to Project Summary'})).toBeVisible();
});

test('legacy project route resolves to the single workspace',async({page})=>{
 await openWithState(page,{projects:[project()],hash:'project/11111111-1111-4111-8111-111111111111'});
 await expect(page.locator('.stage1-workspace')).toBeVisible();
 await expect(page.locator('[data-stage1-entry]')).toHaveCount(0);
});

test('complete project form creates once and lands in the workspace',async({page})=>{
 await openWithState(page);
 await page.getByRole('button',{name:'Create project'}).first().click();
 await page.getByLabel('Project name',{exact:true}).fill('New Unit');
 await page.getByLabel('Your role in this project',{exact:true}).fill('Facilities Manager');
 await page.getByLabel('Building use').selectOption({label:'Manufacturing or factory use'});
 await page.getByLabel('Building type').selectOption({label:'Free-standing building'});
 await page.locator('input[name="npSiteSame"][value="no"]').check();
 await page.getByLabel('Proposed building site address',{exact:true}).fill('Test Site, WA12 9XX');
 await page.getByLabel('Length (m)').fill('30');
 await page.getByLabel('Width (m)').fill('20');
 await page.getByLabel('Clear height needed (m)').fill('6');
 await page.getByRole('button',{name:'Create project',exact:true}).last().click();
 await expect(page).toHaveURL(/#stage1Workspace\//);
 await expect(page.getByRole('heading',{name:'New Unit'})).toBeVisible();
});

test('profile has one clear return destination',async({page})=>{
 await openWithState(page,{projects:[project()],hash:'profile/11111111-1111-4111-8111-111111111111'});
 await expect(page.locator('.customer-heading .actions').getByRole('button',{name:'My Projects'})).toHaveCount(1);
 await expect(page.getByRole('button',{name:/Return to/})).toHaveCount(0);
 await expect(page.getByLabel('Project name')).toHaveCount(0);
});

test('settings and documents return to the single workspace',async({page})=>{
 await openWithState(page,{projects:[project()],hash:'stage1Workspace/11111111-1111-4111-8111-111111111111'});
 await page.getByRole('button',{name:'Edit project details'}).click();
 await expect(page).toHaveURL(/#projectSettings\/11111111-1111-4111-8111-111111111111$/);
 expect(await page.getByLabel('Project status').locator('option').allTextContents()).toEqual(['Active','On hold','Completed','Archived']);
 await page.getByRole('button',{name:'Cancel'}).click();
 await expect(page).toHaveURL(/#stage1Workspace\/11111111-1111-4111-8111-111111111111$/);
 await page.getByRole('region',{name:'Your documents',exact:true}).getByRole('button',{name:'View all documents',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your uploaded documents'})).toBeVisible();
 await page.getByRole('button',{name:'Back to project overview'}).click();
 await expect(page).toHaveURL(/#stage1Workspace\/11111111-1111-4111-8111-111111111111$/);
});

test('customer journey has no horizontal overflow on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWithState(page,{projects:[project()]});
 for(const hash of ['dashboard','stage1Workspace/11111111-1111-4111-8111-111111111111','projectSettings/11111111-1111-4111-8111-111111111111','projectDocuments/11111111-1111-4111-8111-111111111111','profile/11111111-1111-4111-8111-111111111111']){
   await page.goto('/#'+hash);
   const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
   expect(widths.scroll).toBeLessThanOrEqual(widths.client);
 }
});

test('desktop customer pages use the available width while mobile stays single-column',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await openWithState(page,{projects:[project()]});
 const dashboard=await page.locator('.workspace-dashboard').evaluate(node=>node.getBoundingClientRect().width);
 expect(dashboard).toBeGreaterThan(1050);

 await page.goto('/#stage1Workspace/11111111-1111-4111-8111-111111111111');
 const overview=await page.locator('.stage1-workspace').evaluate(node=>node.getBoundingClientRect().width);
 const overviewColumns=await page.locator('.stage1-basis-grid').first().evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
 expect(overview).toBeGreaterThan(1050);
 expect(overviewColumns).toBe(2);

 await page.goto('/#stage1Confirm/11111111-1111-4111-8111-111111111111');
 const summary=await page.locator('.stage1-workspace').evaluate(node=>node.getBoundingClientRect().width);
 const summaryColumns=await page.locator('.stage1-basis-grid').first().evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
 expect(summary).toBeGreaterThan(1050);
 expect(summaryColumns).toBe(2);

 await page.goto('/#signin');
 const signin=await page.locator('.signin-screen').evaluate(node=>node.getBoundingClientRect().width);
 const signinColumns=await page.locator('.signin-screen .auth-main').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
 expect(signin).toBeGreaterThan(900);
 expect(signinColumns).toBe(2);

 await page.setViewportSize({width:390,height:844});
 await page.reload();
 const mobileSignin=await page.locator('.signin-screen').evaluate(node=>node.getBoundingClientRect().width);
 const mobileDisplay=await page.locator('.signin-screen .auth-main').evaluate(node=>getComputedStyle(node).display);
 expect(mobileSignin).toBeLessThanOrEqual(390);
 expect(mobileDisplay).not.toBe('grid');
});

test('every mobile-first customer page has a deliberate desktop composition',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 const p=project();
 p.stage1Complete=true;
 p.stage2Complete=true;
 p.stage='Stage 2 complete';
 p.plan='£99 Solutions';
 await openWithState(page,{projects:[p]});

 const widthOf=async selector=>page.locator(selector).evaluate(node=>node.getBoundingClientRect().width);
 const columnCount=async selector=>page.locator(selector).evaluate(node=>{
   const value=getComputedStyle(node).gridTemplateColumns;
   return value==='none'?0:value.split(' ').filter(Boolean).length;
 });

 await page.goto('/#pricing');
 expect(await widthOf('.ceo-pricing-body')).toBeGreaterThan(1050);
 expect(await columnCount('.pricing-steps')).toBe(4);

 await page.goto('/#createProject');
 expect(await widthOf('.create-project-screen')).toBeGreaterThan(1050);
 expect(await columnCount('.create-project-screen #briefFields')).toBe(2);
 expect(await columnCount('.create-project-screen .dimensions-grid')).toBe(3);

 await page.goto('/#profile/11111111-1111-4111-8111-111111111111');
 expect(await widthOf('.profile-page')).toBeGreaterThan(1050);
 expect(await columnCount('.profile-page')).toBe(2);

 await page.goto('/#profileEdit/11111111-1111-4111-8111-111111111111');
 expect(await widthOf('.profile-page')).toBeGreaterThan(1050);
 expect(await columnCount('.profile-form')).toBe(2);

 await page.goto('/#projectSettings/11111111-1111-4111-8111-111111111111');
 expect(await widthOf('.ceo-project-settings')).toBeGreaterThan(1050);
 expect(await columnCount('.project-specification-form')).toBe(2);

 await page.goto('/#projectDocuments/11111111-1111-4111-8111-111111111111');
 expect(await widthOf('.project-management-page')).toBeGreaterThan(1050);

 // The remaining customer workflow routes already use the shared 1180px
 // container. This loop protects them from acquiring another narrow phone
 // cap later without forcing every page into the same visual composition.
 for(const hash of [
   'stage1/11111111-1111-4111-8111-111111111111',
   'stage1Summary/11111111-1111-4111-8111-111111111111',
   'stage2/11111111-1111-4111-8111-111111111111',
   'stage2Summary/11111111-1111-4111-8111-111111111111',
   'quotes/11111111-1111-4111-8111-111111111111',
   'doors/11111111-1111-4111-8111-111111111111',
   'stage3/11111111-1111-4111-8111-111111111111',
   'terms',
   'privacy'
 ]){
   await page.goto('/#'+hash);
   expect(await widthOf('#app > .container')).toBeGreaterThan(1050);
 }
});

test('new desktop corrections retain their single-column mobile layouts',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWithState(page,{projects:[project()]});

 const columnCount=async selector=>page.locator(selector).evaluate(node=>{
   const style=getComputedStyle(node);
   if(style.display!=='grid')return 1;
   const value=style.gridTemplateColumns;
   return value==='none'?1:value.split(' ').filter(Boolean).length;
 });

 for(const hash of [
   'pricing',
   'createProject',
   'profile/11111111-1111-4111-8111-111111111111',
   'profileEdit/11111111-1111-4111-8111-111111111111',
   'projectSettings/11111111-1111-4111-8111-111111111111',
   'projectDocuments/11111111-1111-4111-8111-111111111111'
 ]){
   await page.goto('/#'+hash);
   const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
   expect(widths.scroll).toBeLessThanOrEqual(widths.client);
 }

 await page.goto('/#createProject');
 expect(await columnCount('.create-project-screen #briefFields')).toBe(1);
 await page.goto('/#projectSettings/11111111-1111-4111-8111-111111111111');
 expect(await columnCount('.project-specification-form')).toBe(1);
});




test('sign-in form is usable on desktop and mobile without phone-only wording',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#signin');
 const signInPanel=page.locator('#authPanelSignin');
 const businessEmail=signInPanel.getByLabel('Business email',{exact:true});
 await expect(page.getByText('One-tap access on this trusted device')).toBeVisible();
 await expect(businessEmail).toBeVisible();
 await expect(signInPanel.getByLabel('Password',{exact:true})).toBeVisible();
 const formWidth=await signInPanel.evaluate(el=>el.getBoundingClientRect().width);
 expect(formWidth).toBeLessThanOrEqual(560);
 await page.setViewportSize({width:390,height:844});
 await page.reload();
 await expect(businessEmail).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

