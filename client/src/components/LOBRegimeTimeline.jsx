import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
  Legend,
} from 'recharts';

/**
 * Timeline over snapshot index — T² + Frobenius + regime bands as shaded areas.
 * Clicking a band seeks to its center.
 */
export function LOBRegimeTimeline({ scan, onSnapshotSelect, selectedSnapshot }) {
  const chartData = useMemo(() => {
    if (!scan?.timeline) return [];
    return scan.timeline.map((w) => ({
      t: w.test_start,
      t2: w.hotelling_t2,
      d_M: w.mahalanobis_d,
      d_sigma: w.frobenius_norm,
      shift: w.is_regime_shift ? 1 : 0,
    }));
  }, [scan]);

  const bands = scan?.regime_bands || [];

  if (!scan) {
    return (
      <div className="glass-panel panel-container" style={{ height: 260 }}>
        <h3 className="panel-title">LOB Regime Timeline</h3>
        <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
          Loading scan…
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel panel-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>
          Regime Timeline — Hotelling T² & Frobenius D<sub>Σ</sub>
        </h3>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          {scan.total_snapshots.toLocaleString()} snapshots · {scan.windows_scanned} windows ·{' '}
          {bands.length} bands
          {scan.alpha_adjusted != null && (
            <> · α<sub>adj</sub>={scan.alpha_adjusted.toExponential(1)}</>
          )}
        </div>
      </div>
      <div style={{ height: 240, marginTop: '0.5rem' }}>
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
            onClick={(e) => {
              if (e && e.activeLabel && onSnapshotSelect) onSnapshotSelect(parseInt(e.activeLabel, 10));
            }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, scan.total_snapshots]}
              stroke="rgba(148,163,184,0.6)"
              tick={{ fontSize: 10 }}
            />
            <YAxis yAxisId="left" stroke="rgba(148,163,184,0.6)" tick={{ fontSize: 10 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="rgba(148,163,184,0.4)"
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(15,17,22,0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
              }}
              labelFormatter={(l) => `snapshot ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {bands.map((b, i) => (
              <ReferenceArea
                key={i}
                x1={b.start}
                x2={b.end}
                y1={0}
                yAxisId="left"
                fill="rgba(239,68,68,0.12)"
                stroke="rgba(239,68,68,0.3)"
              />
            ))}

            {selectedSnapshot != null && (
              <ReferenceArea
                yAxisId="left"
                x1={selectedSnapshot - 10}
                x2={selectedSnapshot + 10}
                fill="rgba(59,130,246,0.2)"
                stroke="rgba(59,130,246,0.5)"
              />
            )}

            <Line
              yAxisId="left"
              dataKey="d_M"
              name="Mahalanobis d_M"
              stroke="#60a5fa"
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              yAxisId="right"
              dataKey="d_sigma"
              name="Frobenius D_Σ"
              stroke="#f59e0b"
              dot={false}
              strokeWidth={1}
              opacity={0.7}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
