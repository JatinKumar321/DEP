import React from 'react';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        minWidth: 150,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
        <Icon size={13} color={color || 'var(--text-secondary)'} />
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: color || 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{sub}</div>
      )}
    </div>
  );
}

const fmt = (v, d = 3) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(d);
};

export function OrderFlowSummary({ summary, center }) {
  if (!summary) {
    return (
      <div className="glass-panel panel-container">
        <h3 className="panel-title">Window Summary</h3>
        <div style={{ color: 'var(--text-secondary)' }}>No window selected.</div>
      </div>
    );
  }

  const { ofi_mean, ofi_std, activity_max, joint_max, signed_flow_end } = summary;
  const direction = (signed_flow_end ?? 0) >= 0 ? 'BUY' : 'SELL';
  const dirColor = direction === 'BUY' ? '#10b981' : '#ef4444';

  return (
    <div className="glass-panel panel-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>Window Summary</h3>
        {center != null && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            centered on snapshot {center}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem' }}>
        <StatCard
          icon={direction === 'BUY' ? TrendingUp : TrendingDown}
          color={dirColor}
          label="Net Direction"
          value={direction}
          sub={`signed flow ≈ ${fmt(signed_flow_end)}`}
        />
        <StatCard
          icon={Activity}
          label="OFI μ ± σ"
          value={`${fmt(ofi_mean, 2)}`}
          sub={`std ${fmt(ofi_std, 2)}`}
        />
        <StatCard
          icon={Activity}
          color="#60a5fa"
          label="Peak Activity"
          value={fmt(activity_max, 1)}
          sub="book turnover proxy"
        />
        <StatCard
          icon={Target}
          color="#f59e0b"
          label="Peak Joint"
          value={fmt(joint_max, 3)}
          sub="activity × |imbalance|"
        />
      </div>
    </div>
  );
}
