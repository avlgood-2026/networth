const action=process.argv[2];
const date=process.argv[3];
if(!process.env.CRON_SECRET) throw Error('Set CRON_SECRET in .dev.vars');
if(action==='recalculate' && !date) throw Error('Usage: npm run recalculate -- YYYY-MM-DD');
const response=await fetch(`${process.env.APP_URL||'http://localhost:3000'}/api/admin/${action}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`,'Content-Type':'application/json'},body:JSON.stringify({date})});
console.log(await response.text());
if(!response.ok) process.exitCode=1;
