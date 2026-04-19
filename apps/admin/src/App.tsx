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

export default function App() {
  const { user, loading, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

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
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/deliveries" element={<Deliveries />} />
        <Route path="/deliveries/:id" element={<DeliveryDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
