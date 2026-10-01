export async function authorized(request:Request,secret:string) {
 if(!secret || secret.length<32) return false;
 const supplied=request.headers.get('authorization')??'';
 const digest=async (s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([digest(supplied),digest('Bearer '+secret)]);
 return a.reduce((diff,v,i)=>diff|(v^b[i]),0)===0;
}
