import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CategoryChart from "../../components/CategoryChart";
import CashFlowChart from "../../components/CashFlowChart";
import {
  getFamilyCategoryLimits,
  getFamilyStatus,
  type Family,
  type FamilyCategoryLimit,
  type FamilyMember,
} from "../../api/family";

type PeriodId = "all" | "today" | "week" | "month" | "custom";
type BudgetUsageLevel = "green" | "yellow" | "red";

type TransactionUser = {
  id?: string;
  _id?: string;
  fullname?: string;
  login?: string;
  email?: string;
  avatarUrl?: string;
  name?: string;
};

type ApiTransaction = {
  _id?: string;
  id?: string;
  transactionNum?: number;
  amount: number;
  date?: string;
  createdAt?: string;
  categoryInfo?: string;
  category?: string;
  bank?: string;
  commentary?: string;
  description?: string;
  userId?: string | TransactionUser;
  user?: TransactionUser | null;
  uploadedBy?: string;
  source?: "personal" | "family";
};

type Transaction = {
  id: string;
  amount: number;
  date: string;
  category: string;
  categoryLabel: string;
  bank: string;
  description: string;
  userId: string;
  memberName: string;
  source?: "personal" | "family";
};

type CategoryItem = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

type BudgetItem = {
  category: string;
  spent: number;
  limit: number;
  percent: number;
  progress: number;
  level: BudgetUsageLevel;
  remaining: number;
};

type TransactionsResponse = {
  data?: ApiTransaction[];
  totalPages?: number;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TRANSACTIONS_FETCH_LIMIT = 200;
const OPERATIONS_PER_PAGE = 50;

const periods: Array<{ id: PeriodId; label: string }> = [
  { id: "all", label: "Все время" },
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Эта неделя" },
  { id: "month", label: "Этот месяц" },
  { id: "custom", label: "Свой период" },
];

const categoryLabels: Record<string, string> = {
  salary: "Зарплата",
  salaries: "Зарплата",
  income: "Доходы",
  transfer: "Переводы",
  transfers: "Переводы",
  withdrawal: "Снятие наличных",
  withdrawals: "Снятие наличных",
  atm: "Снятие наличных",
  refund: "Возврат",
  refunds: "Возврат",
  products: "Продукты",
  product: "Продукты",
  food: "Еда",
  groceries: "Продукты",
  grocery: "Продукты",
  supermarket: "Супермаркеты",
  supermarkets: "Супермаркеты",
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
  services: "Услуги",
  service: "Услуги",
  utilities: "Коммунальные услуги",
  cash: "Наличные",
  cloth: "Одежда",
  clothes: "Одежда",
  clothing: "Одежда",
  apparel: "Одежда",
  entertainment: "Развлечения",
  home: "Дом",
  house: "Дом",
  pharmacy: "Аптеки",
  pharmacies: "Аптеки",
  drugstore: "Аптеки",
  medicine: "Аптеки",
  health: "Здоровье",
  education: "Образование",
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
  qr: "QR",
  other: "Другое",
  others: "Другое",
  misc: "Другое",
  miscellaneous: "Другое",
};

const formatDateInput = (date: Date) => {
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

const getPeriodRange = (
  periodId: PeriodId,
  customFrom: string,
  customTo: string,
) => {
  const now = new Date();
  const today = formatDateInput(now);

  switch (periodId) {
    case "today":
      return { from: today, to: today };

    case "week": {
      const firstDay = new Date(now);
      const currentDay = firstDay.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      firstDay.setDate(firstDay.getDate() + diffToMonday);

      return { from: formatDateInput(firstDay), to: today };
    }

    case "month":
      return {
        from: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      };

    case "custom":
      return { from: customFrom, to: customTo };

    case "all":
    default:
      return { from: "2000-01-01", to: today };
  }
};

const normalizeCategory = (value?: string) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) return "Другое";
  if (categoryLabels[normalized]) return categoryLabels[normalized];
  if (normalized.includes("зарп") || normalized.includes("salary"))
    return "Зарплата";
  if (normalized.includes("перев") || normalized.includes("transfer"))
    return "Переводы";
  if (
    normalized.includes("withdrawal") ||
    normalized.includes("withdraw") ||
    normalized.includes("сняти")
  ) {
    return "Снятие наличных";
  }
  if (normalized.includes("refund") || normalized.includes("возврат"))
    return "Возврат";
  if (
    normalized === "qr" ||
    normalized.includes("qr") ||
    normalized.includes("сбп")
  ) {
    return "QR";
  }
  if (normalized.includes("продукт") || normalized.includes("product"))
    return "Продукты";
  if (normalized.includes("транспорт") || normalized.includes("transport"))
    return "Транспорт";
  if (normalized.includes("ресторан") || normalized.includes("restaurant"))
    return "Рестораны";
  if (normalized.includes("услуг") || normalized.includes("service"))
    return "Услуги";
  if (normalized.includes("cash") || normalized.includes("налич"))
    return "Наличные";
  if (
    normalized.includes("automobile") ||
    normalized.includes("auto") ||
    normalized.includes("car")
  ) {
    return "Автомобиль";
  }
  if (
    normalized.includes("cloth") ||
    normalized.includes("clothing") ||
    normalized.includes("apparel")
  ) {
    return "Одежда";
  }
  if (normalized.includes("entertainment")) return "Развлечения";
  if (normalized.includes("home") || normalized.includes("house")) return "Дом";
  if (
    normalized.includes("pharmacy") ||
    normalized.includes("drugstore") ||
    normalized.includes("medicine")
  ) {
    return "Аптеки";
  }

  if (/^[a-z][a-z\s_-]*$/i.test(String(value).trim())) {
    return "Другое";
  }

  return value ? value[0].toUpperCase() + value.slice(1) : "Другое";
};

