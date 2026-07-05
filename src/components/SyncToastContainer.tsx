import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, CheckCircle, WifiOff, Clock, X, RefreshCw, AlertCircle } from 'lucide-react';

export interface SyncToast {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'offline' | 'sync_start' | 'sync_success';
}

export default function SyncToastContainer() {
  const [toasts, setToasts] = useState<SyncToast[]>([]);

  useEffect(() => {
    const handleSaveSuccess = (e: Event) => {
      const customEvent = e as CustomEvent<{ title: string }>;
      const title = customEvent.detail?.title || 'Données enregistrées';
      addToast({
        id: 'success_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title: 'Enregistrement réussi',
        description: `"${title}" a été enregistré avec succès dans la base de données (En ligne).`,
        type: 'success',
      });
    };

    const handleSaveOffline = (e: Event) => {
      const customEvent = e as CustomEvent<{ title: string }>;
      const title = customEvent.detail?.title || 'Données stockées';
      addToast({
        id: 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title: 'Sauvegardé en cache (Hors-ligne)',
        description: `"${title}" a été enregistré localement en toute sécurité (mémoire persistante). Les modifications seront envoyées automatiquement dès le rétablissement de la connexion.`,
        type: 'offline',
      });
    };

    const handleSyncStarted = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number }>;
      const count = customEvent.detail?.count || 1;
      addToast({
        id: 'sync_start_' + Date.now(),
        title: 'Synchronisation en cours',
        description: `Envoi de ${count} modification(s) en attente vers la base de données...`,
        type: 'sync_start',
      });
    };

    const handleSyncSuccess = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number }>;
      const count = customEvent.detail?.count || 1;
      // Remove any existing sync_start toasts to avoid clutter
      setToasts(prev => prev.filter(t => t.type !== 'sync_start'));
      addToast({
        id: 'sync_success_' + Date.now(),
        title: 'Synchronisation réussie',
        description: `${count} modification(s) locale(s) synchronisée(s) avec succès dans le Cloud !`,
        type: 'sync_success',
      });
    };

    window.addEventListener('pasma_save_success', handleSaveSuccess);
    window.addEventListener('pasma_save_offline', handleSaveOffline);
    window.addEventListener('pasma_sync_started', handleSyncStarted);
    window.addEventListener('pasma_sync_success', handleSyncSuccess);

    return () => {
      window.removeEventListener('pasma_save_success', handleSaveSuccess);
      window.removeEventListener('pasma_save_offline', handleSaveOffline);
      window.removeEventListener('pasma_sync_started', handleSyncStarted);
      window.removeEventListener('pasma_sync_success', handleSyncSuccess);
    };
  }, []);

  const addToast = (toast: SyncToast) => {
    setToasts(prev => {
      // Limit to max 4 toasts at a time to prevent screen clutter
      const next = [toast, ...prev];
      if (next.length > 4) {
        return next.slice(0, 4);
      }
      return next;
    });

    // Auto remove after 6 seconds (give offline and sync success slightly longer reading time)
    const duration = toast.type === 'offline' || toast.type === 'sync_success' ? 7000 : 5000;
    setTimeout(() => {
      removeToast(toast.id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div 
      id="sync-toast-container" 
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-md px-4 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isOffline = toast.type === 'offline';
          const isSyncStart = toast.type === 'sync_start';
          const isSyncSuccess = toast.type === 'sync_success';

          let bgColor = 'bg-white dark:bg-gray-800';
          let borderColor = 'border-gray-200 dark:border-gray-700';
          let textColor = 'text-gray-900 dark:text-gray-100';
          let iconColor = 'text-gray-500';
          let Icon = Cloud;

          if (isSuccess) {
            bgColor = 'bg-emerald-50 dark:bg-emerald-950/85';
            borderColor = 'border-emerald-200 dark:border-emerald-800/60';
            textColor = 'text-emerald-900 dark:text-emerald-100';
            iconColor = 'text-emerald-600 dark:text-emerald-400';
            Icon = CheckCircle;
          } else if (isOffline) {
            bgColor = 'bg-amber-50 dark:bg-amber-950/85';
            borderColor = 'border-amber-200 dark:border-amber-800/60';
            textColor = 'text-amber-900 dark:text-amber-100';
            iconColor = 'text-amber-600 dark:text-amber-400';
            Icon = WifiOff;
          } else if (isSyncStart) {
            bgColor = 'bg-blue-50 dark:bg-blue-950/85';
            borderColor = 'border-blue-200 dark:border-blue-800/60';
            textColor = 'text-blue-900 dark:text-blue-100';
            iconColor = 'text-blue-600 dark:text-blue-400';
            Icon = RefreshCw;
          } else if (isSyncSuccess) {
            bgColor = 'bg-indigo-50 dark:bg-indigo-950/85';
            borderColor = 'border-indigo-200 dark:border-indigo-800/60';
            textColor = 'text-indigo-900 dark:text-indigo-100';
            iconColor = 'text-indigo-600 dark:text-indigo-400';
            Icon = Cloud;
          }

          return (
            <motion.div
              key={toast.id}
              id={`toast-${toast.id}`}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl ${bgColor} ${borderColor} ${textColor} backdrop-blur-md`}
            >
              <div className={`p-1.5 rounded-lg bg-white/60 dark:bg-black/20 ${iconColor} mt-0.5 shadow-sm`}>
                <Icon className={`w-5 h-5 ${isSyncStart ? 'animate-spin' : ''}`} />
              </div>

              <div className="flex-1 min-w-0 pr-2">
                <h4 className="font-semibold text-sm leading-tight mb-1 flex items-center gap-1.5">
                  {toast.title}
                  {isOffline && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                      <Clock className="w-2.5 h-2.5" /> PERSISTANT
                    </span>
                  )}
                  {isSuccess && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      CLOUD
                    </span>
                  )}
                  {isSyncSuccess && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                      SYNC
                    </span>
                  )}
                </h4>
                <p className="text-xs opacity-90 leading-normal">{toast.description}</p>
              </div>

              <button
                id={`toast-close-${toast.id}`}
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-all self-start mt-0.5"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
