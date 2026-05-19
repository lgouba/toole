import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { initSentry, Sentry } from './sentry';
import App from './App';
import './styles.css';

// Initialise Sentry avant tout rendu
initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '40px',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            background: '#f9fafb',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              background: 'white',
              padding: 32,
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 16 }}>😵</div>
            <h1 style={{ fontSize: 22, margin: '0 0 12px', color: '#111' }}>
              Une erreur est survenue
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
              L'équipe technique a été notifiée. Vous pouvez essayer de
              recharger la page.
            </p>
            <button
              onClick={() => {
                resetError();
                window.location.reload();
              }}
              style={{
                background: '#1d9e75',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recharger la page
            </button>
            {import.meta.env.DEV && error instanceof Error ? (
              <pre
                style={{
                  marginTop: 24,
                  padding: 12,
                  background: '#f3f4f6',
                  borderRadius: 8,
                  fontSize: 11,
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                {error.message}
                {'\n'}
                {error.stack}
              </pre>
            ) : null}
          </div>
        </div>
      )}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