const getTransactionUserId = (transaction: ApiTransaction) => {
  if (transaction.user?.id || transaction.user?._id) {
    return String(transaction.user.id || transaction.user._id);
  }

  if (typeof transaction.userId === "object" && transaction.userId !== null) {
    return String(transaction.userId.id || transaction.userId._id || "");
  }

  return transaction.userId ? String(transaction.userId) : "";
};

const getMemberName = (member: FamilyMember) =>
  member.fullname?.trim() ||
  member.login?.trim() ||
  member.email?.trim() ||
  "Участник семьи";

const getMemberAvatarUrl = (member: FamilyMember) =>
  typeof member.avatarUrl === "string" ? member.avatarUrl.trim() : "";

const renderMemberAvatar = (member: FamilyMember) => {
  const memberName = getMemberName(member);
  const avatarUrl = getMemberAvatarUrl(member);

  return (
    <span className="family-member-filter__avatar" aria-hidden="true">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" loading="lazy" />
      ) : (
        memberName.charAt(0).toUpperCase()
      )}
    </span>
  );
};

const getTransactionUserName = (
  transaction: ApiTransaction,
  members: FamilyMember[],
) => {
  const user =
    transaction.user ||
    (typeof transaction.userId === "object" ? transaction.userId : null);

  const directName =
    transaction.uploadedBy ||
    user?.name ||
    user?.fullname ||
    user?.login ||
    user?.email;

  if (directName?.trim()) {
    return directName.trim();
  }

  const transactionUserId = getTransactionUserId(transaction);
  const member = members.find((item) => item.id === transactionUserId);

  return member ? getMemberName(member) : "Участник семьи";
};

const getTransactionTitle = (transaction: ApiTransaction) => {
  const commentary = transaction.commentary?.trim();

  if (commentary && commentary !== "Комментарий не найден") {
    return commentary;
  }

  return normalizeCategory(transaction.categoryInfo || transaction.category);
};

const mapApiTransaction = (
  transaction: ApiTransaction,
  index: number,
  members: FamilyMember[],
): Transaction => {
  const category = normalizeCategory(transaction.categoryInfo || transaction.category);

  return {
    id:
      transaction._id ||
      transaction.id ||
      `${transaction.date || transaction.createdAt || "transaction"}-${index}`,
    amount: Number(transaction.amount) || 0,
    date: transaction.date || transaction.createdAt || "",
    category,
    categoryLabel: category,
    bank: transaction.bank || "Семейный счёт",
    description: transaction.description || getTransactionTitle(transaction),
    userId: getTransactionUserId(transaction),
    memberName: getTransactionUserName(transaction, members),
    source: transaction.source,
  };
};

