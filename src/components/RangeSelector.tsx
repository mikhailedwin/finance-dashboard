import { RANGES, type RangeKey } from '../lib/range';

interface Props {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
}

/**
 * One range control scoping every chart on the page. Deliberately not per-card:
 * charts sharing a window is what makes them comparable at a glance.
 */
export function RangeSelector({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex items-center gap-0.5 rounded-lg border border-edge bg-surface p-0.5"
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            aria-pressed={active}
            className={`min-w-[38px] rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-series-1 ${
              active
                ? 'bg-ink text-surface'
                : 'text-ink-secondary hover:bg-grid hover:text-ink'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
