import { ReactNode } from 'react';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** Emoji ou icone facultative en debut de label */
  icon?: string;
  /** Badge numerique optionnel (ex: nombre de retraits en attente) */
  badge?: number;
}

/**
 * Barre d'onglets reutilisable pour les pages admin.
 *
 * Pattern identique a celui de Settings : header horizontal avec
 * indicateur visuel sur l'onglet actif (border-bottom + couleur primaire).
 * Scroll horizontal si trop de tabs sur petit ecran.
 *
 * Usage typique :
 *   const [tab, setTab] = useState<MyTabId>('all');
 *   <Tabs tabs={TABS} value={tab} onChange={setTab} />
 *   {tab === 'all' && <AllList />}
 *   {tab === 'pending' && <PendingList />}
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  rightSlot,
}: {
  tabs: ReadonlyArray<TabDef<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Contenu optionnel a droite de la barre (boutons d'action, search, etc.) */
  rightSlot?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {tabs.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: active
                  ? '2px solid var(--primary)'
                  : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t.icon ? <span>{t.icon}</span> : null}
              <span>{t.label}</span>
              {typeof t.badge === 'number' && t.badge > 0 ? (
                <span
                  style={{
                    background: active
                      ? 'var(--primary)'
                      : 'var(--border-strong)',
                    color: active ? 'white' : 'var(--text-secondary)',
                    padding: '1px 7px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    minWidth: 18,
                    textAlign: 'center',
                  }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {rightSlot ? (
        <div style={{ paddingBottom: 6 }}>{rightSlot}</div>
      ) : null}
    </div>
  );
}
