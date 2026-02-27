import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const INPUT_PATH = path.join(process.cwd(), 'gifts.json');
const OUTPUT_DIR = path.join(process.cwd(), 'data');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'final_products_categorized.json');

// ─── Категоризация ────────────────────────────────────────────────────────────
function autoCategory(title) {
    if (!title) return "Інші подарунки";
    const t = title.toLowerCase();
    if (t.includes('військ') || t.includes('зсу') || t.includes('армі')) return "Військовим";
    if (t.includes('конструктор') || t.includes('lego') || t.includes('іграшк')) return "Іграшки";
    if (t.includes('набір') || t.includes('box') || t.includes('набор') || t.includes('бокс')) return "Подарункові набори";
    if (t.includes('хлоп') || t.includes('чоловік') || t.includes('мужчин')) return "Чоловікам";
    if (t.includes('дівчин') || t.includes('жінк') || t.includes('девушк')) return "Жінкам";
    if (t.includes('патріот') || t.includes('україн')) return "Патріотичні";
    return "Інші подарунки";
}

// ─── Класифікація вхідного URL ────────────────────────────────────────────────
const SKIP_DOMAINS = [
    'tiktok.com', 'facebook.com', 'instagram.com', 'youtube.com',
    'britvology.ru', 'hoorayheroes.com', 'ukrazom.org',
    'rubikon.com.ua', 'foodandmood.berlin', 'bigmir.net',
    'nikopol.nikopolnews.net', 'polygraphist.kiev.ua'
];

const BLOG_SIGNALS = [
    /\/blog\//, /\/articles?\//, /\/news\//, /\/post\//,
    /\/uk\/news/, /yak-zrobyty/, /shcho-podaruvaty/,
    /ideyi/, /idei-podarunk/, /\/what-is/, /\/kakie_/,
    /podarit-muzhchine/, /podarit-devochke/, /podarit-devushke/
];

function classifyUrl(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    if (SKIP_DOMAINS.some(d => hostname.includes(d))) return 'skip';
    if (BLOG_SIGNALS.some(p => p.test(url))) return 'blog';
    return 'catalog';
}

