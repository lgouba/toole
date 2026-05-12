import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ============================================================
// API publique : useDialog()
// ============================================================

interface ConfirmOpts {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Si vrai, le bouton confirmer est rouge (action destructive) */
  danger?: boolean;
}

interface AlertOpts {
  title: string;
  message?: React.ReactNode;
  type?: 'success' | 'error' | 'info' | 'warning';
  okLabel?: string;
}

interface PromptOpts {
  title: string;
  message?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  required?: boolean;
}

interface DialogApi {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  alert: (opts: AlertOpts) => Promise<void>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}

// ============================================================
// Provider
// ============================================================

type Mode = 'confirm' | 'alert' | 'prompt';

interface DialogState {
  mode: Mode;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  okLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  danger?: boolean;
  multiline?: boolean;
  required?: boolean;
  type?: AlertOpts['type'];
  resolve: (val: any) => void;
}

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Focus auto sur l'input du prompt à l'ouverture
  useEffect(() => {
    if (state?.mode === 'prompt' && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [state?.mode]);

  // Fermer par Esc / Enter
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (
        e.key === 'Enter' &&
        state.mode !== 'prompt' // Enter dans un prompt valide la saisie via le bouton
      ) {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleConfirm = () => {
    if (!state) return;
    if (state.mode === 'prompt') {
      const v = inputValue.trim();
      if (state.required && !v) return; // bloque si vide
      state.resolve(v);
    } else if (state.mode === 'confirm') {
      state.resolve(true);
    } else {
      state.resolve(undefined);
    }
    setState(null);
    setInputValue('');
  };

  const handleCancel = () => {
    if (!state) return;
    if (state.mode === 'prompt') state.resolve(null);
    else if (state.mode === 'confirm') state.resolve(false);
    else state.resolve(undefined);
    setState(null);
    setInputValue('');
  };

  const api: DialogApi = {
    confirm: useCallback(
      (opts) =>
        new Promise<boolean>((resolve) => {
          setState({
            mode: 'confirm',
            title: opts.title,
            message: opts.message,
            confirmLabel: opts.confirmLabel ?? 'Confirmer',
            cancelLabel: opts.cancelLabel ?? 'Annuler',
            danger: opts.danger,
            resolve,
          });
        }),
      [],
    ),
    alert: useCallback(
      (opts) =>
        new Promise<void>((resolve) => {
          setState({
            mode: 'alert',
            title: opts.title,
            message: opts.message,
            okLabel: opts.okLabel ?? 'OK',
            type: opts.type ?? 'info',
            resolve,
          });
        }),
      [],
    ),
    prompt: useCallback(
      (opts) =>
        new Promise<string | null>((resolve) => {
          setInputValue(opts.defaultValue ?? '');
          setState({
            mode: 'prompt',
            title: opts.title,
            message: opts.message,
            confirmLabel: opts.confirmLabel ?? 'Valider',
            cancelLabel: opts.cancelLabel ?? 'Annuler',
            placeholder: opts.placeholder,
            defaultValue: opts.defaultValue,
            multiline: opts.multiline,
            required: opts.required,
            resolve,
          });
        }),
      [],
    ),
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state ? (
        <DialogView
          state={state}
          inputValue={inputValue}
          setInputValue={setInputValue}
          inputRef={inputRef}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null}
    </DialogContext.Provider>
  );
}

// ============================================================
// Composant visuel
// ============================================================

function DialogView({
  state,
  inputValue,
  setInputValue,
  inputRef,
  onConfirm,
  onCancel,
}: {
  state: DialogState;
  inputValue: string;
  setInputValue: (v: string) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const icon = state.mode === 'alert' ? ICON_BY_TYPE[state.type ?? 'info'] : null;
  const accentColor = state.danger
    ? '#dc2626'
    : state.mode === 'alert'
      ? COLOR_BY_TYPE[state.type ?? 'info']
      : '#1d9e75';

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div
        style={s.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {icon ? (
          <div style={{ ...s.iconCircle, background: accentColor + '14' }}>
            <span style={{ ...s.icon, color: accentColor }}>{icon}</span>
          </div>
        ) : null}

        <div style={s.title}>{state.title}</div>

        {state.message ? <div style={s.message}>{state.message}</div> : null}

        {state.mode === 'prompt' ? (
          state.multiline ? (
            <textarea
              ref={(el) => {
                inputRef.current = el;
              }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={state.placeholder}
              style={s.textarea}
              rows={4}
            />
          ) : (
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onConfirm();
                }
              }}
              placeholder={state.placeholder}
              style={s.input}
            />
          )
        ) : null}

        <div style={s.actions}>
          {state.mode === 'alert' ? (
            <button
              onClick={onConfirm}
              style={{ ...s.btnPrimary, background: accentColor }}
              autoFocus
            >
              {state.okLabel ?? 'OK'}
            </button>
          ) : (
            <>
              <button onClick={onCancel} style={s.btnSecondary}>
                {state.cancelLabel ?? 'Annuler'}
              </button>
              <button
                onClick={onConfirm}
                style={{ ...s.btnPrimary, background: accentColor }}
                disabled={
                  state.mode === 'prompt' && state.required && !inputValue.trim()
                }
                autoFocus
              >
                {state.confirmLabel ?? 'Confirmer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const ICON_BY_TYPE: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const COLOR_BY_TYPE: Record<string, string> = {
  success: '#10b981',
  error: '#dc2626',
  warning: '#f59e0b',
  info: '#1d9e75',
};

// ============================================================
// Styles inline (autonome, indépendant du CSS global)
// ============================================================

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
    animation: 'tolle-dialog-fade 160ms ease-out',
  },
  dialog: {
    background: '#fff',
    borderRadius: 18,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    boxShadow:
      '0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
    color: '#0f172a',
    animation: 'tolle-dialog-slide 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.3,
    marginTop: 4,
  },
  message: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 1.55,
    whiteSpace: 'pre-line' as const,
  },
  input: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    fontSize: 15,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#0f172a',
    outline: 'none',
    marginTop: 4,
  },
  textarea: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    fontSize: 15,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#0f172a',
    outline: 'none',
    resize: 'vertical',
    minHeight: 80,
    marginTop: 4,
  },
  actions: {
    display: 'flex',
    gap: 10,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  btnPrimary: {
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSecondary: {
    padding: '10px 20px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

// Animations CSS injectées dans le head (une seule fois)
if (typeof document !== 'undefined' && !document.getElementById('tolle-dialog-keyframes')) {
  const style = document.createElement('style');
  style.id = 'tolle-dialog-keyframes';
  style.textContent = `
    @keyframes tolle-dialog-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes tolle-dialog-slide {
      from { opacity: 0; transform: translateY(8px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}
