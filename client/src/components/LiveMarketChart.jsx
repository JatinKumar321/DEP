import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function LiveMarketChart({ windowDetail, isAcademicMode }) {
  if (!windowDetail || !windowDetail.test_daily_returns) {
    return (
      <div className="glass-panel" style={{ height: '400px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No Test Window Selected.</p>
      </div>
    );
  }

  const { test_daily_returns, benchmark_cumulative_pct, window_start } = windowDetail;
  let running_cumulative = 0;
  
  const chartData = (test_daily_returns || []).map((r, i) => {
    running_cumulative += (r * 100);
    return {
      day: `Day ${window_start + i}`,
      return: running_cumulative
    };
  });

  const isShift = (windowDetail.f_p_value || 1.0) < 0.01;
  const strokeColor = isShift ? '#ef4444' : '#22d3ee';
  const benchPct = (benchmark_cumulative_pct !== undefined && benchmark_cumulative_pct !== null) ? benchmark_cumulative_pct : 0.0;

  return (
    <div className="glass-panel" style={{ height: '400px', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>
          {isAcademicMode ? "Y(t): Test Window Cumulative Performance" : "Test Window vs Reference Mean"}
        </h3>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold',
          backgroundColor: `${strokeColor}22`,
          color: strokeColor,
          border: `1px solid ${strokeColor}`
        }}>
          Cum Ret: {benchPct.toFixed(2)}%
        </div>
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="day" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            formatter={(val) => `${val.toFixed(2)}%`}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}
          />
          
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="5 5" />

          <Area 
            type="monotone" 
            dataKey="return" 
            stroke={strokeColor}
            strokeWidth={2}
            fillOpacity={1} 
            fill={`url(#color${isShift ? 'Red' : 'Cyan'})`}
            name="Cumulative Return"
            isAnimationActive={false}
          />

        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
