/**
 * Recession and regime signals.
 *
 * Each signal is a rule with an explicit, published threshold — the inversion
 * point of the yield curve, the Sahm rule's 0.50 trigger, the zero point of the
 * Chicago Fed index. Nothing here is fitted or discretionary, so the scorecard
 * can be audited line by line, which matters when the output goes in front of
 * people making decisions on it.
 */

import type { Manifest } from './manifest';
import { formatDisplay } from './format';

export type SignalStatus = 'expansionary' | 'watch' | 'warning';

export interface Signal {
  indicatorId: string;
  label: string;
  status: SignalStatus;
  value: number;
  formatted: string;
  /** The rule being applied, stated plainly. */
  rule: string;
  /** What this particular reading means right now. */
  reading: string;
}

export interface RegimeAssessment {
  signals: Signal[];
  /** 0–100, higher is healthier. */
  score: number;
  headline: string;
  summary: string;
  counts: Record<SignalStatus, number>;
}

const STATUS_WEIGHT: Record<SignalStatus, number> = {
  expansionary: 2,
  watch: 1,
  warning: 0,
};

export const STATUS_LABEL: Record<SignalStatus, string> = {
  expansionary: 'Expansionary',
  watch: 'Watch',
  warning: 'Warning',
};

/** Pick a status by testing thresholds in order of severity. */
function band(
  value: number,
  warningAt: (v: number) => boolean,
  watchAt: (v: number) => boolean,
): SignalStatus {
  if (warningAt(value)) return 'warning';
  if (watchAt(value)) return 'watch';
  return 'expansionary';
}

