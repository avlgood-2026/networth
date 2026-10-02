'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Chart from './chart';
import AllocationChart from './allocation-chart';
import QuantityChart, { type QuantityPoint } from './quantity-chart';
import { portfolioDate } from '../src/date';

type Holding={ticker:string;kind:'stock'|'crypto';quantity:string;close:string|null;priceDate:string|null;value:string|null};
type Point={date:string;value:number};
type ApiBody={error?:string;status?:string;date?:string;market_value?:string;reason?:string;quantity_delta?:string};
const money=(value:number)=>value.toLocaleString('en-US',{style:'currency',currency:'USD'});
const units=(value:string)=>Number(value).toLocaleString('en-US',{maximumFractionDigits:12});

export default function Dashboard({holdings,history,quantityHistory}:{holdings:Holding[];history:Point[];quantityHistory:Record<string,QuantityPoint[]>}) {
 const router=useRouter();
 const [kind,setKind]=useState<'stock'|'crypto'>('stock');
 const [action,setAction]=useState<'BUY'|'SELL'|'RESET'>('BUY');
 const [ticker,setTicker]=useState('');
 const [quantity,setQuantity]=useState('');
 const [date,setDate]=useState(portfolioDate(new Date()));
 const [selected,setSelected]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const last=history.at(-1),prev=history.at(-2),change=last&&prev?last.value-prev.value:null;
 const allocationTotal=holdings.reduce((sum,h)=>sum+Number(h.value??0),0);

 async function syncNow() {
  setBusy(true);setMessage('');
  try {
   const response=await fetch('/api/admin/sync',{method:'POST'});
   const body=await response.json() as ApiBody;
   if(!response.ok) throw new Error(body.error??'同步失败');
   setMessage(body.status==='synced'?`价格已更新：${body.date}，净值 ${money(Number(body.market_value))}`:body.reason??'没有新数据');
   router.refresh();
  } catch(error) { setMessage(error instanceof Error?error.message:'同步失败'); }
  finally { setBusy(false); }
 }
 async function add(event:FormEvent) {
  event.preventDefault();setBusy(true);setMessage('');
  try {
   const response=await fetch('/api/transactions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,action,ticker,quantity,date})});
   const body=await response.json() as ApiBody;
   if(!response.ok) throw new Error(body.error??'保存失败');
   if(body.status==='unchanged') setMessage('股数没有变化，未新增交易。');
   else if(action==='RESET') {
    const delta=Number(body.quantity_delta);
    setMessage(`已按目标股数记录${delta>0?'买入':'卖出'} ${units(String(Math.abs(delta)))} ${ticker}。点击“同步最新价格”更新净值。`);
   } else setMessage('交易已保存。点击“同步最新价格”更新净值。');
   setTicker('');setQuantity('');router.refresh();
  } catch(error) { setMessage(error instanceof Error?error.message:'保存失败'); }
  finally { setBusy(false); }
 }
 async function logout() { await fetch('/api/auth',{method:'DELETE'});router.refresh(); }

 return <main className="mx-auto max-w-6xl px-5 py-8 md:px-10">
  <header className="mb-9 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.3em] text-teal-700">Personal portfolio</p><h1 className="mt-2 text-3xl font-bold">净值总览</h1></div><button onClick={logout} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">退出登录</button></header>
  <div className="grid gap-5 md:grid-cols-3">
   <section className="rounded-2xl bg-slate-950 p-6 text-white md:col-span-2"><p className="text-sm text-slate-300">最近一次记录的净值 · {last?.date??'等待首次同步'}</p><p className="mt-4 text-4xl font-semibold">{last?money(last.value):'—'}</p><p className="mt-3 text-sm text-slate-300">{change===null?'每日同步后开始记录变化':`较上一记录 ${change>=0?'+':''}${money(change)}`}</p></section>
   <section className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">持仓资产</p><p className="mt-3 text-4xl font-semibold">{holdings.length}</p><button disabled={busy} onClick={syncNow} className="mt-5 w-full rounded-xl bg-teal-700 px-4 py-3 font-medium text-white disabled:opacity-50">{busy?'正在处理…':'同步最新价格'}</button></section>
  </div>
  {message&&<p role="status" className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">{message}</p>}
  <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
   <section className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-baseline justify-between"><h2 className="text-xl font-semibold">净值变化</h2><span className="text-xs text-slate-500">USD · 每日收盘价</span></div>{history.length?<Chart data={history}/>:<div className="grid h-80 place-items-center text-center text-slate-500">暂无净值记录。添加持仓后同步价格即可开始绘图。</div>}</section>
   <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">添加交易</h2><p className="mt-1 text-sm text-slate-500">买入、卖出，或把持仓重置到指定股数。</p><form onSubmit={add} className="mt-5 space-y-4">
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">类别<select value={kind} onChange={e=>{setKind(e.target.value as 'stock'|'crypto');setTicker('');}} className="mt-1 w-full rounded-xl border p-3"><option value="stock">股票 / ETF</option><option value="crypto">加密货币</option></select></label><label className="text-sm">操作<select value={action} onChange={e=>setAction(e.target.value as 'BUY'|'SELL'|'RESET')} className="mt-1 w-full rounded-xl border p-3"><option value="BUY">买入 / 增加</option><option value="SELL">卖出 / 减少</option><option value="RESET">股数重置</option></select></label></div>
    <label className="block text-sm">{kind==='crypto'?'交易对（如 BTC/USD）':'股票代码（如 AAPL）'}<input required value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder={kind==='crypto'?'BTC/USD':'AAPL'} className="mt-1 w-full rounded-xl border p-3"/></label>
    <label className="block text-sm">{action==='RESET'?'重置后总股数（unit）':'数量（unit）'}<input required type="number" min={action==='RESET'?'0':'0.000000000001'} step="any" value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
    {action==='RESET'&&<p className="text-xs text-slate-500">例如当前 100 股，输入 104 股会记录买入 4 股；输入 96 股会记录卖出 4 股。</p>}
    <label className="block text-sm">交易日期<input required type="date" max={portfolioDate(new Date())} value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
    <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50">{action==='RESET'?'重置股数':'保存交易'}</button>
   </form></section>
  </div>
  <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">持仓占比</h2><span className="text-sm text-slate-500">按估算市值 · {allocationTotal?money(allocationTotal):'等待价格'}</span></div><p className="mt-1 text-sm text-slate-500">包含股票、ETF 和加密货币；每种颜色对应右侧一个资产。</p><AllocationChart holdings={holdings}/></section>
  <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">当前持仓</h2><span className="text-sm text-slate-500">按估算市值从高到低排列 · 点击资产查看股数变化</span></div>{holdings.length?<div className="mt-4 divide-y">{holdings.map(h=>{
   const share=allocationTotal&&h.value?Number(h.value)/allocationTotal*100:null;
   const points=quantityHistory[h.ticker]??[];
   return <div key={h.ticker}><button type="button" aria-expanded={selected===h.ticker} onClick={()=>setSelected(selected===h.ticker?null:h.ticker)} className="grid w-full grid-cols-2 gap-2 py-4 text-left text-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 md:grid-cols-4"><div><span className="font-semibold text-teal-800 underline-offset-2 hover:underline">{h.ticker}</span><p className="text-slate-500">{h.kind==='crypto'?'Crypto':'Stock / ETF'}</p></div><div><p className="text-slate-500">股数 / unit</p><p>{units(h.quantity)}</p></div><div><p className="text-slate-500">最近收盘价</p><p>{h.close?`${money(Number(h.close))} · ${h.priceDate}`:'等待同步'}</p></div><div><p className="text-slate-500">估算市值</p><p className="font-semibold">{h.value?money(Number(h.value)):'—'}</p>{share!==null&&<p className="text-xs text-slate-500">占比 {share.toFixed(2)}%</p>}</div></button>
    {selected===h.ticker&&<div className="mb-5 rounded-2xl border border-teal-100 bg-teal-50/60 p-5"><div className="flex items-baseline justify-between gap-3"><div><h3 className="text-lg font-semibold">{h.ticker} · 股数变化</h3><p className="text-sm text-slate-500">按交易日期累计，包含同一天的全部买入和卖出。</p></div><button type="button" onClick={()=>setSelected(null)} className="text-sm text-teal-800">收起</button></div><QuantityChart points={points}/><div className="mt-3 divide-y border-t border-teal-100">{[...points].reverse().map(point=><div key={point.date} className="flex justify-between gap-3 py-2 text-sm"><span>{point.date}</span><span className="text-slate-600">当日变化 {Number(point.delta)>0?'+':''}{units(point.delta)}</span><span className="font-medium">累计 {units(point.quantity)}</span></div>)}</div></div>}
   </div>;
  })}</div>:<p className="mt-4 text-slate-500">暂无持仓。在上方添加股票或加密货币。</p>}</section>
  <p className="mt-6 text-xs text-slate-500">股票使用最近交易日收盘价；加密货币使用已完成的 UTC 日线。净值不含现金、费用和股息。历史曲线会随每日同步累积。</p>
 </main>;
}
