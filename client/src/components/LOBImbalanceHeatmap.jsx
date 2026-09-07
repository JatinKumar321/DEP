import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/runtimeConfig';

/**
 * Time × level heatmap of level-wise imbalance (channel 4). x axis is
 * snapshot index (strided), y axis is level 1..10, color maps [-1, 1].
 */
export function LOBImbalanceHeatmap({ totalSnapshots, onSnapshotSelect }) {
  const canvasRef = useRef(null);
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!totalSnapshots) return;
    setLoading(true);
    const stride = Math.max(1, Math.floor(totalSnapshots / 900));
    fetch(apiUrl(`/api/lob/imbalance_grid?stride=${stride}`))
      .then((r) => r.json())
      .then((j) => {
        setGrid(j);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [totalSnapshots]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const mat = grid.imbalance_matrix; // (nSub, 10)
    const nSub = mat.length;
    if (!nSub) return;

    const cellW = W / nSub;
    const cellH = (H - 16) / 10;

    for (let i = 0; i < nSub; i++) {
      const row = mat[i];
      for (let l = 0; l < 10; l++) {
        const v = row[l]; // already in [-1, 1]
        ctx.fillStyle = imbalanceColor(v);
        ctx.fillRect(i * cellW, 16 + l * cellH, Math.max(1, cellW + 0.5), cellH);
      }
    }

    // Y axis labels
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '9px Inter';
    ctx.textAlign = 'right';
    for (let l = 0; l < 10; l++) {
      ctx.fillText(`L${l + 1}`, W - 4, 16 + l * cellH + cellH / 2 + 3);
    }

    // Header
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(
      `bid-biased ← imbalance → ask-biased   (stride=${grid.snapshot_indices[1] - grid.snapshot_indices[0] || 1})`,
      4,
      12,
    );
  }, [grid]);

  const handleClick = (e) => {
    if (!grid || !onSnapshotSelect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(grid.snapshot_indices.length - 1, Math.floor(frac * grid.snapshot_indices.length));
    onSnapshotSelect(grid.snapshot_indices[idx]);
  };

  return (
    <div className="glass-panel panel-container">
      <h3 className="panel-title">Imbalance Heatmap — level × time</h3>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ width: '100%', height: 220, cursor: 'pointer', display: 'block' }}
      />
      {loading && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>loading grid…</div>}
    </div>
  );
}

function imbalanceColor(v) {
  // Symmetric diverging colormap: red (negative, bid-heavy) → neutral → green (positive, ask-heavy).
  const x = Math.max(-1, Math.min(1, v));
  if (x < 0) {
    const a = Math.min(1, -x);
    return `rgba(239, 68, 68, ${0.2 + 0.75 * a})`;
  }
  const a = Math.min(1, x);
  return `rgba(52, 211, 153, ${0.2 + 0.75 * a})`;
}
