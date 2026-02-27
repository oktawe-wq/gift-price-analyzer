#!/usr/bin/env node
/**
 * scripts/categorize.js
 *
 * Reads data/gifts.json, runs the 4-level taxonomy classifier on each item,
 * adds a `tags: string[]` field, and writes the result back in-place.
 *
 * Patterns here MUST stay in sync with utils/taxonomy.ts.
 * Run after merge-gifts.js whenever the source data changes.
 *
 * Usage:
 *   node scripts/categorize.js
 */

const fs   = require('fs');
const path = require('path');

const GIFTS_PATH = path.join(__dirname, '..', 'data', 'gifts.json');

// ── Taxonomy (mirrors utils/taxonomy.ts) ─────────────────────────────────
// Pattern is tested against lowercased (title + " " + query)

const TAXONOMY = [
  {
    id: 'recipients',
    categories: [
      { id: 'recipients.men',         pattern: /чоловік|хлопц|мужч|другу\b|сину\b|брату\b|тато/ui },
      { id: 'recipients.women',       pattern: /жінк|дівчин|дружин|подруз|дочц|матус|коханій/ui },
      { id: 'recipients.colleagues',  pattern: /колег|шефу|начальник|керівник|корпоратив/ui },
      { id: 'recipients.military',    pattern: /військов|зсу\b|армі|захисник|бойов/ui },
      { id: 'recipients.children',    pattern: /дітям|дівчатк|хлопчик|підлітк|школяр|дитин|дітей/ui },
      { id: 'recipients.special',     pattern: /одногрупник|у якого все є|іноземц/ui },
    ],
  },
  {
    id: 'occasions',
    categories: [
      { id: 'occasions.birthday',    pattern: /день народження|на народження|іменини/ui },
      { id: 'occasions.anniversary', pattern: /\b(12|18|20|25|30|31|40|41|48|50|60)\s*рок|\bювілей\b|повноліт/ui },
      { id: 'occasions.new_year',    pattern: /новий рік|новорічн/ui },
      { id: 'occasions.holiday',     pattern: /14 лютого|закоханих|валентин|миколая|захисника/ui },
      { id: 'occasions.memory',      pattern: /на пам.ять|річниц|при звільненн/ui },
    ],
  },
  {
    id: 'type',
    categories: [
      { id: 'type.premium',    pattern: /елітн|ексклюзивн|vip|статусн|брендов|дорог|розкіш/ui },
      { id: 'type.original',   pattern: /оригінальн|незвичайн|креативн|унікальн|цікав/ui },
      { id: 'type.funny',      pattern: /приколь|з гумором|прикол|смішн/ui },
      { id: 'type.experience', pattern: /враження|емоці|сертифікат/ui },
      { id: 'type.set',        pattern: /набір|бокс\b|box\b|набор/ui },
      { id: 'type.patriotic',  pattern: /патріот|символік|вишиванк|тризуб/ui },
      { id: 'type.practical',  pattern: /практичн|корисн|в машину|тактичн/ui },
      { id: 'type.tech',       pattern: /гаджет|техніка|смарт.годинник|навушник/ui },
    ],
  },
  {
    id: 'special',
    categories: [
      { id: 'special.trends',   pattern: /2026|тренд|новинк/ui },
      { id: 'special.wishlist', pattern: /що попросити|список бажань|wishlist/ui },
      { id: 'special.branded',  pattern: /бренд/ui },
    ],
  },
];

function classifyItem(title, query) {
  const text = ((title ?? '') + ' ' + (query ?? '')).toLowerCase();
  const tags = [];
  for (const group of TAXONOMY) {
    for (const cat of group.categories) {
      if (cat.pattern.test(text)) tags.push(cat.id);
    }
  }
  return tags;
}

// ── Read, tag, write ─────────────────────────────────────────────────────

const gifts = JSON.parse(fs.readFileSync(GIFTS_PATH, 'utf8'));
console.log(`Loaded ${gifts.length} items from gifts.json`);

// Map existing category field → fallback taxonomy tags if regex misses
const CATEGORY_FALLBACK = {
  'Патріотичні':        ['type.patriotic'],
  'Військовим':         ['recipients.military'],
  'Чоловікам':          ['recipients.men'],
  'Жінкам':             ['recipients.women'],
  'Подарункові набори': ['type.set'],
};

const tagged = gifts.map(item => {
  const tags = classifyItem(item.title, item.query);
  // Apply category-based fallback for items that got zero regex matches
  if (tags.length === 0) {
    const fallback = CATEGORY_FALLBACK[item.category] ?? [];
    tags.push(...fallback);
  }
  return { ...item, tags };
});

// ── Stats ─────────────────────────────────────────────────────────────────

const withTags    = tagged.filter(i => i.tags.length > 0).length;
const withoutTags = tagged.length - withTags;
console.log(`Tagged: ${withTags}  |  Untagged: ${withoutTags}\n`);

// Per-category counts
for (const group of TAXONOMY) {
  let groupTotal = 0;
  const lines = [];
  for (const cat of group.categories) {
    const n = tagged.filter(i => i.tags.includes(cat.id)).length;
    if (n > 0) {
      lines.push(`    ${n.toString().padStart(4)}  ${cat.id}`);
      groupTotal += n;
    }
  }
  if (groupTotal > 0) {
    console.log(`  [${group.id}]  total distinct: ${groupTotal}`);
    lines.forEach(l => console.log(l));
  }
}

// Items with NO tags at all
if (withoutTags > 0) {
  console.log(`\n⚠ Untagged items (${withoutTags}):`);
  tagged
    .filter(i => i.tags.length === 0)
    .forEach(i => console.log(`  · [${i.category}] ${i.title.slice(0, 70)}`));
}

// ── Write back ────────────────────────────────────────────────────────────

fs.writeFileSync(GIFTS_PATH, JSON.stringify(tagged, null, 2), 'utf8');
console.log(`\n✓ Wrote ${tagged.length} tagged items → ${GIFTS_PATH}`);
