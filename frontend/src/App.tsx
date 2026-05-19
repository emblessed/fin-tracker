import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import Register from "./register/register.tsx";
import SignedUp from "./login/login.tsx";
import Header from "./components/Header.tsx";
import OperationForm from "./components/OperationForm.tsx";
import OperationsList from "./components/OperationList.tsx";
import CategoryChart from "./components/CategoryChart.tsx";
import CashFlowChart from "./components/CashFlowChart.tsx";
import PeriodSelector from "./components/PeriodSelector.tsx";
import StatsCards from "./components/StatsCards.tsx";
import { BankStatementUploadRow } from "./components/bank-statement";
import AnalyticsPage from "./pages/analytics/AnalyticsPage.tsx";
import AdminUploadPage from "./pages/admin/AdminUploadPage.tsx";
import { FamilyPage } from "./pages/family/FamilyPage.tsx";
import FamilyAnalyticsPage from "./pages/family/FamilyAnalyticsPage.tsx";
import ProfileSettingsPage from "./pages/account/pages/ProfileSettingsPage.tsx";
import ProtectedRoute from "./api/ProtectedRoute.tsx";
import Dashboard from "./dashboard.tsx";

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
  totalPages?: number;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TRANSACTIONS_FETCH_LIMIT = 200;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const PageWithHeader = ({
  children,
  defaultMenuOpen = false,
}: PageWithHeaderProps) => {
  return (
    <div className="app-shell">
      <Header defaultMenuOpen={defaultMenuOpen} />
      {children}
    </div>
  );
};

const MainPage = ({
  defaultMenuOpen: _defaultMenuOpen = false,
}: MainPageProps) => {
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
      const token = localStorage.getItem("token");
      const allTransactions: Transaction[] = [];
      let currentStats: Stats | undefined;
      let page = 1;
      let totalPages = 1;

      do {
        const url = new URL("/api/transactions", API_URL);
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
          throw new Error("Ошибка загрузки операций");
        }

        const result: TransactionsResponse = await response.json();

        if (page === 1 && result.stats) {
          currentStats = result.stats;
        }

        allTransactions.push(
          ...(Array.isArray(result.data) ? result.data : []),
        );
        totalPages = Math.max(1, Number(result.totalPages) || 1);
        page += 1;
      } while (page <= totalPages);

      handleDataUpdate({
        stats: currentStats,
        data: allTransactions,
      });
    } catch (error) {
      console.error("Ошибка при загрузке операций:", error);
    }
  }, [handleDataUpdate]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    const handleTransactionsChanged = () => {
      loadTransactions();
    };

    window.addEventListener("transactions:changed", handleTransactionsChanged);

    return () => {
      window.removeEventListener(
        "transactions:changed",
        handleTransactionsChanged,
      );
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
          <BankStatementUploadRow onUploadSuccess={loadTransactions} />
          <OperationForm onCreated={loadTransactions} />
          <OperationsList
            transactions={transactions}
            onChanged={loadTransactions}
          />
        </div>

        <aside className="right-stack">
          <CategoryChart
            title="Расходы по категориям"
            total={formatCurrency(stats.expenses)}
            transactions={transactions}
          />
          <CategoryChart
            title="Доходы по категориям"
            total={formatCurrency(stats.income)}
            transactions={transactions}
            isIncome
          />
          <CashFlowChart transactions={transactions} />
        </aside>
      </main>
      <footer className="footer">© 2026 Баланс+</footer>
    </>
  );
};

const withProtectedHeader = (element: ReactNode, defaultMenuOpen = false) => (
  <ProtectedRoute>
    <PageWithHeader defaultMenuOpen={defaultMenuOpen}>{element}</PageWithHeader>
  </ProtectedRoute>
);

const publicRoutes: AppRoute[] = [
  {
    path: "/",
    element: <SignedUp />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/login",
    element: <SignedUp />,
  },
];

const mainRoutes: AppRoute[] = [
  {
    path: "/main",
    element: withProtectedHeader(<MainPage />),
  },
  {
    path: "/main/analytics",
    element: withProtectedHeader(<AnalyticsPage />),
  },
  {
    path: "/analytics",
    element: withProtectedHeader(<AnalyticsPage />),
  },
  {
    path: "/main-menu",
    element: withProtectedHeader(<MainPage defaultMenuOpen />, true),
  },
  {
    path: "/menu",
    element: withProtectedHeader(<MainPage defaultMenuOpen />, true),
  },
];

const adminRoutes: AppRoute[] = [
  {
    path: "/admin/upload",
    element: withProtectedHeader(<AdminUploadPage />),
  },
];

const familyRoutes: AppRoute[] = [
  {
    path: "/family",
    element: withProtectedHeader(<FamilyPage />),
  },
  {
    path: "/family/main",
    element: withProtectedHeader(<FamilyPage />),
  },
  {
    path: "/family/prompt",
    element: withProtectedHeader(<FamilyPage />),
  },
  {
    path: "/family/create",
    element: withProtectedHeader(<FamilyPage />),
  },
  {
    path: "/family/settings",
    element: withProtectedHeader(<FamilyPage />),
  },
  {
    path: "/family/analytics",
    element: withProtectedHeader(<FamilyAnalyticsPage />),
  },
];

const accountRoutes: AppRoute[] = [
  {
    path: "/account/profile-settings",
    element: withProtectedHeader(<ProfileSettingsPage />),
  },
  {
    path: "/profile/settings",
    element: withProtectedHeader(<ProfileSettingsPage />),
  },
  {
    path: "/account",
    element: withProtectedHeader(<ProfileSettingsPage />),
  },
  {
    path: "/profile-settings",
    element: withProtectedHeader(<ProfileSettingsPage />),
  },
  {
    path: "/account2",
    element: withProtectedHeader(<ProfileSettingsPage />),
  },
];

const systemRoutes: AppRoute[] = [
  {
    path: "*",
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
