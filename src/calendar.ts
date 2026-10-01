// NYSE published calendar. Fail closed outside the reviewed years; review annually
// and add exceptional closures here as announced.
const holidays: Record<string,string[]> = {
 '2026':['01-01','01-19','02-16','04-03','05-25','06-19','07-03','09-07','11-26','12-25'],
 '2027':['01-01','01-18','02-15','03-26','05-31','06-18','07-05','09-06','11-25','12-24'],
 '2028':['01-17','02-21','04-14','05-29','06-19','07-04','09-04','11-23','12-25']
};
export function tradingDay(date: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date) throw new Error('Invalid date');
 const closed=holidays[date.slice(0,4)];
 if (!closed) throw new Error('Trading calendar needs annual review');
 const day=new Date(date+'T12:00:00Z').getUTCDay();
 return day!==0 && day!==6 && !closed.includes(date.slice(5));
}
export function latestCompleted(now: Date, readyHour=23): string {
 const date=new Date(now);
 if (date.getUTCHours()<readyHour) date.setUTCDate(date.getUTCDate()-1);
 while (!tradingDay(date.toISOString().slice(0,10))) date.setUTCDate(date.getUTCDate()-1);
 return date.toISOString().slice(0,10);
}
