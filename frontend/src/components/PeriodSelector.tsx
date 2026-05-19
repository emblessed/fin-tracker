import React, { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TRANSACTIONS_FETCH_LIMIT = 200;

const periods = [
  { id: "all", label: "Все время" },
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Эта неделя" },
  { id: "month", label: "Этот месяц" },
  { id: "custom", label: "Свой период" },
] as const;

type PeriodId = (typeof periods)[number]["id"];

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

interface PeriodSelectorProps {
  onDataLoaded: (result: TransactionsResponse) => void;
}

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ onDataLoaded }) => {
  const [selectedId, setSelectedId] = useState<PeriodId>("all");
  const [dateFrom, setDateFrom] = useState("2000-01-01");
  const [dateTo, setDateTo] = useState(formatDate(new Date()));

  const calculateDates = (id: PeriodId) => {
    const now = new Date();
    const todayStr = formatDate(now);

    switch (id) {
      case "today":
        return {
          from: todayStr,
          to: todayStr,
        };

      case "week": {
        const firstDay = new Date(now);
        const currentDay = firstDay.getDay();
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        firstDay.setDate(firstDay.getDate() + diffToMonday);

        return {
          from: formatDate(firstDay),
          to: todayStr,
        };
      }

      case "month": {
        const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return {
          from: formatDate(firstDayMonth),
          to: todayStr,
        };
      }

      case "all":
        return {
          from: "2000-01-01",
          to: todayStr,
        };

      case "custom":
      default:
        return null;
    }
  };

  const handlePeriodClick = (id: PeriodId) => {
    setSelectedId(id);
    const calculated = calculateDates(id);

    if (calculated) {
      setDateFrom(calculated.from);
      setDateTo(calculated.to);
    }
  };

  const applyPeriod = async () => {
    const calculated = calculateDates(selectedId);
    const finalFrom = calculated ? calculated.from : dateFrom;
    const finalTo = calculated ? calculated.to : dateTo;
    const token = localStorage.getItem("token");

    try {
      const allTransactions: Transaction[] = [];
      let currentStats: Stats | undefined;
      let page = 1;
      let totalPages = 1;

      do {
        const url = new URL("/api/transactions", API_URL);
        url.searchParams.append("dateFrom", finalFrom);
        url.searchParams.append("dateTo", finalTo);
        url.searchParams.append("sortBy", "date");
        url.searchParams.append("order", "desc");
        url.searchParams.append("page", String(page));
        url.searchParams.append("limit", String(TRANSACTIONS_FETCH_LIMIT));

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Ошибка сети");
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

      onDataLoaded({
        stats: currentStats,
        data: allTransactions,
      });
    } catch (error) {
      console.error("Ошибка при загрузке периода:", error);
    }
  };

  return (
    <section className="panel periods-card period-selector">
      <h2 className="section-title period-title period-selector__title">
        Периоды
      </h2>

      <div className="period-selector__chips" aria-label="Выбор периода">
        {periods.map((period) => (
          <button
            key={period.id}
            type="button"
            className={`period-chip period-selector__chip ${selectedId === period.id ? "active" : ""}`}
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
              setSelectedId("custom");
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
              setSelectedId("custom");
              setDateTo(event.target.value);
            }}
          />
        </label>
      </div>

      <button
        className="action-light period-selector__apply"
        type="button"
        onClick={applyPeriod}
      >
        Применить
      </button>
    </section>
  );
};

export default PeriodSelector;
