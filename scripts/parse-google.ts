import puppeteer from 'puppeteer';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

const queries = [
  "Елітні подарунки", "Корпоративні подарунки", "Подарунок враження", "Подарунковий набір",
  "Подарунки для дорослих", "Подарунки для дівчат", "Цікаві подарунки для жінок",
  "Подарунки для чоловіків", "Патріотичні подарунки", "Статусні подарунки",
  "Ексклюзивні подарунки", "Дорогие подарки", "Елітні подарунки для чоловіків",
  "Елітні подарунки для жінок", "Брендовые подарки", "Вип подарки украина",
  "Дорогі подарунки", "Подарунок емоції", "Враження в подарунок",
  "Практичні подарунки для жінок", "Корисні подарунки для жінок",
  "Оригінальний подарунок для жінки на День народження", "Недорогі подарунки для жінок",
  "Подарунок для жінки 40 років", "Подарунки на день народження для чоловіків",
  "Прикольні подарунки на День Народження Жінці", "Прикольні подарунки на День народження Чоловіку",
];

const DATA_PATH = path.join(process.cwd(), 'gifts.json');

interface SearchResult {
  id:           string;
  source_title: string;
  url:          string;
  popularity:   number;
  score:        number;
  query:        string;
  collected_at: string;
}

interface PageItem {
  source_title: string;
  url:          string;
  position:     number;
}

const waitForEnter = (message: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(message, (ans: string) => { rl.close(); resolve(ans); }));
};

async function start() {
  console.log(`🚀 ИНИЦИАЛИЗАЦИЯ: Файл будет здесь -> ${DATA_PATH}`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  const blacklist = ['youtube.com', 'facebook.com', 'instagram.com', 'pinterest.com', 't.me', 'prom.ua', 'olx.ua'];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`\n🔎 [${i + 1}/${queries.length}] Обработка: "${query}"`);

    try {
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });

      const isCaptcha = await page.evaluate(() =>
        document.body.innerHTML.includes('not a robot') ||
        document.body.innerHTML.includes('g-recaptcha') ||
        !!document.querySelector('#captcha-form'),
      );

      if (isCaptcha) {
        console.log('🚨 ВНИМАНИЕ: Google выставил капчу!');
        await waitForEnter('⌨️ Реши её в окне и нажми [ENTER] здесь...');
      }

      const pageData = await page.evaluate((): { popClean: string; items: PageItem[] } => {
        const stats = (document.querySelector('#result-stats') as HTMLElement)?.innerText ?? '';
        const popMatch = stats.match(/[\d\s\xA0]{3,}/);
        const popClean = popMatch ? popMatch[0].replace(/[^\d]/g, '') : '0';

        const items: PageItem[] = Array.from(document.querySelectorAll('h3'))
          .map((h3, index) => {
            const a = h3.closest('a');
            if (!a) return null;
            let cleanUrl = a.href.split('&ved=')[0].split('?utm_')[0].split('#')[0];
            if (cleanUrl.includes('google.com') || cleanUrl.startsWith('/')) return null;
            return { source_title: (h3 as HTMLElement).innerText, url: cleanUrl, position: index };
          })
          .filter((item): item is PageItem => item !== null);

        return { popClean, items };
      });

      pageData.items.forEach(item => {
        const isBlacklisted = blacklist.some(domain => item.url.includes(domain));
        if (!seenUrls.has(item.url) && !isBlacklisted) {
          seenUrls.add(item.url);
          allResults.push({
            id:           Math.random().toString(36).substr(2, 8),
            source_title: item.source_title,
            url:          item.url,
            popularity:   Number(pageData.popClean) || 0,
            score:        Number((10 - item.position * 0.7).toFixed(1)),
            query,
            collected_at: new Date().toISOString(),
          });
        }
      });

      fs.writeFileSync(DATA_PATH, JSON.stringify(allResults, null, 2));
      console.log(`   ✅ Успех: ${pageData.items.length} ссылок добавлено. Pop: ${pageData.popClean}`);

    } catch (err) {
      console.log(`   ❌ Сбой на запросе: ${(err as Error).message}`);
    }

    const wait = Math.floor(Math.random() * 7000) + 8000;
    await new Promise(r => setTimeout(r, wait));
  }

  await browser.close();
  console.log('\n💎 СБОР ЗАВЕРШЕН. Данные в gifts.json готовы на 100%.');
}

start();
