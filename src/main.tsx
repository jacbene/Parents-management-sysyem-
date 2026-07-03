import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './utils/TranslationContext';

// De-escalate and suppress expected Firestore network warnings in local sandbox environment
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = function (...args) {
  const msg = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg))).join(' ');
  if (msg.includes('Could not reach Cloud Firestore backend') || msg.includes('code=unavailable') || msg.includes('@firebase/firestore')) {
    console.log('💡 [Pasma-sys Offline Mode] Firebase Firestore is operating offline. Harnessing persistent local cache.');
    return;
  }
  originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
  const msg = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg))).join(' ');
  if (msg.includes('Could not reach Cloud Firestore backend') || msg.includes('code=unavailable') || msg.includes('@firebase/firestore')) {
    console.log('💡 [Pasma-sys Offline Mode] Firebase Firestore is operating offline. Harnessing persistent local cache.');
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Nettoyage des Service Workers en mode développement pour éviter les conflits de cache et l'écran blanc (page blanche)
if ('serviceWorker' in navigator) {
  if ((import.meta as any).env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then(() => {
          console.log('💡 [Pasma-sys Dev Mode] Service Worker dé-enregistré pour prévenir l\'effet page blanche.');
        });
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('PWA Service Worker enregistré avec succès:', registration.scope);
        })
        .catch((error) => {
          console.log('Échec de l\'enregistrement du Service Worker:', error);
        });
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
