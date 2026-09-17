import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AuthShell from '@/components/auth-shell';
import LiveDriver from '@/components/live-driver';
import FleetDashboard from '@/components/fleet-dashboard';
import MonitoringDashboard from '@/components/monitoring-dashboard';
import DriverScreen from '@/components/driver-screen';
import './styles.css';

function AdminDashboard(props: React.ComponentProps<typeof FleetDashboard>) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile ? <MonitoringDashboard {...props} /> : <FleetDashboard {...props} />;
}

function App() {
  return <AuthShell>{(user, logout, loggingOut, logoutError) =>
    <LiveDriver>{live => user.role === 'Driver'
      ? <DriverScreen user={user} logout={logout} loggingOut={loggingOut} logoutError={logoutError} live={live} />
      : <AdminDashboard user={user} logout={logout} loggingOut={loggingOut} logoutError={logoutError} live={live} />
    }</LiveDriver>
  }</AuthShell>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
