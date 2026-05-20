import React, { useMemo } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import './CategoryChart.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type Transaction = {
  _id?: string;
  amount: number;
  date?: string;
};

type CashFlowChartProps = {
  transactions: Transaction[];
};

type CashFlowPoint = {
  key: string;
  label: string;
  income: number;
  expenses: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);

const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(date);

const formatMonthLabel = (date: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    year: '2-digit',
  }).format(date);

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const buildCashFlowPoints = (transactions: Transaction[]): CashFlowPoint[] => {
  const validTransactions = transactions
    .map((transaction) => ({
      ...transaction,
      parsedDate: new Date(transaction.date || ''),
    }))
    .filter((transaction) => Number.isFinite(transaction.amount) && isValidDate(transaction.parsedDate));

  if (!validTransactions.length) return [];

  const timestamps = validTransactions.map((transaction) => transaction.parsedDate.getTime());
  const minDate = new Date(Math.min(...timestamps));
  const maxDate = new Date(Math.max(...timestamps));
  const daysRange = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86_400_000));
  const groupByMonth = daysRange > 65;

  const grouped = new Map<string, CashFlowPoint>();

  validTransactions.forEach((transaction) => {
    const date = transaction.parsedDate;
    const key = groupByMonth
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : date.toISOString().slice(0, 10);

    const label = groupByMonth ? formatMonthLabel(date) : formatDayLabel(date);
    const current = grouped.get(key) || { key, label, income: 0, expenses: 0 };

    if (transaction.amount > 0) {
      current.income += transaction.amount;
    } else {
      current.expenses += Math.abs(transaction.amount);
    }

    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(-10);
};

const CashFlowChart: React.FC<CashFlowChartProps> = ({ transactions }) => {
  const points = useMemo(() => buildCashFlowPoints(transactions), [transactions]);

  const chartData = useMemo(
    () => ({
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: 'Доходы',
          data: points.map((point) => point.income),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.12)',
          tension: 0.38,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 3,
        },
        {
          label: 'Расходы',
          data: points.map((point) => point.expenses),
          borderColor: '#e11d48',
          backgroundColor: 'rgba(225, 29, 72, 0.1)',
          tension: 0.38,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 3,
        },
      ],
    }),
    [points],
  );

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          labels: {
            boxHeight: 10,
            boxWidth: 10,
            color: '#34495e',
            font: {
              family: 'Inter, system-ui, sans-serif',
              size: 12,
              weight: 'bold',
            },
            usePointStyle: true,
          },
          position: 'bottom',
        },
        tooltip: {
          backgroundColor: '#173553',
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${formatCurrency(Number(context.raw || 0))}`,
          },
          cornerRadius: 12,
          padding: 12,
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#718096',
            font: {
              weight: 'bold',
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(31, 95, 135, 0.1)',
          },
          ticks: {
            callback: (value) => formatCurrency(Number(value)).replace(',00', ''),
            color: '#718096',
            font: {
              weight: 'bold',
            },
          },
        },
      },
    }),
    [],
  );

  return (
    <section className="panel chart-card chart-card-modern cashflow-card">
      <div className="chart-card-header">
        <div>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            Динамика денег
          </h2>
          <span className="chart-card-kicker">Доходы и расходы по датам</span>
        </div>
      </div>

      {points.length ? (
        <div className="cashflow-chart-box">
          <Line data={chartData} options={options} />
        </div>
      ) : (
        <div className="chart-empty-state">
          Динамика появится после добавления операций или загрузки PDF-выписки.
        </div>
      )}
    </section>
  );
};

export default CashFlowChart;
