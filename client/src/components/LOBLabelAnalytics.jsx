import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Label horizon analytics from a window detail:
 *   - side-by-side ref/test class distributions
 *   - KL divergence KL(test || ref) per horizon P1..P5
 *
 * Labels are NEVER inputs to the detector — they're evaluation overlays.
 */
export function LOBLabelAnalytics({ windowDetail }) {
  if (!windowDetail) return null;
  const kl = windowDetail.kl_divergence || {};
  const distRef = windowDetail.label_distributions_ref || {};
  const distTest = windowDetail.label_distributions_test || {};
  const horizons = ['P1', 'P2', 'P3', 'P4', 'P5'];

  const klData = horizons.map((h) => ({ horizon: h, kl: kl[h] ?? 0 }));

  return (
    <div className="glass-panel panel-container">
      <h3 className="panel-title">Label Distribution Shift — KL(test ‖ ref) across horizons</h3>

      <div style={{ height: 170 }}>
        <ResponsiveContainer>
          <BarChart data={klData}>
            <XAxis dataKey="horizon" stroke="rgba(148,163,184,0.7)" tick={{ fontSize: 11 }} />
            <YAxis stroke="rgba(148,163,184,0.7)" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'rgba(15,17,22,0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
              }}
              formatter={(v) => [v.toFixed(4), 'KL']}
            />
            <Bar dataKey="kl">
              {klData.map((e, i) => (
                <Cell key={i} fill={e.kl > 0.1 ? '#f87171' : e.kl > 0.03 ? '#f59e0b' : '#34d399'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.5rem',
          marginTop: '0.5rem',
        }}
      >
        {horizons.map((h) => {
          const r = distRef[h];
          const t = distTest[h];
          if (!r || !t) return <div key={h} />;
          const classes = Array.from(
            new Set([...(r.classes || []), ...(t.classes || [])]),
          ).sort((a, b) => a - b);
          const colors = ['#ef4444', '#94a3b8', '#10b981'];
          return (
            <div
              key={h}
              style={{
                padding: '0.5rem',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.3rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{h}</span>
                <span style={{ fontFamily: 'monospace' }}>KL={Number(kl[h] ?? 0).toFixed(3)}</span>
              </div>
              {classes.map((c, k) => {
                const pr = r.classes?.indexOf(c) >= 0 ? r.probs[r.classes.indexOf(c)] : 0;
                const pt = t.classes?.indexOf(c) >= 0 ? t.probs[t.classes.indexOf(c)] : 0;
                const color = colors[k % colors.length];
                return (
                  <div key={c} style={{ marginBottom: 2 }}>
                    <div
                      style={{
                        fontSize: '0.6rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>cls {c}</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {(pr * 100).toFixed(0)}→{(pt * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        height: 4,
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ width: `${pr * 50}%`, background: color, opacity: 0.35 }} />
                      <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
                      <div style={{ width: `${pt * 50}%`, background: color, opacity: 0.9 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        Each horizon bar shows ref (faded, left half) vs test (solid, right half) distribution. Labels
        are *never* fed to the detector — pure downstream evaluation.
      </div>
    </div>
  );
}
