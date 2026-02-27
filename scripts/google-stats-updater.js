import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const INPUT_PATH = path.join(process.cwd(), 'data', 'final_products_categorized.json');
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'final_products_with_stats.json');

const waitEnter = () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question('⚠️ Решите капчу и нажмите ENTER...', (ans) => {
        rl.close();
        resolve(ans);
    }));
};

async function start() {
    if (!fs.existsSync(INPUT_PATH)) return console.log("❌ Файл не найден!");

    let products = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    const browser = await puppeteer.launch({ 
        headless: false, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log(`🚀 Работаем в одной вкладке. Всего: ${products.length} товаров.`);

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        // Пропускаем уже готовые
        if (product.item_popularity !== undefined) continue;

        const cleanTitle = product.title.replace(/[^\w\sа-яіїєґА-ЯІЇЄҐ]/g, ' ').trim();
        console.log(`\n🔎 [${i + 1}/${products.length}] "${cleanTitle.substring(0, 40)}..."`);

        try {
            // Переходим по прямой ссылке поиска
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(cleanTitle)}`, { 
                waitUntil: 'domcontentloaded' 
            });

            // Проверка на капчу
            const isCaptcha = await page.evaluate(() => {
                return document.body.innerText.includes('not a robot') || 
                       !!document.querySelector('#captcha-form');
            });

            if (isCaptcha) {
                console.log("🛑 КАПЧА!");
                await waitEnter();
            }

            // Ждем прогрузки блока статистики
            await new Promise(r => setTimeout(r, 3000));

            const stats = await page.evaluate(() => {
                const el = document.querySelector('#result-stats');
                if (!el) return null;
                const match = el.innerText.match(/[\d\s\xA0\u202f]{3,}/);
                return match ? parseInt(match[0].replace(/[^\d]/g, ''), 10) : 0;
            });

            if (stats === null) {
                console.log("❓ Статистика не видна. Если это капча — решите её. Если нет — просто Enter.");
                await waitEnter();
                // Повторная попытка взять данные после нажатия Enter
                product.item_popularity = await page.evaluate(() => {
                    const el = document.querySelector('#result-stats');
                    const match = el?.innerText.match(/[\d\s\xA0\u202f]{3,}/);
                    return match ? parseInt(match[0].replace(/[^\d]/g, ''), 10) : 0;
                });
            } else {
                product.item_popularity = stats;
            }

            console.log(`   📊 Результат: ${product.item_popularity}`);

        } catch (err) {
            console.log(`   ❌ Ошибка: ${err.message}`);
        }

        // Сохраняем прогресс
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(products, null, 2));

        // Пауза между запросами в одной вкладке (человеческая имитация)
        const delay = 4000 + Math.floor(Math.random() * 3000);
        await new Promise(r => setTimeout(r, delay));
    }

    console.log("\n✅ Готово!");
    await browser.close();
}

start();