import { useMemo, useState } from 'react';

interface BarChartProps {
  data: { label: string; value: number; secondary?: number }[];
  height?: number;
  /** Couleur barres principales */
  color?: string;
  /** Couleur barres secondaires (optionnel) */
  secondaryColor?: string;
  valueFormatter?: (v: number) => string;
}

/**
 * Bar chart SVG pur. Léger, aucun dépendance.
 * Affiche jusqu'à 2 séries empilées visuellement (principale + secondaire en dessus avec opacité).
 */
export function BarChart({
  data,
  height = 200,
  color = '#1d9e75',
  secondaryColor = '#ef4444',
  valueFormatter = (v) => String(v),
}: BarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { width, max, barWidth, gap, padding } = useMemo(() => {
    const p = 24;
    const g = 4;
    const w = Math.max(320, data.length * 14 + p * 2);
    const bw = (w - p * 2 - g * (data.length - 1)) / data.length;
    const maxValue = Math.max(
      1,
      ...data.map((d) => Math.max(d.value, d.secondary ?? 0)),
    );
    return { width: w, max: maxValue, barWidth: bw, gap: g, padding: p };
  }, [data]);

  const innerHeight = height - 40;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        width={width}
        height={height}
        style={{ display: 'block', minWidth: '100%' }}
      >
        {/* Gridlines horizontales */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding + innerHeight * (1 - t);
          return (
            <line
              key={t}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray={t === 0 ? '0' : '2,3'}
            />
          );
        })}

        {/* Barres */}
        {data.map((d, i) => {
          const x = padding + i * (barWidth + gap);
          const h = (d.value / max) * innerHeight;
          const y = padding + (innerHeight - h);
          const hSec = d.secondary ? (d.secondary / max) * innerHeight : 0;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={padding}
                width={barWidth}
                height={innerHeight}
                fill="transparent"
              />
              {d.secondary ? (
                <rect
                  x={x}
                  y={padding + (innerHeight - hSec)}
                  width={barWidth}
                  height={hSec}
                  fill={secondaryColor}
                  opacity={0.35}
                  rx={2}
                />
              ) : null}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                fill={color}
                opacity={hoverIndex === i ? 1 : 0.85}
                rx={2}
              />
            </g>
          );
        })}

        {/* Labels X (un sur N pour éviter surcharge) */}
        {data.map((d, i) => {
          const x = padding + i * (barWidth + gap) + barWidth / 2;
          const step = Math.max(1, Math.floor(data.length / 8));
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#6b7280"
            >
              {d.label}
            </text>
          );
        })}

        {/* Tooltip sur hover */}
        {hoverIndex !== null ? (
          <g>
            <rect
              x={Math.max(
                padding,
                Math.min(
                  width - 140,
                  padding + hoverIndex * (barWidth + gap) - 50,
                ),
              )}
              y={padding - 4}
              width={130}
              height={data[hoverIndex].secondary != null ? 52 : 36}
              fill="#111827"
              rx={6}
            />
            <text
              x={
                Math.max(
                  padding,
                  Math.min(
                    width - 140,
                    padding + hoverIndex * (barWidth + gap) - 50,
                  ),
                ) + 8
              }
              y={padding + 12}
              fontSize={11}
              fontWeight={700}
              fill="white"
            >
              {data[hoverIndex].label}
            </text>
            <text
              x={
                Math.max(
                  padding,
                  Math.min(
                    width - 140,
                    padding + hoverIndex * (barWidth + gap) - 50,
                  ),
                ) + 8
              }
              y={padding + 26}
              fontSize={11}
              fill="#d1d5db"
            >
              <tspan fill={color}>●</tspan>{' '}
              {valueFormatter(data[hoverIndex].value)}
            </text>
            {data[hoverIndex].secondary != null ? (
              <text
                x={
                  Math.max(
                    padding,
                    Math.min(
                      width - 140,
                      padding + hoverIndex * (barWidth + gap) - 50,
                    ),
                  ) + 8
                }
                y={padding + 40}
                fontSize={11}
                fill="#d1d5db"
              >
                <tspan fill={secondaryColor}>●</tspan>{' '}
                {valueFormatter(data[hoverIndex].secondary ?? 0)}
              </text>
            ) : null}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
