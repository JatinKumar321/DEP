import React from 'react';
import { DollarSign, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';

export function PnLTracker({ windowDetail }) {
  if (!windowDetail) {
    return null;
  }

  const percentStr = windowDetail.benchmark_cumulative_pct;
  const pValStr = windowDetail.f_p_value;
  
  const benchmark_cumulative_pct = (percentStr !== undefined && percentStr !== null) ? parseFloat(percentStr) : 0.0;
  const f_p_value = (pValStr !== undefined && pValStr !== null) ? parseFloat(pValStr) : 1.0;
  
  const isShift = f_p_value < 0.01;
  const isDeRisked = isShift; // If we detect a shift, FDA stays out of the market

  // Mock a $1M starting portfolio for the window
  const startNotional = 1000000;
  const benchEndValue = startNotional * (1 + benchmark_cumulative_pct / 100);
  
  // FDA Value: 
  // If De-Risked (Shift), FDA earns 0% return (cash).
  // If Stable, FDA earns the benchmark return.
  const fdaEndValue = isDeRisked ? startNotional : benchEndValue;
  const fdaReturnPct = isDeRisked ? 0.0 : benchmark_cumulative_pct;

  const valueSaved = fdaEndValue - benchEndValue;

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', border: `1px solid ${isDeRisked ? 'var(--danger-color)' : 'var(--accent-color)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Economic Utility Panel</h3>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '0.4rem', 
          fontSize: '0.75rem', fontWeight: 'bold', 
          color: isDeRisked ? 'var(--danger-color)' : 'var(--success-color)',
          backgroundColor: isDeRisked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          padding: '0.2rem 0.6rem', borderRadius: '12px'
        }}>
          {isDeRisked ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
          {isDeRisked ? 'DE-RISKED (CASH)' : 'FULLY INVESTED'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* FDA-Adaptive Strategy */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>FDA Strategy (Test Window)</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: fdaReturnPct >= 0 ? '#10b981' : '#ef4444', margin: '0.25rem 0' }}>
            {fdaReturnPct > 0 ? '+' : ''}{fdaReturnPct.toFixed(3)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fff' }}>{formatCurrency(fdaEndValue)}</div>
        </div>

        {/* Buy & Hold Benchmark */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Buy & Hold Benchmark</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: benchmark_cumulative_pct >= 0 ? '#10b981' : '#ef4444', margin: '0.25rem 0' }}>
            {benchmark_cumulative_pct > 0 ? '+' : ''}{benchmark_cumulative_pct.toFixed(3)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatCurrency(benchEndValue)}</div>
        </div>
      </div>

      {/* Value Saved Highlight */}
      {(isDeRisked && valueSaved > 0) && (
        <div style={{ 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', 
          padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem' 
        }}>
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '0.5rem', borderRadius: '50%' }}>
            <DollarSign color="#10b981" size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Structural Loss Avoided</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
              +{formatCurrency(valueSaved)}
            </div>
          </div>
        </div>
      )}
      {(isDeRisked && valueSaved < 0) && (
        <div style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', 
          padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem' 
        }}>
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: '0.5rem', borderRadius: '50%' }}>
            <Activity color="#ef4444" size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Opportunity Cost (False Alarm)</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>
              {formatCurrency(valueSaved)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
