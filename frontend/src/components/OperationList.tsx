import React, { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "";
const OPERATIONS_PER_PAGE = 50;

interface ApiTransaction {
  _id: string;
  transactionNum?: number;
  amount: number;
  balance?: number;
  date: string;
  category?: string;
  categoryInfo?: string;
  bank?: string;
  commentary?: string;
  page?: number;
  fileId?: string;
  userId?: string;
}

type Operation = {
  id: string;
  title: string;
  tag: string;
  date: string;
  isoDate: string;
  amount: string;
  color: "green" | "red";
  source: ApiTransaction;
};

type EditFormState = {
  commentary: string;
  amount: string;
  type: "income" | "expense";
  categoryInfo: string;
  bank: string;
  date: string;
};

interface OperationsListProps {
  transactions: ApiTransaction[];
  onChanged?: () => void;
}

const categoryLabels: Record<string, string> = {
  salary: "Зарплата",
  salaries: "Зарплата",
  income: "Доходы",
  transfers: "Переводы",
  transfer: "Переводы",
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
  withdrawal: "Снятие наличных",
  withdrawals: "Снятие наличных",
  atm: "Снятие наличных",
  refund: "Возврат",
  refunds: "Возврат",
  qr: "QR",
};

const categoryOptions = [
  { value: "salary", label: "Зарплата" },
  { value: "transfers", label: "Переводы" },
  { value: "products", label: "Продукты" },
  { value: "transport", label: "Транспорт" },
  { value: "restaurant", label: "Рестораны" },
  { value: "services", label: "Услуги" },
  { value: "cash", label: "Наличные" },
  { value: "others", label: "Другое" },
];

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("ru-RU");
};

const toInputDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatAmount = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ru-RU")} ₽`;
};

const normalizeCategory = (categoryInfo?: string) => {
  const normalizedCategory = categoryInfo?.trim();

  if (!normalizedCategory) {
    return "others";
  }

  return normalizedCategory;
};

const getCategoryTitle = (categoryInfo?: string) => {
  const normalizedCategory = normalizeCategory(categoryInfo);
  const categoryKey = normalizedCategory.toLowerCase();

  if (categoryLabels[categoryKey]) {
    return categoryLabels[categoryKey];
  }

  if (/^[a-z][a-z\s_-]*$/i.test(normalizedCategory)) {
    return "Другое";
  }

  return normalizedCategory;
};

const getDescription = (transaction: ApiTransaction) => {
  const commentary = transaction.commentary?.trim();

  if (commentary && commentary !== "Комментарий не найден") {
    return commentary;
  }

  return getCategoryTitle(transaction.categoryInfo || transaction.category);
};

const sortTransactionsByDateDesc = (transactions: ApiTransaction[]) =>
  [...transactions].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    const safeDateA = Number.isNaN(dateA) ? 0 : dateA;
    const safeDateB = Number.isNaN(dateB) ? 0 : dateB;
    const dateDiff = safeDateB - safeDateA;

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return (b.transactionNum || 0) - (a.transactionNum || 0);
  });

const preparePayload = (form: EditFormState, source?: ApiTransaction) => {
  const rawAmount = Number(String(form.amount).replace(",", "."));
  const normalizedAmount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;

  return {
    date: form.date,
    amount: form.type === "income" ? normalizedAmount : -normalizedAmount,
    balance: source?.balance,
    category: form.categoryInfo,
    categoryInfo: form.categoryInfo,
    bank: form.bank.trim() || "Общий счёт",
    commentary: form.commentary.trim() || getCategoryTitle(form.categoryInfo),
  };
};

const buildPaginationItems = (page: number, totalPages: number) => {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);

  return [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
};

