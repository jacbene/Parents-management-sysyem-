import React, { useState, useEffect } from 'react';
import { RefreshCw, Database } from 'lucide-react';

interface SyncIndicatorProps {
  language?: 'fr' | 'en';
}

export default function SyncIndicator({ language = 'fr' }: SyncIndicatorProps) {
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const cached = localStorage.getItem('pasma_last_sync_time');
    return cached ? new Date(cached) : new Date();
  });
  const [now, setNow] = useState<Date>(new Date());
  const [isSyncingAnimate, setIsSyncingAnimate] = useState(false);

  useEffect(() => {
    const handleSyncEvent = () => {
      const date = new Date();
      setLastSyncTime(date);
      localStorage.setItem('pasma_last_sync_time', date.toISOString());
      
      // Flash or rotate animation on sync trigger
      setIsSyncingAnimate(true);
      const timer = setTimeout(() => setIsSyncingAnimate(false), 1200);
      return () => clearTimeout(timer);
    };

    // Listen to database snapshot pushes and successful write events
    window.addEventListener('pasma_save_success', handleSyncEvent);
    window.addEventListener('pasma_sync_success', handleSyncEvent);
    window.addEventListener('pasma_db_sync_update', handleSyncEvent);

    return () => {
      window.removeEventListener('pasma_save_success', handleSyncEvent);
      window.removeEventListener('pasma_sync_success', handleSyncEvent);
      window.removeEventListener('pasma_db_sync_update', handleSyncEvent);
    };
  }, []);

  // Update relative time calculation every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const getRelativeTimeString = () => {
    if (!lastSyncTime) {
      return language === 'en' ? 'Pending...' : 'En attente...';
    }

    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 0) {
      return language === 'en' ? 'Just now' : "À l'instant";
    }

    if (diffSec < 10) {
      return language === 'en' ? 'Just now' : "À l'instant";
    }

    if (diffSec < 60) {
      return language === 'en' ? `${diffSec}s ago` : `Il y a ${diffSec}s`;
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return language === 'en' ? `${diffMin}m ago` : `Il y a ${diffMin} min`;
    }

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      return language === 'en' ? `${diffHours}h ago` : `Il y a ${diffHours}h`;
    }

    return lastSyncTime.toLocaleTimeString(language === 'en' ? 'en-US' : 'fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAbsoluteTimeString = () => {
    if (!lastSyncTime) return '';
    return lastSyncTime.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  };

  return (
    <div
      id="firestore-sync-indicator"
      className="text-[8px] md:text-[9.5px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 font-bold px-2.5 py-0.5 md:py-1 rounded-lg flex items-center gap-1.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-850 cursor-help shrink-0"
      title={`${language === 'en' ? 'Last successful Firestore sync:' : 'Dernière synchronisation Firestore réussie :'} ${getAbsoluteTimeString()}`}
    >
      <div className="relative flex items-center justify-center">
        <RefreshCw 
          className={`h-2.5 w-2.5 text-indigo-500 dark:text-amber-400 shrink-0 ${
            isSyncingAnimate ? 'animate-spin text-emerald-500 dark:text-emerald-400' : 'animate-pulse'
          }`} 
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="hidden sm:inline opacity-70 font-medium">
          {language === 'en' ? 'Cloud Sync:' : 'Sync Firestore :'}
        </span>
        <span className="font-mono text-slate-700 dark:text-slate-200">
          {getRelativeTimeString()}
        </span>
      </div>
    </div>
  );
}
