/**
 * Build-time data fetch.
 *
 * FRED does not send CORS headers, so the browser cannot call it directly. This
 * script runs in Node (locally or in CI), pulls every series in the indicator
 * registry, and writes a static JSON snapshot into `public/data/` that gets
 * committed to the repo. The dashboard then makes no network calls at runtime:
 * it works offline, needs no API key, and renders identically for everyone.
 *
 *   npm run refresh:data
 *
 * By default this uses FRED's keyless CSV download endpoint. Setting FRED_API_KEY
 * switches to the documented REST API instead — see the README.
 */

import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { INDICATORS, RECESSION_SERIES } from '../src/config/indicators';
import {
  computeStats,
  deriveRecessions,
  prepareSeries,
  toPoints,
  type SeriesData,
} from '../src/lib/series';
import type { StoredEntry, StoredManifest } from '../src/lib/manifest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'data');

const CONCURRENCY = 4;
const MAX_RETRIES = 4;

// ─────────────────────────────── transport ───────────────────────────────

/**
 * Node's global fetch ignores HTTPS_PROXY, which local and sandboxed runs need.
 * We deliberately use undici's own fetch rather than the global one: a
 * ProxyAgent from the standalone undici package is rejected by Node's bundled
 * copy ("invalid onRequestStart method"), so client and dispatcher have to come
 * from the same undici. With no proxy configured this behaves like plain fetch.
 */
async function buildDispatcher() {
  const proxy =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (!proxy) return undefined;

  const { ProxyAgent } = await import('undici');
  console.log(`  using proxy ${proxy}`);
  return new ProxyAgent(proxy);
}

let dispatcher: import('undici').Dispatcher | undefined;

