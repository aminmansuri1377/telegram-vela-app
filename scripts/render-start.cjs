require('dotenv/config');
const {execFileSync}=require('node:child_process');
async function start(){
  // Explicit one-time operator opt-in. No schema changes by default.
  if(process.env.APPLY_MIGRATIONS==='true'){
    execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{stdio:'inherit',timeout:180000});
  }
  const {createApp}=require('../dist/api/apps/api/src/main.js');
  const {app}=await createApp();
  await app.listen(Number(process.env.PORT||3001),'0.0.0.0');
}
start().catch(()=>{console.error('Render startup failed. Check build, secrets, Redis and migration status.');process.exitCode=1;});
