/**
 * Largest-Triangle-Three-Buckets downsampling.
 *
 * The 10-year Treasury series carries ~16,000 daily observations. Handing that
 * many points to an SVG chart is slow and, at typical widths, draws several
 * points per pixel anyway. Naive striding would drop spikes — precisely the
 * features that matter on a rates chart.
 *
 * LTTB divides the series into buckets and keeps, from each, the point forming
 * the largest triangle with its neighbours. That preserves visual peaks and
 * troughs at a fraction of the point count.
 *
 * Sander, "Downsampling Time Series for Visual Representation" (2013).
 */

import type { Point } from './series';

export function downsample(points: Point[], threshold: number): Point[] {
  const n = points.length;
  if (threshold >= n || threshold < 3) return points;

  const sampled: Point[] = [points[0]];

  // Buckets span the interior; the first and last points are always kept so the
  // chart's endpoints stay truthful.
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    // Average of the *next* bucket forms the far vertex of the triangle.
    const nextStart = rangeEnd;
    const nextEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, n);
    let avgT = 0;
    let avgV = 0;
    const nextCount = Math.max(nextEnd - nextStart, 1);
    for (let j = nextStart; j < nextEnd; j++) {
      avgT += points[j].t;
      avgV += points[j].value;
    }
    if (nextEnd > nextStart) {
      avgT /= nextCount;
      avgV /= nextCount;
    } else {
      avgT = points[n - 1].t;
      avgV = points[n - 1].value;
    }

    const pointA = points[a];
    let maxArea = -1;
    let chosen = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (pointA.t - avgT) * (points[j].value - pointA.value) -
          (pointA.t - points[j].t) * (avgV - pointA.value),
      );
      if (area > maxArea) {
        maxArea = area;
        chosen = j;
      }
    }

    sampled.push(points[chosen]);
    a = chosen;
  }

  sampled.push(points[n - 1]);
  return sampled;
}

/** Slice to a date window, then downsample what remains. */
export function windowAndSample(
  points: Point[],
  fromTime: number | null,
  maxPoints = 900,
): Point[] {
  const windowed = fromTime == null ? points : points.filter((p) => p.t >= fromTime);
  return downsample(windowed, maxPoints);
}
