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

type FamilyOperation = {
  id: number;
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

const fallbackOperations: FamilyOperation[] = [
  {
    id: 1,
    title: 'Зарплата',
    member: 'Владелец семьи',
    category: 'Доходы',
    date: '15.05.2026',
    amount: 115670,
  },
  {
    id: 2,
    title: 'Продукты',
    member: 'Семейный бюджет',
    category: 'Супермаркеты',
    date: '14.05.2026',
    amount: -8230,
  },
  {
    id: 3,
    title: 'Перевод на общий счёт',
    member: 'Владелец семьи',
    category: 'Переводы',
    date: '13.05.2026',
    amount: -15000,
  },
  {
    id: 4,
    title: 'Оплата квартиры',
    member: 'Семейный бюджет',
    category: 'Дом',
    date: '12.05.2026',
    amount: -42000,
  },
];

const budgets: BudgetItem[] = [
  {
    title: 'Продукты',
    spent: 32800,
    limit: 50000,
  },
  {
    title: 'Транспорт',
    spent: 9200,
    limit: 15000,
  },
  {
    title: 'Развлечения',
    spent: 18600,
    limit: 25000,
  },
];

const periodOptions = ['Все время', 'Сегодня', 'Эта неделя', 'Этот месяц', 'Свой период'];

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);

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

export function FamilyPage({ variant = 'menu' }: FamilyPageProps) {
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState('Все время');
  const [family, setFamily] = useState<Family | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadFamily = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const status = await getFamilyStatus();
      setFamily(status.family);
      setFamilyName(status.family?.name || '');
    } catch (loadError: any) {
      setError(loadError.message || 'Не удалось загрузить семейный доступ');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  const visibleMembers = useMemo<FamilyMemberView[]>(() => {
    if (!family?.members?.length) {
      return [];
    }

    return family.members.map((member, index) => {
      const name = getMemberName(member);
      const isOwner = member.role === 'owner';
      const balance = isOwner ? 76000 : 42000 + index * 7000;
      const income = isOwner ? 125000 : 73000 + index * 5000;
      const expenses = isOwner ? 49000 : 31000 + index * 3000;

      return {
        id: member.id || String(index),
        name,
        role: memberRoleText(member.role),
        initials: getInitials(name),
        balance,
        income,
        expenses,
      };
    });
  }, [family]);

  const visibleOperations = useMemo(() => {
    const ownerName = visibleMembers.find((member) => member.role === 'Владелец')?.name || 'Владелец семьи';

    return fallbackOperations.map((operation) =>
      operation.member === 'Владелец семьи'
        ? {
            ...operation,
            member: ownerName,
          }
        : operation,
    );
  }, [visibleMembers]);

  const totals = useMemo(
    () => ({
      balance: visibleMembers.reduce((sum, member) => sum + member.balance, 0),
      income: visibleMembers.reduce((sum, member) => sum + member.income, 0),
      expenses: visibleMembers.reduce((sum, member) => sum + member.expenses, 0),
    }),
    [visibleMembers],
  );

  const closeLink = family ? '/family' : '/family/create';

  const notifyFamilyChanged = () => {
    window.dispatchEvent(new Event('family:changed'));
    window.dispatchEvent(new Event('invitations:changed'));
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
      {family ? (
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

            <BankStatementUploadRow style={{ marginTop: 18 }} />
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
                  {budgets.map((budget) => {
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
                  })}
                </div>
              </section>

              <section className="panel periods-card">
                <div className="chips-row" style={{ justifyContent: 'space-between' }}>
                  <h2 className="section-title period-title">Последние операции</h2>
                  <span className="small-badge">{visibleOperations.length}</span>
                </div>

                <div className="member-list">
                  {visibleOperations.map((operation) => (
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
                  ))}
                </div>
              </section>
            </aside>
          </main>
        </>
      ) : (
        renderCreateFamilyPanel()
      )}

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
