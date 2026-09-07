import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

/**
 * Scrolling alert log. Each alert is a contiguous burst of warning/critical
 * ticks; we keep the latest 50.
 */
export function LiveAlertLog({ alerts }) {
  return (
    <div className="glass-panel panel-container" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>Alert Log</h3>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          {alerts.length} {alerts.length === 1 ? 'event' : 'events'}
        </div>
      </div>
      <div style={{
        maxHeight: 320, overflowY: 'auto', display: 'flex',
        flexDirection: 'column', gap: '0.4rem', paddingRight: '0.2rem',
      }}>
        {alerts.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontSize: '0.8rem' }}>
            No alerts yet — system in stable regime.
          </div>
        )}
        {alerts.slice().reverse().map((a, i) => (
          <AlertRow key={`${a.start}-${i}`} alert={a} />
        ))}
      </div>
    </div>
  );
}

function AlertRow({ alert }) {
  const isCrit = alert.severity === 'critical';
  const color = isCrit ? '#ef4444' : '#f59e0b';
  const Icon = isCrit ? ShieldAlert : AlertTriangle;
  const bg = isCrit ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.7rem',
        padding: '0.55rem 0.7rem',
        background: bg,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        fontSize: '0.78rem',
      }}
    >
      <Icon size={16} color={color} />
      <div style={{ flex: 1 }}>
        <div style={{ color, fontWeight: 600 }}>
          {alert.severity.toUpperCase()} · ticks {alert.start} → {alert.end}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: 2 }}>
          peak T² = {alert.peak.toFixed(2)} · duration {alert.duration}t
        </div>
      </div>
      {alert.spread != null && (
        <div style={{
          fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right',
          fontFamily: 'Menlo, monospace',
        }}>
          spread<br />{alert.spread.toFixed(4)}
        </div>
      )}
    </div>
  );
}
