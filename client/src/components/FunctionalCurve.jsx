import React, { useState, useEffect, useRef } from 'react';
import { Layers } from 'lucide-react';
import { apiUrl } from '../lib/runtimeConfig';

/**
 * FunctionalCurve — Renders the raw intraday return curve overlaid
 * with its B-Spline smoothed approximation using a Canvas element.
 * Pure HTML/CSS/Canvas — no Recharts dependency.
 */
export function FunctionalCurve({ day }) {
  const canvasRef = useRef(null);
  const [curveData, setCurveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (day == null) return;
    setLoading(true);
    setError(null);
    fetch(apiUrl(`/api/curve/${day}`))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (json.error) throw new Error(json.error);
        setCurveData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Curve fetch failed:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [day]);

  // Draw on canvas whenever data changes
  useEffect(() => {
    if (!curveData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const raw = curveData.raw_curve;
    const smooth = curveData.smooth_curve;
    const n = raw.length;

    // Compute Y bounds
    const allVals = [...raw, ...smooth];
    let yMin = Math.min(...allVals);
    let yMax = Math.max(...allVals);
    const yPad = (yMax - yMin) * 0.1 || 0.001;
    yMin -= yPad;
    yMax += yPad;

    const pad = { top: 20, right: 20, bottom: 35, left: 55 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const toX = (i) => pad.left + (i / (n - 1)) * plotW;
    const toY = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    const nGridY = 5;
    for (let i = 0; i <= nGridY; i++) {
      const y = pad.top + (i / nGridY) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Zero line
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, toY(0));
      ctx.lineTo(W - pad.right, toY(0));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw raw curve (thin, semi-transparent)
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(raw[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw smooth curve (bold, vivid)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(smooth[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // X-axis ticks (minutes → hours)
    const xTicks = [0, 60, 120, 180, 240, 300, 389];
    const xLabels = ['9:30', '10:30', '11:30', '12:30', '1:30', '2:30', '4:00'];
    xTicks.forEach((t, idx) => {
      const x = toX(t);
      ctx.fillText(xLabels[idx], x, H - pad.bottom + 15);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, H - pad.bottom);
      ctx.stroke();
    });

    // Y-axis ticks
    ctx.textAlign = 'right';
    for (let i = 0; i <= nGridY; i++) {
      const val = yMax - (i / nGridY) * (yMax - yMin);
      const y = pad.top + (i / nGridY) * plotH;
      ctx.fillText(val.toFixed(4), pad.left - 5, y + 3);
    }

    // Legend
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';
    // Raw
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left + 10, pad.top + 8);
    ctx.lineTo(pad.left + 30, pad.top + 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Raw Returns', pad.left + 35, pad.top + 12);
    // Smooth
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pad.left + 140, pad.top + 8);
    ctx.lineTo(pad.left + 160, pad.top + 8);
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('B-Spline (n=30)', pad.left + 165, pad.top + 12);

  }, [curveData]);

  if (day == null) {
    return (
      <div className="glass-panel panel-container" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Layers size={20} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.8rem' }}>Drill a window to see the Functional Representation.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel panel-container" style={{ padding: '1rem' }}>
      <h3 className="panel-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Layers size={14} />
        Functional Representation — Day {day}
      </h3>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        Raw intraday returns (390 ticks) vs 30-node B-Spline basis projection
      </p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          ⏳ Loading curve data...
        </div>
      )}

      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--danger-color)', fontSize: '0.8rem' }}>
          ⚠ {error}
        </div>
      )}

      {!loading && !error && curveData && (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '220px', display: 'block' }}
        />
      )}
    </div>
  );
}
