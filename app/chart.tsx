'use client';
import { LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer } from 'recharts';
export default function Chart({data}:{data:{date:string;value:number}[]}) {
 return <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="date"/><YAxis width={90}/><Tooltip/><Line dataKey="value" stroke="#0c8072" dot={false}/></LineChart></ResponsiveContainer></div>;
}
