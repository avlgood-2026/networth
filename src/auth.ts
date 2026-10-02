const cookieName='portfolio_session';
const encoder=new TextEncoder();
function hex(bytes:Uint8Array) { return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function digest(value:string) { return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))); }
function equal(a:Uint8Array,b:Uint8Array) {
 if(a.length!==b.length) return false;
 return a.reduce((diff,v,i)=>diff|(v^b[i]),0)===0;
}
export async function passwordMatches(supplied:string,configured:string) {
 if(!configured || configured.length<16) return false;
 return equal(await digest(supplied),await digest(configured));
}
export async function authorized(request:Request,secret:string) {
 if(!secret || secret.length<32) return false;
 return equal(await digest(request.headers.get('authorization')??''),await digest('Bearer '+secret));
}
async function signature(expiry:string,secret:string) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('portfolio:'+expiry))));
}
export async function makeSession(secret:string,now=Date.now()) {
 if(!secret || secret.length<32) throw new Error('Session secret unavailable');
 const expiry=String(Math.floor(now/1000)+7*86400);
 return `${expiry}.${await signature(expiry,secret)}`;
}
export async function hasSession(request:Request,secret:string,now=Date.now()) {
 if(!secret || secret.length<32) return false;
 const value=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';
 const match=/^(\d{10})\.([a-f0-9]{64})$/.exec(value);
 if(!match || Number(match[1])<Math.floor(now/1000)) return false;
 return equal(encoder.encode(match[2]),encoder.encode(await signature(match[1],secret)));
}
export function sessionCookie(value:string) { return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`; }
export function clearSessionCookie() { return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`; }
export function sameOrigin(request:Request) { return request.headers.get('origin')===new URL(request.url).origin; }
