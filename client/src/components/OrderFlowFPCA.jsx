import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ZAxis,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

/**
 * 2-D scatter of FPCA latent (PC1 × PC2) coloured by snapshot index
 * (chronological gradient — blue early → red late). Hover shows index.
 */
export function OrderFlowFPCA({ fpca, onSelect }) {
  const points = useMemo(() => {
    if (!fpca?.latent || !Array.isArray(fpca.latent)) return [];
    return fpca.latent.map((row, i) => ({
      x: row[0] ?? 0,
      y: row[1] ?? 0,
      idx: fpca.snapshot_indices?.[i] ?? i,
      order: i / Math.max(fpca.latent.length - 1, 1),
    }));
  }, [fpca]);

  const variance = fpca?.variance_explained || [];
  const totalVar = variance.length ? variance.reduce((a, b) => a + b, 0) : 0;

  const colorAt = (t) => {
    // Interpolate blue → cyan → orange → red
    const r = Math.round(60 + 195 * t);
    const g = Math.round(140 + 60 * Math.sin(Math.PI * t));
    const b = Math.round(250 - 240 * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="glass-panel panel-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>
          Order-Flow FPCA Latent
        </h3>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          {points.length} windows · σ²:{' '}
          {variance.map((v, i) => (
            <span key={i} style={{ marginRight: 6 }}>
              PC{i + 1} {(v * 100).toFixed(1)}%
            </span>
          ))}
          {variance.length > 0 && <>· total {(totalVar * 100).toFixed(1)}%</>}
        </div>
      </div>
      <div style={{ height: 320, marginTop: '0.4rem' }}>
        {points.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
            Run FPCA scan…
          </div>
        ) : (
          <ResponsiveContainer>
            <ScatterChart
              margin={{ top: 10, right: 16, bottom: 10, left: 0 }}
              onClick={(e) => {
                const p = e?.activePayload?.[0]?.payload;
                if (p && onSelect) onSelect(p.idx);
              }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                dataKey="x"
                stroke="rgba(148,163,184,0.6)"
                tick={{ fontSize: 10 }}
                label={{
                  value: `PC1${variance[0] != null ? ` (${(variance[0] * 100).toFixed(1)}%)` : ''}`,
                  fill: 'rgba(148,163,184,0.7)', fontSize: 11, position: 'insideBottom', dy: 8,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                stroke="rgba(148,163,184,0.6)"
                tick={{ fontSize: 10 }}
                label={{
                  value: `PC2${variance[1] != null ? ` (${(variance[1] * 100).toFixed(1)}%)` : ''}`,
                  fill: 'rgba(148,163,184,0.7)', fontSize: 11, angle: -90, position: 'insideLeft',
                }}
              />
              <ZAxis range={[40, 60]} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,17,22,0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 12,
                }}
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(v, n) => [v.toFixed(3), n]}
                labelFormatter={() => ''}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div style={{
                      background: 'rgba(15,17,22,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '0.4rem 0.6rem', fontSize: 12, borderRadius: 6,
                    }}>
                      <div>Snapshot {p.idx}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        PC1 {p.x.toFixed(3)} · PC2 {p.y.toFixed(3)}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={points} fill="#60a5fa">
                {points.map((p, i) => (
                  <Cell key={i} fill={colorAt(p.order)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
        Each point is a sliding window of all 6 order-flow signals stacked into a single
        functional vector. Color encodes time (blue early → red late). Clusters of distinct
        colours = persistent regimes; trajectories crossing the plot = active regime drift.
      </div>
    </div>
  );
}
