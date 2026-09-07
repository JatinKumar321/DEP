import React, { useState, useEffect } from 'react'
import { LiveMarketChart } from '../components/LiveMarketChart'
import { FDAStats } from '../components/FDAStats'
import { HilbertManifold } from '../components/HilbertManifold'
import { RegimeTimeline } from '../components/RegimeTimeline'
import { FunctionalCurve } from '../components/FunctionalCurve'
import { apiUrl } from '../lib/runtimeConfig'

export function OnlineMonitor() {
  const [currentDay, setCurrentDay] = useState(302);
  const [isAcademicMode, setIsAcademicMode] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState(null);
  const [windowDetail, setWindowDetail] = useState(null);
  const [loadingWindow, setLoadingWindow] = useState(false);

  // Fetch window detail when standard Drill is clicked or Timeline window is selected
  const fetchWindowDetails = (startDay) => {
    setLoadingWindow(true);
    fetch(apiUrl(`/api/regime/window/${startDay}`))
      .then(res => res.json())
      .then(json => {
        setWindowDetail(json);
        setLoadingWindow(false);
      })
      .catch(err => {
        console.error("Window detail fetch failed:", err);
        setLoadingWindow(false);
      });
  };

  useEffect(() => {
    if (selectedWindow !== null) {
      fetchWindowDetails(selectedWindow);
    }
  }, [selectedWindow]);

  const handleWindowSelect = (startDay) => {
    setSelectedWindow(startDay);
    setCurrentDay(startDay);
  };

  const startAnalysis = () => {
    setSelectedWindow(currentDay);
  };

  // Manifold data
  const manifoldRefScores = windowDetail?.ref_scores || [];
  const manifoldTestScores = windowDetail?.test_scores || [];
  const isRegimeShift = windowDetail ? (windowDetail.f_p_value < 0.01) : false;
  const fStat = windowDetail?.f_stat || 0;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '2rem' }}>Online Regime Monitor</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
            {isAcademicMode 
              ? 'Sliding Window fANOVA: P_ref(L=50) vs P_test(K=5) in FPCA Score Space' 
              : 'Persistent Regime Shift Detection via Functional Population Distance'}
          </p>
        </div>
        
        <div className="glass-panel" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.6rem 0.8rem', borderRadius: 'var(--border-radius-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '0.5rem', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Prof</label>
            <input type="checkbox" checked={isAcademicMode} onChange={(e) => setIsAcademicMode(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--accent-color)', width: '16px', height: '16px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Test Day</label>
            <input type="number" className="input-style" style={{ width: '65px', padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}
              value={currentDay} onChange={(e) => setCurrentDay(parseInt(e.target.value) || 302)} min={55} max={1253} />
          </div>
          <button onClick={startAnalysis} disabled={loadingWindow}
            style={{ height: 'max-content', alignSelf: 'flex-end', padding: '0.5rem 1rem', fontWeight: 'bold', fontSize: '0.8rem' }}>
            {loadingWindow ? '⏳ Matrix Calc...' : '▶ Drill Window'}
          </button>
        </div>
      </header>

      {/* Macro Regime Timeline */}
      <RegimeTimeline onWindowSelect={handleWindowSelect} selectedWindow={selectedWindow} />

      {/* Main Content Grid */}
      <main style={{ display: 'grid', gridTemplateColumns: 'minmax(550px, 2fr) minmax(340px, 1fr)', gap: '1.5rem', marginTop: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <LiveMarketChart windowDetail={windowDetail} isAcademicMode={isAcademicMode} />
          <FunctionalCurve day={windowDetail?.window_end ?? null} />
          <HilbertManifold refScores={manifoldRefScores} testScores={manifoldTestScores} isRegimeShift={isRegimeShift} fStat={fStat} />
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <FDAStats windowDetail={windowDetail} isAcademicMode={isAcademicMode} />
        </div>
      </main>
    </div>
  )
}
