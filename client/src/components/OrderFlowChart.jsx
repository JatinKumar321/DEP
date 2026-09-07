import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';

/**
 * Generic order-flow time-series chart.
 *
 * Props:
 *   data           : array of { idx, ...series }
 *   series         : [{ key, name, color, type? ('line'|'area'), fill?, strokeWidth? }]
 *   height         : number
 *   yLabel         : string
 *   zeroLine       : bool — draw a y=0 reference
 *   onSelect       : (idx) => void
 */
export function OrderFlowChart({
  data,
  series,
  height = 220,
  yLabel,
  zeroLine = false,
  onSelect,
  title,
  subtitle,
  yDomain,
}) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <div className="glass-panel panel-container">
      {(title || subtitle) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
          {title && <h3 className="panel-title" style={{ margin: 0 }}>{title}</h3>}
          {subtitle && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{subtitle}</div>
          )}
        </div>
      )}
      <div style={{ height }}>
        {!hasData ? (
          <div style={{ color: 'var(--text-secondary)', padding: '1.5rem', textAlign: 'center' }}>
            No data yet…
          </div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart
              data={data}
              margin={{ top: 6, right: 14, bottom: 6, left: 0 }}
              onClick={(e) => {
                if (onSelect && e && e.activeLabel != null) {
                  onSelect(parseInt(e.activeLabel, 10));
                }
              }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="idx" type="number" domain={['dataMin', 'dataMax']}
                     stroke="rgba(148,163,184,0.6)" tick={{ fontSize: 10 }} />
              <YAxis stroke="rgba(148,163,184,0.6)" tick={{ fontSize: 10 }}
                     domain={yDomain || ['auto', 'auto']}
                     label={yLabel ? {
                       value: yLabel, angle: -90, position: 'insideLeft',
                       fill: 'rgba(148,163,184,0.7)', fontSize: 11
                     } : undefined} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,17,22,0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 12,
                }}
                labelFormatter={(l) => `snapshot ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {zeroLine && <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />}

              {series.map((s) => (
                s.type === 'area' ? (
                  <Area
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    fill={s.fill || s.color}
                    fillOpacity={s.fillOpacity ?? 0.18}
                    strokeWidth={s.strokeWidth ?? 1.4}
                    dot={false}
                    isAnimationActive={false}
                  />
                ) : (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={s.strokeWidth ?? 1.4}
                    dot={false}
                    isAnimationActive={false}
                  />
                )
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
