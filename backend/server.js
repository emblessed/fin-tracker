const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const mongoose = require('mongoose');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const {
  identifyBank,
  findDateByOccurrence,
  parseDate,
  findMoney,
  findCategory,
  findCommentary,
  categoryTransform,
} = require('./pdfScan');

const Transaction = require('./models/Transaction');
const Family = require('./models/Family');
const FamilyTransaction = require('./models/FamilyTransaction');
const auth = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const transactionRoutes = require('./routes/transactions');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({ origin: '*', exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/transactions', transactionRoutes);

const getCurrentFamily = async (userId) => {
  return Family.findOne({ 'members.user': userId });
};

const removeUploadedFile = (file) => {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
};

const getUserName = (user) => {
  if (!user) return 'Участник семьи';

  return (
    user.fullname?.trim() ||
    user.login?.trim() ||
    user.email?.trim() ||
    'Участник семьи'
  );
};

const normalizeFamilyTransactionResponse = (transaction, source) => {
  const user =
    transaction.userId && typeof transaction.userId === 'object'
      ? transaction.userId
      : null;

  const userDto = user
    ? {
        id: String(user._id),
        fullname: user.fullname || '',
        login: user.login || '',
        email: user.email || '',
        name: getUserName(user),
      }
    : null;

  return {
    ...transaction,
    source,
    userId: userDto?.id || String(transaction.userId || ''),
    user: userDto,
    uploadedBy: userDto?.name || 'Участник семьи',
  };
};

const getSortValue = (item, field) => {
  const value = item[field];

  if (value === undefined || value === null) return 0;

  if (field === 'date' || field === 'createdAt' || field === 'updatedAt') {
    return new Date(value).getTime() || 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  return String(value);
};

const CATEGORY_LABELS = {
  salary: 'Зарплата',
  salaries: 'Зарплата',
  income: 'Доходы',
  transfer: 'Переводы',
  transfers: 'Переводы',
  withdrawal: 'Снятие наличных',
  withdrawals: 'Снятие наличных',
  atm: 'Снятие наличных',
  refund: 'Возврат',
  refunds: 'Возврат',
  products: 'Продукты',
  product: 'Продукты',
  food: 'Еда',
  groceries: 'Продукты',
  grocery: 'Продукты',
  supermarket: 'Супермаркеты',
  supermarkets: 'Супермаркеты',
  transport: 'Транспорт',
  transportation: 'Транспорт',
  taxi: 'Такси',
  fuel: 'Топливо',
  automobile: 'Автомобиль',
  auto: 'Автомобиль',
  car: 'Автомобиль',
  cars: 'Автомобиль',
  restaurant: 'Рестораны',
  restaurants: 'Рестораны',
  cafe: 'Кафе',
  cafes: 'Кафе',
  services: 'Услуги',
  service: 'Услуги',
  utilities: 'Коммунальные услуги',
  cash: 'Наличные',
  cloth: 'Одежда',
  clothes: 'Одежда',
  clothing: 'Одежда',
  apparel: 'Одежда',
  entertainment: 'Развлечения',
  home: 'Дом',
  house: 'Дом',
  pharmacy: 'Аптеки',
  pharmacies: 'Аптеки',
  drugstore: 'Аптеки',
  medicine: 'Аптеки',
  health: 'Здоровье',
  education: 'Образование',
  shopping: 'Покупки',
  beauty: 'Красота',
  sport: 'Спорт',
  sports: 'Спорт',
  travel: 'Путешествия',
  hotel: 'Отели',
  hotels: 'Отели',
  internet: 'Интернет',
  mobile: 'Связь',
  communication: 'Связь',
  subscription: 'Подписки',
  subscriptions: 'Подписки',
  insurance: 'Страхование',
  tax: 'Налоги',
  taxes: 'Налоги',
  fees: 'Комиссии',
  fee: 'Комиссии',
  qr: 'QR',
  other: 'Другое',
  others: 'Другое',
  misc: 'Другое',
  miscellaneous: 'Другое',
};

const normalizeCategoryLabel = (value) => {
  const raw = String(value || '').trim();
  const key = raw.toLowerCase();

  if (!raw) return 'Другое';
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  if (/^[a-z][a-z\s_-]*$/i.test(raw)) return 'Другое';

  return raw;
};

const normalizeCategoryLimit = (item) => {
  const category = normalizeCategoryLabel(item?.category);
  const limit = Number(item?.limit);

  if (!category || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  return {
    category,
    limit: Math.round(limit * 100) / 100,
  };
};

const normalizeCategoryLimits = (limits) => {
  if (!Array.isArray(limits)) {
    return [];
  }

  const uniqueLimits = new Map();

  limits.forEach((limit) => {
    const normalizedLimit = normalizeCategoryLimit(limit);

    if (!normalizedLimit) {
      return;
    }

    uniqueLimits.set(normalizedLimit.category.toLowerCase(), normalizedLimit);
  });

  return Array.from(uniqueLimits.values())
    .slice(0, 50)
    .sort((a, b) => a.category.localeCompare(b.category, 'ru'));
};

const getCategoryLimitsDto = (family) => {
  return normalizeCategoryLimits(family?.categoryLimits || []);
};

app.post('/api/transactions/upload-pdf', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    const savedCount = await scanPdf(req.file.path, req.user.userId, {
      model: Transaction,
      extraFields: {},
    });

    removeUploadedFile(req.file);

    res.status(200).json({
      message: 'Выписка успешно обработана',
      count: savedCount,
      scope: 'personal',
    });
  } catch (error) {
    console.error('Ошибка при загрузке и обработке PDF:', error);
    removeUploadedFile(req.file);

    res.status(500).json({
      message: 'Ошибка сервера при обработке выписки',
      error: error.message,
    });
  }
});

app.get('/api/family/transactions', auth, async (req, res) => {
  try {
    const family = await getCurrentFamily(req.user.userId);

    if (!family) {
      return res.status(400).json({ message: 'У пользователя нет семьи' });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 200);
    const skip = (page - 1) * limit;

    const allowedSortFields = [
      'date',
      'amount',
      'balance',
      'transactionNum',
      'createdAt',
      'updatedAt',
    ];

    const sortBy = allowedSortFields.includes(req.query.sortBy)
      ? req.query.sortBy
      : 'date';

    const order = req.query.order === 'asc' ? 1 : -1;

    const memberIds = (family.members || [])
      .map((member) => member.user)
      .filter(Boolean);

    const [personalTransactions, familyTransactions] = await Promise.all([
      Transaction.find({
        userId: { $in: memberIds },
      })
        .populate('userId', 'fullname login email')
        .lean(),

      FamilyTransaction.find({
        familyId: family._id,
      })
        .populate('userId', 'fullname login email')
        .lean(),
    ]);

    const mergedTransactions = [
      ...personalTransactions.map((transaction) =>
        normalizeFamilyTransactionResponse(transaction, 'personal')
      ),
      ...familyTransactions.map((transaction) =>
        normalizeFamilyTransactionResponse(transaction, 'family')
      ),
    ];

    mergedTransactions.sort((a, b) => {
      const aValue = getSortValue(a, sortBy);
      const bValue = getSortValue(b, sortBy);

      if (typeof aValue === 'string' || typeof bValue === 'string') {
        return String(aValue).localeCompare(String(bValue), 'ru') * order;
      }

      return (aValue - bValue) * order;
    });

    const total = mergedTransactions.length;
    const data = mergedTransactions.slice(skip, skip + limit);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    console.error('Ошибка загрузки семейных транзакций:', error);
    res.status(500).json({
      message: 'Ошибка сервера при загрузке семейных транзакций',
      error: error.message,
    });
  }
});

app.post('/api/family/transactions/upload-pdf', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    const family = await getCurrentFamily(req.user.userId);

    if (!family) {
      removeUploadedFile(req.file);
      return res.status(400).json({ message: 'Сначала создайте семью' });
    }

    const savedCount = await scanPdf(req.file.path, req.user.userId, {
      model: FamilyTransaction,
      extraFields: {
        familyId: family._id,
      },
    });

    removeUploadedFile(req.file);

    res.status(200).json({
      message: 'Семейная выписка успешно обработана',
      count: savedCount,
      scope: 'family',
      familyId: family._id,
    });
  } catch (error) {
    console.error('Ошибка при загрузке и обработке семейной PDF-выписки:', error);
    removeUploadedFile(req.file);

    res.status(500).json({
      message: 'Ошибка сервера при обработке семейной выписки',
      error: error.message,
    });
  }
});

