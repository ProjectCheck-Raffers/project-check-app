// Current customer entry route on approved; legacy assessments are separate.
const {expect}=require('@playwright/test');
const h=require('./helpers');

module.exports=async function currentCustomerJourney({page},testInfo){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Deterministic geocoding fixture; this test does not verify a live provider.
 await page.route('https://nominatim.openstreetmap.org/**',route=>route.fulfill({json:[{lat:'53.45',lon:'-2.63',display_name:'1 Test Way, Testville, WA12 9XX'}]}));
 await h.signUpAndReachDashboard(page,`current-${testInfo.project.name}-${Date.now()}@example.test`);
 await h.assertNoHorizontalOverflow(page,'My Projects');
 const name='Current journey '+testInfo.project.name;
 await h.createProject(page,name);
 await h.assertNoHorizontalOverflow(page,'Project Overview');
 await page.getByRole('button',{name:'Continue to Project Summary',exact:true}).click();
 await expect(page).toHaveURL(/#stage1Confirm\/[0-9a-f-]+$/);
 await expect(page.getByRole('heading',{name:'Check what we already know',exact:true})).toBeVisible();
 await expect(page.locator('#app')).toContainText(name);
 await h.assertNoHorizontalOverflow(page,'Project Summary');
 await page.getByRole('button',{name:'Continue to Site Layout',exact:true}).click();
 await expect(page).toHaveURL(/#siteLayout\/[0-9a-f-]+$/);
 await expect(page.getByRole('heading',{name:'Position your building',exact:true,level:1})).toBeVisible();
 await expect(page.locator('.site-layout-dimensions strong')).toHaveText('40 m × 24 m');
 await expect(page.locator('#siteLayoutMap canvas')).toBeVisible();
 await h.assertNoHorizontalOverflow(page,'Site Layout');
 await expect(page.locator('#siteLayoutAddressStatus')).toContainText('Site located');
 const siteLayoutUrl=page.url();
 await page.locator('details.site-layout-map-config summary').click();
 await page.getByLabel('Street',{exact:true}).check();
 await expect.poll(()=>page.evaluate(()=>activeSiteLayoutMap.getLayoutProperty('osm-street-layer','visibility'))).toBe('visible');
 await page.getByLabel('Satellite',{exact:true}).check();
 await expect.poll(()=>page.evaluate(()=>activeSiteLayoutMap.getLayoutProperty('esri-satellite-layer','visibility'))).toBe('visible');
 // The old mode toolbar and its controls are gone: one main action, drag handles on the map.
 await expect(page.getByText('Choose what you want to control')).toHaveCount(0);
 for(const mode of ['Move building','Rotate building','Move map','Rotate map']){
  await expect(page.getByRole('button',{name:mode,exact:true})).toHaveCount(0);
 }
 const main=page.locator('#siteLayoutMainBtn');
 await expect(page.locator('#siteLayoutMainBtn')).toHaveCount(1);
 await expect(main).toBeVisible();
 await expect(main).toHaveText('Confirm building position');
 await expect(page.locator('#siteLayoutBoundaryStep')).toBeHidden();
 // Zoom out so both handles are well inside the map, then drag the building and the rotate handle.
 await page.evaluate(()=>activeSiteLayoutMap.jumpTo({zoom:17}));
 const handle=page.locator('.site-layout-building-handle'),rotate=page.locator('.site-layout-rotate-handle');
 await expect(handle).toBeVisible();
 await expect(rotate).toBeVisible();
 const marker=()=>page.evaluate(()=>{const c=activeSiteLayoutMarker.getLngLat();return {lat:c.lat,lng:c.lng}});
 const dragBy=async(locator,dx,dy)=>{
  const box=await locator.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx/2,y+dy/2,{steps:4});await page.mouse.move(x+dx,y+dy,{steps:4});await page.mouse.up();
 };
 const before=await marker();
 await dragBy(handle,50,30);
 const moved=await marker();
 expect(moved.lng,'dragging the building handle moves the building east').toBeGreaterThan(before.lng);
 expect(moved.lat,'dragging the building handle moves the building south').toBeLessThan(before.lat);
 await expect(page.locator('#siteLayoutMainBtn')).toHaveText('Confirm building position');
 expect(await page.evaluate(()=>activeSiteLayoutAngle)).toBe(0);
 // Rotate handle starts due north of the building; pulling it to the building's east rotates the footprint.
 const centre=await handle.boundingBox();
 const rb=await rotate.boundingBox();
 await page.mouse.move(rb.x+rb.width/2,rb.y+rb.height/2);await page.mouse.down();
 await page.mouse.move(centre.x+centre.width/2+60,centre.y+centre.height/2,{steps:8});await page.mouse.up();
 const angle=await page.evaluate(()=>activeSiteLayoutAngle);
 expect(angle,'rotate handle changes the building angle').not.toBe(0);
 expect(Math.abs(angle-270),'handle dragged to the east of the building').toBeLessThan(10);
 await expect(page.locator('#siteLayoutBuildingAngle')).toHaveText(Math.round(angle)+'°');
 expect(await marker(),'rotating must not move the building').toEqual(moved);
 expect(await page.evaluate(()=>activeSiteLayoutMap.getBearing()),'rotating the building does not rotate the map').toBe(0);
 // Rotate the MAP (what a two-finger twist does): the building keeps its real-world centre and angle.
 await page.evaluate(()=>activeSiteLayoutMap.jumpTo({bearing:40}));
 expect(await marker(),'rotating the map must not move the building').toEqual(moved);
 expect(await page.evaluate(()=>activeSiteLayoutAngle),'rotating the map must not change the building angle').toBe(angle);
 // Rotate handle while the map is rotated: the saved angle is real-world, so it must still follow the pointer's geographic direction.
 const centre2=await handle.boundingBox(),rb2=await rotate.boundingBox();
 await page.mouse.move(rb2.x+rb2.width/2,rb2.y+rb2.height/2);await page.mouse.down();
 await page.mouse.move(centre2.x+centre2.width/2+60,centre2.y+centre2.height/2,{steps:8});await page.mouse.up();
 const rotatedAngle=await page.evaluate(()=>activeSiteLayoutAngle);
 // Screen-east on a map with bearing 40 is real-world bearing 40+90 from the building, i.e. angle 270-40.
 expect(Math.abs(rotatedAngle-230),'handle drag accounts for map bearing').toBeLessThan(10);
 expect(await page.evaluate(()=>activeSiteLayoutMap.getBearing()),'dragging the rotate handle does not move the map bearing').toBe(40);
 expect(await marker(),'rotate handle does not move the building').toEqual(moved);
 const rotatedPolygon=await page.evaluate(()=>activeSiteLayoutMap.getSource('building-footprint')._data.geometry.coordinates[0].length);
 expect(rotatedPolygon,'footprint stays a geographic polygon').toBe(5);
 await page.evaluate(()=>activeSiteLayoutMap.jumpTo({bearing:0}));
 const angle2=rotatedAngle;
 // Step 1: confirm the building. Boundaries are optional, so confirming with none must work.
 await main.click();
 await expect(page.locator('#siteLayoutBuildingConfirmedState')).toBeVisible();
 await expect(page.locator('#siteLayoutBoundaryStep')).toBeVisible();
 await expect(main).toHaveText('Confirm site layout');
 await expect(page.locator('#siteLayoutBoundaryCount')).toContainText('No boundaries marked');
 await expect(page.locator('#undoSiteLayoutBoundaryBtn')).toBeDisabled();
 await expect(page.locator('#finishSiteLayoutBoundaryBtn')).toBeDisabled();
 await main.click();
 await expect(main).toHaveText('Continue to Building Design');
 let facts=(await page.evaluate(()=>JSON.parse(localStorage.getItem('projectcheck_master_v1')))).projects[0].facts;
 expect(facts).toMatchObject({buildingPositionStatus:'confirmed',siteLayoutStatus:'confirmed',siteBoundaryStatus:'skipped'});
 expect(facts.relevantBoundaries).toEqual([]);
 const canvas=page.locator('#siteLayoutMap canvas');
 // Editing boundaries after confirmation invalidates the handoff; Skip confirms again without boundaries.
 await canvas.click({position:{x:65,y:85}});
 await expect(main).toHaveText('Confirm site layout');
 facts=(await page.evaluate(()=>JSON.parse(localStorage.getItem('projectcheck_master_v1')))).projects[0].facts;
 expect(facts.siteLayoutStatus).toBe('in_progress');
 await page.locator('#siteLayoutBoundaryStep').getByRole('button',{name:'Skip',exact:true}).click();
 await expect(main).toHaveText('Continue to Building Design');
 // Draw a boundary: Undo removes the last point, Done keeps the line.
 await canvas.click({position:{x:65,y:85}});
 await expect(main).toHaveText('Confirm site layout');
 await canvas.click({position:{x:145,y:110}});
 await canvas.click({position:{x:200,y:60}});
 await page.locator('#undoSiteLayoutBoundaryBtn').click();
 await expect(page.locator('#siteLayoutBoundaryStatus')).toHaveText('Point removed.');
 await expect(page.locator('#finishSiteLayoutBoundaryBtn')).toBeEnabled();
 await page.locator('#finishSiteLayoutBoundaryBtn').click();
 await expect(page.locator('#siteLayoutBoundaryCount')).toContainText('1 boundary marked');
 await expect(main).toHaveText('Confirm site layout');
 await main.click();
 await expect(main).toHaveText('Continue to Building Design');
 await page.getByRole('button',{name:'Back to Project Summary',exact:true}).click();
 await expect(page).toHaveURL(/#stage1Confirm\/[0-9a-f-]+$/);
 await page.goto(siteLayoutUrl);
 await expect(page.getByRole('heading',{name:'Position your building',exact:true,level:1})).toBeVisible();
 // Saved state reloads: confirmed, building angle and position restored, handoff button offered.
 await expect(main).toHaveText('Continue to Building Design');
 await expect(page.locator('#siteLayoutBuildingConfirmedState')).toBeVisible();
 await expect(page.locator('#siteLayoutBuildingAngle')).toHaveText(Math.round(angle2)+'°');
 await expect.poll(()=>page.evaluate(()=>activeSiteLayoutMarker&&activeSiteLayoutMarker.getLngLat().lng)).toBeCloseTo(moved.lng,6);
 await expect(page.locator('#siteLayoutBoundaryCount')).toContainText('1 boundary marked');
 await main.click();
 await expect(page).toHaveURL(/#buildingLayout\/[0-9a-f-]+$/);
 await expect(page.getByRole('heading',{name:'Confirm Site Layout first',exact:true})).toHaveCount(0);
 await page.goto(siteLayoutUrl);
 await page.getByRole('button',{name:'Back to Project Summary',exact:true}).click();
 await expect(page).toHaveURL(/#stage1Confirm\/[0-9a-f-]+$/);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('projectcheck_master_v1')));
 expect(stored.projects).toHaveLength(1);
 expect(stored.projects[0]).toMatchObject({name,address:'1 Test Way, Testville, WA12 9XX',facts:{length:'40',width:'24',height:'6'}});
 expect(stored.projects[0].facts).toMatchObject({buildingPositionStatus:'confirmed',siteBoundaryStatus:'confirmed',siteLayoutStatus:'confirmed'});
 expect(stored.projects[0].facts.relevantBoundaries).toHaveLength(1);
 expect(stored.projects[0].facts.relevantBoundaries[0]).toHaveLength(2);
 expect(stored.projects[0].facts.buildingFootprint.angle).toBeCloseTo(angle2,6);
 expect(stored.projects[0].facts.buildingFootprint.center.lng).toBeCloseTo(moved.lng,6);
 expect(stored.projects[0].facts.buildingFootprint.center.lat).toBeCloseTo(moved.lat,6);
 expect(stored.projects[0].facts.siteLayoutMapView.bearing,'map bearing saved separately from the building angle').toBe(0);
 expect(stored.projects[0].facts.siteLayoutMapView.baseLayer).toBe('satellite');
 expect(stored.projects[0].facts.siteLayoutUiVersion).toBe('figma-site-layout-redesign-2026-11-02');
 expect(errors,'current customer journey must not raise JavaScript errors').toEqual([]);
 h.assertNoUnexpectedDialogs(page);
};
