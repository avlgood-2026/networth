// @ts-ignore OpenNext generates this module during build.
import handler from './.open-next/worker.js';
import { sync } from './src/sync';
export default {
 fetch: handler.fetch,
 async scheduled(event:ScheduledController,env:CloudflareEnv) {
  try { console.log(JSON.stringify(await sync(env,new Date(event.scheduledTime),true))); }
  catch(error) { console.error('EOD sync failed; retry via protected manual endpoint'); throw error; }
 }
} satisfies ExportedHandler<CloudflareEnv>;
