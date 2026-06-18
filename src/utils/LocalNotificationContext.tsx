import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, GraduationCap, BookOpen, Volume2, X, Check, CreditCard } from 'lucide-react';
import { useLanguage } from './TranslationContext';

export interface LocalNotification {
  id: string;
  title: string;
  body: string;
  type: 'grade' | 'homework' | 'invoice';
  studentName: string;
  subject: string;
  timestamp: string;
  read: boolean;
  targetTab: 'grades' | 'homework' | 'billing';
}

interface LocalNotificationContextType {
  notifications: LocalNotification[];
  unreadCount: number;
  permissionStatus: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<boolean>;
  triggerNotification: (
    title: string,
    body: string,
    type: 'grade' | 'homework' | 'invoice',
    studentName: string,
    subject: string,
    targetTab: 'grades' | 'homework' | 'billing'
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  activeToast: LocalNotification | null;
  setActiveToast: (toast: LocalNotification | null) => void;
  onNavigateToTab?: (tab: 'grades' | 'homework' | 'billing') => void;
}

const LocalNotificationContext = createContext<LocalNotificationContextType | undefined>(undefined);

export function useLocalNotifications() {
  const context = useContext(LocalNotificationContext);
  if (!context) {
    throw new Error('useLocalNotifications must be used within a LocalNotificationProvider');
  }
  return context;
}

interface LocalNotificationProviderProps {
  children: React.ReactNode;
  onNavigateToTab?: (tab: 'grades' | 'homework' | 'billing') => void;
}

export function LocalNotificationProvider({ children, onNavigateToTab }: LocalNotificationProviderProps) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [activeToast, setActiveToast] = useState<LocalNotification | null>(null);
  
  // Track toast display timeout
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('local_notifications_history');
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading notification history:', e);
    }

    // Check system notification permission
    if (!('Notification' in window)) {
      setPermissionStatus('unsupported');
    } else {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Sync notifications to localStorage
  const saveNotifications = (updated: LocalNotification[]) => {
    setNotifications(updated);
    try {
      localStorage.setItem('local_notifications_history', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving notification history:', e);
    }
  };

  // Sound chime synthesizer
  const playSynthesizedChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Node architecture
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sine';
      // Harmonic pleasant double ding
      osc1.frequency.setValueAtTime(554.37, ctx.currentTime); // C#5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(277.18, ctx.currentTime); // C#4
      osc2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15); // A4
      
      gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.6);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (error) {
      console.log('Synthesized chime skipped (requires user interaction or context resume):', error);
    }
  };

  // Request native permission
  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setPermissionStatus('unsupported');
      return false;
    }
    
    try {
      const status = await Notification.requestPermission();
      setPermissionStatus(status);
      return status === 'granted';
    } catch (e) {
      console.error('Permission request failed:', e);
      return false;
    }
  };

  // Core trigger notifier
  const triggerNotification = (
    title: string,
    body: string,
    type: 'grade' | 'homework' | 'invoice',
    studentName: string,
    subject: string,
    targetTab: 'grades' | 'homework' | 'billing'
  ) => {
    const newNotif: LocalNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title,
      body,
      type,
      studentName,
      subject,
      timestamp: new Date().toISOString(),
      read: false,
      targetTab,
    };

    // Update notifications history list
    saveNotifications([newNotif, ...notifications]);

    // 1. Play delicate sound chime
    playSynthesizedChime();

    // 2. Trigger active in-app floating banner/toast alert
    setActiveToast(newNotif);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 7500); // clear after 7.5 seconds

    // 3. Trigger native platform push notification if granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const iconUrl = type === 'grade' ? '/grades-icon.png' : '/homeworks-icon.png';
        const browserNotif = new Notification(title, {
          body,
          icon: iconUrl,
          tag: newNotif.id,
          requireInteraction: false
        });
        browserNotif.onclick = () => {
          window.focus();
          markAsRead(newNotif.id);
          if (onNavigateToTab) {
            onNavigateToTab(targetTab);
          }
          browserNotif.close();
        };
      } catch (err) {
        console.warn('Native local push notification execution failed:', err);
      }
    }
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const clearNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    saveNotifications(updated);
    if (activeToast?.id === id) {
      setActiveToast(null);
    }
  };

  const clearAll = () => {
    saveNotifications([]);
    setActiveToast(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <LocalNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        permissionStatus,
        requestPermission,
        triggerNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        activeToast,
        setActiveToast,
        onNavigateToTab
      }}
    >
      {children}

      {/* FLOATING PUSH NOTIFICATION SYSTEM TOAST / INSIDE COMPONENT MOUNT */}
      <AnimatePresence>
        {activeToast && (
          <div className="fixed top-4 right-4 z-50 w-full max-w-sm px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className="bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-xl p-4 flex items-start gap-3 pointer-events-auto cursor-pointer select-none ring-1 ring-white/10 hover:bg-slate-850 transition duration-200"
              onClick={() => {
                markAsRead(activeToast.id);
                if (onNavigateToTab) {
                  onNavigateToTab(activeToast.targetTab);
                }
                setActiveToast(null);
              }}
            >
              <div className="mt-0.5 shrink-0 p-2.5 rounded-xl bg-indigo-650 text-indigo-100 shadow-sm">
                {activeToast.type === 'grade' ? (
                  <GraduationCap className="h-5 w-5" />
                ) : activeToast.type === 'homework' ? (
                  <BookOpen className="h-5 w-5" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                    {activeToast.type === 'grade' ? '📝 ' + t('tab.grades') : activeToast.type === 'homework' ? '📚 ' + t('tab.homework') : '💳 ' + t('tab.billing')}
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 font-mono">
                    {new Date(activeToast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1 line-clamp-1">{activeToast.title}</h4>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed font-sans">{activeToast.body}</p>
                <div className="flex items-center gap-1.5 mt-2.5 text-[9.5px] font-bold text-indigo-300 uppercase tracking-widest hover:text-indigo-200 transition-colors">
                  <span>{t('msg.back')} &rarr;</span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveToast(null);
                }}
                className="shrink-0 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </LocalNotificationContext.Provider>
  );
}
