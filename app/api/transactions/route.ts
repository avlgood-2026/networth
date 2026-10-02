import Decimal from 'decimal.js';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { hasSession,sameOrigin } from '../../../src/auth';
import { holdingsAt,type Transaction } from '../../../src/portfolio';
import { portfolioDate } from '../../../src/date';
export async function POST(request:Request) {
 const {env}=await getCloudflareContext({async:true});
 if(!sameOrigin(request) || !await hasSession(request,env.CRON_SECRET)) return Response.json({error:'Unauthorized'},{status:401});
 const body=await request.json().catch(()=>({})) as Record<string,unknown>;
 const kind=body.kind, action=body.action, ticker=String(body.ticker??'').trim().toUpperCase(), date=String(body.date??''), quantity=String(body.quantity??'');
 if(kind!=='stock' && kind!=='crypto' || action!=='BUY' && action!=='SELL') return Response.json({error:'Choose asset type and transaction type'},{status:400});
 if(kind==='stock' ? !/^[A-Z][A-Z0-9.]{0,9}$/.test(ticker) : !/^[A-Z0-9]{2,12}\/USD$/.test(ticker)) return Response.json({error:'Use a stock ticker or a crypto pair such as BTC/USD'},{status:400});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date || date>portfolioDate(new Date())) return Response.json({error:'Enter a valid past or current date'},{status:400});
 if(!/^\d{1,12}(\.\d{1,12})?$/.test(quantity) || !new Decimal(quantity).isPositive()) return Response.json({error:'Enter a positive quantity, up to 12 decimal places'},{status:400});
 const existing=await env.DB.prepare('SELECT kind FROM assets WHERE ticker=?').bind(ticker).first<{kind:string}>();
 if(existing && existing.kind!==kind) return Response.json({error:'Ticker already exists as another asset type'},{status:409});
 const tx=await env.DB.prepare('SELECT ticker,transaction_date,quantity_delta FROM transactions WHERE ticker=?').bind(ticker).all<Transaction>();
 const delta=action==='BUY'?new Decimal(quantity):new Decimal(quantity).negated();
 const projected=[...tx.results,{ticker,transaction_date:date,quantity_delta:delta.toString()}];
 for(const day of [...new Set(projected.map(row=>row.transaction_date))].sort()) if(holdingsAt(projected,day).get(ticker)?.isNegative()) return Response.json({error:'This sale exceeds shares held on a historical date'},{status:400});
 try {
  await env.DB.batch([
   env.DB.prepare('INSERT INTO assets(ticker,kind) VALUES(?,?) ON CONFLICT(ticker) DO NOTHING').bind(ticker,kind),
   env.DB.prepare('INSERT INTO transactions(id,ticker,transaction_date,type,quantity_delta) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),ticker,date,action,delta.toString())
  ]);
 } catch { return Response.json({error:'Could not save transaction'},{status:503}); }
 return Response.json({ok:true,ticker,quantity_delta:delta.toString()},{status:201});
}
