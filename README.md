# US Economic Indicators Dashboard

A presentation-grade dashboard of the leading and coincident indicators of the US
economy — inflation, interest rates, the labour market, the consumer, housing,
credit conditions and the dollar — with deep history and recession context on
every chart.

Around **60 series**, most with several decades of history (industrial production
runs back to 1919, payrolls to 1939, CPI to 1947).

## Sections

| Section | What it covers |
|---|---|
| **Executive Summary** | Headline KPIs, a recession-signal scorecard, and a written state-of-the-economy summary |
| Growth & Output | GDP, GDPNow nowcast, industrial production, capacity utilisation, capex orders, inventories |
| Inflation & Prices | Core PCE, core and headline CPI, shelter, food, energy, producer prices, breakevens, expectations, wages |
| Labour Market | Unemployment, payrolls, jobless claims, openings, participation, prime-age employment, Sahm rule |
| Rates & Monetary Policy | Fed funds, SOFR, the 3M/2Y/10Y curve, both recession spreads, M2 |
| Consumer | Sentiment, real and nominal retail sales, real spending and income, saving rate, vehicle sales |
| Housing | Starts, permits, Case-Shiller prices, 30-year mortgage rate |
| Credit & Financial Conditions | Chicago Fed NFCI, St. Louis Fed stress index, credit spreads, bank lending standards, VIX, NY Fed recession probability |
| Dollar, Markets & Commodities | Broad dollar index, EUR/JPY/CNY, S&P 500, WTI crude, gasoline |
| **Compare** | Overlay any two indicators, with correlation over the selected window |

## Running it

```bash
npm install
npm run refresh:data   # fetch the FRED snapshot into public/data (needs network)
npm run dev
```

A snapshot is already committed, so `npm run dev` works immediately without the
refresh step.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run refresh:data` | Re-fetch every series from FRED and rewrite `public/data` |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint |

## How the data works

FRED **does not send CORS headers**, so a browser cannot fetch it directly. The
dashboard therefore never calls an API at runtime:

```
scripts/fetch-data.ts  →  public/data/*.json  (committed)  →  static site
```

`scripts/fetch-data.ts` pulls every series listed in `src/config/indicators.ts`,
computes the statistics, derives recession bands from `USREC`, and writes one
JSON file per series plus a `manifest.json`. The site is fully static: no API
key, no runtime network dependency, works offline, and renders identically for
everyone looking at it.

The manifest holds **only data-derived facts** — statistics, staleness, recession
periods. Indicator metadata (labels, units, thresholds) lives solely in
`src/config/indicators.ts` and is joined in at load time, so editing config takes
effect immediately and the snapshot can never disagree with the code.

Charts re-derive transforms in the browser using the same functions the fetch
script used (`src/lib/series.ts`), so a chart cannot drift from the numbers in
the summary.

### Adding an indicator

Add an entry to `INDICATORS` in `src/config/indicators.ts` and run
`npm run refresh:data`. Nothing else needs changing — the fetch script, the
section pages, and the compare picker are all driven from that registry.

## Deployment

Pushes to the default branch, and a weekday schedule, run
`.github/workflows/deploy.yml`: it refreshes the data, commits the snapshot if it
changed, builds, and deploys to GitHub Pages.

No manual setup is needed — the workflow sets the Pages source to **GitHub
Actions** itself via the API before deploying.

That step exists because it is a real trap. If Pages is left in its default
branch-serving mode, GitHub runs its own *pages build and deployment* on every
push, publishing the **raw repository root**: the unbuilt `index.html` that still
points at `/src/main.tsx`, with every `data/*.json` returning 404. It races the
workflow's artifact and wins intermittently, so the site appears to deploy fine
and then breaks. `actions/configure-pages` does not prevent it — its `enablement`
input only creates Pages when absent and will not change the build type of a site
that already exists.

Refresh and deploy are deliberately a single workflow. Commits pushed with
`GITHUB_TOKEN` do not trigger further workflow runs, so splitting them would mean
the deploy never fires and the published site silently goes stale.

`vite.config.ts` sets `base: '/finance-dashboard/'` to match the project Pages
path. For a custom domain or a user/org Pages site, build with `BASE_PATH=/`.

## Notes and caveats

- **The data endpoint.** The fetch script uses FRED's keyless CSV download
  endpoint (`fredgraph.csv`), which is the graph-download route rather than the
  documented REST API. It works, needs no key, and returns full history — but it
  is not a stability contract. If it ever changes, set a `FRED_API_KEY`
  environment variable and the script switches to the official API automatically.
- **Consumer confidence is University of Michigan, not the Conference Board.**
  The Conference Board series (`CONCCONF`) is proprietary and no longer
  distributed via FRED; it returns 404. Michigan Sentiment is the closest
  publicly available equivalent, with far longer history.
- **Credit spreads use Moody's Baa over 10-year Treasuries** (`BAA10Y`, history
  from 1986). The ICE BofA high-yield series is licensed and this endpoint caps
  it to roughly three years, too short to judge against history.
- **Publication lag is normal and differs by series.** GDP is quarterly, and
  Case-Shiller runs about two months behind by design. A series is badged
  *lagging* only when it has missed roughly three of its own publication cycles,
  measured against its own cadence rather than a fixed rule.
- **The written summary is rule-based**, generated by deterministic thresholds
  and percentile comparisons in `src/lib/commentary.ts`. It is not a forecast and
  not model-generated; identical data always produces identical wording.
- **The scorecard is not a forecast.** Each signal applies a published threshold.
  Note in particular that the yield curve typically leads a downturn by 12–18
  months and often un-inverts shortly *before* a recession starts, so a return to
  positive slope is not by itself an all-clear.
- **Revisions.** Figures are shown as published or subsequently revised by the
  source agency. The dashboard applies no adjustments of its own.

## Design

Charts follow a validated colour system: categorical hues are checked for
colour-vision-deficiency separation, light and dark are separately stepped rather
than flipped, and every chart has a data-table twin so no value is reachable only
by hovering.

Two deliberate choices worth noting:

- **No dual-axis charts.** Two y-scales can be aligned arbitrarily and invent a
  correlation that is not in the data. The compare view instead shares one axis
  when units match, indexes both series to 100 when they do not, and falls back
  to small multiples when indexing would be invalid (a series crossing zero).
- **One time-range control for the whole page**, rather than per-card selectors,
  so charts are always compared over the same window.

Long daily series (the 10-year Treasury carries ~16,000 observations) are reduced
for rendering with largest-triangle-three-buckets downsampling, which preserves
visual peaks and troughs rather than dropping them the way naive striding would.

## Attribution

All data from **Federal Reserve Economic Data (FRED)**, Federal Reserve Bank of
St. Louis, aggregating releases from the Bureau of Labor Statistics, Bureau of
Economic Analysis, Census Bureau, Federal Reserve Board, Freddie Mac, S&P Dow
Jones Indices, CBOE and the EIA. Recession bands follow NBER-dated US business
cycle contractions. Each chart links to its source series on FRED.
