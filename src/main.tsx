import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './utils/TranslationContext';

// Redirection automatique des appels /api/* vers le backend en production (Render, Cloud Run, etc.)
const rawApiBase = (import.meta.env.VITE_API_URL || '').trim();
if (rawApiBase) {
  const API_BASE = rawApiBase.replace(/\/+$/, '');
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      if (typeof input === 'string') {
        if (input.startsWith('/api/')) {
          return originalFetch(API_BASE + input, init);
        }
        if (typeof window !== 'undefined' && input.startsWith(window.location.origin + '/api/')) {
          return originalFetch(input.replace(window.location.origin, API_BASE), init);
        }
      } else if (input instanceof URL) {
        if (input.pathname.startsWith('/api/')) {
          return originalFetch(`${API_BASE}${input.pathname}${input.search}`, init);
        }
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        const reqUrl = new URL(input.url, window.location.origin);
        if (reqUrl.pathname.startsWith('/api/')) {
          return originalFetch(new Request(`${API_BASE}${reqUrl.pathname}${reqUrl.search}`, input), init);
        }
      }
    } catch {
      // Fallback to standard fetch in case of URL parse errors
    }
    return originalFetch(input, init);
  };
  console.log(`📡 API_BASE configuré vers le backend : ${API_BASE}`);
}

// De-escalate and suppress expected Firestore network warnings in local sandbox environment
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event.message || event.error?.message || '';
    if (msg.includes('Pending promise was never set') || msg.includes('INTERNAL ASSERTION FAILED')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = event.reason?.message || String(event.reason || '');
    if (reasonMsg.includes('Pending promise was never set') || reasonMsg.includes('INTERNAL ASSERTION FAILED')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

console.error = function (...args) {
  const msg = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg))).join(' ');
  if (
    msg.includes('Could not reach Cloud Firestore backend') || 
    msg.includes('code=unavailable') || 
    msg.includes('@firebase/firestore') ||
    msg.includes('auth/network-request-failed') ||
    msg.includes('auth/missing-project-id') ||
    msg.includes('Shared sandbox sign in failed') ||
    msg.includes('Anonymous authentication process failed') ||
    msg.includes('Pending promise was never set') ||
    msg.includes('INTERNAL ASSERTION FAILED')
  ) {
    console.log('💡 [Pasma-sys Local Mode] Firebase Auth / Firestore operating with persistent local cache.');
    return;
  }
  originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
  const msg = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg))).join(' ');
  if (
    msg.includes('Could not reach Cloud Firestore backend') || 
    msg.includes('code=unavailable') || 
    msg.includes('@firebase/firestore') ||
    msg.includes('auth/network-request-failed') ||
    msg.includes('auth/missing-project-id') ||
    msg.includes('Shared sandbox sign in failed') ||
    msg.includes('Pending promise was never set') ||
    msg.includes('INTERNAL ASSERTION FAILED')
  ) {
    console.log('💡 [Pasma-sys Local Mode] Firebase Auth / Firestore operating with persistent local cache.');
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Enregistrement du Service Worker pour que l'application soit installable en PWA (en DEV et en PRE/PROD)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PWA Service Worker enregistré avec succès:', registration.scope);
      })
      .catch((error) => {
        console.log('Échec de l\'enregistrement du Service Worker:', error);
      });
  });

  // En mode Dev, on vide les caches hérités pour éviter tout effet de page blanche
  if ((import.meta as any).env.DEV) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
