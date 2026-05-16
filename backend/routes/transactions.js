const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

const allowedSortFields = ['date', 'amount', 'balance', 'transactionNum', 'createdAt', 'updatedAt'];

const normalizeDateRange = (dateFrom, dateTo) => {
  const query = {};

  if (dateFrom || dateTo) {
    query.date = {};

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      query.date.$gte = from;
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      query.date.$lte = to;
    }
  }

  return query;
};

const getNextTransactionNum = async () => {
  const lastTransaction = await Transaction.findOne({})
    .sort({ transactionNum: -1 })
    .select('transactionNum')
    .lean();

  return (lastTransaction?.transactionNum || 0) + 1;
};

const buildTransactionPayload = (body, userId) => {
  const amount = Number(body.amount);

  if (!Number.isFinite(amount)) {
    throw new Error('Некорректная сумма операции');
  }

  if (!body.date) {
    throw new Error('Укажите дату операции');
  }

  return {
    date: new Date(body.date),
    amount,
    balance: body.balance === undefined || body.balance === '' ? undefined : Number(body.balance),
    category: body.category || body.categoryInfo || 'others',
    categoryInfo: body.categoryInfo || body.category || 'others',
    bank: body.bank || 'Общий счёт',
    commentary: body.commentary || '',
    page: body.page,
    fileId: body.fileId,
    userId: userId
  };
};

// GET /api/transactions
router.get('/', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const requestedSortBy = req.query.sortBy || 'date';
    const sortBy = allowedSortFields.includes(requestedSortBy)
      ? requestedSortBy
      : 'transactionNum';
    const order = req.query.order === 'asc' ? 1 : -1;
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(200, limit));
    const skip = (safePage - 1) * safeLimit;

    const { dateFrom, dateTo } = req.query;
    const query = normalizeDateRange(dateFrom, dateTo);

    if (req.user && req.user.userId) {
      query.userId = new mongoose.Types.ObjectId(req.user.userId);
    } else {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const transactions = await Transaction.find(query)
      .sort({
        [sortBy]: order,
        ...(sortBy !== 'date' && { date: -1 }),
        ...(sortBy !== 'transactionNum' && { transactionNum: -1 }),
      })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await Transaction.countDocuments(query);

    const aggregation = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          income: {
            $sum: {
              $cond: [{ $gt: ['$amount', 0] }, '$amount', 0],
            },
          },
          expenses: {
            $sum: {
              $cond: [{ $lt: ['$amount', 0] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    const resultStats = aggregation[0] || { income: 0, expenses: 0 };

    res.json({
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      stats: {
        income: resultStats.income,
        expenses: Math.abs(resultStats.expenses),
        balance: resultStats.income + resultStats.expenses,
      },
      data: transactions,
    });
  } catch (error) {
    console.error('Full Error:', error);
    res.status(500).json({
      message: 'Ошибка сервера при получении транзакций',
      error: error.message,
    });
  }
});

// POST /api/transactions
router.post('/', auth, async (req, res) => { 
  try {
    const payload = buildTransactionPayload(req.body, req.user.userId);
    
    const transaction = await Transaction.create({
      ...payload,
      transactionNum: await getNextTransactionNum(),
    });

    res.status(201).json({
      message: 'Операция создана',
      data: transaction,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Ошибка при создании операции',
      error: error.message,
    });
  }
});

// GET /api/transactions/stats
router.get('/stats', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const query = normalizeDateRange(dateFrom, dateTo);

    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$categoryInfo',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({
      message: 'Ошибка при расчете статистики по категориям',
      error: error.message,
    });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const payload = buildTransactionPayload(req.body);

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedTransaction) {
      return res.status(404).json({
        message: 'Операция не найдена',
      });
    }

    return res.json({
      message: 'Операция обновлена',
      data: updatedTransaction,
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Ошибка при обновлении операции',
      error: error.message,
    });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const deletedTransaction = await Transaction.findByIdAndDelete(req.params.id);

    if (!deletedTransaction) {
      return res.status(404).json({
        message: 'Операция не найдена',
      });
    }

    return res.json({
      message: 'Операция удалена',
      data: deletedTransaction,
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Ошибка при удалении операции',
      error: error.message,
    });
  }
});

module.exports = router;
