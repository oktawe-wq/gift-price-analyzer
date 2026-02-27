/**
 * scripts/check-data.ts
 *
 * Verifies the merged data/gifts.json and shows taxonomy matches.
 * Run with:  npx ts-node scripts/check-data.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs   = require('fs')   as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as typeof import('path');

// ── Inline taxonomy so this script is self-contained ─────────────────────

interface TaxonomyTag { id: string; label: string; pattern: RegExp }

const TAXONOMY_TAGS: TaxonomyTag[] = [
  { id: 'age',      label: 'Вік / Ювілей',      pattern: /\b\d+\s*рок|\bювілей\b|\bрічниц/ui },
  { id: 'military', label: 'Військовим / ЗСУ',  pattern: /\bвійськов|\bзсу\b|\bтактичн|\bармійськ|\bбойов/ui },
  { id: 'wow',      label: 'WOW-ефект',          pattern: /\b[1-9]\d{2,}\s*см\b|\bгігантськ|\b[2-9]\s*метри?\b/ui },
];

// ── Load data ─────────────────────────────────────────────────────────────

interface GiftItem {
  id:               number;
  title:            string;
  category:         string;
  price_min:        number;
  price_max:        number;
  query:            string;
  query_popularity: number;
  item_popularity:  number;
  score:            number;
}

const giftsPath = path.join(__dirname, '..', 'data', 'gifts.json');
const gifts: GiftItem[] = JSON.parse(fs.readFileSync(giftsPath, 'utf8'));

// ── Basic stats ───────────────────────────────────────────────────────────

console.log('=== data/gifts.json verification ===\n');
console.log(`Total items: ${gifts.length}`);

// ── Category breakdown ────────────────────────────────────────────────────

const catCounts: Record<string, number> = {};
for (const g of gifts) catCounts[g.category] = (catCounts[g.category] ?? 0) + 1;

console.log('\nCategory breakdown:');
Object.entries(catCounts)
  .sort(([, a], [, b]) => b - a)
  .forEach(([cat, n]) => console.log(`  ${n.toString().padStart(4)}  ${cat}`));

// ── Price ranges ──────────────────────────────────────────────────────────

const withRange = gifts.filter(g => g.price_min !== g.price_max);
console.log(`\nItems with price range (min ≠ max): ${withRange.length}`);
withRange.slice(0, 5).forEach(g =>
  console.log(`  ₴${g.price_min}–₴${g.price_max}  ${g.title.slice(0, 60)}`),
);

const allPrices = gifts.map(g => g.price_min).filter(p => p > 0);
if (allPrices.length) {
  console.log(`\nPrice range: ₴${Math.min(...allPrices)} – ₴${Math.max(...allPrices)}`);
  const avg = Math.round(allPrices.reduce((s, p) => s + p, 0) / allPrices.length);
  console.log(`Average price_min: ₴${avg}`);
}

// ── Top items by popularity ───────────────────────────────────────────────

console.log('\nTop 5 by item_popularity:');
[...gifts]
  .sort((a, b) => b.item_popularity - a.item_popularity)
  .slice(0, 5)
  .forEach(g => {
    const pop = g.item_popularity.toLocaleString('uk-UA').padStart(15);
    console.log(`  ${pop}  ${g.title.slice(0, 60)}`);
  });

// ── Taxonomy matches ──────────────────────────────────────────────────────

console.log('\nTaxonomy tag matches:');
for (const tag of TAXONOMY_TAGS) {
  const matches = gifts.filter(g => tag.pattern.test(g.title));
  console.log(`  [${tag.id}] "${tag.label}": ${matches.length} items`);
  matches.slice(0, 3).forEach(g =>
    console.log(`      · ${g.title.slice(0, 70)}`),
  );
}

// ── Missing field check ───────────────────────────────────────────────────

const missing = gifts.filter(g =>
  !g.title || !g.category || g.price_min === undefined || g.score === undefined,
);
console.log(`\nItems with missing required fields: ${missing.length}`);
if (missing.length) missing.forEach(g => console.log('  ·', JSON.stringify(g)));

console.log('\n✓ Check complete.');
