/**
 * Series maths shared between the build-time fetch script and the browser.
 *
 * Keeping transforms in one place means the statistics baked into
 * `manifest.json` are guaranteed to describe exactly what the charts draw.
 */

import type { Indicator, Transform } from '../config/indicators';

/** Columnar storage — roughly half the bytes of an array of objects. */
export interface SeriesData {
  id: string;
  dates: string[];
  values: (number | null)[];
}

export interface Point {
  date: string;
  /** Milliseconds since epoch, for numeric time axes. */
  t: number;
  value: number;
}

export interface SeriesStats {
  latest: number;
  latestDate: string;
  previous: number | null;
  /** Change from the previous observation, in the units of the transformed series. */
  change: number | null;
  /** Change over roughly twelve months. */
  changeYear: number | null;
  min: number;
  max: number;
  mean: number;
  /** Percentile rank of the latest value within the trailing window, 0–100. */
  percentile1y: number | null;
  percentile5y: number | null;
  percentile10y: number | null;
  percentileAll: number;
  /** Standard deviations from the trailing 10-year mean. */
  zScore10y: number | null;
  /** Sign of the recent trend, from a 6-observation linear fit. */
  direction: 'rising' | 'falling' | 'flat';
  observations: number;
  firstDate: string;
}

const MS_PER_DAY = 86_400_000;

export function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Subtract whole years from an ISO date without drifting across DST. */
function minusYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${String(y - years).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Index of the last observation at or before `target`.
 *
 * Dates arrive sorted ascending from FRED, so a binary search is safe and keeps
 * the year-ago lookup O(log n) rather than O(n) per point.
 */
function indexAtOrBefore(dates: string[], target: string, hi: number): number {
  let lo = 0;
  let best = -1;
  let high = hi;
  while (lo <= high) {
    const mid = (lo + high) >> 1;
    if (dates[mid] <= target) {
      best = mid;
      lo = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

/**
 * Percent change versus roughly one year earlier.
 *
 * Matched by date rather than by a fixed period count, so it stays correct for
 * daily series with holiday gaps and for series whose frequency changes.
 */
function yearOverYear(data: SeriesData): SeriesData {
  const { dates, values } = data;
  const out: (number | null)[] = new Array(dates.length).fill(null);

  for (let i = 0; i < dates.length; i++) {
    const current = values[i];
    if (current == null) continue;

    const targetDate = minusYears(dates[i], 1);
    const j = indexAtOrBefore(dates, targetDate, i);
    if (j < 0) continue;

    // Reject a stale match: if the nearest prior observation is far from the
    // one-year mark the comparison would be misleading, so leave it null.
    const gapDays = Math.abs(toTime(dates[j]) - toTime(targetDate)) / MS_PER_DAY;
    if (gapDays > 45) continue;

    const base = values[j];
    if (base == null || base === 0) continue;

    out[i] = ((current - base) / Math.abs(base)) * 100;
  }

  return { id: data.id, dates, values: out };
}

/** Absolute change from the previous observation. */
function difference(data: SeriesData): SeriesData {
  const { dates, values } = data;
  const out: (number | null)[] = new Array(dates.length).fill(null);
  let lastIdx = -1;

  for (let i = 0; i < dates.length; i++) {
    if (values[i] == null) continue;
    if (lastIdx >= 0) out[i] = values[i]! - values[lastIdx]!;
    lastIdx = i;
  }

  return { id: data.id, dates, values: out };
}

export function applyTransform(data: SeriesData, transform: Transform): SeriesData {
  switch (transform) {
    case 'yoy':
      return yearOverYear(data);
    case 'diff':
      return difference(data);
    default:
      return data;
  }
}

/** Trailing moving average over the last `window` non-null observations. */
export function movingAverage(data: SeriesData, window: number): SeriesData {
  const { dates, values } = data;
  const out: (number | null)[] = new Array(dates.length).fill(null);
  const buffer: number[] = [];
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    buffer.push(v);
    sum += v;
    if (buffer.length > window) sum -= buffer.shift()!;
    if (buffer.length === window) out[i] = sum / window;
  }

  return { id: data.id, dates, values: out };
}

/**
 * Full pipeline from raw FRED levels to what the dashboard actually plots.
 * Both the fetch script and the charts call this, so they cannot disagree.
 */
export function prepareSeries(data: SeriesData, indicator: Indicator): SeriesData {
  let out = applyTransform(data, indicator.transform);
  if (indicator.movingAverage) out = movingAverage(out, indicator.movingAverage);
  return out;
}

/** Drop nulls and pair each value with its timestamp. */
export function toPoints(data: SeriesData): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < data.dates.length; i++) {
    const v = data.values[i];
    if (v == null || !Number.isFinite(v)) continue;
    points.push({ date: data.dates[i], t: toTime(data.dates[i]), value: v });
  }
  return points;
}

/** Share of `sample` at or below `value`, as a percentage. */
export function percentileRank(sample: number[], value: number): number {
  if (sample.length === 0) return 50;
  let atOrBelow = 0;
  for (const v of sample) if (v <= value) atOrBelow++;
  return (atOrBelow / sample.length) * 100;
}

function windowValues(points: Point[], years: number): number[] {
  if (points.length === 0) return [];
  const cutoff = toTime(minusYears(points[points.length - 1].date, years));
  const out: number[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].t < cutoff) break;
    out.push(points[i].value);
  }
  return out;
}

