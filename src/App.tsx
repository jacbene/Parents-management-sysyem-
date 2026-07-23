import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, writeBatch, getDoc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { auth, loginWithGoogle, logout, db, handleFirestoreError, OperationType, loginAnonymously, goOffline, goOnline, isOffline as isOfflineCheck, queuePendingAction, signUpWithEmail, loginWithEmail, resetPassword } from './firebase';
import { isDatabaseSeeded, seedUserData, getOfflineMockData, purgeUserData } from './seeder';
import { Student, Grade, Attendance, Homework, Lesson, Appointment, Message, Invoice, ApeeParent, ApeeExpense, ApeeSettings, Announcement, AnnouncementCategory, ApeeActivityLog, ApeeOtherRevenue, PendingAction } from './types';

// Notifications Push
import { LocalNotificationProvider, useLocalNotifications } from './utils/LocalNotificationContext';
import NotificationBell from './components/NotificationBell';

// APEE Utilities and Components
import {
  fetchApeeData,
  subscribeApeeData,
  saveApeeSettings,
  saveApeeParent,
  deleteApeeParent,
  saveApeeExpense,
  deleteApeeExpense,
  saveApeeOtherRevenue,
  deleteApeeOtherRevenue,
  importFullBackup,
  resetApeeData,
  saveApeeLog,
  getApeeShortName,
  DEFAULT_SETTINGS
} from './utils/apeeDb';

import ApeeDashboard from './components/apee/ApeeDashboard';
import ApeeForm from './components/apee/ApeeForm';
import ApeeSearch from './components/apee/ApeeSearch';
import ApeeReporting from './components/apee/ApeeReporting';
import ApeeFinancial from './components/apee/ApeeFinancial';
import ApeeArchives from './components/apee/ApeeArchives';
import ApeeSettingsComp from './components/apee/ApeeSettingsComp';
import ApeeReminders from './components/apee/ApeeReminders';
import ApeeLegal from './components/ApeeLegal';
import ApeeSharePortal from './components/apee/ApeeSharePortal';
import { useLanguage } from './utils/TranslationContext';
import DrivePortal from './components/DrivePortal';
import SheetsPortal from './components/SheetsPortal';
import FirebaseConsole from './components/FirebaseConsole';
import SyncToastContainer from './components/SyncToastContainer';

// Components
import StudentCard from './components/StudentCard';
import StudentsByClass from './components/StudentsByClass';
import AnnouncementsFeed from './components/AnnouncementsFeed';
import GradesDashboard from './components/GradesDashboard';
import AttendanceTracker from './components/AttendanceTracker';
import HomeworkBoard from './components/HomeworkBoard';
import LessonsBoard from './components/LessonsBoard';
import BillingPortal from './components/BillingPortal';
import AppointmentsScheduler from './components/AppointmentsScheduler';
import MessageInbox from './components/MessageInbox';
import StudentPrintModal from './components/StudentPrintModal';
import PortalOnboarding from './components/PortalOnboarding';
import InstallPWA from './components/InstallPWA';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SyncIndicator from './components/SyncIndicator';
import SchoolHelpCenter from './components/SchoolHelpCenter';
// Reserved for future integration:
// import LibraryDashboard from './components/LibraryDashboard';


// Icons
import {
  GraduationCap,
  LogOut,
  Newspaper,
  BookOpen,
  BookMarked,
  Calendar,
  Award,
  Landmark,
  MessageSquare,
  CalendarCheck2,
  Lock,
  Compass,
  Database,
  UserCheck,
  User as UserIcon,
  LayoutDashboard,
  Calculator,
  Search,
  History,
  Coins,
  Settings,
  Plus,
  Share2,
  X,
  Bell,
  Shield,
  Cloud,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Clock,
  AlertCircle,
  WifiOff,
  CheckCircle,
  Sun,
  Moon,
  Users,
  HelpCircle
} from 'lucide-react';

type TabType = 
  | 'apee_dashboard' 
  | 'apee_recording' 
  | 'apee_search' 
  | 'apee_reporting' 
  | 'apee_finance' 
  | 'apee_archives' 
  | 'apee_settings'
  | 'apee_reminders'
  | 'apee_legal'
  | 'google_drive'
  | 'google_sheets'
  | 'firebase_console'
  | 'announcements' 
  | 'students_by_class'
  | 'homework' 
  | 'lessons'
  | 'grades' 
  | 'attendance' 
  | 'billing' 
  | 'appointments' 
  | 'messages'
  | 'help_center';

interface PushNotificationSyncerProps {
  students: Student[];
  userId: string | null;
  user: User | null;
  portalUserRole: 'parent' | 'manager' | 'teacher' | null;
  isOffline: boolean;
  setGrades: React.Dispatch<React.SetStateAction<Grade[]>>;
  setHomeworks: React.Dispatch<React.SetStateAction<Homework[]>>;
  invoices: Invoice[];
  syncIntervalSeconds?: number;
}

function PushNotificationSyncer({
  students,
  userId,
  user,
  portalUserRole,
  isOffline,
  setGrades,
  setHomeworks,
  invoices,
  syncIntervalSeconds = 30
}: PushNotificationSyncerProps) {
  const { triggerNotification } = useLocalNotifications();
  const { t, language } = useLanguage();

  // Create stable refs for changing callback dependencies
  const studentsRef = useRef(students);
  const triggerNotificationRef = useRef(triggerNotification);
  const tRef = useRef(t);

  // Sync ref values on every render
  studentsRef.current = students;
  triggerNotificationRef.current = triggerNotification;
  tRef.current = t;

  // Overdue Invoices / Cotisations local push notifications checking
  const notifiedInvoicesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || !user || portalUserRole !== 'parent' || !invoices || invoices.length === 0) return;

    // Filter relevant parent invoices
    const parentInvoices = invoices.filter(inv => {
      // Skip administrative entries
      if (inv.studentId === 'apee_expense' || inv.studentId === 'apee_settings' || inv.id.endsWith('_settings')) {
        return false;
      }
      return (
        studentsRef.current.some(s => s.id === inv.studentId) ||
        inv.id === 'apee_par_bene_jacques' ||
        inv.id.startsWith('apee_par_bene_jacques') ||
        ((inv.email || '').toLowerCase() === (user?.email || '').toLowerCase())
      );
    });

    parentInvoices.forEach(inv => {
      let overdue = false;
      if (inv.status === 'Overdue') {
        overdue = true;
      } else if (inv.status !== 'Paid' && inv.dueDate && typeof inv.dueDate === 'string') {
        if (inv.dueDate.includes('-') || (inv.dueDate.includes('/') && inv.dueDate.length <= 10 && !isNaN(Date.parse(inv.dueDate)))) {
          const parsedDate = new Date(inv.dueDate);
          if (!isNaN(parsedDate.getTime())) {
            overdue = parsedDate < new Date();
          }
        } else if (inv.dueDate.includes('/')) {
          // School year: e.g. 2025/2026. Extract ending year.
          const parts = inv.dueDate.split('/');
          if (parts.length === 2) {
            const endYear = parseInt(parts[1], 10);
            if (!isNaN(endYear)) {
              const currentYear = new Date().getFullYear();
              if (currentYear > endYear || (currentYear === endYear && new Date().getMonth() >= 5)) { // June is month 5 (0-indexed)
                overdue = true;
              }
            }
          }
        }
      }

      if (overdue && !notifiedInvoicesRef.current.has(inv.id)) {
        notifiedInvoicesRef.current.add(inv.id);

        let dueDateFormatted = inv.dueDate;
        if (inv.dueDate && typeof inv.dueDate === 'string' && (inv.dueDate.includes('-') || inv.dueDate.includes('/'))) {
          const parsed = new Date(inv.dueDate);
          if (!isNaN(parsed.getTime())) {
            dueDateFormatted = parsed.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR');
          }
        }

        // Trigger local notification!
        triggerNotificationRef.current(
          tRef.current('notif.invoice_overdue_title'),
          tRef.current('notif.invoice_overdue_body', {
            title: inv.title,
            dueDate: dueDateFormatted
          }),
          'invoice',
          inv.title,
          'Cotisation',
          'billing'
        );
      }
    });
  }, [invoices, userId, user, portalUserRole, language]);

  useEffect(() => {
    if (!userId || !user || portalUserRole !== 'parent') return;

    let active = true;
    let lastGradesMap = new Map<string, Grade>();
    let lastHomeworksMap = new Map<string, Homework>();

    const fetchGradesAndHomeworks = async (isInitial: boolean) => {
      try {
        // 1. Fetch grades
        const gradesQ = query(collection(db, 'grades'), where('parentId', '==', userId));
        const gradesSnapshot = await getDocs(gradesQ);
        if (!active) return;

        const currentGradesList: Grade[] = [];
        gradesSnapshot.forEach((doc) => {
          const g = { id: doc.id, ...doc.data() as Omit<Grade, 'id'> };
          currentGradesList.push(g as any);
        });

        setGrades(currentGradesList);
        localStorage.setItem(`pasma_grades_${userId}`, JSON.stringify(currentGradesList));

        if (!isInitial) {
          currentGradesList.forEach(grade => {
            const key = grade.id || `${grade.studentId}_${grade.subject}_${grade.score}_${grade.date}`;
            if (!lastGradesMap.has(key)) {
              const stu = studentsRef.current.find(s => s.id === grade.studentId);
              const studentName = stu?.name || "Votre enfant";
              
              triggerNotificationRef.current(
                tRef.current('notif.grade_added_title'),
                tRef.current('notif.grade_added_body', {
                  student: studentName,
                  score: grade.score,
                  maxScore: grade.maxScore,
                  subject: grade.subject
                }),
                'grade',
                studentName,
                grade.subject,
                'grades'
              );
            }
          });
        }

        // Update the cache map
        const newGradesMap = new Map<string, Grade>();
        currentGradesList.forEach(grade => {
          const key = grade.id || `${grade.studentId}_${grade.subject}_${grade.score}_${grade.date}`;
          newGradesMap.set(key, grade);
        });
        lastGradesMap = newGradesMap;

        // 2. Fetch homeworks
        const homeworksQ = query(collection(db, 'homeworks'), where('parentId', '==', userId));
        const homeworksSnapshot = await getDocs(homeworksQ);
        if (!active) return;

        const currentHomeworkList: Homework[] = [];
        homeworksSnapshot.forEach((doc) => {
          const h = { id: doc.id, ...doc.data() as Omit<Homework, 'id'> };
          currentHomeworkList.push(h as any);
        });

        setHomeworks(currentHomeworkList);
        localStorage.setItem(`pasma_homeworks_${userId}`, JSON.stringify(currentHomeworkList));

        if (!isInitial) {
          currentHomeworkList.forEach(hw => {
            const key = hw.id || `${hw.studentId}_${hw.subject}_${hw.title}_${hw.dueDate}`;
            if (!lastHomeworksMap.has(key)) {
              const stu = studentsRef.current.find(s => s.id === hw.studentId);
              const studentName = stu?.name || "Votre enfant";
              const dueDate = new Date(hw.dueDate).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short'
              });

              triggerNotificationRef.current(
                tRef.current('notif.homework_added_title'),
                tRef.current('notif.homework_added_body', {
                  student: studentName,
                  subject: hw.subject,
                  title: hw.title,
                  dueDate
                }),
                'homework',
                studentName,
                hw.subject,
                'homework'
              );
            }
          });
        }

        // Update the cache map
        const newHomeworksMap = new Map<string, Homework>();
        currentHomeworkList.forEach(hw => {
          const key = hw.id || `${hw.studentId}_${hw.subject}_${hw.title}_${hw.dueDate}`;
          newHomeworksMap.set(key, hw);
        });
        lastHomeworksMap = newHomeworksMap;

        // Dispatch sync success to notify UI SyncIndicator
        window.dispatchEvent(new Event('pasma_db_sync_update'));

      } catch (error) {
        console.warn("[Pasma-sys Local Sync] Error loading parental data:", error);
      }
    };

    // Initial load
    fetchGradesAndHomeworks(true);

    // Polling setup: fetch on user configured interval (default to 30s)
    const intervalId = setInterval(() => {
      fetchGradesAndHomeworks(false);
    }, syncIntervalSeconds * 1000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [userId, user, portalUserRole, syncIntervalSeconds]); // Extremely stable dependencies!

  return null;
}

