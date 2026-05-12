import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store';
import Login from './pages/Login';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Drivers from './pages/Drivers';
import UserDetail from './pages/UserDetail';
import Deliveries from './pages/Deliveries';
import DeliveryDetail from './pages/DeliveryDetail';
import DriverTracking from './pages/DriverTracking';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import Notifications from './pages/Notifications';
import PublicTracking from './pages/PublicTracking';
import NotificationProvider from './components/NotificationProvider';

export default function App() {
  const { user, loading, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      {/* PUBLIC : page de suivi destinataire, accessible sans login.
          C'est l'URL que le client partage par SMS/WhatsApp. */}
      <Route path="/track/:token" element={<PublicTracking />} />

      {/* Tout le reste est gate par l'auth admin */}
      <Route path="/*" element={<AdminApp loading={loading} user={user} />} />
    </Routes>
  );
}

function AdminApp({ loading, user }: { loading: boolean; user: any }) {
  if (loading) {
    return <div className="login-wrap"><div className="muted">Chargement...</div></div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <NotificationProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/drivers/:id/tracking" element={<DriverTracking />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/deliveries/:id" element={<DeliveryDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </NotificationProvider>
  );
}
