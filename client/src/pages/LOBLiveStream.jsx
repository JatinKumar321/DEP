import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, Gauge, Radio, Square, RotateCcw, AlertOctagon } from 'lucide-react';
import { LiveDepthBook } from '../components/LiveDepthBook';
import { LiveAlarmGauge } from '../components/LiveAlarmGauge';
import { LiveTickerSparkline } from '../components/LiveTickerSparkline';
import { LiveAlertLog } from '../components/LiveAlertLog';
import { wsUrl } from '../lib/runtimeConfig';
const HISTORY = 240;  // keep last 240 ticks for sparklines

/**
 * LOB Live Stream — industry-style trading-terminal UI.
 *
 * Connects to /ws/lob/stream which replays the LOB dataset at a configurable
 * speed, computes a rolling-reference Hotelling T² alarm, and packages a full
 * depth + flow snapshot per tick.
 *
 * The page renders:
 *   - control bar (start/stop, speed, start_idx)
 *   - ticker (best bid / ask / spread / mid / current snapshot index)
 *   - alarm gauge with χ² thresholds
 *   - live depth book (10 levels each side)
 *   - rolling sparklines for OFI, signed flow, joint, alarm
 *   - alert log (consecutive warning/critical bursts)
 */
export function LOBLiveStream() {
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(null);
  const [history, setHistory] = useState([]); // recent packets
  const [alerts, setAlerts] = useState([]);   // [{start, end, severity, peak, duration, spread}]
  const [speed, setSpeed] = useState(15);
  const [startIdx, setStartIdx] = useState(400);
  const [refSize, setRefSize] = useState(300);
  const [statusText, setStatusText] = useState('idle');
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const currentAlertRef = useRef(null);  // tracking the in-progress alert burst

  // ── WebSocket lifecycle ───────────────────────────────
  const connect = useCallback(() => {
    setError(null);
    setStatusText('connecting…');
    const url = wsUrl(`/ws/lob/stream?start_idx=${startIdx}&speed=${speed}&ref_size=${refSize}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatusText('streaming');
      setRunning(true);
    };
    ws.onclose = () => {
      setStatusText('disconnected');
      setRunning(false);
      finalizeAlert();
    };
    ws.onerror = () => {
      setError('WebSocket error — check that the backend URL is reachable and WebSockets are enabled.');
      setStatusText('error');
      setRunning(false);
    };
    ws.onmessage = (evt) => {
      let p;
      try { p = JSON.parse(evt.data); } catch { return; }
      if (p?.type === 'error') {
        setError(p.message || 'unknown error');
        return;
      }
      if (p?.type !== 'tick') return;

      setTick(p);
      setHistory((h) => {
        const next = h.length >= HISTORY ? h.slice(1) : h.slice();
        next.push(p);
        return next;
      });
      handleAlertTracking(p);
    };
  }, [startIdx, speed, refSize]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    setRunning(false);
    finalizeAlert();
  }, []);

  const restart = useCallback(() => {
    disconnect();
    setHistory([]);
    setAlerts([]);
    setTick(null);
    currentAlertRef.current = null;
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // Keep latest connect/disconnect available across renders
  useEffect(() => () => {
    if (wsRef.current) try { wsRef.current.close(); } catch {}
  }, []);

  // ── Alert tracking ────────────────────────────────────
  function handleAlertTracking(p) {
    const isAbnormal = p.severity === 'warning' || p.severity === 'critical';
    if (isAbnormal) {
      if (!currentAlertRef.current) {
        currentAlertRef.current = {
          start: p.idx, end: p.idx, severity: p.severity, peak: p.alarm,
          duration: 1, spread: p.spread,
        };
      } else {
        currentAlertRef.current.end = p.idx;
        currentAlertRef.current.duration += 1;
        if (p.alarm > currentAlertRef.current.peak) {
          currentAlertRef.current.peak = p.alarm;
          currentAlertRef.current.spread = p.spread;
        }
        if (p.severity === 'critical') currentAlertRef.current.severity = 'critical';
      }
    } else if (currentAlertRef.current) {
      finalizeAlert();
    }
  }

  function finalizeAlert() {
    if (currentAlertRef.current) {
      const a = currentAlertRef.current;
      currentAlertRef.current = null;
      setAlerts((prev) => {
        // ignore single-tick blips (require ≥ 2 consec ticks for log entry)
        if (a.duration < 2) return prev;
        const next = prev.length >= 50 ? prev.slice(1) : prev.slice();
        next.push(a);
        return next;
      });
    }
  }

  // ── Derived series for sparklines ─────────────────────
  const series = useMemo(() => {
    const map = (k) => history.map((h) => ({ idx: h.idx, value: h[k] }));
    return {
      alarm: map('alarm'),
      ofi: map('ofi'),
      signed_flow: map('signed_flow'),
      joint: map('joint'),
      activity: map('activity'),
      mid: history.map((h) => ({ idx: h.idx, value: (h.best_bid + h.best_ask) / 2 })),
      spread: map('spread'),
      imbalance: map('imbalance'),
    };
  }, [history]);

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1700, margin: '0 auto' }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.2rem',
      }}>
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Radio size={26} /> Live LOB Stream
            <span
              style={{
                marginLeft: '0.6rem',
                fontSize: '0.65rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 999,
                background: running ? 'rgba(16,185,129,0.18)' : 'rgba(148,163,184,0.18)',
                color: running ? '#10b981' : 'var(--text-secondary)',
                border: `1px solid ${running ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.4)'}`,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
              }}
            >
              {running && <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: '#10b981', marginRight: 6, animation: 'pulse 1.6s infinite',
              }} />}
              {statusText}
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
            Online change-point detection over a rolling reference window · Mahalanobis² vs. χ²
            thresholds · industry-style depth ladder, alarm gauge & alert log
          </p>
        </div>

        <ControlBar
          running={running}
          onStart={connect}
          onStop={disconnect}
          onRestart={restart}
          speed={speed}
          setSpeed={setSpeed}
          startIdx={startIdx}
          setStartIdx={setStartIdx}
          refSize={refSize}
          setRefSize={setRefSize}
        />
      </header>

      {error && (
        <div
          className="glass-panel panel-container"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', padding: '0.7rem 1rem', marginBottom: '1rem',
          }}
        >
          <AlertOctagon size={16} /> {error}
        </div>
      )}

      {/* ─── Top ticker strip ─── */}
      <TickerStrip tick={tick} />

      {/* ─── Main grid: book | alarm + sparklines | alert log ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 380px) minmax(320px, 1fr) minmax(280px, 360px)',
        gap: '1rem',
        marginTop: '1rem',
        alignItems: 'start',
      }}>
        <LiveDepthBook tick={tick} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <LiveAlarmGauge tick={tick} idx={tick?.idx} />

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.7rem',
          }}>
            <LiveTickerSparkline
              data={series.alarm}
              color="#60a5fa"
              label="T² alarm"
              format={(v) => v.toFixed(2)}
              threshold={tick?.threshold_warn}
              threshold2={tick?.threshold_crit}
              currentValue={tick?.alarm}
            />
            <LiveTickerSparkline
              data={series.ofi}
              color="#a78bfa"
              label="OFI"
              format={(v) => v.toFixed(1)}
              currentValue={tick?.ofi}
              zeroLine
              invertColor
            />
            <LiveTickerSparkline
              data={series.signed_flow}
              color="#f59e0b"
              label="signed flow"
              format={(v) => v.toFixed(3)}
              currentValue={tick?.signed_flow}
              zeroLine
              invertColor
            />
            <LiveTickerSparkline
              data={series.joint}
              color="#f87171"
              label="joint"
              format={(v) => v.toFixed(3)}
              currentValue={tick?.joint}
            />
            <LiveTickerSparkline
              data={series.mid}
              color="#10b981"
              label="mid price"
              format={(v) => v.toFixed(4)}
              currentValue={tick ? (tick.best_bid + tick.best_ask) / 2 : null}
            />
            <LiveTickerSparkline
              data={series.imbalance}
              color="#22d3ee"
              label="imbalance"
              format={(v) => v.toFixed(3)}
              currentValue={tick?.imbalance}
              zeroLine
              invertColor
            />
          </div>
        </div>

        <LiveAlertLog alerts={alerts} />
      </div>

      {/* ─── Critical-alert banner (full-width pulse) ─── */}
      {tick?.severity === 'critical' && <CriticalBanner tick={tick} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════

function ControlBar({
  running, onStart, onStop, onRestart, speed, setSpeed,
  startIdx, setStartIdx, refSize, setRefSize,
}) {
  return (
    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.8rem', flexWrap: 'wrap' }}>
      <button
        onClick={running ? onStop : onStart}
        style={{
          background: running ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)',
          border: `1px solid ${running ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
          color: running ? '#f87171' : '#10b981',
          padding: '0.4rem 0.8rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        {running ? <><Pause size={14} /> Stop</> : <><Play size={14} /> Start</>}
      </button>
      <button
        onClick={onRestart}
        style={{
          background: 'rgba(59,130,246,0.18)',
          border: '1px solid rgba(59,130,246,0.4)',
          color: '#60a5fa',
          padding: '0.4rem 0.8rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <RotateCcw size={14} /> Restart
      </button>
      <CtrlField label="Start idx" value={startIdx} setValue={setStartIdx} min={300} max={40000} />
      <CtrlField label="Speed (t/s)" value={speed} setValue={setSpeed} min={1} max={200} />
      <CtrlField label="Ref size" value={refSize} setValue={setRefSize} min={50} max={2000} />
    </div>
  );
}

function CtrlField({ label, value, setValue, min, max }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type="number"
        className="input-style"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) setValue(v);
        }}
        style={{ width: 90, padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
      />
    </div>
  );
}

function TickerStrip({ tick }) {
  const cells = [
    { label: 'Snapshot', value: tick ? `#${tick.idx}` : '—', color: 'var(--text-primary)' },
    { label: 'Best Bid', value: tick ? tick.best_bid.toFixed(4) : '—', color: '#10b981' },
    { label: 'Best Ask', value: tick ? tick.best_ask.toFixed(4) : '—', color: '#ef4444' },
    { label: 'Spread', value: tick ? tick.spread.toFixed(4) : '—', color: '#60a5fa' },
    { label: 'Mid', value: tick ? ((tick.best_bid + tick.best_ask) / 2).toFixed(4) : '—', color: 'var(--text-primary)' },
    { label: 'Bid Mass', value: tick ? tick.bid_mass.toFixed(2) : '—', color: '#10b981' },
    { label: 'Ask Mass', value: tick ? tick.ask_mass.toFixed(2) : '—', color: '#ef4444' },
    { label: 'Imbalance', value: tick ? tick.imbalance.toFixed(3) : '—', color: tick && tick.imbalance >= 0 ? '#10b981' : '#ef4444' },
    { label: 'OFI', value: tick ? tick.ofi.toFixed(1) : '—', color: tick && tick.ofi >= 0 ? '#10b981' : '#ef4444' },
    { label: 'Severity', value: (tick?.severity ?? '—').toUpperCase(),
      color: tick?.severity === 'critical' ? '#ef4444' : tick?.severity === 'warning' ? '#f59e0b' : '#10b981' },
  ];

  return (
    <div className="glass-panel" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
      gap: '0.5rem',
      padding: '0.7rem 0.9rem',
    }}>
      {cells.map((c) => (
        <div key={c.label} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          borderRight: '1px solid rgba(255,255,255,0.04)',
          paddingRight: '0.6rem',
          minWidth: 0,
        }}>
          <span style={{
            fontSize: '0.6rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {c.label}
          </span>
          <span style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: c.color,
            fontFamily: 'Menlo, monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}>
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CriticalBanner({ tick }) {
  return (
    <div
      className="pulse-animation"
      style={{
        marginTop: '1rem',
        background: 'linear-gradient(90deg, rgba(239,68,68,0.18), rgba(239,68,68,0.05) 40%, rgba(239,68,68,0.18))',
        border: '1px solid rgba(239,68,68,0.4)',
        borderRadius: 'var(--border-radius-md)',
        padding: '0.85rem 1.1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        color: '#fecaca',
        fontWeight: 500,
      }}
    >
      <Gauge size={20} color="#ef4444" />
      <div style={{ flex: 1 }}>
        <strong style={{ color: '#fca5a5' }}>CRITICAL REGIME SHIFT</strong> — Mahalanobis² ={' '}
        <span style={{ color: '#fff', fontFamily: 'Menlo, monospace' }}>{tick.alarm.toFixed(2)}</span>{' '}
        exceeds χ²(p, 0.999) = {tick.threshold_crit.toFixed(2)}
        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.6rem', fontSize: '0.85rem' }}>
          tick #{tick.idx} · spread {tick.spread.toFixed(4)} · imbalance {tick.imbalance.toFixed(3)}
        </span>
      </div>
      <Square size={10} fill="#ef4444" color="#ef4444" />
    </div>
  );
}