export function assessRegime(manifest: Manifest): RegimeAssessment {
  const signals: Signal[] = [];

  const get = (id: string) => manifest.entries[id];

  const push = (
    id: string,
    label: string,
    status: SignalStatus,
    value: number,
    rule: string,
    reading: string,
  ) => {
    const entry = get(id);
    if (!entry) return;
    signals.push({
      indicatorId: id,
      label,
      status,
      value,
      formatted: formatDisplay(value, entry.indicator),
      rule,
      reading,
    });
  };

  // ── Yield curve: 10Y–2Y ──────────────────────────────────────────────
  const t10y2y = get('T10Y2Y');
  if (t10y2y) {
    const v = t10y2y.stats.latest;
    push(
      'T10Y2Y',
      '10Y–2Y Yield Curve',
      band(v, (x) => x < 0, (x) => x < 0.5),
      v,
      'Inverted below 0.00; thin below 0.50',
      v < 0
        ? 'The curve is inverted — long rates below short. This has preceded every US recession since 1955, typically by 12–18 months.'
        : v < 0.5
          ? 'Positive but flat. The curve has un-inverted, which historically happens shortly before a downturn begins rather than after the risk passes.'
          : 'Normally sloped, consistent with an economy in expansion.',
    );
  }

  // ── Yield curve: 10Y–3M (the stronger predictor in the literature) ────
  const t10y3m = get('T10Y3M');
  if (t10y3m) {
    const v = t10y3m.stats.latest;
    push(
      'T10Y3M',
      '10Y–3M Yield Curve',
      band(v, (x) => x < 0, (x) => x < 0.5),
      v,
      'Inverted below 0.00; thin below 0.50',
      v < 0
        ? 'Inverted. Estrella and Mishkin found this spread the single most reliable curve-based recession predictor.'
        : v < 0.5
          ? 'Positive but compressed — the front end is still restrictive relative to long rates.'
          : 'Comfortably positive.',
    );
  }

  // ── Sahm rule ────────────────────────────────────────────────────────
  const sahm = get('SAHMREALTIME');
  if (sahm) {
    const v = sahm.stats.latest;
    push(
      'SAHMREALTIME',
      'Sahm Rule',
      band(v, (x) => x >= 0.5, (x) => x >= 0.3),
      v,
      'Triggers at 0.50',
      v >= 0.5
        ? 'Triggered. Unemployment has risen far enough off its lows to match the pattern at the start of every recession since 1970.'
        : v >= 0.3
          ? 'Rising toward the 0.50 trigger. Worth watching closely — the rule tends to move quickly once it starts.'
          : 'Well below trigger. Unemployment remains close to its recent low.',
    );
  }

  // ── Financial conditions ─────────────────────────────────────────────
  const nfci = get('NFCI');
  if (nfci) {
    const v = nfci.stats.latest;
    push(
      'NFCI',
      'Financial Conditions',
      band(v, (x) => x > 0.2, (x) => x > 0),
      v,
      'Zero is the historical average; positive is tighter than normal',
      v > 0.2
        ? 'Meaningfully tighter than average — credit and risk-taking are being constrained.'
        : v > 0
          ? 'Slightly tighter than the historical average.'
          : 'Looser than average, which supports credit growth and investment.',
    );
  }

  // ── Credit spreads, judged against their own history ─────────────────
  const baa = get('BAA10Y');
  if (baa) {
    const pct = baa.stats.percentile10y ?? baa.stats.percentileAll;
    const v = baa.stats.latest;
    push(
      'BAA10Y',
      'Corporate Credit Spreads',
      band(pct, (x) => x > 85, (x) => x > 65),
      v,
      'Judged by percentile against the last 10 years',
      pct > 85
        ? `At the ${Math.round(pct)}th percentile of the past decade — the market is pricing materially higher default risk.`
        : pct > 65
          ? `At the ${Math.round(pct)}th percentile of the past decade; spreads are widening but not distressed.`
          : `At the ${Math.round(pct)}th percentile of the past decade. Credit markets remain calm.`,
    );
  }

  // ── New York Fed yield-curve recession model ─────────────────────────
  const recProb = get('RECPROUSM156N');
  if (recProb) {
    const v = recProb.stats.latest;
    push(
      'RECPROUSM156N',
      'NY Fed Recession Probability',
      band(v, (x) => x > 30, (x) => x > 15),
      v,
      'Elevated above 30%',
      `The New York Fed's model puts the probability of recession within twelve months at ${v.toFixed(1)}%.`,
    );
  }

  // ── Jobless claims, relative to their own recent range ───────────────
  const claims = get('ICSA');
  if (claims) {
    const pct = claims.stats.percentile1y ?? 50;
    const v = claims.stats.latest;
    push(
      'ICSA',
      'Jobless Claims Trend',
      band(pct, (x) => x > 85, (x) => x > 65),
      v,
      'Judged by percentile against the last 12 months',
      pct > 85
        ? 'Claims are near the top of their 12-month range — layoffs are picking up.'
        : pct > 65
          ? 'Claims are drifting up within their recent range.'
          : 'Claims remain low, indicating employers are holding on to staff.',
    );
  }

  const counts: Record<SignalStatus, number> = { expansionary: 0, watch: 0, warning: 0 };
  for (const s of signals) counts[s.status]++;

  const score =
    signals.length === 0
      ? 50
      : (signals.reduce((sum, s) => sum + STATUS_WEIGHT[s.status], 0) / (signals.length * 2)) * 100;

  let headline: string;
  if (score >= 80) headline = 'Expansion intact';
  else if (score >= 60) headline = 'Expansion with soft spots';
  else if (score >= 40) headline = 'Mixed signals';
  else if (score >= 25) headline = 'Deteriorating';
  else headline = 'Recession signals dominant';

  const parts: string[] = [];
  parts.push(
    `${counts.expansionary} of ${signals.length} recession signals read expansionary`,
  );
  if (counts.watch > 0) parts.push(`${counts.watch} on watch`);
  if (counts.warning > 0) parts.push(`${counts.warning} in warning`);

  const summary = `${parts.join(', ')}.`;

  return { signals, score, headline, summary, counts };
}
