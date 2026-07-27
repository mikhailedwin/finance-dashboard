import type { ManifestEntry } from '../lib/manifest';
import { useIndicatorPoints } from '../hooks/useSeries';
import { formatDisplay, formatPeriod } from '../lib/format';
import { ChangeBadge } from './ChangeBadge';
import { Sparkline } from './Sparkline';

interface Props {
  entry: ManifestEntry;
  onSelect?: (category: string) => void;
}

/**
 * Headline KPI tile: label, value, change against a named period, and a trend
 * sparkline. Values use proportional figures — tabular digits make a large
 * standalone number look loose.
 */
export function StatTile({ entry, onSelect }: Props) {
  const { indicator, stats } = entry;
  const { data: points } = useIndicatorPoints(indicator.id);

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-secondary">
          {indicator.shortLabel ?? indicator.label}
        </span>
        {entry.stale && (
          <span className="shrink-0 text-[10px] text-serious" title="Source is publishing late">
            lagging
          </span>
        )}
      </div>

      <div className="mt-2 text-2xl font-semibold leading-none text-ink">
        {formatDisplay(stats.latest, indicator)}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <ChangeBadge
            change={stats.changeYear}
            indicator={indicator}
            period="vs. year ago"
          />
          <div className="mt-1 text-[11px] text-ink-muted">
            {formatPeriod(stats.latestDate, indicator.frequency)}
          </div>
        </div>
        {points && <Sparkline points={points} years={5} width={104} height={30} />}
      </div>
    </>
  );

  const className =
    'flex flex-col rounded-xl border border-edge bg-surface p-4 text-left shadow-[var(--shadow-card)]';

  if (!onSelect) return <div className={className}>{content}</div>;

  return (
    <button
      type="button"
      onClick={() => onSelect(indicator.category)}
      className={`${className} transition-colors hover:border-edge-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1`}
      aria-label={`${indicator.label}: ${formatDisplay(stats.latest, indicator)}. View ${indicator.category} section.`}
    >
      {content}
    </button>
  );
}
