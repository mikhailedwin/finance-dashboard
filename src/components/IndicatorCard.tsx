import type { ManifestEntry } from '../lib/manifest';
import type { RecessionPeriod } from '../lib/series';
import type { RangeKey } from '../lib/range';
import { useIndicatorPoints } from '../hooks/useSeries';
import { formatDisplay, formatPeriod, formatRelativeTime, transformSuffix } from '../lib/format';
import { IndicatorChart, SeriesTable } from './IndicatorChart';
import { ChangeBadge } from './ChangeBadge';

interface Props {
  entry: ManifestEntry;
  recessions: RecessionPeriod[];
  range: RangeKey;
}

export function IndicatorCard({ entry, recessions, range }: Props) {
  const { indicator, stats } = entry;
  const { data: points, loading, error } = useIndicatorPoints(indicator.id);
  const suffix = transformSuffix(indicator);

  return (
    <section className="flex flex-col rounded-xl border border-edge bg-surface p-4 shadow-[var(--shadow-card)]">
      <header className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink">{indicator.label}</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              {suffix ? `${suffix} · ` : ''}
              {formatPeriod(stats.latestDate, indicator.frequency)}
              {entry.stale && (
                <>
                  {' · '}
                  <span
                    className="text-serious"
                    title={`Source last published ${formatRelativeTime(stats.latestDate)}`}
                  >
                    lagging
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xl font-semibold text-ink">
              {formatDisplay(stats.latest, indicator)}
            </div>
            <ChangeBadge
              change={stats.change}
              indicator={indicator}
              className="mt-0.5 justify-end"
            />
          </div>
        </div>
      </header>

      <div className="min-h-[260px]">
        {error ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-critical">
            Could not load this series
          </div>
        ) : loading || !points ? (
          <div
            className="h-[260px] animate-pulse rounded-lg bg-grid/60"
            aria-label="Loading chart"
          />
        ) : (
          <IndicatorChart
            indicator={indicator}
            points={points}
            recessions={recessions}
            range={range}
          />
        )}
      </div>

      {indicator.referenceLine && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <svg width="16" height="4" aria-hidden className="shrink-0">
            <line
              x1="0"
              y1="2"
              x2="16"
              y2="2"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          </svg>
          {indicator.referenceLine.label} (
          {formatDisplay(indicator.referenceLine.value, indicator)})
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-secondary">{indicator.description}</p>

      {points && <SeriesTable indicator={indicator} points={points} range={range} />}

      <p className="mt-2 text-[11px] text-ink-muted">
        {indicator.source} · FRED series{' '}
        <a
          href={`https://fred.stlouisfed.org/series/${indicator.id}`}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-ink-secondary"
        >
          {indicator.id}
        </a>
      </p>
    </section>
  );
}