const OperationsList: React.FC<OperationsListProps> = ({
  transactions,
  onChanged,
}) => {
  const [items, setItems] = useState<ApiTransaction[]>(transactions);
  const [page, setPage] = useState(1);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(
    null,
  );
  const [editingTransaction, setEditingTransaction] =
    useState<ApiTransaction | null>(null);
  const [form, setForm] = useState<EditFormState>({
    commentary: "",
    amount: "",
    type: "expense",
    categoryInfo: "others",
    bank: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(transactions);
    setPage(1);
    setActiveOperationId(null);
  }, [transactions]);

  const mappedOperations: Operation[] = useMemo(
    () =>
      sortTransactionsByDateDesc(items).map((apiOp) => {
        const isIncome = apiOp.amount > 0;

        return {
          id: apiOp._id,
          title: getDescription(apiOp),
          tag: apiOp.bank || "Общий счёт",
          date: formatDate(apiOp.date),
          isoDate: apiOp.date,
          amount: formatAmount(apiOp.amount),
          color: isIncome ? "green" : "red",
          source: apiOp,
        };
      }),
    [items],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(mappedOperations.length / OPERATIONS_PER_PAGE),
  );
  const safePage = Math.min(page, totalPages);
  const visibleOperations = mappedOperations.slice(
    (safePage - 1) * OPERATIONS_PER_PAGE,
    safePage * OPERATIONS_PER_PAGE,
  );
  const paginationItems = buildPaginationItems(safePage, totalPages);
  const rangeFrom = mappedOperations.length
    ? (safePage - 1) * OPERATIONS_PER_PAGE + 1
    : 0;
  const rangeTo = Math.min(
    safePage * OPERATIONS_PER_PAGE,
    mappedOperations.length,
  );

  const changePage = (nextPage: number) => {
    const normalizedPage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(normalizedPage);
    setActiveOperationId(null);
    setNotice("");
  };

  const openEditModal = (transaction: ApiTransaction) => {
    const categoryInfo = normalizeCategory(
      transaction.categoryInfo || transaction.category,
    );

    setForm({
      commentary: getDescription(transaction),
      amount: String(Math.abs(transaction.amount)),
      type: transaction.amount >= 0 ? "income" : "expense",
      categoryInfo,
      bank: transaction.bank || "Общий счёт",
      date: toInputDate(transaction.date),
    });
    setEditingTransaction(transaction);
    setActiveOperationId(null);
    setNotice("");
  };

  const closeEditModal = () => {
    setEditingTransaction(null);
    setIsSaving(false);
  };

  const handleDelete = async (operation: Operation) => {
    setActiveOperationId(null);
    setNotice("");

    try {
      const response = await fetch(
        `${API_URL}/api/transactions/${operation.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Не удалось удалить операцию");
      }

      setItems((current) =>
        current.filter((transaction) => transaction._id !== operation.id),
      );
      setNotice("Операция удалена");
      onChanged?.();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Не удалось удалить операцию",
      );
    }
  };

  const handleRepeat = async (operation: Operation) => {
    setActiveOperationId(null);
    setNotice("");

    try {
      const source = operation.source;
      const payload = {
        date: toInputDate(source.date),
        amount: source.amount,
        balance: source.balance,
        category: source.category || source.categoryInfo || "others",
        categoryInfo: source.categoryInfo || source.category || "others",
        bank: source.bank || "Общий счёт",
        commentary: source.commentary || getDescription(source),
        page: source.page,
      };

      const response = await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Не удалось повторить операцию");
      }

      const result = await response.json();
      const createdTransaction = result.data || result;

      if (createdTransaction?._id) {
        setItems((current) => [createdTransaction, ...current]);
        setPage(1);
      }

      setNotice("Операция повторена");
      onChanged?.();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Не удалось повторить операцию",
      );
    }
  };

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingTransaction) {
      return;
    }

    setIsSaving(true);
    setNotice("");

    try {
      const payload = preparePayload(form, editingTransaction);
      const response = await fetch(
        `${API_URL}/api/transactions/${editingTransaction._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error("Не удалось сохранить операцию");
      }

      const result = await response.json();
      const updatedTransaction = result.data || result;

      setItems((current) =>
        current.map((transaction) =>
          transaction._id === editingTransaction._id
            ? updatedTransaction
            : transaction,
        ),
      );
      setNotice("Операция обновлена");
      setEditingTransaction(null);
      onChanged?.();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить операцию",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCategoryExists = categoryOptions.some(
    (category) => category.value === form.categoryInfo,
  );

  return (
    <section className="panel operations-card operations-list">
      <div className="operations-list__header">
        <div>
          <h2 className="section-title operations-list__title">Все операции</h2>
          <p className="operations-list__subtitle">
            Операции за выбранный период
          </p>
        </div>
        <span className="operations-list__count">
          {mappedOperations.length}
        </span>
      </div>

      {mappedOperations.length > 0 ? (
        <div className="operations-list__items">
          {visibleOperations.map((op) => (
            <article className="operation-row" key={op.id}>
              <div
                className={`operation-row__icon operation-row__icon--${op.color}`}
                aria-hidden="true"
              >
                {op.color === "green" ? "+" : "−"}
              </div>

              <div className="operation-row__main">
                <strong className="operation-row__title">{op.title}</strong>
                <span className="operation-row__tag">{op.tag}</span>
              </div>

              <time className="operation-row__date" dateTime={op.isoDate}>
                {op.date}
              </time>

              <strong
                className={`operation-row__amount operation-row__amount--${op.color}`}
              >
                {op.amount}
              </strong>

              <div className="operation-row__actions">
                <button
                  className="operation-row__menu-button"
                  type="button"
                  onClick={() => {
                    setActiveOperationId((current) =>
                      current === op.id ? null : op.id,
                    );
                    setNotice("");
                  }}
                  aria-label={`Открыть действия для операции ${op.title}`}
                >
                  ⋯
                </button>

                {activeOperationId === op.id && (
                  <div className="operation-row__menu" role="menu">
                    <button
                      type="button"
                      onClick={() => openEditModal(op.source)}
                    >
                      Редактировать
                    </button>
                    <button type="button" onClick={() => handleRepeat(op)}>
                      Повторить
                    </button>
                    <button
                      className="operation-row__menu-danger"
                      type="button"
                      onClick={() => handleDelete(op)}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="operations-list__empty">
          За выбранный период операций не найдено
        </div>
      )}

      {mappedOperations.length > 0 && totalPages > 1 && (
        <div className="operations-pagination" aria-label="Пагинация операций">
          <button
            className="pagination-button"
            type="button"
            onClick={() => changePage(safePage - 1)}
            disabled={safePage === 1}
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
                    className={`pagination-page ${safePage === pageItem ? "active" : ""}`}
                    type="button"
                    onClick={() => changePage(pageItem)}
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
            onClick={() => changePage(safePage + 1)}
            disabled={safePage === totalPages}
          >
            Вперёд
          </button>

          <span className="pagination-info">
            {rangeFrom}–{rangeTo} из {mappedOperations.length}
          </span>
        </div>
      )}

      {notice && <div className="operations-list__notice">{notice}</div>}

      {editingTransaction && (
        <div
          className="operation-edit-modal-backdrop"
          onMouseDown={closeEditModal}
        >
          <form
            className="operation-edit-modal panel"
            onSubmit={handleSaveEdit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="operation-edit-modal__close"
              type="button"
              onClick={closeEditModal}
              aria-label="Закрыть"
            >
              ×
            </button>

            <p className="operation-edit-modal__eyebrow">Операция</p>
            <h2>Редактировать операцию</h2>

            <label className="operation-edit-field">
              <span>Описание</span>
              <input
                value={form.commentary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    commentary: event.target.value,
                  }))
                }
                placeholder="Например: продукты, зарплата, перевод"
              />
            </label>

            <div className="operation-edit-grid">
              <label className="operation-edit-field">
                <span>Сумма</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="operation-edit-field">
                <span>Дата</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            <div className="operation-edit-type">
              <button
                type="button"
                className={form.type === "income" ? "active" : ""}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    type: "income",
                  }))
                }
              >
                Доход
              </button>
              <button
                type="button"
                className={form.type === "expense" ? "active" : ""}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    type: "expense",
                  }))
                }
              >
                Расход
              </button>
            </div>

            <div className="operation-edit-grid">
              <label className="operation-edit-field">
                <span>Категория</span>
                <select
                  value={form.categoryInfo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      categoryInfo: event.target.value,
                    }))
                  }
                >
                  {!selectedCategoryExists && (
                    <option value={form.categoryInfo}>
                      {getCategoryTitle(form.categoryInfo)}
                    </option>
                  )}
                  {categoryOptions.map((category) => (
                    <option value={category.value} key={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="operation-edit-field">
                <span>Счёт / банк</span>
                <input
                  value={form.bank}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      bank: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="operation-edit-modal__actions">
              <button
                type="button"
                className="operation-edit-cancel"
                onClick={closeEditModal}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="operation-edit-save"
                disabled={isSaving}
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default OperationsList;
