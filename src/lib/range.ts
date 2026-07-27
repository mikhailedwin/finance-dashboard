/**
 * The global time range.
 *
 * One control scopes every chart on the page rather than each card carrying its
 * own selector — so a reader comparing two indicators is always comparing the
 * same window.
 */

export type RangeKey = '1Y' | '2Y' | '5Y' | '10Y' | '25Y' | 'MAX';

export const RANGES: { key: RangeKey; label: string; years: number | null }[] = [
  { key: '1Y', label: '1Y', years: 1 },
  { key: '2Y', label: '2Y', years: 2 },
  { key: '5Y', label: '5Y', years: 5 },
  { key: '10Y', label: '10Y', years: 10 },
  { key: '25Y', label: '25Y', years: 25 },
  { key: 'MAX', label: 'Max', years: null },
];

const RANGE_YEARS = new Map(RANGES.map((r) => [r.key, r.years]));

/**
 * Earliest timestamp to show, measured back from the most recent observation
 * rather than from today — series publish on different lags, and anchoring to
 * `now` would leave the slower ones looking artificially short.
 */
export function rangeStartTime(range: RangeKey, latestTime: number): number | null {
  const years = RANGE_YEARS.get(range);
  if (years == null) return null;
  const d = new Date(latestTime);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.getTime();
}

/** Span in years actually covered, used to pick axis tick granularity. */
export function spanYears(fromTime: number, toTime: number): number {
  return (toTime - fromTime) / (365.25 * 86_400_000);
}
