// 1. Определение банка
function identifyBank(docItems) {
    let bank = "не определен";
    const bankSearch = docItems.find(item => item.str.toLowerCase().includes('www.'));

    if (bankSearch) {
        const urlText = bankSearch.str.toLowerCase();
        const match = urlText.match(/www\.([a-z0-9-]+)\./);

        if (match && match[1]) {
            const domainName = match[1];
            switch (domainName) {   
                case 'sberbank': bank = 'Сбербанк'; break;
                case 'tbank':
                case 'tinkoff': bank = 'Т-Банк (Тинькофф)'; break;
                case 'vtb': bank = 'ВТБ'; break;
                case 'alfabank': bank = 'Альфа-Банк'; break;
                default: bank = domainName.charAt(0).toUpperCase() + domainName.slice(1);
            }
        }
    }
    return { bank };
}

// 2. Поиск даты
function findDateByOccurrence(items, target) {
    const datePattern = /\d{2}\.\d{2}\.\d{4}/;
    let count = 0;
    const actualTarget = (target * 2) - 1;

    for (let i = 0; i < items.length; i++) {
        const val = items[i].str ? items[i].str.trim() : "";
        if (datePattern.test(val)) {
            count++;
            if (count === actualTarget) return { item: items[i], index: i };
        }
    }
    return null;
}

// 3. Форматирование денег
function formatMoney(val) {
    if (!val) return null;
    return val.replace(/\s/g, '').replace(',', '.').replace('+', '').trim();
}

// 4. Парсинг даты для JS/MongoDB
function parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.');
    return new Date(Date.UTC(year, month - 1, day));
}

// 5. Поиск суммы и баланса
function findMoney(items, target) {
    const moneyPattern = /[+]?\d{1,3}(?:\s\d{3})*,\d{2}/;
    let count = 0;
    let currentPair = [];

    for (let i = 0; i < items.length; i++) {
        const val = items[i].str ? items[i].str.trim() : "";
        if (moneyPattern.test(val)) {
            currentPair.push({ str: val, x: items[i].x });
            if (currentPair.length === 2) {
                count++; 
                if (count === target) {
                    currentPair.sort((a, b) => a.x - b.x);
                    return {
                        amount: formatMoney(currentPair[0].str),
                        balance: formatMoney(currentPair[1].str)
                    };
                }
                currentPair = []; 
            }
        }
    }
    return null;
}

// 6. Поиск категории
function findCategory(items, target) {
    const codePattern = /^\d{6}$/; 
    let count = 0;
    for (let i = 0; i < items.length; i++) {
        const val = items[i].str ? items[i].str.trim() : "";
        if (codePattern.test(val)) {
            count++;
            if (count === target) {
                for (let j = i + 1; j < items.length; j++) {
                    const categoryVal = items[j].str ? items[j].str.trim() : "";
                    if (categoryVal.length > 0 && !codePattern.test(categoryVal)) return categoryVal; 
                }
            }
        }
    }
    return "Категория не определена";
}

// 7. Поиск комментария
function findCommentary(items, target, categoryName) {
    const codePattern = /^\d{6}$/;
    let currentOccurrence = 0;
    for (let i = 0; i < items.length; i++) {
        const val = items[i].str ? items[i].str.trim() : "";
        if (codePattern.test(val)) {
            currentOccurrence++;
            if (currentOccurrence === target) {
                for (let j = i; j < items.length; j++) {
                    const currentStr = items[j].str.trim();
                    if (currentStr === categoryName) {
                        let nonEmptyStep = 0;
                        for (let k = j + 1; k < items.length; k++) {
                            const stepVal = items[k].str.trim();
                            if (stepVal.length > 0) {
                                nonEmptyStep++;
                                if (nonEmptyStep === 4) return stepVal;
                            }
                            if (codePattern.test(stepVal)) return null;
                        }
                    }
                }
            }
        }
    }
    return null;
}



function categoryTransform(bankCategory) {
    const categories = {
        'others': ['Прочие расходы'],
        'transfers': ['Перевод', 'Перевод на карту', 'Перевод между счетами'],
        'salary': ['Прочие операции', 'Заработная плата'],
        'products': ['Супермаркеты', 'Продукты'],
        'qr': ['QR'],
        'withdrawal': ['Выдача наличных'],
        'home': ['Все для дома', 'Коммунальные платежи, связь, интернет.'],
        'pharmacy': ['Здоровье и красота'],
        'refund': ['Возврат'],
        'cloth': ['Одежда и аксессуары'],
        'entertainment': ['Отдых и развлечения'],
        'automobile': ['Автомобиль'],
    };
const rawLower = bankCategory.toLowerCase();

    let cleanCategory = Object.keys(categories).find(key => 
        categories[key].some(word => rawLower.includes(word.toLowerCase()))
    );

    if (!cleanCategory) {
        cleanCategory = 'others';
    }


    return cleanCategory;
}

// Экспортируем все функции
module.exports = {
    identifyBank,
    findDateByOccurrence,
    formatMoney,
    parseDate,
    findMoney,
    findCategory,
    findCommentary,
    categoryTransform
};