import { useEffect, useMemo, useState } from 'react';

import { CATEGORIES, CATEGORY_META, HEADLINE_INDICATORS, type Category } from './config/indicators';
import { useManifest } from './hooks/useSeries';
import { prefetchSeries } from './lib/data';
import { formatDate } from './lib/format';
import type { RangeKey } from './lib/range';
import { RangeSelector } from './components/RangeSelector';
import { ThemeToggle } from './components/ThemeToggle';
import { ExecutiveSummary } from './views/ExecutiveSummary';
import { CategoryView } from './views/CategoryView';
import { CompareView } from './views/CompareView';

type ViewKey = 'summary' | Category | 'compare';

const NAV: { key: ViewKey; label: string }[] = [
  { key: 'summary', label: 'Executive Summary' },
  ...CATEGORIES.map((c) => ({ key: c as ViewKey, label: CATEGORY_META[c].label })),
  { key: 'compare', label: 'Compare' },
];

/** Keep the active view in the URL hash so a section can be linked directly. */
function readHash(): ViewKey {
  const hash = window.location.hash.replace(/^#/, '');
  return NAV.some((n) => n.key === hash) ? (hash as ViewKey) : 'summary';
}

export default function App() {
  const { data: manifest, error, loading } = useManifest();
  const [view, setView] = useState<ViewKey>(readHash);
  const [range, setRange] = useState<RangeKey>('10Y');

  useEffect(() => {
    const onHashChange = () => setView(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: ViewKey) => {
    setView(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The summary's tiles are needed immediately on every visit.
  useEffect(() => {
    prefetchSeries(HEADLINE_INDICATORS.map((i) => i.id));
  }, []);

  const title = useMemo(() => NAV.find((n) => n.key === view)?.label ?? '', [view]);

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-20 border-b border-edge bg-page/90 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-ink sm:text-base">
                US Economic Indicators
              </h1>
              <p className="mt-0.5 text-xs text-ink-muted">
                {manifest
                  ? `Leading & coincident indicators · data through ${formatDate(manifest.dataThrough)}`
                  : 'Leading & coincident indicators'}
              </p>
            </div>

            <div className="no-print flex items-center gap-2">
              {view !== 'summary' && <RangeSelector value={range} onChange={setRange} />}
              <ThemeToggle />
            </div>
          </div>

          <nav aria-label="Sections" className="no-print -mb-px mt-3 overflow-x-auto">
            <ul className="flex min-w-max gap-1">
              {NAV.map((item) => {
                const active = item.key === view;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => navigate(item.key)}
                      aria-current={active ? 'page' : undefined}
                      className={`whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-series-1 ${
                        active
                          ? 'border-series-1 text-ink'
                          : 'border-transparent text-ink-muted hover:text-ink-secondary'
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <h2 className="sr-only">{title}</h2>

        {loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-grid/60" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-edge bg-surface p-6">
            <h2 className="text-sm font-semibold text-critical">
              Could not load the data snapshot
            </h2>
            <p className="mt-2 text-sm text-ink-secondary">
              The dashboard reads a static snapshot from <code>public/data/</code>. If you are
              running locally, generate it with <code>npm run refresh:data</code>.
            </p>
            <p className="mt-2 text-xs text-ink-muted">{error.message}</p>
          </div>
        )}

        {manifest && (
          <>
            {view === 'summary' && (
              <ExecutiveSummary manifest={manifest} onNavigate={(c) => navigate(c)} />
            )}
            {view === 'compare' && <CompareView manifest={manifest} range={range} />}
            {view !== 'summary' && view !== 'compare' && (
              <CategoryView category={view} manifest={manifest} range={range} />
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 sm:px-6">
        <div className="border-t border-edge pt-4 text-[11px] leading-relaxed text-ink-muted">
          <p>
            Source data: Federal Reserve Economic Data (FRED), Federal Reserve Bank of St. Louis,
            aggregating releases from the BLS, BEA, Census Bureau, Federal Reserve Board and
            others. Recession bands follow NBER-dated US business cycle contractions.
          </p>
          <p className="mt-1.5">
            {manifest &&
              `Snapshot generated ${new Date(manifest.generatedAt)
                .toISOString()
                .slice(0, 16)
                .replace('T', ' ')} UTC. `}
            Figures are as published or subsequently revised by the source agency; this dashboard
            applies no adjustments of its own.
          </p>
        </div>
      </footer>
    </div>
  );
}
