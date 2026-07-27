/**
 * Comparison maths for the overlay view.
 *
 * Two macro series almost never share a scale — the dollar index sits near 120
 * while core PCE sits near 3. The honest way to put them on one plot is to
 * index both to 100 at a common start date and use a single axis. A second
 * y-axis would let the two scales be aligned arbitrarily, manufacturing a
 * visual correlation that is not in the data.
 */

import type { Point } from './series';

export interface JoinedPoint {
  t: number;
  date: string;
  a: number | null;
  b: number | null;
}

/**
 * Resample both series onto a shared monthly grid, carrying the last known
 * observation forward within each month. This lets a daily series be compared
 * with a quarterly one without pretending to a precision neither has.
 */
export function joinMonthly(a: Point[], b: Point[], fromTime: number, toTime: number): JoinedPoint[] {
  if (a.length === 0 || b.length === 0) return [];

  const months: { t: number; date: string }[] = [];
  const start = new Date(fromTime);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();

  while (true) {
    const t = Date.UTC(y, m, 1);
    if (t > toTime) break;
    months.push({ t, date: `${y}-${String(m + 1).padStart(2, '0')}-01` });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    if (months.length > 1200) break;
  }

  const sampler = (points: Point[]) => {
    let i = 0;
    return (t: number): number | null => {
      // Points are sorted, and `t` increases monotonically across calls, so the
      // cursor only ever moves forward — the whole join stays linear.
      while (i < points.length && points[i].t <= t) i++;
      return i > 0 ? points[i - 1].value : null;
    };
  };

  const sampleA = sampler(a);
  const sampleB = sampler(b);

  return months.map(({ t, date }) => ({
    t,
    date,
    // Sample at the end of the month so a monthly observation dated the 1st is
    // included rather than skipped.
    a: sampleA(Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 0)),
    b: sampleB(Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 0)),
  }));
}

/** Rebase to 100 at the first month where both series have a value. */
export function rebase(joined: JoinedPoint[]): JoinedPoint[] {
  const first = joined.find((p) => p.a != null && p.b != null);
  if (!first || first.a === 0 || first.b === 0) return joined;

  const baseA = first.a!;
  const baseB = first.b!;

  return joined.map((p) => ({
    ...p,
    a: p.a == null ? null : (p.a / baseA) * 100,
    b: p.b == null ? null : (p.b / baseB) * 100,
  }));
}

/** Pearson correlation over the months where both series have a value. */
export function correlation(joined: JoinedPoint[]): number | null {
  const pairs = joined.filter((p) => p.a != null && p.b != null) as {
    a: number;
    b: number;
  }[];
  if (pairs.length < 3) return null;

  const n = pairs.length;
  const meanA = pairs.reduce((s, p) => s + p.a, 0) / n;
  const meanB = pairs.reduce((s, p) => s + p.b, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (const p of pairs) {
    const da = p.a - meanA;
    const db = p.b - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? null : cov / denom;
}

export function describeCorrelation(r: number): string {
  const strength =
    Math.abs(r) >= 0.8
      ? 'very strong'
      : Math.abs(r) >= 0.6
        ? 'strong'
        : Math.abs(r) >= 0.4
          ? 'moderate'
          : Math.abs(r) >= 0.2
            ? 'weak'
            : 'negligible';
  return `${strength} ${r >= 0 ? 'positive' : 'negative'}`;
}
