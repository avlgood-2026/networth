'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
export default function Login() {
 const router=useRouter();const [password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent) {
  event.preventDefault();setBusy(true);setMessage('');
  try { const response=await fetch('/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})}); const body=await response.json() as {error?:string}; if(!response.ok) throw new Error(body.error??'登录失败');setPassword('');router.refresh(); }
  catch(error) {setMessage(error instanceof Error?error.message:'登录失败');} finally {setBusy(false);}
 }
 return <main className="min-h-screen grid place-items-center p-6 bg-slate-950"><form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-9 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-[.3em] text-teal-700">Networth</p><h1 className="mt-4 text-3xl font-bold">管理员登录</h1><p className="mt-2 text-sm text-slate-500">输入管理员密码查看和管理持仓。</p><label htmlFor="password" className="mt-8 block text-sm font-medium">密码</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"/><button disabled={busy} className="mt-5 w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?'正在验证…':'进入仪表板'}</button>{message&&<p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}</form></main>;
}
