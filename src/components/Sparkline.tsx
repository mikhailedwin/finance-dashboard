import { useMemo } from 'react';

import type { Point } from '../lib/series';
import { downsample } from '../lib/downsample';

interface Props {
  points: Point[];
  /** Years of history to show. */
  years?: number;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Trend line for a stat tile — shape only, no axes or labels. The line is
 * de-emphasised and the latest observation carries the accent, so the eye lands
 * on "where it is now" rather than tracing the whole path.
 */
export function Sparkline({ points, years = 5, width = 120, height = 32, className = '' }: Props) {
  const path = useMemo(() => {
    if (points.length < 2) return null;

    const latest = points[points.length - 1].t;
    const cutoff = new Date(latest);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    const windowed = points.filter((p) => p.t >= cutoff.getTime());
    if (windowed.length < 2) return null;

    const sampled = downsample(windowed, 60);
    const values = sampled.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const t0 = sampled[0].t;
    const tSpan = sampled[sampled.length - 1].t - t0 || 1;

    // Inset by the stroke half-width so the line never clips at the edges.
    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;

    const coords = sampled.map((p) => ({
      x: pad + ((p.t - t0) / tSpan) * w,
      y: pad + h - ((p.value - min) / range) * h,
    }));

    return {
      d: coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      last: coords[coords.length - 1],
    };
  }, [points, years, width, height]);

  if (!path) return <div style={{ width, height }} className={className} />;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d={path.d}
        fill="none"
        stroke="var(--series-1)"
        strokeOpacity={0.4}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={path.last.x}
        cy={path.last.y}
        r={2.5}
        fill="var(--series-1)"
        stroke="var(--surface)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
