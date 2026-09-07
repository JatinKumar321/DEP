import React, { useEffect, useState } from 'react';
import { LOBRegimeTimeline } from '../components/LOBRegimeTimeline';
import { LOBAlarmPanel } from '../components/LOBAlarmPanel';
import { LOBImbalanceHeatmap } from '../components/LOBImbalanceHeatmap';
import { LOBDepthProfile } from '../components/LOBDepthProfile';
import { LOBStats } from '../components/LOBStats';
import { apiUrl } from '../lib/runtimeConfig';

export function LOBOverview() {
  const [scan, setScan] = useState(null);
  const [selected, setSelected] = useState(1500);
  const [snapshot, setSnapshot] = useState(null);
  const [windowDetail, setWindowDetail] = useState(null);
  const [refSize, setRefSize] = useState(300);
  const [testSize, setTestSize] = useState(30);
  const [minConsec, setMinConsec] = useState(2);
  const [minMaha, setMinMaha] = useState(3.0);
  const [loadingScan, setLoadingScan] = useState(true);

  useEffect(() => {
    setLoadingScan(true);
    setScan(null);
    fetch(apiUrl(`/api/lob/scan?ref_size=${refSize}&test_size=${testSize}&alpha=0.01&min_consecutive=${minConsec}&min_mahalanobis=${minMaha}`))
      .then((r) => r.json())
      .then((j) => {
        setScan(j);
        setLoadingScan(false);
      })
      .catch((err) => {
        console.error('LOB scan fetch failed', err);
        setLoadingScan(false);
      });
  }, [refSize, testSize, minConsec, minMaha]);

  useEffect(() => {
    // Hard-guard against NaN/null/out-of-range — backend rejects with 422
    // and the components were crashing on the error response.
    if (selected == null || !Number.isFinite(selected) || selected < 0) return;
    const max = scan?.total_snapshots ?? 40000;
    if (selected >= max) return;

    let aborted = false;
    const safeJson = (r) => (r.ok ? r.json() : Promise.resolve(null));

    fetch(apiUrl(`/api/lob/snapshot/${selected}?ref_size=${refSize}`))
      .then(safeJson)
      .then((j) => { if (!aborted && j && !j.error) setSnapshot(j); })
      .catch(() => {});
    fetch(apiUrl(`/api/lob/window/${selected}?ref_size=${refSize}&test_size=${testSize}`))
      .then(safeJson)
      .then((j) => { if (!aborted && j && !j.error) setWindowDetail(j); })
      .catch(() => {});

    return () => { aborted = true; };
  }, [selected, refSize, testSize, scan?.total_snapshots]);

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
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '2rem' }}>
            Limit Order Book Monitor
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
            5-channel functional representation of 10-level depth · per-channel B-spline + PCA · Hotelling
            T² change-point detection
          </p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', gap: '0.7rem', padding: '0.6rem 0.8rem' }}>
          <Field label="Ref" value={refSize} setValue={setRefSize} min={50} max={2000} />
          <Field label="Test" value={testSize} setValue={setTestSize} min={5} max={200} />
          <Field label="Min d_M" value={minMaha} setValue={setMinMaha} min={1} max={10} step={0.5} />
          <Field label="Min consec" value={minConsec} setValue={setMinConsec} min={1} max={10} />
          <Field label="Snapshot" value={selected} setValue={setSelected} min={0} max={scan?.total_snapshots || 40000} />
        </div>
      </header>

      {loadingScan && (
        <div
          className="glass-panel panel-container"
          style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', marginBottom: '1rem' }}
        >
          Loading scan — first request triggers embedder fit + full-dataset transform (a few seconds)…
        </div>
      )}

      <LOBRegimeTimeline scan={scan} selectedSnapshot={selected} onSnapshotSelect={setSelected} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        <LOBAlarmPanel scan={scan} selectedSnapshot={selected} onSnapshotSelect={setSelected} />
        <LOBImbalanceHeatmap
          totalSnapshots={scan?.total_snapshots}
          onSnapshotSelect={setSelected}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(460px, 1.4fr) minmax(340px, 1fr)',
          gap: '1.5rem',
          marginTop: '1.5rem',
          alignItems: 'start',
        }}
      >
        <LOBDepthProfile snapshot={snapshot} />
        <LOBStats windowDetail={windowDetail} />
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
        style={{ width: 85, padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
      />
    </div>
  );
}
