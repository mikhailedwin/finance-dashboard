/**
 * Calendar-aligned ticks for the time axis.
 *
 * A numeric axis left to itself divides the range into equal millisecond steps,
 * which produces labels like "14 Mar 09" — technically correct, visually random.
 * These land on year, quarter or month boundaries instead.
 */

import { spanYears } from './range';

interface Step {
  /** Months between ticks. */
  months: number;
  /** Minimum span (years) at which this step applies. */
  minSpan: number;
}

const STEPS: Step[] = [
  { months: 240, minSpan: 90 },
  { months: 120, minSpan: 45 },
  { months: 60, minSpan: 22 },
  { months: 24, minSpan: 9 },
  { months: 12, minSpan: 4.5 },
  { months: 6, minSpan: 2.2 },
  { months: 3, minSpan: 1.1 },
  { months: 1, minSpan: 0 },
];

export function generateTimeTicks(fromTime: number, toTime: number): number[] {
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime <= fromTime) return [];

  const span = spanYears(fromTime, toTime);
  const step = STEPS.find((s) => span >= s.minSpan) ?? STEPS[STEPS.length - 1];

  const start = new Date(fromTime);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();

  // Snap the first tick up to the next boundary that divides evenly, so the
  // sequence reads 2000, 2005, 2010 rather than 2003, 2008, 2013.
  if (step.months >= 12) {
    const yearStep = step.months / 12;
    year = Math.ceil(year / yearStep) * yearStep;
    month = 0;
  } else {
    month = Math.ceil(month / step.months) * step.months;
    if (month > 11) {
      month -= 12;
      year += 1;
    }
  }

  const ticks: number[] = [];
  let t = Date.UTC(year, month, 1);

  // Guard against a pathological step producing an unbounded loop.
  for (let i = 0; t <= toTime && i < 200; i++) {
    if (t >= fromTime) ticks.push(t);
    const d = new Date(t);
    t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + step.months, 1);
  }

  return ticks;
}