const getBudgetLevel = (percent: number): BudgetUsageLevel => {
  if (percent <= 50) return "green";
  if (percent <= 80) return "yellow";
  return "red";
};

const normalizeLimits = (limits: FamilyCategoryLimit[]) =>
  limits
    .map((limit) => ({
      category: normalizeCategory(limit.category),
      limit: Number(limit.limit) || 0,
    }))
    .filter((limit) => limit.category && limit.limit > 0)
    .sort((a, b) => a.category.localeCompare(b.category, "ru"));

const filterTransactionsByDate = (
  transactions: Transaction[],
  dateFrom: string,
  dateTo: string,
) => {
  const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
  const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();

  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) {
    return transactions;
  }

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
  const filtered = transactions.filter((transaction) =>
    type === "income" ? transaction.amount > 0 : transaction.amount < 0,
  );
  const total = filtered.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0,
  );
  const grouped = filtered.reduce<Record<string, number>>(
    (acc, transaction) => {
      acc[transaction.categoryLabel] =
        (acc[transaction.categoryLabel] || 0) + Math.abs(transaction.amount);
      return acc;
    },
    {},
  );

  return Object.entries(grouped)
    .map(([key, value]) => ({
      key,
      label: key,
      value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
};

const buildBudgetItems = (
  transactions: Transaction[],
  limits: FamilyCategoryLimit[],
): BudgetItem[] => {
  return normalizeLimits(limits).map((limit) => {
    const spent = transactions
      .filter(
        (transaction) =>
          transaction.amount < 0 && transaction.categoryLabel === limit.category,
      )
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const percent = limit.limit > 0 ? (spent / limit.limit) * 100 : 0;

    return {
      category: limit.category,
      spent,
      limit: limit.limit,
      percent,
      progress: Math.min(Math.max(percent, 0), 100),
      level: getBudgetLevel(percent),
      remaining: limit.limit - spent,
    };
  });
};

const buildExportText = (
  family: Family | null,
  dateFrom: string,
  dateTo: string,
  memberName: string,
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
        `${formatDisplayDate(transaction.date)} | ${transaction.memberName} | ${transaction.description} | ${transaction.categoryLabel} | ${formatMoney(
          transaction.amount,
        )}`,
    )
    .join("\n");

  return [
    `Семейная аналитика: ${family?.name || "Семья"}`,
    `Период: ${dateFrom} — ${dateTo}`,
    `Участник: ${memberName}`,
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

const loadAllFamilyTransactions = async (members: FamilyMember[]) => {
  const token = localStorage.getItem("token");
  const allTransactions: ApiTransaction[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL("/api/family/transactions", API_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(TRANSACTIONS_FETCH_LIMIT));
    url.searchParams.set("sortBy", "date");
    url.searchParams.set("order", "desc");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Не удалось загрузить семейные операции");
    }

    const result: TransactionsResponse = await response.json();
    allTransactions.push(...(Array.isArray(result.data) ? result.data : []));
    totalPages = Math.max(1, Number(result.totalPages) || 1);
    page += 1;
  } while (page <= totalPages);

  return allTransactions.map((transaction, index) =>
    mapApiTransaction(transaction, index, members),
  );
};

export default function FamilyAnalyticsPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<FamilyCategoryLimit[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>("all");
  const [customFrom, setCustomFrom] = useState("2000-01-01");
  const [customTo, setCustomTo] = useState(formatDateInput(new Date()));
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [operationsPage, setOperationsPage] = useState(1);

  const { from: dateFrom, to: dateTo } = useMemo(
    () => getPeriodRange(selectedPeriod, customFrom, customTo),
    [selectedPeriod, customFrom, customTo],
  );

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const status = await getFamilyStatus();

      if (!status.family) {
        setFamily(null);
        setTransactions([]);
        setCategoryLimits([]);
        return;
      }

      const [loadedTransactions, loadedLimits] = await Promise.all([
        loadAllFamilyTransactions(status.family.members),
        getFamilyCategoryLimits(),
      ]);

      setFamily(status.family);
      setTransactions(loadedTransactions);
      setCategoryLimits(normalizeLimits(loadedLimits.limits || []));
    } catch (error: any) {
      console.error("Ошибка загрузки семейной аналитики:", error);
      setLoadError(error.message || "Не удалось загрузить семейную аналитику");
      setTransactions([]);
      setCategoryLimits([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const handleTransactionsChanged = () => {
      loadAnalytics();
    };

    window.addEventListener("transactions:changed", handleTransactionsChanged);
    window.addEventListener(
      "family-transactions:changed",
      handleTransactionsChanged,
    );

    return () => {
      window.removeEventListener(
        "transactions:changed",
        handleTransactionsChanged,
      );
      window.removeEventListener(
        "family-transactions:changed",
        handleTransactionsChanged,
      );
    };
  }, [loadAnalytics]);

  useEffect(() => {
    setOperationsPage(1);
  }, [selectedPeriod, customFrom, customTo, selectedMemberId]);

  const filteredTransactions = useMemo(() => {
    const periodFiltered = filterTransactionsByDate(transactions, dateFrom, dateTo);

    if (selectedMemberId === "all") {
      return periodFiltered;
    }

    return periodFiltered.filter(
      (transaction) => transaction.userId === selectedMemberId,
    );
  }, [dateFrom, dateTo, selectedMemberId, transactions]);

  const income = useMemo(
    () =>
      filteredTransactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [filteredTransactions],
  );

  const expenses = useMemo(
    () =>
      filteredTransactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [filteredTransactions],
  );

  const balance = income - expenses;

  const selectedMemberName = useMemo(() => {
    if (selectedMemberId === "all") {
      return "Все участники";
    }

    const member = family?.members.find((item) => item.id === selectedMemberId);
    return member ? getMemberName(member) : "Участник семьи";
  }, [family, selectedMemberId]);

  const expenseCategories = useMemo(
    () => groupByCategory(filteredTransactions, "expense"),
    [filteredTransactions],
  );

  const incomeCategories = useMemo(
    () => groupByCategory(filteredTransactions, "income"),
    [filteredTransactions],
  );

  const budgetItems = useMemo(
    () => buildBudgetItems(filteredTransactions, categoryLimits),
    [categoryLimits, filteredTransactions],
  );

  const totalOperationPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / OPERATIONS_PER_PAGE),
  );
  const safeOperationsPage = Math.min(operationsPage, totalOperationPages);
  const visibleTransactions = filteredTransactions.slice(
    (safeOperationsPage - 1) * OPERATIONS_PER_PAGE,
    safeOperationsPage * OPERATIONS_PER_PAGE,
  );
  const paginationItems = buildPaginationItems(
    safeOperationsPage,
    totalOperationPages,
  );
  const rangeFrom = filteredTransactions.length
    ? (safeOperationsPage - 1) * OPERATIONS_PER_PAGE + 1
    : 0;
  const rangeTo = Math.min(
    safeOperationsPage * OPERATIONS_PER_PAGE,
    filteredTransactions.length,
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
      family,
      dateFrom,
      dateTo,
      selectedMemberName,
      filteredTransactions,
    );
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = `family-analytics-${dateFrom}-${dateTo}.txt`;
    link.click();
    URL.revokeObjectURL(fileUrl);
  };

  if (isLoading && !transactions.length) {
    return (
      <main className="analytics-page family-analytics-page">
        <section className="panel periods-card">
          <p className="member-mail">Загружаем семейную аналитику...</p>
        </section>
      </main>
    );
  }

  if (!family) {
    return (
      <main className="analytics-page family-analytics-page">
        <section className="analytics-hero panel family-analytics-hero">
          <div>
            <h1>Семейная аналитика</h1>
            <p>Сначала создайте семью или примите приглашение.</p>
          </div>
          <Link className="mini-light-button" to="/family">
            Вернуться к семье
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="analytics-page family-analytics-page">
      <section className="analytics-hero panel family-analytics-hero">
        <div>
          <h1>Семейная аналитика</h1>
        </div>
        <Link className="mini-light-button" to="/family">
          Назад к семье
        </Link>
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

      <section className="panel family-member-filter-card family-member-filter-card--compact">
        <div className="family-member-filter-card__header">
          <h2 className="section-title period-title">Участники</h2>
          <span className="small-badge">{selectedMemberName}</span>
        </div>

        <div
          className="family-member-filter family-member-filter--compact"
          aria-label="Фильтр по участникам"
        >
          <button
            type="button"
            className={`family-member-filter__button family-member-filter__button--all ${selectedMemberId === "all" ? "active" : ""}`}
            onClick={() => setSelectedMemberId("all")}
          >
            <span>Все участники</span>
          </button>
          {family.members.map((member) => {
            const memberName = getMemberName(member);

            return (
              <button
                key={member.id}
                type="button"
                className={`family-member-filter__button ${selectedMemberId === member.id ? "active" : ""}`}
                onClick={() => setSelectedMemberId(member.id)}
              >
                {renderMemberAvatar(member)}
                <span>{memberName}</span>
              </button>
            );
          })}
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

      <section className="family-analytics-chart-grid">
        <CategoryChart
          title="Расходы по категориям"
          total={formatMoney(expenses)}
          transactions={filteredTransactions}
        />
        <CategoryChart
          title="Доходы по категориям"
          total={formatMoney(income)}
          transactions={filteredTransactions}
          isIncome
        />
        <div className="family-analytics-chart-wide">
          <CashFlowChart transactions={filteredTransactions} />
        </div>
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

      <section className="panel periods-card family-analytics-limits-card">
        <div className="chips-row family-limit-heading">
          <h2 className="section-title period-title">Лимиты по категориям</h2>
          <Link className="mini-light-button family-limit-config-button" to="/family">
            Настроить на странице семьи
          </Link>
        </div>

        <div className="member-list family-limit-list">
          {budgetItems.length ? (
            budgetItems.map((budget) => (
              <article className="family-limit-card" key={budget.category}>
                <div className="family-limit-row">
                  <strong>{budget.category}</strong>
                  <span className={`family-limit-percent ${budget.level}`}>
                    {Math.round(budget.percent)}%
                  </span>
                </div>

                <div
                  className="family-limit-progress"
                  role="progressbar"
                  aria-label={`Лимит категории ${budget.category}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(Math.round(budget.percent), 100)}
                >
                  <div
                    className={`family-limit-progress-fill ${budget.level}`}
                    style={{ width: `${budget.progress}%` }}
                  />
                </div>

                <div className="family-limit-row family-limit-meta">
                  <span>
                    {formatMoney(budget.spent)} из {formatMoney(budget.limit)}
                  </span>
                  <span>
                    {budget.remaining >= 0
                      ? `Осталось ${formatMoney(budget.remaining)}`
                      : `Превышение ${formatMoney(Math.abs(budget.remaining))}`}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <p className="member-mail">
              Лимиты пока не настроены. Вернитесь на страницу семьи и добавьте
              лимиты по нужным категориям.
            </p>
          )}
        </div>
      </section>

      <section className="panel operations-card operations-list">
        <div className="operations-list__header">
          <div>
            <h2 className="section-title operations-list__title">
              Все операции
            </h2>
            <p className="operations-list__subtitle">
              Операции за выбранный период и выбранных участников
            </p>
          </div>
          <span className="operations-list__count">
            {filteredTransactions.length}
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
                    {transaction.description || transaction.categoryLabel}
                  </strong>
                  <span className="operation-row__tag">
                    {transaction.memberName} · {transaction.categoryLabel} · {transaction.bank}
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

        {filteredTransactions.length > 0 && totalOperationPages > 1 && (
          <div
            className="operations-pagination"
            aria-label="Пагинация семейных операций"
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
              {rangeFrom}–{rangeTo} из {filteredTransactions.length}
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
