import { latestCompleted, tradingDay } from './calendar';
import { holdingsAt, valueAt, type Transaction } from './portfolio';
type Asset={ticker:string;kind:'stock'|'crypto'};
export async function fetchClose(ticker:string,date:string,key:string,fetcher:typeof fetch=fetch,kind:'stock'|'crypto'='stock') {
 if(!key) throw new Error('Market data secret is not configured');
 const url=new URL('https://api.twelvedata.com/time_series');
 const query:Record<string,string>={symbol:ticker,interval:'1day',start_date:date,end_date:date,outputsize:'1',apikey:key};
 if(kind==='stock') { query.adjust='none'; query.country='United States'; }
 else query.timezone='UTC';
 url.search=new URLSearchParams(query).toString();
 let response:Response;
 try { response=await fetcher(url,{signal:AbortSignal.timeout(20000)}); }
 catch { throw new Error(`Market data request failed for ${ticker}`); }
 const body=await response.json().catch(()=>({})) as {status?:string;code?:number;message?:string;meta?:{currency?:string;symbol?:string};values?:{datetime:string;close:string}[]};
 if(!response.ok) throw new Error(`Twelve Data HTTP ${response.status} for ${ticker}: ${String(body.message??'request failed').replaceAll(key,'[redacted]').slice(0,160)}`);
 const bar=body.values?.find(v=>v.datetime===date);
 if(body.status==='error') throw new Error(`Twelve Data error ${body.code??'unknown'} for ${ticker}: ${String(body.message??'request rejected').replaceAll(key,'[redacted]').slice(0,160)}`);
 if(!bar) throw new Error(`Final daily close unavailable for ${ticker} on ${date}; provider returned ${body.values?.[0]?.datetime??'no date'}`);
 if(!/^\d+(\.\d+)?$/.test(bar.close) || Number(bar.close)<=0) throw new Error(`Invalid daily close for ${ticker} on ${date}`);
 if(body.meta?.currency!=='USD' || body.meta?.symbol!==ticker) throw new Error(`Unexpected currency or symbol for ${ticker} on ${date}`);
 return bar.close;
}
async function transactionSnapshot(env:CloudflareEnv) {
 const revision=await env.DB.prepare('SELECT version FROM portfolio_revision WHERE id=1').first<{version:number}>();
 const tx=await env.DB.prepare('SELECT ticker,transaction_date,quantity_delta FROM transactions').all<Transaction>();
 const assets=await env.DB.prepare('SELECT ticker,kind FROM assets').all<Asset>();
 return {version:revision?.version??0,tx:tx.results,assets:new Map(assets.results.map(a=>[a.ticker,a.kind]))};
}
async function cachedPrices(env:CloudflareEnv,date:string,assets:Map<string,Asset['kind']>) {
 const prices=new Map<string,string>();
 for(const [ticker,kind] of assets) {
  const priceDate=kind==='stock'?latestCompleted(date===new Date().toISOString().slice(0,10)?new Date():new Date(date+'T23:30:00Z')):(date===new Date().toISOString().slice(0,10)?new Date(Date.now()-86400000).toISOString().slice(0,10):date);
  const row=await env.DB.prepare('SELECT close FROM daily_prices WHERE ticker=? AND date=?').bind(ticker,priceDate).first<{close:string}>();
  if(row) prices.set(ticker,row.close);
 }
 return prices;
}
export async function recalculate(env:CloudflareEnv,date:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
 const {version,tx,assets}=await transactionSnapshot(env);
 const value=valueAt(tx,date,await cachedPrices(env,date,assets));
 await env.DB.prepare('INSERT INTO portfolio_daily(id,date,market_value) VALUES(?,?,CASE WHEN (SELECT version FROM portfolio_revision WHERE id=1)=? THEN ? ELSE NULL END) ON CONFLICT(date) DO UPDATE SET market_value=excluded.market_value,updated_at=CURRENT_TIMESTAMP').bind(crypto.randomUUID(),date,version,value).run();
 return {date,market_value:value};
}
export async function sync(env:CloudflareEnv,now=new Date(),scheduled=false) {
 // Cron at 06:30 UTC values the just-completed UTC day. Manual sync is a
 // current estimate using the latest completed stock/crypto closes.
 const date=new Date(now.getTime()-(scheduled?86400000:0)).toISOString().slice(0,10);
 const {version,tx,assets}=await transactionSnapshot(env);
 const active=[...holdingsAt(tx,date)].filter(([,quantity])=>!quantity.isZero());
 if(!active.length) return {status:'skipped',reason:'No holdings for date',date};
 if(scheduled && !tradingDay(date) && !active.some(([ticker])=>assets.get(ticker)==='crypto')) return {status:'skipped',reason:'Market closed; no crypto holdings',date};
 const prices=new Map<string,string>(), fetched:{ticker:string;date:string;close:string}[]=[];
 let lastRequest=0;
 async function requestClose(ticker:string,date:string,kind:Asset['kind']) {
  if(lastRequest) await new Promise(resolve=>setTimeout(resolve,Math.max(0,8100-(Date.now()-lastRequest))));
  lastRequest=Date.now();
  return fetchClose(ticker,date,env.TWELVE_DATA_API_KEY,fetch,kind);
 }
 for(const [ticker] of active) {
  const kind=assets.get(ticker);
  if(!kind) throw new Error(`Unknown asset type for ${ticker}`);
  let priceDate=kind==='stock'?latestCompleted(scheduled?new Date(date+'T23:30:00Z'):now):(scheduled?date:new Date(now.getTime()-86400000).toISOString().slice(0,10));
  let close:string;
  try { close=await requestClose(ticker,priceDate,kind); }
  catch(error) {
   if(scheduled || !(error instanceof Error) || !/No data is available on the specified dates|Final daily close unavailable/i.test(error.message)) throw error;
   priceDate=kind==='stock'?latestCompleted(new Date(priceDate+'T12:00:00Z')):new Date(new Date(priceDate+'T12:00:00Z').getTime()-86400000).toISOString().slice(0,10);
   close=await requestClose(ticker,priceDate,kind);
  }
  prices.set(ticker,close); fetched.push({ticker,date:priceDate,close});
 }
 const value=valueAt(tx,date,prices);
 await env.DB.batch([
  ...fetched.map(p=>env.DB.prepare('INSERT INTO daily_prices(id,ticker,date,close) VALUES(?,?,?,?) ON CONFLICT(ticker,date) DO UPDATE SET close=excluded.close').bind(crypto.randomUUID(),p.ticker,p.date,p.close)),
  env.DB.prepare('INSERT INTO portfolio_daily(id,date,market_value) VALUES(?,?,CASE WHEN (SELECT version FROM portfolio_revision WHERE id=1)=? THEN ? ELSE NULL END) ON CONFLICT(date) DO UPDATE SET market_value=excluded.market_value,updated_at=CURRENT_TIMESTAMP').bind(crypto.randomUUID(),date,version,value)
 ]);
 return {status:'synced',date,tickers:active.length,market_value:value,estimate:!scheduled};
}
