import type { Manifest } from '../lib/manifest';
import type { Category } from '../config/indicators';
import { CATEGORY_META, indicatorsByCategory } from '../config/indicators';
import type { RangeKey } from '../lib/range';
import { IndicatorCard } from '../components/IndicatorCard';

interface Props {
  category: Category;
  manifest: Manifest;
  range: RangeKey;
}

export function CategoryView({ category, manifest, range }: Props) {
  const meta = CATEGORY_META[category];
  const entries = indicatorsByCategory(category)
    .map((i) => manifest.entries[i.id])
    .filter(Boolean);

  return (
    <div>
      <header className="mb-4">
        <h2 className="text-base font-semibold text-ink">{meta.label}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{meta.blurb}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {entries.map((entry) => (
          <IndicatorCard
            key={entry.indicator.id}
            entry={entry}
            recessions={manifest.recessions}
            range={range}
          />
        ))}
      </div>
    </div>
  );
}
