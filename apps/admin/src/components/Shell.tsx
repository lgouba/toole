import { NavLink } from 'react-router-dom';
import { useAuth } from '../store';

function Icon({ name }: { name: string }) {
  const paths: Record<string, JSX.Element> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M3 21c0-3.5 2.7-6 6-6s6 2.5 6 6" />
        <circle cx="17" cy="6" r="3" />
        <path d="M21 18c0-2.5-1.8-4.5-4-5" />
      </>
    ),
    drivers: (
      <>
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
        <path d="M5 17l3-9h6l2 5" />
        <path d="M14 8l3 3h-5" />
      </>
    ),
    box: (
      <>
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">T</div>
          <div className="logo-text">
            <span className="brand">Tolle</span>
            <span className="sub">Admin</span>
          </div>
        </div>

        <div className="nav-section">Navigation</div>
        <nav>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="dashboard" />
            </span>
            <span>Tableau de bord</span>
          </NavLink>
          <NavLink
            to="/clients"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="users" />
            </span>
            <span>Clients</span>
          </NavLink>
          <NavLink
            to="/drivers"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="drivers" />
            </span>
            <span>Livreurs</span>
          </NavLink>
          <NavLink
            to="/deliveries"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="box" />
            </span>
            <span>Livraisons</span>
          </NavLink>
        </nav>

        <div className="user-block">
          <div className="user-avatar">{initials(user?.fullName)}</div>
          <div className="user-info">
            <span className="name">{user?.fullName}</span>
            <span className="email">{user?.email}</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Se deconnecter">
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
