/**
 * Snapshot loading.
 *
 * Everything is a static JSON file under `public/data/`, written at build time
 * by `scripts/fetch-data.ts`. The manifest is small and loaded once up front;
 * individual series are fetched only when a chart needs them, and cached for
 * the life of the page.
 */

import { INDICATOR_BY_ID } from '../config/indicators';
import type { Manifest, ManifestEntry, StoredManifest } from './manifest';
import type { SeriesData } from './series';

const base = import.meta.env.BASE_URL;

const seriesCache = new Map<string, Promise<SeriesData>>();
let manifestPromise: Promise<Manifest> | null = null;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/**
 * Join the stored statistics to the indicator registry that ships in the
 * bundle, so metadata always reflects the current code rather than whatever was
 * true when the snapshot was taken.
 */
function hydrate(stored: StoredManifest): Manifest {
  const entries: Record<string, ManifestEntry> = {};

  for (const [id, entry] of Object.entries(stored.entries)) {
    const indicator = INDICATOR_BY_ID.get(id);
    // A series dropped from the registry can linger in an older snapshot; skip
    // it rather than rendering a card with no definition behind it.
    if (!indicator) continue;
    entries[id] = { ...entry, indicator };
  }

  return { ...stored, entries };
}

export function loadManifest(): Promise<Manifest> {
  manifestPromise ??= getJson<StoredManifest>('manifest.json').then(hydrate);
  return manifestPromise;
}

export function loadSeries(id: string): Promise<SeriesData> {
  let cached = seriesCache.get(id);
  if (!cached) {
    cached = getJson<SeriesData>(`${id}.json`);
    seriesCache.set(id, cached);
  }
  return cached;
}

/** Warm the cache for a set of series without blocking on the result. */
export function prefetchSeries(ids: string[]): void {
  for (const id of ids) void loadSeries(id).catch(() => seriesCache.delete(id));
}
