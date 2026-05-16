import React, { useEffect, useMemo, useState } from 'react';

import './style.css';

type AnalyticsView = 'personal' | 'family';
type PeriodId = 'all' | 'today' | 'week' | 'month' | 'custom';

type ApiTransaction = {
  _id?: string;
  id?: string;
  transactionNum?: number;
  amount: number;
  date: string;
  categoryInfo?: string;
  category?: string;
  bank?: string;
  commentary?: string;
  description?: string;
};

type Transaction = {
  id: string;
  amount: number;
  date: string;
  category: string;
  bank: string;
  description: string;
};

type CategoryItem = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TRANSACTIONS_PAGE_LIMIT = 200;

const categoryLabels: Record<string, string> = {
  salary: 'Зарплата',
  income: 'Доходы',
  project: 'Проекты',
  projects: 'Проекты',
  transfer: 'Переводы',
  transfers: 'Переводы',
  withdrawal: 'Снятие наличных',
  withdraw: 'Снятие наличных',
  refund: 'Возврат',
  qr: 'QR',
  products: 'Продукты',
  product: 'Продукты',
  food: 'Еда',
  supermarket: 'Супермаркеты',
  markets: 'Супермаркеты',
  transport: 'Транспорт',
  taxi: 'Такси',
  restaurant: 'Рестораны',
  restaurants: 'Рестораны',
  cafe: 'Кафе',
  services: 'Услуги',
  service: 'Услуги',
  cash: 'Наличные',
  entertainment: 'Развлечения',
  health: 'Здоровье',
  pharmacy: 'Аптеки',
  home: 'Дом',
  education: 'Образование',
  subscriptions: 'Подписки',
  communication: 'Связь',
  mobile: 'Связь',
  utilities: 'Коммунальные услуги',
  travel: 'Путешествия',
  other: 'Другое',
  others: 'Другое',
};

const periods: Array<{ id: PeriodId; label: string }> = [
  { id: 'all', label: 'Все время' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Эта неделя' },
  { id: 'month', label: 'Этот месяц' },
  { id: 'custom', label: 'Свой период' },
];

const familyFallbackTransactions: Transaction[] = [
  {
    id: 'family-1',
    amount: 85000,
    date: '2026-03-29',
    category: 'salary',
    bank: 'Семейный счёт',
    description: 'Зарплата',
  },
  {
    id: 'family-2',
    amount: 90000,
    date: '2026-03-27',
    category: 'projects',
    bank: 'Семейный счёт',
    description: 'Проекты',
  },
  {
    id: 'family-3',
    amount: -9000,
    date: '2026-03-24',
    category: 'products',
    bank: 'Семейный счёт',
    description: 'Продукты',
  },
  {
    id: 'family-4',
    amount: -2000,
    date: '2026-03-21',
    category: 'transport',
    bank: 'Семейный счёт',
    description: 'Транспорт',
  },
  {
    id: 'family-5',
    amount: -29000,
    date: '2026-03-18',
    category: 'entertainment',
    bank: 'Семейный счёт',
    description: 'Развлечения',
  },
];

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateValue: string) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('ru-RU');
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: Math.abs(value) % 1 === 0 ? 0 : 2,
  }).format(value);

const normalizeCategory = (value?: string) => {
  const category = value?.trim().toLowerCase();

  if (!category) return 'other';
  if (category.includes('зарп') || category.includes('salary') || category.includes('payroll')) return 'salary';
  if (category.includes('проект') || category.includes('project')) return 'projects';
  if (category.includes('перев') || category.includes('transfer')) return 'transfers';
  if (category.includes('withdrawal') || category.includes('withdraw') || category.includes('сняти')) return 'withdrawal';
  if (category.includes('refund') || category.includes('возврат')) return 'refund';
  if (category === 'qr' || category.includes(' qr') || category.includes('qr ') || category.includes('сбп')) return 'qr';
  if (category.includes('продукт') || category.includes('product')) return 'products';
  if (category.includes('еда') || category.includes('food')) return 'food';
  if (category.includes('supermarket') || category.includes('супермаркет') || category.includes('market')) return 'supermarket';
  if (category.includes('transport') || category.includes('транспорт')) return 'transport';
  if (category.includes('taxi') || category.includes('такси')) return 'taxi';
  if (category.includes('restaurant') || category.includes('ресторан')) return 'restaurants';
  if (category.includes('cafe') || category.includes('кафе')) return 'cafe';
  if (category.includes('service') || category.includes('услуг')) return 'services';
  if (category.includes('cash') || category.includes('налич')) return 'cash';
  if (category.includes('entertainment') || category.includes('развлеч')) return 'entertainment';
  if (category.includes('health') || category.includes('здоров')) return 'health';
  if (category.includes('pharmacy') || category.includes('аптек')) return 'pharmacy';
  if (category.includes('home') || category.includes('дом')) return 'home';
  if (category.includes('education') || category.includes('образован')) return 'education';
  if (category.includes('subscription') || category.includes('подпис')) return 'subscriptions';
  if (category.includes('communication') || category.includes('mobile') || category.includes('связь')) return 'communication';
  if (category.includes('utilities') || category.includes('коммун')) return 'utilities';
  if (category.includes('travel') || category.includes('путеше')) return 'travel';
  if (category.includes('other') || category.includes('другое')) return 'other';

  return category;
};

