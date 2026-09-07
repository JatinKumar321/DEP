import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function FPCAViewer({ latestTick, isAcademicMode }) {
  if (!latestTick || !latestTick.fpca_scores) {
    return (
      <div className="glass-panel panel-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="pulse-animation" style={{ color: 'var(--text-secondary)' }}>Awaiting FPCA Eigenfunctions...</p>
      </div>
    );
  }

  const labels = isAcademicMode 
    ? ['ξ₁ (Trend)', 'ξ₂ (Curvature)', 'ξ₃ (Volatility)'] 
    : ['PC1 (Trend)', 'PC2 (Curvature)', 'PC3 (Volatility)'];

  const data = latestTick.fpca_scores.map((score, idx) => ({
    name: labels[idx] || `PC${idx + 1}`,
    value: score,
    absValue: Math.abs(score)
  }));
  
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b'];
  
  // Determine if any score is significant (large absolute value)
  const maxAbs = Math.max(...data.map(d => d.absValue));

  return (
    <div className="glass-panel panel-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>
          {isAcademicMode ? "FPCA Eigenfunction Scores" : "Shape Decomposition"}
        </h3>
        {maxAbs > 3 && (
          <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '12px', backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 'bold' }}>
            HIGH DEVIATION
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: isAcademicMode ? 'monospace' : 'inherit' }}>
        {isAcademicMode ? "ξ_k = ∫ (X(t) - μ(t)) φ_k(t) dt" : "Real-time structural shape decomposition"}
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis 
            type="number" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
            domain={['dataMin - 1', 'dataMax + 1']} 
          />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} 
            width={100}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--text-primary)' }}
            formatter={(val) => val.toFixed(4)}
          />
          <Bar dataKey="value" isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