// ─── Паттерни для карточок товарів по доменам ─────────────────────────────────
const DOMAIN_PRODUCT_PATTERNS = {
    'rozetka.com.ua':        href => /\/p\d+\/$/.test(href) && !/\/comments\/$/.test(href),
    'prom.ua':               href => /\/ua\/[^/]+-\d+\.html$/.test(href) || (/\.html$/.test(href) && /-\d{5,}/.test(href)),
    'kasta.ua':              href => /\/uk\/product\/\d+/.test(href),
    'stall.ua':              href => /\/(uk|ru)\/product\//.test(href),
    'orner.com.ua':          href => /\/(ua|ru)\/product\//.test(href),
    'goodgift.com.ua':      () => !!document.querySelector('.us-product-one-click-top'),
    'exklusi.com':          () => !!document.querySelector('.product_informationss'),
    'elegantsurprise.com.ua':() => !!document.querySelector('.summary.entry-summary'),
    'bugatti-fashion.com.ua':() => !!document.querySelector('.btn-content'),
    'attribute.ua':         () => !!document.querySelector('#buyinOneClick'),
    'uamade.ua':            () => !!document.querySelector('label[id^="sku_"]'),
    'woodenpage.com.ua':    () => !!document.querySelector('.product-heading__title'),
    'kashalot.gift':        () => !!document.querySelector('.product__model-title'),
    'kladovaya-podarkov.com.ua': () => !!document.querySelector('.cs-tab-control__title'),
    'darunok.ua':            href => /\/(ua|ru)\/(catalog|products)\//.test(href),
    'dobralama.com.ua':      href => /\/ua\/[^/]+$/.test(href),
    'presentville.ua':       href => /-p\d+$/.test(href),
    'gifty.in.ua':           href => /\/product[s]?\/[a-z0-9-]+$/.test(href),
    'kashalot.gift':         href => /\/(ua|ru)\/[^/]+\/$/.test(href) && (href.match(/\//g)||[]).length === 5,
    'thebox.in.ua':          href => /\/product\/[a-z0-9-]+/.test(href),
    'carstvo-medy.com.ua':   href => /\/[a-z0-9-]+-\d+\/$/.test(href),
    'kaktus.ua':             href => /\/catalog\/[^/]+\/[^/]+\/$/.test(href) && (href.match(/\//g) || []).length >= 5,
    'exterium.com.ua':       href => /\/product\//.test(href),
    'barbers.ua':            href => /\/[a-z0-9-]+-\d+\/?$/.test(href),
    'folkmart.ua':           href => /\/p\d+/.test(href) || /\/[a-z0-9-]+-\d+\/?$/.test(href),
    'ukrsuv.ua':             href => /\/[a-z0-9-]+-\d+\/?$/.test(href),
    'souvenirua.com':        href => /\/uk\/[^/]+\.html$/.test(href),
    'suveniry.net':          href => /\/p\d+.*\.html$/.test(href),
    'woodenpage.com.ua':     href => /\/[^/]+\/$/.test(href) && (href.match(/\/\//g)||[]).length === 0 && new URL(href).pathname.replace(/\//g,'').length > 30,
    'mir-sharov.kiev.ua':    href => /\/product\//.test(href),
    'giftycorp.in.ua':       href => /\/product\//.test(href),
    '7arts.com.ua':          href => /\/(ua|ru)\/[^/]+\/[a-z0-9-]+-\d+/.test(href),
    'kozaderezza.com':       href => /\/podarunky\/[^/]+$/.test(href) && !/suveniry-ua$/.test(href),
    'zelena.ua':             href => /\/(ua|ru)\/[^/]+\.html$/.test(href) && (href.match(/\//g) || []).length === 4 && href.split(/\/(ua|ru)\//)[2].replace('.html', '').length > 25,
    'itscraft.com.ua':       href => /\/product\//.test(href),
    'smart-gadget.club':     href => /\/[a-z0-9-]+-\d+\/?$/.test(href),
    'znaide.com.ua':         href => /\/[a-z0-9-]+-\d+\/?$/.test(href),
    'podaro4ek.com.ua':      href => /\/ua\/product\//.test(href),
    'piknik.com.ua':         href => /\/tproduct\//.test(href),
    'superpupers.com':       href => /\/(ua\/)?podarok\//.test(href) || /\/product\//.test(href),
    'donum.ua':              href => /\/ua\/[^/]+$/.test(href),
    'brocard.ua':            href => /\/(ua|ru)\/product\//.test(href),
    'prazdnik-shop.com.ua':  href => /\.html$/.test(href),
    'podarki-odessa.com':    href => /\/uk\/.*\.html$/.test(href),
    'elitpodarok.com.ua':      href => /\/product\//.test(href),
    'presenta.com.ua':          href => /\/shop\//.test(href),
    'fama.ua':                  href => /\/(uk|ru)\/p\//.test(href),
    'goodgift.com.ua':          href => /\/ua\//.test(href) && (href.match(/\//g)||[]).length >= 6,
    'exklusi.com':              href => (href.match(/\//g)||[]).length === 3,
    'elegantsurprise.com.ua':   href => /\/product\//.test(href),
    'bugatti-fashion.com.ua':   href => /\/(ua|ru)\/[^/]+-[^/]+\/$/.test(href) && !/podarky|catalog|category/.test(href),
    'attribute.ua':             href => /\.html$/.test(href),
    'uamade.ua':                href => (href.match(/\//g)||[]).length >= 6,
    'delikatto.com.ua':         href => /\/tproduct\//.test(href),
    'likebox.in.ua':            href => /\/product\//.test(href) && !/product-category/.test(href),
    'notino.ua':                href => /\/p-\d+\/$/.test(href),
    'vsklo.com':                href => /\/tproduct\//.test(href),
    'kladovaya-podarkov.com.ua':href => /\/p\d+.*\.html$/.test(href),
    'loadup.com.ua':         href => /\/product\//.test(href),
    'tvoeshop.com':          href => /\/product\//.test(href),
    'anser.in.ua':           href => /\/product\//.test(href),
    'e-pandora.ua':          href => /\/product\//.test(href),
};

// ─── Стоп-список для URL (точно не карточки) ──────────────────────────────────
const STOP_PATH_PATTERNS = [
    /\/cart\b/, /\/checkout/, /\/account/, /\/login/, /\/register/, /\/signup/,
    /\/wishlist/, /\/compare/, /\/search/, /\/filter/, /\/tag\b/,
    /\/blog\//, /\/articles?\//, /\/news\//, /\/about/, /\/contact/, /\/privacy/,
    /\/delivery/, /\/payment/, /\/returns/, /\/faq/, /\/help/,
    /\.(jpg|jpeg|png|gif|pdf|xml|css|js|ico|svg)/i,
    /[?#]/,
];

function isStopUrl(href) {
    return STOP_PATH_PATTERNS.some(p => p.test(href));
}

// ─── Пошук ссилань на карточки ────────────────────────────────────────────────

// ─── Валідатори сторінок (DOM-перевірка після переходу) ───────────────────────
// Якщо для домену задано валідатор — сторінка приймається тільки якщо він true
const DOMAIN_PAGE_VALIDATORS = {
    'zelena.ua':       () => !!document.querySelector('.product-actions__buy-btn'),
    'dobralama.com.ua': () => !!document.querySelector('p.scu'),
    'donum.ua':         () => !!document.querySelector('.row_offset2') && !document.querySelector('.post_nav_box'),
    'goodgift.com.ua':      () => !!document.querySelector('.us-product-one-click-top'),
    'exklusi.com':          () => !!document.querySelector('.product_informationss'),
    'elegantsurprise.com.ua':() => !!document.querySelector('.summary.entry-summary'),
    'bugatti-fashion.com.ua':() => !!document.querySelector('.btn-content'),
    'attribute.ua':         () => !!document.querySelector('#buyinOneClick'),
    'uamade.ua':            () => !!document.querySelector('label[id^="sku_"]'),
    'woodenpage.com.ua':    () => !!document.querySelector('.product-heading__title'),
    'kashalot.gift':        () => !!document.querySelector('.product__model-title'),
    'kladovaya-podarkov.com.ua': () => !!document.querySelector('.cs-tab-control__title'),
    'darunok.ua':       () => !!document.querySelector('button[data-language="product_add_cart"]'),
};

async function isProductPage(page, hostname) {
    const validator = DOMAIN_PAGE_VALIDATORS[hostname];
    if (!validator) return true; // для доменів без валідатора — пропускаємо перевірку
    return page.evaluate(validator);
}

async function findProductLinks(page, sourceUrl, maxLinks = 10) {
    const hostname = new URL(sourceUrl).hostname.replace('www.', '');
    const baseUrl = new URL(sourceUrl).origin;
    const domainMatcher = DOMAIN_PRODUCT_PATTERNS[hostname];

    const rawLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .filter(Boolean)
    );

    const resolved = rawLinks
        .map(href => {
            try {
                const abs = new URL(href, baseUrl).href;
                if (!abs.startsWith(baseUrl)) return null;
                return abs.split('?')[0].split('#')[0];
            } catch { return null; }
        })
        .filter(Boolean);

    const unique = [...new Set(resolved)];

    const productLinks = unique.filter(href => {
        if (isStopUrl(href)) return false;
        if (href === sourceUrl) return false;
        if (domainMatcher) return domainMatcher(href);
        return false;
    });

    return productLinks.slice(0, maxLinks);
}

// ─── Витяг ціни ───────────────────────────────────────────────────────────────
async function extractProductData(page) {
    return page.evaluate(() => {
        const h1 = document.querySelector('h1')?.innerText.trim();
        if (!h1) return null;

        // 1. JSON-LD structured data
        for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
            try {
                const data = JSON.parse(script.textContent);
                const obj = Array.isArray(data) ? data[0] : data;
                const price = obj?.offers?.price || obj?.price;
                if (price) return { h1, p: String(price) };
            } catch {}
        }

        // 2. Meta-теги
        const metaSelectors = [
            'meta[property="product:price:amount"]',
            'meta[name="price"]',
            'meta[property="og:price:amount"]',
            'meta[itemprop="price"]',
        ];
        for (const sel of metaSelectors) {
            const val = document.querySelector(sel)?.getAttribute('content');
            if (val && /\d/.test(val)) return { h1, p: val };
        }

        // 3. Itemprop price
        const itemprop = document.querySelector('[itemprop="price"]');
        if (itemprop) {
            const val = itemprop.getAttribute('content') || itemprop.innerText;
            if (val && /\d/.test(val)) return { h1, p: val };
        }

        // 4. DOM-елементи з ціною
        const priceSelectors = [
            '.product-price', '.price__value', '[class*="price_value"]',
            '[class*="product__price"]', '[class*="priceBox"]',
            '[data-qaid="product_price"]', '.buy-block__price', '.price',
        ];
        for (const sel of priceSelectors) {
            const el = document.querySelector(sel);
            const text = el?.innerText;
            if (text) {
                const m = text.match(/(\d[\d\s]*)/);
                if (m) return { h1, p: m[1] };
            }
        }

        // 5. Fallback regex
        const bodyText = document.body.innerText;
        const m = bodyText.match(/(\d{2,6}(?:\s\d{3})?)\s*(?:грн|₴)/i);
        if (m) return { h1, p: m[1], priceSource: 'fallback' };

        return null;
    });
}

// ─── Головна логіка ───────────────────────────────────────────────────────────
async function start() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
    if (!fs.existsSync(INPUT_PATH)) return console.log("❌ gifts.json не знайдено!");

    const tasks = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    let results = [];
    const processedSourceUrls = new Set();
    const seenProductUrls = new Set();

    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            results = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            results.forEach(r => {
                seenProductUrls.add(r.url);
                processedSourceUrls.add(r.sourceUrl);
            });
        } catch (e) {}
    }

    const pendingTasks = tasks.filter(t => !processedSourceUrls.has(t.url));
    console.log(`🚀 Старт: ${pendingTasks.length} сайтів (${tasks.length - pendingTasks.length} вже оброблено)`);

    let browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    page.setDefaultNavigationTimeout(25000);

    for (let i = 0; i < pendingTasks.length; i++) {
        const task = pendingTasks[i];

        if (i > 0 && i % 20 === 0) {
            await browser.close();
            browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-dev-shm-usage'] });
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            page.setDefaultNavigationTimeout(25000);
            console.log("♻️  Перезапуск браузера");
        }

        const type = classifyUrl(task.url);
        console.log(`\n[${i + 1}/${pendingTasks.length}] ${type.toUpperCase()} → ${task.url}`);

        if (type === 'skip') {
            console.log("   ⏭  Пропуск (нерелевантний домен)");
            processedSourceUrls.add(task.url);
            continue;
        }

        if (type === 'blog') {
            console.log("   📝 Блог — карточок товарів немає, пропуск");
            processedSourceUrls.add(task.url);
            continue;
        }

        try {
            await page.goto(task.url, { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => window.scrollBy(0, 600));
            await new Promise(r => setTimeout(r, 800));

            const productLinks = await findProductLinks(page, task.url);
            console.log(`   🔗 Знайдено посилань: ${productLinks.length}`);

            if (productLinks.length === 0) {
                console.log("   ⚠️  Паттерн не знайшов товарів на цій сторінці");
                processedSourceUrls.add(task.url);
                continue;
            }

            let savedCount = 0;
            for (const pUrl of productLinks) {
                if (seenProductUrls.has(pUrl)) continue;

                try {
                    await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
                    await page.goto(pUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

                    const pHostname = new URL(pUrl).hostname.replace('www.', '');
                    if (!await isProductPage(page, pHostname)) continue;

                    const data = await extractProductData(page);
                    if (!data) continue;

                    const price = parseInt(data.p.toString().replace(/[^\d]/g, ''));
                    if (!price || price < 50 || price > 500000) continue;

                    const item = {
                        title: data.h1.split('|')[0].split(' - ')[0].trim(),
                        price,
                        category: autoCategory(data.h1),
                        url: pUrl,
                        sourceUrl: task.url,
                        query: task.query,
                        popularity: task.popularity,
                        score: task.score,
                        ...(data.priceSource && { priceNote: 'fallback-regex' })
                    };

                    results.push(item);
                    seenProductUrls.add(pUrl);
                    savedCount++;
                    process.stdout.write("·");
                } catch { continue; }
            }

            processedSourceUrls.add(task.url);
            console.log(`\n   ✅ Збережено: ${savedCount} товарів`);

        } catch (err) {
            console.log(`   ❌ Помилка: ${err.message}`);
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

        await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
    }

    await browser.close();
    console.log(`\n\n🎉 Готово. Зібрано товарів: ${results.length}`);

    const byCat = results.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
    }, {});
    console.log("\n📊 По категоріях:");
    Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
}

start().catch(console.error);