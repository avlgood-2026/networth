import Decimal from 'decimal.js';
export interface Transaction { ticker:string; transaction_date:string; quantity_delta:string }
export function holdingsAt(rows:Transaction[], date:string) {
 const holdings=new Map<string,Decimal>();
 for (const row of rows) if(row.transaction_date<=date) holdings.set(row.ticker,(holdings.get(row.ticker)??new Decimal(0)).plus(row.quantity_delta));
 return holdings;
}
export function resetDelta(rows:Transaction[], ticker:string, date:string, target:string) {
 return new Decimal(target).minus(holdingsAt(rows,date).get(ticker)??new Decimal(0));
}
export function quantityTimelines(rows:Transaction[]) {
 const daily=new Map<string,Map<string,Decimal>>();
 for(const row of rows) {
  const dates=daily.get(row.ticker)??new Map<string,Decimal>();
  dates.set(row.transaction_date,(dates.get(row.transaction_date)??new Decimal(0)).plus(row.quantity_delta));
  daily.set(row.ticker,dates);
 }
 const timelines:Record<string,{date:string;quantity:string;delta:string}[]>={};
 for(const [ticker,dates] of daily) {
  let quantity=new Decimal(0);
  timelines[ticker]=[...dates].sort(([a],[b])=>a.localeCompare(b)).map(([date,delta])=>{
   quantity=quantity.plus(delta);
   return {date,quantity:quantity.toString(),delta:delta.toString()};
  });
 }
 return timelines;
}
export function valueAt(rows:Transaction[], date:string, prices:Map<string,string>) {
 let total=new Decimal(0);
 for(const [ticker,quantity] of holdingsAt(rows,date)) {
  if(quantity.isNegative()) throw new Error(`Negative holdings for ${ticker} on ${date}`);
  if(quantity.isZero()) continue;
  const price=prices.get(ticker);
  if(!price || !new Decimal(price).isPositive()) throw new Error(`Missing price for ${ticker} on ${date}`);
  total=total.plus(quantity.times(price));
 }
 return total.toFixed(2);
}
