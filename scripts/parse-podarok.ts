/**
 * parse-podarok.ts
 * ─────────────────────────────────────────────────────────────
 * Web scraper for podaroktut.com.ua
 *
 * Extracts: Title, Price (UAH), Product URL, Category Name
 * Saves results to:  data/gifts.json  (overwrites the file)
 *
 * Usage:
 *   npx ts-node --esm scripts/parse-podarok.ts
 *   # or, if you have tsx installed:
 *   npx tsx scripts/parse-podarok.ts
 *
 * What it does:
 *   1. Fetches the site's main catalogue pages (pagination aware).
 *   2. Parses each product card with cheerio.
 *   3. Writes the cleaned array to data/gifts.json.
 *
 * Note: googleResults is initialised to 0 for freshly scraped items.
 *       Run a separate enrichment pass (or fill manually) to populate
 *       popularity data once you have the product list.
 * ─────────────────────────────────────────────────────────────
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ──────────────────────────────────────────────────
const BASE_URL   = 'https://podaroktut.com.ua';
const OUT_FILE   = path.resolve(__dirname, '../data/gifts.json');
const MAX_PAGES  = 10;          // safety cap – raise if catalogue is larger
const DELAY_MS   = 800;         // polite delay between requests (ms)
const USER_AGENT =
  'Mozilla/5.0 (compatible; GiftAnalyzerBot/1.0; +https://github.com/your-repo)';

// ─── Types ────────────────────────────────────────────────────
interface ScrapedProduct {
  id:             number;
  name:           string;
  category:       string;
  price:          number;
  stars:          number;
  reviews:        number;
  daysSinceAdded: number;
  personalization: boolean;
  stock:          boolean;
  googleResults:  number;
  url:            string;
}

// ─── Helpers ──────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parsePrice(raw: string): number {
  // "1 250 грн" → 1250  |  "₴1,250" → 1250
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function parseStars(raw: string): number {
  const n = parseFloat(raw.replace(',', '.'));
  return isNaN(n) ? 0 : Math.min(5, Math.max(0, n));
}

function parseReviews(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

async function fetchPage(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'uk,en;q=0.9' },
    timeout: 15_000,
    responseType: 'text',
  });
  return response.data;
}

// ─── Category page scraper ────────────────────────────────────
/**
 * Scrapes one catalogue page.
 * Adjust the cheerio selectors below to match the actual HTML structure
 * of podaroktut.com.ua (inspect with DevTools / curl | grep -i class).
 *
 * Common patterns for Ukrainian gift shops:
 *   .product-card  |  .catalog-item  |  article.item
 */
async function scrapePage(
  pageUrl: string,
  categoryName: string,
  startId: number,
): Promise<ScrapedProduct[]> {
  const html = await fetchPage(pageUrl);
  const $    = cheerio.load(html);
  const products: ScrapedProduct[] = [];

  // ── Adjust selector to match site's product card container ──
  const CARD_SELECTOR = '.product-card, .catalog-item, .item-card, article.product';

  $(CARD_SELECTOR).each((i, el) => {
    const card = $(el);

    // Title — try common class names in order
    const name =
      card.find('.product-title, .item-title, h2.name, .card-title').first().text().trim() ||
      card.find('a[title]').first().attr('title')?.trim() ||
      '';

    if (!name) return; // skip cards with no title

    // Price — strip non-numeric chars
    const priceRaw =
      card.find('.product-price, .price, .item-price, [class*="price"]').first().text();
    const price = parsePrice(priceRaw);

    // URL
    const href =
      card.find('a.product-link, a[href*="/product"], a[href*="/tovar"]').first().attr('href') ||
      card.find('a').first().attr('href') ||
      '';
    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;

    // Stars (optional — 0 if not present)
    const starsRaw = card.find('.rating, .stars, [class*="star"]').first().text();
    const stars    = parseStars(starsRaw) || 4.5; // fallback

    // Reviews count
    const reviewsRaw = card.find('.reviews-count, .review-count, [class*="review"]').first().text();
    const reviews    = parseReviews(reviewsRaw);

    // Stock — check for an "out of stock" marker
    const outOfStock =
      card.find('.out-of-stock, .unavailable, [class*="out"]').length > 0 ||
      card.text().toLowerCase().includes('немає в наявності');
    const stock = !outOfStock;

    // Personalization — look for a badge / label
    const personalization =
      card.find('[class*="personal"], [class*="engrav"], [class*="graviy"]').length > 0 ||
      card.text().toLowerCase().includes('персоналізація') ||
      card.text().toLowerCase().includes('гравюванням');

    products.push({
      id:             startId + i,
      name,
      category:       categoryName,
      price:          price || 0,
      stars,
      reviews,
      daysSinceAdded: 0,   // not always available on listing pages
      personalization,
      stock,
      googleResults:  0,   // populate with enrichment pass
      url,
    });
  });

  return products;
}

