'use client';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
export type QuantityPoint={date:string;quantity:string;delta:string};
export default function QuantityChart({points}:{points:QuantityPoint[]}) {
 const data=points.map(point=>({date:point.date,quantity:Number(point.quantity)}));
 return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:12,right:20,bottom:8,left:8}}><XAxis dataKey="date"/><YAxis width={75} domain={[0,'auto']}/><Tooltip formatter={value=>[Number(value).toLocaleString('en-US',{maximumFractionDigits:12}),'股数']}/><Line type="stepAfter" dataKey="quantity" stroke="#0f766e" strokeWidth={3} dot={{r:4}} activeDot={{r:6}}/></LineChart></ResponsiveContainer></div>;
}
