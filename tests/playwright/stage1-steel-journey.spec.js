const {test,expect}=require('@playwright/test');
const reviewHandler=require('../../Project-Check-MVP-Master-Build/api/stage1-review');

const KEY='projectcheck_master_v1';
const BRANCH='feature/approved-project-journey-menu-2026-11-12';
const user={id:'steel-test-user',email:'steel@example.invalid',name:'Test Reviewer',company:'Example Warehouse'};
const existingId='125ad986-9089-476d-987e-e8539117c2a2';
const baseOptions=['Concrete slab or concrete hardstanding','Newly designed concrete base suitable for structure','Tarmac or asphalt','Hardcore or stone','Soil or grass','Mixed surfaces','Not sure'];
const temperatureOptions=['Ambient working temperature — heated','Ambient storage — unheated','Other temperature requirement','Not sure yet'];
const reuseOptions=['Yes — assess it for reuse','No — a new base is planned','Not sure'];
const evidenceOptions=['Yes — upload them now','Yes — I will upload them later','No','Not sure'];

async function seedCustomer(page,projects=[]){
  await page.route('**/platform-config.js?*',route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.addInitScript(({key,user,projects})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({user,users:[user],projects}));
  },{key:KEY,user,projects});
}

async function review(page){
  if(!process.env.STEEL_LIVE_PREVIEW){
    await page.route('**/api/stage1-review',async route=>{
      let code=200,body;
      const originalEnv=process.env.VERCEL_ENV,originalBranch=process.env.VERCEL_GIT_COMMIT_REF;
      try {
        process.env.VERCEL_ENV='preview';
        process.env.VERCEL_GIT_COMMIT_REF=BRANCH;
        reviewHandler({method:route.request().method()},{
          setHeader(){},status(value){code=value;return this},
          json(value){body=JSON.stringify(value)},end(){}
        });
      } finally {
        if(originalEnv===undefined)delete process.env.VERCEL_ENV;
        else process.env.VERCEL_ENV=originalEnv;
        if(originalBranch===undefined)delete process.env.VERCEL_GIT_COMMIT_REF;
        else process.env.VERCEL_GIT_COMMIT_REF=originalBranch;
      }
      await route.fulfill({status:code,contentType:'application/json',body});
    });
  }
  const response=await page.goto('/?menu-preview=1',{waitUntil:'domcontentloaded'});
  expect(response.status()).toBe(200);
  await expect(page.locator('#siteDrawer')).toHaveAttribute('aria-hidden','false');
}

async function openFromDrawer(page,label,route){
  const drawer=page.locator('#siteDrawer');
  if(await drawer.getAttribute('aria-hidden')==='true')await page.locator('#menuBtn').click();
  await drawer.locator(`button[data-route="${route}"]`).filter({hasText:label}).click();
  await expect(drawer).toHaveAttribute('aria-hidden','true');
  await expect(page).toHaveURL(new RegExp('#'+route+'/'));
}

