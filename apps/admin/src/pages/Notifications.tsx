import { useEffect, useState } from 'react';
import { api, unwrap } from '../api';
import { useDialog } from '../components/DialogProvider';
import { Tabs, type TabDef } from '../components/Tabs';

type TabId = 'new' | 'history';

interface Campaign {
  id: string;
  title: string;
  body: string;
  target: 'all' | 'clients' | 'drivers';
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

const TARGET_LABEL: Record<Campaign['target'], string> = {
  all: 'Tous',
  clients: 'Clients',
  drivers: 'Livreurs',
};

const TARGET_COLOR: Record<Campaign['target'], string> = {
  all: '#6366f1',
  clients: '#1d9e75',
  drivers: '#d85a30',
};

export default function Notifications() {
  const dialog = useDialog();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<Campaign['target']>('all');
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    tokenCount: number;
  } | null>(null);
  const [tab, setTab] = useState<TabId>('new');

  const loadHistory = async () => {
    try {
      const res = await api.get('/admin/notifications');
      setCampaigns(unwrap<Campaign[]>(res));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    const ok = await dialog.confirm({
      title: `Envoyer à « ${TARGET_LABEL[target]} » ?`,
      message: (
        <span>
          <strong>Titre :</strong> {title}
          {'\n'}
          <strong>Message :</strong> {body}
        </span>
      ),
      confirmLabel: 'Envoyer maintenant',
    });
    if (!ok) return;
    setSending(true);
    setLastResult(null);
    try {
      const res = await api.post('/admin/notifications/broadcast', {
        title: title.trim(),
        body: body.trim(),
        target,
      });
      const data = unwrap<Campaign & { tokenCount: number }>(res);
      setLastResult({
        sent: data.sentCount,
        failed: data.failedCount,
        tokenCount: data.tokenCount,
      });
      setTitle('');
      setBody('');
      await loadHistory();
    } catch (err: any) {
      await dialog.alert({
        title: 'Erreur',
        message:
          err?.response?.data?.error?.message ??
          "Erreur lors de l'envoi de la notification.",
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const TABS: ReadonlyArray<TabDef<TabId>> = [
    { id: 'new', label: 'Nouvelle', icon: '✉️' },
    {
      id: 'history',
      label: 'Historique',
      icon: '📋',
      badge: campaigns.length,
    },
  ];

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Notifications</h1>
      <div style={s.subtitle}>
        Envoyez une notification push à tous les utilisateurs de l'application.
        Réception instantanée sur les appareils.
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'new' && (
      <>
      {/* Form d'envoi */}
      <div style={s.formCard}>
        <label style={s.label}>
          Cible
          <div style={s.targetRow}>
            {(['all', 'clients', 'drivers'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                style={{
                  ...s.targetChip,
                  ...(target === t
                    ? {
                        borderColor: TARGET_COLOR[t],
                        background: TARGET_COLOR[t] + '14',
                        color: TARGET_COLOR[t],
                        fontWeight: 700,
                      }
                    : {}),
                }}
              >
                {TARGET_LABEL[t]}
              </button>
            ))}
          </div>
        </label>

        <label style={s.label}>
          Titre <span style={s.muted}>({title.length}/80)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Ex : Nouvelle fonctionnalité disponible !"
            style={s.input}
          />
        </label>

        <label style={s.label}>
          Message <span style={s.muted}>({body.length}/300)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 300))}
            placeholder="Ex : Vous pouvez désormais partager le suivi de votre livraison avec votre destinataire."
            style={s.textarea}
            rows={4}
          />
        </label>

        {/* Preview style mobile */}
        <div style={s.previewWrap}>
          <div style={s.previewLabel}>Aperçu</div>
          <div style={s.previewPhone}>
            <div style={s.previewNotif}>
              <div style={s.previewAppRow}>
                <div style={s.previewIcon}>T</div>
                <div style={s.previewApp}>TOLLÉ</div>
                <div style={s.previewTime}>maintenant</div>
              </div>
              <div style={s.previewTitle}>
                {title || 'Titre de la notification'}
              </div>
              <div style={s.previewBody}>
                {body || 'Le contenu de votre message apparaîtra ici.'}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            ...s.sendBtn,
            ...(canSend ? {} : s.sendBtnDisabled),
          }}
        >
          {sending ? 'Envoi en cours…' : 'Envoyer la notification'}
        </button>

        {lastResult ? (
          <div style={s.resultBanner}>
            ✓ Notification envoyée. <strong>{lastResult.sent}</strong>{' '}
            réception(s){' '}
            {lastResult.failed > 0 ? (
              <span>
                · <strong>{lastResult.failed}</strong> échec(s)
              </span>
            ) : null}{' '}
            sur {lastResult.tokenCount} appareil(s).
          </div>
        ) : null}
      </div>
      </>
      )}

      {tab === 'history' && (
      <div style={s.historyCard}>
        {loading ? (
          <div style={s.muted}>Chargement…</div>
        ) : campaigns.length === 0 ? (
          <div style={s.muted}>Aucune notification envoyée pour l'instant.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {campaigns.map((c) => (
              <div key={c.id} style={s.historyRow}>
                <div style={s.historyHeader}>
                  <div
                    style={{
                      ...s.historyTargetPill,
                      background: TARGET_COLOR[c.target] + '14',
                      color: TARGET_COLOR[c.target],
                    }}
                  >
                    {TARGET_LABEL[c.target]}
                  </div>
                  <div style={s.historyDate}>
                    {new Date(c.createdAt).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
                <div style={s.historyTitle}>{c.title}</div>
                <div style={s.historyBody}>{c.body}</div>
                <div style={s.historyStats}>
                  ✓ {c.sentCount} envoyée(s)
                  {c.failedCount > 0 ? ` · ✗ ${c.failedCount} échec(s)` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// Styles inline pour rester autonomes (l'admin a une styles.css mais on fait
// notre propre cohérence pour cette page)
const s: Record<string, React.CSSProperties> = {
  page: { padding: 24, maxWidth: 920, margin: '0 auto' },
  h1: { fontSize: 28, fontWeight: 800, margin: '0 0 8px' },
  subtitle: { color: 'var(--text-secondary, #6b7280)', fontSize: 14, marginBottom: 24 },
  formCard: {
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  formTitle: { fontSize: 16, fontWeight: 700 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary, #6b7280)',
  },
  muted: { color: 'var(--text-tertiary, #9ca3af)', fontWeight: 400, fontSize: 12 },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border, #e5e7eb)',
    fontSize: 14,
    fontFamily: 'inherit',
    background: 'var(--bg, #fff)',
    color: 'var(--text, #111)',
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border, #e5e7eb)',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
    background: 'var(--bg, #fff)',
    color: 'var(--text, #111)',
  },
  targetRow: { display: 'flex', gap: 8 },
  targetChip: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1.5px solid var(--border, #e5e7eb)',
    background: 'var(--bg, #fff)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--text, #111)',
  },
  previewWrap: {
    background: 'var(--bg-alt, #f3f4f6)',
    borderRadius: 12,
    padding: 16,
  },
  previewLabel: {
    fontSize: 11,
    color: 'var(--text-tertiary, #9ca3af)',
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewPhone: {
    background: '#1c1c1e',
    borderRadius: 14,
    padding: 12,
    minHeight: 80,
    color: '#fff',
  },
  previewNotif: {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: 10,
    padding: 12,
  },
  previewAppRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    fontSize: 11,
  },
  previewIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    background: '#1d9e75',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
  },
  previewApp: { fontWeight: 700, color: '#fff', flex: 1 },
  previewTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  previewTitle: { fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 },
  previewBody: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 },
  sendBtn: {
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#1d9e75',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sendBtnDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
  },
  resultBanner: {
    padding: '10px 14px',
    background: '#d1fae5',
    color: '#065f46',
    borderRadius: 10,
    fontSize: 13,
  },
  historyCard: {
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  historyRow: {
    padding: 14,
    borderRadius: 12,
    background: 'var(--bg-alt, #f9fafb)',
    border: '1px solid var(--border, #e5e7eb)',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTargetPill: {
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyDate: { fontSize: 12, color: 'var(--text-tertiary, #9ca3af)' },
  historyTitle: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  historyBody: { fontSize: 13, color: 'var(--text-secondary, #6b7280)', lineHeight: 1.5 },
  historyStats: {
    fontSize: 11,
    color: 'var(--text-tertiary, #9ca3af)',
    marginTop: 8,
  },
};
