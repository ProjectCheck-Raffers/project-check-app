const reviewBranch='feature/approved-project-journey-menu-2026-11-12';

module.exports=function stage1Review(request,response){
  response.setHeader('Cache-Control','private, no-store');
  if(request.method!=='GET'||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==reviewBranch){
    return response.status(404).end();
  }
  const user={
    id:'c76ca969-5851-47ad-b6a8-a3ac9dbb0cf8',
    name:'Demo Reviewer', company:'Example Industrial', email:'review@example.invalid'
  };
  const address='Demonstration site, SW1A 1AA';
  const center={lat:51.503,lng:-0.128};
  const metresPerDegree=111320;
  const longitudeMetres=metresPerDegree*Math.cos(center.lat*Math.PI/180);
  const corners=[[-7.5,-12],[7.5,-12],[7.5,12],[-7.5,12]].map(([east,north])=>({
    lat:center.lat+north/metresPerDegree,lng:center.lng+east/longitudeMetres
  }));
  const project={
    id:'0c6f2696-9067-436c-bb70-c7c791552453', owner:user.id,
    name:'Project Mount', address, postcode:'SW1A 1AA', status:'Active', stage:'Stage 1',
    created:'2026-11-12T00:00:00Z',
    facts:{
      role:'Facilities Manager', buildingUse:'Warehousing and general storage',
      buildingType:'Free-standing building', length:'24', width:'15', height:'5', roofPitch:'10',
      temperatureCondition:'Other temperature requirement', requiredTemperatureC:'1.5',
      base:'Concrete slab or concrete hardstanding',
      intendsToReuseExistingBase:'Yes — assess it for reuse', siteEvidenceAvailability:'No',
      clearSpan:'Yes', rollerCount:'1',
      rollerDoors:[{width:'5',height:'5',access:'HGV',widthSource:'user',heightSource:'user'}],
      personnelDoors:'1', level:'No', services:'Yes',
      closeBoundary:'Yes', programme:'3–6 months',
      buildingPositionStatus:'confirmed', buildingPosition:center,
      buildingFootprint:{center,length:24,width:15,angle:0,corners},
      siteBoundaryStatus:'confirmed', siteLayoutStatus:'confirmed', siteLayoutSiteAddress:address,
      siteLayoutMapView:{center,zoom:18.5,bearing:25,baseLayer:'satellite'},
      buildingDesignStatus:'draft',
      relevantBoundaries:[[{lat:51.5033,lng:-0.1283},{lat:51.5033,lng:-0.1277}]]
    },
    geometry:{
      width:15,length:24,eaveHeight:5,ridgeHeight:6.32,roofForm:'Duo-pitch (indicative)',
      structureType:'standard',openWall:null,connectionWall:null,
      doors:[
        {id:'rd1',ref:'R1',type:'roller',wall:'front',offset:5.5,width:4,height:4,access:'Van',source:'customer'},
        {id:'pd1',ref:'P1',type:'personnel',wall:'back',offset:1,width:1,height:2.1,source:'customer'},
        {id:'rd2',ref:'W1',type:'window',wall:'right',offset:1.2,width:1.8,height:0.8,sillHeight:1.4,bayIndex:0,source:'customer'},
        {id:'rd3',ref:'W2',type:'window',wall:'left',offset:6,width:1.8,height:0.8,sillHeight:1.4,bayIndex:1,source:'customer'}
      ],
      skylights:[
        {id:'sk1',ref:'S1',type:'skylight',width:1,length:2,offsetX:4,offsetY:6,bayIndex:1,source:'customer'}
      ]
    },
    buildingDesign:{status:'draft',lastView:'plan'},
    stage2:{}, evidence:[], quotes:[], history:[], risks1:[], actions1:[], risks2:[], actions2:[],
    stage1Complete:false, stage2Complete:false, stage1SummaryConfirmed:true
  };
  return response.status(200).json({user,project});
};
