import Decimal from 'decimal.js';
import { headers } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { hasSession } from '../src/auth';
import { holdingsAt,type Transaction } from '../src/portfolio';
import Login from './login';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export default async function Page() {
 const {env}=await getCloudflareContext({async:true});
 const incoming=await headers();
 if(!await hasSession(new Request('https://portfolio.local/',{headers:{cookie:incoming.get('cookie')??''}}),env.CRON_SECRET)) return <Login/>;
 const [tx,assets,history,priceRows]=await Promise.all([
  env.DB.prepare('SELECT ticker,transaction_date,quantity_delta FROM transactions').all<Transaction>(),
  env.DB.prepare('SELECT ticker,kind FROM assets').all<{ticker:string;kind:'stock'|'crypto'}>(),
  env.DB.prepare('SELECT date,market_value FROM portfolio_daily ORDER BY date').all<{date:string;market_value:string}>(),
  env.DB.prepare('SELECT ticker,date,close FROM daily_prices ORDER BY date DESC').all<{ticker:string;date:string;close:string}>()
 ]);
 const kinds=new Map(assets.results.map(a=>[a.ticker,a.kind]));
 const latest=new Map<string,{date:string;close:string}>();
 for(const row of priceRows.results) if(!latest.has(row.ticker)) latest.set(row.ticker,{date:row.date,close:row.close});
 const today=new Date().toISOString().slice(0,10);
 const holdings=[...holdingsAt(tx.results,today)].filter(([,qty])=>!qty.isZero()).map(([ticker,qty])=>{
  const price=latest.get(ticker);
  return {ticker,kind:kinds.get(ticker)??'stock',quantity:qty.toString(),close:price?.close??null,priceDate:price?.date??null,value:price?qty.times(new Decimal(price.close)).toFixed(2):null};
 });
 return <Dashboard holdings={holdings} history={history.results.map(r=>({date:r.date,value:Number(r.market_value)}))}/>;
}
