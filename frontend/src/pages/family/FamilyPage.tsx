import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BankStatementUploadRow } from "../../components/bank-statement";
import {
  createFamily,
  getFamilyCategoryLimits,
  getFamilyStatus,
  saveFamilyCategoryLimits,
  sendFamilyInvitation,
  type Family,
  type FamilyCategoryLimit,
  type FamilyMember as ApiFamilyMember,
} from "../../api/family";

export type FamilyPageVariant = "menu" | "prompt" | "create" | "settings";

type FamilyPageProps = {
  variant?: FamilyPageVariant;
};

type FamilyMemberView = {
  id: string;
  name: string;
  role: string;
  initials: string;
  balance: number;
  income: number;
  expenses: number;
};

type TransactionUser = {
  id?: string;
  _id?: string;
  fullname?: string;
  login?: string;
  email?: string;
  name?: string;
};

type Transaction = {
  _id?: string;
  id?: string;
  amount: number;
  date?: string;
  createdAt?: string;
  category?: string;
  categoryInfo?: string;
  bank?: string;
  commentary?: string;
  userId?: string | TransactionUser;
  user?: TransactionUser | null;
  uploadedBy?: string;
  source?: "personal" | "family";
};

type FamilyOperation = {
  id: string;
  title: string;
  member: string;
  category: string;
  date: string;
  amount: number;
};

type BudgetUsageLevel = "green" | "yellow" | "red";

type BudgetItem = {
  category: string;
  title: string;
  spent: number;
  limit: number;
  percent: number;
  progress: number;
  level: BudgetUsageLevel;
  remaining: number;
};

type TransactionsResponse = {
  data?: Transaction[];
  totalPages?: number;
};

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const OPERATIONS_PER_PAGE = 50;

const DEFAULT_LIMIT_CATEGORIES = [
  "Возврат",
  "Другое",
  "Зарплата",
  "Переводы",
  "Продукты",
  "Рестораны",
  "Снятие наличных",
  "Супермаркеты",
  "Транспорт",
  "Услуги",
  "Автомобиль",
  "Одежда",
  "Развлечения",
  "Дом",
  "Аптеки",
  "QR",
];

type PeriodId = "all" | "today" | "week" | "month" | "custom";

const periodOptions: { id: PeriodId; label: string }[] = [
  { id: "all", label: "Все время" },
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Эта неделя" },
  { id: "month", label: "Этот месяц" },
  { id: "custom", label: "Свой период" },
];

const appliedStyle: CSSProperties = {
  color: "#5f7488",
  fontSize: "13px",
  fontWeight: 700,
};

const getFamilyPageVariant = (pathname: string): FamilyPageVariant => {
  if (pathname.includes("/family/prompt")) return "prompt";
  if (pathname.includes("/family/create")) return "create";
  if (pathname.includes("/family/settings")) return "settings";

  return "menu";
};

