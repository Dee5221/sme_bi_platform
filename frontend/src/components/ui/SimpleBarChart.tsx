import './SimpleBarChart.css';

type BarSeries = {
  key: string;
  label: string;
  value: number;
  displayValue?: number;
  tone?: 'primary' | 'secondary' | 'accent';
};

type Props = {
  series: BarSeries[];
  formatValue?: (value: number) => string;
  emptyLabel?: string;
};

export function SimpleBarChart({
  series,
  formatValue = (value) => String(value),
  emptyLabel = 'No data for this period',
}: Props) {
  const max = Math.max(...series.map((item) => item.value), 1);

  if (series.every((item) => item.value === 0)) {
    return <p className="simple-bar-chart__empty">{emptyLabel}</p>;
  }

  return (
    <div className="simple-bar-chart" role="img" aria-label="Bar chart">
      {series.map((item) => (
        <div key={item.key} className="simple-bar-chart__row">
          <span className="simple-bar-chart__label">{item.label}</span>
          <div className="simple-bar-chart__track">
            <div
              className={`simple-bar-chart__fill simple-bar-chart__fill--${item.tone || 'primary'}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="simple-bar-chart__value">
            {formatValue(item.displayValue ?? item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

type GroupedBar = {
  key: string;
  label: string;
  values: Array<{ key: string; value: number; tone?: 'primary' | 'secondary' | 'accent' }>;
};

type GroupedProps = {
  groups: GroupedBar[];
  formatValue?: (value: number) => string;
  legend?: Array<{ key: string; label: string; tone: 'primary' | 'secondary' | 'accent' }>;
  emptyLabel?: string;
};

export function GroupedBarChart({
  groups,
  formatValue = (value) => String(value),
  legend = [],
  emptyLabel = 'No data for this period',
}: GroupedProps) {
  const max = Math.max(
    ...groups.flatMap((group) => group.values.map((item) => item.value)),
    1
  );

  const hasData = groups.some((group) => group.values.some((item) => item.value > 0));
  if (!hasData) {
    return <p className="simple-bar-chart__empty">{emptyLabel}</p>;
  }

  return (
    <div className="grouped-bar-chart">
      {legend.length > 0 && (
        <div className="grouped-bar-chart__legend">
          {legend.map((item) => (
            <span key={item.key} className="grouped-bar-chart__legend-item">
              <span
                className={`grouped-bar-chart__swatch grouped-bar-chart__swatch--${item.tone}`}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}
      <div className="grouped-bar-chart__grid" role="img" aria-label="Grouped bar chart">
        {groups.map((group) => (
          <div key={group.key} className="grouped-bar-chart__group">
            <span className="grouped-bar-chart__group-label">{group.label}</span>
            <div className="grouped-bar-chart__bars">
              {group.values.map((item) => (
                <div key={item.key} className="grouped-bar-chart__bar-wrap">
                  <div
                    className={`grouped-bar-chart__bar grouped-bar-chart__bar--${item.tone || 'primary'}`}
                    style={{ height: `${(item.value / max) * 100}%` }}
                    title={`${formatValue(item.value)}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
