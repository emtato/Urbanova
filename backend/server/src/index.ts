import { createApp } from './app.js';
import { settings } from './config.js';
import { PgStore } from './storage/store.js';
import { startScheduler } from './worker/scheduler.js';
const store=new PgStore();
try{
  await store.init();
  const stop=startScheduler(store),server=createApp(store).listen(settings.port,'0.0.0.0',()=>console.log(`FutureProof Express listening on ${settings.port}; default evaluator=B11; fixture mode requires an explicit request`));
  let closing=false;
  const close=async()=>{if(closing)return;closing=true;await stop();server.close(()=>void store.close());};
  process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
}catch{console.error('API startup failed. Check DATABASE_URL and run npm run db:init in backend/server.');await store.close();process.exitCode=1;}
