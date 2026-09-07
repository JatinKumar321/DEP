import React, { useEffect, useMemo, useState } from 'react';
import { OrderFlowChart } from '../components/OrderFlowChart';
import { OrderFlowSummary } from '../components/OrderFlowSummary';
import { OrderFlowFPCA } from '../components/OrderFlowFPCA';
import { Waves, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/runtimeConfig';

/**
 * Order-flow analytics dashboard.
 *
 * Pulls full-series order flow (downsampled with stride) and a centered
 * window around the user's selected snapshot for high-resolution detail.
 * Plus the FPCA latent embedding so we get a flow-only regime view that
 * complements the depth-based LOBEmbedder.
 */
export function LOBOrderFlow() {
  const [series, setSeries] = useState(null);    // full-series, strided
  const [windowDetail, setWindowDetail] = useState(null);
  const [fpca, setFpca] = useState(null);
  const [center, setCenter] = useState(2000);
  const [halfwindow, setHalfwindow] = useState(150);
  const [stride, setStride] = useState(20);
  const [smoothSigma, setSmoothSigma] = useState(4.0);
  const [flowWindow, setFlowWindow] = useState(50);
  const [fpcaWin, setFpcaWin] = useState(200);
  const [fpcaStride, setFpcaStride] = useState(50);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [loadingFpca, setLoadingFpca] = useState(true);

  // ── Full-series order-flow (downsampled) ──────────────
  useEffect(() => {
    let aborted = false;
    setLoadingSeries(true);
    fetch(apiUrl(`/api/lob/orderflow?stride=${stride}&smooth_sigma=${smoothSigma}&flow_window=${flowWindow}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!aborted && j && !j.error) setSeries(j);
        if (!aborted) setLoadingSeries(false);
      })
      .catch(() => { if (!aborted) setLoadingSeries(false); });
    return () => { aborted = true; };
  }, [stride, smoothSigma, flowWindow]);

  // ── FPCA latent ──────────────
  useEffect(() => {
    let aborted = false;
    setLoadingFpca(true);
    fetch(apiUrl(`/api/lob/orderflow/fpca?window_size=${fpcaWin}&stride=${fpcaStride}&n_components=3&smooth_sigma=${smoothSigma}&flow_window=${flowWindow}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!aborted && j && !j.error) setFpca(j);
        if (!aborted) setLoadingFpca(false);
      })
      .catch(() => { if (!aborted) setLoadingFpca(false); });
    return () => { aborted = true; };
  }, [fpcaWin, fpcaStride, smoothSigma, flowWindow]);

  // ── Centered detail window ──────────────
  useEffect(() => {
    if (!Number.isFinite(center) || center < 0) return;
    let aborted = false;
    fetch(apiUrl(`/api/lob/orderflow/window?center=${center}&halfwindow=${halfwindow}&smooth_sigma=${smoothSigma}&flow_window=${flowWindow}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!aborted && j && !j.error) setWindowDetail(j); })
      .catch(() => {});
    return () => { aborted = true; };
  }, [center, halfwindow, smoothSigma, flowWindow]);

  // ── Adapt full-series response to chart shape ──────────────
  const fullChart = useMemo(() => {
    if (!series?.snapshot_indices) return [];
    return series.snapshot_indices.map((idx, i) => ({
      idx,
      ofi: series.ofi[i],
      activity: series.activity[i],
      signed_flow: series.signed_flow[i],
      buy_intensity: series.buy_intensity[i],
      sell_intensity: -Math.abs(series.sell_intensity[i]),  // mirror sell so we get a divergent chart
      joint: series.joint[i],
    }));
  }, [series]);

  const windowChart = useMemo(() => {
    if (!windowDetail?.snapshot_indices) return [];
    return windowDetail.snapshot_indices.map((idx, i) => ({
      idx,
      ofi: windowDetail.ofi[i],
      activity: windowDetail.activity[i],
      signed_flow: windowDetail.signed_flow[i],
      buy_intensity: windowDetail.buy_intensity[i],
      sell_intensity: -Math.abs(windowDetail.sell_intensity[i]),
      joint: windowDetail.joint[i],
    }));
  }, [windowDetail]);

  const totalSnapshots = (series?.snapshot_indices?.length || 0) * Math.max(stride, 1);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Waves size={26} /> Order Flow Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
            Cont–Kukanov–Stoikov multi-level OFI from snapshot deltas · Gaussian-smoothed
            intensity · joint informed-trading proxy · FPCA on stacked flow signals
          </p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', gap: '0.7rem', padding: '0.6rem 0.8rem', flexWrap: 'wrap' }}>
          <Field label="Center" value={center} setValue={setCenter} min={0} max={Math.max(totalSnapshots, 40000)} />
          <Field label="Half-win" value={halfwindow} setValue={setHalfwindow} min={20} max={1000} />
          <Field label="Stride" value={stride} setValue={setStride} min={1} max={200} />
          <Field label="σ smooth" value={smoothSigma} setValue={setSmoothSigma} min={0.5} max={20} step={0.5} />
          <Field label="Flow win" value={flowWindow} setValue={setFlowWindow} min={5} max={500} />
        </div>
      </header>

      {(loadingSeries || loadingFpca) && (
        <div
          className="glass-panel panel-container"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            color: 'var(--text-secondary)', padding: '1rem', marginBottom: '1rem',
          }}
        >
          <RefreshCw size={14} className="pulse-animation" />
          {loadingSeries && <span>Loading order-flow series…</span>}
          {loadingFpca && <span style={{ opacity: 0.7 }}>· FPCA…</span>}
        </div>
      )}

      {/* ─── Full-series strip ─── */}
      <OrderFlowChart
        title="OFI · Full Series (multi-level Cont–Kukanov–Stoikov)"
        subtitle={`stride ${stride} · click to focus`}
        data={fullChart}
        height={180}
        zeroLine
        onSelect={setCenter}
        series={[
          { key: 'ofi', name: 'OFI(t)', color: '#60a5fa', strokeWidth: 1.2 },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        <OrderFlowChart
          title="Activity · book turnover"
          data={fullChart}
          height={170}
          onSelect={setCenter}
          series={[
            { key: 'activity', name: 'activity(t)', color: '#a78bfa', type: 'area', fillOpacity: 0.25 },
          ]}
        />
        <OrderFlowChart
          title="Signed Flow · rolling-normalized"
          subtitle={`window ${flowWindow}`}
          data={fullChart}
          height={170}
          zeroLine
          onSelect={setCenter}
          series={[
            { key: 'signed_flow', name: 'S(t)', color: '#f59e0b', type: 'area', fillOpacity: 0.2 },
          ]}
        />
      </div>

      {/* ─── Centered detail window ─── */}
      <div style={{ marginTop: '1.2rem' }}>
        <OrderFlowSummary summary={windowDetail?.summary} center={windowDetail?.center} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        <OrderFlowChart
          title="Detail window — OFI"
          subtitle={windowDetail ? `[${windowDetail.start}, ${windowDetail.end}]` : ''}
          data={windowChart}
          height={210}
          zeroLine
          series={[
            { key: 'ofi', name: 'OFI(t)', color: '#60a5fa', strokeWidth: 1.6 },
            { key: 'signed_flow', name: 'S(t)', color: '#f59e0b', strokeWidth: 1.2 },
          ]}
        />
        <OrderFlowChart
          title="Detail window — buy / sell intensity"
          subtitle="sell mirrored below 0"
          data={windowChart}
          height={210}
          zeroLine
          series={[
            { key: 'buy_intensity', name: 'buy intensity', color: '#10b981', type: 'area', fillOpacity: 0.25 },
            { key: 'sell_intensity', name: 'sell intensity', color: '#ef4444', type: 'area', fillOpacity: 0.25 },
          ]}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <OrderFlowChart
          title="Joint feature · activity × |imbalance| (informed-trading proxy)"
          subtitle="high values = many ticks, one-sided — classic informed-flow signature"
          data={windowChart}
          height={200}
          series={[
            { key: 'joint', name: 'joint(t)', color: '#f87171', type: 'area', fillOpacity: 0.3, strokeWidth: 1.5 },
            { key: 'activity', name: 'activity (ref)', color: 'rgba(167, 139, 250, 0.5)', strokeWidth: 0.8 },
          ]}
        />
      </div>

      {/* ─── FPCA latent ─── */}
      <div style={{ marginTop: '1.2rem', display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <FieldInline label="FPCA window" value={fpcaWin} setValue={setFpcaWin} min={50} max={1000} step={50} />
          <FieldInline label="FPCA stride" value={fpcaStride} setValue={setFpcaStride} min={10} max={500} step={10} />
        </div>
        <OrderFlowFPCA fpca={fpca} onSelect={setCenter} />
      </div>
    </div>
  );
}

function Field({ label, value, setValue, min, max, step }) {
  const isFloat = step && step < 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type="number"
        className="input-style"
        value={value}
        min={min}
        max={max}
        step={step || 1}
        onChange={(e) => {
          const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          if (!isNaN(v)) setValue(v);
        }}
        style={{ width: 90, padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
      />
    </div>
  );
}

function FieldInline({ label, value, setValue, min, max, step }) {
  return (
    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.7rem' }}>
      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type="number"
        className="input-style"
        value={value}
        min={min}
        max={max}
        step={step || 1}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) setValue(v);
        }}
        style={{ width: 80, padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
      />
    </div>
  );
}
