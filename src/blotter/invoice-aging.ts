// Shared receivable aging: whole days past the due date, in the firm's calendar.
export const AGING_BUCKETS = ['current', '1-30 days', '31-60 days', '61-90 days', 'over 90 days'] as const;
export function agingBucket(asOf: string, due: string) {
  const late = Math.round((Date.parse(asOf) - Date.parse(due)) / 86_400_000);
  return late <= 0 ? AGING_BUCKETS[0] : late <= 30 ? AGING_BUCKETS[1] : late <= 60 ? AGING_BUCKETS[2] : late <= 90 ? AGING_BUCKETS[3] : AGING_BUCKETS[4];
}
