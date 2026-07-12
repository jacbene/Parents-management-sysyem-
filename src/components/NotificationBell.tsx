import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCheck, Trash2, ShieldAlert, BadgeInfo, Play, PlusCircle, Volume2 } from 'lucide-react';
import { useLocalNotifications, LocalNotification } from '../utils/LocalNotificationContext';
import { useLanguage } from '../utils/TranslationContext';

interface NotificationBellProps {
  portalUserRole: 'parent' | 'manager' | null;
  selectedStudentName?: string;
}

export default function NotificationBell({ portalUserRole, selectedStudentName = "Pupille" }: NotificationBellProps) {
  const { t } = useLanguage();
  const {
    notifications,
    unreadCount,
    permissionStatus,
    requestPermission,
    triggerNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    onNavigateToTab
  } = useLocalNotifications();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop talking when dropdown closes or on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = (id: string, title: string, body: string) => {
    if (!('speechSynthesis' in window)) {
      alert(isEn ? 'Speech synthesis is not supported on this browser.' : 'La synthèse vocale n\'est pas supportée par votre appareil.');
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      utteranceRef.current = null;
    } else {
      window.speechSynthesis.cancel();
      
      const cleanTitle = title.replace(/[#*_`~[\]]/g, '');
      const cleanBody = body.replace(/[#*_`~[\]]/g, '');
      
      const utterance = new SpeechSynthesisUtterance(`${cleanTitle}. ${cleanBody}`);
      utteranceRef.current = utterance; // Avoid Garbage Collection in Chrome/Safari
      
      const targetLang = language === 'en' ? 'en-US' : 'fr-FR';
      utterance.lang = targetLang;
      
      if ('getVoices' in window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        const preferredLang = language === 'en' ? 'en' : 'fr';
        const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(preferredLang))
          || voices.find(v => v.lang.toLowerCase().includes(preferredLang));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      utterance.onstart = () => {
        setSpeakingId(id);
      };

      utterance.onend = () => {
        setSpeakingId(null);
        utteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        console.warn("Notification speech error:", e);
        setSpeakingId(null);
        utteranceRef.current = null;
      };

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick interactive sandbox test simulator
  const handleSimulateGrade = () => {
    const subjects = ['Mathématiques', 'Sciences de la Vie et de la Terre', 'Anglais', 'Physique-Chimie', 'Histoire-Géographie'];
    const randomSubj = subjects[Math.floor(Math.random() * subjects.length)];
    const score = Math.floor(Math.random() * 5) + 15; // 15 to 19
    const student = selectedStudentName || "Yannick";
    
    triggerNotification(
      t('notif.grade_added_title'),
      t('notif.grade_added_body', { student, score, maxScore: 20, subject: randomSubj }),
      'grade',
      student,
      randomSubj,
      'grades'
    );
  };

  const handleSimulateHomework = () => {
    const homeworks = [
      { subject: 'Physique', title: 'Rapport d\'expérience sur l\'optique' },
      { subject: 'Mathématiques', title: 'Exercices 5 et 6 page 42' },
      { subject: 'Histoire', title: 'Fiche de synthèse sur l\'Afrique équatoriale' },
      { subject: 'Anglais', title: 'Essai de 250 mots sur le changement climatique' }
    ];
    const randHw = homeworks[Math.floor(Math.random() * homeworks.length)];
    const student = selectedStudentName || "Yannick";
    const dueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });

    triggerNotification(
      t('notif.homework_added_title'),
      t('notif.homework_added_body', { student, subject: randHw.subject, title: randHw.title, dueDate }),
      'homework',
      student,
      randHw.subject,
      'homework'
    );
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef} id="push_notification_bell_container">
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-650 rounded-2xl cursor-pointer transition-all border border-slate-200/80 hover:border-indigo-200/50"
        title="Centre de notifications locales / Push"
      >
        <Bell className="h-5 w-5" />
        
        {/* Pulsating badge count */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white animate-in zoom-in duration-300">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
            <span className="relative z-10">{unreadCount}</span>
          </span>
        )}
      </button>

      {/* DROPDOWN DRAWER PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden z-50 text-slate-900 ring-1 ring-black/5"
          >
            {/* PANEL HEADER */}
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="text-xs font-black tracking-tight uppercase tracking-wider">
                  {t('notif.recent_alerts')}
                </h3>
              </div>
              
              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => markAllAsRead()}
                      className="p-1 px-2.5 text-[10px] font-bold text-indigo-300 hover:text-white bg-indigo-900/30 hover:bg-indigo-900/60 rounded-lg cursor-pointer transition flex items-center gap-1"
                      title={t('notif.mark_read')}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {t('notif.mark_read').split(' ')[1] || 'Tout lu'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => clearAll()}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg cursor-pointer transition"
                      title={t('notif.clear_all')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* NOTIFICATION PERMISSION BAR */}
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <BadgeInfo className="h-4 w-4 text-indigo-650 shrink-0 mt-0.5" />
                <p className="text-[10px] text-indigo-905 font-bold leading-normal">
                  {permissionStatus === 'granted'
                    ? t('notif.permission_authorized')
                    : permissionStatus === 'denied'
                      ? t('notif.permission_denied')
                      : t('notif.enable_prompt')}
                </p>
              </div>

              {permissionStatus === 'default' && (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-lg shadow-2xs hover:shadow-sm cursor-pointer transition text-center"
                >
                  {t('notif.authorize_btn')}
                </button>
              )}
              
              {permissionStatus === 'unsupported' && (
                <p className="text-[9px] text-indigo-600 font-bold italic">
                  ℹ️ {t('notif.unsupported')}
                </p>
              )}
            </div>

            {/* NOTIFICATION LOG LIST */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100/80">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Bell className="h-8 w-8 mx-auto opacity-30 animate-pulse text-indigo-500" />
                  <p className="text-xs font-semibold">{t('notif.no_alerts')}</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 relative ${
                      !notif.read ? 'bg-indigo-50/20' : ''
                    }`}
                    onClick={() => {
                      markAsRead(notif.id);
                      if (onNavigateToTab) {
                        onNavigateToTab(notif.targetTab);
                      }
                      setIsOpen(false);
                    }}
                  >
                    {/* Unread circle bubble */}
                    {!notif.read && (
                      <span className="absolute top-4 left-3.5 h-1.5 w-1.5 rounded-full bg-indigo-600" />
                    )}

                    <div className="shrink-0 h-8 w-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center mt-1">
                      {notif.type === 'grade' ? (
                        <span>📝</span>
                      ) : (
                        <span>📚</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                          {notif.type === 'grade' ? t('tab.grades') : t('tab.homework')}
                        </span>
                        <span className="text-[9px] text-slate-400 text-right">
                          {new Date(notif.timestamp).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h4 className="text-[11.5px] font-black text-slate-850 mt-0.5 min-w-0 truncate">
                        {notif.title}
                      </h4>
                      <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed font-sans line-clamp-2">
                        {notif.body}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(notif.id, notif.title, notif.body);
                        }}
                        className={`p-1.5 rounded-lg cursor-pointer transition-all border shadow-2xs ${
                          speakingId === notif.id 
                            ? 'text-indigo-650 bg-indigo-50 border-indigo-200 animate-pulse' 
                            : 'text-slate-500 hover:text-indigo-650 hover:bg-indigo-50/50 border-transparent hover:border-indigo-100'
                        }`}
                        title={isEn ? "Listen to notification (Text to Speech)" : "Écouter l'alerte (Synthèse Vocale)"}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearNotification(notif.id);
                        }}
                        className="p-1.5 text-slate-350 hover:text-rose-500 rounded-lg hover:bg-rose-50/50 hover:border-rose-100 border border-transparent cursor-pointer self-center transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TEST SANDBOX SIMULATOR CONTAINER */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                ⚙️ Sandbox Simulator
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleSimulateGrade}
                  className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[9.5px] font-black rounded-xl cursor-pointer transition flex items-center justify-center gap-1 border border-slate-800 shadow-tiny shrink-0"
                >
                  <PlusCircle className="h-3 w-3 text-indigo-400" />
                  + Note
                </button>
                <button
                  type="button"
                  onClick={handleSimulateHomework}
                  className="py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-[9.5px] font-black rounded-xl cursor-pointer transition flex items-center justify-center gap-1 border border-indigo-150/50 shrink-0"
                >
                  <PlusCircle className="h-3 w-3 text-indigo-650" />
                  + Devoir
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
