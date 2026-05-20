import React, { useEffect, useMemo, useState } from "react";

type AnalyticsView = "personal" | "family";
type PeriodId = "all" | "today" | "week" | "month" | "custom";

type ApiTransaction = {
  _id?: string;
  id?: string;
  transactionNum?: number;
  amount: number;
  date: string;
  createdAt?: string;
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

type TransactionsResponse = {
  data?: ApiTransaction[];
  totalPages?: number;
};

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const TRANSACTIONS_FETCH_LIMIT = 200;
const OPERATIONS_PER_PAGE = 50;

const categoryLabels: Record<string, string> = {
  salary: "Зарплата",
  salaries: "Зарплата",
  income: "Доходы",
  transfer: "Переводы",
  transfers: "Переводы",
  products: "Продукты",
  product: "Продукты",
  food: "Еда",
  groceries: "Продукты",
  grocery: "Продукты",
  others: "Другое",
  other: "Другое",
  misc: "Другое",
  miscellaneous: "Другое",
  transport: "Транспорт",
  transportation: "Транспорт",
  taxi: "Такси",
  fuel: "Топливо",
  automobile: "Автомобиль",
  auto: "Автомобиль",
  car: "Автомобиль",
  cars: "Автомобиль",
  restaurant: "Рестораны",
  restaurants: "Рестораны",
  cafe: "Кафе",
  cafes: "Кафе",
  supermarket: "Супермаркеты",
  supermarkets: "Супермаркеты",
  cash: "Наличные",
  services: "Услуги",
  service: "Услуги",
  utilities: "Коммунальные услуги",
  entertainment: "Развлечения",
  health: "Здоровье",
  home: "Дом",
  house: "Дом",
  pharmacy: "Аптеки",
  pharmacies: "Аптеки",
  drugstore: "Аптеки",
  medicine: "Аптеки",
  education: "Образование",
  cloth: "Одежда",
  clothes: "Одежда",
  clothing: "Одежда",
  apparel: "Одежда",
  shopping: "Покупки",
  beauty: "Красота",
  sport: "Спорт",
  sports: "Спорт",
  travel: "Путешествия",
  hotel: "Отели",
  hotels: "Отели",
  internet: "Интернет",
  mobile: "Связь",
  communication: "Связь",
  subscription: "Подписки",
  subscriptions: "Подписки",
  insurance: "Страхование",
  tax: "Налоги",
  taxes: "Налоги",
  fees: "Комиссии",
  fee: "Комиссии",
  withdrawal: "Снятие наличных",
  withdrawals: "Снятие наличных",
  atm: "Снятие наличных",
  refund: "Возврат",
  refunds: "Возврат",
  qr: "QR",
};

const periods: Array<{ id: PeriodId; label: string }> = [
  { id: "all", label: "Все время" },
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Эта неделя" },
  { id: "month", label: "Этот месяц" },
  { id: "custom", label: "Свой период" },
];

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateValue: string) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("ru-RU");
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: Math.abs(value) % 1 === 0 ? 0 : 2,
  }).format(value);

const normalizeCategory = (value?: string) => {
  const category = value?.trim();

  if (!category) {
    return "other";
  }

  return category;
};

const getCategoryLabel = (category: string) => {
  const categoryKey = category.toLowerCase();

  if (categoryLabels[categoryKey]) {
    return categoryLabels[categoryKey];
  }

  if (/^[a-z][a-z\s_-]*$/i.test(category)) {
    return "Другое";
  }

  return category;
};

const getPeriodRange = (
  periodId: PeriodId,
  customFrom: string,
  customTo: string,
) => {
  const now = new Date();
  const today = formatDate(now);

  switch (periodId) {
    case "today":
      return {
        from: today,
        to: today,
      };

    case "week": {
      const firstDay = new Date(now);
      const currentDay = firstDay.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      firstDay.setDate(firstDay.getDate() + diffToMonday);

      return {
        from: formatDate(firstDay),
        to: today,
      };
    }

    case "month":
      return {
        from: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      };

    case "custom":
      return {
        from: customFrom,
        to: customTo,
      };

    case "all":
    default:
      return {
        from: "2000-01-01",
        to: today,
      };
  }
};

