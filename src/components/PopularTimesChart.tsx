interface PopularTimesChartProps {
  values: number[];
}

const labels = ["3a", "6a", "9a", "12p", "3p", "6p", "9p"];

export default function PopularTimesChart({ values }: PopularTimesChartProps) {
  const sampled = [0, 2, 4, 7, 10, 13, 15].map((idx) => values[idx] ?? 0);
  return (
    <div>
      <div className="chart-grid">
        {sampled.map((value, idx) => (
          <div key={labels[idx]} className="bar-wrap">
            <div className="bar" style={{ height: `${Math.max(4, value)}%` }} />
          </div>
        ))}
      </div>
      <div className="axis-labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
