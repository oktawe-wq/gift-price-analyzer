import fs from 'fs';
import path from 'path';

const inputPath = './data/gifts.json';
const outputPath = './data/gifts_cleaned.json';

function cleanData() {
    console.log('🧹 Начинаю чистку базы данных...');

    if (!fs.existsSync(inputPath)) {
        console.log('❌ Файл gifts.json не найден!');
        return;
    }

    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`📦 Всего записей до чистки: ${rawData.length}`);

    const seen = new Set();
    const cleaned = rawData.filter(item => {
        // 1. Проверка на дубликаты по связке Название + Цена
        const duplicateKey = `${item.title.toLowerCase()}_${item.price}`;
        if (seen.has(duplicateKey)) return false;

        // 2. Фильтр мусора в названиях (слишком короткие или чисто технические)
        if (item.title.length < 15 || item.title.length > 250) return false;
        
        // 3. Фильтр "сломанных" цен (где нет цифр или слишком много текста)
        const digitsInPrice = item.price.replace(/[^\d]/g, '');
        if (digitsInPrice.length < 1 || digitsInPrice.length > 8) return false;

        // 4. Удаление системных строк, которые иногда попадают в парсинг
        const blackList = ['кошик', 'меню', 'вхід', 'реєстрація', 'доставка', 'купити'];
        if (blackList.some(word => item.title.toLowerCase() === word)) return false;

        seen.add(duplicateKey);
        return true;
    });

    // Сортировка по Score (от высокого к низкому)
    cleaned.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2));

    console.log(`✅ Чистка завершена!`);
    console.log(`✨ Осталось уникальных товаров: ${cleaned.length}`);
    console.log(`🗑 Удалено мусора и дублей: ${rawData.length - cleaned.length}`);
    console.log(`💾 Результат сохранен в: ${outputPath}`);
}

cleanData();