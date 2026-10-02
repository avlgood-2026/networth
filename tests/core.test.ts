import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestCompleted,tradingDay } from '../src/calendar';
import { valueAt } from '../src/portfolio';
import { fetchClose,sync } from '../src/sync';
import { authorized } from '../src/auth';
test('weekends, holidays, summer/winter cutoff and early closes',()=>{
 assert.equal(latestCompleted(new Date('2026-10-01T22:59:00Z')),'2026-09-30');
 assert.equal(latestCompleted(new Date('2026-10-01T23:30:00Z')),'2026-10-01');
 assert.equal(latestCompleted(new Date('2026-11-27T23:30:00Z')),'2026-11-27');
 assert.equal(latestCompleted(new Date('2026-07-05T23:30:00Z')),'2026-07-02');
 assert.equal(latestCompleted(new Date('2026-12-28T18:00:00Z')),'2026-12-24');
 assert.equal(tradingDay('2027-12-31'),true);
 assert.throws(()=>tradingDay('2029-01-02'));
});
test('historical signed holdings and exact decimal arithmetic',()=>{
 const rows=[{ticker:'AAPL',transaction_date:'2026-09-28',quantity_delta:'10.1'},{ticker:'AAPL',transaction_date:'2026-09-30',quantity_delta:'-2'}];
 assert.equal(valueAt(rows,'2026-09-29',new Map([['AAPL','200.1']])),'2021.01');
 assert.equal(valueAt(rows,'2026-09-30',new Map([['AAPL','200.1']])),'1620.81');
 assert.throws(()=>valueAt(rows,'2026-09-30',new Map()));
 assert.throws(()=>valueAt([{...rows[0],quantity_delta:'-1'}],'2026-09-30',new Map([['AAPL','1']])));
 assert.equal(valueAt([...rows,{...rows[0],quantity_delta:'-8.1'}],'2026-09-30',new Map()),'0.00');
});
test('market data refuses stale, unavailable, non USD and invalid prices',async()=>{
 for(const body of [{status:'error'},{meta:{currency:'USD',symbol:'AAPL'},values:[{datetime:'2026-09-29',close:'2'}]},{meta:{currency:'EUR',symbol:'AAPL'},values:[{datetime:'2026-09-30',close:'2'}]}]) {
  await assert.rejects(fetchClose('AAPL','2026-09-30','test',async()=>Response.json(body)));
 }
 assert.equal(await fetchClose('AAPL','2026-09-30','test',async()=>Response.json({meta:{currency:'USD',symbol:'AAPL'},values:[{datetime:'2026-09-30',close:'201.12'}]})),'201.12');
 await assert.rejects(fetchClose('AAPL','2026-09-30','test',async()=>Response.json({status:'error',code:429,message:'credits exhausted for test'})),/credits exhausted for \[redacted\]/);
 await assert.rejects(fetchClose('AAPL','2026-09-30','test',async()=>Response.json({status:'error',code:400,message:'Invalid parameter'}, {status:400})),/Invalid parameter/);
});
test('admin auth fails closed',async()=>{
 const secret='a'.repeat(64);
 assert.equal(await authorized(new Request('http://local'),secret),false);
 assert.equal(await authorized(new Request('http://local',{headers:{authorization:'Bearer '+secret}}),secret),true);
 assert.equal(await authorized(new Request('http://local'),''),false);
});
