import React from 'react';

/**
 * Verdict panel for a single ref/test window comparison.
 * Props: windowDetail (from /api/lob/window/:idx).
 */
export function LOBStats({ windowDetail }) {
  // Defensive: handle null, error responses, and partial/invalid payloads.
  const valid = windowDetail
    && !windowDetail.error
    && Array.isArray(windowDetail.ref_mean)
    && Array.isArray(windowDetail.test_mean);

  if (!valid) {
    return (
      <div className="glass-panel panel-container">
        <h3 className="panel-title">Regime Verdict</h3>
        <div style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
          {windowDetail?.error
            ? `Could not load window: ${windowDetail.error}`
            : 'Seek the timeline or type an index to compare a reference window against a test window.'}
        </div>
      </div>
    );
  }

  const shift = windowDetail.is_regime_shift;
  const t2p = windowDetail.t2_p_value;
  const fp = windowDetail.f_p_value;

  const badge = shift
    ? { bg: 'rgba(239,68,68,0.15)', color: '#f87171', text: 'REGIME SHIFT' }
    : { bg: 'rgba(16,185,129,0.15)', color: '#34d399', text: 'STABLE' };

  return (
    <div className="glass-panel panel-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>Regime Verdict</h3>
        <div
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: '999px',
            background: badge.bg,
            color: badge.color,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          {badge.text}
        </div>
      </div>

      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
        ref [{windowDetail.ref_start}, {windowDetail.ref_end}] · test [{windowDetail.test_start},{' '}
        {windowDetail.test_end}]
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.9rem' }}>
        <Metric label="Hotelling T²" value={fmt(windowDetail.hotelling_t2)} sub={`p=${pfmt(t2p)}`} />
        <Metric label="Frobenius D_Σ" value={fmt(windowDetail.frobenius_norm)} sub="covariance" />
        <Metric label="fANOVA F" value={fmt(windowDetail.f_stat)} sub={`p=${pfmt(fp)}`} />
        <Metric
          label="n ref / test"
          value={`${windowDetail.n_ref} / ${windowDetail.n_test}`}
          sub="snapshots"
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div
          style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-secondary)',
            marginBottom: '0.4rem',
          }}
        >
          Latent mean shift
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {windowDetail.ref_mean.map((mu_r, i) => {
            const mu_t = windowDetail.test_mean[i];
            const d = mu_t - mu_r;
            const mag = Math.min(100, Math.abs(d) * 80);
            return (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem' }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)',
                    width: 24,
                  }}
                >
                  PC{i + 1}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 4,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: d < 0 ? `calc(50% - ${mag / 2}%)` : '50%',
                      width: `${mag / 2}%`,
                      height: '100%',
                      background: d < 0 ? '#f87171' : '#34d399',
                      borderRadius: 4,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: 'rgba(255,255,255,0.2)',
                    }}
                  />
                </div>
                <span style={{ fontFamily: 'monospace', width: 62, textAlign: 'right' }}>
                  {d >= 0 ? '+' : ''}
                  {d.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function fmt(v) {
  if (v == null || !isFinite(v)) return '—';
  if (Math.abs(v) > 1000) return v.toExponential(2);
  return v.toFixed(3);
}

function pfmt(p) {
  if (p == null || !isFinite(p)) return '—';
  if (p < 1e-6) return '<1e-6';
  if (p < 0.001) return p.toExponential(1);
  return p.toFixed(3);
}

function Metric({ label, value, sub }) {
  return (
    <div
      style={{
        padding: '0.6rem 0.7rem',
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
      }}
    >
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}
