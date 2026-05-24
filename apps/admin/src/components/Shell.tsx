import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store';
import { useNotifications, type AdminNotification } from '../notifications';
import { formatDistance } from 'date-fns';
import { fr } from 'date-fns/locale';

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
    bell: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    money: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 10v.01M18 14v.01" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

function NotifBell() {
  const { items, unreadCount, markAllRead, markRead, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleClick = (n: AdminNotification) => {
    markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="notif-bell" ref={ref}>
      <button
        className="notif-bell-btn"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unreadCount > 0) {
            // Marquer tout lu apres une courte pause (visuel)
            setTimeout(() => markAllRead(), 400);
          }
        }}
      >
        <Icon name="bell" />
        {unreadCount > 0 ? (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Notifications</span>
            {items.length > 0 ? (
              <button
                className="notif-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
              >
                Effacer
              </button>
            ) : null}
          </div>

          <div className="notif-panel-body">
            {items.length === 0 ? (
              <div className="notif-empty">Aucune notification</div>
            ) : (
              items.slice(0, 15).map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'unread'}`}
                  onClick={() => handleClick(n)}
                >
                  <div className="notif-item-title">{n.title}</div>
                  {n.body ? (
                    <div className="notif-item-body">{n.body}</div>
                  ) : null}
                  <div className="notif-item-time">
                    {formatDistance(new Date(n.createdAt), new Date(), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
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
          <NavLink
            to="/balances"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="money" />
            </span>
            <span>Soldes livreurs</span>
          </NavLink>
          <NavLink
            to="/transactions"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="money" />
            </span>
            <span>Transactions</span>
          </NavLink>
          <NavLink
            to="/notifications"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="bell" />
            </span>
            <span>Notifications</span>
          </NavLink>
          <NavLink
            to="/promo-codes"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">🎟️</span>
            <span>Codes promo</span>
          </NavLink>

          <div className="nav-section">Configuration</div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name="settings" />
            </span>
            <span>Parametres</span>
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
      <main className="content">
        <div className="topbar">
          <NotifBell />
        </div>
        {children}
      </main>
    </div>
  );
}
