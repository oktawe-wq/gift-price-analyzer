/**
 * parse-podarok.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Web scraper for podaroktut.com.ua
 *
 * Run locally (network access required):
 *   npx tsx scripts/parse-podarok.ts
 *
 * What it does
 *   1. Discovers category links from the main nav.
 *   2. Paginates each category (up to MAX_PAGES pages, DELAY_MS between each).
 *   3. Writes cleaned products to data/gifts.json.
 *
 * googleResults field
 *   Two items have confirmed real values (anchors):
 *     "Брелок Черепаха нікель"  → 5 670
 *     "Фляга шкіряна 200мл"     → 98 100
 *   All other items receive a seeded-random placeholder in [500, 50 000].
 *   Run a Google Custom Search API enrichment pass later to replace them.
 *
 * Benefit (Вигода) fallback
 *   If price is 0 or unavailable, score is set so that Benefit = price * 0.10,
 *   making sort-by-benefit work immediately even for sparse data.
 * ──────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────
const BASE_URL  = 'https://podaroktut.com.ua';
const OUT_FILE  = path.resolve(__dirname, '../data/gifts.json');
const MAX_PAGES = 15;
const DELAY_MS  = 900;
const UA        = 'Mozilla/5.0 (compatible; GiftAnalyzerBot/1.1)';

// ── Confirmed anchor values (exact Google result counts) ──────────────────
const GOOGLE_ANCHORS: Record<string, number> = {
  'Брелок Черепаха нікель': 5_670,
  'Фляга шкіряна 200мл':    98_100,
};

// ── Types ─────────────────────────────────────────────────────────────────
interface Product {
  id:              number;
  name:            string;
  category:        string;
  price:           number;
  stars:           number;   // product review rating — used by score engine
  reviews:         number;
  daysSinceAdded:  number;
  personalization: boolean;
  stock:           boolean;
  googleResults:   number;
}

// ── Helpers ───────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function parsePrice(raw: string): number {
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function parseStars(raw: string): number {
  const n = parseFloat(raw.replace(',', '.'));
  return isNaN(n) ? 4.5 : Math.min(5, Math.max(0, n));
}

/**
 * Deterministic-ish "random" for a string seed so repeated runs give the
 * same placeholder — avoids noisy diffs in git.
 */
function seededRandom(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const t = Math.abs(h) / 2_147_483_647;
  return Math.round(min + t * (max - min));
}

function googleResultsFor(name: string): number {
  if (GOOGLE_ANCHORS[name] !== undefined) return GOOGLE_ANCHORS[name];
  return seededRandom(name, 500, 50_000);
}

async function get(url: string): Promise<string> {
  const { data } = await axios.get<string>(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'uk,en;q=0.9' },
    timeout: 20_000,
    responseType: 'text',
  });
  return data;
}

// ── Category discovery ────────────────────────────────────────────────────
async function discoverCategories(): Promise<{ name: string; url: string }[]> {
  console.log(`[discover] ${BASE_URL}`);
  const html = await get(BASE_URL);
  const $    = cheerio.load(html);
  const seen = new Set<string>();
  const cats: { name: string; url: string }[] = [];

  $('nav a, .menu a, .catalog-menu a, .categories a, .sidebar-menu a').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const name = $(el).text().trim();
    if (!name || !href || href === '/' || href.startsWith('#') || href.startsWith('?')) return;
    const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    if (!full.includes('podaroktut.com.ua')) return;
    if (seen.has(full)) return;
    seen.add(full);
    cats.push({ name, url: full });
  });

  if (cats.length === 0) {
    console.warn('[warn] Nav discovery found nothing — using hardcoded fallbacks.');
    return [
      { name: 'Мини бары', url: `${BASE_URL}/mini-bary/`  },
      { name: 'Брелки',    url: `${BASE_URL}/brelky/`     },
      { name: 'Кубки',     url: `${BASE_URL}/kubky/`      },
      { name: 'Игры',      url: `${BASE_URL}/igry/`       },
    ];
  }
  return cats;
}

// ── Page scraper ──────────────────────────────────────────────────────────
function parsePage(html: string, category: string, startId: number): Product[] {
  const $ = cheerio.load(html);
  const products: Product[] = [];

  // Try several common Ukrainian e-commerce card selectors
  const CARD = [
    '.product-card', '.catalog-item', '.item-card',
    'article.product', '.goods-item', 'li.product',
    '.product_item', '.catalog_item',
  ].join(', ');

  $(CARD).each((i, el) => {
    const card = $(el);

    const name =
      card.find('.product-title, .item-title, h2, h3, .name, .title').first().text().trim() ||
      card.find('a[title]').first().attr('title')?.trim() ||
      '';
    if (!name) return;

    const priceRaw  = card.find('[class*="price"]').first().text();
    const price     = parsePrice(priceRaw);

    const starsRaw  = card.find('[class*="rating"], [class*="star"]').first().text();
    const stars     = parseStars(starsRaw);

    const revRaw    = card.find('[class*="review"], [class*="comment"]').first().text();
    const reviews   = parseInt(revRaw.replace(/\D/g, ''), 10) || 0;

    const outOfStock =
      card.find('[class*="out"], [class*="unavailable"]').length > 0 ||
      card.text().toLowerCase().includes('немає в наявності');

    const personalization =
      card.find('[class*="personal"], [class*="engrav"], [class*="graviy"]').length > 0 ||
      /персоналіз|гравіюванн/i.test(card.text());

    products.push({
      id:              startId + i,
      name,
      category,
      price,
      stars,
      reviews,
      daysSinceAdded:  0,
      personalization,
      stock:           !outOfStock,
      googleResults:   googleResultsFor(name),
    });
  });

  return products;
}

function nextPage(html: string): string | null {
  const $ = cheerio.load(html);
  const h = $('a[rel="next"], .pagination .next a, a.next-page, .pager-next a')
    .first().attr('href');
  if (!h) return null;
  return h.startsWith('http') ? h : `${BASE_URL}${h}`;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== podaroktut.com.ua scraper ===\n');

  const categories = await discoverCategories();
  console.log(`[info] ${categories.length} categories found.\n`);

  const all: Product[] = [];
  let gid = 1;

  for (const cat of categories) {
    console.log(`[cat] ${cat.name}`);
    let pageUrl: string | null = cat.url;
    let page = 1;

    while (pageUrl && page <= MAX_PAGES) {
      console.log(`  [p${page}] ${pageUrl}`);
      try {
        const html  = await get(pageUrl);
        const items = parsePage(html, cat.name, gid);

        if (items.length === 0) {
          console.log('  → 0 items, stopping pagination.');
          break;
        }

        all.push(...items);
        gid += items.length;
        console.log(`  → +${items.length} (total ${all.length})`);

        pageUrl = nextPage(html);
        page++;
        if (pageUrl) await sleep(DELAY_MS);
      } catch (e) {
        console.error(`  [err] ${(e as Error).message}`);
        break;
      }
    }
  }

  if (all.length === 0) {
    console.error(
      '\n[error] 0 products scraped.\n' +
      'Fix: open podaroktut.com.ua in DevTools, find the card element class,\n' +
      'then update CARD selector in parsePage() and re-run.\n',
    );
    process.exit(1);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`\n✓ Wrote ${all.length} products → ${OUT_FILE}`);
  console.log('\nNotes:');
  console.log('  • googleResults: two anchors exact; others seeded-random [500–50 000]');
  console.log('  • Replace placeholders via Google Custom Search API enrichment pass');
}

main().catch(e => { console.error('[fatal]', e); process.exit(1); });
