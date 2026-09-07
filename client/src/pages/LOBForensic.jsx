import React, { useEffect, useState } from 'react';
import { LOBDepthProfile } from '../components/LOBDepthProfile';
import { LOBSnapshotComparison } from '../components/LOBSnapshotComparison';
import { LOBLabelAnalytics } from '../components/LOBLabelAnalytics';
import { LOBStats } from '../components/LOBStats';
import { apiUrl } from '../lib/runtimeConfig';

export function LOBForensic() {
  const [endIdx, setEndIdx] = useState(2000);
  const [refSize, setRefSize] = useState(300);
  const [testSize, setTestSize] = useState(30);
  const [windowDetail, setWindowDetail] = useState(null);
  const [preSnap, setPreSnap] = useState(null);
  const [postSnap, setPostSnap] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    Promise.all([
      fetch(apiUrl(`/api/lob/window/${endIdx}?ref_size=${refSize}&test_size=${testSize}`)).then((r) => r.json()),
    ]).then(([w]) => {
      setWindowDetail(w);
      if (w && w.ref_start != null) {
        const preMid = Math.floor((w.ref_start + w.ref_end) / 2);
        const postMid = Math.floor((w.test_start + w.test_end) / 2);
        Promise.all([
          fetch(apiUrl(`/api/lob/snapshot/${preMid}`)).then((r) => r.json()),
          fetch(apiUrl(`/api/lob/snapshot/${postMid}`)).then((r) => r.json()),
        ]).then(([a, b]) => {
          setPreSnap(a);
          setPostSnap(b);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            LOB Snapshot Forensic
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
            Drill a single ref-vs-test window — inspect pre/post depth, label drift (KL), latent mean shift
          </p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem 0.8rem' }}>
          <NumField label="End idx" value={endIdx} set={setEndIdx} min={1} max={40000} />
          <NumField label="Ref" value={refSize} set={setRefSize} min={50} max={2000} />
          <NumField label="Test" value={testSize} set={setTestSize} min={5} max={200} />
          <button
            onClick={run}
            disabled={loading}
            style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 700 }}
          >
            {loading ? 'Running…' : '▶ Analyze'}
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <LOBDepthProfile snapshot={preSnap} />
        <LOBDepthProfile snapshot={postSnap} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(520px, 1.3fr) minmax(340px, 1fr)',
          gap: '1.5rem',
          marginBottom: '1.5rem',
          alignItems: 'start',
        }}
      >
        <LOBSnapshotComparison windowDetail={windowDetail} />
        <LOBStats windowDetail={windowDetail} />
      </div>

      <LOBLabelAnalytics windowDetail={windowDetail} />
    </div>
  );
}

function NumField({ label, value, set, min, max }) {
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
          if (!isNaN(v)) set(v);
        }}
        style={{ width: 85, padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
      />
    </div>
  );
}
