const {writeFileSync}=require('node:fs');
process.env.NODE_ENV='test';
process.env.REDIS_URL='';
process.env.FRONTEND_URL='http://localhost:5173';
const {createApp}=require('../dist/api/apps/api/src/main.js');
createApp().then(async({app,doc,close})=>{await app.init();writeFileSync('docs/openapi.json',JSON.stringify(doc,null,2));await close();console.log('OpenAPI exported without listening on a port.');}).catch(e=>{console.error(e.message);process.exitCode=1;});
