import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * Big radial-style alarm gauge driven by Mahalanobis² (Hotelling's T²)
 * vs. χ² thresholds at α=0.01 and α=0.001.
 *
 * Three states: ok (green), warning (amber, χ² > 0.99), critical (red, χ² > 0.999).
 */
export function LiveAlarmGauge({ tick, idx }) {
  const alarm = tick?.alarm ?? 0;
  const warn = tick?.threshold_warn ?? 15;
  const crit = tick?.threshold_crit ?? 25;
  const severity = tick?.severity ?? 'ok';

  // Normalise to a 0–1.2 scale (so we can still render values past crit visually)
  const norm = Math.min(1.2, alarm / Math.max(crit * 1.4, 1));
  const angle = -135 + norm * 270;  // -135° start to +135°

  const stateConfig = {
    ok: { color: '#10b981', glow: 'rgba(16, 185, 129, 0.45)', label: 'STABLE', icon: ShieldCheck },
    warning: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.55)', label: 'WARNING', icon: AlertTriangle },
    critical: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.65)', label: 'CRITICAL', icon: ShieldAlert },
  };
  const cfg = stateConfig[severity];
  const Icon = cfg.icon;

  return (
    <div
      className="glass-panel panel-container"
      style={{
        padding: '1.1rem 1.2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: severity !== 'ok' ? `0 0 28px ${cfg.glow}` : undefined,
        transition: 'box-shadow 0.4s ease',
      }}
    >
      <h3 className="panel-title" style={{ margin: 0, alignSelf: 'flex-start' }}>Regime Alarm — Hotelling T²</h3>

      <div style={{ position: 'relative', width: 200, height: 200, marginTop: '0.4rem' }}>
        {/* Outer ring */}
        <svg width="200" height="200" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="85%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path
            d={describeArc(100, 100, 80, -135, 135)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          {/* Filled */}
          <path
            d={describeArc(100, 100, 80, -135, Math.min(135, angle))}
            stroke="url(#gauge-gradient)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            style={{ transition: 'all 0.18s ease-out' }}
          />
          {/* Threshold ticks */}
          {[
            { v: warn / Math.max(crit * 1.4, 1), col: '#f59e0b' },
            { v: crit / Math.max(crit * 1.4, 1), col: '#ef4444' },
          ].map(({ v, col }, i) => {
            const a = -135 + v * 270;
            const p1 = polar(100, 100, 70, a);
            const p2 = polar(100, 100, 92, a);
            return (
              <line
                key={i}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={col} strokeWidth="2" strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Centre readout */}
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={26} color={cfg.color} className={severity === 'critical' ? 'pulse-animation' : ''} />
          <div style={{ marginTop: 6, fontSize: '1.65rem', fontWeight: 700, color: cfg.color, fontFamily: 'Menlo, monospace' }}>
            {alarm.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {cfg.label}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '0.7rem', display: 'flex', gap: '0.8rem',
        fontSize: '0.7rem', color: 'var(--text-secondary)',
      }}>
        <span>α=0.01: <strong style={{ color: '#f59e0b' }}>{warn.toFixed(1)}</strong></span>
        <span>α=0.001: <strong style={{ color: '#ef4444' }}>{crit.toFixed(1)}</strong></span>
        {idx != null && <span>tick #{idx}</span>}
      </div>
    </div>
  );
}

// Arc helpers (degrees, clockwise, top-clockwise convention)
function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx, cy, r, start, end) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}
