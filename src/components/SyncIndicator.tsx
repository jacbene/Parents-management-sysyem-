import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { isOffline as isOfflineCheck } from '../firebase';

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
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    return isOfflineCheck();
  });

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

    const handleConnectionChange = () => {
      setIsOfflineMode(isOfflineCheck());
    };

    // Listen to database snapshot pushes and successful write events
    window.addEventListener('pasma_save_success', handleSyncEvent);
    window.addEventListener('pasma_sync_success', handleSyncEvent);
    window.addEventListener('pasma_db_sync_update', handleSyncEvent);
    window.addEventListener('pasma_refuge_saved', handleSyncEvent);
    window.addEventListener('pasma_connection_changed', handleConnectionChange);
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);

    return () => {
      window.removeEventListener('pasma_save_success', handleSyncEvent);
      window.removeEventListener('pasma_sync_success', handleSyncEvent);
      window.removeEventListener('pasma_db_sync_update', handleSyncEvent);
      window.removeEventListener('pasma_refuge_saved', handleSyncEvent);
      window.removeEventListener('pasma_connection_changed', handleConnectionChange);
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
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
      className={`text-[8px] md:text-[9.5px] border font-bold px-2.5 py-0.5 md:py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-help shrink-0 ${
        isOfflineMode
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300'
          : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-850'
      }`}
      title={
        isOfflineMode
          ? language === 'en'
            ? 'Refuge Mode Active: Consulting local cache safely until network reconnects.'
            : 'Mode Refuge Actif : Données lues depuis le cache local sécurisé en attente de reconnexion réseau.'
          : `${language === 'en' ? 'Network-First Real-time Sync Active. Last sync:' : 'Synchronisation Réseau en temps réel active. Dernière synchro :'} ${getAbsoluteTimeString()}`
      }
    >
      <div className="relative flex items-center justify-center">
        {isOfflineMode ? (
          <ShieldCheck className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <RefreshCw 
            className={`h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 shrink-0 ${
              isSyncingAnimate ? 'animate-spin text-indigo-500 dark:text-indigo-400' : 'animate-pulse'
            }`} 
          />
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="hidden sm:inline opacity-80 font-medium">
          {isOfflineMode 
            ? (language === 'en' ? 'Cache Refuge:' : 'Refuge Local :')
            : (language === 'en' ? 'Live Cloud:' : 'Réseau Direct :')}
        </span>
        <span className="font-mono font-semibold">
          {isOfflineMode
            ? (language === 'en' ? 'Safe Offline' : 'Actif hors-ligne')
            : getRelativeTimeString()}
        </span>
      </div>
    </div>
  );
}
