import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SidebarLayout } from './components/SidebarLayout';
import { OnlineMonitor } from './pages/OnlineMonitor';
import { ForensicEventView } from './pages/ForensicEventView';
import { LOBOverview } from './pages/LOBOverview';
import { LOBForensic } from './pages/LOBForensic';
import { LOBOrderFlow } from './pages/LOBOrderFlow';
import { LOBLiveStream } from './pages/LOBLiveStream';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SidebarLayout />}>
        <Route index element={<OnlineMonitor />} />
        <Route path="forensic" element={<ForensicEventView />} />
        <Route path="lob" element={<LOBOverview />} />
        <Route path="lob/orderflow" element={<LOBOrderFlow />} />
        <Route path="lob/forensic" element={<LOBForensic />} />
        <Route path="lob/live" element={<LOBLiveStream />} />
      </Route>
    </Routes>
  );
}

export default App;
