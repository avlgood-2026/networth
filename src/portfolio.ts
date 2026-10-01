import Decimal from 'decimal.js';
export interface Transaction { ticker:string; transaction_date:string; quantity_delta:string }
export function holdingsAt(rows:Transaction[], date:string) {
 const holdings=new Map<string,Decimal>();
 for (const row of rows) if(row.transaction_date<=date) holdings.set(row.ticker,(holdings.get(row.ticker)??new Decimal(0)).plus(row.quantity_delta));
 return holdings;
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