const mapApiTransaction = (
  transaction: ApiTransaction,
  index: number,
): Transaction => {
  const category = normalizeCategory(
    transaction.categoryInfo || transaction.category,
  );

  return {
    id: transaction._id || transaction.id || `transaction-${index}`,
    amount: Number(transaction.amount) || 0,
    date: transaction.date || transaction.createdAt || "",
    category,
    bank: transaction.bank || "Общий счёт",
    description:
      transaction.description ||
      transaction.commentary ||
      getCategoryLabel(category),
  };
};

const filterTransactionsByDate = (
  transactions: Transaction[],
  dateFrom: string,
  dateTo: string,
) => {
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

const groupByCategory = (
  transactions: Transaction[],
  type: "income" | "expense",
): CategoryItem[] => {
  const isIncome = type === "income";
  const filtered = transactions.filter((transaction) =>
    isIncome ? transaction.amount > 0 : transaction.amount < 0,
  );
  const total = filtered.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0,
  );
  const grouped = filtered.reduce<Record<string, number>>(
    (acc, transaction) => {
      acc[transaction.category] =
        (acc[transaction.category] || 0) + Math.abs(transaction.amount);
      return acc;
    },
    {},
  );

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
        `${formatDisplayDate(transaction.date)} | ${transaction.description} | ${transaction.bank} | ${formatMoney(
          transaction.amount,
        )}`,
    )
    .join("\n");

  return [
    `Аналитика: ${view === "personal" ? "Личная" : "Семейная"}`,
    `Период: ${dateFrom} — ${dateTo}`,
    `Баланс: ${formatMoney(balance)}`,
    `Доходы: ${formatMoney(income)}`,
    `Расходы: ${formatMoney(expenses)}`,
    "",
    "Операции:",
    rows || "Нет операций",
  ].join("\n");
};

const buildPaginationItems = (page: number, totalPages: number) => {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);

  return [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
};

const loadAllTransactions = async (
  endpoint: "/api/transactions" | "/api/family/transactions",
  dateFrom: string,
  dateTo: string,
  signal: AbortSignal,
) => {
  const token = localStorage.getItem("token");
  const allTransactions: ApiTransaction[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(endpoint, API_URL);
    url.searchParams.set("dateFrom", dateFrom);
    url.searchParams.set("dateTo", dateTo);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(TRANSACTIONS_FETCH_LIMIT));
    url.searchParams.set("sortBy", "date");
    url.searchParams.set("order", "desc");

    const response = await fetch(url.toString(), {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Не удалось загрузить операции");
    }

    const result: TransactionsResponse = await response.json();
    allTransactions.push(...(Array.isArray(result.data) ? result.data : []));
    totalPages = Math.max(1, Number(result.totalPages) || 1);
    page += 1;
  } while (page <= totalPages);

  return allTransactions.map(mapApiTransaction);
};

