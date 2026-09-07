import React, { useEffect, useRef } from 'react';

/**
 * Pre/post mean-depth comparison for a single window detail.
 * Overlays ref vs test mean bid/ask volume curves with delta shading.
 */
export function LOBSnapshotComparison({ windowDetail }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = 260;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!windowDetail) {
      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      ctx.font = '13px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Select a window to compare ref vs. test mean depth', W / 2, H / 2);
      return;
    }

    const levels = 10;
    const padL = 38;
    const padR = 12;
    const padT = 20;
    const padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const bidR = windowDetail.ref_mean_bid_vol;
    const askR = windowDetail.ref_mean_ask_vol;
    const bidT = windowDetail.test_mean_bid_vol;
    const askT = windowDetail.test_mean_ask_vol;

    const all = [...bidR, ...askR, ...bidT, ...askT];
    const maxV = Math.max(...all.map(Math.abs), 1e-6);
    const minV = -maxV;

    const x = (i) => padL + (i / (levels - 1)) * plotW;
    const y = (v) => padT + ((maxV - v) / (maxV - minV)) * plotH;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < levels; i++) {
      ctx.beginPath();
      ctx.moveTo(x(i), padT);
      ctx.lineTo(x(i), padT + plotH);
      ctx.stroke();
    }
    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(padL, y(0));
    ctx.lineTo(padL + plotW, y(0));
    ctx.stroke();

    const draw = (arr, color, dashed = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (dashed) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      arr.forEach((v, i) => {
        if (i === 0) ctx.moveTo(x(i), y(v));
        else ctx.lineTo(x(i), y(v));
      });
      ctx.stroke();
    };
    // Draw ref dashed, test solid. Bids red-ish, asks green-ish.
    draw(bidR.map((v) => -v), 'rgba(248,113,113,0.55)', true);
    draw(askR, 'rgba(52,211,153,0.55)', true);
    draw(bidT.map((v) => -v), 'rgba(248,113,113,0.95)');
    draw(askT, 'rgba(52,211,153,0.95)');
    ctx.setLineDash([]);

    // Delta bars at each level on a secondary axis row
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    for (let i = 0; i < levels; i++) {
      ctx.fillText(`${i + 1}`, x(i), H - 10);
    }

    // Legend
    ctx.textAlign = 'left';
    ctx.font = '10px Inter';
    const legend = [
      { c: 'rgba(248,113,113,0.95)', t: 'test bid' },
      { c: 'rgba(248,113,113,0.55)', t: 'ref bid (dashed)' },
      { c: 'rgba(52,211,153,0.95)', t: 'test ask' },
      { c: 'rgba(52,211,153,0.55)', t: 'ref ask (dashed)' },
    ];
    legend.forEach((l, k) => {
      ctx.fillStyle = l.c;
      ctx.fillRect(padL + k * 110, 6, 10, 4);
      ctx.fillStyle = 'rgba(148,163,184,0.85)';
      ctx.fillText(l.t, padL + k * 110 + 14, 11);
    });
  }, [windowDetail]);

  return (
    <div className="glass-panel panel-container">
      <h3 className="panel-title">Pre / Post Depth — ref vs test mean</h3>
      <canvas ref={canvasRef} style={{ width: '100%', height: 260, display: 'block' }} />
      {windowDetail && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Δ bid / Δ ask per level:{' '}
          {windowDetail.delta_bid_vol
            .map((v, i) => `L${i + 1}: ${v >= 0 ? '+' : ''}${v.toFixed(2)}`)
            .join(' · ')}
        </div>
      )}
    </div>
  );
}
