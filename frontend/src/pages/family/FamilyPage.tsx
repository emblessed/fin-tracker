import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BankStatementUploadRow } from '../../components/bank-statement';
import {
  createFamily,
  getFamilyStatus,
  sendFamilyInvitation,
  type Family,
  type FamilyMember as ApiFamilyMember,
} from '../../api/family';

export type FamilyPageVariant = 'menu' | 'prompt' | 'create' | 'settings';

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
};

type FamilyOperation = {
  id: string;
  title: string;
  member: string;
  category: string;
  date: string;
  amount: number;
};

type BudgetItem = {
  title: string;
  spent: number;
  limit: number;
};

type TransactionsResponse = {
  data?: Transaction[];
  totalPages?: number;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const budgets: BudgetItem[] = [];
const periodOptions = ['Все время', 'Сегодня', 'Эта неделя', 'Этот месяц', 'Свой период'];

const CATEGORY_LABELS: Record<string, string> = {
  salary: 'Зарплата',
  income: 'Доходы',
  transfer: 'Переводы',
  transfers: 'Переводы',
  withdrawal: 'Снятие наличных',
  refund: 'Возврат',
  products: 'Продукты',
  product: 'Продукты',
  food: 'Еда',
  supermarket: 'Супермаркеты',
  transport: 'Транспорт',
  restaurant: 'Рестораны',
  restaurants: 'Рестораны',
  services: 'Услуги',
  cash: 'Наличные',
  qr: 'QR',
  other: 'Другое',
  others: 'Другое',
};

const normalizeCategory = (value?: string) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) return 'Другое';
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
  if (normalized.includes('зарп') || normalized.includes('salary')) return 'Зарплата';
  if (normalized.includes('перев') || normalized.includes('transfer')) return 'Переводы';
  if (normalized.includes('withdrawal') || normalized.includes('withdraw') || normalized.includes('сняти')) return 'Снятие наличных';
  if (normalized.includes('refund') || normalized.includes('возврат')) return 'Возврат';
  if (normalized === 'qr' || normalized.includes('qr') || normalized.includes('сбп')) return 'QR';
  if (normalized.includes('продукт') || normalized.includes('product')) return 'Продукты';
  if (normalized.includes('транспорт') || normalized.includes('transport')) return 'Транспорт';
  if (normalized.includes('ресторан') || normalized.includes('restaurant')) return 'Рестораны';
  if (normalized.includes('услуг') || normalized.includes('service')) return 'Услуги';
  if (normalized.includes('cash') || normalized.includes('налич')) return 'Наличные';

  return value ? value[0].toUpperCase() + value.slice(1) : 'Другое';
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value?: string) => {
  if (!value) return 'Дата не указана';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Дата не указана';

  return new Intl.DateTimeFormat('ru-RU').format(date);
};

const getMemberName = (member: ApiFamilyMember) =>
  member.fullname?.trim() || member.login?.trim() || member.email?.trim() || 'Участник семьи';

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return name.trim().slice(0, 1).toUpperCase() || 'У';
};

const memberRoleText = (role: ApiFamilyMember['role']) =>
  role === 'owner' ? 'Владелец' : 'Участник';

const getTransactionTitle = (transaction: Transaction) => {
  const commentary = transaction.commentary?.trim();

  if (commentary && commentary !== 'Комментарий не найден') {
    return commentary;
  }

  return normalizeCategory(transaction.categoryInfo || transaction.category);
};

const getTransactionCategory = (transaction: Transaction) => {
  return normalizeCategory(transaction.categoryInfo || transaction.category);
};