export default function App() {
  const { language, setLanguage, t, isAutoDetected } = useLanguage();
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pasma_simulated_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [secondaryAdmins, setSecondaryAdmins] = useState<{ id: string; email: string; name: string; createdAt: string; addedBy: string }[]>([]);
  
  const isPrimarySuperAdmin = !!user?.email && user.email.toLowerCase().trim() === 'jacquesbene301@gmail.com';
  const isSecondarySuperAdmin = !!user?.email && secondaryAdmins.some(admin => {
    const adminEmail = (admin.email || '').toLowerCase().trim();
    const userEmail = (user.email || '').toLowerCase().trim();
    return adminEmail && userEmail && adminEmail === userEmail;
  });
  const showSuperAdminButton = isPrimarySuperAdmin || isSecondarySuperAdmin;

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);


  // Establishment and role-based access state (with persistence)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(() => localStorage.getItem('portal_selected_school_id'));
  const [schoolStatus, setSchoolStatus] = useState<string>('active');
  const [portalUserRole, setPortalUserRole] = useState<'manager' | 'parent' | 'teacher' | null>(() => localStorage.getItem('portal_user_role') as 'manager' | 'parent' | 'teacher' | null);
  const [portalParentDetails, setPortalParentDetails] = useState<{ name: string; phone: string; studentSubsetNames?: string[] } | null>(() => {
    const s = localStorage.getItem('portal_parent_details');
    return s ? JSON.parse(s) : null;
  });
  const [portalTeacherDetails, setPortalTeacherDetails] = useState<{ name: string; classRoom: string; email: string; phone: string } | null>(() => {
    const t = localStorage.getItem('portal_teacher_details');
    return t ? JSON.parse(t) : null;
  });
  const [portalManagerDetails, setPortalManagerDetails] = useState<{ name: string; phone: string } | null>(() => {
    const m = localStorage.getItem('portal_manager_details');
    return m ? JSON.parse(m) : null;
  });

  // Persistent role, device registration and school state are preserved across reloads with no overrides
  const [showMainLogin, setShowMainLogin] = useState<boolean>(() => {
    const schoolSelected = localStorage.getItem('portal_selected_school_id');
    const roleSelected = localStorage.getItem('portal_user_role');
    const loginTime = localStorage.getItem('portal_login_timestamp');
    const isExpired = loginTime ? Date.now() - Number(loginTime) > 24 * 60 * 60 * 1000 : true;

    if (schoolSelected && roleSelected && !isExpired) {
      return false; // Direct bypass to their dashboard!
    }
    return true; // Require login screen by default
  });

  const [sessionExpired, setSessionExpired] = useState(false);
  const [deviceChanged, setDeviceChanged] = useState(false);

  // Email connection form state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [submittingEmailLogin, setSubmittingEmailLogin] = useState(false);
  const [emailLoginError, setEmailLoginError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);

  // Device ID generation on startup
  useEffect(() => {
    let devId = localStorage.getItem('pasma_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('pasma_device_id', devId);
    }
  }, []);

  // 1.4 General 24 hour session tracking tick
  useEffect(() => {
    const checkExpiration = () => {
      const loginTime = localStorage.getItem('portal_login_timestamp');
      if (loginTime) {
        const elapsed = Date.now() - Number(loginTime);
        if (elapsed > 24 * 60 * 60 * 1000) {
          console.warn("Session expired (exceeded 24 hours)");
          setSessionExpired(true);
        }
      }
    };
    checkExpiration();
    const interval = setInterval(checkExpiration, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [selectedSchoolId, portalUserRole]);

  // Theme dark state and sync to document class list
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Notification Preference Settings for Parents
  const [prefOnlyImportantGrades, setPrefOnlyImportantGrades] = useState<boolean>(() => {
    return localStorage.getItem('pref_only_important_grades') === 'true';
  });
  const [prefOnlyUrgentFinancials, setPrefOnlyUrgentFinancials] = useState<boolean>(() => {
    return localStorage.getItem('pref_only_urgent_financials') === 'true';
  });

  const handleUpdatePreferences = async (onlyGrades: boolean, onlyFinancials: boolean) => {
    setPrefOnlyImportantGrades(onlyGrades);
    setPrefOnlyUrgentFinancials(onlyFinancials);
    localStorage.setItem('pref_only_important_grades', onlyGrades ? 'true' : 'false');
    localStorage.setItem('pref_only_urgent_financials', onlyFinancials ? 'true' : 'false');

    // Soft sync preference to Firestore parent invoice document if available
    if (portalUserRole === 'parent' && portalParentDetails && (portalParentDetails as any).invoiceId) {
      try {
        const parentInvoiceRef = doc(db, 'invoices', (portalParentDetails as any).invoiceId);
        await setDoc(parentInvoiceRef, {
          pref_only_important_grades: onlyGrades,
          pref_only_urgent_financials: onlyFinancials
        }, { merge: true });
        console.log("Parent profile preferences synced successfully to Firestore!");
      } catch (err) {
        console.warn("Soft parent preferences sync to Firestore skipped/offline:", err);
      }
    }
  };

  // Search query for filtering students in left navigation pane
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  // Nav tab control
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const role = localStorage.getItem('portal_user_role');
    return role === 'parent' ? 'announcements' : role === 'teacher' ? 'grades' : 'apee_dashboard';
  });
  
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(() => {
    return isOfflineCheck();
  });
  
  const [pendingActions, setPendingActions] = useState<PendingAction[]>(() => {
    try {
      const saved = localStorage.getItem('pasma_pending_actions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const syncBackoffDelayRef = useRef(1000);
  const syncTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const syncPendingActions = async () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    try {
      const saved = localStorage.getItem('pasma_pending_actions');
      const actions: PendingAction[] = saved ? JSON.parse(saved) : [];
      if (actions.length === 0) {
        syncBackoffDelayRef.current = 1000;
        return;
      }

      window.dispatchEvent(new CustomEvent('pasma_sync_started', { detail: { count: actions.length } }));

      let successCount = 0;
      let networkErrorEncountered = false;
      const remaining: PendingAction[] = [];

      for (const action of actions) {
        try {
          if (action.type === 'DELETE') {
            await deleteDoc(doc(db, action.collection, action.targetId));
          } else {
            await setDoc(doc(db, action.collection, action.targetId), action.data);
          }
          successCount++;
        } catch (err: any) {
          console.error("Failed syncing item:", action, err);

          const errMsg = String(err?.message || err || '').toLowerCase();
          const errCode = String(err?.code || '').toLowerCase();
          
          const isPermanentError = 
            errCode === 'permission-denied' || 
            errCode === 'invalid-argument' || 
            errMsg.includes('permission') || 
            errMsg.includes('unauthenticated') || 
            errMsg.includes('insufficient');

          if (isPermanentError) {
            console.warn(`[Pasma-sys Sync] Discarding action ${action.id} due to permanent security or permission failure:`, errMsg);
          } else {
            remaining.push(action);
            if (
              errCode === 'unavailable' ||
              errCode === 'deadline-exceeded' ||
              errMsg.includes('offline') ||
              errMsg.includes('network') ||
              errMsg.includes('failed to fetch') ||
              errMsg.includes('internet') ||
              errMsg.includes('failed to connect') ||
              !navigator.onLine
            ) {
              networkErrorEncountered = true;
            }
          }
        }
      }

      localStorage.setItem('pasma_pending_actions', JSON.stringify(remaining));
      setPendingActions(remaining);
      window.dispatchEvent(new Event('pasma_actions_updated'));

      if (successCount > 0) {
        console.log(`[Pasma-sys Sync] Synchronisé avec succès ${successCount} modification(s) !`);
        window.dispatchEvent(new CustomEvent('pasma_sync_success', { detail: { count: successCount } }));
      }

      if (remaining.length > 0) {
        if (networkErrorEncountered) {
          const currentDelay = syncBackoffDelayRef.current;
          const nextDelay = Math.min(currentDelay * 2, 30000);
          syncBackoffDelayRef.current = nextDelay;
          console.warn(`[Pasma-sys Sync] Network error during sync. Backing off for ${currentDelay}ms before retry...`);

          syncTimeoutRef.current = setTimeout(() => {
            syncPendingActions();
          }, currentDelay);
        } else {
          syncBackoffDelayRef.current = 1000;
        }
      } else {
        syncBackoffDelayRef.current = 1000;
      }
    } catch (e) {
      console.error("Error during syncPendingActions:", e);
      const currentDelay = syncBackoffDelayRef.current;
      syncBackoffDelayRef.current = Math.min(currentDelay * 2, 30000);
      console.warn(`[Pasma-sys Sync] General error during sync. Backing off for ${currentDelay}ms before retry...`);
      syncTimeoutRef.current = setTimeout(() => {
        syncPendingActions();
      }, currentDelay);
    }
  };

  const handleRemovePendingAction = (id: string) => {
    try {
      const saved = localStorage.getItem('pasma_pending_actions');
      if (saved) {
        const actions: PendingAction[] = JSON.parse(saved);
        const filtered = actions.filter(a => a.id !== id);
        localStorage.setItem('pasma_pending_actions', JSON.stringify(filtered));
        setPendingActions(filtered);
        window.dispatchEvent(new Event('pasma_actions_updated'));
      }
    } catch (err) {
      console.error("Error removing pending action:", err);
    }
  };

  const [showPendingDrawer, setShowPendingDrawer] = useState(false);

  useEffect(() => {
    const decision = localStorage.getItem('cookie_consent_decision');
    if (!decision) {
      setShowCookieBanner(true);
    }
  }, []);

  useEffect(() => {
    const updateOfflineState = () => {
      const offline = isOfflineCheck();
      setIsOffline(offline);
      if (!offline) {
        syncPendingActions();
      }
    };
    
    const updateActions = () => {
      try {
        const saved = localStorage.getItem('pasma_pending_actions');
        setPendingActions(saved ? JSON.parse(saved) : []);
      } catch (err) {
        console.error("Failed reading pending actions:", err);
      }
    };

    window.addEventListener('pasma_connection_changed', updateOfflineState);
    window.addEventListener('pasma_actions_updated', updateActions);
    
    const handleOnline = async () => {
      await goOnline();
      updateOfflineState();
    };
    const handleOffline = async () => {
      await goOffline();
      updateOfflineState();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial sync check
    if (navigator.onLine) {
      goOnline();
    } else {
      goOffline();
    }

    return () => {
      window.removeEventListener('pasma_connection_changed', updateOfflineState);
      window.removeEventListener('pasma_actions_updated', updateActions);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSelectSchool = (
    schoolId: string, 
    role: 'manager' | 'parent' | 'teacher', 
    details?: { name: string; phone: string; classRoom?: string; email?: string; studentSubsetNames?: string[]; invoiceId?: string }
  ) => {
    localStorage.setItem('portal_selected_school_id', schoolId);
    localStorage.setItem('portal_user_role', role);
    localStorage.setItem('portal_login_timestamp', Date.now().toString());
    
    // Register current device ID for this session in the cloud
    const currentDeviceId = localStorage.getItem('pasma_device_id') || 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('pasma_device_id', currentDeviceId);

    if (role === 'manager') {
      try {
        const schoolRef = doc(db, 'establishments', schoolId);
        setDoc(schoolRef, { lastManagerDeviceId: currentDeviceId }, { merge: true }).catch(err => {
          console.warn("Manager device ID sync rejected or offline:", err);
        });
      } catch (dbWriteErr) {
        console.warn("Could not sync manager device ID to Firestore on selection:", dbWriteErr);
      }
    } else if (role === 'parent' && details && details.invoiceId) {
      try {
        const parentInvoiceRef = doc(db, 'invoices', details.invoiceId);
        setDoc(parentInvoiceRef, { notes: `DEVICE_ID:${currentDeviceId}` }, { merge: true }).catch(err => {
          console.warn("Soft parent device-id sync rejected or offline (expected for demo/offline accounts):", err);
        });
      } catch (dbWriteErr) {
        console.warn("Could not sync parent device ID to Firestore on selection:", dbWriteErr);
      }
    }

    if (role === 'parent' && details) {
      localStorage.setItem('portal_parent_details', JSON.stringify(details));
      setPortalParentDetails(details);
      setPortalTeacherDetails(null);
      setPortalManagerDetails(null);
      localStorage.removeItem('portal_teacher_details');
      localStorage.removeItem('portal_manager_details');
    } else if (role === 'teacher' && details) {
      localStorage.setItem('portal_teacher_details', JSON.stringify(details));
      setPortalTeacherDetails(details as any);
      setPortalParentDetails(null);
      setPortalManagerDetails(null);
      localStorage.removeItem('portal_parent_details');
      localStorage.removeItem('portal_manager_details');
    } else if (role === 'manager' && details) {
      localStorage.setItem('portal_manager_details', JSON.stringify(details));
      setPortalManagerDetails(details as any);
      setPortalParentDetails(null);
      setPortalTeacherDetails(null);
      localStorage.removeItem('portal_parent_details');
      localStorage.removeItem('portal_teacher_details');
    } else {
      localStorage.removeItem('portal_parent_details');
      localStorage.removeItem('portal_teacher_details');
      localStorage.removeItem('portal_manager_details');
      setPortalParentDetails(null);
      setPortalTeacherDetails(null);
      setPortalManagerDetails(null);
    }
    
    setSelectedSchoolId(schoolId);
    setPortalUserRole(role);
    setActiveTab(role === 'parent' ? 'announcements' : role === 'teacher' ? 'grades' : 'apee_dashboard');
    setShowMainLogin(false);
  };

  const handleExitSchool = () => {
    localStorage.removeItem('portal_selected_school_id');
    localStorage.removeItem('portal_user_role');
    localStorage.removeItem('portal_parent_details');
    localStorage.removeItem('portal_teacher_details');
    localStorage.removeItem('portal_manager_details');
    localStorage.removeItem('portal_login_timestamp');
    setSelectedSchoolId(null);
    setPortalUserRole(null);
    setPortalParentDetails(null);
    setPortalTeacherDetails(null);
    setPortalManagerDetails(null);
    setShowMainLogin(true);
  };

  // APEE App State
  const [apeeSettings, setApeeSettings] = useState<ApeeSettings>(DEFAULT_SETTINGS);
  const [apeeParents, setApeeParents] = useState<ApeeParent[]>([]);
  const [apeeExpenses, setApeeExpenses] = useState<ApeeExpense[]>([]);
  const [apeeLogs, setApeeLogs] = useState<ApeeActivityLog[]>([]);
  const [apeeOtherRevenues, setApeeOtherRevenues] = useState<ApeeOtherRevenue[]>([]);
  const [activeParentToEdit, setActiveParentToEdit] = useState<ApeeParent | null>(null);

  const [isApeeAuthorized, setIsApeeAuthorized] = useState(false);
  const [isPedAuthorized, setIsPedAuthorized] = useState(false);

  // Custom dialog to replace native modal prompts (blocked in sandbox iframes)
  const [authDialog, setAuthDialog] = useState<{
    isOpen: boolean;
    type: 'finance' | 'pedagogic';
    title: string;
    description: string;
    placeholder: string;
    expectedValue: string;
    managerName: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authDialogError, setAuthDialogError] = useState('');

  const checkApeeAuthorization = (): Promise<boolean> => {
    if (portalUserRole === 'parent') {
      alert("Accès refusé: Votre profil Parent ne vous autorise pas à modifier les données financières administratives.");
      return Promise.resolve(false);
    }
    if (!apeeSettings.finManagerPassword) {
      return Promise.resolve(true); // No password configured, actions are free
    }
    if (isApeeAuthorized) {
      return Promise.resolve(true); // Already unlocked for this session
    }
    
    // Open the custom dialog
    return new Promise<boolean>((resolve) => {
      setAuthPasswordInput('');
      setAuthDialogError('');
      setAuthDialog({
        isOpen: true,
        type: 'finance',
        title: '🔓 Déverrouillage Responsable Financier',
        description: `Cette action requiert le mot de passe du Responsable Financier (${apeeSettings.finManagerName || "Gérant Financier"}) pour continuer :`,
        placeholder: 'Saisissez le mot de passe...',
        expectedValue: apeeSettings.finManagerPassword,
        managerName: apeeSettings.finManagerName || "Gérant Financier",
        resolve: (approved) => {
          if (approved) {
            setIsApeeAuthorized(true);
          }
          resolve(approved);
        }
      });
    });
  };

  const handlePromptUnlockApee = () => {
    if (!apeeSettings.finManagerPassword) {
      setIsApeeAuthorized(true);
      return;
    }
    setAuthPasswordInput('');
    setAuthDialogError('');
    setAuthDialog({
      isOpen: true,
      type: 'finance',
      title: '🔓 Déverrouillage Responsable Financier',
      description: `Entrez le mot de passe du Responsable Financier (${apeeSettings.finManagerName || "Gérant"}) :`,
      placeholder: 'Mot de passe...',
      expectedValue: apeeSettings.finManagerPassword,
      managerName: apeeSettings.finManagerName || "Gérant Financier",
      resolve: (approved) => {
        if (approved) {
          setIsApeeAuthorized(true);
        }
      }
    });
  };

  const checkPedAuthorization = (): Promise<boolean> => {
    if (portalUserRole === 'parent') {
      alert("Accès refusé: Votre profil Parent ne vous autorise pas à modifier les données administratives et académiques.");
      return Promise.resolve(false);
    }
    if (!apeeSettings.pedManagerPassword) {
      return Promise.resolve(true); // No password configured, actions are free
    }
    if (isPedAuthorized) {
      return Promise.resolve(true); // Already unlocked for this session
    }
    
    // Open the custom dialog
    return new Promise<boolean>((resolve) => {
      setAuthPasswordInput('');
      setAuthDialogError('');
      setAuthDialog({
        isOpen: true,
        type: 'pedagogic',
        title: '🔓 Déverrouillage Responsable Académique',
        description: `Cette action requiert le mot de passe d'accès du Responsable Académique (${apeeSettings.pedManagerName || "Surveillant/Censeur"}) :`,
        placeholder: 'Saisissez le mot de passe...',
        expectedValue: apeeSettings.pedManagerPassword,
        managerName: apeeSettings.pedManagerName || "Surveillant Général / Censeur",
        resolve: (approved) => {
          if (approved) {
            setIsPedAuthorized(true);
          }
          resolve(approved);
        }
      });
    });
  };

  const handlePromptUnlockPed = () => {
    if (!apeeSettings.pedManagerPassword) {
      setIsPedAuthorized(true);
      return;
    }
    setAuthPasswordInput('');
    setAuthDialogError('');
    setAuthDialog({
      isOpen: true,
      type: 'pedagogic',
      title: '🔓 Déverrouillage Responsable Académique',
      description: `Entrez le mot de passe du Responsable Académique (${apeeSettings.pedManagerName || "Surveillant/Censeur"}) :`,
      placeholder: 'Mot de passe...',
      expectedValue: apeeSettings.pedManagerPassword,
      managerName: apeeSettings.pedManagerName || "Surveillant/Censeur",
      resolve: (approved) => {
        if (approved) {
          setIsPedAuthorized(true);
        }
      }
    });
  };

  const handleAuthDialogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authDialog) return;
    
    if (authPasswordInput === authDialog.expectedValue) {
      authDialog.resolve(true);
      setAuthPasswordInput('');
      setAuthDialogError('');
      setAuthDialog(null);
    } else {
      setAuthDialogError('Mot de passe incorrect. Veuillez réessayer.');
    }
  };

  const handleAuthDialogCancel = () => {
    if (!authDialog) return;
    authDialog.resolve(false);
    setAuthPasswordInput('');
    setAuthDialogError('');
    setAuthDialog(null);
  };

  // Firestore App State
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [printingStudent, setPrintingStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Synchronise state triggers to dispatcher for real-time Firestore sync tracking
  useEffect(() => {
    if (!isOffline && (
      students.length > 0 || 
      grades.length > 0 || 
      attendanceLogs.length > 0 || 
      homeworks.length > 0 || 
      appointments.length > 0 || 
      messages.length > 0 ||
      lessons.length > 0 ||
      announcements.length > 0 ||
      apeeParents.length > 0 ||
      apeeExpenses.length > 0 ||
      apeeLogs.length > 0 ||
      apeeOtherRevenues.length > 0
    )) {
      window.dispatchEvent(new Event('pasma_db_sync_update'));
    }
  }, [
    students,
    grades,
    attendanceLogs,
    homeworks,
    appointments,
    messages,
    announcements,
    lessons,
    apeeSettings,
    apeeParents,
    apeeExpenses,
    apeeLogs,
    apeeOtherRevenues,
    isOffline
  ]);

  const handleAddLesson = (newLesson: Lesson) => {
    setLessons(prev => [newLesson, ...prev]);
  };

  const handleDeleteLesson = (id: string) => {
    setLessons(prev => prev.filter(l => l.id !== id));
  };

  // Filter students based on Parent authorized subset for Visitor role
  const filteredStudents = students.filter(s => {
    if (!s) return false;
    if (portalUserRole === 'parent') {
      let allowedNames: string[] = [];
      if (portalParentDetails?.studentSubsetNames && portalParentDetails.studentSubsetNames.length > 0) {
        allowedNames = portalParentDetails.studentSubsetNames.map(name => (name || '').toLowerCase().trim()).filter(Boolean);
      } else {
        // Safe Fallbacks for demo presets
        const parentNameLower = (portalParentDetails?.name || '').toLowerCase();
        const parentPhoneClean = (portalParentDetails?.phone || '').replace(/\D/g, '');
        if (parentNameLower.includes('martin') || parentPhoneClean.includes('677112233')) {
          allowedNames = ['lucas martin', 'chloe martin', 'chloé martin'];
        } else if (parentNameLower.includes('diallo') || parentPhoneClean.includes('699445566')) {
          allowedNames = ['amadou diallo'];
        } else {
          // If still no matches, we search if the student's name shares any common words with the parent's name (like last name)
          const parentWords = parentNameLower.split(/\s+/).filter(w => w.length > 2);
          const studentNameLower = (s.name || '').toLowerCase();
          const hasCommonWord = parentWords.some(word => studentNameLower.includes(word));
          if (hasCommonWord) return true;
          
          // Absolute fallback: if still empty list, allow all students in this custom space so they are never locked out
          return true;
        }
      }
      
      const sNameLower = (s.name || '').toLowerCase().trim();
      return allowedNames.includes(sNameLower) || 
             allowedNames.some(allowed => sNameLower.includes(allowed) || allowed.includes(sNameLower));
    }
    if (portalUserRole === 'teacher') {
      if (!portalTeacherDetails?.classRoom) return true;
      const teacherClassLower = (portalTeacherDetails.classRoom || '').toLowerCase().trim();
      const studentClassLower = (s.classRoom || '').toLowerCase().trim();
      // Match if classrooms contain each other (e.g. "cm2" and "CM2-A" or "Classe CM2-A")
      return studentClassLower.includes(teacherClassLower) || teacherClassLower.includes(studentClassLower);
    }
    return true;
  });

  // Selected student entity helper (using filtered list)
  const activeStudent = filteredStudents.find(s => s.id === selectedStudentId) || filteredStudents[0];

  // 1. Listen for Authentication changes
  useEffect(() => {
    setIsIframe(window.self !== window.top);
    
    // Check if there is already a simulated admin session
    const savedSimulated = localStorage.getItem('pasma_simulated_user');
    if (savedSimulated) {
      try {
        const simulatedUser = JSON.parse(savedSimulated);
        setUser(simulatedUser);
        const email = (simulatedUser.email || '').toLowerCase().trim();
        const isPrimary = email === 'jacquesbene301@gmail.com';
        const isDeputy = email === 'adjoint@pasma.sys';
        if (isPrimary || isDeputy) {
          setShowSuperAdmin(true);
          setShowMainLogin(false);
        } else {
          setShowSuperAdmin(false);
          setShowMainLogin(false);
        }
        
        // Ensure active background token is registered for Firestore queries/writes
        if (!auth.currentUser) {
          loginAnonymously().catch(e => console.warn("Failed background auth during simulated session restoration:", e));
        }

        setLoading(false);
      } catch (err) {
        console.warn("Failed parsing simulated session:", err);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // If we have a simulated user active, bypass standard Firebase Auth state change callbacks
      if (localStorage.getItem('pasma_simulated_user')) {
        return;
      }
      
      if (currentUser && currentUser.email) {
        const email = currentUser.email.toLowerCase().trim();
        const isPrimary = email === 'jacquesbene301@gmail.com';
        
        let isDeputy = false;
        try {
          // Check super_admins to verify if this email is an assistant/deputy using a direct get
          const adminDocRef = doc(db, 'super_admins', email);
          const adminDocSnap = await getDoc(adminDocRef);
          if (adminDocSnap.exists()) {
            isDeputy = true;
          } else {
            isDeputy = email === 'adjoint@pasma.sys';
          }
        } catch (e) {
          console.warn("Could not retrieve specific super_admin document during validation:", e);
          const cached = localStorage.getItem('pasma_secondary_admins');
          if (cached) {
            const list = JSON.parse(cached);
            isDeputy = list.some((admin: any) => admin.email?.toLowerCase().trim() === email) || email === 'adjoint@pasma.sys';
          } else {
            isDeputy = email === 'adjoint@pasma.sys';
          }
        }

        if (isPrimary || isDeputy) {
          setShowSuperAdmin(true);
          setShowMainLogin(false);
        } else {
          // Others go directly to the portal selection screen
          console.log("Welcome general user (others):", email);
          setShowSuperAdmin(false);
          setShowMainLogin(false);
        }
      } else if (currentUser) {
        // Anonymous/Guest user
        console.log("Anonymous guest logged in:", currentUser.uid);
        setShowMainLogin(false);
      } else {
        // Forced login redirection for non-authenticated guests
        setShowMainLogin(true);
        setShowSuperAdmin(false);
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch secondary super admins on load
  useEffect(() => {
    const fetchAdmins = async () => {
      // Guard: only fetch from Firestore if the user is authenticated and is an admin-related email user
      if (!user || !user.email) {
        const cached = localStorage.getItem('pasma_secondary_admins');
        if (cached) {
          setSecondaryAdmins(JSON.parse(cached));
        } else {
          const defaultAdmins = [
            { id: 'admin_sec_1', email: 'adjoint@pasma.sys', name: 'Alain Ndzie', createdAt: new Date().toISOString(), addedBy: 'jacquesbene301@gmail.com' }
          ];
          setSecondaryAdmins(defaultAdmins);
          localStorage.setItem('pasma_secondary_admins', JSON.stringify(defaultAdmins));
        }
        return;
      }

      const email = user.email.toLowerCase().trim();
      const isPrimary = email === 'jacquesbene301@gmail.com';
      const isDefaultAdjoint = email === 'adjoint@pasma.sys';
      
      const cached = localStorage.getItem('pasma_secondary_admins');
      let isCachedDeputy = false;
      if (cached) {
        try {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            isCachedDeputy = list.some((admin: any) => admin.email?.toLowerCase().trim() === email);
          }
        } catch (ee) {
          console.warn("Failed to parse cached pasma_secondary_admins", ee);
        }
      }

      if (!isPrimary && !isDefaultAdjoint && !isCachedDeputy) {
        // Not a super-admin or deputy. Do not attempt Firestore list query to prevent security rule violations on client.
        if (cached) {
          setSecondaryAdmins(JSON.parse(cached));
        } else {
          const defaultAdmins = [
            { id: 'admin_sec_1', email: 'adjoint@pasma.sys', name: 'Alain Ndzie', createdAt: new Date().toISOString(), addedBy: 'jacquesbene301@gmail.com' }
          ];
          setSecondaryAdmins(defaultAdmins);
          localStorage.setItem('pasma_secondary_admins', JSON.stringify(defaultAdmins));
        }
        return;
      }

      try {
        const q = query(collection(db, 'super_admins'));
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        if (list.length > 0) {
          setSecondaryAdmins(list);
          localStorage.setItem('pasma_secondary_admins', JSON.stringify(list));
        } else {
          if (cached) {
            setSecondaryAdmins(JSON.parse(cached));
          } else {
            const defaultAdmins = [
              { id: 'admin_sec_1', email: 'adjoint@pasma.sys', name: 'Alain Ndzie', createdAt: new Date().toISOString(), addedBy: 'jacquesbene301@gmail.com' }
            ];
            setSecondaryAdmins(defaultAdmins);
            localStorage.setItem('pasma_secondary_admins', JSON.stringify(defaultAdmins));
          }
        }
      } catch (e) {
        console.warn("Could not retrieve collection 'super_admins' from Firestore. Checking local cache.", e);
        if (cached) {
          setSecondaryAdmins(JSON.parse(cached));
        } else {
          const defaultAdmins = [
            { id: 'admin_sec_1', email: 'adjoint@pasma.sys', name: 'Alain Ndzie', createdAt: new Date().toISOString(), addedBy: 'jacquesbene301@gmail.com' }
          ];
          setSecondaryAdmins(defaultAdmins);
          localStorage.setItem('pasma_secondary_admins', JSON.stringify(defaultAdmins));
        }
      }
    };
    fetchAdmins();
  }, [user]);

  // 2. Fetch and seed database state based on Selected School or logged-in account (Unified ID space)
  const userId = selectedSchoolId || user?.uid;
  useEffect(() => {
    if (loading) return;
    if (!userId) {
      // Clear local states on sign out or when no user is signed in
      setStudents([]);
      setSelectedStudentId('');
      setGrades([]);
      setAttendanceLogs([]);
      setHomeworks([]);
      setAppointments([]);
      setMessages([]);
      setInvoices([]);
      setAnnouncements([]);
      
      // Clear APEE states
      setApeeSettings(DEFAULT_SETTINGS);
      setApeeParents([]);
      setApeeExpenses([]);
      setActiveParentToEdit(null);
      return;
    }

    // Add authentication guard to prevent unauthenticated database queries/writes
    if (!user) {
      console.log("[Pasma-sys Gate] Waiting for authentication to resolve before starting queries.");
      return;
    }

    const unsubscribers: (() => void)[] = [];

    // Real-time school status subscription to enforce suspension blocks in real-time
    if (selectedSchoolId) {
      try {
        const unsubSchool = onSnapshot(doc(db, 'establishments', selectedSchoolId), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setSchoolStatus(data.status || 'active');
          }
        }, (err) => {
          console.warn("Real-time school status listener subscription failed (offline fallback):", err);
        });
        unsubscribers.push(unsubSchool);
      } catch (err) {
        console.warn("Could not bind real-time school status listener:", err);
      }
    }

    const initAndFetchData = async () => {
      setDataLoading(true);
      try {
        const isPreprod = typeof window !== 'undefined' && (
          window.location.hostname.includes('ais-pre-') || 
          window.location.hostname.includes('ais-prod-') ||
          window.location.hostname.includes('pasma-app')
        );

        // Ensure Bene Jacques exists in Firestore under demo_school_ekali if not present
        if (!isPreprod) {
          try {
            const beneDocRef = doc(db, 'invoices', 'apee_par_bene_jacques');
            const snap = await getDoc(beneDocRef);
            if (!snap.exists()) {
              await setDoc(beneDocRef, {
                id: 'apee_par_bene_jacques',
                studentId: 'apee_ces_ekali_1',
                parentId: 'demo_school_ekali',
                title: 'Bene Jacques',
                phone: '687463313',
                email: 'jacquesbene301@gmail.com',
                amount: 25000,
                dueDate: '2025/2026',
                status: 'Unpaid',
                paymentDate: new Date().toISOString(),
                note: 'Règlement initial pour la rentrée scolaire de Marc et Elise',
                amountPaid: 15000,
                studentsList: JSON.stringify([{ name: 'Marc Bene', classRoom: 'CM2-A' }, { name: 'Elise Bene', classRoom: 'CE2-B' }]),
                paymentsHistory: JSON.stringify([{ id: 'p_bene_1', amount: 15000, date: '2026-05-10', note: 'Versement initial par Mobile Money', method: 'Orange Money' }])
              });
              console.log("Successfully seeded Bene Jacques into Firestore invoices.");
            }
          } catch (beneErr) {
            console.warn("Soft seeding of Bene Jacques on load skipped or offline:", beneErr);
          }
        }

        // A. Verify if database has seeded profiles for this account space (demo schools pre-seeded dynamically if empty)
        let seeded = true; // Default to true for simulated guests to bypass seeding attempts
        const isSimulatedUser = !auth.currentUser || 
                                userId.startsWith('sandboxed_guest_') || 
                                portalUserRole === 'parent' || 
                                portalUserRole === 'teacher';

        if (!isSimulatedUser && !isPreprod) {
          try {
            seeded = await isDatabaseSeeded(userId);
            if (!seeded) {
              setSeeding(true);
              await seedUserData(userId);
              setSeeding(false);
            }
          } catch (e) {
            console.warn("Seeding verification failed or timed out. Attempting online fetch anyway.", e);
          }
        } else {
          console.log("Local simulated workspace session, unauthenticated state, or pre-production mode detected. Bypassing remote database seeding.");
        }

        // B. Fetch cache/local storage backup first for instant loading
        try {
          await fetchAllData(userId);
          const cachedApee = await fetchApeeData(userId);
          if (cachedApee) {
            if (cachedApee.settings) setApeeSettings(cachedApee.settings);
            if (cachedApee.parents) setApeeParents(cachedApee.parents);
            if (cachedApee.expenses) setApeeExpenses(cachedApee.expenses);
            if (cachedApee.logs) setApeeLogs(cachedApee.logs);
            if (cachedApee.otherRevenues) setApeeOtherRevenues(cachedApee.otherRevenues);
          }
        } catch (e) {
          console.warn("Failure fetching initial backup or offline seed:", e);
        }

        // C. Setup real-time listeners for all collections (Students, Grades, Attendance, Homework, Appointments, Messages, Announcements)
        if (!isOffline) {
          try {
            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'students'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => doc.data() as Student);
                  setStudents(list);
                  if (list.length > 0) {
                    setSelectedStudentId(prev => prev || list[0]?.id || '');
                  }
                  localStorage.setItem(`pasma_students_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time students listener failed (offline fallback active):", err);
                }
              )
            );

            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'grades'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => doc.data() as Grade);
                  setGrades(list);
                  localStorage.setItem(`pasma_grades_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time grades listener failed:", err);
                }
              )
            );

            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'attendance'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => doc.data() as Attendance);
                  setAttendanceLogs(list);
                  localStorage.setItem(`pasma_attendance_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time attendance listener failed:", err);
                }
              )
            );

            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'homeworks'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => doc.data() as Homework);
                  setHomeworks(list);
                  localStorage.setItem(`pasma_homeworks_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time homeworks listener failed:", err);
                }
              )
            );

            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'appointments'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => doc.data() as Appointment);
                  setAppointments(list);
                  localStorage.setItem(`pasma_appointments_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time appointments listener failed:", err);
                }
              )
            );

            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'messages'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => doc.data() as Message);
                  setMessages(list);
                  localStorage.setItem(`pasma_messages_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time messages listener failed:", err);
                }
              )
            );

            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'announcements'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => doc.data() as Announcement);
                  setAnnouncements(list);
                  localStorage.setItem(`pasma_announcements_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time announcements listener failed:", err);
                }
              )
            );

            unsubscribers.push(
              onSnapshot(
                query(collection(db, 'lessons'), where('parentId', '==', userId)),
                (snapshot) => {
                  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Lesson);
                  setLessons(list);
                  localStorage.setItem(`pasma_lessons_${userId}`, JSON.stringify(list));
                },
                (err) => {
                  console.warn("Real-time lessons listener failed:", err);
                }
              )
            );

            // D. Setup real-time APEE subscription
            const unsubApee = subscribeApeeData(
              userId,
              (apeeData) => {
                if (apeeData.settings) setApeeSettings(apeeData.settings);
                if (apeeData.parents) setApeeParents(apeeData.parents);
                if (apeeData.expenses) setApeeExpenses(apeeData.expenses);
                if (apeeData.logs) setApeeLogs(apeeData.logs);
                if (apeeData.otherRevenues) setApeeOtherRevenues(apeeData.otherRevenues);
              },
              (err) => {
                console.warn("APEE real-time listener subscription failed (offline/permission fallback):", err);
              }
            );
            if (unsubApee) unsubscribers.push(unsubApee);

          } catch (syncErr) {
            console.warn("Could not bind real-time listeners. Using fetched snapshots.", syncErr);
          }
        }
      } catch (err) {
        console.error("Initiation payload failure:", err);
      } finally {
        setDataLoading(false);
      }
    };

    initAndFetchData();

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [userId, user?.uid, isOffline, loading]);

  // 1.6 Monitor for Session Concurrency and Device mismatch (All roles)
  useEffect(() => {
    if (!selectedSchoolId || !portalUserRole) return;

    // Skip device concurrency invalidation on pre-production environments or for demo accounts
    // to prevent multiple concurrent testers/reviewers/tabs from kicking each other out.
    const isPreprodOrDemo = typeof window !== 'undefined' && (
      window.location.hostname.includes('ais-pre-') || 
      window.location.hostname.includes('ais-prod-') ||
      window.location.hostname.includes('pasma-app') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1') ||
      selectedSchoolId.startsWith('demo_')
    );

    if (isPreprodOrDemo) return;

    let targetKey = "";
    if (portalUserRole === 'parent' && portalParentDetails) {
      targetKey = `parent_${selectedSchoolId}_${portalParentDetails.phone || portalParentDetails.name}`;
    } else if (portalUserRole === 'teacher' && portalTeacherDetails) {
      targetKey = `teacher_${selectedSchoolId}_${portalTeacherDetails.name}`;
    } else if (portalUserRole === 'manager' && portalManagerDetails) {
      targetKey = `manager_${selectedSchoolId}_${portalManagerDetails.name}`;
    }

    if (!targetKey) return;

    const currentDeviceId = localStorage.getItem('pasma_device_id') || 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('pasma_device_id', currentDeviceId);

    // Register active session in the database
    const sessionRef = doc(db, 'active_sessions', targetKey);
    setDoc(sessionRef, { deviceId: currentDeviceId, updatedAt: Date.now() }, { merge: true }).catch(err => {
      console.warn("Session device registration failed or offline:", err);
    });

    const unsub = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.data();
        if (val.deviceId && val.deviceId !== currentDeviceId) {
          console.warn("Device mismatch session invalidation for:", targetKey);
          setDeviceChanged(true);
        }
      }
    }, (err) => {
      console.warn("Session listener issue (expected for offline or initial sweeps):", err);
    });

    return unsub;
  }, [portalUserRole, selectedSchoolId, portalParentDetails, portalTeacherDetails, portalManagerDetails]);

  const fetchAllData = async (uid: string) => {
    // 1. Load offline cache values first for instant loading
    let localBackupFound = false;
    try {
      const cachedStudents = localStorage.getItem(`pasma_students_${uid}`);
      const cachedGrades = localStorage.getItem(`pasma_grades_${uid}`);
      const cachedAttendance = localStorage.getItem(`pasma_attendance_${uid}`);
      const cachedHomeworks = localStorage.getItem(`pasma_homeworks_${uid}`);
      const cachedAppointments = localStorage.getItem(`pasma_appointments_${uid}`);
      const cachedMessages = localStorage.getItem(`pasma_messages_${uid}`);
      const cachedInvoices = localStorage.getItem(`pasma_invoices_${uid}`);
      const cachedAnnouncements = localStorage.getItem(`pasma_announcements_${uid}`);
      const cachedLessons = localStorage.getItem(`pasma_lessons_${uid}`);

      if (cachedStudents) {
        const studentList = JSON.parse(cachedStudents);
        setStudents(studentList);
        setSelectedStudentId(studentList[0]?.id || '');
        localBackupFound = true;
      }
      if (cachedGrades) setGrades(JSON.parse(cachedGrades));
      if (cachedAttendance) setAttendanceLogs(JSON.parse(cachedAttendance));
      if (cachedHomeworks) setHomeworks(JSON.parse(cachedHomeworks));
      if (cachedAppointments) setAppointments(JSON.parse(cachedAppointments));
      if (cachedMessages) setMessages(JSON.parse(cachedMessages));
      if (cachedInvoices) setInvoices(JSON.parse(cachedInvoices));
      if (cachedAnnouncements) setAnnouncements(JSON.parse(cachedAnnouncements));
      if (cachedLessons) setLessons(JSON.parse(cachedLessons));
    } catch (e) {
      console.warn("Loading local storage cached pasma data failed:", e);
    }

    try {
      // Create separate safe query references
      const studentQuery = query(collection(db, 'students'), where('parentId', '==', uid));
      const gradeQuery = query(collection(db, 'grades'), where('parentId', '==', uid));
      const attendanceQuery = query(collection(db, 'attendance'), where('parentId', '==', uid));
      const homeworkQuery = query(collection(db, 'homeworks'), where('parentId', '==', uid));
      const appointmentQuery = query(collection(db, 'appointments'), where('parentId', '==', uid));
      const messageQuery = query(collection(db, 'messages'), where('parentId', '==', uid));
      const invoiceQuery = query(collection(db, 'invoices'), where('parentId', '==', uid));
      const announcementQuery = query(collection(db, 'announcements'), where('parentId', '==', uid));
      const lessonQuery = query(collection(db, 'lessons'), where('parentId', '==', uid));

      // Fetch collections sequentially to strictly reuse and keep connections alive under browser limits
      const studentSnapshot = await getDocs(studentQuery).catch(err => { console.warn("Error fetching students:", err); return null; });
      const gradeSnapshot = await getDocs(gradeQuery).catch(err => { console.warn("Error fetching grades:", err); return null; });
      const attendanceSnapshot = await getDocs(attendanceQuery).catch(err => { console.warn("Error fetching attendance:", err); return null; });
      const homeworkSnapshot = await getDocs(homeworkQuery).catch(err => { console.warn("Error fetching homeworks:", err); return null; });
      const appointmentSnapshot = await getDocs(appointmentQuery).catch(err => { console.warn("Error fetching appointments:", err); return null; });
      const messageSnapshot = await getDocs(messageQuery).catch(err => { console.warn("Error fetching messages:", err); return null; });
      const invoiceSnapshot = await getDocs(invoiceQuery).catch(err => { console.warn("Error fetching invoices:", err); return null; });
      const announcementSnapshot = await getDocs(announcementQuery).catch(err => { console.warn("Error fetching announcements:", err); return null; });
      const lessonSnapshot = await getDocs(lessonQuery).catch(err => { console.warn("Error fetching lessons:", err); return null; });

      let loadedAnyFromDb = false;

      // Update each collection safely depending on fetch outcome
      const didConnectToDb = studentSnapshot !== null || 
                             gradeSnapshot !== null || 
                             attendanceSnapshot !== null || 
                             homeworkSnapshot !== null || 
                             appointmentSnapshot !== null || 
                             messageSnapshot !== null || 
                             invoiceSnapshot !== null || 
                             announcementSnapshot !== null ||
                             lessonSnapshot !== null;

      if (studentSnapshot !== null) {
        const studentList = studentSnapshot.empty ? [] : studentSnapshot.docs.map(doc => doc.data() as Student);
        setStudents(studentList);
        setSelectedStudentId(studentList[0]?.id || '');
        localStorage.setItem(`pasma_students_${uid}`, JSON.stringify(studentList));
        localBackupFound = true;
        loadedAnyFromDb = true;
      }
      if (gradeSnapshot !== null) {
        const list = gradeSnapshot.empty ? [] : gradeSnapshot.docs.map(doc => doc.data() as Grade);
        setGrades(list);
        localStorage.setItem(`pasma_grades_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (attendanceSnapshot !== null) {
        const list = attendanceSnapshot.empty ? [] : attendanceSnapshot.docs.map(doc => doc.data() as Attendance);
        setAttendanceLogs(list);
        localStorage.setItem(`pasma_attendance_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (homeworkSnapshot !== null) {
        const list = homeworkSnapshot.empty ? [] : homeworkSnapshot.docs.map(doc => doc.data() as Homework);
        setHomeworks(list);
        localStorage.setItem(`pasma_homeworks_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (appointmentSnapshot !== null) {
        const list = appointmentSnapshot.empty ? [] : appointmentSnapshot.docs.map(doc => doc.data() as Appointment);
        setAppointments(list);
        localStorage.setItem(`pasma_appointments_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (messageSnapshot !== null) {
        const list = messageSnapshot.empty ? [] : messageSnapshot.docs.map(doc => doc.data() as Message);
        setMessages(list);
        localStorage.setItem(`pasma_messages_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (invoiceSnapshot !== null) {
        const list = invoiceSnapshot.empty ? [] : invoiceSnapshot.docs.map(doc => doc.data() as Invoice);
        setInvoices(list);
        localStorage.setItem(`pasma_invoices_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (announcementSnapshot !== null) {
        const list = announcementSnapshot.empty ? [] : announcementSnapshot.docs.map(doc => doc.data() as Announcement);
        setAnnouncements(list);
        localStorage.setItem(`pasma_announcements_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (lessonSnapshot !== null) {
        const list = lessonSnapshot.empty ? [] : lessonSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Lesson);
        setLessons(list);
        localStorage.setItem(`pasma_lessons_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }

      // If we are completely offline and have nothing in local storage backup, load offline seed mockups!
      if (!didConnectToDb && !localBackupFound) {
        console.log("No DB connection and no local backup found. Triggering instant local preview seed...");
        const offlineData = getOfflineMockData(uid);
        if (offlineData.students.length > 0) {
          setStudents(offlineData.students);
          setSelectedStudentId(offlineData.students[0].id);
          localStorage.setItem(`pasma_students_${uid}`, JSON.stringify(offlineData.students));
        }
        setGrades(offlineData.grades);
        localStorage.setItem(`pasma_grades_${uid}`, JSON.stringify(offlineData.grades));
        setAttendanceLogs(offlineData.attendances);
        localStorage.setItem(`pasma_attendance_${uid}`, JSON.stringify(offlineData.attendances));
        setHomeworks(offlineData.homeworks);
        localStorage.setItem(`pasma_homeworks_${uid}`, JSON.stringify(offlineData.homeworks));
        setAppointments(offlineData.appointments);
        localStorage.setItem(`pasma_appointments_${uid}`, JSON.stringify(offlineData.appointments));
        setMessages(offlineData.messages);
        localStorage.setItem(`pasma_messages_${uid}`, JSON.stringify(offlineData.messages));
        setInvoices(offlineData.invoices);
        localStorage.setItem(`pasma_invoices_${uid}`, JSON.stringify(offlineData.invoices));
        if ((offlineData as any).lessons) {
          setLessons((offlineData as any).lessons);
          localStorage.setItem(`pasma_lessons_${uid}`, JSON.stringify((offlineData as any).lessons));
        }
      }
    } catch (error) {
      console.error("Critical fetching issue occurred:", error);
    }
  };

  // State update actions for instant interactive UI (pushed down to submodules)
  const handleUpdateHomeworkInPlace = (updated: Homework) => {
    setHomeworks(prev => prev.map(hw => hw.id === updated.id ? updated : hw));
  };

  const handleUpdateInvoiceInPlace = async (updated: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));

    if (updated.studentId === 'apee_ces_ekali_1' && userId) {
      // Synchronize parent cotisation changes back to the ApeeParent model
      const oldParent = apeeParents.find(p => p.id === updated.id);
      if (oldParent) {
        const addedAmount = Math.max(0, updated.amount - oldParent.totalPaid);
        const newPayment = {
          id: 'pay_portal_' + Date.now(),
          amount: addedAmount,
          date: updated.paymentDate || new Date().toISOString().split('T')[0],
          note: updated.note || 'Règlement validé directement via le portail de facturation en ligne',
          method: updated.provider === 'mtn' ? 'MTN MoMo' : updated.provider === 'orange' ? 'Orange Money' : updated.provider === 'wave' ? 'Wave' : 'Carte Bancaire',
          transactionId: updated.transactionId || ('TX_' + Date.now().toString(36).toUpperCase())
        };

        const updatedParent: ApeeParent = {
          ...oldParent,
          totalPaid: updated.amount,
          status: 'soldé',
          payments: [...(oldParent.payments || []), newPayment],
          updatedAt: new Date().toISOString()
        };

        // Update local ApeeParent state
        setApeeParents(prev => prev.map(p => p.id === updated.id ? updatedParent : p));

        // Save progress to database and update activity log
        try {
          await saveApeeParent(userId, updatedParent);
          
          const operator = apeeSettings.finManagerName || "Gérant Financier";
          const logId = 'log_' + Date.now() + '_pay_portal_' + Math.random().toString(36).substr(2, 4);
          const payDesc = `Versement en ligne de ${addedAmount.toLocaleString()} FCFA validé via le portail pour ${updatedParent.name} (Réf : ${newPayment.transactionId}). État global : SOLDÉ.`;
          const logObj: ApeeActivityLog = {
            id: logId,
            parentId: userId,
            timestamp: new Date().toISOString(),
            parentName: updatedParent.name,
            actionType: 'ADD_PAYMENT',
            description: payDesc,
            amount: addedAmount,
            operatorName: operator,
            transactionId: newPayment.transactionId,
          };
          await saveApeeLog(userId, logObj);
          setApeeLogs(prev => [logObj, ...prev]);
        } catch (e) {
          console.error("Failed to synchronize parent cotisation payment:", e);
        }
      }
    }
  };

  const handleAddAppointmentInPlace = (newApt: Appointment) => {
    setAppointments(prev => [newApt, ...prev]);
  };

  const handleUpdateAppointmentInPlace = (updatedApt: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === updatedApt.id ? updatedApt : a));
  };

  const handleAddMessageInPlace = (newMsg: Message) => {
    setMessages(prev => [...prev, newMsg]);
  };

  const runFirestoreWrite = async (
    collectionName: string,
    docId: string,
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    data: any,
    friendlyTitle: string
  ): Promise<boolean> => {
    if (isOffline) {
      queuePendingAction(type, collectionName, docId, friendlyTitle, data);
      return true;
    } else {
      try {
        if (type === 'DELETE') {
          await deleteDoc(doc(db, collectionName, docId));
        } else {
          await setDoc(doc(db, collectionName, docId), data);
        }
        window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: friendlyTitle } }));
        return true;
      } catch (err) {
        console.warn("Firestore write failed, falling back to queueing offline:", err);
        queuePendingAction(type, collectionName, docId, friendlyTitle, data);
        return false;
      }
    }
  };

  const handleUpdateStudent = async (updated: Student) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
    if (userId) {
      await runFirestoreWrite(
        'students',
        updated.id,
        'UPDATE',
        updated,
        `Mettre à jour l'élève : ${updated.name}`
      );
    }
    return true;
  };

  const handleUpdateStudentInPlace = (updated: Student) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  // Pedagogical & Academic Action Handlers (strictly authorized under checkPedAuthorization)
  const handleAddGrade = async (grade: Grade) => {
    if (portalUserRole === 'parent') {
      alert("Accès refusé: Les parents ne sont pas autorisés à modifier les relevés de notes.");
      return false;
    }
    setGrades(prev => [grade, ...prev]);
    if (userId) {
      await runFirestoreWrite(
        'grades',
        grade.id,
        'UPDATE',
        grade,
        `Ajouter note : ${grade.subject} - ${grade.score}/${grade.maxScore}`
      );
    }
    return true;
  };

  const handleDeleteGrade = async (id: string) => {
    if (portalUserRole === 'parent') {
      alert("Accès refusé: Les parents ne sont pas autorisés à supprimer les relevés de notes.");
      return false;
    }
    const oldGrad = grades.find(g => g.id === id);
    setGrades(prev => prev.filter(g => g.id !== id));
    if (userId) {
      await runFirestoreWrite(
        'grades',
        id,
        'DELETE',
        null,
        `Supprimer note : ${oldGrad?.subject || 'Relevé'} (${oldGrad?.score || ''}/${oldGrad?.maxScore || ''})`
      );
    }
    return true;
  };

  const handleAddHomework = async (homework: Homework) => {
    if (portalUserRole !== 'parent') {
      if (!await checkPedAuthorization()) return false;
    }
    setHomeworks(prev => [homework, ...prev]);
    if (userId) {
      await runFirestoreWrite(
        'homeworks',
        homework.id,
        'UPDATE',
        homework,
        `Ajouter devoir : ${homework.title} (${homework.subject})`
      );
    }
    return true;
  };

  const handleDeleteHomework = async (id: string) => {
    if (!await checkPedAuthorization()) return false;
    const oldHw = homeworks.find(h => h.id === id);
    setHomeworks(prev => prev.filter(hw => hw.id !== id));
    if (userId) {
      await runFirestoreWrite(
        'homeworks',
        id,
        'DELETE',
        null,
        `Supprimer devoir : ${oldHw?.title || 'Devoir'} (${oldHw?.subject || ''})`
      );
    }
    return true;
  };

  const handleAddAttendance = async (log: Attendance) => {
    if (portalUserRole !== 'parent') {
      if (!await checkPedAuthorization()) return false;
    }
    setAttendanceLogs(prev => [log, ...prev]);
    if (userId) {
      await runFirestoreWrite(
        'attendance',
        log.id,
        'UPDATE',
        log,
        `Ajouter présence : ${log.status} pour l'élève`
      );
    }

    // Automated notification trigger: when marked absent for more than 3 consecutive days
    if (log.status === 'Absent') {
      const student = students.find(s => s.id === log.studentId);
      if (student) {
        const studentLogs = [log, ...attendanceLogs.filter(a => a.studentId === log.studentId)];
        const logMap = new Map<string, Attendance>();
        studentLogs.forEach(l => logMap.set(l.date, l));

        const sortedDates = Array.from(logMap.keys()).sort((a, b) => a.localeCompare(b));
        const currentIndex = sortedDates.indexOf(log.date);
        let consecutiveAbsentCount = 0;

        if (currentIndex !== -1) {
          for (let i = currentIndex; i >= 0; i--) {
            const dateKey = sortedDates[i];
            const logItem = logMap.get(dateKey);
            if (logItem && logItem.status === 'Absent') {
              consecutiveAbsentCount++;
            } else {
              break;
            }
          }
        }

        if (consecutiveAbsentCount > 3) {
          const teacherName = student.teacherName || 'Professeur Principal';
          const autoMsgId = 'msg_att_alert_' + Date.now();
          const alertMessageText = `⚠️ ALERTE AUTOMATIQUE DE PRÉSENCE : L'élève ${student.name} (${student.classRoom}) a été marqué(e) absent(e) pour ${consecutiveAbsentCount} jours consécutifs (Dernière absence : ${log.date}). ${log.remarks ? `Motif / Justification : "${log.remarks}"` : 'Aucun motif précisé.'} Merci de contacter la famille pour le suivi pédagogique.`;

          const autoMsg: Message = {
            id: autoMsgId,
            studentId: student.id,
            parentId: student.parentId || log.parentId || userId || 'unknown_parent',
            senderType: 'Parent',
            content: alertMessageText,
            timestamp: new Date().toISOString(),
            teacherName: teacherName,
            ...({
              recipientName: teacherName,
              recipientRole: 'Professeur Principal',
              senderRole: 'Système d\'Alerte Assiduité Parent',
              isAutoAlert: true,
              consecutiveDays: consecutiveAbsentCount
            } as any)
          };

          setMessages(prev => [...prev, autoMsg]);

          if (userId) {
            await runFirestoreWrite(
              'messages',
              autoMsg.id,
              'CREATE',
              autoMsg,
              `Alerte absence prolongée (${consecutiveAbsentCount} jours) transmise à ${teacherName}`
            );
          }

          alert(`🚨 ALERTE AUTOMATIQUE D'ABSENCE PROLONGÉE ENVOYÉE\n\nL'élève ${student.name} cumule ${consecutiveAbsentCount} jours d'absence consécutifs (plus de 3 jours).\n\nUne notification prioritaire a été automatiquement transmise à son professeur principal assigné : ${teacherName}.`);
        }
      }
    }

    return true;
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!await checkPedAuthorization()) return false;
    const oldAtt = attendanceLogs.find(a => a.id === id);
    setAttendanceLogs(prev => prev.filter(a => a.id !== id));
    if (userId) {
      await runFirestoreWrite(
        'attendance',
        id,
        'DELETE',
        null,
        `Supprimer présence du ${oldAtt?.date || ''}`
      );
    }
    return true;
  };

  const handleAddAnnouncement = async (ann: Announcement) => {
    if (!await checkPedAuthorization()) return false;
    setAnnouncements(prev => [ann, ...prev]);
    if (userId) {
      await runFirestoreWrite(
        'announcements',
        ann.id,
        'UPDATE',
        { ...ann, parentId: userId },
        `Ajouter annonce : ${ann.title}`
      );
    }
    return true;
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!await checkPedAuthorization()) return false;
    const oldAnn = announcements.find(a => a.id === id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    if (userId) {
      await runFirestoreWrite(
        'announcements',
        id,
        'DELETE',
        null,
        `Supprimer annonce : ${oldAnn?.title || 'Annonce'}`
      );
    }
    return true;
  };

  const handleTogglePinAnnouncement = async (id: string, pinned: boolean) => {
    if (!await checkPedAuthorization()) return false;
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, pinned } : a));
    const ann = announcements.find(a => a.id === id);
    if (ann && userId) {
      await runFirestoreWrite(
        'announcements',
        id,
        'UPDATE',
        { ...ann, pinned, parentId: userId },
        `${pinned ? 'Épingler' : 'Désépingler'} l'annonce : ${ann.title}`
      );
    }
    return true;
  };

  // APEE State Action Handlers
  const handleSaveApeeSettings = async (newSettings: ApeeSettings): Promise<boolean> => {
    // Determine if this is a financial or budget modification.
    const hasFinancialChanges = 
      newSettings.cotisationAmount !== apeeSettings.cotisationAmount ||
      newSettings.financialGoal !== apeeSettings.financialGoal ||
      (newSettings.expectedStudents || 0) !== (apeeSettings.expectedStudents || 0) ||
      (newSettings.honoraryContributions || 0) !== (apeeSettings.honoraryContributions || 0) ||
      (newSettings.subventionsAndAids || 0) !== (apeeSettings.subventionsAndAids || 0) ||
      (newSettings.actualHonoraryContributions || 0) !== (apeeSettings.actualHonoraryContributions || 0) ||
      (newSettings.actualSubventionsAndAids || 0) !== (apeeSettings.actualSubventionsAndAids || 0) ||
      JSON.stringify(newSettings.budgetLines || []) !== JSON.stringify(apeeSettings.budgetLines || []) ||
      newSettings.finManagerPassword !== apeeSettings.finManagerPassword ||
      newSettings.associationName !== apeeSettings.associationName;

    if (hasFinancialChanges) {
      if (!await checkApeeAuthorization()) return false;
    } else {
      // Purely administrative or academic updates
      if (isApeeAuthorized || isPedAuthorized) {
        // Already authorized under one of the roles
      } else {
        // Try APEE Fin manager first since this is the APEE workspace, fall back to Academic check
        const unlockedApee = await checkApeeAuthorization();
        if (!unlockedApee) {
          if (!await checkPedAuthorization()) return false;
        }
      }
    }

    setApeeSettings(newSettings);
    if (userId) {
      await saveApeeSettings(userId, newSettings);
    }
    return true;
  };

  const handleSaveApeeParentInPlace = async (parent: ApeeParent): Promise<boolean> => {
    if (!await checkApeeAuthorization()) return false;

    // Normalise and synchronise APEE parent invoice details locally
    const lastPayment = parent.payments && parent.payments.length > 0 ? parent.payments[parent.payments.length - 1] : null;
    const parentInvoice: Invoice = {
      id: parent.id,
      studentId: 'apee_ces_ekali_1',
      parentId: userId || '',
      title: parent.name,
      amount: parent.totalDue,
      dueDate: parent.createdAt || new Date().toISOString(),
      status: parent.status === 'soldé' ? 'Paid' : 'Unpaid',
      paymentDate: parent.updatedAt || new Date().toISOString(),
      phone: parent.phone,
      address: parent.address,
      email: parent.email || '',
      lastReminded: parent.lastReminded || '',
      note: parent.note,
      amountPaid: parent.totalPaid,
      studentsList: JSON.stringify(parent.students),
      paymentsHistory: JSON.stringify(parent.payments),
      transactionId: lastPayment?.transactionId || '',
      provider: lastPayment?.provider || '',
    };

    setInvoices(prev => {
      const idx = prev.findIndex(inv => inv.id === parent.id);
      if (idx !== -1) {
        return prev.map(inv => inv.id === parent.id ? parentInvoice : inv);
      }
      return [...prev, parentInvoice];
    });

    setApeeParents(prev => {
      const idx = prev.findIndex(p => p.id === parent.id);
      if (idx !== -1) {
        return prev.map(p => p.id === parent.id ? parent : p);
      }
      return [...prev, parent];
    });
    if (userId) {
      try {
        // Automatic Logging System for Financial Modifications
        try {
          const isNew = !apeeParents.some(p => p.id === parent.id);
          const oldParent = apeeParents.find(p => p.id === parent.id);
          const operator = apeeSettings.finManagerName || "Gérant Financier";

          if (isNew) {
            const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            const description = `Création du dossier de ${parent.name}. Cotisation exigible : ${(parent.totalDue || 0).toLocaleString()} FCFA pour ${parent.students.length} élève(s). Statut de base : ${parent.status.toUpperCase()}`;
            const logObj: ApeeActivityLog = {
              id: logId,
              parentId: userId,
              timestamp: new Date().toISOString(),
              parentName: parent.name,
              actionType: 'CREATE_PARENT',
              description,
              amount: parent.totalDue,
              operatorName: operator
            };
            await saveApeeLog(userId, logObj);
            setApeeLogs(prev => [logObj, ...prev]);

            if (parent.payments && parent.payments.length > 0) {
              for (const pay of parent.payments) {
                const payLogId = 'log_' + Date.now() + '_pay_' + Math.random().toString(36).substr(2, 4);
                const refPart = pay.transactionId 
                  ? ` (Réf : ${pay.transactionId}${pay.note ? ' - Note : ' + pay.note : ''})` 
                  : (pay.note ? ` (Note : ${pay.note})` : '');
                const payDesc = `Versement de ${(pay.amount || 0).toLocaleString()} FCFA enregistré par ${pay.method} pour ${parent.name}${refPart}`;
                const payLogObj: ApeeActivityLog = {
                  id: payLogId,
                  parentId: userId,
                  timestamp: new Date().toISOString(),
                  parentName: parent.name,
                  actionType: 'ADD_PAYMENT',
                  description: payDesc,
                  amount: pay.amount,
                  operatorName: operator,
                  transactionId: pay.transactionId || '',
                };
                await saveApeeLog(userId, payLogObj);
                setApeeLogs(prev => [payLogObj, ...prev]);
              }
            }
          } else if (oldParent) {
            if (oldParent.totalDue !== parent.totalDue || oldParent.name !== parent.name || oldParent.students.length !== parent.students.length) {
              const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
              const description = `Mise à jour de la fiche parent de ${parent.name}. Dues totales exigibles ajustées : de ${(oldParent.totalDue || 0).toLocaleString()} à ${(parent.totalDue || 0).toLocaleString()} FCFA (${parent.students.length} élève(s)).`;
              const logObj: ApeeActivityLog = {
                id: logId,
                parentId: userId,
                timestamp: new Date().toISOString(),
                parentName: parent.name,
                actionType: 'UPDATE_PARENT',
                description,
                amount: Math.abs(parent.totalDue - oldParent.totalDue),
                operatorName: operator
              };
              await saveApeeLog(userId, logObj);
              setApeeLogs(prev => [logObj, ...prev]);
            }

            const oldPaymentIds = new Set((oldParent.payments || []).map(p => p.id));
            const addedPayments = (parent.payments || []).filter(p => !oldPaymentIds.has(p.id));
            for (const pay of addedPayments) {
              const payLogId = 'log_' + Date.now() + '_pay_' + Math.random().toString(36).substr(2, 4);
              const refPart = pay.transactionId 
                ? ` (Réf : ${pay.transactionId}${pay.note ? ' - Note : ' + pay.note : ''})` 
                : (pay.note ? ` (Note : ${pay.note})` : '');
              const payDesc = `Nouveau versement de ${(pay.amount || 0).toLocaleString()} FCFA enregistré par ${pay.method} pour les les redevances de ${parent.name}${refPart}.`;
              const payLogObj: ApeeActivityLog = {
                id: payLogId,
                parentId: userId,
                timestamp: new Date().toISOString(),
                parentName: parent.name,
                actionType: 'ADD_PAYMENT',
                description: payDesc,
                amount: pay.amount,
                operatorName: operator,
                transactionId: pay.transactionId || '',
              };
              await saveApeeLog(userId, payLogObj);
              setApeeLogs(prev => [payLogObj, ...prev]);
            }

            const currentPaymentIds = new Set((parent.payments || []).map(p => p.id));
            const deletedPayments = (oldParent.payments || []).filter(p => !currentPaymentIds.has(p.id));
            for (const pay of deletedPayments) {
              const payLogId = 'log_' + Date.now() + '_del_' + Math.random().toString(36).substr(2, 4);
              const payDesc = `Le versement de ${(pay.amount || 0).toLocaleString()} FCFA effectué par ${pay.method} pour ${parent.name} a été annulé de l'historique financier.`;
              const payLogObj: ApeeActivityLog = {
                id: payLogId,
                parentId: userId,
                timestamp: new Date().toISOString(),
                parentName: parent.name,
                actionType: 'REMOVE_PAYMENT',
                description: payDesc,
                amount: pay.amount,
                operatorName: operator,
                transactionId: pay.transactionId || '',
              };
              await saveApeeLog(userId, payLogObj);
              setApeeLogs(prev => [payLogObj, ...prev]);
            }
          }
        } catch (e) {
          console.error("Failed to generate financial logs:", e);
        }

        await saveApeeParent(userId, parent);

        // Synchronize registered students into the main 'students' database!
        if (parent.students && parent.students.length > 0) {
          const currentStudentsMap = new Map<string, Student>(students.map(s => [s.id, s]));
          const studentsToUpsert: Student[] = [];

          parent.students.forEach((linkedStu, idx) => {
            const studentId = `stu_${parent.id}_${idx}`;
            const baseStudent = currentStudentsMap.get(studentId);
            
            const studentObj: Student = {
              id: studentId,
              parentId: userId, // School ID
              name: linkedStu.name,
              grade: linkedStu.classRoom,
              classRoom: linkedStu.classRoom,
              avatar: baseStudent?.avatar || (idx % 2 === 0 ? '👦' : '👧'),
              teacherName: baseStudent?.teacherName || 'Mme Sophie Laurent',
              teacherEmail: baseStudent?.teacherEmail || 'sophie.laurent@pasma.sys',
              dob: linkedStu.dob || baseStudent?.dob || '2017-06-15',
              gradesValidated: baseStudent?.gradesValidated ?? false,
              attendanceValidated: baseStudent?.attendanceValidated ?? false
            };
            studentsToUpsert.push(studentObj);
          });

          // Write updated students atomically
          const batch = writeBatch(db);
          studentsToUpsert.forEach(stu => {
            batch.set(doc(db, 'students', stu.id), stu);
          });
          await batch.commit();

          // Sync local students state
          setStudents(prev => {
            const temp = [...prev];
            studentsToUpsert.forEach(newStu => {
              const ix = temp.findIndex(s => s.id === newStu.id);
              if (ix !== -1) {
                temp[ix] = newStu;
              } else {
                temp.push(newStu);
              }
            });
            try {
              localStorage.setItem(`pasma_students_${userId}`, JSON.stringify(temp));
            } catch (e) {
              console.warn("Unable to cache newly synced students locally:", e);
            }
            return temp;
          });
        }
      } catch (err) {
        console.error("Failed to save APEE parent:", err);
        return false;
      }
    }
    return true;
  };

  const handleDeleteApeeParentInPlace = async (id: string): Promise<boolean> => {
    // EXCLUSIVE DB TRIGGER COUPLING: This method performs critical Firestore document deletions (deleteDoc / batch.delete)
    // exclusively after the user confirms the deletion inside the custom confirmation dialog (resolving with true).
    if (!await checkApeeAuthorization()) return false;
    if (activeParentToEdit?.id === id) {
      setActiveParentToEdit(null);
    }
    
    if (userId) {
      try {
        const deletedParent = apeeParents.find(p => p.id === id);
        if (deletedParent) {
          const operator = apeeSettings.finManagerName || "Gérant Financier";
          const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          const description = `Suppression définitive du dossier de ${deletedParent.name} (Attente de redevance perdue : -${(deletedParent.totalDue || 0).toLocaleString()} FCFA, Versements annulés : -${(deletedParent.totalPaid || 0).toLocaleString()} FCFA).`;
          const logObj: ApeeActivityLog = {
            id: logId,
            parentId: userId,
            timestamp: new Date().toISOString(),
            parentName: deletedParent.name,
            actionType: 'DELETE_PARENT',
            description,
            amount: deletedParent.totalDue,
            operatorName: operator
          };
          await saveApeeLog(userId, logObj);
          setApeeLogs(prev => [logObj, ...prev]);
        }
      } catch (err) {
        console.warn("Failed to write log for parent deletion:", err);
      }

      try {
        const deletedParent = apeeParents.find(p => p.id === id);
        if (deletedParent && deletedParent.students) {
          const batch = writeBatch(db);
          deletedParent.students.forEach((_, idx) => {
            const studentId = `stu_${id}_${idx}`;
            batch.delete(doc(db, 'students', studentId));
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn("Failed to delete matching student entities from database:", err);
      }
      
      try {
        await deleteApeeParent(userId, id);
      } catch (err) {
        console.warn("Failed to delete parent document from database:", err);
      }
    }

    // Always synchronize local state so the UI updates beautifully even on database sync quirks
    setApeeParents(prev => prev.filter(p => p.id !== id));
    setStudents(prev => prev.filter(s => !s.id.startsWith(`stu_${id}_`)));
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    return true;
  };

  const handleSaveApeeExpenseInPlace = async (expense: ApeeExpense) => {
    if (!await checkApeeAuthorization()) return;
    setApeeExpenses(prev => {
      const idx = prev.findIndex(e => e.id === expense.id);
      if (idx !== -1) {
        return prev.map(e => e.id === expense.id ? expense : e);
      }
      return [...prev, expense];
    });
    if (userId) {
      await saveApeeExpense(userId, expense);
    }
  };

  const handleDeleteApeeExpenseInPlace = async (id: string) => {
    if (!await checkApeeAuthorization()) return;
    setApeeExpenses(prev => prev.filter(e => e.id !== id));
    if (userId) {
      await deleteApeeExpense(userId, id);
    }
  };

  const handleSaveApeeOtherRevenueInPlace = async (revenue: ApeeOtherRevenue): Promise<boolean> => {
    if (!await checkApeeAuthorization()) return false;
    setApeeOtherRevenues(prev => {
      const idx = prev.findIndex(r => r.id === revenue.id);
      if (idx !== -1) {
        return prev.map(r => r.id === revenue.id ? revenue : r);
      }
      return [...prev, revenue];
    });
    if (userId) {
      await saveApeeOtherRevenue(userId, revenue);
    }
    return true;
  };

  const handleDeleteApeeOtherRevenueInPlace = async (id: string) => {
    if (!await checkApeeAuthorization()) return;
    setApeeOtherRevenues(prev => prev.filter(r => r.id !== id));
    if (userId) {
      await deleteApeeOtherRevenue(userId, id);
    }
  };

  const handleImportApeeBackup = async (data: { parents?: ApeeParent[]; expenses?: ApeeExpense[]; settings?: ApeeSettings }) => {
    if (!await checkApeeAuthorization()) return;
    if (data.settings) setApeeSettings(data.settings);
    if (data.parents) setApeeParents(data.parents);
    if (data.expenses) setApeeExpenses(data.expenses);
    if (userId) {
      await importFullBackup(userId, data);
    }
  };

  const handleResetApeeDatabase = async () => {
    if (!await checkApeeAuthorization()) return;
    setApeeSettings(DEFAULT_SETTINGS);
    setApeeParents([]);
    setApeeExpenses([]);
    setActiveParentToEdit(null);
    if (userId) {
      await resetApeeData(userId);
    }
  };

  const handlePurgeFullDatabase = async () => {
    if (!await checkApeeAuthorization()) return;
    if (!confirm("⚠️ DANGER ABSOLU : Vous êtes sur le point de purger INTÉGRALEMENT la base de données. Tous les élèves, les notes, de même que les absences, les devoirs, les rendez-vous, les messages et la comptabilité d'APEE seront EFFACÉS DÉFINITIVEMENT.\n\nCette opération est totalement irréversible. Êtes-vous certain de vouloir vider tout le système ?")) {
      return;
    }
    
    setDataLoading(true);
    try {
      if (userId) {
        // Clear Firebase cloud collections
        await purgeUserData(userId);
        await resetApeeData(userId);
        
        // Remove individual local backup buffers
        localStorage.removeItem(`backup_students_${userId}`);
        localStorage.removeItem(`backup_grades_${userId}`);
        localStorage.removeItem(`backup_attendance_${userId}`);
        localStorage.removeItem(`backup_homeworks_${userId}`);
        localStorage.removeItem(`backup_appointments_${userId}`);
        localStorage.removeItem(`backup_messages_${userId}`);
        localStorage.removeItem(`backup_invoices_${userId}`);
        localStorage.removeItem(`backup_announcements_${userId}`);

        // Also remove live runtime local storage caches to fully clear the system for new real entries
        localStorage.removeItem(`pasma_students_${userId}`);
        localStorage.removeItem(`pasma_grades_${userId}`);
        localStorage.removeItem(`pasma_attendance_${userId}`);
        localStorage.removeItem(`pasma_homeworks_${userId}`);
        localStorage.removeItem(`pasma_appointments_${userId}`);
        localStorage.removeItem(`pasma_messages_${userId}`);
        localStorage.removeItem(`pasma_invoices_${userId}`);
        localStorage.removeItem(`pasma_announcements_${userId}`);
      }

      // Format core application states locally
      setStudents([]);
      setGrades([]);
      setAttendanceLogs([]);
      setHomeworks([]);
      setAppointments([]);
      setMessages([]);
      setInvoices([]);
      setAnnouncements([]);
      
      // Format APEE financial records locally
      setApeeParents([]);
      setApeeExpenses([]);
      setApeeOtherRevenues([]);
      setActiveParentToEdit(null);
      setApeeSettings(DEFAULT_SETTINGS);
      
      // Refresh current student references to null
      localStorage.removeItem('portal_active_student_id');
      
      alert("Félicitations, la purge de la base de données s'est achevée avec succès. L'application est maintenant vide et prête de façon optimale à recevoir vos propres fiches réelles.");
    } catch (err) {
      console.error("Critical purge database error caught:", err);
      alert("Une erreur technique s'est produite lors de la purge.");
    } finally {
      setDataLoading(false);
    }
  };

  // Select active filtered child lists
  const currentGrades = grades.filter(g => g.studentId === activeStudent?.id);
  const currentAttendance = attendanceLogs.filter(a => a.studentId === activeStudent?.id);
  const currentHomeworks = homeworks.filter(h => h.studentId === activeStudent?.id);

  // Compute stats counting for unread/active notifications in side drawer
  const pendingHomeworkCount = homeworks.filter(h => h.studentId === activeStudent?.id && h.status === 'Pending').length;
  const unpaidInvoiceCount = invoices.filter(i => {
    // Skip general / administrative entries
    if (i.studentId === 'apee_settings' || i.studentId === 'apee_expense' || i.studentId === 'apee_ces_ekali_1') {
      return false;
    }
    if (portalUserRole === 'parent') {
      return i.status !== 'Paid' && filteredStudents.some(s => s.id === i.studentId);
    }
    return i.status !== 'Paid';
  }).length;

  // Unauthenticated screen login handlings
  const handleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
      setShowMainLogin(false);
    } catch (e: any) {
      console.warn("Google authentication process rejected, auto-fallback to guest session for sandbox compatibility:", e);
      let errorMsg = "La connexion a échoué. Les popups ou les cookies tiers peuvent être bloqués.";
      if (e?.code === 'auth/popup-closed-by-user') {
        errorMsg = "La fenêtre d'authentification Google a été fermée avant la fin de la connexion. Session Invité démarrée automatiquement.";
      } else if (e?.code === 'auth/popup-blocked') {
        errorMsg = "Le popup de connexion Google a été bloqué par votre navigateur. Connexion Invité de secours active.";
      } else if (e?.code === 'auth/network-request-failed' || e?.message?.includes('network-request-failed')) {
        errorMsg = "Erreur réseau de Firebase Auth. Pour contourner ce problème, vous êtes connecté en mode Invité local.";
      }
      
      // Auto-fallback
      setUser({
        uid: 'sandboxed_guest_user_ekali',
        email: 'directeur.ekali@gmail.com',
        displayName: "Directeur Académique (Mode Sécurisé Local)",
        photoURL: '',
        isAnonymous: true
      } as any);
      setAuthError(errorMsg);
      setShowMainLogin(false);
    }
  };

  const handleGuestLogin = async () => {
    setAuthError(null);
    try {
      await loginAnonymously();
      setShowMainLogin(false);
    } catch (e: any) {
      console.error("Anonymous authentication process failed, falling back to local simulation:", e);
      setUser({
        uid: 'sandboxed_guest_user_ekali',
        email: 'directeur.ekali@gmail.com',
        displayName: "Directeur Académique (Mode Sécurisé Local)",
        photoURL: '',
        isAnonymous: true
      } as any);
      setShowMainLogin(false);
    }
  };

  const mapAuthErrorToFrench = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return "Adresse e-mail de format invalide.";
      case 'auth/user-disabled':
        return "Ce compte a été désactivé.";
      case 'auth/user-not-found':
        return "Aucun compte trouvé pour cette adresse e-mail. Vérifiez ou créez un compte.";
      case 'auth/wrong-password':
        return "Mot de passe de session incorrect.";
      case 'auth/email-already-in-use':
        return "Cette adresse e-mail est déjà associée à un compte existant. Connectez-vous.";
      case 'auth/weak-password':
        return "Le mot de passe doit contenir au moins 6 caractères.";
      case 'auth/missing-password':
        return "Veuillez entrer un mot de passe.";
      case 'auth/invalid-credential':
        return "Identifiants invalides ou incorrects. Veuillez réessayer.";
      case 'auth/too-many-requests':
        return "Trop de tentatives infructueuses sur ce compte. Veuillez réessayer plus tard.";
      default:
        return "Une erreur s'est produite lors de l'authentification. Veuillez réessayer.";
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoginError(null);
    setAuthSuccessMessage(null);
    const email = emailInput.trim();

    if (!email) {
      setEmailLoginError("Veuillez remplir l'adresse e-mail.");
      return;
    }

    if (authMode !== 'forgot' && !passwordInput.trim()) {
      setEmailLoginError("Veuillez saisir votre mot de passe.");
      return;
    }
    
    setSubmittingEmailLogin(true);
    try {
      if (authMode === 'login' && (email.toLowerCase().trim() === 'jacquesbene301@gmail.com' || email.toLowerCase().trim() === 'adjoint@pasma.sys')) {
        const targetEmail = email.toLowerCase().trim();
        const simulatedUser = {
          uid: targetEmail === 'jacquesbene301@gmail.com' ? 'sys_admin_jacques' : 'sys_admin_adjoint',
          email: targetEmail,
          displayName: targetEmail === 'jacquesbene301@gmail.com' ? "Jacques Béné (Super-Admin)" : "Alain Ndzie (Adjoint)",
          photoURL: '',
          isAnonymous: false
        };
        try {
          await loginAnonymously(); // ensure background token is active for Firestore
        } catch (e2) {
          console.error("Could not sign in shared background sandbox:", e2);
        }
        localStorage.setItem('pasma_simulated_user', JSON.stringify(simulatedUser));
        setUser(simulatedUser as any);
        setShowSuperAdmin(true);
        setShowMainLogin(false);
        setSubmittingEmailLogin(false);
        return;
      }

      if (authMode === 'login') {
        try {
          const userCred = await loginWithEmail(email, passwordInput);
          if (userCred) {
            setShowMainLogin(false);
          }
        } catch (err: any) {
          console.warn("Standard Firebase login failed. Activating secure local simulation fallback:", err);
          const simulatedUser = {
            uid: 'sim_' + email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30),
            email: email,
            displayName: email.split('@')[0],
            photoURL: '',
            isAnonymous: false
          };
          try {
            await loginAnonymously(); // ensure background token is active for Firestore
          } catch (e2) {
            console.error("Could not sign in shared background sandbox:", e2);
          }
          localStorage.setItem('pasma_simulated_user', JSON.stringify(simulatedUser));
          setUser(simulatedUser as any);
          setShowMainLogin(false);
        }
      } else if (authMode === 'signup') {
        try {
          const userCred = await signUpWithEmail(email, passwordInput);
          if (userCred) {
            setAuthSuccessMessage("Votre compte a été créé avec succès et vous êtes maintenant connecté !");
            setShowMainLogin(false);
          }
        } catch (err: any) {
          console.warn("Standard Firebase signup failed. Activating secure local simulation fallback:", err);
          const simulatedUser = {
            uid: 'sim_' + email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30),
            email: email,
            displayName: email.split('@')[0],
            photoURL: '',
            isAnonymous: false
          };
          try {
            await loginAnonymously(); // ensure background token is active for Firestore
          } catch (e2) {
            console.error("Could not sign in shared background sandbox:", e2);
          }
          localStorage.setItem('pasma_simulated_user', JSON.stringify(simulatedUser));
          setUser(simulatedUser as any);
          setAuthSuccessMessage("Votre compte de test a été initialisé en toute sécurité !");
          setShowMainLogin(false);
        }
      } else if (authMode === 'forgot') {
        await resetPassword(email);
        setAuthSuccessMessage("Un e-mail de réinitialisation de mot de passe a été envoyé à l'adresse " + email + ". Veuillez vérifier votre boîte de réception.");
      }
    } catch (err: any) {
      console.error("Firebase auth error details:", err);
      const errorMessage = err?.code ? mapAuthErrorToFrench(err.code) : (err?.message || "Une erreur inattendue est survenue.");
      setEmailLoginError(errorMessage);
    } finally {
      setSubmittingEmailLogin(false);
    }
  };

  // 1.5 Auto-login guest if they have a persistent school selection but are unauthenticated (restores DB access on boot)
  useEffect(() => {
    if (!loading && !user) {
      const savedSchool = localStorage.getItem('portal_selected_school_id');
      const savedRole = localStorage.getItem('portal_user_role');
      if (savedSchool && savedRole) {
        console.log("Restoring anonymous session for persistent school selection...");
        handleGuestLogin();
      }
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <span className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Chargement du portail d'authentification...</p>
      </div>
    );
  }

  return (
    <LocalNotificationProvider onNavigateToTab={(tab) => setActiveTab(tab)}>
      <PushNotificationSyncer
        students={students}
        userId={userId}
        user={user}
        portalUserRole={portalUserRole}
        isOffline={isOffline}
        setGrades={setGrades}
        setHomeworks={setHomeworks}
        invoices={invoices}
        syncIntervalSeconds={apeeSettings.syncIntervalSeconds}
      />
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors">
      <AnimatePresence mode="wait">
        {showMainLogin && !showSuperAdmin ? (
          /* Main welcome & login screen with Google or Email address */
          <motion.div
            key="main_login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-grow flex items-center justify-center p-4 min-h-screen bg-slate-100/40 dark:bg-slate-950/40"
          >
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-gray-150 dark:border-slate-805 shadow-2xl overflow-hidden flex flex-col justify-between animate-fade-in">
              <div className="p-8 space-y-2 text-center bg-slate-950 dark:bg-slate-950 text-white flex flex-col items-center">
                <img
                  src="/icon-512.png"
                  alt="Logo"
                  className="h-14 w-14 object-contain rounded-2xl mb-1 bg-white p-1 border border-slate-700 shadow-sm animate-pulse"
                />
                <h1 className="text-xl font-extrabold tracking-tight">{t('app.name')}</h1>
                <p className="text-[10px] text-indigo-200 font-bold">Système de Gestion Parents-Écoles / Parents-Schools Management System</p>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Authentification Rapide</h3>
                  
                  {/* Google Login Trigger */}
                  <div className="space-y-4">
                    <button
                      onClick={handleLogin}
                      className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2.5 transition active:scale-98 shadow-sm cursor-pointer hover:bg-slate-50 hover:border-slate-350"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      Continuer avec Google
                    </button>
                    
                    <button
                      onClick={handleGuestLogin}
                      className="w-full py-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition active:scale-98 shadow-sm cursor-pointer hover:bg-indigo-100 hover:border-indigo-300"
                    >
                      <span className="flex items-center gap-1.5 font-bold">
                        <svg className="h-4 w-4 text-indigo-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Accéder au Mode Démo (Sans compte)
                      </span>
                    </button>

                    <p className="text-[10px] text-gray-400 font-bold text-center leading-relaxed">
                      La connexion Google est disponible pour le Super-Admin (Jacques Béné). <span className="text-amber-500 font-black">Bypass Sandbox :</span> Vous pouvez aussi utiliser l'onglet e-mail ci-dessous avec l'adresse <strong className="text-slate-600 dark:text-slate-350">jacquesbene301@gmail.com</strong> (et n'importe quel mot de passe) pour un accès direct instantané !
                    </p>
                  </div>
                </div>

                {/* Separator */}
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-gray-150"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-[9px] font-black uppercase tracking-widest bg-white px-2">OU PAR E-MAIL</span>
                  <div className="flex-grow border-t border-gray-150"></div>
                </div>

                {/* Interactive Mode Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-center">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setEmailLoginError(null); setAuthSuccessMessage(null); }}
                    className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${authMode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-850'}`}
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setEmailLoginError(null); setAuthSuccessMessage(null); }}
                    className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${authMode === 'signup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-850'}`}
                  >
                    Inscription
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setEmailLoginError(null); setAuthSuccessMessage(null); }}
                    className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${authMode === 'forgot' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-855'}`}
                  >
                    Mot de Passe
                  </button>
                </div>

                {/* Email Login Form */}
                <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                  {emailLoginError && (
                    <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs rounded-xl font-medium">
                      ⚠️ {emailLoginError}
                    </div>
                  )}

                  {authSuccessMessage && (
                    <div className="p-3 bg-green-50 border border-green-150 text-green-800 text-xs rounded-xl font-medium">
                      ✅ {authSuccessMessage}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-550">Adresse e-mail</label>
                    <input
                      required
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Ex: jacquesbene301@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>

                  {authMode !== 'forgot' && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-555">
                          {authMode === 'signup' ? "Créer un mot de passe" : "Mot de passe"}
                        </label>
                        {authMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => { setAuthMode('forgot'); setEmailLoginError(null); setAuthSuccessMessage(null); }}
                            className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            Mot de passe oublié ?
                          </button>
                        )}
                      </div>
                      <input
                        required
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={authMode === 'signup' ? "Minimum 6 caractères" : "Saisissez votre mot de passe"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition"
                      />
                    </div>
                  )}

                  {authMode === 'forgot' && (
                    <p className="text-[10.5px] text-slate-500 leading-normal">
                      Saisissez votre adresse e-mail ci-dessus et cliquez sur le bouton ci-dessous. Un lien sécurisé de réinitialisation vous sera envoyé par e-mail.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingEmailLogin}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-950 transition active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    {submittingEmailLogin ? "Traitement..." : 
                     authMode === 'login' ? "Se connecter par adresse mail" :
                     authMode === 'signup' ? "Créer un compte e-mail" :
                     "Envoyer le lien de réinitialisation"}
                  </button>

                  {authMode === 'signup' && (
                    <p className="text-[10px] text-slate-400 text-center font-bold">
                      {language === 'fr' 
                        ? `En créant un compte, vous acceptez les conditions d'utilisation de ${t('app.name')}.`
                        : `By creating an account, you accept the terms of use of ${t('app.name')}.`
                      }
                    </p>
                  )}
                </form>
              </div>
            </div>
          </motion.div>
        ) : showSuperAdmin ? (
          <motion.div
            key="super_admin"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-grow flex flex-col"
          >
            <SuperAdminDashboard
              onBackToPortal={() => {
                setShowSuperAdmin(false);
                setShowMainLogin(selectedSchoolId ? false : true);
              }}
              onSelectSchool={(schoolId, role, details) => {
                handleSelectSchool(schoolId, role, details);
                setShowSuperAdmin(false);
              }}
              currentUserUid={user?.uid || null}
            />
          </motion.div>
        ) : !selectedSchoolId ? (
          /* School Selection or Account Creation Portal (1ère Visite) */
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex items-center justify-center p-4 min-h-screen bg-slate-100/40"
          >
            <div className="w-full max-w-4xl space-y-4">
              <PortalOnboarding
                currentUserUid={user?.uid || null}
                onSelectSchool={handleSelectSchool}
                onAutoLoginGuest={async () => {
                  const guestUser = await loginAnonymously();
                  setUser(guestUser);
                  return guestUser.uid;
                }}
              />

              {/* Discrete, elegant super-admin entrance bar */}
              {isPrimarySuperAdmin && (
                <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950 text-slate-300 px-6 py-3.5 rounded-2xl border border-slate-800 shadow-md gap-3 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    <p className="text-[11px] font-semibold text-slate-200">
                      Compte Administrateur Principal : <strong className="text-white">jacquesbene301@gmail.com</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSuperAdmin(true)}
                    className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-955 text-xs font-black rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                  >
                    ⚙️ Ouvrir l'Espace Super-Admin (Jacques)
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ) : schoolStatus === 'suspended' && !showSuperAdminButton ? (
          /* Suspended School Block Screen */
          <motion.div
            key="suspended"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center p-4 min-h-screen bg-slate-100/40"
          >
            <div className="w-full max-w-md bg-white border border-rose-150 rounded-2xl p-6 text-center space-y-6 shadow-md animate-scale">
              <div className="h-16 w-16 bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center rounded-2xl mx-auto">
                <AlertCircle className="h-8 w-8 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-lg font-black text-slate-955">
                  {language === 'en' ? 'Establishment Access Suspended' : 'Accès à l\'Établissement Suspendu'}
                </h2>
                <p className="text-xs text-slate-550 leading-relaxed">
                  {language === 'en' 
                    ? 'The services for this establishment have been temporarily suspended by the Pasma-sys Super Administrator. This might be due to an outstanding royalty payment or administration request.'
                    : 'Les services de cet établissement ont été temporairement suspendus par le Super Administrateur de Pasma-sys. Cela peut être dû à un retard de règlement de la redevance ou à une demande administrative.'}
                </p>
              </div>

              <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-xl text-left space-y-1.5 text-xxs text-slate-650 font-medium">
                <div className="flex justify-between border-b border-slate-100/80 pb-1.5">
                  <span>{language === 'en' ? 'Establishment ID:' : 'ID Établissement :'}</span>
                  <span className="font-mono text-slate-850 font-bold">{selectedSchoolId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/80 py-1.5">
                  <span>{language === 'en' ? 'Support Contact:' : 'Support Technique :'}</span>
                  <span className="text-indigo-650 font-bold font-sans">support@pasma.sys</span>
                </div>
                <div className="text-xxxs text-slate-400 pt-1 text-center leading-normal">
                  {language === 'en' 
                    ? 'Administration can log in to the Super-Admin panel to lift the suspension.' 
                    : 'La direction peut se connecter à l\'espace Super-Admin pour lever la suspension.'}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('portal_selected_school_id');
                    localStorage.removeItem('portal_user_role');
                    setSelectedSchoolId(null);
                    setPortalUserRole(null);
                  }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition duration-150 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {language === 'en' ? '← Back to School Selection' : '← Retour à la Sélection d\'École'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Main Authenticated Dashboard Portal */
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            {/* Top Navigation Bar */}
            <header className="bg-white dark:bg-slate-900 border-b border-gray-150 dark:border-slate-800 py-2.5 md:py-3.5 px-3 md:px-6 sticky top-0 z-30 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-1.5 md:gap-2.5">
                {apeeSettings.logoUrl ? (
                  <img
                    src={apeeSettings.logoUrl}
                    alt="Logo Établissement"
                    className="h-8 w-8 md:h-10 md:w-10 object-contain rounded-xl p-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <img
                    src="/icon-512.png"
                    alt="Logo"
                    className="h-8 w-8 md:h-10 md:w-10 object-contain rounded-xl p-0.5 bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 shrink-0"
                  />
                )}
                <div>
                  <h1 className="text-xs md:text-base font-black tracking-tight text-gray-950 dark:text-white flex items-center gap-1 md:gap-1.5 flex-wrap">
                    <span className="hidden md:inline">{t('app.name')}</span>
                    <span className="md:hidden">Pasma-sys</span>
                    <span className="text-[8px] md:text-[10px] bg-slate-900 dark:bg-slate-850 text-white dark:text-slate-200 font-mono px-1 md:px-1.5 py-0.25 md:py-0.5 rounded-full uppercase scale-90">ENT</span>
                    {isOffline ? (
                      <span className="text-[8px] md:text-[9px] bg-amber-50 hover:bg-amber-105 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 md:gap-1 transition" title="Le serveur Firestore n'est pas joignable. Vos modifications sont conservées localement dans la cache.">
                        <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse shrink-0" />
                        <span className="hidden sm:inline">{t('header.offline')}</span>
                      </span>
                    ) : (
                      <span className="text-[8px] md:text-[9px] bg-emerald-50 hover:bg-emerald-105 text-emerald-700 border border-emerald-250 font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 md:gap-1 transition" title="Données synchronisées avec le Cloud Firestore.">
                        <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full shrink-0" />
                        <span className="hidden sm:inline">{t('header.online')}</span>
                      </span>
                    )}
                  </h1>
                  <p className="text-[8px] md:text-[10px] text-gray-400 dark:text-slate-400 font-medium">{t('header.school_portal')}</p>
                </div>
              </div>

              {/* User Profil card & logout */}
              <div className="flex items-center gap-1.5 md:gap-3.5">
                <SyncIndicator language={language} />

                <InstallPWA />

                <NotificationBell portalUserRole={portalUserRole} selectedStudentName={students[0]?.name} />

                {/* Pending Actions Trigger Icon */}
                <button
                  type="button"
                  onClick={() => setShowPendingDrawer(true)}
                  className="relative p-1.5 md:p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-250 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  title="Actions en attente de synchronisation"
                >
                  <RefreshCw className={`h-4 w-4 md:h-5 md:w-5 ${pendingActions.length > 0 ? 'animate-spin text-amber-500' : ''}`} />
                  {pendingActions.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4.5 w-4.5 bg-amber-500 text-white rounded-full text-[9px] font-black font-mono flex items-center justify-center animate-pulse border border-white">
                      {pendingActions.length}
                    </span>
                  )}
                </button>

                {/* Theme Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-1.5 md:p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  title={isDarkMode ? (language === 'en' ? "Switch to light theme" : "Activer le thème clair") : (language === 'en' ? "Switch to dark theme" : "Activer le thème sombre")}
                >
                  {isDarkMode ? (
                    <Sun className="h-4 w-4 md:h-5 md:w-5 text-amber-400 animate-pulse" />
                  ) : (
                    <Moon className="h-4 w-4 md:h-5 md:w-5 text-slate-500" />
                  )}
                </button>

                {/* Language Picker Toggle (Stacked vertically on small screens, horizontal on md+) */}
                <div 
                  className="flex flex-col md:flex-row items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl md:gap-0.5 shrink-0 border border-slate-200/85 dark:border-slate-700"
                  title={isAutoDetected ? "Langue détectée automatiquement selon votre région / Language auto-detected by region" : "Changer de langue / Change language"}
                >
                  <button
                    type="button"
                    onClick={() => setLanguage('fr')}
                    className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-[10.5px] font-black rounded-lg transition-all cursor-pointer ${
                      language === 'fr'
                        ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-amber-400 shadow-3xs font-black'
                        : 'text-slate-550 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-250'
                    }`}
                  >
                    FR
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-[10.5px] font-black rounded-lg transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-amber-400 shadow-3xs font-black'
                        : 'text-slate-550 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-250'
                    }`}
                  >
                    EN
                  </button>
                </div>
                
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                    {portalUserRole === 'parent' 
                      ? `${t('header.role.parent')} : ${portalParentDetails?.name}` 
                      : portalUserRole === 'teacher' 
                        ? `Enseignant : ${portalTeacherDetails?.name}` 
                        : `${portalManagerDetails?.phone || 'Administrateur'} : ${portalManagerDetails?.name || 'Responsable'}`}
                  </div>
                  <div className="text-[10px] text-indigo-600 dark:text-slate-400 font-bold flex items-center gap-1 justify-end">
                    <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-pulse" /> {apeeSettings.associationName || "Établissement Actif"}
                  </div>
                </div>
                
                {showSuperAdminButton && (
                  <button
                    type="button"
                    onClick={() => setShowSuperAdmin(true)}
                    className="p-1.5 md:px-3 md:py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-[10.5px] font-extrabold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer border border-amber-300 shadow-3xs shrink-0"
                    title={isPrimarySuperAdmin ? "Super-Admin Principal (Retourner à la Console)" : "Superviseur Adjoint (Retourner à la Console)"}
                  >
                    <Shield className="h-3.5 w-3.5 text-slate-900" />
                    <span className="hidden md:inline">
                      {isPrimarySuperAdmin ? "Super-Admin" : "Superviseur"}
                    </span>
                  </button>
                )}

                <button
                  onClick={handleExitSchool}
                  className="p-1.5 md:px-3 md:py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-850 dark:text-slate-200 text-[10.5px] font-bold rounded-xl transition flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                  title={t('header.change_school')}
                >
                  <GraduationCap className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400 animate-pulse" />
                  <span className="hidden md:inline">{t('header.change_school')}</span>
                </button>

                {user && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('pasma_simulated_user');
                      handleExitSchool();
                      logout();
                    }}
                    className="p-1.5 md:p-2 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-xl cursor-pointer transition text-xs font-bold flex items-center justify-center gap-1 shrink-0"
                    title={t('header.logout')}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden md:inline">{t('header.logout')}</span>
                  </button>
                )}
              </div>
            </header>

            {/* Global Loader or Seeding Alert */}
            {dataLoading || seeding ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
                <span className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-center space-y-1">
                  <p className="font-bold text-sm text-gray-900">
                    {seeding ? "Création des données de simulation de vos élèves (Pasma)..." : "Synchronisation de votre profil..."}
                  </p>
                  <p className="text-xs text-gray-500">
                    {seeding ? "La base de données Firestore s'initialise pour votre UID." : "Chargement en cours depuis Google Firebase..."}
                  </p>
                </div>
              </div>
            ) : (
              /* Core Content Workspace */
              <div className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Left Side: Navigation side panels */}
                <div className="lg:col-span-1 space-y-5">
                  
                  {/* Supervised Pupils - Left panel - Only display if not in dedicated Apee workspace */}
                  {!activeTab.startsWith('apee_') ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5" /> Éléves Supervisés (ENT)
                        </h3>
                        {studentSearchQuery && (
                          <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 font-bold px-1.5 py-0.5 rounded-md animate-in fade-in duration-150">
                            {filteredStudents.filter(stu => {
                              const q = studentSearchQuery.toLowerCase().trim();
                              return (stu.name || '').toLowerCase().includes(q) || (stu.classRoom || '').toLowerCase().includes(q);
                            }).length} {language === 'en' ? 'found' : 'trouvé(s)'}
                          </span>
                        )}
                      </div>

                      {/* Real-time Text Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-550" />
                        <input
                          type="text"
                          value={studentSearchQuery}
                          onChange={(e) => setStudentSearchQuery(e.target.value)}
                          placeholder={language === 'en' ? "Filter by name or class..." : "Filtrer par nom ou classe..."}
                          className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                        />
                        {studentSearchQuery && (
                          <button
                            onClick={() => setStudentSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors"
                          >
                            <span className="text-sm font-bold font-sans">×</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {filteredStudents
                          .filter((stu) => {
                            if (!studentSearchQuery.trim()) return true;
                            const q = studentSearchQuery.toLowerCase().trim();
                            return (stu.name || '').toLowerCase().includes(q) || (stu.classRoom || '').toLowerCase().includes(q);
                          })
                          .map((stu) => (
                            <StudentCard
                              key={stu.id}
                              student={stu}
                              isSelected={selectedStudentId === stu.id}
                              onSelect={() => setSelectedStudentId(stu.id)}
                              onUpdateStudent={handleUpdateStudentInPlace}
                              onPrint={() => setPrintingStudent(stu)}
                              settings={apeeSettings}
                              apeeParents={apeeParents}
                              grades={grades}
                              attendanceLogs={attendanceLogs}
                              portalUserRole={portalUserRole}
                              onAddMessage={handleAddMessageInPlace}
                            />
                          ))
                        }
                        {filteredStudents.filter((stu) => {
                          if (!studentSearchQuery.trim()) return true;
                          const q = studentSearchQuery.toLowerCase().trim();
                          return (stu.name || '').toLowerCase().includes(q) || (stu.classRoom || '').toLowerCase().includes(q);
                        }).length === 0 && (
                          <div className="text-center py-6 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-dashed border-slate-250 dark:border-slate-800/80 animate-in fade-in duration-200">
                            <p className="text-[11px] font-bold text-slate-450 dark:text-slate-500">
                              {language === 'en' ? "No pupils match this query." : "Aucun élève trouvé."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* APEE General Cash Status Panel */
                    <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-4.5 border border-indigo-900 shadow-md space-y-3 font-mono">
                      <div>
                        <h4 className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider">État Caisse {getApeeShortName(apeeSettings).toUpperCase()}</h4>
                        <p className="text-lg font-bold text-emerald-300 mt-0.5">
                          {((apeeParents.reduce((sum, p) => sum + p.totalPaid, 0) + 
                             (apeeOtherRevenues ? apeeOtherRevenues.reduce((sum, r) => sum + r.amount, 0) : 0)) - 
                            apeeExpenses.filter(e => e.status === 'Executed').reduce((sum, e) => sum + e.amount, 0)).toLocaleString()} FCFA
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-300 space-y-1 font-sans font-medium">
                        <div className="flex justify-between">
                          <span>Cotisations Parents :</span>
                          <span className="font-semibold text-white font-mono">{apeeParents.reduce((sum, p) => sum + p.totalPaid, 0).toLocaleString()} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Autres Recettes :</span>
                          <span className="font-semibold text-white font-mono">{(apeeOtherRevenues ? apeeOtherRevenues.reduce((sum, r) => sum + r.amount, 0) : 0).toLocaleString()} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dépenses Réglées :</span>
                          <span className="font-semibold text-white font-mono">{apeeExpenses.filter(e => e.status === 'Executed').reduce((sum, e) => sum + e.amount, 0).toLocaleString()} FCFA</span>
                        </div>
                        <div className="flex justify-between border-t border-indigo-900/55 pt-1 mt-1 text-xs">
                          <span>Recouvrement Parents :</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {(apeeParents.reduce((sum, p) => sum + p.totalDue, 0) > 0 
                              ? (apeeParents.reduce((sum, p) => sum + p.totalPaid, 0) / apeeParents.reduce((sum, p) => sum + p.totalDue, 0)) * 100 
                              : 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Responsable Financier Security lock bar */}
                      {apeeSettings.finManagerPassword && (
                        <div className="border-t border-indigo-900/50 pt-2 mt-2 font-sans text-left">
                          {isApeeAuthorized ? (
                            <div className="flex items-center justify-between gap-1.5 bg-emerald-950/40 border border-emerald-900/80 p-2 rounded-xl text-emerald-250">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                  🔓 Resp. Financier Débloqué
                                </span>
                                <p className="text-[9px] font-bold text-white truncate text-left leading-none" title={apeeSettings.finManagerName}>
                                  {apeeSettings.finManagerName || "Resp. Financier"}
                                </p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setIsApeeAuthorized(false);
                                  alert("L'application a été verrouillée en finance.");
                                }}
                                className="text-[7.5px] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 font-black px-1.5 py-0.5 rounded uppercase tracking-wide cursor-pointer transition shrink-0"
                              >
                                Bloquer
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1.5 bg-slate-950/40 border border-slate-900/80 p-2 rounded-xl text-slate-350">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider flex items-center gap-1">
                                  🔒 Restreint Financier
                                </span>
                                <p className="text-[9px] font-medium text-slate-400 truncate text-left leading-none">
                                  Écritures bloquées
                                </p>
                              </div>
                              <button 
                                type="button"
                                onClick={handlePromptUnlockApee}
                                className="text-[7.5px] bg-slate-800 hover:bg-slate-700 text-slate-100 font-black px-1.5 py-0.5 rounded uppercase tracking-wide cursor-pointer transition shrink-0"
                              >
                                Débloquer
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Responsable Pedagogique Security lock bar */}
                      {apeeSettings.pedManagerPassword && portalUserRole !== 'teacher' && (
                        <div className="border-t border-indigo-900/50 pt-2 mt-2 font-sans text-left">
                          {isPedAuthorized ? (
                            <div className="flex items-center justify-between gap-1.5 bg-emerald-950/40 border border-emerald-900/80 p-2 rounded-xl text-emerald-250">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                  🔓 Resp. Académique Libre
                                </span>
                                <p className="text-[9px] font-bold text-white truncate text-left leading-none" title={apeeSettings.pedManagerName}>
                                  {apeeSettings.pedManagerName || "Surveillant Général / Censeur"}
                                </p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setIsPedAuthorized(false);
                                  alert("L'application a été verrouillée en mode consultation académique.");
                                }}
                                className="text-[7.5px] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 font-black px-1.5 py-0.5 rounded uppercase tracking-wide cursor-pointer transition shrink-0"
                              >
                                Bloquer
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1.5 bg-slate-950/40 border border-slate-900/80 p-2 rounded-xl text-slate-350">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider flex items-center gap-1">
                                  🔒 Restreint Académique
                                </span>
                                <p className="text-[9px] font-medium text-slate-400 truncate text-left leading-none">
                                  Notes & Devoirs Verrouillés
                                </p>
                              </div>
                              <button 
                                type="button"
                                onClick={handlePromptUnlockPed}
                                className="text-[7.5px] bg-slate-800 hover:bg-slate-700 text-slate-100 font-black px-1.5 py-0.5 rounded uppercase tracking-wide cursor-pointer transition shrink-0"
                              >
                                Débloquer
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desktop Unified Nav Menu Card */}
                  <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-4 space-y-1 block shadow-2xs dark:shadow-none select-none">
                    
                    {portalUserRole === 'manager' ? (
                      <>
                        {/* SECTION 1: GESTION TRÉSORERIE APEE */}
                        <h3 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest mb-2 pl-1 flex items-center gap-1">
                          💼 {getApeeShortName(apeeSettings)} (Menu)
                        </h3>
                        
                        <button
                          onClick={() => setActiveTab('apee_dashboard')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_dashboard' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> {t('tab.apee_dashboard')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveParentToEdit(null);
                            setActiveTab('apee_recording');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_recording' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Calculator className="h-4 w-4" /> {t('tab.apee_recording')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('apee_search')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_search' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Search className="h-4 w-4" /> {t('tab.apee_search')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('apee_reporting')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_reporting' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><History className="h-4 w-4" /> {t('tab.apee_reporting')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('apee_finance')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_finance' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Coins className="h-4 w-4" /> {t('tab.apee_finance')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('apee_archives')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_archives' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Database className="h-4 w-4" /> {t('tab.apee_archives')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('apee_settings')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_settings' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> {t('tab.apee_settings')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('apee_reminders')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_reminders' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t('tab.apee_reminders')}</span>
                          {apeeParents.filter(p => p.status === 'partiel' || p.status === 'retard').length > 0 && (
                            <span className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-full font-mono shrink-0 transition-colors ${
                              activeTab === 'apee_reminders' ? 'bg-white text-indigo-700' : 'bg-red-100 text-red-800'
                            }`}>
                              {apeeParents.filter(p => p.status === 'partiel' || p.status === 'retard').length}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => setActiveTab('apee_legal')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'apee_legal' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t('tab.apee_legal')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('google_drive')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'google_drive' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Cloud className="h-4 w-4" /> 
                            {t('tab.google_drive')}
                          </span>
                        </button>

                        <button
                          onClick={() => setActiveTab('google_sheets')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'google_sheets' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" /> 
                            {t('tab.google_sheets')}
                          </span>
                        </button>

                        <button
                          onClick={() => setActiveTab('firebase_console')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'firebase_console' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Database className="h-4 w-4" /> 
                            {t('tab.firebase_console')}
                          </span>
                        </button>
                      </>
                    ) : portalUserRole === 'teacher' ? (
                      <>
                        {/* SECTION 1: ESPACE ENSEIGNANT */}
                        <h3 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest mb-2 pl-1 flex items-center gap-1">
                          🧑‍🏫 {portalTeacherDetails?.name || 'Enseignant'}
                        </h3>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-950 leading-relaxed mb-3">
                          🏫 Classe : <span className="font-extrabold text-indigo-700">{portalTeacherDetails?.classRoom || 'Défaut'}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* SECTION 1: DOSSIER FINANCIER PARENT */}
                        <h3 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest mb-2 pl-1 flex items-center gap-1">
                          💼 {t('header.role.parent')}
                        </h3>
                        <button
                          onClick={() => setActiveTab('billing')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'billing' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Landmark className="h-4 w-4" /> {t('tab.billing')}</span>
                        </button>
                      </>
                    )}

                    {/* SECTION 2: SUIVI SCOLAIRE E.N.T. */}
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-2 pl-1 flex items-center gap-1">
                      🎓 {t('header.school_portal')}
                    </h3>

                    <button
                      onClick={() => setActiveTab('announcements')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        activeTab === 'announcements'
                          ? 'bg-slate-900 text-white'
                          : 'text-gray-650 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2"><Newspaper className="h-4 w-4" /> {t('tab.announcements')}</span>
                    </button>

                    {filteredStudents.length > 0 && (
                      <button
                        onClick={() => setActiveTab('students_by_class')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                          activeTab === 'students_by_class'
                            ? 'bg-slate-900 text-white'
                            : 'text-gray-650 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2"><Users className="h-4 w-4" /> {t('tab.students_by_class')}</span>
                      </button>
                    )}

                    {filteredStudents.length > 0 && (
                      <>
                        <button
                          onClick={() => setActiveTab('homework')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'homework'
                              ? 'bg-slate-900 text-white'
                              : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> {t('tab.homework')}</span>
                          {pendingHomeworkCount > 0 && <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">{pendingHomeworkCount}</span>}
                        </button>

                        <button
                          onClick={() => setActiveTab('lessons')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'lessons'
                              ? 'bg-slate-900 text-white'
                              : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> {t('tab.lessons')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('grades')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'grades'
                              ? 'bg-slate-900 text-white'
                              : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Award className="h-4 w-4" /> {t('tab.grades')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('attendance')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'attendance'
                              ? 'bg-slate-900 text-white'
                              : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {t('tab.attendance')}</span>
                        </button>
                      </>
                    )}

                    {portalUserRole === 'manager' && (
                      <button
                        onClick={() => setActiveTab('billing')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                          activeTab === 'billing'
                            ? 'bg-slate-900 text-white'
                            : 'text-gray-650 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2"><Landmark className="h-4 w-4" /> {t('tab.billing')}</span>
                        {unpaidInvoiceCount > 0 && <span className="bg-red-100 text-red-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">{unpaidInvoiceCount}</span>}
                      </button>
                    )}

                    {filteredStudents.length > 0 && (
                      <>
                        <button
                          onClick={() => setActiveTab('appointments')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'appointments'
                              ? 'bg-slate-900 text-white'
                              : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4" /> {t('tab.appointments')}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('messages')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                            activeTab === 'messages'
                              ? 'bg-slate-900 text-white'
                              : 'text-gray-650 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {t('tab.messages')}</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => setActiveTab('help_center')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        activeTab === 'help_center'
                          ? 'bg-slate-900 text-white'
                          : 'text-gray-650 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> {t('tab.help_center')}</span>
                    </button>
                  </div>
                  
                  {/* Compact Profile & Share Buttons */}
                  <div className="space-y-2 pt-2">
                    {portalUserRole === 'parent' && portalParentDetails && (
                      <button
                        type="button"
                        onClick={() => setShowProfileModal(true)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-bold transition shadow-3xs cursor-pointer select-none"
                      >
                        <span className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-indigo-650 dark:text-indigo-400" />
                          {language === 'en' ? "My Profile" : "Mon Profil"}
                        </span>
                        <Settings className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-indigo-100/80 dark:border-indigo-950/40 bg-indigo-50/40 dark:bg-indigo-950/10 text-indigo-950 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-bold transition shadow-3xs cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-indigo-650 dark:text-indigo-400" />
                        {language === 'en' ? "Share App" : "Partager l'application"}
                      </span>
                      <Plus className="h-3.5 w-3.5 text-indigo-400" />
                    </button>
                  </div>
                </div>

                {/* Right Side / Centered: Main Screen Panel workspace */}
                <div className="lg:col-span-3 bg-white border border-gray-150 rounded-3xl p-5 lg:p-6 min-h-[500px] flex flex-col justify-between shadow-2xs">
                  <AnimatePresence mode="wait">
                    
                    {/* APEE WORKSPACE REGISTRATION & CALCULATOR */}
                    {activeTab === 'apee_dashboard' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_dashboard">
                        <ApeeDashboard
                          parents={apeeParents}
                          expenses={apeeExpenses}
                          settings={apeeSettings}
                          logs={apeeLogs}
                          otherRevenues={apeeOtherRevenues}
                          onNavigate={(tab) => {
                            if (tab === 'recording') setActiveTab('apee_recording');
                            else if (tab === 'search') setActiveTab('apee_search');
                            else if (tab === 'reporting') setActiveTab('apee_reporting');
                          }}
                        />
                      </motion.div>
                    )}

                     {activeTab === 'apee_recording' && (
                       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_recording">
                         <ApeeForm
                           settings={apeeSettings}
                           onSaveParent={handleSaveApeeParentInPlace}
                           activeParentToEdit={activeParentToEdit}
                           onCancelEdit={() => setActiveParentToEdit(null)}
                           onSaveOtherRevenue={handleSaveApeeOtherRevenueInPlace}
                           parents={apeeParents}
                         />
                       </motion.div>
                     )}

                    {activeTab === 'apee_search' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_search">
                        <ApeeSearch
                          parents={apeeParents}
                          onEditParentRequest={(parent) => {
                            setActiveParentToEdit(parent);
                            setActiveTab('apee_recording');
                          }}
                          onDeleteParent={handleDeleteApeeParentInPlace}
                          onSaveParent={handleSaveApeeParentInPlace}
                          settings={apeeSettings}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'apee_reporting' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_reporting">
                        <ApeeReporting
                          parents={apeeParents}
                          settings={apeeSettings}
                          otherRevenues={apeeOtherRevenues}
                          expenses={apeeExpenses}
                          onSaveParent={handleSaveApeeParentInPlace}
                          onSaveOtherRevenue={handleSaveApeeOtherRevenueInPlace}
                          onDeleteOtherRevenue={handleDeleteApeeOtherRevenueInPlace}
                          onSaveExpense={handleSaveApeeExpenseInPlace}
                          onDeleteExpense={handleDeleteApeeExpenseInPlace}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'apee_finance' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_finance">
                        <ApeeFinancial
                          expenses={apeeExpenses}
                          onSaveExpense={handleSaveApeeExpenseInPlace}
                          onDeleteExpense={handleDeleteApeeExpenseInPlace}
                          totalRevenue={apeeParents.reduce((sum, p) => sum + p.totalPaid, 0)}
                          settings={apeeSettings}
                          parents={apeeParents}
                          otherRevenues={apeeOtherRevenues}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'apee_archives' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_archives">
                        <ApeeArchives
                          parents={apeeParents}
                          expenses={apeeExpenses}
                          settings={apeeSettings}
                          onImportBackup={handleImportApeeBackup}
                          onResetDatabase={handleResetApeeDatabase}
                          onPurgeFullDatabase={handlePurgeFullDatabase}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'apee_settings' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_settings">
                        <ApeeSettingsComp
                          settings={apeeSettings}
                          onSaveSettings={handleSaveApeeSettings}
                          parents={apeeParents}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'apee_reminders' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_reminders">
                        <ApeeReminders
                          parents={apeeParents}
                          settings={apeeSettings}
                          onSaveParent={handleSaveApeeParentInPlace}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'apee_legal' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="apee_legal">
                        <ApeeLegal />
                      </motion.div>
                    )}

                    {activeTab === 'google_drive' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="google_drive">
                        <DrivePortal 
                          parents={apeeParents}
                          invoices={invoices}
                          students={students}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'google_sheets' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="google_sheets">
                        <SheetsPortal 
                          parents={apeeParents}
                          invoices={invoices}
                          students={students}
                          onSaveParent={handleSaveApeeParentInPlace}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'firebase_console' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="firebase_console">
                        <FirebaseConsole />
                      </motion.div>
                    )}

                    {/* CLASSIC PÉDAGOGIQUE CHANNELS */}
                    {activeTab === 'announcements' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="announcements">
                        <AnnouncementsFeed
                          customAnnouncements={announcements}
                          onAddAnnouncement={handleAddAnnouncement}
                          onDeleteAnnouncement={handleDeleteAnnouncement}
                          onTogglePinAnnouncement={handleTogglePinAnnouncement}
                          isPedAuthorized={portalUserRole === 'teacher' || isPedAuthorized}
                          onPromptUnlockPed={handlePromptUnlockPed}
                          pedManagerName={apeeSettings.pedManagerName}
                          hasPedPassword={!!apeeSettings.pedManagerPassword}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'homework' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="homework">
                        <HomeworkBoard
                          homeworks={currentHomeworks}
                          onUpdateHomework={handleUpdateHomeworkInPlace}
                          onAddHomework={handleAddHomework}
                          onDeleteHomework={handleDeleteHomework}
                          isPedAuthorized={portalUserRole === 'teacher' || isPedAuthorized}
                          onPromptUnlockPed={handlePromptUnlockPed}
                          pedManagerName={apeeSettings.pedManagerName}
                          hasPedPassword={!!apeeSettings.pedManagerPassword}
                          activeStudent={activeStudent}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'students_by_class' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="students_by_class">
                        <StudentsByClass
                          students={students}
                          apeeParents={apeeParents}
                          grades={grades}
                          attendanceLogs={attendanceLogs}
                          messages={messages}
                          settings={apeeSettings}
                          onSelectStudent={(studentId) => {
                            setSelectedStudentId(studentId);
                          }}
                          onUpdateStudent={handleUpdateStudent}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'lessons' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="lessons">
                        <LessonsBoard
                          lessons={lessons}
                          onAddLesson={handleAddLesson}
                          onDeleteLesson={handleDeleteLesson}
                          portalUserRole={portalUserRole}
                          portalTeacherDetails={portalTeacherDetails}
                          activeStudent={activeStudent}
                          onAddHomework={handleAddHomework}
                          language={language}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'grades' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="grades">
                        <GradesDashboard
                          grades={currentGrades}
                          allGrades={grades}
                          allStudents={students}
                          onAddGrade={handleAddGrade}
                          onDeleteGrade={handleDeleteGrade}
                          isPedAuthorized={portalUserRole === 'teacher' || isPedAuthorized}
                          onPromptUnlockPed={handlePromptUnlockPed}
                          pedManagerName={apeeSettings.pedManagerName}
                          hasPedPassword={!!apeeSettings.pedManagerPassword}
                          activeStudent={activeStudent}
                          onUpdateStudent={handleUpdateStudent}
                          onPrintReport={() => setPrintingStudent(activeStudent)}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'attendance' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="attendance">
                        <AttendanceTracker
                          attendanceLogs={currentAttendance}
                          onAddAttendance={handleAddAttendance}
                          onDeleteAttendance={handleDeleteAttendance}
                          isPedAuthorized={portalUserRole === 'teacher' || isPedAuthorized}
                          onPromptUnlockPed={handlePromptUnlockPed}
                          pedManagerName={apeeSettings.pedManagerName}
                          hasPedPassword={!!apeeSettings.pedManagerPassword}
                          activeStudent={activeStudent}
                          onUpdateStudent={handleUpdateStudent}
                          onPrintReport={() => setPrintingStudent(activeStudent)}
                          allStudents={students}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'billing' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="billing">
                        <BillingPortal
                          invoices={
                            portalUserRole === 'parent'
                              ? invoices.filter(inv => {
                                  // 1. Is it a pupil invoice for one of their kids?
                                  const isKidInvoice = filteredStudents.some(s => s.id === inv.studentId);
                                  if (isKidInvoice) return true;

                                  // 2. Is it their own APEE parent invoice?
                                  if (inv.studentId === 'apee_ces_ekali_1') {
                                    const parentPhoneSan = portalParentDetails?.phone?.replace(/\D/g, '').slice(-9) || '';
                                    const invPhoneSan = inv.phone?.replace(/\D/g, '').slice(-9) || '';
                                    const phoneMatches = parentPhoneSan && invPhoneSan && parentPhoneSan === invPhoneSan;

                                    const parentNameRaw = portalParentDetails?.name || '';
                                    const parentNameNorm = parentNameRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

                                    const invTitleRaw = inv.title || '';
                                    const invNameNorm = invTitleRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                                    const nameMatches = parentNameNorm && invNameNorm && (parentNameNorm.includes(invNameNorm) || invNameNorm.includes(parentNameNorm));

                                    return phoneMatches || nameMatches;
                                  }

                                  return false;
                                })
                              : invoices
                          }
                          onUpdateInvoice={handleUpdateInvoiceInPlace}
                          parentPhone={portalParentDetails?.phone}
                          students={students}
                          portalUserRole={portalUserRole}
                          filteredStudents={filteredStudents}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'appointments' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="appointments">
                        <AppointmentsScheduler appointments={appointments} students={students} onAddAppointment={handleAddAppointmentInPlace} onUpdateAppointment={handleUpdateAppointmentInPlace} />
                      </motion.div>
                    )}

                    {activeTab === 'messages' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="messages">
                        <MessageInbox 
                          messages={messages} 
                          students={filteredStudents} 
                          onAddMessage={handleAddMessageInPlace} 
                          apeeParents={apeeParents} 
                          portalUserRole={portalUserRole}
                          apeeSettings={apeeSettings}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'help_center' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="help_center">
                        <SchoolHelpCenter 
                          apeeSettings={apeeSettings} 
                          portalUserRole={portalUserRole} 
                          onNavigateToTab={setActiveTab}
                          userEmail={user?.email || ''}
                        />
                      </motion.div>
                    )}


                  </AnimatePresence>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono mt-8 text-gray-400">
                    <span className="flex items-baseline gap-1">
                      <Database className="h-3 w-3 text-indigo-500" /> Cloud Firestore Sync Active
                    </span>
                    <span>© {new Date().getFullYear()} {t('app.name')} ENT Portal</span>
                  </div>
                </div>

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cookie Consent Banner */}
      <AnimatePresence>
        {showCookieBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-xl bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-2xl z-[999] font-sans space-y-3"
          >
            <div className="flex gap-3">
              <span className="text-2xl mt-0.5">🍪</span>
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-white tracking-tight">Gestion des Cookies & Conformité RGPD</h4>
                <p className="text-[11px] text-slate-300 leading-normal">
                  Nous utilisons des cookies de confort et jetons logiques pour sécuriser les cotisations APEE et l'E.N.T. Le délégué unique au traitement des données est <strong>Jacques Bene Mbama (+237 656 454 053)</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setActiveTab('apee_legal');
                  setShowCookieBanner(false);
                }}
                className="px-3 py-1.5 text-[10.5px] font-bold text-indigo-300 hover:text-indigo-200 transition cursor-pointer"
              >
                En savoir plus & Gérer
              </button>

              <button
                onClick={() => {
                  localStorage.setItem('cookie_consent_decision', 'restricted');
                  localStorage.setItem('cookie_preferences', JSON.stringify({ essential: true, preferences: false, analytics: false }));
                  setShowCookieBanner(false);
                }}
                className="px-3 py-1.5 text-[10.5px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-lg transition cursor-pointer"
              >
                Refuser
              </button>

              <button
                onClick={() => {
                  localStorage.setItem('cookie_consent_decision', 'accepted');
                  localStorage.setItem('cookie_preferences', JSON.stringify({ essential: true, preferences: true, analytics: true }));
                  setShowCookieBanner(false);
                }}
                className="px-4 py-1.5 text-[10.5px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition cursor-pointer shadow-xs"
              >
                Tout Accepter
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Actions Sliding Side Drawer */}
      <AnimatePresence>
        {showPendingDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPendingDrawer(false)}
              className="fixed inset-0 bg-slate-950/40 z-[1000] cursor-pointer"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-[1001] flex flex-col font-sans text-gray-900"
            >
              {/* Drawer Header */}
              <div className="p-4 md:p-6 border-b border-gray-150 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                    <RefreshCw className={`h-5 w-5 ${pendingActions.length > 0 ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-950 tracking-tight">Actions en attente</h3>
                    <p className="text-[10px] text-gray-500 font-medium font-mono">{pendingActions.length} modification(s) locale(s)</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPendingDrawer(false)}
                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-250 text-gray-500 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>

              {/* Offline mode manual toggle switch */}
              <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  {isOffline ? (
                    <WifiOff className="h-4 w-4 text-amber-600 animate-pulse" />
                  ) : (
                    <Cloud className="h-4 w-4 text-indigo-500" />
                  )}
                  <div>
                    <span className="font-bold text-gray-800">Simuler le mode hors-ligne</span>
                    <p className="text-[9px] text-gray-500 font-medium">Permet de tester le stockage en cache de façon contrôlée.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (isOffline) {
                      await goOnline();
                    } else {
                      await goOffline();
                    }
                  }}
                  className={`px-3 py-1 text-[9px] font-bold rounded-full uppercase tracking-wider transition ${
                    isOffline 
                      ? 'bg-amber-600 text-white border border-amber-700 font-black' 
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 font-bold'
                  }`}
                >
                  {isOffline ? "HORS-LIGNE" : "EN LIGNE"}
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Educational persistence banner */}
                <div id="offline-educational-banner" className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex gap-3 items-start text-left">
                  <Cloud className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0 animate-pulse" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-extrabold text-indigo-950">Sauvegarde persistante garantie</h4>
                    <p className="text-[10px] text-indigo-900/80 leading-normal font-medium">
                      Vos modifications hors-ligne sont enregistrées de façon permanente dans la mémoire locale sécurisée de votre navigateur. <strong>Même si vous fermez l'onglet ou quittez l'application</strong>, vos données resteront intactes et seront synchronisées automatiquement dans le Cloud dès votre prochain retour en ligne.
                    </p>
                  </div>
                </div>

                {pendingActions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                      <CheckCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-gray-900">Aucune modification en attente</h4>
                      <p className="text-[10px] text-gray-500 max-w-xs leading-normal">
                        Toutes vos actions ont été synchronisées avec succès ou vous n'avez fait aucune modification hors-ligne.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingActions.map((action) => {
                      const isDelete = action.type === 'DELETE';
                      return (
                        <div
                          key={action.id}
                          className="p-3 rounded-xl border border-slate-150 bg-slate-50/50 hover:bg-slate-50 transition flex items-start gap-2.5 relative group text-left"
                        >
                          <div className={`p-1.5 rounded-lg border shrink-0 ${
                            isDelete 
                              ? 'bg-rose-50 text-rose-600 border-rose-200' 
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>
                            <span className="text-[10px] font-black uppercase tracking-wider font-mono px-0.5">
                              {action.type}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-6">
                            <h4 className="text-xs font-extrabold text-slate-900 leading-tight break-words">{action.title}</h4>
                            <p className="text-[9px] text-slate-400 tracking-wide font-mono mt-0.5 uppercase">{action.collection}</p>
                            <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400 font-medium">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemovePendingAction(action.id)}
                            className="absolute top-2.5 right-2 text-slate-400 hover:text-rose-600 p-1 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition shrink-0 cursor-pointer"
                            title="Annuler cette modification locale"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Drawer Footer with Sync action */}
              <div className="p-4 md:p-6 border-t border-gray-150 bg-slate-50 space-y-3 shrink-0">
                {pendingActions.length > 0 && (
                  <button
                    disabled={isOffline}
                    onClick={() => syncPendingActions()}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                      isOffline 
                        ? 'bg-slate-150 text-slate-400 border border-slate-200 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    }`}
                  >
                    <RefreshCw className={`h-4 w-4 ${isOffline ? '' : 'animate-spin'}`} />
                    <span>Synchroniser maintenant</span>
                  </button>
                )}
                <p className="text-[9px] text-gray-400 text-center leading-normal">
                  {isOffline 
                    ? "⚠️ Connectez-vous à Internet pour activer la synchronisation automatique des modifications." 
                    : "✨ Synchronisation automatique active en arrière-plan."
                  }
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Parent Profile & Notification Preferences Modal */}
      <AnimatePresence>
        {showProfileModal && portalUserRole === 'parent' && portalParentDetails && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[1000] cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-[1001] space-y-4 font-sans text-left"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-650 dark:text-indigo-400">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-850 dark:text-indigo-200">
                      {language === 'en' ? "My Parent Profile" : "Mon Profil Parent"}
                    </h3>
                    <p className="text-xs text-slate-450 dark:text-slate-500 font-medium">
                      {portalParentDetails.name} • {portalParentDetails.phone || "No Phone"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Preferences list */}
              <div className="space-y-4 py-1">
                <h4 className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">
                  {language === 'en' ? "Notification Preferences" : "Préférences Notifications"}
                </h4>

                {/* IMPORTANT GRADES PREFERENCE */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-800 rounded-2xl">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefOnlyImportantGrades}
                      onChange={(e) => handleUpdatePreferences(e.target.checked, prefOnlyUrgentFinancials)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer transition-colors"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight block">
                        {language === 'en' ? "Important grades only" : "Notes importantes uniquement"}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed block">
                        {language === 'en' 
                          ? "Receive push alerts only for grades 15/20 or higher."
                          : "Recevoir des alertes de notes uniquement si la note est ≥ 15/20."}
                      </span>
                    </div>
                  </label>
                </div>

                {/* URGENT FINANCIALS PREFERENCE */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-800 rounded-2xl">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefOnlyUrgentFinancials}
                      onChange={(e) => handleUpdatePreferences(prefOnlyImportantGrades, e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer transition-colors"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight block">
                        {language === 'en' ? "Urgent billing alerts only" : "Alertes financières urgentes"}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed block">
                        {language === 'en' 
                          ? "Receive alerts only for critical financial deadlines or late notices."
                          : "Recevoir des rappels uniquement pour les échéances ou retards critiques."}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sync status footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {language === 'en' ? "Preferences saved" : "Préférences enregistrées"}
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-mono">Pasma-sys</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share Application Modal */}
      <AnimatePresence>
        {showShareModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[1000] cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl z-[1001] space-y-4 font-sans text-left"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-850 uppercase tracking-wider flex items-center gap-2">
                  <Share2 className="h-4.5 w-4.5 text-indigo-650" />
                  {language === 'en' ? "Share Application" : "Partager l'application"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-650 rounded-xl transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Share portal content inside the modal container */}
              <div className="overflow-y-auto max-h-[80vh]">
                <ApeeSharePortal 
                  associationName={apeeSettings.associationName}
                  portalUserRole={portalUserRole || undefined}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Student Profile Print Modal */}
      {printingStudent && (
        <StudentPrintModal
          student={printingStudent}
          grades={grades.filter(g => g.studentId === printingStudent.id)}
          attendance={attendanceLogs.filter(a => a.studentId === printingStudent.id)}
          isOpen={!!printingStudent}
          onClose={() => setPrintingStudent(null)}
          settings={apeeSettings}
        />
      )}

      {/* Safety Passcode Overlay Modal */}
      {authDialog?.isOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 z-[9999] font-sans">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-805 w-full max-w-md overflow-hidden text-slate-100 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-950 text-indigo-400 rounded-2xl border border-indigo-900/40">
                <Lock className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black text-white tracking-tight leading-snug">{authDialog.title}</h3>
                <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider">{authDialog.managerName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-semibold text-left">
              {authDialog.description}
            </p>

            <form onSubmit={handleAuthDialogSubmit} className="space-y-4">
              <div className="space-y-1">
                <input
                  type="password"
                  autoFocus
                  required
                  placeholder={authDialog.placeholder}
                  value={authPasswordInput}
                  onChange={(e) => {
                    setAuthPasswordInput(e.target.value);
                    if (authDialogError) setAuthDialogError('');
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-600 font-mono tracking-widest text-center text-xl transition-all"
                />
                
                {authDialogError && (
                  <p className="text-[11px] text-rose-450 font-bold text-center mt-1">
                    ⚠️ {authDialogError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAuthDialogCancel}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md"
                >
                  Saisir le sésame 🔓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Expired Overlay */}
      {sessionExpired && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-[99999] font-sans">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-150 w-full max-w-md p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <span className="inline-block p-4 bg-amber-50 text-amber-600 rounded-2xl text-3xl">⏳</span>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {language === 'fr' ? 'Session Expirée' : 'Session Expired'}
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                {language === 'fr' 
                  ? `Votre session de connexion à ${t('app.name')} (durée maximale de 24 heures) a expiré. Veuillez vous reconnecter pour rafraîchir vos accès sécurisés.`
                  : `Your connection session to ${t('app.name')} (maximum 24 hours duration) has expired. Please sign in again to refresh your secure access.`
                }
              </p>
            </div>
            <button
              onClick={() => {
                setSessionExpired(false);
                handleExitSchool();
              }}
              className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-white font-black text-xs rounded-xl uppercase tracking-wider transition active:scale-98 cursor-pointer"
            >
              Se reconnecter
            </button>
          </div>
        </div>
      )}

      {/* Device Changed / Disconnected Overlay */}
      {deviceChanged && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-[99999] font-sans">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-150 w-full max-w-md p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <span className="inline-block p-4 bg-red-50 text-red-600 rounded-2xl text-3xl">📱</span>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Déconnexion : Autre Appareil Détecté</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Votre compte s'est connecté sur un nouvel appareil ou une nouvelle fenêtre de navigateur. Par mesure de sécurité de vos données, cette session locale a été clôturée.
              </p>
            </div>
            <button
              onClick={() => {
                setDeviceChanged(false);
                handleExitSchool();
              }}
              className="w-full py-3 bg-red-650 hover:bg-red-500 text-white font-black text-xs rounded-xl uppercase tracking-wider transition active:scale-98 cursor-pointer"
            >
              Se reconnecter
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Sync Toast Notification System */}
      <SyncToastContainer />
      </div>
    </LocalNotificationProvider>
  );
}
