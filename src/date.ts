export function portfolioDate(now:Date) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(type:string)=>parts.find(part=>part.type===type)?.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}