/**
 * Trend direction from an ordinary least-squares fit over the last six
 * observations, scaled against the series' own variability so that "flat" means
 * flat relative to how much this series normally moves.
 */
function trendDirection(points: Point[]): 'rising' | 'falling' | 'flat' {
  const n = Math.min(6, points.length);
  if (n < 3) return 'flat';

  const recent = points.slice(-n);
  const meanX = (n - 1) / 2;
  const meanY = recent.reduce((s, p) => s + p.value, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (recent[i].value - meanY);
    den += (i - meanX) ** 2;
  }
  if (den === 0) return 'flat';

  const slope = num / den;
  const spread = Math.max(...recent.map((p) => p.value)) - Math.min(...recent.map((p) => p.value));
  const threshold = spread === 0 ? 0 : spread * 0.05;

  if (Math.abs(slope) <= threshold) return 'flat';
  return slope > 0 ? 'rising' : 'falling';
}

export function computeStats(points: Point[]): SeriesStats | null {
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;

  // Value from ~a year ago, for the headline year-on-year comparison.
  const yearAgoCutoff = toTime(minusYears(last.date, 1));
  let yearAgo: number | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].t <= yearAgoCutoff) {
      yearAgo = points[i].value;
      break;
    }
  }

  const w1 = windowValues(points, 1);
  const w5 = windowValues(points, 5);
  const w10 = windowValues(points, 10);

  let zScore10y: number | null = null;
  if (w10.length > 8) {
    const mean10 = w10.reduce((s, v) => s + v, 0) / w10.length;
    const variance = w10.reduce((s, v) => s + (v - mean10) ** 2, 0) / w10.length;
    const sd = Math.sqrt(variance);
    if (sd > 0) zScore10y = (last.value - mean10) / sd;
  }

  return {
    latest: last.value,
    latestDate: last.date,
    previous: prev ? prev.value : null,
    change: prev ? last.value - prev.value : null,
    changeYear: yearAgo != null ? last.value - yearAgo : null,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((s, v) => s + v, 0) / values.length,
    percentile1y: w1.length > 4 ? percentileRank(w1, last.value) : null,
    percentile5y: w5.length > 8 ? percentileRank(w5, last.value) : null,
    percentile10y: w10.length > 8 ? percentileRank(w10, last.value) : null,
    percentileAll: percentileRank(values, last.value),
    zScore10y,
    direction: trendDirection(points),
    observations: points.length,
    firstDate: points[0].date,
  };
}

/** Contiguous recession intervals collapsed from the monthly USREC 0/1 flag. */
export interface RecessionPeriod {
  start: string;
  end: string;
}

export function deriveRecessions(data: SeriesData): RecessionPeriod[] {
  const periods: RecessionPeriod[] = [];
  let start: string | null = null;

  for (let i = 0; i < data.dates.length; i++) {
    const inRecession = data.values[i] === 1;
    if (inRecession && start === null) {
      start = data.dates[i];
    } else if (!inRecession && start !== null) {
      periods.push({ start, end: data.dates[i] });
      start = null;
    }
  }

  // Still in recession as of the final observation.
  if (start !== null) periods.push({ start, end: data.dates[data.dates.length - 1] });

  return periods;
}