app.get('/api/family/category-limits', auth, async (req, res) => {
  try {
    const family = await getCurrentFamily(req.user.userId);

    if (!family) {
      return res.status(400).json({ message: 'У пользователя нет семьи' });
    }

    res.json({ limits: getCategoryLimitsDto(family) });
  } catch (error) {
    console.error('Ошибка загрузки лимитов категорий:', error);
    res.status(500).json({
      message: 'Ошибка сервера при загрузке лимитов категорий',
      error: error.message,
    });
  }
});

app.put('/api/family/category-limits', auth, async (req, res) => {
  try {
    const family = await getCurrentFamily(req.user.userId);

    if (!family) {
      return res.status(400).json({ message: 'У пользователя нет семьи' });
    }

    const normalizedLimits = normalizeCategoryLimits(req.body?.limits);
    family.categoryLimits = normalizedLimits;
    await family.save();

    res.json({ limits: getCategoryLimitsDto(family) });
  } catch (error) {
    console.error('Ошибка сохранения лимитов категорий:', error);
    res.status(500).json({
      message: 'Ошибка сервера при сохранении лимитов категорий',
      error: error.message,
    });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
  })
  .then(() => {
    console.log('Uploads directory sync is enabled');
  })
  .catch((err) => console.error('Connection error:', err));

async function scanPdf(filePath, userId, options = {}) {
  const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
  const fontPath = path.join(
    path.dirname(require.resolve('pdfjs-dist/package.json')),
    'standard_fonts/'
  );

  const loadingTask = pdfjsLib.getDocument({
    data: dataBuffer,
    standardFontDataUrl: fontPath,
  });

  try {
    const pdf = await loadingTask.promise;
    const fullDocData = await extractAllPagesData(pdf);
    const { bank: detectedBank } = identifyBank(fullDocData);
    const totalSaved = await aboutTransaction(fullDocData, detectedBank, userId, options);

    console.log('Обработка полностью завершена');
    return totalSaved;
  } catch (error) {
    console.error('Ошибка при сканировании PDF:', error);
    throw error;
  }
}

async function extractAllPagesData(pdf) {
  let allItems = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageItems = content.items.map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      page: i,
    }));

    allItems = allItems.concat(pageItems);
  }

  return allItems;
}