const getCategoryLabel = (category: string) => {
  const normalized = normalizeCategory(category);
  return categoryLabels[normalized] || normalized[0]?.toUpperCase() + normalized.slice(1) || 'Другое';
};

const translateDescription = (description: string, category: string) => {
  const normalizedDescription = normalizeCategory(description);
  const normalizedCategory = normalizeCategory(category);

  if (categoryLabels[normalizedDescription]) {
    return categoryLabels[normalizedDescription];
  }

  if (!description || description.trim().toLowerCase() === normalizedCategory) {
    return getCategoryLabel(normalizedCategory);
  }

  return description;
};

const getPeriodRange = (periodId: PeriodId, customFrom: string, customTo: string) => {
  const now = new Date();
  const today = formatDate(now);

  switch (periodId) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const firstDay = new Date(now);
      const currentDay = firstDay.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      firstDay.setDate(firstDay.getDate() + diffToMonday);

      return { from: formatDate(firstDay), to: today };
    }
    case 'month':
      return { from: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'custom':
      return { from: customFrom, to: customTo };
    case 'all':
    default:
      return { from: '2000-01-01', to: today };
  }
};

const mapApiTransaction = (transaction: ApiTransaction, index: number): Transaction => {
  const category = normalizeCategory(transaction.categoryInfo || transaction.category);
  const rawDescription = transaction.description || transaction.commentary || getCategoryLabel(category);

  return {
    id: transaction._id || transaction.id || `transaction-${index}`,
    amount: Number(transaction.amount) || 0,
    date: transaction.date,
    category,
    bank: transaction.bank || 'Общий счёт',
    description: translateDescription(rawDescription, category),
  };
};

const filterTransactionsByDate = (transactions: Transaction[], dateFrom: string, dateTo: string) => {
  const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
  const toTime = new Date(`${dateTo}T23:59:59`).getTime();

  return transactions.filter((transaction) => {
    const transactionTime = new Date(transaction.date).getTime();

    if (Number.isNaN(transactionTime)) {
      return false;
    }

    return transactionTime >= fromTime && transactionTime <= toTime;
  });
};

