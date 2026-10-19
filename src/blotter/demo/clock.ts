// The sample firm works in New York. Intl supplies each date's DST offset.
export const TIME_ZONE = 'America/New_York';
const parts = (ms: number) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(ms).map(p => [p.type, p.value]));
export function localDay(ms: number | Date) {
  const p = parts(Number(ms)); return `${p.year}-${p.month}-${p.day}`;
}
/** Office-hour instants are unambiguous on both sides of a DST change. */
export function officeAt(date: string, hour = 9) {
  const [year, month, day] = date.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day, Math.floor(hour), Math.round(hour % 1 * 60));
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    const p = parts(instant), seen = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    instant += wall - seen;
  }
  return instant;
}
