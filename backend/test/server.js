const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const { 
    identifyBank, 
    findDateByOccurrence, 
    parseDate, 
    findMoney, 
    findCategory, 
    findCommentary,
    categoryTransform
} = require('./pdfScan'); 


// Модели
const User = require('./models/User');
const FileModel = require('./models/File');
const Transaction = require('./models/Transaction');


dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express();


app.use(cors({ origin: '*', exposedHeaders: ['Content-Disposition'] }));
app.use(express.json()); 


// Роуты
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const transactionRoutes = require('./routes/transactions');


app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/transactions', transactionRoutes);




mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
  })
  .then(() => {
    console.log('Uploads directory sync is enabled');
  })
  .catch((err) => console.error('Connection error:', err));



//--------------------СКАНИРОВАНИЕ PDF--------------------

async function scanPdf() {

const filePath = './pdf-for-scan/0001.pdf';

const dataBuffer = new Uint8Array(fs.readFileSync(filePath));

const fontPath = path.join(
        path.dirname(require.resolve('pdfjs-dist/package.json')), 
        'standard_fonts/'
    );

    const loadingTask = pdfjsLib.getDocument({
        data: dataBuffer,
        standardFontDataUrl: fontPath
    });
    
try {
        const pdf = await loadingTask.promise;
        const fullDocData = await extractAllPagesData(pdf); 
        const { bank: detectedBank } = identifyBank(fullDocData);


        await aboutTransaction(fullDocData, detectedBank);

        console.log('Обработка полностью завершена');
    } catch (error) {
        console.error("Ошибка при сканировании PDF:", error);
    }
}


async function extractAllPagesData(pdf) {
    let allItems = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        
        const pageItems = content.items.map(item => ({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            page: i
        }));

        allItems = allItems.concat(pageItems);
    }
    
    return allItems;
}


function parseMoneyToNumber(str) {
    if (!str) return 0;
    const cleanStr = str.replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleanStr) || 0;
}


//-------------------ГЛАВНАЯ ФУНКЦИЯ ОБРАБОТКИ ВЫПИСКИ ИЗ БАНКА-------------------
async function aboutTransaction(docItems, bankName) {
    const totalPages = docItems.length > 0 ? Math.max(...docItems.map(i => i.page)) : 0;
    let globalTransactionNum = 1;
    let lastBalance = null;

    // 1. Поиск номера карты (твой оригинальный блок по координатам)
    const cardElement = docItems.find(item => 
        item.page === 1 && 
        Math.abs(item.x - 60) < 1 &&      
        Math.abs(item.y - 665.86) < 1 &&
        item.str &&                                
        item.str.trim().length > 0   
    );

    const cardNumber = cardElement 
        ? cardElement.str.replace(/•+/g, '').replace(/\s+/g, ' ').trim()
        : "Данные не найдены";

    for (let i = 1; i <= totalPages; i++) {
        let pageTransactions = [];
        const currentPageItems = docItems.filter(item => item.page === i);

        const searchMarker = currentPageItems.findIndex(item => 
            item.str.toUpperCase().includes('ОСТАТОК СРЕДСТВ')
        );

        if (searchMarker !== -1) {
            const dataAfterMarker = currentPageItems.slice(searchMarker + 1);
            let occurrence = 1; 
            let found = true;
            let rawPageData = []; 

            // 2. Сбор всех данных со страницы (сырой буфер)
            while (found) {
                const dateData = findDateByOccurrence(dataAfterMarker, occurrence);
                const rawMoneyData = findMoney(dataAfterMarker, occurrence);
                const categoryData = findCategory(dataAfterMarker, occurrence);
                const commentaryData = findCommentary(dataAfterMarker, occurrence, categoryData);

                if (dateData && rawMoneyData) {
                    rawPageData.push({
                        dateStr: dateData.item.str,
                        money: rawMoneyData, 
                        category: categoryData,
                        commentary: commentaryData
                    });
                    occurrence++; 
                } else {
                    found = false; 
                }
            }

            // 3. Обработка СНИЗУ ВВЕРХ (от старых к новым) для расчета расхода/дохода
            for (let j = rawPageData.length - 1; j >= 0; j--) {
                const item = rawPageData[j];
                
                // Извлекаем суммы через твою функцию парсинга
                const cleanAmount = parseMoneyToNumber(item.money.amount);
                const cleanBalance = parseMoneyToNumber(item.money.balance);
                
                // Трансформация категории (твоя константа)
                const rawCategory = item.category || "Не определено";
                const categoryDataTransformed = categoryTransform(rawCategory);

                let finalAmount = cleanAmount;

                // Сравнение баланса для знака +/-
                if (lastBalance !== null) {
                    if (cleanBalance < lastBalance) {
                        finalAmount = -Math.abs(cleanAmount); // Расход
                    } else if (cleanBalance > lastBalance) {
                        finalAmount = Math.abs(cleanAmount);  // Доход
                    }
                }

                lastBalance = cleanBalance; 

                // Формируем итоговый объект
                pageTransactions.push({
                    date: parseDate(item.dateStr),
                    amount: finalAmount, 
                    balance: cleanBalance,
                    category: item.category,
                    categoryInfo: categoryDataTransformed, // Теперь точно передается правильно
                    bank: `${bankName} ${cardNumber}`.trim(),
                    commentary: item.commentary || "Комментарий не найден",
                    page: i,
                    transactionNum: 0,
                });
            }

            // Переворачиваем обратно, чтобы в БД новые транзакции были сверху (как в PDF)
            pageTransactions.reverse();

            pageTransactions.forEach(transaction => {
                transaction.transactionNum = globalTransactionNum++;
            });
        }
        

        // --- ЗАПИСЬ В БД ---
        if (pageTransactions.length > 0) {
            try {
                await Transaction.insertMany(pageTransactions); 
                console.log(`✅ Страница ${i}: сохранено ${pageTransactions.length} транзакций`);
            } catch (err) {
                console.error(`❌ Ошибка записи страницы ${i}:`, err);
            }
        }
    }
}

// -------------------------------------------------------------



scanPdf()

// -------------------------------------------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
});
