import React from 'react';
import { Activity, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

export function FDAStats({ windowDetail, isAcademicMode }) {
  if (!windowDetail) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="pulse-animation" style={{ color: 'var(--text-secondary)' }}>Select a Regime Window to Analyze...</p>
      </div>
    );
  }

  const { f_stat, f_p_value, frobenius_norm, hotelling_t2, t2_p_value } = windowDetail;
  
  const isShift = f_p_value < 0.01;
  
  let verdictColor = 'var(--success-color)';
  let verdictText = 'DEMOGRAPHICALLY STABLE';
  let Icon = CheckCircle;
  
  if (isShift) {
    verdictColor = 'var(--danger-color)';
    verdictText = 'STRUCTURAL REGIME SHIFT';
    Icon = AlertTriangle;
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* 1. Scientific Verdict Banner */}
      <div className={`glass-panel ${isShift ? 'pulse-animation' : ''}`} 
           style={{ 
             padding: '1.25rem', 
             display: 'flex', 
             alignItems: 'center', 
             gap: '1rem',
             borderLeft: `4px solid ${verdictColor}`
           }}>
        <Icon color={verdictColor} size={28} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: verdictColor, fontSize: '1rem' }}>
            {verdictText}
          </h2>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <span><strong style={{color: '#fff'}}>Window:</strong> Day {windowDetail.window_start}–{windowDetail.window_end}</span>
            <span><strong style={{color: '#fff'}}>Threshold:</strong> α = 0.01</span>
          </div>
        </div>
      </div>

      {/* 2. Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        
        {/* fANOVA Distance */}
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <Activity size={16} color={isShift ? 'var(--danger-color)' : 'var(--accent-color)'} />
            <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              fANOVA F-Statistic
            </h4>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: isShift ? 'var(--danger-color)' : 'inherit' }}>
            {f_stat?.toFixed(2) ?? '0.00'}
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            p={f_p_value?.toExponential(2)}
          </p>
        </div>

        {/* Frobenius Norm */}
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <TrendingDown size={16} color="var(--accent-color)" />
            <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Covariance Shift ‖ΔΣ‖_F
            </h4>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {frobenius_norm?.toFixed(3) ?? '0.000'}
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Frobenius Distance
          </p>
        </div>

      </div>

      {/* 3. Professor Mode: Hotelling T2 */}
      {isAcademicMode && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-color)', fontSize: '0.85rem' }}>Mean Differential (Hotelling T²)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>T² Statistic</span>
              <div style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{hotelling_t2?.toFixed(4) ?? '0.0000'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>Distribution</span>
              <div style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>χ²(3)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>p-value</span>
              <div style={{ fontWeight: 'bold', fontFamily: 'monospace', color: (t2_p_value || 1) < 0.01 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {t2_p_value?.toExponential(3) ?? '1.000e+0'}
              </div>
            </div>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            Test: H₀: E[ξ_ref] = E[ξ_test] | H₁: Means defer in Score Space
          </p>
        </div>
      )}
    </div>
  );
}