function parseMoneyToNumber(str) {
  if (!str) return 0;

  const cleanStr = String(str).replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleanStr) || 0;
}

async function aboutTransaction(docItems, bankName, userId, options = {}) {
  const TransactionModel = options.model || Transaction;
  const extraFields = options.extraFields || {};
  const totalPages = docItems.length > 0 ? Math.max(...docItems.map((i) => i.page)) : 0;

  let globalTransactionNum = 1;
  let lastBalance = null;
  let totalSavedTransactions = 0;

  const cardElement = docItems.find(
    (item) =>
      item.page === 1 &&
      Math.abs(item.x - 60) < 1 &&
      Math.abs(item.y - 665.86) < 1 &&
      item.str &&
      item.str.trim().length > 0
  );

  const cardNumber = cardElement
    ? cardElement.str.replace(/•+/g, '').replace(/\s+/g, ' ').trim()
    : 'Данные не найдены';

  for (let i = 1; i <= totalPages; i += 1) {
    let pageTransactions = [];
    const currentPageItems = docItems.filter((item) => item.page === i);
    const searchMarker = currentPageItems.findIndex((item) =>
      item.str.toUpperCase().includes('ОСТАТОК СРЕДСТВ')
    );

    if (searchMarker !== -1) {
      const dataAfterMarker = currentPageItems.slice(searchMarker + 1);
      let occurrence = 1;
      let found = true;
      const rawPageData = [];

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
            commentary: commentaryData,
          });
          occurrence += 1;
        } else {
          found = false;
        }
      }

      for (let j = rawPageData.length - 1; j >= 0; j -= 1) {
        const item = rawPageData[j];
        const cleanAmount = parseMoneyToNumber(item.money.amount);
        const cleanBalance = parseMoneyToNumber(item.money.balance);
        const rawCategory = item.category || 'Не определено';
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
          ...extraFields,
          date: parseDate(item.dateStr),
          amount: finalAmount,
          balance: cleanBalance,
          category: item.category,
          categoryInfo: categoryDataTransformed,
          bank: `${bankName} ${cardNumber}`.trim(),
          commentary: item.commentary || 'Комментарий не найден',
          page: i,
          transactionNum: 0,
          userId,
        });
      }

      pageTransactions.reverse();
      pageTransactions.forEach((transaction) => {
        transaction.transactionNum = globalTransactionNum;
        globalTransactionNum += 1;
      });
    }

    if (pageTransactions.length > 0) {
      try {
        await TransactionModel.insertMany(pageTransactions);
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
  console.log(`Server is running on http://localhost:${PORT}`);
});
