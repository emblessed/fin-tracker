import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import './App.css';

import Register from './register/register.tsx';
import SignedUp from './login/login.tsx';

import Header from './components/Header.tsx';
import OperationForm from './components/OperationForm.tsx';
import OperationsList from './components/OperationList.tsx';
import CategoryChart from './components/CategoryChart.tsx';
import PeriodSelector from './components/PeriodSelector.tsx';
import StatsCards from './components/StatsCards.tsx';
import { BankStatementUploadRow } from './components/bank-statement';

import AnalyticsPage from './pages/analytics/AnalyticsPage.tsx';
import AdminUploadPage from './pages/admin/AdminUploadPage.tsx';

import FamilyMenuPage from './pages/family/pages/FamilyMenuPage.tsx';
import FamilyPromptPage from './pages/family/pages/FamilyPromptPage.tsx';
import FamilyCreateModalPage from './pages/family/pages/FamilyCreateModalPage.tsx';
import FamilySettingsPage from './pages/family/pages/FamilySettingsPage.tsx';

import InvitationsPage from './pages/account/pages/InvitationsPage.tsx';
import ProfileSettingsPage from './pages/account/pages/ProfileSettingsPage.tsx';

import ProtectedRoute from './api/ProtectedRoute.tsx';

type AppRoute = {
  path: string;
  element: ReactNode;
};

type MainPageProps = {
  defaultMenuOpen?: boolean;
};

type PageWithHeaderProps = {
  children: ReactNode;
  defaultMenuOpen?: boolean;
};

type Stats = {
  balance: number;
  income: number;
  expenses: number;
};

type Transaction = {
  _id: string;
  amount: number;
  date: string;
  category?: string;
  categoryInfo?: string;
  bank?: string;
  commentary?: string;
};

type TransactionsResponse = {
  stats?: Stats;
  data?: Transaction[];
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);

const PageWithHeader = ({ children, defaultMenuOpen = false }: PageWithHeaderProps) => {
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Header defaultMenuOpen={defaultMenuOpen} userName={''} />
        {children}
      </div>
    </ProtectedRoute>
  );
};


const MainPage = ({ defaultMenuOpen: _defaultMenuOpen = false }: MainPageProps) => {
  const [stats, setStats] = useState<Stats>({
    balance: 0,
    income: 0,
    expenses: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const handleDataUpdate = useCallback((result: TransactionsResponse) => {
    if (result.stats) {
      setStats(result.stats);
    }

    if (Array.isArray(result.data)) {
      setTransactions(result.data);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const url = new URL('/api/transactions', API_URL);
      url.searchParams.set('limit', '50');
      url.searchParams.set('sortBy', 'date');
      url.searchParams.set('order', 'desc');

      // ИСПРАВЛЕНИЕ: Передаем токен авторизации для обычного GET-запроса
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки операций');
      }

      const result = await response.json();
      handleDataUpdate(result);
    } catch (error) {
      console.error('Ошибка при загрузке операций:', error);
    }
  }, [handleDataUpdate]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    const handleTransactionsChanged = () => {
      loadTransactions();
    };

    window.addEventListener('transactions:changed', handleTransactionsChanged);

    return () => {
      window.removeEventListener('transactions:changed', handleTransactionsChanged);
    };
  }, [loadTransactions]);

  return (
    <>
      <main className="dashboard-grid">
        <div className="left-stack">
          <PeriodSelector onDataLoaded={handleDataUpdate} />

          <StatsCards
            balance={formatCurrency(stats.balance)}
            income={formatCurrency(stats.income)}
            expenses={formatCurrency(stats.expenses)}
          />

          {/* ИСПРАВЛЕНИЕ: Передаем функцию обновления сюда */}
          <BankStatementUploadRow onUploadSuccess={loadTransactions} />

          <OperationForm onCreated={loadTransactions} />
          <OperationsList transactions={transactions} />
        </div>

        <aside className="right-stack">
          <CategoryChart
            title="Расходы по категориям"
            total={formatCurrency(stats.expenses)}
            data={[]}
          />

          <CategoryChart
            title="Доходы по категориям"
            total={formatCurrency(stats.income)}
            data={[]}
            isIncome
          />
        </aside>
      </main>

      <footer className="footer">© 2026 Баланс+</footer>
    </>
  );
};


const publicRoutes: AppRoute[] = [
  {
    path: '/',
    element: <SignedUp />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/login',
    element: <SignedUp />,
  },
];

const mainRoutes: AppRoute[] = [
  {
    path: '/main',
    element: (
      <PageWithHeader>
        <MainPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/main/analytics',
    element: (
      <PageWithHeader>
        <AnalyticsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/analytics',
    element: (
      <PageWithHeader>
        <AnalyticsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/main-menu',
    element: (
      <PageWithHeader defaultMenuOpen>
        <MainPage defaultMenuOpen />
      </PageWithHeader>
    ),
  },
  {
    path: '/menu',
    element: (
      <PageWithHeader defaultMenuOpen>
        <MainPage defaultMenuOpen />
      </PageWithHeader>
    ),
  },
];

const adminRoutes: AppRoute[] = [
  {
    path: '/admin/upload',
    element: (
      <PageWithHeader>
        <AdminUploadPage />
      </PageWithHeader>
    ),
  },
];

const familyRoutes: AppRoute[] = [
  {
    path: '/family',
    element: (
      <PageWithHeader>
        <FamilyMenuPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/family/main',
    element: (
      <PageWithHeader>
        <FamilyMenuPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/family/prompt',
    element: (
      <PageWithHeader>
        <FamilyPromptPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/family/create',
    element: (
      <PageWithHeader>
        <FamilyCreateModalPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/family/settings',
    element: (
      <PageWithHeader>
        <FamilySettingsPage />
      </PageWithHeader>
    ),
  },
];

const accountRoutes: AppRoute[] = [
  {
    path: '/account/invitations',
    element: (
      <PageWithHeader>
        <InvitationsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/account/profile-settings',
    element: (
      <PageWithHeader>
        <ProfileSettingsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/invitations',
    element: (
      <PageWithHeader>
        <InvitationsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/profile/settings',
    element: (
      <PageWithHeader>
        <ProfileSettingsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/account',
    element: (
      <PageWithHeader>
        <ProfileSettingsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/profile-settings',
    element: (
      <PageWithHeader>
        <ProfileSettingsPage />
      </PageWithHeader>
    ),
  },
  {
    path: '/account2',
    element: (
      <PageWithHeader>
        <ProfileSettingsPage />
      </PageWithHeader>
    ),
  },
];

const systemRoutes: AppRoute[] = [
  {
    path: '*',
    element: <Navigate to="/main" replace />,
  },
];

const groupedRoutes: AppRoute[] = [
  ...publicRoutes,
  ...mainRoutes,
  ...adminRoutes,
  ...familyRoutes,
  ...accountRoutes,
  ...systemRoutes,
];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {groupedRoutes.map(({ path, element }) => (
          <Route path={path} element={element} key={path} />
        ))}
      </Routes>
    </BrowserRouter>
  );
}
