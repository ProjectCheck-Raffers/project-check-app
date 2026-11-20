// Serves /platform-config.js from Vercel environment variables so no key is stored in the repo.
module.exports=function platformConfig(request,response){
  const config={
    supabaseUrl:process.env.SUPABASE_URL||'',
    supabaseAnonKey:process.env.SUPABASE_PUBLISHABLE_KEY||'',
    environment:process.env.PROJECT_CHECK_ENVIRONMENT||'test'
  };
  response.setHeader('Content-Type','application/javascript; charset=utf-8');
  response.setHeader('Cache-Control','public, max-age=0, must-revalidate');
  response.status(200).send('window.PROJECT_CHECK_PLATFORM_CONFIG='+JSON.stringify(config)+';\n');
};
