import { Link } from 'react-router-dom';

import type { LegendItem } from '../data/charts';

type CategoryChartProps = {
  title: string;
  total: string;
  variant?: 'expense' | 'income';
  legend: LegendItem[];
};

export function CategoryChart({
  title,
  total,
  variant = 'expense',
  legend,
}: CategoryChartProps) {
  const donutClassName = variant === 'income' ? 'donut income' : 'donut';

  return (
    <section className="panel chart-card">
      <div className="chart-head">
        <h2 className="section-title">{title}</h2>
        <Link className="analytics-link" to="/main/analytics">
          Перейти к детальной аналитике
        </Link>
      </div>

      <div className="chart-body">
        <div className={donutClassName}>
          <div className="donut-center">{total}</div>
        </div>

        <div className="legend">
          {legend.map((item) => (
            <div key={item.label} className="legend-row">
              <div className="legend-left">
                <span className={`legend-dot ${(item as any).tone}`} /> 
                <span>{item.label}</span>
              </div>

              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