export function FamilyPage({ variant = 'menu' }: FamilyPageProps) {
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState('Все время');
  const [family, setFamily] = useState<Family | null>(null);
  const [familyTransactions, setFamilyTransactions] = useState<Transaction[]>([]);
  const [familyName, setFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadFamilyTransactions = useCallback(async (activeFamily: Family | null) => {
    if (!activeFamily) {
      setFamilyTransactions([]);
      return;
    }

    const token = localStorage.getItem('token');

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
        const url = new URL('/api/family/transactions', API_URL);
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', '200');
        url.searchParams.set('sortBy', 'date');
        url.searchParams.set('order', 'desc');

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Не удалось загрузить семейные операции');
        }

        const result: TransactionsResponse = await response.json();
        allTransactions.push(...(Array.isArray(result.data) ? result.data : []));
        totalPages = Math.max(1, Number(result.totalPages) || 1);
        page += 1;
      } while (page <= totalPages);

      setFamilyTransactions(allTransactions);
    } catch (loadError: any) {
      console.error('Ошибка загрузки семейных операций:', loadError);
      setError(loadError.message || 'Не удалось загрузить семейные операции');
      setFamilyTransactions([]);
    } finally {
      setIsTransactionsLoading(false);
    }
  }, []);

  const loadFamily = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const status = await getFamilyStatus();
      setFamily(status.family);
      setFamilyName(status.family?.name || '');
      await loadFamilyTransactions(status.family);
    } catch (loadError: any) {
      setError(loadError.message || 'Не удалось загрузить семейный доступ');
    } finally {
      setIsLoading(false);
    }
  }, [loadFamilyTransactions]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  useEffect(() => {
    const handleTransactionsChanged = () => {
      loadFamilyTransactions(family);
    };

    window.addEventListener('transactions:changed', handleTransactionsChanged);
    window.addEventListener('family-transactions:changed', handleTransactionsChanged);

    return () => {
      window.removeEventListener('transactions:changed', handleTransactionsChanged);
      window.removeEventListener('family-transactions:changed', handleTransactionsChanged);
    };
  }, [family, loadFamilyTransactions]);

  const transactionTotals = useMemo(() => {
    const income = familyTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount);
      return amount > 0 ? sum + amount : sum;
    }, 0);

    const expenses = familyTransactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    return {
      income,
      expenses,
      balance: income - expenses,
    };
  }, [familyTransactions]);

  const visibleMembers = useMemo<FamilyMemberView[]>(() => {
    if (!family?.members?.length) {
      return [];
    }

    return family.members.map((member, index) => {
      const name = getMemberName(member);
      const isFirstMember = index === 0;

      return {
        id: member.id || String(index),
        name,
        role: memberRoleText(member.role),
        initials: getInitials(name),
        balance: isFirstMember ? transactionTotals.balance : 0,
        income: isFirstMember ? transactionTotals.income : 0,
        expenses: isFirstMember ? transactionTotals.expenses : 0,
      };
    });
  }, [family, transactionTotals]);

  const visibleOperations = useMemo<FamilyOperation[]>(() => {
    const ownerName = visibleMembers.find((member) => member.role === 'Владелец')?.name || 'Владелец семьи';

    return familyTransactions.slice(0, 8).map((transaction, index) => ({
      id: transaction._id || transaction.id || `${transaction.date || 'operation'}-${index}`,
      title: getTransactionTitle(transaction),
      member: ownerName,
      category: getTransactionCategory(transaction),
      date: formatDate(transaction.date),
      amount: Number(transaction.amount) || 0,
    }));
  }, [familyTransactions, visibleMembers]);

  const totals = useMemo(
    () => ({
      balance: transactionTotals.balance,
      income: transactionTotals.income,
      expenses: transactionTotals.expenses,
    }),
    [transactionTotals],
  );

  const closeLink = family ? '/family' : '/family/create';

  const notifyFamilyChanged = () => {
    window.dispatchEvent(new Event('family:changed'));
    window.dispatchEvent(new Event('invitations:changed'));
  };

  const handleFamilyUploadSuccess = async () => {
    setNotice('PDF-выписка обработана');
    setError('');
    await loadFamilyTransactions(family);
  };

  const handleCreateFamily = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setError('');
    setIsSaving(true);

    try {
      const result = await createFamily(familyName || '');
      setFamily(result.family);
      setFamilyName(result.family.name);
      setFamilyTransactions([]);
      setNotice('Семья создана');
      notifyFamilyChanged();
      navigate('/family', { replace: true });
    } catch (createError: any) {
      setError(createError.message || 'Не удалось создать семью');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setError('');

    if (!inviteEmail.trim()) {
      setError('Введите email участника');
      return;
    }

    setIsSaving(true);

    try {
      await sendFamilyInvitation(inviteEmail);
      setNotice(`Приглашение отправлено на ${inviteEmail.trim()}`);
      setInviteEmail('');
      notifyFamilyChanged();
    } catch (inviteError: any) {
      setError(inviteError.message || 'Не удалось отправить приглашение');
    } finally {
      setIsSaving(false);
    }
  };

  const renderCreateFamilyPanel = () => (
    <section
      className="panel periods-card"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 360,
        padding: '40px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        <h1
          className="section-title"
          style={{
            color: '#0f5f94',
            fontSize: 34,
            lineHeight: 1.2,
            margin: 0,
            textAlign: 'center',
          }}
        >
          Создать семью
        </h1>

        <p className="member-mail" style={{ marginTop: 14, textAlign: 'center' }}>
          Создание семьи позволит вам приглашать участников в семью и вести совместный бюджет
        </p>

        <form onSubmit={handleCreateFamily} style={{ marginTop: 28, width: '100%' }}>
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

          <div className="modal-actions" style={{ justifyContent: 'center', width: '100%' }}>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Создание...' : 'Создать семью'}
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
      <section className="panel periods-card">
        <h1
          className="section-title"
          style={{
            color: '#0f5f94',
            fontSize: 34,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {family.name}
        </h1>

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
          <section className="panel periods-card">
            <h2 className="section-title period-title">Периоды</h2>

            <div className="chips-row">
              {periodOptions.map((period) => (
                <button
                  className={`period-chip ${selectedPeriod === period ? 'active' : ''}`}
                  key={period}
                  type="button"
                  onClick={() => setSelectedPeriod(period)}
                >
                  {period}
                </button>
              ))}
            </div>

            <div className="dates-row" style={{ marginTop: 16 }}>
              <span className="date-field">С</span>
              <span className="date-dash">—</span>
              <span className="date-field">По</span>
              <button className="action-light" type="button">
                Применить
              </button>
            </div>
          </section>

          <section className="panel periods-card">
            <div className="chips-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="section-title period-title">Участники</h2>

              <Link className="mini-light-button" to="/family/prompt">
                <span className="plus">＋</span>
                Пригласить
              </Link>
            </div>

            <div className="member-list">
              {visibleMembers.map((member) => (
                <article className={`member-card ${member.role === 'Владелец' ? 'owner' : ''}`} key={member.id}>
                  <div>
                    <div className="member-name">{member.name}</div>
                    <div className="member-mail">{member.role}</div>
                  </div>

                  <strong className="stat-value" style={{ fontSize: 20 }}>
                    {formatMoney(member.balance)}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="right-stack">
          <section className="panel periods-card">
            <div className="chips-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="section-title period-title">Лимиты по категориям</h2>
              <span className="small-badge">Май</span>
            </div>

            <div className="member-list">
              {budgets.length ? (
                budgets.map((budget) => {
                  const percent = Math.min(Math.round((budget.spent / budget.limit) * 100), 100);

                  return (
                    <div className="invite-card" key={budget.title}>
                      <div className="chips-row" style={{ justifyContent: 'space-between' }}>
                        <strong>{budget.title}</strong>
                        <span>{percent}%</span>
                      </div>

                      <p className="member-mail">
                        {formatMoney(budget.spent)} из {formatMoney(budget.limit)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="member-mail">Лимиты появятся после настройки семейного бюджета.</p>
              )}
            </div>
          </section>

          <section className="panel periods-card">
            <div className="chips-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="section-title period-title">Последние операции</h2>
              <span className="small-badge">{visibleOperations.length}</span>
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

                    <strong className={`stat-value ${operation.amount > 0 ? 'green' : 'red'}`} style={{ fontSize: 20 }}>
                      {formatMoney(operation.amount)}
                    </strong>
                  </article>
                ))
              ) : (
                <p className="member-mail">Операций пока нет. Они появятся после загрузки PDF-выписки на странице семьи.</p>
              )}
            </div>
          </section>
        </aside>
      </main>

      {variant === 'prompt' && family && (
        <div className="overlay">
          <form className="modal" onSubmit={handleInvite}>
            <Link className="close-link" to={closeLink}>
              ×
            </Link>

            <p className="stat-label">Приглашение</p>
            <h2 className="modal-title">Добавить участника</h2>
            <p className="modal-text">
              Укажи email человека, которого нужно подключить к семейному бюджету.
            </p>

            <label className="field-label large" htmlFor="inviteEmail" style={{ marginTop: 24 }}>
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
              <button className="primary-button" type="submit" disabled={isSaving}>
                {isSaving ? 'Отправка...' : 'Отправить приглашение'}
              </button>
            </div>
          </form>
        </div>
      )}

      {variant === 'settings' && family && (
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

              <button className="soft-row" type="button">
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
