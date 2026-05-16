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

// Импортируем middleware авторизации
const auth = require('./middleware/auth');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express();

app.use(cors({ origin: '*', exposedHeaders: ['Content-Disposition'] }));
app.use(express.json()); 

// Настройка Multer для сохранения загруженных файлов во временную папку 'uploads/'
const upload = multer({ dest: 'uploads/' });

// Роуты
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const transactionRoutes = require('./routes/transactions');

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/transactions', transactionRoutes);

// --- НОВЫЙ ЭНДПОИНТ ДЛЯ ЗАГРУЗКИ PDF ИЗ КОМПОНЕНТА ФРОНТЕНДА ---
app.post('/api/transactions/upload-pdf', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Файл не загружен' });
        }

        const filePath = req.file.path; // Путь к загруженному временному файлу
        const userId = req.user.userId; // Достаем id пользователя из JWT токена

        // Запускаем сканирование и передаем динамический путь и userId
        const savedCount = await scanPdf(filePath, userId);

        // Удаляем временный файл с сервера после обработки, чтобы не забивать диск
        fs.unlinkSync(filePath);

        res.status(200).json({
            message: 'Выписка успешно обработана',
            count: savedCount
        });
    } catch (error) {
        console.error("Ошибка при загрузке и обработке PDF:", error);
        // На случай ошибки тоже пытаемся удалить временный файл
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ 
            message: 'Ошибка сервера при обработке выписки', 
            error: error.message 
        });
    }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
  })
  .then(() => {
    console.log('Uploads directory sync is enabled');
  })
  .catch((err) => console.error('Connection error:', err));


//--------------------СКАНИРОВАНИЕ PDF (ОБНОВЛЕННАЯ)--------------------
// Теперь функция принимает filePath и userId
async function scanPdf(filePath, userId) {
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

        // Передаем userId дальше в функцию парсинга транзакций
        const totalSaved = await aboutTransaction(fullDocData, detectedBank, userId);

        console.log('Обработка полностью завершена');
        return totalSaved; // Возвращаем количество успешных записей
    } catch (error) {
        console.error("Ошибка при сканировании PDF:", error);
        throw error; // Бросаем ошибку выше в catch роута
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


//-------------------ГЛАВНАЯ ФУНКЦИЯ ОБРАБОТКИ ВЫПИСКИ ИЗ БАНКА (ОБНОВЛЕННАЯ)-------------------
// Добавили параметр userId
async function aboutTransaction(docItems, bankName, userId) {
    const totalPages = docItems.length > 0 ? Math.max(...docItems.map(i => i.page)) : 0;
    let globalTransactionNum = 1;
    let lastBalance = null;
    let totalSavedTransactions = 0; // Счётчик для ответа фронтенду

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

            for (let j = rawPageData.length - 1; j >= 0; j--) {
                const item = rawPageData[j];
                
                const cleanAmount = parseMoneyToNumber(item.money.amount);
                const cleanBalance = parseMoneyToNumber(item.money.balance);
                
                const rawCategory = item.category || "Не определено";
                const categoryDataTransformed = categoryTransform(rawCategory);

                let finalAmount = cleanAmount;

                if (lastBalance !== null) {
                    if (cleanBalance < lastBalance) {
                        finalAmount = -Math.abs(cleanAmount); 
                    } else if (cleanBalance > lastBalance) {
                        finalAmount = Math.abs(cleanAmount);  
                    }
                }

                lastBalance = cleanBalance; 

                pageTransactions.push({
                    date: parseDate(item.dateStr),
                    amount: finalAmount, 
                    balance: cleanBalance,
                    category: item.category,
                    categoryInfo: categoryDataTransformed, 
                    bank: `${bankName} ${cardNumber}`.trim(),
                    commentary: item.commentary || "Комментарий не найден",
                    page: i,
                    transactionNum: 0,
                    userId: userId, // <-- НАША ЖЕСТКАЯ ПРИВЯЗКА КАЖДОЙ ТРАНЗАКЦИИ К ПОЛЬЗОВАТЕЛЮ
                });
            }

            pageTransactions.reverse();

            pageTransactions.forEach(transaction => {
                transaction.transactionNum = globalTransactionNum++;
            });
        }
        
        // --- ЗАПИСЬ В БД ---
        if (pageTransactions.length > 0) {
            try {
                await Transaction.insertMany(pageTransactions); 
                totalSavedTransactions += pageTransactions.length;
                console.log(`✅ Страница ${i}: сохранено ${pageTransactions.length} транзакций`);
            } catch (err) {
                console.error(`❌ Ошибка записи страницы ${i}:`, err);
            }
        }
    }

    return totalSavedTransactions;
}


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
});