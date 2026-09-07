import React from 'react';
import {
  LineChart, Line, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, XAxis,
} from 'recharts';

/**
 * Compact rolling sparkline strip for a single metric.
 *
 * Props:
 *   data       : [{ idx, value }]
 *   color
 *   label      : top-left header
 *   format     : (number) => string
 *   threshold  : optional reference line value
 *   threshold2 : optional 2nd reference (e.g. critical)
 *   currentValue
 */
export function LiveTickerSparkline({
  data, color, label, format = (v) => v?.toFixed(2),
  threshold, threshold2, currentValue, height = 70, zeroLine = false,
  invertColor,
}) {
  const v = currentValue ?? data?.[data?.length - 1]?.value;
  const dynamicColor = invertColor && v != null && v < 0 ? '#ef4444' : color;

  return (
    <div
      className="glass-panel"
      style={{
        padding: '0.7rem 0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: dynamicColor, fontFamily: 'Menlo, monospace' }}>
          {v != null && Number.isFinite(v) ? format(v) : '—'}
        </span>
      </div>
      <div style={{ height }}>
        {data && data.length > 1 ? (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
              <YAxis hide domain={['auto', 'auto']} />
              <XAxis dataKey="idx" hide />
              {zeroLine && <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 2" />}
              {threshold != null && (
                <ReferenceLine y={threshold} stroke="rgba(245,158,11,0.55)" strokeDasharray="3 3" />
              )}
              {threshold2 != null && (
                <ReferenceLine y={threshold2} stroke="rgba(239,68,68,0.7)" strokeDasharray="3 3" />
              )}
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,17,22,0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 11, padding: '0.3rem 0.5rem',
                }}
                formatter={(val) => [format(val), label]}
                labelFormatter={(l) => `tick ${l}`}
              />
              <Line
                dataKey="value" stroke={dynamicColor} dot={false}
                strokeWidth={1.4} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', padding: '1rem', textAlign: 'center' }}>
            …
          </div>
        )}
      </div>
    </div>
  );
}
