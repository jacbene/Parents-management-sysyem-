import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  X, 
  Award, 
  MessageSquare, 
  CreditCard, 
  BookOpen, 
  Calendar, 
  UserCheck, 
  FileText, 
  HelpCircle, 
  Plus, 
  Search, 
  Bell, 
  Sparkles, 
  PieChart, 
  HardDrive,
  CheckCircle2,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useLanguage } from '../utils/TranslationContext';

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  roles?: Array<'teacher' | 'parent' | 'manager'>;
  category: 'pedagogy' | 'finance' | 'support';
  actionKey?: string;
}

interface QuickActionsMenuProps {
  activeTab: string;
  onNavigateTab: (tabName: any) => void;
  portalUserRole?: 'manager' | 'parent' | 'teacher' | null;
}

export default function QuickActionsMenu({
  activeTab,
  onNavigateTab,
  portalUserRole
}: QuickActionsMenuProps) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastActionToast, setLastActionToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard shortcut: Escape closes menu, Ctrl+K or Alt+Q opens quick actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
      if ((e.altKey && e.key.toLowerCase() === 'q') || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Master definitions of all quick actions
  const allActions: QuickActionItem[] = [
    {
      id: 'add_grade',
      title: language === 'en' ? 'Add a Grade' : 'Ajouter une Note',
      description: language === 'en' ? 'Record exam score for a student' : 'Saisir une évaluation ou note d\'élève',
      tab: 'grades',
      icon: Award,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50',
      borderColor: 'border-amber-200 dark:border-amber-800/50',
      roles: ['teacher', 'manager'],
      category: 'pedagogy',
      actionKey: 'add_grade'
    },
    {
      id: 'send_message',
      title: language === 'en' ? 'Send Message' : 'Envoyer un Message',
      description: language === 'en' ? 'Direct message teachers or parents' : 'Échanger directement avec un parent ou prof',
      tab: 'messages',
      icon: MessageSquare,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
      borderColor: 'border-indigo-200 dark:border-indigo-800/50',
      category: 'pedagogy',
      actionKey: 'compose_message'
    },
    {
      id: 'add_homework',
      title: language === 'en' ? 'Add Homework' : 'Nouveau Devoir',
      description: language === 'en' ? 'Publish homework in the textbook' : 'Publier un travail à faire à la maison',
      tab: 'homework',
      icon: BookOpen,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50',
      borderColor: 'border-blue-200 dark:border-blue-800/50',
      roles: ['teacher', 'manager'],
      category: 'pedagogy',
      actionKey: 'add_homework'
    },
    {
      id: 'add_lesson',
      title: language === 'en' ? 'Add Lesson Record' : 'Cahier de Textes',
      description: language === 'en' ? 'Record lesson progress' : 'Saisir un résumé de chapitre ou cours',
      tab: 'lessons',
      icon: FileText,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50',
      borderColor: 'border-sky-200 dark:border-sky-800/50',
      roles: ['teacher', 'manager'],
      category: 'pedagogy',
      actionKey: 'add_lesson'
    },
    {
      id: 'take_attendance',
      title: language === 'en' ? 'Class Roll Call' : 'Prendre l\'Assiduité',
      description: language === 'en' ? 'Mark absences and tardiness' : 'Notifier une absence ou un retard',
      tab: 'attendance',
      icon: UserCheck,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50',
      borderColor: 'border-rose-200 dark:border-rose-800/50',
      roles: ['teacher', 'manager'],
      category: 'pedagogy',
      actionKey: 'take_attendance'
    },
    {
      id: 'view_billing',
      title: language === 'en' ? 'View Billing & Fees' : 'Consulter la Facturation',
      description: language === 'en' ? 'Check school fees, APEE & receipts' : 'Vérifier l\'état des cotisations et factures',
      tab: 'billing',
      icon: CreditCard,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
      borderColor: 'border-emerald-200 dark:border-emerald-800/50',
      category: 'finance',
      actionKey: 'view_billing'
    },
    {
      id: 'apee_receipt',
      title: language === 'en' ? 'Record APEE Receipt' : 'Saisir Reçu APEE',
      description: language === 'en' ? 'Record payment entry for parent fees' : 'Enregistrer un paiement de cotisation APEE',
      tab: 'apee_recording',
      icon: Plus,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50',
      borderColor: 'border-violet-200 dark:border-violet-800/50',
      roles: ['manager'],
      category: 'finance',
      actionKey: 'apee_receipt'
    },
    {
      id: 'schedule_appointment',
      title: language === 'en' ? 'Schedule Meeting' : 'Prendre Rendez-vous',
      description: language === 'en' ? 'Book a parent-teacher appointment' : 'Demander ou fixer une rencontre',
      tab: 'appointments',
      icon: Calendar,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50',
      borderColor: 'border-teal-200 dark:border-teal-800/50',
      category: 'pedagogy',
      actionKey: 'add_appointment'
    },
    {
      id: 'view_announcements',
      title: language === 'en' ? 'Announcements' : 'Communiqués Officiels',
      description: language === 'en' ? 'Read circulars and notices' : 'Consulter les notes et informations d\'école',
      tab: 'announcements',
      icon: Bell,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50',
      borderColor: 'border-purple-200 dark:border-purple-800/50',
      category: 'support'
    },
    {
      id: 'help_center',
      title: language === 'en' ? 'Help & Support' : 'Centre d\'Assistance',
      description: language === 'en' ? 'Guides, FAQ & Technical Support' : 'Guides d\'utilisation, FAQ & Assistance',
      tab: 'help_center',
      icon: HelpCircle,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/60',
      borderColor: 'border-slate-200 dark:border-slate-800',
      category: 'support'
    }
  ];

  // Filter actions based on role and search query
  const filteredActions = allActions.filter(action => {
    // Role filter
    if (action.roles && portalUserRole && !action.roles.includes(portalUserRole as any)) {
      return false;
    }
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        action.title.toLowerCase().includes(q) ||
        action.description.toLowerCase().includes(q) ||
        action.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleTriggerAction = (action: QuickActionItem) => {
    // 1. Switch to target tab
    onNavigateTab(action.tab);

    // 2. Dispatch custom event so target component can trigger specific form modal if needed
    if (action.actionKey) {
      window.dispatchEvent(
        new CustomEvent('pasma_trigger_quick_action', {
          detail: { actionKey: action.actionKey, tab: action.tab }
        })
      );
    }

    // 3. Show brief notification feedback
    setLastActionToast(action.title);
    setTimeout(() => setLastActionToast(null), 3000);

    // 4. Close menu
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Toast Notification */}
      <AnimatePresence>
        {lastActionToast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-3 px-4 py-2.5 bg-slate-900/90 dark:bg-slate-800 text-white text-xs font-medium rounded-xl shadow-xl backdrop-blur-md border border-slate-700/50 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Redirection vers : <strong className="text-white">{lastActionToast}</strong></span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Menu Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="mb-4 w-[340px] sm:w-[400px] max-h-[80vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col text-slate-800 dark:text-slate-100"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
                  <Zap className="h-4 w-4 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight">
                    {language === 'en' ? 'Quick Actions' : 'Actions Rapides'}
                  </h3>
                  <p className="text-[11px] text-indigo-100 opacity-90">
                    {language === 'en' ? 'Instant access across the portal' : 'Raccourcis rapides toutes rubriques'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'en' ? 'Search task or shortcut...' : 'Rechercher une action ou tâche...'}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-slate-800 dark:text-slate-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Action Items List */}
            <div className="p-2 overflow-y-auto space-y-1 max-h-[380px] custom-scrollbar">
              {filteredActions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {language === 'en' ? 'No quick action matching search' : 'Aucune action ne correspond à la recherche'}
                </div>
              ) : (
                filteredActions.map((action) => {
                  const Icon = action.icon;
                  const isActive = activeTab === action.tab;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleTriggerAction(action)}
                      className={`w-full p-2.5 text-left rounded-xl border transition-all flex items-center justify-between group ${action.bgColor} ${action.borderColor} ${
                        isActive ? 'ring-2 ring-indigo-500/40 shadow-xs' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-white dark:bg-slate-800 shadow-xs ${action.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            {action.title}
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-full font-medium">
                                Actif
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer with shortcut info */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between px-3">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-500" />
                {portalUserRole ? `Mode : ${portalUserRole.toUpperCase()}` : 'Portail ENT'}
              </span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-[9px] text-slate-500">
                Alt + Q
              </kbd>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Trigger Button */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative flex items-center gap-2 px-4 py-3 rounded-full shadow-xl transition-all duration-300 font-medium text-xs text-white ${
          isOpen
            ? 'bg-slate-900 dark:bg-slate-800 ring-2 ring-slate-400'
            : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25 ring-2 ring-indigo-400/30'
        }`}
        title="Actions Rapides (Alt + Q)"
      >
        <div className="relative">
          {isOpen ? (
            <X className="h-4 w-4 transition-transform duration-300 rotate-90" />
          ) : (
            <Zap className="h-4 w-4 text-amber-300 animate-bounce" />
          )}
        </div>
        <span className="font-semibold tracking-wide hidden sm:inline">
          {isOpen 
            ? (language === 'en' ? 'Close' : 'Fermer') 
            : (language === 'en' ? 'Quick Actions' : 'Actions Rapides')}
        </span>
        {!isOpen && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          </span>
        )}
      </motion.button>
    </div>
  );
}
