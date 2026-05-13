import { useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import './App.css';

import Dashboard from './dashboard.tsx';
import Register from './register/register.tsx';
import SignedUp from './login/login.tsx';
import Header from './components/Header.tsx';
import OperationForm from './components/OperationForm.tsx';
import OperationsList from './components/OperationList.tsx';
import CategoryChart from './components/CategoryChart.tsx';
import PeriodSelector from './components/PeriodSelector.tsx';
import StatsCards from './components/StatsCards.tsx';
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


const MainPage = ({ defaultMenuOpen = false }: MainPageProps) => {
  // 1. Создаем состояние для статистики
  const [stats, setStats] = useState({
    balance: 0,
    income: 0,
    expenses: 0
  });

  // Дополнительно можно хранить и список транзакций, чтобы OperationsList тоже обновлялся
  const [transactions, setTransactions] = useState<any[]>([]);

  // 2. Функция, которую вызовет PeriodSelector после успешного fetch
  const handleDataUpdate = (result: any) => {
    if (result.stats) {
      setStats(result.stats);
    }
    if (result.data) {
      setTransactions(result.data);
    }
  };

  // Форматирование для вывода (можно вынести в утилиты)
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="body-dim">
      <div className="app-shell">
        <Header userName="Олег Зуев" defaultMenuOpen={defaultMenuOpen} />

        <main className="dashboard-grid">
          <div className="left-stack">
            {/* 3. Передаем функцию обратного вызова в селектор */}
            <PeriodSelector onDataLoaded={handleDataUpdate} />
            
            {/* 4. Передаем данные из стейта в карточки */}
            <StatsCards 
              balance={formatCurrency(stats.balance)} 
              income={formatCurrency(stats.income)} 
              expenses={formatCurrency(stats.expenses)} 
            />
            
            <OperationForm />
            
            {/* 5. Передаем актуальный список транзакций */}
            <OperationsList transactions={transactions} />
          </div>

          <div className="right-stack">
            <CategoryChart title="Расходы по категориям" total={formatCurrency(stats.expenses)} data={[]} />
            <CategoryChart title="Доходы по категориям" total={formatCurrency(stats.income)} isIncome data={[]} />
          </div>
        </main>

        <footer className="panel footer">© 2026 Финансовый трекер</footer>
      </div>
    </div>
  );
};

const publicRoutes: AppRoute[] = [
  {
    path: '/',
    element: <Dashboard />,
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
    element: 
    <ProtectedRoute>
    <MainPage />,
    </ProtectedRoute>
  },
  {
    path: '/main/analytics',
    element: <AnalyticsPage />,
  },
  {
    path: '/analytics',
    element: <Navigate to="/main/analytics" replace />,
  },
  {
    path: '/main-menu',
    element: <MainPage defaultMenuOpen />,
  },
  {
    path: '/menu',
    element: <MainPage defaultMenuOpen />,
  },
];

const adminRoutes: AppRoute[] = [
  {
    path: '/admin/upload',
    element: <AdminUploadPage />,
  },
];

const familyRoutes: AppRoute[] = [
  {
    path: '/family',
    element: <FamilyMenuPage />,
  },
  {
    path: '/family/main',
    element: <Navigate to="/family" replace />,
  },
  {
    path: '/family/prompt',
    element: <FamilyPromptPage />,
  },
  {
    path: '/family/create',
    element: <FamilyCreateModalPage />,
  },
  {
    path: '/family/settings',
    element: <FamilySettingsPage />,
  },
];

const accountRoutes: AppRoute[] = [
  {
    path: '/account/invitations',
    element: <InvitationsPage />,
  },
  {
    path: '/account/profile-settings',
    element: <ProfileSettingsPage />,
  },
  {
    path: '/invitations',
    element: <InvitationsPage />,
  },
  {
    path: '/profile/settings',
    element: <ProfileSettingsPage />,
  },
  {
    path: '/account',
    element: <Navigate to="/invitations" replace />,
  },
  {
    path: '/profile-settings',
    element: <Navigate to="/profile/settings" replace />,
  },
  {
    path: '/account2',
    element: <Navigate to="/profile/settings" replace />,
  },
];

const systemRoutes: AppRoute[] = [
  {
    path: '*',
    element: <Navigate to="/" replace />,
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
          <Route key={path} path={path} element={element} />
        ))}
      </Routes>
    </BrowserRouter>
  );
}
