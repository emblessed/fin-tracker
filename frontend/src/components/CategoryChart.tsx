import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Link } from 'react-router-dom';

import './CategoryChart.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

type Transaction = {
  _id?: string;
  amount: number;
  date?: string;
  category?: string;
  categoryInfo?: string;
  bank?: string;
  commentary?: string;
};

type LegacyChartData = {
  label: string;
  value: string;
  color?: string;
};

type CategoryChartProps = {
  title: string;
  total?: string;
  data?: LegacyChartData[];
  transactions?: Transaction[];
  isIncome?: boolean;
};

type CategoryMeta = {
  label: string;
  color: string;
};

type CategorySlice = CategoryMeta & {
  key: string;
  amount: number;
  percent: number;
};

const CATEGORY_META: Record<string, CategoryMeta> = {
  salary: { label: 'Зарплата', color: '#16a34a' },
  income: { label: 'Доходы', color: '#22c55e' },
  transfer: { label: 'Переводы', color: '#0ea5e9' },
  transfers: { label: 'Переводы', color: '#0ea5e9' },
  withdrawal: { label: 'Снятие наличных', color: '#64748b' },
  refund: { label: 'Возврат', color: '#e11d48' },
  qr: { label: 'QR', color: '#f97316' },
  products: { label: 'Продукты', color: '#f97316' },
  food: { label: 'Еда', color: '#f97316' },
  supermarket: { label: 'Супермаркеты', color: '#fb7185' },
  transport: { label: 'Транспорт', color: '#6366f1' },
  restaurant: { label: 'Рестораны', color: '#eab308' },
  restaurants: { label: 'Рестораны', color: '#eab308' },
  services: { label: 'Услуги', color: '#8b5cf6' },
  cash: { label: 'Наличные', color: '#14b8a6' },
  other: { label: 'Другое', color: '#64748b' },
  others: { label: 'Другое', color: '#64748b' },
  rest: { label: 'Остальное', color: '#94a3b8' },
};

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  salary: 'Зарплата',
  income: 'Доходы',
  transfer: 'Переводы',
  transfers: 'Переводы',
  withdrawal: 'Снятие наличных',
  withdraw: 'Снятие наличных',
  refund: 'Возврат',
  qr: 'QR',
  products: 'Продукты',
  product: 'Продукты',
  food: 'Еда',
  supermarket: 'Супермаркеты',
  transport: 'Транспорт',
  restaurant: 'Рестораны',
  restaurants: 'Рестораны',
  services: 'Услуги',
  service: 'Услуги',
  cash: 'Наличные',
  other: 'Другое',
  others: 'Другое',
  rest: 'Остальное',
};

const FALLBACK_COLORS = ['#0f5685', '#14b8a6', '#f97316', '#8b5cf6', '#e11d48', '#64748b'];

const normalizeCategoryKey = (transaction: Transaction) => {
  const rawValue = transaction.categoryInfo || transaction.category || transaction.commentary || 'other';
  const normalized = String(rawValue).trim().toLowerCase();

  if (!normalized) return 'other';
  if (normalized.includes('зарп') || normalized.includes('salary') || normalized.includes('payroll')) return 'salary';
  if (normalized.includes('перев') || normalized.includes('transfer')) return 'transfers';
  if (normalized.includes('withdrawal') || normalized.includes('withdraw') || normalized.includes('сняти')) return 'withdrawal';
  if (normalized.includes('refund') || normalized.includes('возврат')) return 'refund';
  if (normalized === 'qr' || normalized.includes(' qr') || normalized.includes('qr ') || normalized.includes('сбп')) return 'qr';
  if (normalized.includes('продукт') || normalized.includes('еда') || normalized.includes('product')) return 'products';
  if (normalized.includes('транспорт') || normalized.includes('transport')) return 'transport';
  if (normalized.includes('ресторан') || normalized.includes('кафе') || normalized.includes('restaurant')) return 'restaurant';
  if (normalized.includes('услуг') || normalized.includes('service')) return 'services';
  if (normalized.includes('налич') || normalized.includes('cash')) return 'cash';
  if (normalized.includes('other') || normalized.includes('другое')) return 'other';

  return normalized;
};

