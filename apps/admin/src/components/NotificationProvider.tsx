import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store';
import { connectSocket, disconnectSocket } from '../socket';
import { useNotifications } from '../notifications';

interface ToastData {
  id: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Ecoute les evenements admin temps reel (nouveau livreur...) et affiche un toast.
 * Monte un <div> de toast en fixed bottom-right.
 */
export default function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pushNotif = useNotifications((s) => s.push);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const navigate = useNavigate();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastData, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => removeToast(id), 6000);
    },
    [removeToast],
  );

  useEffect(() => {
    if (!user) return;

    const socket = connectSocket();

    const onNewDriver = (payload: any) => {
      const name = payload?.fullName ?? 'Nouveau livreur';
      const vehicle = payload?.vehicleType ? ` · ${payload.vehicleType}` : '';
      pushNotif({
        type: 'new_driver',
        title: 'Nouvelle inscription livreur',
        body: `${name}${vehicle}`,
        link: payload?.id ? `/users/${payload.id}` : '/',
      });
      addToast({
        title: '🛵 Nouveau livreur inscrit',
        body: `${name}${vehicle} — a activer`,
        link: payload?.id ? `/users/${payload.id}` : '/',
      });

      // Ping sonore doux (WebAudio, pas de fichier requis)
      try {
        const ctx = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.08, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.3);
      } catch {
        // audio indispo
      }
    };

    socket.on('admin:new_driver', onNewDriver);

    return () => {
      socket.off('admin:new_driver', onNewDriver);
    };
  }, [user, pushNotif, addToast]);

  // Disconnect when user logs out
  useEffect(() => {
    if (!user) disconnectSocket();
  }, [user]);

  return (
    <>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast"
            role="button"
            onClick={() => {
              if (t.link) navigate(t.link);
              removeToast(t.id);
            }}
          >
            <div className="toast-title">{t.title}</div>
            {t.body ? <div className="toast-body">{t.body}</div> : null}
            <button
              className="toast-close"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(t.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