test('new steel project uses two questions and retains map order and edited facts',async({page})=>{
  test.skip(Boolean(process.env.STEEL_LIVE_PREVIEW),'Customer creation is exercised with browser-local test data.');
  await seedCustomer(page);
  await page.goto('/#createProject');
  await page.locator('#npName').fill('North Warehouse');
  await page.locator('#npRole').fill('Operations Manager');
  await page.locator('#npUse').selectOption('Warehousing and general storage');
  await page.locator('#npType').selectOption('Free-standing building');
  await page.locator('input[name=npSiteSame][value=no]').check();
  await page.locator('#npAddress').fill('Demonstration site, SW1A 1AA');
  for(const [field,value] of [['npLength','24'],['npWidth','15'],['npHeight','5']])await page.locator('#'+field).fill(value);
  await page.locator('#npCreate').click();
  await expect(page.getByRole('heading',{name:'North Warehouse'})).toBeVisible();
  await openFromDrawer(page,'Project Details','projectSettings');
  for(const [id,values] of [['psExistingBase',baseOptions],['psTemperatureCondition',temperatureOptions],['psBaseReuse',reuseOptions],['psSiteEvidence',evidenceOptions]]){
    expect(await page.locator('#'+id+' option').allTextContents()).toEqual(['Choose…',...values.map(value=>value==='Other temperature requirement'?value+' — enter required °C':value)]);
  }
  const input=page.locator('#psRequiredTemperature');
  await expect(input).toBeHidden();
  await page.locator('#psTemperatureCondition').selectOption('Other temperature requirement');
  await expect(input).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#saveProjectSettings').click();
  await expect(page.locator('#psRequiredTemperature')).toBeVisible();
  await input.fill('1.5');
  await page.locator('#psExistingBase').selectOption('Tarmac or asphalt');
  await page.locator('#psBaseReuse').selectOption('Yes — assess it for reuse');
  await expect(page.locator('#psSiteEvidence')).toBeVisible();
  await page.locator('#psSiteEvidence').selectOption('No');
  await page.locator('#saveProjectSettings').click();
  await expect(page.getByText('Other temperature requirement — 1.5°C')).toBeVisible();
  await openFromDrawer(page,'Initial Questions','stage1');
  await expect(page.getByRole('list',{name:'Stage 1 questions'}).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Will the building be heated?')).toHaveCount(0);
  await expect(page.getByText('What is currently on the area where the building will sit?')).toHaveCount(0);
  const save=page.getByRole('button',{name:'Save & continue'});
  await page.locator('#answer').fill('0');await save.click();
  await page.locator('#answer').fill('1');await save.click();
  await expect(page.getByText('Stage 1 · Building position',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue without pinpointing on the map'}).click();
  await expect(page.getByText('Stage 1 · Site boundary',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue without drawing the boundary'}).click();
  await expect(page).toHaveURL(/#stage1Confirm\//);
  // The free-report button moved to Building Design; open the report via the same action.
  await page.evaluate(()=>confirmSteelStage1Summary(location.hash.split('/')[1],'stage1Summary'));
  await expect(page.getByText(/Below 2°C: specialist/)).toBeVisible();
  await expect(page.getByText(/Tarmac or asphalt records the visible surface/)).toBeVisible();
  await expect(page.getByText(/Drain and service locations are unconfirmed/)).toBeVisible();
  await openFromDrawer(page,'Project Details','projectSettings');
  await page.locator('#psTemperatureCondition').selectOption('Ambient working temperature — heated');
  await page.locator('#psExistingBase').selectOption('Concrete slab or concrete hardstanding');
  await page.locator('#psBaseReuse').selectOption('No — a new base is planned');
  await expect(page.locator('#psSiteEvidence')).toBeHidden();
  await page.locator('#saveProjectSettings').click();
  await page.reload();
  await expect(page.getByText('Ambient working temperature — heated')).toBeVisible();
  await openFromDrawer(page,'Project Summary','stage1Confirm');
  await expect(page.getByText('Concrete slab or concrete hardstanding')).toBeVisible();
  // The free-report button moved to Building Design; open the report via the same action.
  await page.evaluate(()=>confirmSteelStage1Summary(location.hash.split('/')[1],'stage1Summary'));
  await expect(page.getByText(/Allow for an insulated envelope/)).toBeVisible();
  await expect(page.getByText(/A new base is planned. Its design/)).toBeVisible();
  await expect(page.getByText(/Below 2°C: specialist/)).toHaveCount(0);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).projects.map(project=>project.name),KEY)).toEqual(['North Warehouse']);
});

test('existing project preserves old answers and uses the current steel options',async({page})=>{
  test.skip(Boolean(process.env.STEEL_LIVE_PREVIEW),'Existing customer data is simulated in the browser.');
  await seedCustomer(page,[{
    id:existingId,owner:user.id,name:'Existing Warehouse',address:'Demonstration site, SW1A 1AA',
    facts:{role:'Facilities Manager',buildingUse:'Warehousing and general storage',buildingType:'Free-standing building',length:'24',width:'15',height:'5',roofPitch:'10',heated:'Yes',base:'Tarmac / asphalt',clearSpan:'Yes',rollerCount:'0',personnelDoors:'1',buildingPositionStatus:'skipped',level:'No'},
    stage:'Stage 1',stage2:{},evidence:[],quotes:[],history:[],downloads:{s1:0,s2:0}
  }]);
  await page.goto('/#projectSettings/'+existingId);
  await expect(page.locator('#psTemperatureCondition')).toHaveValue('Ambient working temperature — heated');
  await expect(page.locator('#psExistingBase')).toHaveValue('Tarmac or asphalt');
  await openFromDrawer(page,'Initial Questions','stage1');
  await expect(page.getByText('Stage 1 · Question 2 of 2')).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.locator('#answer')).toHaveValue('0');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).projects[0].facts.heated,KEY)).toBe('Yes');
});