export default function AnalyticsPage() {
  const activeView: AnalyticsView = "personal";
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>("all");
  const [customFrom, setCustomFrom] = useState("2000-01-01");
  const [customTo, setCustomTo] = useState(formatDate(new Date()));
  const [personalTransactions, setPersonalTransactions] = useState<
    Transaction[]
  >([]);
  const [familyTransactions, setFamilyTransactions] = useState<Transaction[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [operationsPage, setOperationsPage] = useState(1);

  const { from: dateFrom, to: dateTo } = useMemo(
    () => getPeriodRange(selectedPeriod, customFrom, customTo),
    [selectedPeriod, customFrom, customTo],
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadAnalytics = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const endpoint =
          activeView === "personal"
            ? "/api/transactions"
            : "/api/family/transactions";
        const loadedTransactions = await loadAllTransactions(
          endpoint,
          dateFrom,
          dateTo,
          controller.signal,
        );

        if (activeView === "personal") {
          setPersonalTransactions(loadedTransactions);
        } else {
          setFamilyTransactions(loadedTransactions);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadError(
          activeView === "personal"
            ? "Не удалось загрузить личную аналитику. Проверь backend и API."
            : "Не удалось загрузить семейную аналитику. Проверь семью и API.",
        );

        if (activeView === "personal") {
          setPersonalTransactions([]);
        } else {
          setFamilyTransactions([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();

    return () => {
      controller.abort();
    };
  }, [activeView, dateFrom, dateTo]);

  useEffect(() => {
    setOperationsPage(1);
  }, [activeView, selectedPeriod, customFrom, customTo]);

  const currentTransactions = useMemo(() => {
    if (activeView === "personal") {
      return personalTransactions;
    }

    return filterTransactionsByDate(familyTransactions, dateFrom, dateTo);
  }, [activeView, dateFrom, dateTo, familyTransactions, personalTransactions]);

  const income = useMemo(
    () =>
      currentTransactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [currentTransactions],
  );
  const expenses = useMemo(
    () =>
      currentTransactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [currentTransactions],
  );
  const balance = income - expenses;
  const expenseCategories = useMemo(
    () => groupByCategory(currentTransactions, "expense"),
    [currentTransactions],
  );
  const incomeCategories = useMemo(
    () => groupByCategory(currentTransactions, "income"),
    [currentTransactions],
  );

  const totalOperationPages = Math.max(
    1,
    Math.ceil(currentTransactions.length / OPERATIONS_PER_PAGE),
  );
  const safeOperationsPage = Math.min(operationsPage, totalOperationPages);
  const visibleTransactions = currentTransactions.slice(
    (safeOperationsPage - 1) * OPERATIONS_PER_PAGE,
    safeOperationsPage * OPERATIONS_PER_PAGE,
  );
  const paginationItems = buildPaginationItems(
    safeOperationsPage,
    totalOperationPages,
  );
  const rangeFrom = currentTransactions.length
    ? (safeOperationsPage - 1) * OPERATIONS_PER_PAGE + 1
    : 0;
  const rangeTo = Math.min(
    safeOperationsPage * OPERATIONS_PER_PAGE,
    currentTransactions.length,
  );

  const handlePeriodClick = (periodId: PeriodId) => {
    setSelectedPeriod(periodId);
    const range = getPeriodRange(periodId, customFrom, customTo);

    if (periodId !== "custom") {
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  };

  const changeOperationsPage = (nextPage: number) => {
    setOperationsPage(Math.min(Math.max(nextPage, 1), totalOperationPages));
  };

  const handleExport = () => {
    const text = buildExportText(
      activeView,
      dateFrom,
      dateTo,
      currentTransactions,
    );
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = `analytics-${activeView}-${dateFrom}-${dateTo}.txt`;
    link.click();
    URL.revokeObjectURL(fileUrl);
  };

  return (
    <main className="analytics-page">
      <section className="analytics-hero panel">
        <div>
          <h1>Аналитика</h1>
          <p>
            Наглядная статистика по доходам, расходам и операциям за выбранный
            период.
          </p>
        </div>
      </section>

      <section className="panel periods-card period-selector">
        <div className="chips-row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title period-title period-selector__title">
            Периоды
          </h2>
          <span className="small-badge">
            {dateFrom} — {dateTo}
          </span>
        </div>

        <div className="period-selector__chips" aria-label="Выбор периода">
          {periods.map((period) => (
            <button
              key={period.id}
              type="button"
              className={`period-chip period-selector__chip ${selectedPeriod === period.id ? "active" : ""}`}
              onClick={() => handlePeriodClick(period.id)}
            >
              {period.label}
            </button>
          ))}
        </div>

        <div className="period-selector__date-row">
          <label className="period-selector__date-pill">
            <span>С</span>
            <input
              type="date"
              value={customFrom}
              onChange={(event) => {
                setSelectedPeriod("custom");
                setCustomFrom(event.target.value);
              }}
            />
          </label>
          <span className="period-selector__date-separator">—</span>
          <label className="period-selector__date-pill">
            <span>По</span>
            <input
              type="date"
              value={customTo}
              onChange={(event) => {
                setSelectedPeriod("custom");
                setCustomTo(event.target.value);
              }}
            />
          </label>
        </div>
      </section>

      {loadError && <p className="profile-error">{loadError}</p>}

      <section className="analytics-summary-grid">
        <article className="panel stat-card">
          <div className="stat-label">Баланс за период</div>
          <div className="stat-value">{formatMoney(balance)}</div>
        </article>
        <article className="panel stat-card">
          <div className="stat-label">Доходы</div>
          <div className="stat-value green">{formatMoney(income)}</div>
        </article>
        <article className="panel stat-card">
          <div className="stat-label">Расходы</div>
          <div className="stat-value red">{formatMoney(expenses)}</div>
        </article>
      </section>

      <section className="analytics-grid">
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

      <section className="panel operations-card operations-list">
        <div className="operations-list__header">
          <div>
            <h2 className="section-title operations-list__title">
              Все операции
            </h2>
            <p className="operations-list__subtitle">
              Операции за выбранный период
            </p>
          </div>
          <span className="operations-list__count">
            {currentTransactions.length}
          </span>
        </div>

        {isLoading ? (
          <div className="operations-list__empty">Загружаем операции...</div>
        ) : visibleTransactions.length > 0 ? (
          <div className="operations-list__items">
            {visibleTransactions.map((transaction) => (
              <article className="operation-row" key={transaction.id}>
                <div
                  className={`operation-row__icon operation-row__icon--${
                    transaction.amount >= 0 ? "green" : "red"
                  }`}
                >
                  {transaction.amount >= 0 ? "+" : "−"}
                </div>
                <div className="operation-row__main">
                  <strong className="operation-row__title">
                    {transaction.description ||
                      getCategoryLabel(transaction.category)}
                  </strong>
                  <span className="operation-row__tag">
                    {getCategoryLabel(transaction.category)} ·{" "}
                    {transaction.bank}
                  </span>
                </div>
                <time
                  className="operation-row__date"
                  dateTime={transaction.date}
                >
                  {formatDisplayDate(transaction.date)}
                </time>
                <strong
                  className={`operation-row__amount operation-row__amount--${
                    transaction.amount >= 0 ? "green" : "red"
                  }`}
                >
                  {formatMoney(transaction.amount)}
                </strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="operations-list__empty">
            Операций за выбранный период нет
          </div>
        )}

        {currentTransactions.length > 0 && totalOperationPages > 1 && (
          <div
            className="operations-pagination"
            aria-label="Пагинация операций"
          >
            <button
              className="pagination-button"
              type="button"
              onClick={() => changeOperationsPage(safeOperationsPage - 1)}
              disabled={safeOperationsPage === 1}
            >
              Назад
            </button>

            <div className="pagination-pages">
              {paginationItems.map((pageItem, index) => {
                const previous = paginationItems[index - 1];
                const hasGap = previous && pageItem - previous > 1;

                return (
                  <React.Fragment key={pageItem}>
                    {hasGap && <span className="pagination-gap">…</span>}
                    <button
                      className={`pagination-page ${safeOperationsPage === pageItem ? "active" : ""}`}
                      type="button"
                      onClick={() => changeOperationsPage(pageItem)}
                    >
                      {pageItem}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <button
              className="pagination-button"
              type="button"
              onClick={() => changeOperationsPage(safeOperationsPage + 1)}
              disabled={safeOperationsPage === totalOperationPages}
            >
              Вперёд
            </button>

            <span className="pagination-info">
              {rangeFrom}–{rangeTo} из {currentTransactions.length}
            </span>
          </div>
        )}

        <button
          className="action-light operations-list__show-more"
          type="button"
          onClick={handleExport}
        >
          Экспортировать отчёт
        </button>
      </section>
    </main>
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
  type: "income" | "expense";
}) {
  return (
    <section className="panel analytics-category-card">
      <h2 className="section-title period-title">{title}</h2>

      {items.length > 0 ? (
        <div className="analytics-category-list">
          {items.map((item) => (
            <article className="analytics-category-row" key={item.key}>
              <div className="analytics-category-row__main">
                <div className="analytics-category-row__top">
                  <strong>{item.label}</strong>
                  <span>{item.percent}%</span>
                </div>
                <div
                  className="analytics-category-progress"
                  aria-hidden="true"
                >
                  <span
                    className={`analytics-category-progress__fill ${
                      type === "income" ? "green" : "red"
                    }`}
                    style={{ width: `${Math.min(item.percent, 100)}%` }}
                  />
                </div>
              </div>
              <div
                className={`analytics-category-row__amount ${
                  type === "income" ? "green" : "red"
                }`}
              >
                {formatMoney(item.value)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="member-mail">{emptyText}</p>
      )}
    </section>
  );
}
