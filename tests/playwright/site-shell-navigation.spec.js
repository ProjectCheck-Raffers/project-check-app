const {test,expect}=require('@playwright/test');

const KEY='projectcheck_master_v1';
const user={id:'journey-user',email:'journey@example.test',name:'Journey Review',company:'Project Check',mobile:'07700 900123'};
const project={id:'22222222-2222-4222-8222-222222222222',owner:user.id,name:'Example Project',address:'Example House, Exampleton',postcode:'AB1 3CD',status:'Active',stage:'Stage 1',created:new Date().toISOString(),facts:{buildingUse:'Manufacturing or factory use',buildingType:'Free-standing building',length:'41',width:'38',height:'7',roofPitch:'5'},stage2:{},evidence:[],quotes:[],risks1:[],actions1:[],risks2:[],actions2:[],history:[],downloads:{s1:0,s2:0},stage1Complete:false,stage2Complete:false};

async function seed(page){await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:KEY,value:{user:{id:user.id,email:user.email},users:[user],projects:[project],stage3ImpactRegister:[]}})}

test('approved shell and single workspace route remain usable at key widths',async({page})=>{
 await seed(page);
 for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:320,height:720}]){
  await page.setViewportSize(viewport);
  for(const route of ['dashboard','stage1Workspace/'+project.id,'projectSettings/'+project.id,'projectDocuments/'+project.id,'profile/'+project.id,'profileEdit/'+project.id]){
   await page.goto('/#'+route);
   await expect(page.locator('.brand-logo')).toBeVisible();
   await expect(page.locator('#menuBtn')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
 }
});

test('drawer contains the signed-in customer destinations',async({page})=>{
 await seed(page);await page.goto('/#dashboard');
 await page.locator('#menuBtn').click();
 const drawer=page.locator('#siteDrawer');
 await expect(drawer.getByRole('button',{name:'Home'})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Pricing'})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'My Projects'})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Profile & Settings'})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Sign out'})).toBeVisible();
});


test('drawer shows the approved project journey and locked Stage 2 only',async({page})=>{
 await seed(page);await page.goto('/#stage1Workspace/'+project.id);
 await page.locator('#menuBtn').click();
 const drawer=page.locator('#siteDrawer');
 await expect(drawer.locator('#drawerProjectName')).toHaveText('Example Project');
 await expect(drawer.getByRole('button',{name:/Project Overview/})).toHaveAttribute('aria-current','page');
 await expect(drawer.getByRole('button',{name:/Initial Questions/})).toBeVisible();
 await expect(drawer.getByRole('button',{name:/Project Documents/})).toBeVisible();
 await expect(drawer.getByRole('button',{name:/Project Summary/})).toBeVisible();
 await expect(drawer.getByRole('button',{name:/Site Layout/})).toBeVisible();
 await expect(drawer.getByRole('button',{name:/Building Design/})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Stage 2 Locked'})).toBeDisabled();
 await expect(drawer.getByText('Locked',{exact:true})).toBeVisible();
 await expect(drawer.getByText(/Stage 3/)).toHaveCount(0);
});