const groupByCategory = (transactions: Transaction[], type: 'income' | 'expense'): CategoryItem[] => {
  const isIncome = type === 'income';
  const filtered = transactions.filter((transaction) =>
    isIncome ? transaction.amount > 0 : transaction.amount < 0,
  );
  const total = filtered.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const grouped = filtered.reduce<Record<string, number>>((acc, transaction) => {
    const category = normalizeCategory(transaction.category);
    acc[category] = (acc[category] || 0) + Math.abs(transaction.amount);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([key, value]) => ({
      key,
      label: getCategoryLabel(key),
      value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
};

const buildExportText = (
  view: AnalyticsView,
  dateFrom: string,
  dateTo: string,
  transactions: Transaction[],
) => {
  const income = transactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = transactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const balance = income - expenses;
  const rows = transactions
    .map(
      (transaction) =>
        `${formatDisplayDate(transaction.date)} | ${transaction.description} | ${getCategoryLabel(
          transaction.category,
        )} | ${transaction.bank} | ${formatMoney(transaction.amount)}`,
    )
    .join('\n');

  return [
    `Аналитика: ${view === 'personal' ? 'Личная' : 'Семейная'}`,
    `Период: ${dateFrom} — ${dateTo}`,
    `Баланс: ${formatMoney(balance)}`,
    `Доходы: ${formatMoney(income)}`,
    `Расходы: ${formatMoney(expenses)}`,
    '',
    'Операции:',
    rows || 'Нет операций',
  ].join('\n');
};

export default function AnalyticsPage() {
  const [activeView, setActiveView] = useState<AnalyticsView>('personal');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>('all');
  const [customFrom, setCustomFrom] = useState('2000-01-01');
  const [customTo, setCustomTo] = useState(formatDate(new Date()));
  const [personalTransactions, setPersonalTransactions] = useState<Transaction[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { from: dateFrom, to: dateTo } = useMemo(
    () => getPeriodRange(selectedPeriod, customFrom, customTo),
    [selectedPeriod, customFrom, customTo],
  );

  useEffect(() => {
    if (activeView !== 'personal') {
      return;
    }

    const controller = new AbortController();

    const loadPersonalAnalytics = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setLoadError('Нет токена авторизации. Войдите в аккаунт заново.');
        setPersonalTransactions([]);
        setLoadedCount(0);
        setTotalCount(0);
        return;
      }

      setIsLoading(true);
      setLoadError('');
      setLoadedCount(0);
      setTotalCount(0);

      try {
        const allTransactions: ApiTransaction[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
          const url = new URL('/api/transactions', API_URL);
          url.searchParams.set('dateFrom', dateFrom);
          url.searchParams.set('dateTo', dateTo);
          url.searchParams.set('page', String(currentPage));
          url.searchParams.set('limit', String(TRANSACTIONS_PAGE_LIMIT));
          url.searchParams.set('sortBy', 'date');
          url.searchParams.set('order', 'desc');

          const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error('Не удалось загрузить операции');
          }

          const result = await response.json();
          const pageTransactions = Array.isArray(result.data) ? result.data : [];

          allTransactions.push(...pageTransactions);
          setLoadedCount(allTransactions.length);
          setTotalCount(Number(result.total) || allTransactions.length);

          totalPages = Number(result.totalPages) || 1;
          currentPage += 1;
        } while (currentPage <= totalPages && currentPage <= 1000);

        setPersonalTransactions(allTransactions.map(mapApiTransaction));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setLoadError('Не удалось загрузить личную аналитику. Проверь backend и API.');
        setPersonalTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersonalAnalytics();

    return () => {
      controller.abort();
    };
  }, [activeView, dateFrom, dateTo]);

  useEffect(() => {
    setExpanded(false);
  }, [activeView, selectedPeriod, customFrom, customTo]);

  const currentTransactions = useMemo(() => {
    if (activeView === 'personal') {
      return personalTransactions;
    }

    return filterTransactionsByDate(familyFallbackTransactions, dateFrom, dateTo);
  }, [activeView, dateFrom, dateTo, personalTransactions]);

  const income = useMemo(
    () => currentTransactions
      .filter((transaction) => transaction.amount > 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    [currentTransactions],
  );

  const expenses = useMemo(
    () => currentTransactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [currentTransactions],
  );

  const balance = income - expenses;

  const expenseCategories = useMemo(
    () => groupByCategory(currentTransactions, 'expense'),
    [currentTransactions],
  );

  const incomeCategories = useMemo(
    () => groupByCategory(currentTransactions, 'income'),
    [currentTransactions],
  );

  const visibleTransactions = expanded ? currentTransactions : currentTransactions.slice(0, 8);

  const handlePeriodClick = (periodId: PeriodId) => {
    setSelectedPeriod(periodId);
    const range = getPeriodRange(periodId, customFrom, customTo);

    if (periodId !== 'custom') {
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  };

  const handleExport = () => {
    const text = buildExportText(activeView, dateFrom, dateTo, currentTransactions);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = fileUrl;
    link.download = `analytics-${activeView}-${dateFrom}-${dateTo}.txt`;
    link.click();
    URL.revokeObjectURL(fileUrl);
  };

  return (
    <main className="analytics-page">
      <section className="analytics-shell">
        <div className="analytics-view-tabs" aria-label="Тип аналитики">
          <button
            className={`analytics-tab ${activeView === 'personal' ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveView('personal')}
          >
            Личная аналитика
          </button>
          <button
            className={`analytics-tab ${activeView === 'family' ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveView('family')}
          >
            Семейная аналитика
          </button>
        </div>

        <section className="analytics-card analytics-period-card">
          <div className="analytics-section-header">
            <div>
              <h2>Периоды</h2>
              <p>Выбрано: {dateFrom} — {dateTo}</p>
            </div>
            {isLoading && activeView === 'personal' && (
              <span className="analytics-loading-pill">
                Загружено {loadedCount} из {totalCount || '...'}
              </span>
            )}
          </div>

          <div className="analytics-periods">
            {periods.map((period) => (
              <button
                className={`analytics-period-button ${selectedPeriod === period.id ? 'active' : ''}`}
                key={period.id}
                type="button"
                onClick={() => handlePeriodClick(period.id)}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="analytics-date-row">
            <label>
              <span>С</span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => {
                  setSelectedPeriod('custom');
                  setCustomFrom(event.target.value);
                }}
              />
            </label>
            <label>
              <span>По</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => {
                  setSelectedPeriod('custom');
                  setCustomTo(event.target.value);
                }}
              />
            </label>
          </div>
        </section>

        {loadError && activeView === 'personal' && (
          <div className="analytics-error">{loadError}</div>
        )}

        <section className="analytics-stats-grid">
          <StatCard title="Баланс за период" value={formatMoney(balance)} />
          <StatCard title="Доходы" value={formatMoney(income)} tone="income" />
          <StatCard title="Расходы" value={formatMoney(expenses)} tone="expense" />
          <StatCard title="Операций" value={String(currentTransactions.length)} />
        </section>

        <section className="analytics-category-grid">
          <CategoryBlock
            title="Расходы по категориям"
            items={expenseCategories}
            emptyText="Расходов за выбранный период нет"
            type="expense"
          />
          <CategoryBlock
            title="Доходы по категориям"
            items={incomeCategories}
            emptyText="Доходов за выбранный период нет"
            type="income"
          />
        </section>

        <section className="analytics-card analytics-operations-card">
          <div className="analytics-section-header">
            <div>
              <h2>Все операции</h2>
              <p>{currentTransactions.length} операций за выбранный период</p>
            </div>
            <button className="analytics-export-button" type="button" onClick={handleExport}>
              Экспортировать отчёт
            </button>
          </div>

          {isLoading && activeView === 'personal' ? (
            <div className="analytics-empty">Загружаем все личные операции...</div>
          ) : visibleTransactions.length > 0 ? (
            <div className="analytics-operation-list">
              {visibleTransactions.map((transaction) => (
                <article className="analytics-operation" key={transaction.id}>
                  <div className={`analytics-operation-icon ${transaction.amount >= 0 ? 'income' : 'expense'}`}>
                    {transaction.amount >= 0 ? '+' : '−'}
                  </div>
                  <div className="analytics-operation-main">
                    <strong>{transaction.description || getCategoryLabel(transaction.category)}</strong>
                    <span>
                      {getCategoryLabel(transaction.category)} · {transaction.bank}
                    </span>
                    <small>{formatDisplayDate(transaction.date)}</small>
                  </div>
                  <strong className={`analytics-operation-amount ${transaction.amount >= 0 ? 'income' : 'expense'}`}>
                    {formatMoney(transaction.amount)}
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="analytics-empty">Операций за выбранный период нет</div>
          )}

          {currentTransactions.length > 8 && (
            <button
              className="analytics-show-more"
              type="button"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Свернуть' : 'Показать больше'}
            </button>
          )}
        </section>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: 'income' | 'expense';
}) {
  return (
    <article className={`analytics-stat-card ${tone || ''}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CategoryBlock({
  title,
  items,
  emptyText,
  type,
}: {
  title: string;
  items: CategoryItem[];
  emptyText: string;
  type: 'income' | 'expense';
}) {
  return (
    <section className="analytics-card analytics-category-card">
      <div className="analytics-section-header compact">
        <h2>{title}</h2>
      </div>

      {items.length > 0 ? (
        <div className="analytics-category-list">
          {items.map((item) => (
            <div className="analytics-category-row" key={item.key}>
              <div className="analytics-category-line">
                <strong>{item.label}</strong>
                <span>{item.percent}%</span>
              </div>
              <div className="analytics-category-track">
                <div
                  className={`analytics-category-fill ${type}`}
                  style={{ width: `${Math.max(item.percent, 4)}%` }}
                />
              </div>
              <div className="analytics-category-value">{formatMoney(item.value)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty small">{emptyText}</div>
      )}
    </section>
  );
}
