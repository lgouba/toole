import { NavLink } from 'react-router-dom';
import { useAuth } from '../store';

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">Tolle Admin</div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📊</span> Tableau de bord
          </NavLink>
          <NavLink to="/clients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>👤</span> Clients
          </NavLink>
          <NavLink to="/drivers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>🛵</span> Livreurs
          </NavLink>
          <NavLink to="/deliveries" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📦</span> Livraisons
          </NavLink>
        </nav>
        <div className="user-block">
          <div className="user-info">
            <span className="name">{user?.fullName}</span>
            <span className="email">{user?.email}</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            Quitter
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
