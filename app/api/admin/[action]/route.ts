import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authorized } from '../../../../src/auth';
import { sync,recalculate } from '../../../../src/sync';
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {
 const {env}=await getCloudflareContext({async:true});
 if(!await authorized(request,env.CRON_SECRET)) return Response.json({error:'Unauthorized'},{status:401});
 const {action}=await params;
 try {
  if(action==='sync') return Response.json(await sync(env));
  if(action==='recalculate') {
   const body=await request.json() as {date:string};
   return Response.json(await recalculate(env,body.date));
  }
  return Response.json({error:'Not found'},{status:404});
 } catch { return Response.json({error:'Operation failed. Check calendar, holdings, API availability and exact-date cached prices.'},{status:503}); }
}