async function fetchText(url: string, attempt = 1): Promise<string> {
  try {
    const { fetch: undiciFetch } = await import('undici');
    const res = await undiciFetch(url, {
      headers: { 'User-Agent': 'us-economic-dashboard/1.0' },
      dispatcher,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    // FRED answers an unknown series id with an HTML error page and a 200 in
    // some cases, so sniff the payload rather than trusting the status alone.
    if (text.trimStart().startsWith('<')) throw new Error('received HTML, not data');
    return text;
  } catch (err) {
    if (attempt > MAX_RETRIES) throw err;
    const waitMs = 2 ** attempt * 500;
    console.warn(`    retry ${attempt}/${MAX_RETRIES} after ${waitMs}ms — ${String(err)}`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchText(url, attempt + 1);
  }
}

// ─────────────────────────────── parsing ───────────────────────────────

/**
 * FRED CSV is `observation_date,SERIES_ID` with missing observations written as
 * an empty field (`2026-01-01,`) rather than a sentinel value.
 */
function parseCsv(csv: string, id: string): SeriesData {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) throw new Error(`${id}: no observations`);

  const dates: string[] = [];
  const values: (number | null)[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const comma = line.indexOf(',');
    if (comma < 0) continue;

    const date = line.slice(0, comma);
    const raw = line.slice(comma + 1).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    dates.push(date);
    if (raw === '' || raw === '.') {
      values.push(null);
    } else {
      const n = Number(raw);
      values.push(Number.isFinite(n) ? n : null);
    }
  }

  if (dates.length === 0) throw new Error(`${id}: parsed zero rows`);
  return { id, dates, values };
}

function parseApiJson(body: string, id: string): SeriesData {
  const json = JSON.parse(body) as {
    observations?: { date: string; value: string }[];
    error_message?: string;
  };
  if (json.error_message) throw new Error(`${id}: ${json.error_message}`);
  if (!json.observations?.length) throw new Error(`${id}: no observations`);

  const dates: string[] = [];
  const values: (number | null)[] = [];
  for (const o of json.observations) {
    dates.push(o.date);
    const n = Number(o.value);
    values.push(o.value === '.' || !Number.isFinite(n) ? null : n);
  }
  return { id, dates, values };
}

async function fetchSeries(id: string): Promise<SeriesData> {
  const apiKey = process.env.FRED_API_KEY;

  if (apiKey) {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${encodeURIComponent(id)}&api_key=${apiKey}&file_type=json`;
    return parseApiJson(await fetchText(url), id);
  }

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;
  return parseCsv(await fetchText(url), id);
}

// ─────────────────────────────── helpers ───────────────────────────────

function daysSince(date: string): number {
  return (Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
}

/**
 * Typical spacing between the most recent observations, in days.
 *
 * Used to judge staleness against each series' own cadence rather than a
 * hardcoded per-frequency table. Publication lag varies a lot between agencies
 * — Case-Shiller is deliberately two months behind — so calibrating on the
 * series itself avoids flagging perfectly normal releases.
 */
function medianGapDays(dates: string[]): number {
  const recent = dates.slice(-25);
  if (recent.length < 3) return 30;

  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    gaps.push((Date.parse(recent[i]) - Date.parse(recent[i - 1])) / 86_400_000);
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] || 30;
}

/** Run `worker` over `items`, at most `limit` in flight at a time. */
async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function round(n: number, dp = 6): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ─────────────────────────────── main ───────────────────────────────

async function main() {
  console.log(`Fetching ${INDICATORS.length} indicators + recession dates from FRED\n`);
  dispatcher = await buildDispatcher();

  await mkdir(OUT_DIR, { recursive: true });

  const failures: string[] = [];
  const warnings: string[] = [];
  const entries: Record<string, StoredEntry> = {};

  // Recession dates first — shading depends on them and a failure here is fatal.
  console.log(`→ ${RECESSION_SERIES} (recession dates)`);
  const usrec = await fetchSeries(RECESSION_SERIES);
  const recessions = deriveRecessions(usrec);
  console.log(`  ${recessions.length} recession periods, latest starting ${recessions.at(-1)?.start}\n`);

  const results = await pool(INDICATORS, CONCURRENCY, async (indicator) => {
    try {
      const raw = await fetchSeries(indicator.id);

      const rawPoints = toPoints(raw);
      if (rawPoints.length === 0) throw new Error('no non-null observations');

      const prepared = prepareSeries(raw, indicator);
      const points = toPoints(prepared);
      const stats = computeStats(points);
      if (!stats) throw new Error('transform produced no usable observations');

      const lastRaw = rawPoints[rawPoints.length - 1];
      const age = daysSince(lastRaw.date);
      // Three missed cycles plus a grace period — loose enough to tolerate a
      // late release, tight enough to catch a genuinely discontinued series.
      const stale = age > medianGapDays(raw.dates) * 3 + 10;
      if (stale) {
        warnings.push(
          `${indicator.id} (${indicator.label}) last updated ${lastRaw.date}, ${Math.round(age)} days ago`,
        );
      }

      // Store raw levels only; the browser re-derives transforms with the same
      // code path this script used, so the two can never drift apart.
      await writeFile(
        join(OUT_DIR, `${indicator.id}.json`),
        JSON.stringify({
          id: raw.id,
          dates: raw.dates,
          values: raw.values.map((v) => (v == null ? null : round(v))),
        }),
      );

      entries[indicator.id] = {
        id: indicator.id,
        stats: { ...stats, latest: round(stats.latest, 4) },
        rawLatest: round(lastRaw.value, 4),
        stale,
      };

      console.log(
        `  ✓ ${indicator.id.padEnd(16)} ${String(rawPoints.length).padStart(6)} obs  ` +
          `${lastRaw.date}  ${stale ? '⚠ stale' : ''}`,
      );
      return true;
    } catch (err) {
      failures.push(`${indicator.id}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`  ✗ ${indicator.id.padEnd(16)} FAILED — ${String(err)}`);
      return false;
    }
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} series failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error('\nRefusing to write a partial snapshot.');
    process.exit(1);
  }

  const dataThrough = Object.values(entries)
    .map((e) => e.stats.latestDate)
    .sort()
    .at(-1)!;

  const manifest: StoredManifest = {
    generatedAt: new Date().toISOString(),
    dataThrough,
    entries,
    recessions,
  };
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest));

  // Remove snapshots for series that have since left the registry.
  const expected = new Set([...INDICATORS.map((i) => `${i.id}.json`), 'manifest.json']);
  for (const file of await readdir(OUT_DIR)) {
    if (file.endsWith('.json') && !expected.has(file)) {
      await unlink(join(OUT_DIR, file));
      console.log(`  removed stale file ${file}`);
    }
  }

  console.log(`\n${results.filter(Boolean).length}/${INDICATORS.length} series written to public/data`);
  console.log(`Data through ${dataThrough}`);

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} series flagged stale (shown as such in the UI):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
}

main().catch((err) => {
  console.error('\nfetch-data failed:', err);
  process.exit(1);
});
