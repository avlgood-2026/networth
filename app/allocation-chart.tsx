'use client';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const colors=['#0f766e','#1d4ed8','#c2410c','#7c3aed','#0891b2','#be185d','#4d7c0f','#b45309','#0369a1','#a21caf','#4338ca','#0e7490','#a16207','#15803d','#be123c','#475569'];
const money=(value:number)=>value.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function AllocationChart({holdings}:{holdings:{ticker:string;value:string|null}[]}) {
 const data=holdings.filter(h=>h.value!==null && Number(h.value)>0).map(h=>({ticker:h.ticker,value:Number(h.value)}));
 const total=data.reduce((sum,item)=>sum+item.value,0);
 if(!total) return <div className="grid h-96 place-items-center text-center text-slate-500">同步价格后显示持仓占比。</div>;
 return <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(15rem,1fr)]">
  <div className="h-[390px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="ticker" cx="50%" cy="50%" outerRadius="76%" stroke="#fff" strokeWidth={2}>{data.map((item,index)=><Cell key={item.ticker} fill={colors[index%colors.length]}/>)}</Pie><Tooltip formatter={value=>money(Number(value))}/></PieChart></ResponsiveContainer></div>
  <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-2">{data.map((item,index)=><div key={item.ticker} className="flex min-w-0 items-center gap-2"><span className="size-3 shrink-0 rounded-sm" style={{backgroundColor:colors[index%colors.length]}}/><span className="truncate font-medium">{item.ticker}</span><span className="ml-auto tabular-nums text-slate-500">{item.value/total<0.0001?'<0.01%':`${(item.value/total*100).toFixed(2)}%`}</span></div>)}</div>
 </div>;
}