const getCategoryLabel = (key: string) => {
  const normalized = key.trim().toLowerCase();

  if (!normalized) return 'Другое';
  if (CATEGORY_TRANSLATIONS[normalized]) return CATEGORY_TRANSLATIONS[normalized];
  if (normalized === 'qr') return 'QR';

  return key[0]?.toUpperCase() + key.slice(1);
};

const getExternalTooltip = (chart: ChartJS<'doughnut'>) => {
  const canvas = chart.canvas;
  let tooltipId = canvas.dataset.externalTooltipId;

  if (!tooltipId) {
    tooltipId = `chart-tooltip-${Math.random().toString(36).slice(2)}`;
    canvas.dataset.externalTooltipId = tooltipId;
  }

  let tooltip = document.getElementById(tooltipId);

  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = tooltipId;
    tooltip.className = 'chart-external-tooltip';
    document.body.appendChild(tooltip);
  }

  return tooltip;
};

const externalTooltipHandler = (context: { chart: ChartJS<'doughnut'>; tooltip: any }) => {
  const { chart, tooltip } = context;
  const tooltipElement = getExternalTooltip(chart);

  if (tooltip.opacity === 0) {
    tooltipElement.style.opacity = '0';
    return;
  }

  const titleLines = tooltip.title || [];
  const bodyLines = tooltip.body?.flatMap((bodyItem: { lines: string[] }) => bodyItem.lines) || [];

  tooltipElement.innerHTML = `
    ${titleLines.map((line: string) => `<div class="chart-external-tooltip-title">${line}</div>`).join('')}
    ${bodyLines.map((line: string) => `<div class="chart-external-tooltip-body">${line}</div>`).join('')}
  `;

  const rect = chart.canvas.getBoundingClientRect();

  tooltipElement.style.opacity = '1';
  tooltipElement.style.left = `${rect.left + tooltip.caretX}px`;
  tooltipElement.style.top = `${rect.top + tooltip.caretY}px`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);

const parseLegacyAmount = (value: string) => {
  const normalized = value.replace(/[^\d,-]/g, '').replace(',', '.');
  const amount = Math.abs(Number(normalized));
  return Number.isFinite(amount) ? amount : 0;
};

const buildLegacySlices = (data: LegacyChartData[] | undefined): CategorySlice[] => {
  if (!data?.length) return [];

  const rawSlices = data
    .map((item, index) => {
      const key = normalizeCategoryKey({ amount: 0, category: item.label });
      const meta = CATEGORY_META[key] || {
        label: getCategoryLabel(key),
        color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      };

      return {
        key,
        label: meta.label,
        amount: parseLegacyAmount(item.value),
        color: item.color || meta.color,
      };
    })
    .filter((item) => item.amount > 0);

  const totalAmount = rawSlices.reduce((sum, item) => sum + item.amount, 0);

  return rawSlices.map((item) => ({
    ...item,
    percent: totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0,
  }));
};

const buildTransactionSlices = (transactions: Transaction[], isIncome = false): CategorySlice[] => {
  const grouped = new Map<string, number>();

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount);

    if (!Number.isFinite(amount) || amount === 0) return;
    if (isIncome && amount <= 0) return;
    if (!isIncome && amount >= 0) return;

    const key = normalizeCategoryKey(transaction);
    grouped.set(key, (grouped.get(key) || 0) + Math.abs(amount));
  });

  const sorted = Array.from(grouped.entries())
    .map(([key, amount], index) => {
      const meta = CATEGORY_META[key] || {
        label: getCategoryLabel(key),
        color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      };

      return {
        key,
        amount,
        ...meta,
      };
    })
    .sort((left, right) => right.amount - left.amount);

  const visible = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  if (rest.length) {
    visible.push({
      key: 'rest',
      label: 'Остальное',
      color: '#94a3b8',
      amount: rest.reduce((sum, item) => sum + item.amount, 0),
    });
  }

  const totalAmount = visible.reduce((sum, item) => sum + item.amount, 0);

  return visible.map((item) => ({
    ...item,
    percent: totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0,
  }));
};