const CATEGORY_LABELS: Record<string, string> = {
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

const normalizeCategory = (value?: string) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) return "Другое";
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
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
  )
    return "QR";
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
  if (normalized.includes("automobile") || normalized.includes("auto") || normalized.includes("car"))
    return "Автомобиль";
  if (normalized.includes("cloth") || normalized.includes("clothing") || normalized.includes("apparel"))
    return "Одежда";
  if (normalized.includes("entertainment")) return "Развлечения";
  if (normalized.includes("home") || normalized.includes("house")) return "Дом";
  if (normalized.includes("pharmacy") || normalized.includes("drugstore") || normalized.includes("medicine"))
    return "Аптеки";

  if (/^[a-z][a-z\s_-]*$/i.test(String(value).trim())) {
    return "Другое";
  }

  return value ? value[0].toUpperCase() + value.slice(1) : "Другое";
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value?: string) => {
  if (!value) return "Дата не указана";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";

  return new Intl.DateTimeFormat("ru-RU").format(date);
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getTodayInputValue = () => toDateInputValue(new Date());

const calculatePeriodDates = (id: PeriodId) => {
  const now = new Date();
  const todayStr = toDateInputValue(now);

  switch (id) {
    case "today":
      return { from: todayStr, to: todayStr };

    case "week": {
      const firstDay = new Date(now);
      const day = firstDay.getDay() || 7;
      firstDay.setDate(firstDay.getDate() - day + 1);

      return { from: toDateInputValue(firstDay), to: todayStr };
    }

    case "month": {
      const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return { from: toDateInputValue(firstDayMonth), to: todayStr };
    }

    case "all":
      return { from: "2000-01-01", to: todayStr };

    default:
      return null;
  }
};

const getTransactionTime = (transaction: Transaction) => {
  const dateValue = transaction.date || transaction.createdAt;

  if (!dateValue) return null;

  const time = new Date(dateValue).getTime();

  return Number.isNaN(time) ? null : time;
};

const getMemberName = (member: ApiFamilyMember) =>
  member.fullname?.trim() ||
  member.login?.trim() ||
  member.email?.trim() ||
  "Участник семьи";

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return name.trim().slice(0, 1).toUpperCase() || "У";
};

const memberRoleText = (role: ApiFamilyMember["role"]) =>
  role === "owner" ? "Владелец" : "Участник";

const getTransactionTitle = (transaction: Transaction) => {
  const commentary = transaction.commentary?.trim();

  if (commentary && commentary !== "Комментарий не найден") {
    return commentary;
  }

  return normalizeCategory(transaction.categoryInfo || transaction.category);
};

const getTransactionCategory = (transaction: Transaction) => {
  return normalizeCategory(transaction.categoryInfo || transaction.category);
};

const getTransactionUserId = (transaction: Transaction) => {
  if (transaction.user?.id || transaction.user?._id) {
    return String(transaction.user.id || transaction.user._id);
  }

  if (typeof transaction.userId === "object" && transaction.userId !== null) {
    return String(transaction.userId.id || transaction.userId._id || "");
  }

  return transaction.userId ? String(transaction.userId) : "";
};

const getTransactionUserName = (
  transaction: Transaction,
  members: FamilyMemberView[],
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

  return (
    members.find((member) => member.id === transactionUserId)?.name ||
    "Участник семьи"
  );
};

const getBudgetLevel = (percent: number): BudgetUsageLevel => {
  if (percent <= 50) return "green";
  if (percent <= 80) return "yellow";
  return "red";
};

const normalizeLimitAmount = (value: string) => {
  const numericValue = Number(value.replace(/\s/g, "").replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * 100) / 100;
};

