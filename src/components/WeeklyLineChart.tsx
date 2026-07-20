interface Series {
  label: string
  values: number[]
  colorVar: string
}

export interface WeeklyLineChartProps {
  dateLabels: string[]
  series: Series[]
}

const WIDTH = 300
const HEIGHT = 140
const PAD_X = 12
const PAD_TOP = 12
const PAD_BOTTOM = 24

export default function WeeklyLineChart({ dateLabels, series }: WeeklyLineChartProps) {
  const n = dateLabels.length
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const plotW = WIDTH - PAD_X * 2
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM

  const x = (i: number) => PAD_X + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1))
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH

  return (
    <div className="weekly-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="過去7日間の推移">
        <line
          x1={PAD_X}
          y1={PAD_TOP + plotH}
          x2={WIDTH - PAD_X}
          y2={PAD_TOP + plotH}
          stroke="var(--border)"
        />
        {series.map((s) => (
          <polyline
            key={s.label}
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={`var(${s.colorVar})`}
            strokeWidth={2}
          />
        ))}
        {series.map((s) =>
          s.values.map((v, i) => (
            <circle key={`${s.label}-${i}`} cx={x(i)} cy={y(v)} r={2.5} fill={`var(${s.colorVar})`}>
              <title>
                {dateLabels[i]}: {s.label} {v}
              </title>
            </circle>
          )),
        )}
        {dateLabels.map((label, i) => (
          <text
            key={label}
            x={x(i)}
            y={HEIGHT - 6}
            textAnchor="middle"
            fontSize={9}
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ))}
      </svg>
      <div className="weekly-chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i className="dot" style={{ background: `var(${s.colorVar})` }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
