#!/usr/bin/env node
/**
 * scripts/merge-gifts.js
 *
 * Merges data/final_products_with_stats{1,2,3}.json → data/gifts.json
 *
 * Rules applied:
 *  1. Filter out items where category === 'Інші подарунки'
 *  2. Deduplicate by title (trimmed):
 *       - price_min / price_max from the price spread of all duplicates
 *       - All other fields taken from the duplicate with highest item_popularity
 *  3. Remove url, sourceUrl
 *  4. Rename fields: popularity → query_popularity
 *  5. Assign sequential id (sorted by item_popularity desc)
 *
 * Run:
 *   node scripts/merge-gifts.js
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const SOURCE_FILES = [
  'final_products_with_stats1.json',
  'final_products_with_stats2.json',
  'final_products_with_stats3.json',
];

// ── 1. Load & combine ─────────────────────────────────────────────────────

const raw = SOURCE_FILES.flatMap(f => {
  const file = path.join(DATA_DIR, f);
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`  Loaded ${items.length.toString().padStart(4)} items from ${f}`);
  return items;
});

console.log(`\nTotal raw items: ${raw.length}`);

// ── 2. Filter 'Інші подарунки' ────────────────────────────────────────────

const filtered = raw.filter(item => item.category !== 'Інші подарунки');
const dropped  = raw.length - filtered.length;
console.log(`Dropped ${dropped} items with category 'Інші подарунки'`);
console.log(`Remaining: ${filtered.length} items`);

// ── 3. Deduplicate by title ───────────────────────────────────────────────

/** @type {Map<string, object[]>} */
const byTitle = new Map();

for (const item of filtered) {
  const key = item.title.trim();
  if (!byTitle.has(key)) byTitle.set(key, []);
  byTitle.get(key).push(item);
}

const dupeGroups = [...byTitle.values()].filter(g => g.length > 1).length;
console.log(`Unique titles: ${byTitle.size} (${dupeGroups} had duplicates)`);

// ── 4. Merge each group → one canonical record ────────────────────────────

let id = 1;
const merged = [];

for (const [title, items] of byTitle) {
  const prices = items.map(i => Number(i.price)).filter(p => Number.isFinite(p) && p > 0);

  // Representative: pick the duplicate with highest item_popularity
  const best = items.reduce((a, b) =>
    (Number(b.item_popularity) || 0) > (Number(a.item_popularity) || 0) ? b : a
  );

  merged.push({
    id:               id++,           // placeholder; re-numbered after sort
    title,
    category:         best.category,
    price_min:        prices.length ? Math.min(...prices) : 0,
    price_max:        prices.length ? Math.max(...prices) : 0,
    query:            best.query ?? '',
    query_popularity: Number(best.popularity)      || 0,
    item_popularity:  Number(best.item_popularity) || 0,
    score:            Number(best.score)           || 0,
  });
}

// ── 5. Sort by item_popularity desc, then re-assign ids ──────────────────

merged.sort((a, b) => b.item_popularity - a.item_popularity || b.score - a.score);
merged.forEach((item, i) => { item.id = i + 1; });

// ── 6. Write output ───────────────────────────────────────────────────────

const OUT_PATH = path.join(DATA_DIR, 'gifts.json');
fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), 'utf8');
console.log(`\n✓ Wrote ${merged.length} items → ${OUT_PATH}`);

// ── 7. Category breakdown ─────────────────────────────────────────────────

const cats = {};
for (const item of merged) cats[item.category] = (cats[item.category] ?? 0) + 1;

console.log('\nCategory breakdown:');
Object.entries(cats)
  .sort(([, a], [, b]) => b - a)
  .forEach(([cat, n]) => console.log(`  ${n.toString().padStart(4)}  ${cat}`));

// ── 8. Price range info ───────────────────────────────────────────────────

const prices = merged.map(i => i.price_min).filter(p => p > 0);
if (prices.length) {
  console.log(`\nPrice range: ₴${Math.min(...prices)} – ₴${Math.max(...prices)}`);
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  console.log(`Average price_min: ₴${avg}`);
}
