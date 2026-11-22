import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, unwrap, resolveUploadUrl } from '../api';
import { useDialog } from '../components/DialogProvider';

type Status = 'open' | 'in_progress' | 'resolved';
type Category = 'app_problem' | 'account_data' | 'dispute' | 'refund' | 'other';

interface Ticket {
  id: string;
  reference: string;
  category: Category;
  description: string;
  photoUrl?: string | null;
  status: Status;
  adminNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  user?: { id: string; fullName: string; phone: string; userType: string } | null;
  delivery?: { id: string; reference: string } | null;
  handledBy?: { id: string; fullName: string } | null;
}

const CATEGORY_LABEL: Record<Category, string> = {
  app_problem: "Problème dans l'application",
  account_data: 'Modifier mes informations',
  dispute: 'Litige',
  refund: 'Remboursement',
  other: 'Autres',
};

const STATUS_LABEL: Record<Status, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
};

const STATUSES: Status[] = ['open', 'in_progress', 'resolved'];

export default function SupportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dialog = useDialog();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [status, setStatus] = useState<Status>('open');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await api.get(`/admin/support/tickets/${id}`);
    const t = unwrap<Ticket>(res);
    setTicket(t);
    setStatus(t.status);
    setNote(t.adminNote ?? '');
  };

  useEffect(() => {
    load().catch(() => setTicket(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (!ticket) return;
    if (status === 'resolved' && ticket.status !== 'resolved') {
      const ok = await dialog.confirm({
        title: 'Marquer comme résolu ?',
        message: "L'utilisateur recevra une notification « Votre demande a été traitée ».",
        confirmLabel: 'Résoudre',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await api.patch(`/admin/support/tickets/${id}`, { status, adminNote: note.trim() || undefined });
      await load();
      await dialog.alert({ title: 'Enregistré', message: 'La demande a été mise à jour.', type: 'success' });
    } catch (err: any) {
      await dialog.alert({
        title: 'Erreur',
        message: err?.response?.data?.error?.message ?? 'Échec de la mise à jour.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ticket) return <div style={s.page}><div style={s.muted}>Chargement…</div></div>;

  const photo = resolveUploadUrl(ticket.photoUrl);

  return (
    <div style={s.page}>
      <button style={s.back} onClick={() => navigate('/support')}>← Réclamations</button>
      <div style={s.head}>
        <h1 style={s.h1}>{ticket.reference}</h1>
        <span style={s.catBadge}>{CATEGORY_LABEL[ticket.category]}</span>
      </div>

      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.label}>Demandeur</div>
          <div style={s.val}>
            {ticket.user ? (
              <Link to={`/users/${ticket.user.id}`} style={s.link}>{ticket.user.fullName}</Link>
            ) : '—'}
            {ticket.user ? <span style={s.sub}> · {ticket.user.phone} · {ticket.user.userType}</span> : null}
          </div>

          {ticket.delivery && (
            <>
              <div style={s.label}>Course concernée</div>
              <div style={s.val}><Link to={`/deliveries/${ticket.delivery.id}`} style={s.link}>{ticket.delivery.reference}</Link></div>
            </>
          )}

          <div style={s.label}>Message</div>
          <div style={s.message}>{ticket.description}</div>

          {photo && (
            <>
              <div style={s.label}>Photo</div>
              <a href={photo} target="_blank" rel="noreferrer"><img src={photo} alt="Pièce jointe" style={s.photo} /></a>
            </>
          )}

          <div style={s.label}>Reçue le</div>
          <div style={s.val}>{new Date(ticket.createdAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</div>
        </div>

        <div style={s.card}>
          <div style={s.label}>Statut</div>
          <div style={s.statusRow}>
            {STATUSES.map((st) => (
              <button
                key={st}
                onClick={() => setStatus(st)}
                style={{ ...s.statusBtn, ...(status === st ? s.statusBtnOn : {}) }}
              >
                {STATUS_LABEL[st]}
              </button>
            ))}
          </div>

          <div style={s.label}>Note interne / réponse</div>
          <textarea
            style={s.textarea}
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 5000))}
            placeholder="Note visible par l'utilisateur dans le détail de sa demande."
          />

          <button onClick={save} disabled={saving} style={{ ...s.saveBtn, ...(saving ? s.saveBtnOff : {}) }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {ticket.handledBy && <div style={s.handled}>Traité par {ticket.handledBy.fullName}</div>}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 24, maxWidth: 920, margin: '0 auto' },
  back: { background: 'none', border: 'none', color: 'var(--text-secondary, #6b7280)', cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 12 },
  head: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  h1: { fontSize: 26, fontWeight: 800, margin: 0 },
  catBadge: { background: 'var(--border, #eee)', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #6b7280)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: 16 },
  card: { background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 16, padding: 20 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-tertiary, #9ca3af)', marginTop: 14, marginBottom: 4 },
  val: { fontSize: 15, color: 'var(--text, #111)' },
  sub: { color: 'var(--text-secondary, #6b7280)', fontSize: 13 },
  link: { color: '#c2410c', fontWeight: 600, textDecoration: 'none' },
  message: { fontSize: 15, color: 'var(--text, #111)', whiteSpace: 'pre-wrap', lineHeight: 1.5 },
  photo: { maxWidth: '100%', maxHeight: 280, borderRadius: 12, marginTop: 4 },
  muted: { color: 'var(--text-tertiary, #9ca3af)', fontSize: 14, padding: 16 },
  statusRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  statusBtn: { padding: '8px 14px', borderRadius: 999, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--bg, #fff)', color: 'var(--text-secondary, #6b7280)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  statusBtnOn: { borderColor: '#c2410c', background: '#c2410c', color: '#fff' },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border, #e5e7eb)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', background: 'var(--bg, #fff)', color: 'var(--text, #111)', boxSizing: 'border-box' },
  saveBtn: { marginTop: 16, width: '100%', padding: 12, borderRadius: 12, border: 'none', background: '#c2410c', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  saveBtnOff: { opacity: 0.6, cursor: 'default' },
  handled: { marginTop: 10, fontSize: 12, color: 'var(--text-tertiary, #9ca3af)', textAlign: 'center' },
};
