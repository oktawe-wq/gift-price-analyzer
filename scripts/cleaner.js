import fs from 'fs';

const inputPath = './data/gifts.json';
const outputPath = './data/gifts_cleaned.json';

function cleanData() {
    if (!fs.existsSync(inputPath)) return console.log('❌ Файл не найден!');

    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const seenTitlePrice = new Set();
    const seenUrls = new Set(); // Для борьбы с многократными ссылками на одну статью

    const cleaned = rawData.filter(item => {
        const title = item.title.trim();
        const titleLower = title.toLowerCase();
        const url = item.url.toLowerCase();
        const priceRaw = item.price.replace(/\n/g, ' ').trim();

        // 1. ПРОВЕРКА НА СТАТЬИ (Глубокая)
        const articleKeywords = ['як ', 'що ', 'топ ', 'ідеї', 'варіанти', 'поради', 'вибрати', 'обірати', 'подарунки для'];
        if (articleKeywords.some(key => titleLower.startsWith(key))) return false;
        if (title.length > 120 || title.split(' ').length > 12) return false; // Слишком длинные заголовки - это SEO тексты
        if (title.includes('?')) return false;

        // 2. ОЧИСТКА И ПРОВЕРКА ЦЕНЫ
        const priceDigits = priceRaw.replace(/[^\d]/g, '');
        if (priceDigits.length < 2 || priceDigits.length > 6) return false; // Убираем "899 809" и "0"
        if (priceRaw.includes('-')) return false; // Убираем диапазоны "100 - 500"
        if (/ціна|грн/i.test(priceRaw) && priceRaw.length > 15) return false; // Убираем строки типа "Ціна від 200 до 1000 грн"

        // 3. УДАЛЕНИЕ ДУБЛИКАТОВ ССЫЛОК
        // Если с одного сайта (URL) мы спарсили 20 "товаров", это скорее всего блоки ссылок внизу статьи
        if (seenUrls.has(url)) {
            // Разрешаем максимум 5 товаров с одного URL, остальное - в топку
            const count = [...seenUrls].filter(x => x === url).length;
            if (count > 5) return false;
        }
        seenUrls.add(url);

        // 4. УДАЛЕНИЕ ДУБЛИКАТОВ НАЗВАНИЙ
        const duplicateKey = `${titleLower}_${priceDigits}`;
        if (seenTitlePrice.has(duplicateKey)) return false;
        seenTitlePrice.add(duplicateKey);

        // 5. УДАЛЕНИЕ ТЕХНИЧЕСКОГО КАПСА
        const isCaps = title === title.toUpperCase() && title.length > 10;
        if (isCaps) return false;

        return true;
    });

    // Финальная сортировка
    cleaned.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2));
    console.log(`📦 Было: ${rawData.length} | ✨ Стало: ${cleaned.length} | 🗑 Удалено: ${rawData.length - cleaned.length}`);
}

cleanData();