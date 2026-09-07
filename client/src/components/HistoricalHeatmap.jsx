import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function HistoricalHeatmap({ daysData, onDaySelect, currentDay, isAcademicMode }) {
  if (!daysData || daysData.length === 0) {
    return (
      <div className="glass-panel panel-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="pulse-animation" style={{ color: 'var(--text-secondary)' }}>Loading Dataset Entropy...</p>
      </div>
    );
  }

  // Define color scale based on mathematical significance (-log10(p-value))
  const maxSig = daysData ? Math.max(...daysData.map(d => -Math.log10(d.min_p_value || 0.000001))) : 1;

  const chartData = daysData.map(d => ({
    ...d,
    sig_score: -Math.log10(d.min_p_value || 0.0001)
  }));
  
  return (
    <div className="glass-panel panel-container" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 className="panel-title">{isAcademicMode ? "Global Dataset p-value Distribution" : "Macro Dataset Statistical Significance"}</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isAcademicMode ? "Each node represents n=390 intraday observations. Y-axis is -log₁₀(p) where p = 1 - χ²(T²_adj, df)." : "Every dot is a trading day. Plotted by Minimum P-Value (Log Scale) across its intraday FDA metrics."}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {isAcademicMode ? "H₀ Retained" : "Stationary"}
          </span>
          <div style={{ width: '80px', height: '8px', background: 'linear-gradient(to right, var(--accent-color), var(--danger-color))', borderRadius: '4px' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {isAcademicMode ? "H₁ Configured" : "High Anomaly"}
          </span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            type="number" 
            dataKey="day" 
            name="Trading Day" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
            label={{ value: 'Dataset Index (Day Offset)', position: 'insideBottom', offset: -10, fill: 'var(--text-secondary)' }}
          />
          <YAxis 
            type="number" 
            dataKey="sig_score" 
            name="Statistical Significance" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
            label={{ value: '-Log10(P-Value)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)' }}
            itemStyle={{ color: 'var(--text-primary)' }}
            formatter={(value, name) => [value.toFixed(4), name]}
          />
          <Scatter 
            name="S&P 500 Days" 
            data={chartData} 
            onClick={(e) => onDaySelect(e.day)}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => {
              // Color scale interpolation based on -log10(p-value)
              const sig = entry.sig_score;
              const ratio = Math.min(sig / (maxSig || 1), 1);
              const isSelected = entry.day === currentDay;
              // Mix RGB from accent (59, 130, 246) to danger (239, 68, 68)
              const r = Math.round(59 + ratio * (239 - 59));
              const g = Math.round(130 + ratio * (68 - 130));
              const b = Math.round(246 + ratio * (68 - 246));
              const color = isSelected ? '#ffffff' : `rgb(${r}, ${g}, ${b})`;
              
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={color} 
                  stroke={isSelected ? 'var(--accent-color)' : 'none'}
                  strokeWidth={isSelected ? 3 : 0}
                  r={isSelected ? 6 : 4} // Increase radius for selected day
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
