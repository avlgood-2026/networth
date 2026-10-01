import { latestCompleted, tradingDay } from './calendar';
import { valueAt, type Transaction } from './portfolio';
export async function fetchClose(ticker:string,date:string,key:string,fetcher:typeof fetch=fetch) {
 if(!key) throw new Error('Market data secret is not configured');
 const url=new URL('https://api.twelvedata.com/time_series');
 url.search=new URLSearchParams({symbol:ticker,interval:'1day',start_date:date,end_date:date,outputsize:'1',adjust:'none',country:'United States',apikey:key}).toString();
 let response:Response;
 try { response=await fetcher(url,{signal:AbortSignal.timeout(20000)}); }
 catch { throw new Error(`Market data request failed for ${ticker}`); }
 if(!response.ok) throw new Error(`Market data HTTP ${response.status} for ${ticker}`);
 const body=await response.json() as {status?:string;meta?:{currency?:string;symbol?:string};values?:{datetime:string;close:string}[]};
 const bar=body.values?.find(v=>v.datetime===date);
 if(body.status==='error' || !bar || !/^\d+(\.\d+)?$/.test(bar.close) || Number(bar.close)<=0 || body.meta?.currency!=='USD' || body.meta?.symbol!==ticker) throw new Error(`Final USD EOD data unavailable for ${ticker} on ${date}`);
 return bar.close;
}
export async function recalculate(env:CloudflareEnv,date:string) {
 if(!tradingDay(date)) throw new Error('Not a trading date');
 const revision=await env.DB.prepare('SELECT version FROM portfolio_revision WHERE id=1').all<{version:number}>();
 const version=revision.results[0].version;
 const tx=await env.DB.prepare('SELECT ticker,transaction_date,quantity_delta FROM transactions').all<Transaction>();
 const rows=await env.DB.prepare('SELECT ticker,close FROM daily_prices WHERE date=?').bind(date).all<{ticker:string;close:string}>();
 const value=valueAt(tx.results,date,new Map(rows.results.map(r=>[r.ticker,r.close])));
 await env.DB.prepare('INSERT INTO portfolio_daily(id,date,market_value) VALUES(?,?,CASE WHEN (SELECT version FROM portfolio_revision WHERE id=1)=? THEN ? ELSE NULL END) ON CONFLICT(date) DO UPDATE SET market_value=excluded.market_value,updated_at=CURRENT_TIMESTAMP').bind(crypto.randomUUID(),date,version,value).run();
 return {date,market_value:value};
}
export async function sync(env:CloudflareEnv,now=new Date(),scheduled=false) {
 const today=now.toISOString().slice(0,10);
 if(scheduled && !tradingDay(today)) return {status:'skipped',reason:'Market closed'};
 const date=latestCompleted(now,Number(env.EOD_READY_UTC_HOUR||23));
 const revision=await env.DB.prepare('SELECT version FROM portfolio_revision WHERE id=1').all<{version:number}>();
 const version=revision.results[0].version;
 const tx=await env.DB.prepare('SELECT ticker,transaction_date,quantity_delta FROM transactions').all<Transaction>();
 const tickers=[...new Set(tx.results.filter(r=>r.transaction_date<=date).map(r=>r.ticker))];
 if(!tickers.length) return {status:'skipped',reason:'No transactions'};
 const prices=new Map<string,string>();
 // Sequential, paced requests suit small portfolios and low API credit allowances.
 for(const ticker of tickers) {
  if(prices.size) await new Promise(resolve=>setTimeout(resolve,8100));
  prices.set(ticker,await fetchClose(ticker,date,env.TWELVE_DATA_API_KEY));
 }
 const value=valueAt(tx.results,date,prices);
 // D1 batch is atomic: no partial prices or portfolio value on failure.
 await env.DB.batch([
  ...[...prices].map(([ticker,close])=>env.DB.prepare('INSERT INTO daily_prices(id,ticker,date,close) VALUES(?,?,?,?) ON CONFLICT(ticker,date) DO UPDATE SET close=excluded.close').bind(crypto.randomUUID(),ticker,date,close)),
  env.DB.prepare('INSERT INTO portfolio_daily(id,date,market_value) VALUES(?,?,CASE WHEN (SELECT version FROM portfolio_revision WHERE id=1)=? THEN ? ELSE NULL END) ON CONFLICT(date) DO UPDATE SET market_value=excluded.market_value,updated_at=CURRENT_TIMESTAMP').bind(crypto.randomUUID(),date,version,value)
 ]);
 return {status:'synced',date,tickers:tickers.length,market_value:value};
}
