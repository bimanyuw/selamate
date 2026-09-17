import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthShell from '@/components/auth-shell';
import LiveDriver from '@/components/live-driver';
import MonitoringDashboard from '@/components/monitoring-dashboard';
import DriverScreen from '@/components/driver-screen';
import './styles.css';

function App() {
  return <AuthShell>{(user, logout, loggingOut, logoutError) =>
    <LiveDriver>{live => user.role === 'Driver'
      ? <DriverScreen user={user} logout={logout} loggingOut={loggingOut} logoutError={logoutError} live={live} />
      : <MonitoringDashboard user={user} logout={logout} loggingOut={loggingOut} logoutError={logoutError} live={live} />
    }</LiveDriver>
  }</AuthShell>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
