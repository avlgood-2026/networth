import { getCloudflareContext } from '@opennextjs/cloudflare';
import { clearSessionCookie, makeSession, passwordMatches, sameOrigin, sessionCookie } from '../../../src/auth';
export async function POST(request:Request) {
 if(!sameOrigin(request)) return Response.json({error:'Invalid origin'},{status:403});
 const {env}=await getCloudflareContext({async:true});
 if(!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length<16 || !env.CRON_SECRET) return Response.json({error:'Admin password is not configured'},{status:503});
 const ip=request.headers.get('cf-connecting-ip')??'local';
 const now=Math.floor(Date.now()/1000);
 const previous=await env.DB.prepare('SELECT attempts,window_start FROM login_attempts WHERE ip=?').bind(ip).first<{attempts:number;window_start:number}>();
 if(previous && now-previous.window_start<900 && previous.attempts>=5) return Response.json({error:'Too many attempts; try again in 15 minutes'},{status:429});
 const body=await request.json().catch(()=>({})) as {password?:unknown};
 const valid=typeof body.password==='string' && body.password.length<=256 && await passwordMatches(body.password,env.ADMIN_PASSWORD);
 if(!valid) {
  await env.DB.prepare('INSERT INTO login_attempts(ip,window_start,attempts) VALUES(?,?,1) ON CONFLICT(ip) DO UPDATE SET window_start=CASE WHEN ?-window_start>=900 THEN ? ELSE window_start END,attempts=CASE WHEN ?-window_start>=900 THEN 1 ELSE attempts+1 END').bind(ip,now,now,now,now).run();
  return Response.json({error:'Incorrect password'},{status:401});
 }
 await env.DB.prepare('DELETE FROM login_attempts WHERE ip=?').bind(ip).run();
 return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','set-cookie':sessionCookie(await makeSession(env.CRON_SECRET))}});
}
export async function DELETE(request:Request) {
 if(!sameOrigin(request)) return Response.json({error:'Invalid origin'},{status:403});
 return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','set-cookie':clearSessionCookie()}});
}
