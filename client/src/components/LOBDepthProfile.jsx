import React, { useRef, useEffect } from 'react';

/**
 * Mirrored bid/ask depth profile.
 * Bids drawn on the left (red-ish), asks on the right (green-ish).
 * Both raw step-bars and smooth B-spline reconstructions are rendered.
 */
export function LOBDepthProfile({ snapshot, height = 340 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (!snapshot) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '13px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting snapshot…', width / 2, height / 2);
      return;
    }

    const bid = snapshot.raw.bid_vol;
    const ask = snapshot.raw.ask_vol;
    const smooth = snapshot.smooth;

    const centerX = width / 2;
    const halfW = width / 2 - 30;
    const top = 25;
    const bottom = height - 30;
    const rowH = (bottom - top) / 10;

    const maxVol = Math.max(
      ...bid.map(Math.abs),
      ...ask.map(Math.abs),
      ...smooth.bid_vol.map(Math.abs),
      ...smooth.ask_vol.map(Math.abs),
      1e-6,
    );

    // Center axis
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(centerX, top);
    ctx.lineTo(centerX, bottom);
    ctx.stroke();

    // Level labels + raw bars
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    for (let i = 0; i < 10; i++) {
      const y = top + i * rowH + rowH / 2;
      const bidLen = (Math.abs(bid[i]) / maxVol) * halfW;
      const askLen = (Math.abs(ask[i]) / maxVol) * halfW;

      ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.fillRect(centerX - bidLen, y - rowH / 3, bidLen, rowH * 0.6);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.55)';
      ctx.fillRect(centerX, y - rowH / 3, askLen, rowH * 0.6);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.fillText(`L${i + 1}`, centerX, y + 3);
    }

    // Smooth B-spline curves (fine grid 1..10 → 50 points)
    const grid = smooth.grid;
    const pxFromLevel = (lvl) => top + ((lvl - 1) / 9) * (bottom - top);

    const drawCurve = (vals, color, side) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < grid.length; k++) {
        const y = pxFromLevel(grid[k]);
        const mag = (Math.abs(vals[k]) / maxVol) * halfW;
        const x = side === 'bid' ? centerX - mag : centerX + mag;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawCurve(smooth.bid_vol, 'rgba(248, 113, 113, 0.95)', 'bid');
    drawCurve(smooth.ask_vol, 'rgba(52, 211, 153, 0.95)', 'ask');

    // Header text
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('BID', 8, 16);
    ctx.textAlign = 'right';
    ctx.fillText('ASK', width - 8, 16);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.fillText(`snapshot #${snapshot.snapshot_idx}`, centerX, 16);
  }, [snapshot, height]);

  return (
    <div className="glass-panel panel-container">
      <h3 className="panel-title">Depth Profile — mirrored book + smooth B-spline</h3>
      <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
      {snapshot && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
            marginTop: '0.75rem',
            fontSize: '0.72rem',
          }}
        >
          <Stat label="Bid mass" value={snapshot.microstructure.bid_mass.toFixed(2)} />
          <Stat label="Ask mass" value={snapshot.microstructure.ask_mass.toFixed(2)} />
          <Stat label="Imbalance" value={snapshot.microstructure.total_imbalance.toFixed(3)} />
          <Stat label="Center thick" value={snapshot.microstructure.center_thickness.toFixed(2)} />
          <Stat label="Spread" value={snapshot.microstructure.spread_proxy.toFixed(4)} />
          <Stat label="Conv bid" value={snapshot.microstructure.depth_convexity_bid.toFixed(2)} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: '0.4rem 0.6rem',
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '6px',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
