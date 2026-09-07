import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { apiUrl } from '../lib/runtimeConfig';

export function RegimeTimeline({ onWindowSelect, selectedWindow }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/regime/scan'))
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Regime scan failed:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="glass-panel panel-container" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="pulse-animation" style={{ color: 'var(--text-secondary)' }}>
          Scanning 1258 days for regime shifts... (first load may take ~30s)
        </p>
      </div>
    );
  }

  if (!data || !data.timeline) {
    return (
      <div className="glass-panel panel-container">
        <p style={{ color: 'var(--danger-color)' }}>Failed to load regime scan data.</p>
      </div>
    );
  }

  const chartData = data.timeline.map(w => ({
    day: w.window_start,
    fStat: Math.min(w.f_stat, 50),
    frobNorm: w.frobenius_norm,
    t2: Math.min(w.hotelling_t2, 100),
    isShift: w.is_regime_shift,
    pValue: w.f_p_value,
  }));

  const regimeBands = data.regime_bands || [];
  const visibleBands = showAll ? regimeBands : regimeBands.slice(0, 8);

  return (
    <div className="glass-panel" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Regime Distance Timeline</h3>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            fANOVA F-statistic: 50-day Reference vs 5-day Test Window | Red bands = Detected Structural Regimes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 'bold' }}>
            {regimeBands.length} Regime{regimeBands.length !== 1 ? 's' : ''} Detected
          </span>
          <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            {data.windows_scanned} Windows
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} onClick={(e) => {
          if (e && e.activePayload && e.activePayload[0]) {
            const day = e.activePayload[0].payload.day;
            onWindowSelect && onWindowSelect(day);
          }
        }}>
          <defs>
            <linearGradient id="fStatGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="day" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
            label={{ value: 'Trading Day', position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)', fontSize: 10 }}
          />
          <YAxis 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
            label={{ value: 'F-Statistic', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-secondary)', fontSize: 10 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}
            formatter={(val, name) => {
              if (name === 'fStat') return [val.toFixed(2), 'F-Statistic'];
              return [val, name];
            }}
            labelFormatter={(day) => `Window starting Day ${day}`}
          />

          {regimeBands.map((band, i) => (
            <ReferenceArea
              key={i}
              x1={band.start}
              x2={band.end}
              fill="rgba(239, 68, 68, 0.12)"
              stroke="rgba(239, 68, 68, 0.3)"
              strokeDasharray="3 3"
            />
          ))}

          <Area 
            type="monotone" 
            dataKey="fStat" 
            stroke="#3b82f6" 
            fill="url(#fStatGrad)" 
            strokeWidth={1.5}
            isAnimationActive={false}
            name="fStat"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* ALL Regime Bands — scrollable list */}
      {regimeBands.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxHeight: showAll ? '300px' : 'auto', overflowY: showAll ? 'auto' : 'visible' }}>
            {visibleBands.map((band, i) => (
              <div 
                key={i} 
                onClick={() => onWindowSelect && onWindowSelect(band.start)}
                style={{ 
                  padding: '0.35rem 0.55rem', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: selectedWindow === band.start ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
                  border: selectedWindow === band.start ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.65rem', color: 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                <strong style={{ color: '#ef4444' }}>Day {band.start}–{band.end}</strong>
                <span style={{ marginLeft: '0.3rem' }}>({band.duration_days}d)</span>
              </div>
            ))}
          </div>
          {regimeBands.length > 8 && (
            <button 
              onClick={() => setShowAll(!showAll)}
              style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', fontSize: '0.7rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              {showAll ? `▲ Show Less` : `▼ Show All ${regimeBands.length} Regimes`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
