import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthShell from '@/components/auth-shell';
import LiveDriver from '@/components/live-driver';
import MonitoringDashboard from '@/components/monitoring-dashboard';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthShell>{(user, logout, loggingOut, logoutError) =>
      <LiveDriver>{live =>
        <MonitoringDashboard user={user} logout={logout} loggingOut={loggingOut} logoutError={logoutError} live={live} />
      }</LiveDriver>
    }</AuthShell>
  </React.StrictMode>,
);
