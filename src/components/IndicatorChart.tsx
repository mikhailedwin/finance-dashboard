import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import type { Indicator } from '../config/indicators';
import type { Point, RecessionPeriod } from '../lib/series';
import { toTime } from '../lib/series';
import { downsample } from '../lib/downsample';
import { formatAxisDate, formatDisplay, formatPeriod } from '../lib/format';
import { generateTimeTicks } from '../lib/ticks';
import { rangeStartTime, spanYears, type RangeKey } from '../lib/range';

interface Props {
  indicator: Indicator;
  points: Point[];
  recessions: RecessionPeriod[];
  range: RangeKey;
  height?: number;
  /** Render without the card chrome, for embedding in a larger panel. */
  bare?: boolean;
}

/** Above this many points an SVG line chart starts to feel sluggish. */
const MAX_LINE_POINTS = 900;

export function IndicatorChart({
  indicator,
  points,
  recessions,
  range,
  height = 260,
}: Props) {
  const chartType = indicator.chartType ?? 'line';

  const { data, fromTime, toTime: to } = useMemo(() => {
    if (points.length === 0) return { data: [] as Point[], fromTime: 0, toTime: 0 };

    const latest = points[points.length - 1].t;
    const start = rangeStartTime(range, latest);
    const windowed = start == null ? points : points.filter((p) => p.t >= start);

    // Bars are not downsampled: LTTB keeps visual extremes, which is right for a
    // continuous line but would silently drop individual months from a bar
    // series where every bar is a discrete, countable observation.
    const reduced =
      chartType === 'bar' ? windowed : downsample(windowed, MAX_LINE_POINTS);

    return {
      data: reduced,
      fromTime: windowed.length > 0 ? windowed[0].t : 0,
      toTime: latest,
    };
  }, [points, range, chartType]);

  const ticks = useMemo(() => generateTimeTicks(fromTime, to), [fromTime, to]);
  const span = useMemo(() => spanYears(fromTime, to), [fromTime, to]);

  // Only shade recessions that intersect the visible window.
  const visibleRecessions = useMemo(
    () =>
      recessions
        .map((r) => ({ start: toTime(r.start), end: toTime(r.end) }))
        .filter((r) => r.end >= fromTime && r.start <= to),
    [recessions, fromTime, to],
  );

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-ink-muted"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const crossesZero =
    data.some((d) => d.value < 0) && data.some((d) => d.value > 0);
  const seriesColor = 'var(--series-1)';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid
          stroke="var(--grid)"
          strokeWidth={1}
          vertical={false}
        />

        {visibleRecessions.map((r) => (
          <ReferenceArea
            key={r.start}
            x1={Math.max(r.start, fromTime)}
            x2={Math.min(r.end, to)}
            fill="var(--recession)"
            stroke="none"
            ifOverflow="hidden"
          />
        ))}

        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[fromTime, to]}
          ticks={ticks}
          tickFormatter={(t: number) => formatAxisDate(t, span)}
          tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--axis)' }}
          minTickGap={16}
        />

        <YAxis
          tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => formatDisplay(v, indicator, { bare: true })}
        />

        {/*
          No inline label: an annotation pinned to the threshold line has no way
          to dodge the data, and on a spread chart it lands directly on the
          series. The line is identified by a caption beneath the chart instead.
        */}
        {indicator.referenceLine && (
          <ReferenceLine
            y={indicator.referenceLine.value}
            stroke="var(--ink-muted)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        <Tooltip
          cursor={{ stroke: 'var(--ink-muted)', strokeWidth: 1 }}
          content={<ChartTooltip indicator={indicator} />}
          isAnimationActive={false}
        />

        {chartType === 'bar' && (
          <Bar dataKey="value" isAnimationActive={false} maxBarSize={24}>
            {crossesZero
              ? data.map((d) => (
                  <Cell
                    key={d.t}
                    fill={d.value >= 0 ? 'var(--diverge-pos)' : 'var(--diverge-neg)'}
                  />
                ))
              : data.map((d) => <Cell key={d.t} fill={seriesColor} />)}
          </Bar>
        )}

        {chartType === 'area' && (
          <Area
            dataKey="value"
            stroke={seriesColor}
            strokeWidth={2}
            fill={seriesColor}
            fillOpacity={0.1}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />
        )}

        {chartType === 'line' && (
          <Line
            dataKey="value"
            stroke={seriesColor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Point }[];
  indicator: Indicator;
}

function ChartTooltip({ active, payload, indicator }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-edge bg-surface px-3 py-2 shadow-lg">
      <div className="text-xs text-ink-muted">
        {formatPeriod(point.date, indicator.frequency)}
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background:
              point.value < 0 && indicator.chartType === 'bar'
                ? 'var(--diverge-neg)'
                : 'var(--series-1)',
          }}
        />
        <span className="text-sm font-semibold text-ink">
          {formatDisplay(point.value, indicator)}
        </span>
      </div>
    </div>
  );
}

/**
 * The table twin every chart needs so no value is reachable only by hovering.
 * Collapsed by default to keep the visual density of the dashboard intact.
 */
export function SeriesTable({
  indicator,
  points,
  range,
  limit = 24,
}: {
  indicator: Indicator;
  points: Point[];
  range: RangeKey;
  limit?: number;
}) {
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    if (points.length === 0) return [];
    const latest = points[points.length - 1].t;
    const start = rangeStartTime(range, latest);
    const windowed = start == null ? points : points.filter((p) => p.t >= start);
    return windowed.slice(-limit).reverse();
  }, [points, range, limit]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-ink-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-ink-secondary"
      >
        {open ? 'Hide data table' : 'View data table'}
      </button>

      {open && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-edge">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              {indicator.label} — most recent {rows.length} observations
            </caption>
            <thead className="sticky top-0 bg-surface-raised">
              <tr className="border-b border-edge">
                <th scope="col" className="px-3 py-1.5 font-medium text-ink-secondary">
                  Period
                </th>
                <th
                  scope="col"
                  className="px-3 py-1.5 text-right font-medium text-ink-secondary"
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="tnum">
              {rows.map((r) => (
                <tr key={r.t} className="border-b border-edge/60 last:border-0">
                  <td className="px-3 py-1 text-ink-secondary">
                    {formatPeriod(r.date, indicator.frequency)}
                  </td>
                  <td className="px-3 py-1 text-right text-ink">
                    {formatDisplay(r.value, indicator)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
