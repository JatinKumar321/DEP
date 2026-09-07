import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, FileText, BookOpen, Target, Waves, Radio } from 'lucide-react';
import { backendLabel } from '../lib/runtimeConfig';

export function SidebarLayout() {
  const sections = [
    {
      title: 'SP500 (390-min curves)',
      items: [
        { path: '/', label: 'Online Monitor', icon: Activity },
        { path: '/forensic', label: 'Forensic Event View', icon: FileText },
      ],
    },
    {
      title: 'LOB (10-level depth)',
      items: [
        { path: '/lob', label: 'Book Overview', icon: BookOpen },
        { path: '/lob/orderflow', label: 'Order Flow', icon: Waves },
        { path: '/lob/forensic', label: 'Snapshot Forensic', icon: Target },
        { path: '/lob/live', label: 'Live Stream', icon: Radio },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <aside
        style={{
          width: '280px',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          backgroundColor: 'var(--surface-color)',
          padding: '2rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '1.7rem', paddingLeft: '0.5rem' }}>
            Spectra V7
          </h1>
          <p style={{ margin: '0.3rem 0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            FDA Regime Engine · SP500 + LOB
          </p>
        </div>

        {sections.map((section) => (
          <nav key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div
              style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-secondary)',
                padding: '0 0.5rem 0.25rem',
                opacity: 0.7,
              }}
            >
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/' || item.path === '/lob'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                  fontWeight: isActive ? 600 : 400,
                })}
              >
                <item.icon size={17} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        ))}

        <div
          style={{
            marginTop: 'auto',
            padding: '0.75rem',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#94a3b8' }}>Backend</div>
          <div>{backendLabel()}</div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.65rem' }}>
            SP500 · 5-channel LOB · fPCA · Hotelling T²
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '2rem', height: '100vh', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
