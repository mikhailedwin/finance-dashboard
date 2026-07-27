/** Shape of `public/data/manifest.json`, written by `scripts/fetch-data.ts`. */

import type { Indicator } from '../config/indicators';
import type { RecessionPeriod, SeriesStats } from './series';

/**
 * What actually gets written to disk.
 *
 * Deliberately holds only data-derived facts. Indicator metadata — labels,
 * units, thresholds — is static config that already ships in the JS bundle;
 * duplicating it here would let the snapshot and the code disagree, so that a
 * config edit appeared to do nothing until someone re-ran the fetch.
 */
export interface StoredEntry {
  id: string;
  /** Statistics for the transformed series — i.e. what the chart actually plots. */
  stats: SeriesStats;
  /** Latest raw (untransformed) level. */
  rawLatest: number;
  /**
   * True when the source has not published within the expected window for this
   * series' own cadence. Surfaced in the UI rather than failing the build, since
   * an agency running late should not take the whole dashboard down.
   */
  stale: boolean;
}

export interface StoredManifest {
  generatedAt: string;
  /** Most recent observation date across every series. */
  dataThrough: string;
  entries: Record<string, StoredEntry>;
  recessions: RecessionPeriod[];
}

/** A stored entry joined with its config at load time. */
export interface ManifestEntry extends StoredEntry {
  indicator: Indicator;
}

export interface Manifest extends Omit<StoredManifest, 'entries'> {
  entries: Record<string, ManifestEntry>;
}
