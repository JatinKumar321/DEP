import React from 'react';

/**
 * Live order-book ladder. Two stacked tables (asks descending, bids descending)
 * with depth bars proportional to volume. Mid-spread highlighted.
 *
 * Props:
 *   tick: { bid_price[], bid_vol[], ask_price[], ask_vol[], best_bid, best_ask, spread }
 */
export function LiveDepthBook({ tick }) {
  if (!tick || !tick.bid_price) {
    return (
      <div className="glass-panel panel-container">
        <h3 className="panel-title">Order Book — Top 10</h3>
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
          Waiting for stream…
        </div>
      </div>
    );
  }

  const maxVol = Math.max(
    ...tick.bid_vol.slice(0, 10),
    ...tick.ask_vol.slice(0, 10),
    1,
  );

  const asks = [];
  for (let i = 9; i >= 0; i--) {
    asks.push({
      price: tick.ask_price[i],
      vol: tick.ask_vol[i],
      level: i + 1,
    });
  }
  const bids = [];
  for (let i = 0; i < 10; i++) {
    bids.push({
      price: tick.bid_price[i],
      vol: tick.bid_vol[i],
      level: i + 1,
    });
  }

  const fmtPx = (p) => Number.isFinite(p) ? p.toFixed(4) : '—';
  const fmtVol = (v) => Number.isFinite(v) ? v.toFixed(2) : '—';

  return (
    <div className="glass-panel panel-container" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>Order Book — Top 10</h3>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          spread {tick.spread != null ? tick.spread.toFixed(4) : '—'}
        </div>
      </div>

      <BookHeader />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontFamily: 'Menlo, monospace' }}>
        {asks.map((row, i) => (
          <BookRow key={`a${i}`} side="ask" row={row} maxVol={maxVol} fmtPx={fmtPx} fmtVol={fmtVol} />
        ))}
        <MidSpread tick={tick} />
        {bids.map((row, i) => (
          <BookRow key={`b${i}`} side="bid" row={row} maxVol={maxVol} fmtPx={fmtPx} fmtVol={fmtVol} />
        ))}
      </div>
    </div>
  );
}

function BookHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '46px 1fr 90px',
        fontSize: '0.62rem',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '0.4rem 0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        marginBottom: '0.3rem',
      }}
    >
      <div>Lvl</div>
      <div style={{ textAlign: 'right' }}>Price</div>
      <div style={{ textAlign: 'right' }}>Size</div>
    </div>
  );
}

function BookRow({ side, row, maxVol, fmtPx, fmtVol }) {
  const ratio = Math.min(1, (row.vol || 0) / maxVol);
  const color = side === 'ask' ? '#ef4444' : '#10b981';
  const bg = side === 'ask' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)';

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '46px 1fr 90px',
        padding: '0.25rem 0.5rem',
        fontSize: '0.78rem',
        background: 'rgba(255,255,255,0.015)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          [side === 'ask' ? 'left' : 'right']: 0,
          height: '100%',
          width: `${ratio * 100}%`,
          background: bg,
          transition: 'width 0.15s ease',
        }}
      />
      <div style={{ position: 'relative', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
        L{row.level}
      </div>
      <div style={{ position: 'relative', textAlign: 'right', color: color, fontWeight: 600 }}>
        {fmtPx(row.price)}
      </div>
      <div style={{ position: 'relative', textAlign: 'right', color: 'var(--text-primary)' }}>
        {fmtVol(row.vol)}
      </div>
    </div>
  );
}

function MidSpread({ tick }) {
  return (
    <div
      style={{
        margin: '0.4rem 0',
        padding: '0.45rem 0.5rem',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.18)',
        borderRadius: 6,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'Menlo, monospace',
      }}
    >
      <span>mid</span>
      <span style={{ color: '#60a5fa', fontWeight: 600 }}>
        {((tick.best_bid + tick.best_ask) / 2).toFixed(4)}
      </span>
      <span>Δ {tick.spread != null ? tick.spread.toFixed(4) : '—'}</span>
    </div>
  );
}
