import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Manifest } from '../lib/manifest';
import { CATEGORY_META, INDICATORS, INDICATOR_BY_ID, type Indicator } from '../config/indicators';
import { useIndicatorPoints } from '../hooks/useSeries';
import { toTime } from '../lib/series';
import { correlation, describeCorrelation, joinMonthly, rebase, type JoinedPoint } from '../lib/compare';
import { displayFormat, formatAxisDate, formatDisplay, formatPeriod, formatValue } from '../lib/format';
import { generateTimeTicks } from '../lib/ticks';
import { rangeStartTime, spanYears, type RangeKey } from '../lib/range';
import { IndicatorChart } from '../components/IndicatorChart';

type Mode = 'shared' | 'indexed' | 'stacked';

interface Props {
  manifest: Manifest;
  range: RangeKey;
}

export function CompareView({ manifest, range }: Props) {
  const [idA, setIdA] = useState('CPILFESL');
  const [idB, setIdB] = useState('FEDFUNDS');

  const indicatorA = INDICATOR_BY_ID.get(idA)!;
  const indicatorB = INDICATOR_BY_ID.get(idB)!;

  const { data: pointsA } = useIndicatorPoints(idA);
  const { data: pointsB } = useIndicatorPoints(idB);

  // Units of the *transformed* series decide whether a shared axis is honest.
  const unitsA = displayFormat(indicatorA);
  const unitsB = displayFormat(indicatorB);
  const sameUnits = unitsA.format === unitsB.format;

  const window = useMemo(() => {
    if (!pointsA?.length || !pointsB?.length) return null;
    const latest = Math.min(pointsA.at(-1)!.t, pointsB.at(-1)!.t);
    const earliest = Math.max(pointsA[0].t, pointsB[0].t);
    const start = rangeStartTime(range, latest);
    return { from: Math.max(start ?? earliest, earliest), to: latest };
  }, [pointsA, pointsB, range]);

  const joined = useMemo(() => {
    if (!pointsA || !pointsB || !window) return [];
    return joinMonthly(pointsA, pointsB, window.from, window.to);
  }, [pointsA, pointsB, window]);

  // Indexing divides by a base value, so it is meaningless for a series that
  // crosses or sits near zero — a spread, or a growth rate.
  const indexable = useMemo(() => {
    const first = joined.find((p) => p.a != null && p.b != null);
    if (!first) return false;
    const crossesZero = (key: 'a' | 'b') => {
      const vals = joined.map((p) => p[key]).filter((v): v is number => v != null);
      return vals.some((v) => v <= 0) && vals.some((v) => v > 0);
    };
    return (
      Math.abs(first.a!) > 1e-6 &&
      Math.abs(first.b!) > 1e-6 &&
      !crossesZero('a') &&
      !crossesZero('b')
    );
  }, [joined]);

  const defaultMode: Mode = sameUnits ? 'shared' : indexable ? 'indexed' : 'stacked';
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);
  const mode: Mode = modeOverride ?? defaultMode;

  const plotted = useMemo(
    () => (mode === 'indexed' ? rebase(joined) : joined),
    [joined, mode],
  );

  const r = useMemo(() => correlation(joined), [joined]);

  const ticks = useMemo(
    () => (window ? generateTimeTicks(window.from, window.to) : []),
    [window],
  );
  const span = window ? spanYears(window.from, window.to) : 0;

  const visibleRecessions = useMemo(() => {
    if (!window) return [];
    return manifest.recessions
      .map((rec) => ({ start: toTime(rec.start), end: toTime(rec.end) }))
      .filter((rec) => rec.end >= window.from && rec.start <= window.to);
  }, [manifest.recessions, window]);

  const modes: { key: Mode; label: string; available: boolean; why?: string }[] = [
    {
      key: 'shared',
      label: 'Shared axis',
      available: sameUnits,
      why: 'Both series must be in the same units',
    },
    {
      key: 'indexed',
      label: 'Indexed to 100',
      available: indexable,
      why: 'Cannot index a series that crosses zero',
    },
    { key: 'stacked', label: 'Small multiples', available: true },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold text-ink">Compare Indicators</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
          Overlay any two series to examine how they move together. Where the two
          have different units they are indexed to a common base rather than given
          separate axes — two y-scales can be aligned arbitrarily and invent a
          relationship that is not in the data.
        </p>
      </header>

      <div className="rounded-xl border border-edge bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <SeriesPicker label="Series A" value={idA} onChange={setIdA} swatch="var(--series-1)" />
          <SeriesPicker label="Series B" value={idB} onChange={setIdB} swatch="var(--series-2)" />

          <div className="sm:ml-auto">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">View</span>
            <div className="inline-flex rounded-lg border border-edge p-0.5">
              {modes.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  disabled={!m.available}
                  title={m.available ? undefined : m.why}
                  onClick={() => setModeOverride(m.key)}
                  aria-pressed={mode === m.key}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    mode === m.key
                      ? 'bg-ink text-surface'
                      : m.available
                        ? 'text-ink-secondary hover:bg-grid hover:text-ink'
                        : 'cursor-not-allowed text-ink-muted/50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend — always present for two series. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendKey color="var(--series-1)" label={indicatorA.label} />
          <LegendKey color="var(--series-2)" label={indicatorB.label} />
          {r != null && (
            <span className="text-xs text-ink-muted">
              Correlation over this window:{' '}
              <span className="font-medium text-ink-secondary tnum">{r.toFixed(2)}</span>{' '}
              ({describeCorrelation(r)})
            </span>
          )}
        </div>

        {mode === 'stacked' ? (
          <div className="mt-4 space-y-4">
            <StackedPanel indicator={indicatorA} manifest={manifest} range={range} />
            <StackedPanel indicator={indicatorB} manifest={manifest} range={range} />
          </div>
        ) : (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={plotted} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />

                {visibleRecessions.map((rec) => (
                  <ReferenceArea
                    key={rec.start}
                    x1={Math.max(rec.start, window?.from ?? 0)}
                    x2={Math.min(rec.end, window?.to ?? 0)}
                    fill="var(--recession)"
                    stroke="none"
                    ifOverflow="hidden"
                  />
                ))}

                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[window?.from ?? 'auto', window?.to ?? 'auto']}
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
                  width={56}
                  tickFormatter={(v: number) =>
                    mode === 'indexed'
                      ? v.toFixed(0)
                      : formatValue(v, unitsA.format, unitsA.decimals, {
                          bare: true,
                          scale: unitsA.scale,
                        })
                  }
                />

                <Tooltip
                  cursor={{ stroke: 'var(--ink-muted)', strokeWidth: 1 }}
                  isAnimationActive={false}
                  content={
                    <CompareTooltip
                      indicatorA={indicatorA}
                      indicatorB={indicatorB}
                      mode={mode}
                    />
                  }
                />

                <Line
                  dataKey="a"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                />
                <Line
                  dataKey="b"
                  stroke="var(--series-2)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                />
              </LineChart>
            </ResponsiveContainer>

            <p className="mt-2 text-[11px] text-ink-muted">
              {mode === 'indexed'
                ? 'Both series indexed to 100 at the start of the window; shaded bands mark recessions.'
                : 'Both series share one axis because they are measured in the same units; shaded bands mark recessions.'}{' '}
              Series are resampled to a common monthly grid for comparison.
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-ink-muted">
        Correlation measures co-movement over the selected window only. It is not
        evidence of causation, and it can change substantially with the window —
        try several ranges before drawing a conclusion.
      </p>
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
      <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function SeriesPicker({
  label,
  value,
  onChange,
  swatch,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  swatch: string;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: swatch }} />
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-series-1"
      >
        {Object.entries(CATEGORY_META)
          .sort((a, b) => a[1].order - b[1].order)
          .map(([key, meta]) => (
            <optgroup key={key} label={meta.label}>
              {INDICATORS.filter((i) => i.category === key).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
    </label>
  );
}

function StackedPanel({
  indicator,
  manifest,
  range,
}: {
  indicator: Indicator;
  manifest: Manifest;
  range: RangeKey;
}) {
  const { data: points } = useIndicatorPoints(indicator.id);
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-ink-secondary">{indicator.label}</h3>
      {points ? (
        <IndicatorChart
          indicator={indicator}
          points={points}
          recessions={manifest.recessions}
          range={range}
          height={170}
        />
      ) : (
        <div className="h-[170px] animate-pulse rounded-lg bg-grid/60" />
      )}
    </div>
  );
}

function CompareTooltip({
  active,
  payload,
  indicatorA,
  indicatorB,
  mode,
}: {
  active?: boolean;
  payload?: { payload: JoinedPoint }[];
  indicatorA: Indicator;
  indicatorB: Indicator;
  mode: Mode;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  const render = (value: number | null, indicator: Indicator) => {
    if (value == null) return '—';
    return mode === 'indexed' ? value.toFixed(1) : formatDisplay(value, indicator);
  };

  return (
    <div className="rounded-lg border border-edge bg-surface px-3 py-2 shadow-lg">
      <div className="text-xs text-ink-muted">{formatPeriod(p.date, 'monthly')}</div>
      <dl className="mt-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: 'var(--series-1)' }} />
          <dt className="text-xs text-ink-secondary">{indicatorA.shortLabel ?? indicatorA.label}</dt>
          <dd className="ml-auto text-xs font-semibold text-ink tnum">{render(p.a, indicatorA)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: 'var(--series-2)' }} />
          <dt className="text-xs text-ink-secondary">{indicatorB.shortLabel ?? indicatorB.label}</dt>
          <dd className="ml-auto text-xs font-semibold text-ink tnum">{render(p.b, indicatorB)}</dd>
        </div>
      </dl>
      {mode === 'indexed' && (
        <p className="mt-1 text-[10px] text-ink-muted">Indexed, 100 = window start</p>
      )}
    </div>
  );
}
