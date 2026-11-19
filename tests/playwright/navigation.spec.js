const {test,expect}=require('@playwright/test');
const h=require('./helpers');

test('approved pricing presents the four journey stages and prices',async({page})=>{
 await page.goto('/#pricing');
 await expect(page.getByRole('heading',{name:/Start with the project\.\s*Decide the support later\./})).toBeVisible();
 for(const stage of ['1 Share the facts · FREE','2 Reveal the risks · FREE','3 Choose a route · £99 if needed','4 Move forward · £249 if needed']){
  await expect(page.getByRole('heading',{name:stage,exact:true})).toBeVisible();
 }

});

test('signed-out drawer exposes clear entry routes',async({page})=>{
 await page.goto('/#home');
 await page.locator('#menuBtn').click();
 const drawer=page.locator('#siteDrawer');
 await expect(drawer.getByRole('button',{name:'Home'})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Pricing'})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Sign in'})).toBeVisible();
 await expect(drawer.getByRole('button',{name:'Create account'})).toBeVisible();
});

test('legacy navigation layer is absent from the document',async({page})=>{
 await page.goto('/#home');
 await expect(page.locator('.legacy-nav')).toHaveCount(0);
});

test('closed drawer is inert; keyboard opening and Escape restore focus',async({page})=>{
 await page.goto('/#home');
 const drawer=page.locator('#siteDrawer'), menu=page.locator('#menuBtn');
 await expect(drawer).toHaveAttribute('inert','');
 await page.locator('#drawerSignIn').evaluate(el=>el.focus());
 expect(await drawer.evaluate(el=>el.contains(document.activeElement))).toBe(false);
 await menu.focus();
 await page.keyboard.press('Enter');
 await expect(drawer).not.toHaveAttribute('inert','');
 await expect(drawer.getByRole('button',{name:'Home',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');
 await expect(drawer.getByRole('button',{name:'Pricing',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(drawer).toHaveAttribute('inert','');
 await expect(menu).toBeFocused();
});

test('drawer navigation closes without leaving focus in hidden controls',async({page})=>{
 await page.goto('/#home');
 await page.locator('#menuBtn').click();
 await page.locator('#siteDrawer').getByRole('button',{name:'Pricing',exact:true}).click();
 await expect(page).toHaveURL(/#pricing$/);
 await expect(page.locator('#siteDrawer')).toHaveAttribute('inert','');
 expect(await page.locator('#siteDrawer').evaluate(el=>el.contains(document.activeElement))).toBe(false);
});

for(const width of [390,1280]){
 test(`current registration and project brief preserve customer facts at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await h.signUpAndReachDashboard(page,`repair-${width}-${Date.now()}@example.test`);
  await h.createProject(page,'Local repair verification');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('projectcheck_master_v1')));
  expect(state.projects).toHaveLength(1);
  expect(state.projects[0].name).toBe('Local repair verification');
  expect(state.projects[0].address).toBe('1 Test Way, Testville, WA12 9XX');
  expect(state.projects[0].facts).toMatchObject({length:'40',width:'24',height:'6',role:'Facilities / operations'});
  await page.getByRole('button',{name:'Continue to Project Summary',exact:true}).click();
  await expect(page).toHaveURL(/#stage1Confirm\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading',{name:'Check what we already know',exact:true})).toBeVisible();
  h.assertNoUnexpectedDialogs(page);
 });
}