// ─── Category discovery ───────────────────────────────────────
/**
 * Finds category links from the main navigation / menu.
 * Returns [{name, url}] pairs.
 */
async function discoverCategories(): Promise<{ name: string; url: string }[]> {
  console.log(`[discover] fetching ${BASE_URL} …`);
  const html = await fetchPage(BASE_URL);
  const $    = cheerio.load(html);
  const cats: { name: string; url: string }[] = [];

  // Adjust selector to match main nav/menu on podaroktut.com.ua
  const NAV_SELECTOR = 'nav a, .menu a, .categories a, .sidebar a';

  $(NAV_SELECTOR).each((_i, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).text().trim();
    if (!name || !href || href === '/' || href.startsWith('#')) return;
    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    // Only include internal catalogue links
    if (!fullUrl.includes('podaroktut.com.ua')) return;
    cats.push({ name, url: fullUrl });
  });

  // Deduplicate by URL
  const seen = new Set<string>();
  return cats.filter(c => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

// ─── Pagination helper ────────────────────────────────────────
/**
 * Returns the next-page URL if a pagination link exists, else null.
 */
function getNextPageUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);
  const nextHref =
    $('a[rel="next"], .pagination .next a, a.next-page').first().attr('href');
  if (!nextHref) return null;
  return nextHref.startsWith('http') ? nextHref : `${BASE_URL}${nextHref}`;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('=== podaroktut.com.ua scraper v1.0 ===\n');

  const categories = await discoverCategories();

  if (categories.length === 0) {
    console.warn(
      '[warn] No categories found via automatic discovery.\n' +
      '       The site structure may have changed — inspect the HTML\n' +
      '       and adjust NAV_SELECTOR in discoverCategories().',
    );
    // Fallback: hardcode known category URLs
    categories.push(
      { name: 'Мини бары',  url: `${BASE_URL}/mini-bary/`  },
      { name: 'Брелки',     url: `${BASE_URL}/brelky/`     },
      { name: 'Кубки',      url: `${BASE_URL}/kubky/`      },
      { name: 'Игры',       url: `${BASE_URL}/igry/`       },
    );
  }

  console.log(`[info] Found ${categories.length} categories.`);

  const allProducts: ScrapedProduct[] = [];
  let globalId = 1;

  for (const cat of categories) {
    console.log(`\n[cat] ${cat.name} — ${cat.url}`);
    let pageUrl: string | null = cat.url;
    let page = 1;

    while (pageUrl && page <= MAX_PAGES) {
      console.log(`  [page ${page}] ${pageUrl}`);
      try {
        const html     = await fetchPage(pageUrl);
        const products = await scrapePage(pageUrl, cat.name, globalId);

        if (products.length === 0) {
          console.log('  [done] No products found — stopping pagination.');
          break;
        }

        allProducts.push(...products);
        globalId += products.length;
        console.log(`  [ok]   +${products.length} products (total: ${allProducts.length})`);

        pageUrl = getNextPageUrl(html, pageUrl);
        page++;
        if (pageUrl) await sleep(DELAY_MS);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [err]  ${msg} — skipping page`);
        break;
      }
    }
  }

  if (allProducts.length === 0) {
    console.error(
      '\n[error] Scraping returned 0 products.\n' +
      'Steps to debug:\n' +
      '  1. Open https://podaroktut.com.ua in a browser and inspect product card HTML.\n' +
      '  2. Update CARD_SELECTOR in scrapePage() to match the actual class names.\n' +
      '  3. Re-run the script.\n',
    );
    process.exit(1);
  }

  // Write output
  fs.writeFileSync(OUT_FILE, JSON.stringify(allProducts, null, 2), 'utf-8');
  console.log(`\n✓ Saved ${allProducts.length} products → ${OUT_FILE}`);
  console.log(
    '\nNext step: populate the googleResults field.\n' +
    '  Option A — use Google Custom Search JSON API (paid) and enrich each product name.\n' +
    '  Option B — fill in approximate values manually (see data/gifts.json).',
  );
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