for(const [width,height] of [[390,844],[430,932],[768,1024],[1024,768],[1440,900],[1920,1080]]){
  test(`signed-out review follows real pages at ${width}×${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    const customerRequests=[];
    page.on('request',request=>{if(/supabase\.co/.test(new URL(request.url()).hostname))customerRequests.push(request.url())});
    await review(page);
    const drawer=page.locator('#siteDrawer');
    await expect(drawer.locator('#drawerProjectName')).toHaveText('Project Mount');
    await expect(drawer.locator('[data-route=stage1]')).toContainText('2 of 2');
    await expect(drawer.getByRole('button',{name:'Stage 2 Locked'})).toBeDisabled();
    await expect(drawer.getByText(/Stage 3|After payment/)).toHaveCount(0);
    await page.locator('#drawerClose').click();
    await expect(drawer).toHaveAttribute('aria-hidden','true');
    const pages=[
      ['Project Overview','stage1Workspace','h1','Project Mount'],
      ['Project Details','projectSettings','h1','Edit project details'],
      ['Initial Questions','stage1','.q-content h2','vehicle doors'],
      ['Project Documents','projectDocuments','h1','Project Mount'],
      ['Project Summary','stage1Confirm','h1','Check what we already know'],
      ['Site Layout','siteLayout','h1','Position your building'],
      ['Building Design','buildingLayout','h1','Design your building'],
      ['Stage 1 Free Report','stage1Summary','h1','Project Check — Stage 1 Free Report']
    ];
    for(const [label,route,selector,heading] of pages){
      await openFromDrawer(page,label,route);
      await expect(page.locator('#app '+selector).first()).toContainText(heading);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),route).toBeLessThanOrEqual(1);
      if(route==='projectSettings')await expect(page.locator('#psRequiredTemperature')).toHaveValue('1.5');
      if(route==='stage1Workspace'||route==='stage1Confirm')await expect(page.getByText('Other temperature requirement — 1.5°C')).toBeVisible();
      if(route==='siteLayout')await expect(page.getByRole('region',{name:'Site observations'})).toContainText('reported fall');
      if(route==='buildingLayout'||route==='stage1Summary')await expect(page.getByRole('region',{name:'Building envelope context'})).toContainText('Below 2°C');
    }
    if(width===390){
      await openFromDrawer(page,'Project Details','projectSettings');
      await page.locator('#psTemperatureCondition').selectOption('Ambient working temperature — heated');
      await page.locator('#psExistingBase').selectOption('Tarmac or asphalt');
      await page.locator('#saveProjectSettings').click();
      await expect(page.locator('#stage1WorkspaceTitle')).toBeVisible();
      await page.reload();
      await expect(page.getByText('Ambient working temperature — heated',{exact:true})).toBeVisible();
      await expect(page.getByText('Tarmac or asphalt',{exact:true})).toBeVisible();
      await openFromDrawer(page,'Site Layout','siteLayout');
      await expect(page.getByRole('region',{name:'Site observations'})).toContainText('Tarmac or asphalt records the visible surface');
      await openFromDrawer(page,'Building Design','buildingLayout');
      await expect(page.getByRole('region',{name:'Building envelope context'})).toContainText('Allow for an insulated envelope');
      await openFromDrawer(page,'Stage 1 Free Report','stage1Summary');
      await expect(page.getByRole('region',{name:'Building envelope context'})).toContainText('Allow for an insulated envelope');
    }
    expect(pageErrors).toEqual([]);
    expect(customerRequests).toEqual([]);
    expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBeNull();
  });
}

for(const [width,height] of [[390,844],[768,1024],[1440,900]]){
  test(`conflicting requirements and saved openings survive both design saves at ${width}×${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await review(page);
    await openFromDrawer(page,'Building Design','buildingLayout');
    const comparison=page.getByRole('region',{name:'Roller doors'});
    async function expectBothRecords(){
      await expect(comparison).toContainText('Roller doors · 1 required · 1 drawn · 1 to check');
      await expect(comparison.locator('.bd-roller-pair section').nth(0)).toContainText('Width5 mHeight5 mAccessHGV');
      await expect(comparison.locator('.bd-roller-pair section').nth(1)).toContainText('Width4 mHeight4 mAccessVan');
      await expect(comparison).toContainText('clear size or access type differs');
    }
    const tabs=page.getByRole('toolbar',{name:'Drawing views'});
    async function selectFromPlan(label){
      await tabs.getByRole('button',{name:'Plan',exact:true}).click();
      await page.getByRole('button',{name:label,exact:true}).click();
    }
    const sill=page.locator('#buildingDesignWindowSill');
    async function raiseSill(value){
      await sill.press('ArrowUp');
      await sill.press('Tab');
      await expect(sill).toHaveValue(Number(value).toFixed(2));
    }
    async function expectSaved(status,rightSill,leftSill){
      const project=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('projectcheck_stage1_review_v1')).projects[0]);
      expect(project.buildingDesign.status).toBe(status);
      expect(project.facts.rollerCount).toBe('1');
      expect(project.facts.rollerDoors).toEqual([{width:'5',height:'5',access:'HGV',widthSource:'user',heightSource:'user'}]);
      expect(project.geometry.doors).toEqual(expect.arrayContaining([
        expect.objectContaining({type:'roller',wall:'front',offset:5.5,width:4,height:4,access:'Van'}),
        expect.objectContaining({type:'personnel',wall:'back',offset:1,width:1,height:2.1}),
        expect.objectContaining({type:'window',wall:'right',offset:1.2,width:1.8,height:.8,sillHeight:rightSill}),
        expect.objectContaining({type:'window',wall:'left',offset:6,width:1.8,height:.8,sillHeight:leftSill})
      ]));
      expect(project.geometry.doors).toHaveLength(4);
      expect(project.geometry.skylights).toEqual([
        {id:'sk1',ref:'S1',type:'skylight',width:1,length:2,offsetX:4,offsetY:6,bayIndex:1,source:'customer'}
      ]);
      expect(project.facts.siteLayoutMapView).toMatchObject({zoom:18.5,bearing:25});
      expect(project.facts.buildingFootprint).toMatchObject({angle:0,length:24,width:15});
      expect(project.facts.relevantBoundaries).toHaveLength(1);
    }
    await expectBothRecords();
    await expect(page.locator('#buildingDesignSiteMap [data-review-site-elevation], #buildingDesignSiteMap .bd-site-elevation-marker')).toHaveCount(4);
    await expect(page.getByRole('button',{name:'Skylight 1',exact:true})).toBeVisible();
    await selectFromPlan('Roller door 1 · Elevation A');
    await expect(page.locator('#buildingDesignRollerAccess')).toHaveValue('Van');
    await selectFromPlan('Casement window 1 · Elevation B');
    await expect(sill).toHaveValue('1.40');
    await raiseSill('1.5');
    await page.getByRole('button',{name:'Save draft',exact:true}).click();
    await expectSaved('draft',1.5,1.4);
    await page.reload();
    await selectFromPlan('Casement window 1 · Elevation B');
    await expect(sill).toHaveValue('1.50');
    await selectFromPlan('Casement window 2 · Elevation D');
    await expect(sill).toHaveValue('1.40');
    await raiseSill('1.5');
    await page.getByRole('button',{name:'Confirm Building Design',exact:true}).click();
    await expectSaved('confirmed',1.5,1.5);
    await page.reload();
    await tabs.getByRole('button',{name:'Plan',exact:true}).click();
    await expect(page.getByRole('button',{name:'Skylight 1',exact:true})).toBeVisible();
    await selectFromPlan('Casement window 2 · Elevation D');
    await expect(sill).toHaveValue('1.50');
    await expect(sill).toBeDisabled();
    await expectBothRecords();
    await openFromDrawer(page,'Project Summary','stage1Confirm');
    await expectBothRecords();
    await openFromDrawer(page,'Stage 1 Free Report','stage1Summary');
    await expectBothRecords();
    await openFromDrawer(page,'Initial Questions','stage1');
    await page.getByRole('button',{name:'Edit vehicle door requirements'}).click();
    await expect(page.locator('#answer')).toHaveValue('1');
    await page.getByRole('button',{name:'Save & continue'}).click();
    // The Stage 1 roller-door sizes/access page was removed: saving the count goes
    // straight on (everything is answered, so to the summary) and never shows door fields.
    await expect(page).toHaveURL(/#stage1Confirm\//);
    await expect(page.getByText('Roller door sizes and access')).toHaveCount(0);
    await expect(page.locator('#da0, #dw0, #dh0')).toHaveCount(0);
    await expectSaved('confirmed',1.5,1.5);
  });
}