const normalizeLimitsForSave = (limits: FamilyCategoryLimit[]) => {
  const unique = new Map<string, FamilyCategoryLimit>();

  limits.forEach((limit) => {
    const category = normalizeCategory(limit.category);
    const amount = Number(limit.limit);

    if (!category || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    unique.set(category.toLowerCase(), {
      category,
      limit: Math.round(amount * 100) / 100,
    });
  });

  return Array.from(unique.values()).sort((a, b) =>
    a.category.localeCompare(b.category, "ru"),
  );
};

const buildPaginationItems = (page: number, totalPages: number) => {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);

  return [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
};

export function FamilyPage({ variant = "menu" }: FamilyPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentVariant =
    variant === "menu" ? getFamilyPageVariant(location.pathname) : variant;
  const [selectedPeriodId, setSelectedPeriodId] = useState<PeriodId>("all");
  const [dateFrom, setDateFrom] = useState("2000-01-01");
  const [dateTo, setDateTo] = useState(() => getTodayInputValue());
  const [appliedPeriod, setAppliedPeriod] = useState("");
  const [family, setFamily] = useState<Family | null>(null);
  const [familyTransactions, setFamilyTransactions] = useState<Transaction[]>(
    [],
  );
  const [familyName, setFamilyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [categoryLimits, setCategoryLimits] = useState<FamilyCategoryLimit[]>(
    [],
  );
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [draftLimitCategory, setDraftLimitCategory] = useState(
    DEFAULT_LIMIT_CATEGORIES[0],
  );
  const [draftLimitAmount, setDraftLimitAmount] = useState("");
  const [limitFormError, setLimitFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLimitsSaving, setIsLimitsSaving] = useState(false);
  const [operationsPage, setOperationsPage] = useState(1);

  const loadCategoryLimits = useCallback(async (activeFamily: Family | null) => {
    if (!activeFamily) {
      setCategoryLimits([]);
      return;
    }

    try {
      const result = await getFamilyCategoryLimits();
      setCategoryLimits(normalizeLimitsForSave(result.limits || []));
    } catch (loadLimitsError: any) {
      console.error("Ошибка загрузки лимитов категорий:", loadLimitsError);
      setError(
        loadLimitsError.message || "Не удалось загрузить лимиты категорий",
      );
      setCategoryLimits([]);
    }
  }, []);

  const loadFamilyTransactions = useCallback(
    async (activeFamily: Family | null) => {
      if (!activeFamily) {
        setFamilyTransactions([]);
        return;
      }

      const token = localStorage.getItem("token");

      if (!token) {
        setFamilyTransactions([]);
        return;
      }

      setIsTransactionsLoading(true);

      try {
        const allTransactions: Transaction[] = [];
        let page = 1;
        let totalPages = 1;

        do {
          const url = new URL("/api/family/transactions", API_URL);
          url.searchParams.set("page", String(page));
          url.searchParams.set("limit", "200");
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
          allTransactions.push(
            ...(Array.isArray(result.data) ? result.data : []),
          );
          totalPages = Math.max(1, Number(result.totalPages) || 1);
          page += 1;
        } while (page <= totalPages);

        setFamilyTransactions(allTransactions);
      } catch (loadError: any) {
        console.error("Ошибка загрузки семейных операций:", loadError);
        setError(loadError.message || "Не удалось загрузить семейные операции");
        setFamilyTransactions([]);
      } finally {
        setIsTransactionsLoading(false);
      }
    },
    [],
  );

  const loadFamily = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const status = await getFamilyStatus();
      setFamily(status.family);
      setFamilyName(status.family?.name || "");
      await Promise.all([
        loadFamilyTransactions(status.family),
        loadCategoryLimits(status.family),
      ]);
    } catch (loadError: any) {
      setError(loadError.message || "Не удалось загрузить семейный доступ");
    } finally {
      setIsLoading(false);
    }
  }, [loadCategoryLimits, loadFamilyTransactions]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  useEffect(() => {
    const handleTransactionsChanged = () => {
      loadFamilyTransactions(family);
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
  }, [family, loadFamilyTransactions]);

  const handlePeriodClick = (id: PeriodId) => {
    setSelectedPeriodId(id);
    setAppliedPeriod("");

    const calculated = calculatePeriodDates(id);

    if (calculated) {
      setDateFrom(calculated.from);
      setDateTo(calculated.to);
    }
  };

  const filteredFamilyTransactions = useMemo(() => {
    if (selectedPeriodId === "all") {
      return familyTransactions;
    }

    const calculated = calculatePeriodDates(selectedPeriodId);
    const finalFrom = calculated ? calculated.from : dateFrom;
    const finalTo = calculated ? calculated.to : dateTo;
    const fromTime = new Date(`${finalFrom}T00:00:00`).getTime();
    const toTime = new Date(`${finalTo}T23:59:59.999`).getTime();

    if (Number.isNaN(fromTime) || Number.isNaN(toTime)) {
      return familyTransactions;
    }

    return familyTransactions.filter((transaction) => {
      const transactionTime = getTransactionTime(transaction);

      if (transactionTime === null) {
        return false;
      }

      return transactionTime >= fromTime && transactionTime <= toTime;
    });
  }, [dateFrom, dateTo, familyTransactions, selectedPeriodId]);

  const handleApplyPeriod = () => {
    const calculated = calculatePeriodDates(selectedPeriodId);
    const finalFrom = calculated ? calculated.from : dateFrom;
    const finalTo = calculated ? calculated.to : dateTo;
    const label =
      periodOptions.find((period) => period.id === selectedPeriodId)?.label ||
      "Период";

    setAppliedPeriod(`${label}: ${finalFrom} — ${finalTo}`);
  };

  const transactionTotals = useMemo(() => {
    const income = filteredFamilyTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount);
      return amount > 0 ? sum + amount : sum;
    }, 0);

    const expenses = filteredFamilyTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    return {
      income,
      expenses,
      balance: income - expenses,
    };
  }, [filteredFamilyTransactions]);

  const transactionCategories = useMemo(() => {
    const categories = filteredFamilyTransactions.map(getTransactionCategory);

    return Array.from(new Set(categories)).filter(Boolean);
  }, [filteredFamilyTransactions]);

  const availableLimitCategories = useMemo(() => {
    return Array.from(
      new Set([...DEFAULT_LIMIT_CATEGORIES, ...transactionCategories]),
    ).sort((a, b) => a.localeCompare(b, "ru"));
  }, [transactionCategories]);

  useEffect(() => {
    if (!draftLimitCategory && availableLimitCategories.length) {
      setDraftLimitCategory(availableLimitCategories[0]);
    }
  }, [availableLimitCategories, draftLimitCategory]);

  const budgetItems = useMemo<BudgetItem[]>(() => {
    return categoryLimits.map((limit) => {
      const spent = filteredFamilyTransactions
        .filter((transaction) => {
          const amount = Number(transaction.amount);
          return amount < 0 && getTransactionCategory(transaction) === limit.category;
        })
        .reduce(
          (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
          0,
        );

      const safeLimit = Math.max(Number(limit.limit) || 0, 0);
      const percent = safeLimit > 0 ? (spent / safeLimit) * 100 : 0;
      const progress = Math.min(Math.max(percent, 0), 100);

      return {
        category: limit.category,
        title: limit.category,
        spent,
        limit: safeLimit,
        percent,
        progress,
        level: getBudgetLevel(percent),
        remaining: safeLimit - spent,
      };
    });
  }, [categoryLimits, filteredFamilyTransactions]);

  const visibleMembers = useMemo<FamilyMemberView[]>(() => {
    if (!family?.members?.length) {
      return [];
    }

    return family.members.map((member, index) => {
      const name = getMemberName(member);
      const memberId = member.id || String(index);
      const memberTransactions = filteredFamilyTransactions.filter(
        (transaction) => getTransactionUserId(transaction) === memberId,
      );

      const income = memberTransactions
        .filter((transaction) => Number(transaction.amount) > 0)
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      const expenses = memberTransactions
        .filter((transaction) => Number(transaction.amount) < 0)
        .reduce(
          (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
          0,
        );

      return {
        id: memberId,
        name,
        role: memberRoleText(member.role),
        initials: getInitials(name),
        balance: income - expenses,
        income,
        expenses,
      };
    });
  }, [family, filteredFamilyTransactions]);

  useEffect(() => {
    setOperationsPage(1);
  }, [filteredFamilyTransactions]);

  const allOperations = useMemo<FamilyOperation[]>(() => {
    return filteredFamilyTransactions.map((transaction, index) => ({
      id:
        transaction._id ||
        transaction.id ||
        `${transaction.date || transaction.createdAt || "operation"}-${index}`,
      title: getTransactionTitle(transaction),
      member: getTransactionUserName(transaction, visibleMembers),
      category: getTransactionCategory(transaction),
      date: formatDate(transaction.date || transaction.createdAt),
      amount: Number(transaction.amount) || 0,
    }));
  }, [filteredFamilyTransactions, visibleMembers]);

  const totalOperationPages = Math.max(
    1,
    Math.ceil(allOperations.length / OPERATIONS_PER_PAGE),
  );
  const safeOperationsPage = Math.min(operationsPage, totalOperationPages);
  const visibleOperations = useMemo(() => {
    return allOperations.slice(
      (safeOperationsPage - 1) * OPERATIONS_PER_PAGE,
      safeOperationsPage * OPERATIONS_PER_PAGE,
    );
  }, [allOperations, safeOperationsPage]);
  const operationPaginationItems = buildPaginationItems(
    safeOperationsPage,
    totalOperationPages,
  );
  const operationRangeFrom = allOperations.length
    ? (safeOperationsPage - 1) * OPERATIONS_PER_PAGE + 1
    : 0;
  const operationRangeTo = Math.min(
    safeOperationsPage * OPERATIONS_PER_PAGE,
    allOperations.length,
  );

  const changeOperationsPage = (nextPage: number) => {
    setOperationsPage(Math.min(Math.max(nextPage, 1), totalOperationPages));
  };

  const totals = useMemo(
    () => ({
      balance: transactionTotals.balance,
      income: transactionTotals.income,
      expenses: transactionTotals.expenses,
    }),
    [transactionTotals],
  );

  const closeLink = family ? "/family" : "/family/create";

  const notifyFamilyChanged = () => {
    window.dispatchEvent(new Event("family:changed"));
    window.dispatchEvent(new Event("invitations:changed"));
  };

  const handleFamilyUploadSuccess = async () => {
    setNotice("PDF-выписка обработана");
    setError("");
    await loadFamilyTransactions(family);
  };

  const handleCreateFamily = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    setError("");
    setIsSaving(true);

    try {
      const result = await createFamily(familyName || "");
      setFamily(result.family);
      setFamilyName(result.family.name);
      setFamilyTransactions([]);
      setCategoryLimits([]);
      setNotice("Семья создана");
      notifyFamilyChanged();
      navigate("/family", { replace: true });
    } catch (createError: any) {
      setError(createError.message || "Не удалось создать семью");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    setError("");

    if (!inviteEmail.trim()) {
      setError("Введите email участника");
      return;
    }

    setIsSaving(true);

    try {
      await sendFamilyInvitation(inviteEmail);
      setNotice(`Приглашение отправлено на ${inviteEmail.trim()}`);
      setInviteEmail("");
      notifyFamilyChanged();
    } catch (inviteError: any) {
      setError(inviteError.message || "Не удалось отправить приглашение");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenLimitsModal = () => {
    setLimitFormError("");
    setDraftLimitCategory(
      draftLimitCategory || availableLimitCategories[0] || DEFAULT_LIMIT_CATEGORIES[0],
    );
    setDraftLimitAmount("");
    setIsLimitModalOpen(true);
  };

  const handleSaveCategoryLimit = async (event: FormEvent) => {
    event.preventDefault();
    setLimitFormError("");
    setNotice("");
    setError("");

    const category = draftLimitCategory.trim();
    const limit = normalizeLimitAmount(draftLimitAmount);

    if (!category) {
      setLimitFormError("Выберите категорию");
      return;
    }

    if (limit <= 0) {
      setLimitFormError("Укажите лимит больше 0");
      return;
    }

    const nextLimits = normalizeLimitsForSave([
      ...categoryLimits.filter(
        (item) => item.category.toLowerCase() !== category.toLowerCase(),
      ),
      { category, limit },
    ]);

    setIsLimitsSaving(true);

    try {
      const result = await saveFamilyCategoryLimits(nextLimits);
      setCategoryLimits(normalizeLimitsForSave(result.limits || []));
      setDraftLimitAmount("");
      setNotice("Лимит сохранён");
    } catch (saveError: any) {
      setLimitFormError(saveError.message || "Не удалось сохранить лимит");
    } finally {
      setIsLimitsSaving(false);
    }
  };

  const handleRemoveCategoryLimit = async (category: string) => {
    setLimitFormError("");
    setNotice("");
    setError("");

    const nextLimits = normalizeLimitsForSave(
      categoryLimits.filter(
        (item) => item.category.toLowerCase() !== category.toLowerCase(),
      ),
    );

    setIsLimitsSaving(true);

    try {
      const result = await saveFamilyCategoryLimits(nextLimits);
      setCategoryLimits(normalizeLimitsForSave(result.limits || []));
      setNotice("Лимит удалён");
    } catch (removeError: any) {
      setLimitFormError(removeError.message || "Не удалось удалить лимит");
    } finally {
      setIsLimitsSaving(false);
    }
  };

  const renderCreateFamilyPanel = () => (
    <section
      className="panel periods-card"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 360,
        padding: "40px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1
          className="section-title"
          style={{
            color: "#0f5f94",
            fontSize: 34,
            lineHeight: 1.2,
            margin: 0,
            textAlign: "center",
          }}
        >
          Создать семью
        </h1>
        <p
          className="member-mail"
          style={{ marginTop: 14, textAlign: "center" }}
        >
          Создание семьи позволит вам приглашать участников в семью и вести
          совместный бюджет
        </p>
        <form
          onSubmit={handleCreateFamily}
          style={{ marginTop: 28, width: "100%" }}
        >
          <label className="field-label large" htmlFor="familyNameInline">
            Название семьи
          </label>
          <input
            className="input-shell"
            id="familyNameInline"
            value={familyName}
            onChange={(event) => setFamilyName(event.target.value)}
            placeholder="Например, Семья Ивановых"
          />
          {error && <p className="profile-error">{error}</p>}
          {notice && <p className="profile-success">{notice}</p>}
          <div
            className="modal-actions"
            style={{ justifyContent: "center", width: "100%" }}
          >
            <button
              className="primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Создание..." : "Создать семью"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );

  if (isLoading) {
    return (
      <section className="panel periods-card">
        <p className="member-mail">Загрузка семейного доступа...</p>
      </section>
    );
  }

  if (!family) {
    return renderCreateFamilyPanel();
  }

  return (
    <>
      <section
        className="panel periods-card"
        style={{ position: "relative", minHeight: 120 }}
      >
        <h1
          className="section-title"
          style={{
            color: "#0f5f94",
            fontSize: 34,
            lineHeight: 1.2,
            margin: 0,
            textAlign: "center",
          }}
        >
          {family.name}
        </h1>

        <div
          className="family-hero-actions"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <Link
            className="mini-light-button"
            to="/family/analytics"
            style={{
              minHeight: 44,
              padding: "0 22px",
              gap: 8,
              whiteSpace: "nowrap",
            }}
          >
            Перейти к детальной аналитике
          </Link>

          <Link
            className="mini-light-button"
            to="/family/prompt"
            style={{
              minHeight: 44,
              padding: "0 22px",
              gap: 8,
              whiteSpace: "nowrap",
            }}
          >
            <span className="plus">＋</span>
            Пригласить в семью
          </Link>
        </div>

        <BankStatementUploadRow
          style={{ marginTop: 18 }}
          scope="family"
          onUploadSuccess={handleFamilyUploadSuccess}
        />
        {notice && <p className="profile-success">{notice}</p>}
        {error && <p className="profile-error">{error}</p>}
      </section>

      <section className="stats-row" style={{ marginTop: 16 }}>
        <article className="panel stat-card">
          <div className="stat-label">Общий баланс</div>
          <div className="stat-value">{formatMoney(totals.balance)}</div>
        </article>
        <article className="panel stat-card">
          <div className="stat-label">Доходы семьи</div>
          <div className="stat-value green">{formatMoney(totals.income)}</div>
        </article>
        <article className="panel stat-card">
          <div className="stat-label">Расходы семьи</div>
          <div className="stat-value red">{formatMoney(totals.expenses)}</div>
        </article>
      </section>

      <main className="dashboard-grid" style={{ marginTop: 16 }}>
        <div className="left-stack">
          <section className="panel periods-card period-selector">
            <h2 className="section-title period-title period-selector__title">
              Периоды
            </h2>

            <div className="period-selector__chips" aria-label="Выбор периода">
              {periodOptions.map((period) => (
                <button
                  key={period.id}
                  type="button"
                  className={`period-chip period-selector__chip ${selectedPeriodId === period.id ? "active" : ""}`}
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
                  aria-label="Дата начала"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setSelectedPeriodId("custom");
                    setAppliedPeriod("");
                    setDateFrom(event.target.value);
                  }}
                />
              </label>

              <span className="period-selector__date-separator">—</span>

              <label className="period-selector__date-pill">
                <span>По</span>
                <input
                  aria-label="Дата окончания"
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setSelectedPeriodId("custom");
                    setAppliedPeriod("");
                    setDateTo(event.target.value);
                  }}
                />
              </label>
            </div>

            <button
              className="action-light period-selector__apply"
              type="button"
              onClick={handleApplyPeriod}
            >
              Применить
            </button>

            {appliedPeriod && (
              <div style={{ marginTop: 10, textAlign: "center" }}>
                <span style={appliedStyle}>Выбран период: {appliedPeriod}</span>
              </div>
            )}
          </section>

          <section className="panel periods-card">
            <div className="chips-row family-limit-heading">
              <h2 className="section-title period-title">
                Лимиты по категориям
              </h2>
              <button
                className="mini-light-button family-limit-config-button"
                type="button"
                onClick={handleOpenLimitsModal}
              >
                <span className="plus">＋</span>
                Настроить лимиты
              </button>
            </div>

            <div className="member-list family-limit-list">
              {budgetItems.length ? (
                budgetItems.map((budget) => (
                  <article className="family-limit-card" key={budget.category}>
                    <div className="family-limit-row">
                      <strong>{budget.title}</strong>
                      <span className={`family-limit-percent ${budget.level}`}>
                        {Math.round(budget.percent)}%
                      </span>
                    </div>

                    <div
                      className="family-limit-progress"
                      role="progressbar"
                      aria-label={`Лимит категории ${budget.title}`}
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
                  Нажмите «Настроить лимиты», выберите категорию и укажите
                  семейный лимит.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="right-stack">
          <section className="panel periods-card">
            <div
              className="chips-row"
              style={{ justifyContent: "space-between" }}
            >
              <h2 className="section-title period-title">Все операции</h2>
              <span className="small-badge">{allOperations.length}</span>
            </div>

            <div className="member-list">
              {isTransactionsLoading ? (
                <p className="member-mail">Загрузка операций...</p>
              ) : visibleOperations.length ? (
                visibleOperations.map((operation) => (
                  <article className="member-card" key={operation.id}>
                    <div>
                      <div className="member-name">{operation.title}</div>
                      <div className="member-mail">
                        {operation.member} · {operation.category}
                      </div>
                      <div className="member-mail">{operation.date}</div>
                    </div>
                    <strong
                      className={`stat-value ${operation.amount > 0 ? "green" : "red"}`}
                      style={{ fontSize: 20 }}
                    >
                      {formatMoney(operation.amount)}
                    </strong>
                  </article>
                ))
              ) : (
                <p className="member-mail">Операций за выбранный период нет.</p>
              )}
            </div>

            {allOperations.length > 0 && totalOperationPages > 1 && (
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
                  {operationPaginationItems.map((pageItem, index) => {
                    const previous = operationPaginationItems[index - 1];
                    const hasGap = previous && pageItem - previous > 1;

                    return (
                      <span
                        key={pageItem}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {hasGap && <span className="pagination-gap">…</span>}
                        <button
                          className={`pagination-page ${safeOperationsPage === pageItem ? "active" : ""}`}
                          type="button"
                          onClick={() => changeOperationsPage(pageItem)}
                        >
                          {pageItem}
                        </button>
                      </span>
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
                  {operationRangeFrom}–{operationRangeTo} из{" "}
                  {allOperations.length}
                </span>
              </div>
            )}
          </section>
        </aside>
      </main>

      {currentVariant === "prompt" && family && (
        <div className="overlay">
          <form className="modal" onSubmit={handleInvite}>
            <Link className="close-link" to={closeLink}>
              ×
            </Link>
            <p className="stat-label">Приглашение</p>
            <h2 className="modal-title">Добавить участника</h2>
            <p className="modal-text">
              Укажи email человека, которого нужно подключить к семейному
              бюджету.
            </p>
            <label
              className="field-label large"
              htmlFor="inviteEmail"
              style={{ marginTop: 24 }}
            >
              Email
            </label>
            <input
              className="input-shell"
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="name@example.com"
            />
            {error && <p className="profile-error">{error}</p>}
            {notice && <p className="profile-success">{notice}</p>}
            <div className="modal-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "Отправка..." : "Отправить приглашение"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLimitModalOpen && family && (
        <div className="overlay">
          <form className="modal family-limit-modal" onSubmit={handleSaveCategoryLimit}>
            <button
              className="close-link family-modal-close"
              type="button"
              onClick={() => setIsLimitModalOpen(false)}
            >
              ×
            </button>
            <p className="stat-label">Семейный бюджет</p>
            <h2 className="modal-title">Лимиты по категориям</h2>
            <p className="modal-text">
              Выберите категорию и укажите максимальную сумму расходов. Прогресс
              считается по операциям за выбранный период.
            </p>

            <div className="family-limit-form-grid">
              <label>
                <span className="field-label large">Категория</span>
                <select
                  className="input-shell"
                  value={draftLimitCategory}
                  onChange={(event) => setDraftLimitCategory(event.target.value)}
                >
                  {availableLimitCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="field-label large">Лимит, ₽</span>
                <input
                  className="input-shell"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  type="number"
                  value={draftLimitAmount}
                  onChange={(event) => setDraftLimitAmount(event.target.value)}
                  placeholder="Например, 30000"
                />
              </label>
            </div>

            {limitFormError && <p className="profile-error">{limitFormError}</p>}

            <div className="modal-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={isLimitsSaving}
              >
                {isLimitsSaving ? "Сохранение..." : "Сохранить лимит"}
              </button>
            </div>

            <div className="family-limit-modal-list">
              <h3 className="section-title period-title">Текущие лимиты</h3>
              {categoryLimits.length ? (
                categoryLimits.map((limit) => (
                  <div className="soft-row" key={limit.category}>
                    <span>{limit.category}</span>
                    <strong>{formatMoney(limit.limit)}</strong>
                    <button
                      className="family-limit-remove"
                      type="button"
                      onClick={() => handleRemoveCategoryLimit(limit.category)}
                      disabled={isLimitsSaving}
                    >
                      Удалить
                    </button>
                  </div>
                ))
              ) : (
                <p className="member-mail">Пока нет настроенных лимитов.</p>
              )}
            </div>
          </form>
        </div>
      )}

      {currentVariant === "settings" && family && (
        <div className="overlay">
          <section className="modal">
            <Link className="close-link" to={closeLink}>
              ×
            </Link>
            <p className="stat-label">Настройки</p>
            <h2 className="modal-title">Настройки семьи</h2>
            <p className="modal-text">
              Управление участниками, правами доступа и общим бюджетом.
            </p>
            <div className="member-list" style={{ marginTop: 24 }}>
              <div className="soft-row">
                <span>Название семьи</span>
                <strong>{family.name}</strong>
              </div>
              <button className="soft-row" type="button">
                Переименовать семью
              </button>
              <button
                className="soft-row"
                type="button"
                onClick={() => {
                  navigate("/family");
                  handleOpenLimitsModal();
                }}
              >
                Настроить лимиты
              </button>
              <button className="soft-row" type="button">
                Права участников
              </button>
              <button className="soft-row danger-link" type="button">
                Покинуть семью
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default FamilyPage;
