import { getCloudflareContext } from '@opennextjs/cloudflare';
import Chart from './chart';
export const dynamic='force-dynamic';
export default async function Page() {
 const {env}=await getCloudflareContext({async:true});
 const {results}=await env.DB.prepare('SELECT date,market_value FROM portfolio_daily ORDER BY date').all<{date:string;market_value:string}>();
 return <main className="mx-auto max-w-5xl p-10"><p className="text-sm uppercase tracking-widest text-teal-700">Personal portfolio · USD</p><h1 className="my-5 text-4xl font-semibold">Portfolio history</h1><section className="rounded-2xl bg-white p-8 shadow-sm"><p className="text-gray-500">Latest cached market value · {results.at(-1)?.date??'No data yet'}</p><p className="my-4 text-4xl">{Number(results.at(-1)?.market_value??0).toLocaleString('en-US',{style:'currency',currency:'USD'})}</p>{results.length?<Chart data={results.map(r=>({date:r.date,value:Number(r.market_value)}))}/>:<p>Run migrations, add transactions, then sync latest prices.</p>}</section><p className="mt-6 text-sm text-gray-600">Values use holdings on each trading date and that date’s closing prices. Cash and dividends are excluded. Sync is available through the protected admin endpoint.</p></main>;
}
