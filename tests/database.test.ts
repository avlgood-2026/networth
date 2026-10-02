import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sync,recalculate } from '../src/sync';
function fixture() {
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync('migrations/0001_initial.sql','utf8'));
 db.exec(readFileSync('migrations/0002_revision_guard.sql','utf8'));
 db.exec(readFileSync('seeds/demo.sql','utf8'));
 db.exec(readFileSync('migrations/0003_assets_auth.sql','utf8'));
 function prepare(sql:string) {
  let values: (string|number)[]=[];
  return {
   bind(...args:(string|number)[]) { values=args; return this; },
   async all() { return {results:db.prepare(sql).all(...values)}; },
   async first() { return db.prepare(sql).get(...values); },
   async run() { return db.prepare(sql).run(...values); }
  };
 }
 const env={DB:{prepare,async batch(statements:ReturnType<typeof prepare>[]) {
  db.exec('BEGIN');
  try { for(const statement of statements) await statement.run(); db.exec('COMMIT'); }
  catch(error) { db.exec('ROLLBACK'); throw error; }
 }},TWELVE_DATA_API_KEY:'test',EOD_READY_UTC_HOUR:'23'} as unknown as CloudflareEnv;
 return {db,env};
}
test('sync upserts idempotently, rejects provider failures and recalculates edited history',async()=>{
 const {db,env}=fixture();
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>Response.json({meta:{symbol:'AAPL',currency:'USD'},values:[{datetime:'2026-09-30',close:'201'}]});
  await sync(env,new Date('2026-09-30T23:30:00Z'));
  await sync(env,new Date('2026-09-30T23:30:00Z'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM portfolio_daily').get()?.n,3);
  assert.equal(db.prepare('SELECT count(*) AS n FROM daily_prices').get()?.n,3);
  assert.equal(db.prepare("SELECT market_value FROM portfolio_daily WHERE date='2026-09-30'").get()?.market_value,'1608.00');
  globalThis.fetch=async()=>Response.json({status:'error'});
  await assert.rejects(sync(env,new Date('2026-09-30T23:30:00Z')));
  assert.equal(db.prepare("SELECT market_value FROM portfolio_daily WHERE date='2026-09-30'").get()?.market_value,'1608.00');
  db.exec("UPDATE transactions SET quantity_delta='-3' WHERE id='demo-sell'");
  assert.equal(db.prepare('SELECT count(*) AS n FROM portfolio_daily').get()?.n,2);
  assert.equal((await recalculate(env,'2026-09-30')).market_value,'1407.00');
 } finally { globalThis.fetch=original; db.close(); }
});

test('transaction edits during provider request abort all derived writes',async()=>{
 const {db,env}=fixture(); const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>{
   db.exec("UPDATE transactions SET quantity_delta='-4' WHERE id='demo-sell'");
   return Response.json({meta:{symbol:'AAPL',currency:'USD'},values:[{datetime:'2026-09-30',close:'999'}]});
  };
  await assert.rejects(sync(env,new Date('2026-09-30T23:30:00Z')));
  assert.equal(db.prepare("SELECT close FROM daily_prices WHERE date='2026-09-30'").get()?.close,'201');
  assert.equal(db.prepare("SELECT count(*) AS n FROM portfolio_daily WHERE date='2026-09-30'").get()?.n,0);
 } finally { globalThis.fetch=original; db.close(); }
});

test('scheduled stock-only run skips holidays without market data calls',async()=>{
 const {db,env}=fixture(); const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>{ throw new Error('provider should not be called'); };
  const result=await sync(env,new Date('2026-12-26T00:30:00Z'),true);
  assert.equal(result.status,'skipped');
  assert.equal(db.prepare("SELECT count(*) AS n FROM portfolio_daily WHERE date='2026-12-25'").get()?.n,0);
 } finally {globalThis.fetch=original;db.close();}
});

test('scheduled crypto portfolio values a completed weekend UTC day',async()=>{
 const {db,env}=fixture(); const original=globalThis.fetch;
 try {
  db.exec('DELETE FROM transactions');
  db.exec("INSERT INTO assets(ticker,kind) VALUES('BTC/USD','crypto')");
  db.exec("INSERT INTO transactions(id,ticker,transaction_date,type,quantity_delta) VALUES('crypto-buy','BTC/USD','2026-10-01','BUY','0.1')");
  globalThis.fetch=async()=>Response.json({meta:{symbol:'BTC/USD',currency:'USD'},values:[{datetime:'2026-10-04',close:'50000'}]});
  const result=await sync(env,new Date('2026-10-05T00:30:00Z'),true);
  assert.equal(result.status,'synced');
  assert.equal(db.prepare("SELECT market_value FROM portfolio_daily WHERE date='2026-10-04'").get()?.market_value,'5000.00');
  assert.equal(db.prepare("SELECT close FROM daily_prices WHERE ticker='BTC/USD' AND date='2026-10-04'").get()?.close,'50000');
 } finally {globalThis.fetch=original;db.close();}
});
