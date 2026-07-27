/** Value and date formatting for tiles, axes and tooltips. */

import type { Format, Indicator } from '../config/indicators';

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function fixed(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export interface FormatOptions {
  /** Prefix positive values with '+' — used for changes, not levels. */
  signed?: boolean;
  /** Drop the unit suffix, for dense axis ticks. */
  bare?: boolean;
}

export function formatValue(
  value: number | null | undefined,
  format: Format,
  decimals: number,
  options: FormatOptions & { scale?: number } = {},
): string {
  if (value == null || !Number.isFinite(value)) return '—';

  const { signed = false, bare = false, scale = 1 } = options;
  const sign = signed && value > 0 ? '+' : '';

  switch (format) {
    case 'percent':
      return `${sign}${fixed(value, decimals)}${bare ? '' : '%'}`;
    case 'currency':
      return `${value < 0 ? '-' : sign}$${fixed(Math.abs(value), decimals)}`;
    case 'count': {
      const scaled = value * scale;
      // Compact notation loses too much at small magnitudes (0.4K reads worse
      // than 400), so only switch to it once the number is genuinely large.
      if (Math.abs(scaled) >= 1000) return `${sign}${compact.format(scaled)}`;
      return `${sign}${fixed(scaled, 0)}`;
    }
    case 'index':
    case 'number':
    default:
      return `${sign}${fixed(value, decimals)}`;
  }
}

/** Format a value using an indicator's own units. */
export function formatIndicator(
  value: number | null | undefined,
  indicator: Indicator,
  options: FormatOptions = {},
): string {
  return formatValue(value, indicator.format, indicator.decimals, {
    ...options,
    scale: indicator.scale,
  });
}

/**
 * Units of the *transformed* series. A year-on-year transform turns an index
 * into a percentage, so the display units are not always the indicator's own.
 */
export function displayFormat(indicator: Indicator): { format: Format; decimals: number; scale?: number } {
  if (indicator.transform === 'yoy') return { format: 'percent', decimals: indicator.decimals };
  return { format: indicator.format, decimals: indicator.decimals, scale: indicator.scale };
}

export function formatDisplay(
  value: number | null | undefined,
  indicator: Indicator,
  options: FormatOptions = {},
): string {
  const { format, decimals, scale } = displayFormat(indicator);
  return formatValue(value, format, decimals, { ...options, scale });
}

/** Suffix describing what the plotted number represents. */
export function transformSuffix(indicator: Indicator): string {
  switch (indicator.transform) {
    case 'yoy':
      return 'year-on-year';
    case 'diff':
      return 'change from prior month';
    default:
      return '';
  }
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Date label appropriate to how often the series is published. */
export function formatPeriod(iso: string, frequency: Indicator['frequency']): string {
  const [y, m, d] = iso.split('-').map(Number);
  switch (frequency) {
    case 'annual':
      return String(y);
    case 'quarterly':
      return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    case 'monthly':
      return `${MONTHS[m - 1]} ${y}`;
    default:
      return `${d} ${MONTHS[m - 1]} ${y}`;
  }
}

/**
 * Axis tick label, scaled to the span in view.
 *
 * Past four years the ticks land on January of each year, so the month adds
 * nothing and "Jan 18" invites being misread as a day of the month — show the
 * bare year instead. Inside that, an apostrophe marks the year unambiguously.
 */
export function formatAxisDate(t: number, spanYears: number): string {
  const dt = new Date(t);
  const y = dt.getUTCFullYear();
  const m = MONTHS[dt.getUTCMonth()];
  if (spanYears > 4) return String(y);
  if (spanYears > 0.75) return `${m} '${String(y).slice(2)}`;
  return `${dt.getUTCDate()} ${m}`;
}

export function formatRelativeTime(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.round(days / 365.25)} years ago`;
}
