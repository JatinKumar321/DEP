import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

/**
 * Online per-snapshot alarm series (Mahalanobis² from rolling reference).
 * CUSUM bar on top helps highlight persistent excursions.
 */
export function LOBAlarmPanel({ scan, selectedSnapshot, onSnapshotSelect }) {
  const data = useMemo(() => {
    if (!scan?.alarm_series) return [];
    const arr = scan.alarm_series;
    // Down-sample for the chart to stay responsive (keep ~1500 points max).
    const stride = Math.max(1, Math.floor(arr.length / 1500));
    const pts = [];
    let cusum = 0;
    const threshold = 2 * chiQuantile(scan.n_components || 5, 0.99); // heuristic slack
    for (let i = 0; i < arr.length; i += stride) {
      const v = arr[i];
      cusum = Math.max(0, cusum + v - threshold);
      pts.push({ t: i, alarm: v, cusum });
    }
    return pts;
  }, [scan]);

  if (!scan) return null;

  return (
    <div className="glass-panel panel-container">
      <h3 className="panel-title">Online Alarm — Mahalanobis² vs rolling reference</h3>
      <div style={{ height: 180 }}>
        <ResponsiveContainer>
          <AreaChart
            data={data}
            onClick={(e) => {
              if (e && e.activeLabel && onSnapshotSelect) onSnapshotSelect(parseInt(e.activeLabel, 10));
            }}
          >
            <defs>
              <linearGradient id="alarmFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cusumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, scan.total_snapshots]}
              stroke="rgba(148,163,184,0.5)"
              tick={{ fontSize: 10 }}
            />
            <YAxis stroke="rgba(148,163,184,0.5)" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'rgba(15,17,22,0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
              }}
              labelFormatter={(l) => `snapshot ${l}`}
            />
            <Area
              dataKey="alarm"
              stroke="#f87171"
              strokeWidth={1}
              fill="url(#alarmFill)"
              isAnimationActive={false}
            />
            <Area
              dataKey="cusum"
              stroke="#60a5fa"
              strokeWidth={1}
              fill="url(#cusumFill)"
              isAnimationActive={false}
            />
            {selectedSnapshot != null && (
              <ReferenceLine x={selectedSnapshot} stroke="rgba(59,130,246,0.8)" strokeDasharray="3 3" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
        Red: per-snapshot Mahalanobis² in latent space (rolling ref={scan.ref_size}). Blue: CUSUM of
        excursions above 2·χ²<sub>0.99</sub>.
      </div>
    </div>
  );
}

// Crude χ² quantile approx via Wilson–Hilferty — good enough for a threshold heuristic.
function chiQuantile(df, p) {
  const z = p === 0.99 ? 2.326 : 1.96;
  const h = 2 / (9 * df);
  return df * Math.pow(1 - h + z * Math.sqrt(h), 3);
}
