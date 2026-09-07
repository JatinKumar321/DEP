import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, Info, GitCompare } from 'lucide-react';
import { apiUrl } from '../lib/runtimeConfig';

/**
 * ForensicEventView — Pure HTML/CSS version.
 * Recharts was crashing on React 19 due to incompatible ref handling.
 * This version uses simple inline CSS bar charts instead.
 */
export function ForensicEventView() {
  const [startDay, setStartDay] = useState(285);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refSize, setRefSize] = useState(50);
  const [testSize, setTestSize] = useState(5);

  const fetchForensic = () => {
    setLoading(true);
    setError(null);
    fetch(apiUrl(`/api/regime/window/${startDay}?ref_size=${refSize}&test_size=${testSize}`))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Forensic fetch failed:", err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => { fetchForensic(); }, []);

  const isShift = (data && typeof data.f_p_value === 'number') ? data.f_p_value < 0.01 : false;

  // Delta scores: test_mean - ref_mean for each PC
  const deltaData = (data && data.ref_mean_scores && data.test_mean_scores) ? data.ref_mean_scores.map((r, i) => ({
    name: `PC${i+1}`,
    ref: r,
    test: data.test_mean_scores[i],
    delta: data.test_mean_scores[i] - r,
    label: ['Trend (PC1)', 'Curvature (PC2)', 'Volatility (PC3)'][i] || `PC${i+1}`
  })) : [];

  // Daily returns
  const dailyReturns = (data && data.test_daily_returns) ? data.test_daily_returns.map((r, i) => ({
    day: `Day ${(data.window_start || 0) + i}`,
    return_pct: r * 100,
  })) : [];

  // Find max absolute values for scaling bars
  const maxDelta = Math.max(0.001, ...deltaData.map(d => Math.abs(d.delta)));
  const maxReturn = Math.max(0.001, ...dailyReturns.map(d => Math.abs(d.return_pct)));

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '2rem' }}>Forensic Window Comparator</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
            Multi-Day Functional Population Analysis: Reference vs Test Window
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Test End Day</label>
            <input type="number" className="input-style" style={{ width: '75px', padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
              value={startDay} onChange={(e) => setStartDay(parseInt(e.target.value) || 285)} min={55} max={1253} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Ref Size (Days)</label>
            <input type="number" className="input-style" style={{ width: '55px', padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
              value={refSize} onChange={(e) => setRefSize(parseInt(e.target.value) || 50)} min={10} max={200} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Test Size (Days)</label>
            <input type="number" className="input-style" style={{ width: '55px', padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
              value={testSize} onChange={(e) => setTestSize(parseInt(e.target.value) || 5)} min={2} max={20} />
          </div>
          <button onClick={fetchForensic} disabled={loading}
            style={{ height: 'max-content', alignSelf: 'flex-end', padding: '0.5rem 1rem', fontWeight: 'bold', fontSize: '0.8rem' }}>
            {loading ? '⏳ Analyzing...' : '🔬 Compare Windows'}
          </button>
        </div>
      </header>

      {loading && (
         <div style={{ textAlign: 'center', padding: '5rem' }}>
            <h2 className="pulse-animation" style={{ color: 'var(--text-secondary)' }}>Projecting both populations into FPCA basis...</h2>
         </div>
      )}

      {error && !loading && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-color)' }}>
          <p>⚠ Failed to load data: {error}</p>
          <button onClick={fetchForensic} style={{ marginTop: '1rem' }}>Retry</button>
        </div>
      )}

      {data && !loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          
          {/* Main Analysis View */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Eigenfunction Delta — Pure CSS Horizontal Bars */}
            <div className="glass-panel panel-container" style={{ padding: '1.25rem' }}>
              <h3 className="panel-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center' }}>
                <GitCompare size={14} style={{ marginRight: '0.4rem' }} />
                Functional Component Shift: Ref vs Test Means
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Shows how the dominant geometric shapes of the market have skewed between the {refSize}-day and {testSize}-day windows.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {deltaData.map((d, i) => {
                  const pct = Math.abs(d.delta) / maxDelta * 100;
                  const color = d.delta >= 0 ? '#10b981' : '#ef4444';
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{d.label}</span>
                        <span style={{ color, fontFamily: 'monospace' }}>{d.delta >= 0 ? '+' : ''}{d.delta.toFixed(4)}</span>
                      </div>
                      <div style={{ width: '100%', height: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          position: 'absolute',
                          left: d.delta >= 0 ? '50%' : `${50 - pct / 2}%`,
                          width: `${pct / 2}%`,
                          height: '100%',
                          backgroundColor: color,
                          borderRadius: '4px',
                          transition: 'all 0.5s ease',
                          opacity: 0.8
                        }} />
                        {/* Center line */}
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Test Window Daily Returns — Pure CSS Vertical Bars */}
            {dailyReturns.length > 0 && (
              <div className="glass-panel panel-container" style={{ padding: '1.25rem' }}>
                <h3 className="panel-title" style={{ fontSize: '0.95rem' }}>Test Window: Daily Performance Profile</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', justifyContent: 'center', height: '180px', paddingTop: '1rem' }}>
                  {dailyReturns.map((d, i) => {
                    const barHeight = Math.abs(d.return_pct) / maxReturn * 80;
                    const color = d.return_pct >= 0 ? '#10b981' : '#ef4444';
                    const isPositive = d.return_pct >= 0;
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.6rem', color, fontFamily: 'monospace', marginBottom: '0.25rem' }}>
                          {d.return_pct >= 0 ? '+' : ''}{d.return_pct.toFixed(2)}%
                        </span>
                        <div style={{
                          width: '100%',
                          maxWidth: '50px',
                          height: `${barHeight}%`,
                          minHeight: '4px',
                          backgroundColor: color,
                          borderRadius: isPositive ? '4px 4px 0 0' : '0 0 4px 4px',
                          transition: 'height 0.5s ease',
                          opacity: 0.8
                        }} />
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginTop: '0.3rem', whiteSpace: 'nowrap' }}>
                          {d.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Forensic Verdict Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Verdict Card */}
            <div className="glass-panel" style={{ padding: '1.5rem', border: `1px solid ${isShift ? 'var(--danger-color)' : 'var(--accent-color)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                {isShift ? <ShieldAlert size={24} color="var(--danger-color)" /> : <CheckCircle size={24} color="var(--accent-color)" />}
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Window Verdict</h2>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1.25rem', color: isShift ? 'var(--danger-color)' : 'var(--accent-color)' }}>
                {isShift ? 'STRUCTURAL REGIME SHIFT' : 'STABLE REGIME (NO SHIFT)'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <StatRow label="Window Evaluated" value={`Day ${data.window_start || '?'} to ${data.window_end || '?'}`} />
                <StatRow label="Reference Baseline" value={`Day ${data.ref_start || '?'} to ${data.ref_end || '?'}`} />
                <StatRow label="fANOVA F-Statistic" value={data.f_stat?.toFixed(4) || 'N/A'} color={isShift ? '#ef4444' : '#22d3ee'} />
                <StatRow label="F p-value" value={data.f_p_value?.toExponential(4) || 'N/A'} color={isShift ? '#ef4444' : '#10b981'} mono />
                <StatRow label="Hotelling T²" value={data.hotelling_t2?.toFixed(4) || 'N/A'} />
                <StatRow label="T² p-value" value={data.t2_p_value?.toExponential(4) || 'N/A'} color={(data.t2_p_value || 1) < 0.05 ? '#ef4444' : '#10b981'} mono />
                <StatRow label="Frobenius ‖ΔΣ‖_F" value={data.frobenius_norm?.toFixed(6) || 'N/A'} />
              </div>
            </div>

            {/* Audit Trail */}
            <div className="glass-panel panel-container">
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                 <Info size={16} />
                 <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Audit Trail</h4>
               </div>
               <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                 Model: FDA-fANOVA-V6<br/>
                 Reference Window: {refSize} days<br/>
                 Test Window: {testSize} days<br/>
                 FPCA Components: 3<br/>
                 Basis: B-Spline (n=30)<br/>
                 Significance Threshold: α = 0.01
               </p>
               <button 
                 style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', fontSize: '0.8rem' }}
                 onClick={() => {
                   const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `forensic_window_${startDay}.json`;
                   a.click();
                 }}
               >
                 📄 Export Window Stats JSON
               </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color, mono }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
      <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: color || '#fff', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</p>
    </div>
  );
}
