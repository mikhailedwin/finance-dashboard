import type { Indicator } from '../config/indicators';
import { formatDisplay } from '../lib/format';

interface Props {
  change: number | null;
  indicator: Indicator;
  /** Names the comparison period, e.g. "vs. last year". */
  period?: string;
  className?: string;
}

/**
 * Signed change, coloured by whether the move is good for the economy rather
 * than by its sign — a falling inflation rate is an improvement, a falling
 * payroll count is not.
 *
 * The arrow carries direction and the text carries the value, so meaning never
 * rests on colour alone.
 */
export function ChangeBadge({ change, indicator, period, className = '' }: Props) {
  if (change == null || !Number.isFinite(change)) {
    return <div className={`text-xs text-ink-muted ${className}`}>—</div>;
  }

  const negligible = Math.abs(change) < 10 ** -indicator.decimals / 2;
  const rising = change > 0;

  let tone = 'text-ink-muted';
  if (!negligible && indicator.polarity !== 'neutral') {
    const good = indicator.polarity === 'higher-is-better' ? rising : !rising;
    tone = good ? 'text-good' : 'text-critical';
  }

  const arrow = negligible ? '→' : rising ? '↑' : '↓';

  return (
    <div className={`flex items-center gap-1 text-xs ${tone} ${className}`}>
      <span aria-hidden>{arrow}</span>
      <span className="tnum">
        {negligible ? 'unchanged' : formatDisplay(change, indicator, { signed: true })}
      </span>
      {period && <span className="text-ink-muted">{period}</span>}
    </div>
  );
}
