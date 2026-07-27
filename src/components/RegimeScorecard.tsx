import type { RegimeAssessment, Signal, SignalStatus } from '../lib/regime';
import { STATUS_LABEL } from '../lib/regime';

const STATUS_STYLE: Record<SignalStatus, { dot: string; text: string; icon: string }> = {
  expansionary: { dot: 'bg-good', text: 'text-good', icon: '●' },
  watch: { dot: 'bg-warning', text: 'text-warning', icon: '◐' },
  warning: { dot: 'bg-critical', text: 'text-critical', icon: '▲' },
};

/**
 * Traffic-light readout of the classic recession signals.
 *
 * Every row states the rule it applies, so a reader can check the logic rather
 * than trusting the colour. Status is carried by an icon and a written label as
 * well as the colour itself.
 */
export function RegimeScorecard({ assessment }: { assessment: RegimeAssessment }) {
  const { signals, score, headline, summary, counts } = assessment;

  const overall: SignalStatus =
    score >= 70 ? 'expansionary' : score >= 40 ? 'watch' : 'warning';

  return (
    <section className="rounded-xl border border-edge bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Recession Signal Scorecard</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-secondary">
            Each signal applies a published threshold — no fitted parameters, no
            discretion. Hover or read the rule beside each row to see exactly what is
            being tested.
          </p>
        </div>

        <div className="text-right">
          <div className={`text-lg font-semibold ${STATUS_STYLE[overall].text}`}>
            <span aria-hidden className="mr-1.5">
              {STATUS_STYLE[overall].icon}
            </span>
            {headline}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted">{summary}</div>
        </div>
      </div>

      {/* Composite meter: track is a lighter step of the same ramp. */}
      <div className="mt-4">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-grid"
          role="meter"
          aria-valuenow={Math.round(score)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Composite expansion score"
        >
          <div
            className={`h-full rounded-full ${
              overall === 'expansionary'
                ? 'bg-good'
                : overall === 'watch'
                  ? 'bg-warning'
                  : 'bg-critical'
            }`}
            style={{ width: `${Math.max(score, 2)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-muted">
          <span>Recessionary</span>
          <span className="tnum">{Math.round(score)} / 100</span>
          <span>Expansionary</span>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-edge border-t border-edge">
        {signals.map((s) => (
          <SignalRow key={s.indicatorId} signal={s} />
        ))}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
        {counts.warning > 0
          ? 'Note that yield-curve signals typically lead a downturn by twelve to eighteen months, and the curve often un-inverts shortly before a recession begins — a return to positive slope is not by itself an all-clear.'
          : 'Signals are shown as of the latest published observation for each series; publication lags differ between them.'}
      </p>
    </section>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const style = STATUS_STYLE[signal.status];

  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          aria-hidden
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium text-ink">{signal.label}</span>
            <span className={`text-[11px] font-medium ${style.text}`}>
              {STATUS_LABEL[signal.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{signal.reading}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Rule: {signal.rule}</p>
        </div>
      </div>

      <div className="shrink-0 pl-[18px] text-sm font-semibold text-ink tnum sm:pl-0 sm:text-right">
        {signal.formatted}
      </div>
    </li>
  );
}
