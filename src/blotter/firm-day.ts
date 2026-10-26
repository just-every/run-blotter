/** Last UTC instant belonging to a firm's calendar date, including DST changes. */
export function firmDayEnd(day: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dateAt = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const wall = Date.parse(day + 'T00:00:00.000Z');
  let low = wall - 86_400_000, high = wall + 2 * 86_400_000;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (dateAt(middle) <= day) low = middle; else high = middle;
  }
  return new Date(low).toISOString();
}