const CategoryChart: React.FC<CategoryChartProps> = ({
  title,
  total,
  data,
  transactions,
  isIncome = false,
}) => {
  const [loadedTransactions, setLoadedTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(!transactions);

  const loadTransactions = useCallback(async () => {
    if (transactions) return;

    const token = localStorage.getItem('token');

    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const url = new URL('/api/transactions', API_URL);
      url.searchParams.set('limit', '500');
      url.searchParams.set('sortBy', 'date');
      url.searchParams.set('order', 'desc');

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить операции для графика');
      }

      const result = await response.json();
      setLoadedTransactions(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Ошибка загрузки данных графика:', error);
      setLoadedTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [transactions]);

  useEffect(() => {
    loadTransactions();

    const handleTransactionsChanged = () => loadTransactions();
    window.addEventListener('transactions:changed', handleTransactionsChanged);

    return () => {
      window.removeEventListener('transactions:changed', handleTransactionsChanged);
    };
  }, [loadTransactions]);

  const sourceTransactions = transactions || loadedTransactions;

  const slices = useMemo(() => {
    const transactionSlices = buildTransactionSlices(sourceTransactions, isIncome);
    return transactionSlices.length ? transactionSlices : buildLegacySlices(data);
  }, [data, isIncome, sourceTransactions]);

  const chartTotal = slices.reduce((sum, item) => sum + item.amount, 0);
  const displayedTotal = chartTotal > 0 ? formatCurrency(chartTotal) : total || formatCurrency(0);

  const chartData = useMemo(
    () => ({
      labels: slices.map((item) => item.label),
      datasets: [
        {
          data: slices.map((item) => item.amount),
          backgroundColor: slices.map((item) => item.color),
          borderColor: '#ffffff',
          borderRadius: 8,
          borderWidth: 4,
          hoverBorderWidth: 4,
          hoverOffset: 8,
          spacing: 2,
        },
      ],
    }),
    [slices],
  );

  const options: ChartOptions<'doughnut'> = useMemo(
    () => ({
      cutout: '72%',
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
          external: externalTooltipHandler,
          callbacks: {
            label: (context) => {
              const value = Number(context.raw || 0);
              const percent = chartTotal > 0 ? Math.round((value / chartTotal) * 100) : 0;
              return ` ${context.label}: ${formatCurrency(value)} · ${percent}%`;
            },
          },
        },
      },
    }),
    [chartTotal],
  );

  return (
    <section className="panel chart-card chart-card-modern">
      <div className="chart-card-header">
        <div>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            {title}
          </h2>
          <span className="chart-card-kicker">
            {isIncome ? 'Структура поступлений' : 'Структура расходов'}
          </span>
        </div>
        <div className="chart-card-total">{displayedTotal}</div>
      </div>

      {isLoading ? (
        <div className="chart-empty-state">Загрузка графика...</div>
      ) : slices.length ? (
        <div className="chart-layout">
          <div className="chart-doughnut-box" aria-label={title}>
            <Doughnut data={chartData} options={options} />
            <div className="chart-center" aria-hidden="true">
              <span className="chart-center-label">Итого</span>
              <strong className="chart-center-value">{displayedTotal}</strong>
            </div>
          </div>

          <div className="category-list">
            {slices.map((item) => (
              <div className="category-row" key={item.key}>
                <span className="category-dot" style={{ background: item.color }} />
                <div className="category-main">
                  <div className="category-title-line">
                    <span className="category-label">{item.label}</span>
                    <span className="category-percent">{item.percent}%</span>
                  </div>
                  <div className="category-track">
                    <div
                      className="category-bar"
                      style={{ background: item.color, width: `${Math.max(item.percent, 4)}%` }}
                    />
                  </div>
                </div>
                <strong className="category-value">{formatCurrency(item.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="chart-empty-state">
          {isIncome
            ? 'Доходов пока нет. Они появятся после добавления операции или скана PDF.'
            : 'Расходов пока нет. Они появятся после добавления операции или скана PDF.'}
        </div>
      )}

      <Link className="analytics-link" to="/main/analytics">
        Перейти к детальной аналитике
      </Link>
    </section>
  );
};

export default CategoryChart;
