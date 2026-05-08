const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { Decimal128 } = mongoose.Types;
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
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
} = require('./pdfScan'); // Импортируем функции из pdfScan.js


dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express();
app.use(cors({
  origin: '*', 
  exposedHeaders: ['Content-Disposition']
}));
app.use(bodyParser.json());

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
        // console.log(`Всего страниц в выписке: ${pdf.numPages}`);
        const fullDocData = await extractAllPagesData(pdf); 
        const { bank: detectedBank } = identifyBank(fullDocData);

        // console.log('Выписка из банка: ' + detectedBank);
        // console.log('Все данные:', fullDocData);

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




//-------------------ГЛАВНАЯ ФУНКЦИЯ ОБРАБОТКИ ВЫПИСКИ ИЗ БАНКА-------------------
async function aboutTransaction(docItems, bankName) {
    const totalPages = docItems.length > 0 ? Math.max(...docItems.map(i => i.page)) : 0;
    let globalTransactionNum = 1;

    // 1. Поиск номера карты
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

            while (found) {
              // работа с данными
                const dateData = findDateByOccurrence(dataAfterMarker, occurrence);
                const moneyData = findMoney(dataAfterMarker, occurrence);
                const categoryData = findCategory(dataAfterMarker, occurrence);
                const commentaryData = findCommentary(dataAfterMarker, occurrence, categoryData);
                const rawCategory = categoryData || "Не определено";

                const categoryDataTransformed = categoryTransform(rawCategory);

                if (dateData && moneyData) {
                    // Формируем объект согласно Mongoose Schema
                    pageTransactions.push({
                        date: parseDate(dateData.item.str), // Формат Date
                        amount: moneyData.amount,           // Строка "123.45" (Decimal128 её съест)
                        balance: moneyData.balance,
                        category: categoryData,
                        categoryInfo: categoryDataTransformed,
                        bank: `${bankName} ${cardNumber}`.trim(),
                        commentary: commentaryData || "Комментарий не найден",
                        page: i,
                        transactionNum: globalTransactionNum++
                    });
                    occurrence++; 
                } else {
                    found = false; 
                }
            }
        }

        // --- ЗАПИСЬ В БД ПОСТРАНИЧНО ---
        if (pageTransactions.length > 0) {
            try {
                await Transaction.insertMany(pageTransactions); 
                console.log(`✅ Страница ${i}: сохранено ${pageTransactions.length} транзакций в БД`);
            } catch (err) {
                console.error(`❌ Ошибка записи страницы ${i}:`, err);
            }
        }
    }
}

// -------------------------------------------------------------



//--------------------МОДЕЛИ ДАННЫХ-------------------

const userSchema = new Schema({
  fullname: { type: String, trim: true },
  login: { type: String, trim: true, required: true, unique: true },
  email: { type: String, trim: true, lowercase: true, required: true, unique: true },
  password: String,
  gender: String,
});

const User = mongoose.model('User', userSchema);

const transactionSchema = new Schema({
  date: Date,
  amount: Decimal128,
  balance: Decimal128,
  category: String,
  categoryInfo: String,
  bank: String,
  commentary: String,
  page: Number,
  transactionNum: Number,
});

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  filename: { type: String, required: true, unique: true }, 
  path: { type: String, required: true, unique: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
});

const FileModel = mongoose.models.File || mongoose.model('File', fileSchema);

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);


// ----------------------------------------------------




const uploadsDir = path.resolve(__dirname, './uploads');
fs.mkdirSync(uploadsDir, { recursive: true });


function buildSafePdfName(originalName) {
  const extension = path.extname(originalName).toLowerCase() || '.pdf';
  const baseName = path.basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file';

  return `${Date.now()}-${baseName}${extension}`;
}

function isPdfFileName(fileName) {
  return path.extname(fileName).toLowerCase() === '.pdf';
}

async function syncFileToMongo(fileName) {
  if (!fileName || !isPdfFileName(fileName)) {
    return null;
  }

  const absolutePath = path.join(uploadsDir, fileName);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return null;
  }

  const existingFile = await FileModel.findOne({ path: absolutePath });
  if (existingFile) {
    return existingFile;
  }

  return FileModel.create({
    originalName: fileName,
    filename: fileName,
    path: absolutePath,
    mimetype: 'application/pdf',
    size: stats.size,
    uploadDate: stats.birthtime || new Date(),
  });
}

async function syncUploadsDirectoryToMongo() {
  const files = fs.readdirSync(uploadsDir);

  for (const fileName of files) {
    try {
      await syncFileToMongo(fileName);
    } catch (error) {
      console.error(`Sync Error for ${fileName}:`, error);
    }
  }
}

function watchUploadsDirectory() {
  fs.watch(uploadsDir, async (_eventType, fileName) => {
    try {
      await syncFileToMongo(fileName);
    } catch (error) {
      console.error(`Watch Error for ${fileName}:`, error);
    }
  });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    cb(null, buildSafePdfName(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';

    if (!isPdfMime || !isPdfExt) {
      return cb(new Error('Разрешены только PDF-файлы'));
    }

    cb(null, true);
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

// роуты

app.post('/register', async (req, res) => {
  try {
    const { fullname, login, email, password, gender } = req.body;

    if (!fullname || !login || !email || !password || !gender) {
      return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    const cleanLogin = login.trim();
    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({
      $or: [{ login: cleanLogin }, { email: cleanEmail }],
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Логин или email уже заняты' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullname: fullname.trim(),
      login: cleanLogin,
      email: cleanEmail,
      password: hashedPassword,
      gender,
    });

    await newUser.save();
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при регистрации' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Логин и пароль обязательны' });
    }

    const user = await User.findOne({ login: login.trim() });
    if (!user) {
      return res.status(400).json({ message: 'Неверный логин или пароль' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Неверный логин или пароль' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при входе' });
  }
});

app.post('/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не был загружен' });
    }

    const newFile = await FileModel.create({
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadDate: new Date()
    });

    res.status(201).json({
      message: 'PDF-файл успешно загружен',
      file: newFile,
    });
  } catch (error) {
    if (error.code === 11000) { // Ошибка дубликата в MongoDB
      return res.status(400).json({ message: 'Этот файл уже зарегистрирован в базе' });
    }
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.get('/files', async (_req, res) => {
  try {
    const files = await FileModel.find().sort({ uploadDate: -1 }).lean();
    res.json(files);
  } catch (error) {
    console.error('Files List Error:', error);
    res.status(500).json({ message: 'Не удалось получить список файлов' });
  }
});

app.get('/files/:id/download', async (req, res) => {
  try {
    const file = await FileModel.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: 'Файл не найден в базе данных' });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ message: 'Файл отсутствует в uploads' });
    }

    res.download(file.path, file.originalName);
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ message: 'Не удалось скачать файл' });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message });
  }

  if (error) {
    return res.status(400).json({ message: error.message || 'Ошибка обработки файла' });
  }

  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});


scanPdf()

// ----------------------------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
});
