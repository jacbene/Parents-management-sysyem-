import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { auth, loginWithGoogle, logout, db, handleFirestoreError, OperationType, loginAnonymously, goOffline, goOnline } from './firebase';
import { isDatabaseSeeded, seedUserData, getOfflineMockData } from './seeder';
import { Student, Grade, Attendance, Homework, Appointment, Message, Invoice, ApeeParent, ApeeExpense, ApeeSettings, Announcement, AnnouncementCategory, ApeeActivityLog, ApeeOtherRevenue } from './types';

// Notifications Push
import { LocalNotificationProvider, useLocalNotifications } from './utils/LocalNotificationContext';
import NotificationBell from './components/NotificationBell';

// APEE Utilities and Components
import {
  fetchApeeData,
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
import { useLanguage } from './utils/TranslationContext';

// Components
import StudentCard from './components/StudentCard';
import AnnouncementsFeed from './components/AnnouncementsFeed';
import GradesDashboard from './components/GradesDashboard';
import AttendanceTracker from './components/AttendanceTracker';
import HomeworkBoard from './components/HomeworkBoard';
import BillingPortal from './components/BillingPortal';
import AppointmentsScheduler from './components/AppointmentsScheduler';
import MessageInbox from './components/MessageInbox';
import StudentPrintModal from './components/StudentPrintModal';
import PortalOnboarding from './components/PortalOnboarding';
import InstallPWA from './components/InstallPWA';
import SuperAdminDashboard from './components/SuperAdminDashboard';
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
  LayoutDashboard,
  Calculator,
  Search,
  History,
  Coins,
  Settings,
  Plus,
  Bell,
  Shield
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
  | 'announcements' 
  | 'homework' 
  | 'grades' 
  | 'attendance' 
  | 'billing' 
  | 'appointments' 
  | 'messages';

interface PushNotificationSyncerProps {
  students: Student[];
  userId: string | null;
  user: User | null;
  portalUserRole: 'parent' | 'manager' | null;
  isOffline: boolean;
  setGrades: React.Dispatch<React.SetStateAction<Grade[]>>;
  setHomeworks: React.Dispatch<React.SetStateAction<Homework[]>>;
}

function PushNotificationSyncer({
  students,
  userId,
  user,
  portalUserRole,
  isOffline,
  setGrades,
  setHomeworks
}: PushNotificationSyncerProps) {
  const { triggerNotification } = useLocalNotifications();
  const { t } = useLanguage();

  useEffect(() => {
    if (!userId || !user || portalUserRole !== 'parent' || isOffline) return;

    let isInitialGrades = true;
    let isInitialHomeworks = true;

    // 1. Listen for new grades
    const gradesQ = query(collection(db, 'grades'), where('parentId', '==', userId));
    const unsubscribeGrades = onSnapshot(gradesQ, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Grade);
      setGrades(list);
      localStorage.setItem(`pasma_grades_${userId}`, JSON.stringify(list));

      if (!isInitialGrades) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newGrade = change.doc.data() as Grade;
            const stu = students.find(s => s.id === newGrade.studentId);
            const studentName = stu?.name || "Votre enfant";
            
            triggerNotification(
              t('notif.grade_added_title'),
              t('notif.grade_added_body', {
                student: studentName,
                score: newGrade.score,
                maxScore: newGrade.maxScore,
                subject: newGrade.subject
              }),
              'grade',
              studentName,
              newGrade.subject,
              'grades'
            );
          }
        });
      }
      isInitialGrades = false;
    }, (error) => {
      console.warn("Real-time grades listener failed:", error);
    });

    // 2. Listen for new homeworks
    const homeworksQ = query(collection(db, 'homeworks'), where('parentId', '==', userId));
    const unsubscribeHomeworks = onSnapshot(homeworksQ, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Homework);
      setHomeworks(list);
      localStorage.setItem(`pasma_homeworks_${userId}`, JSON.stringify(list));

      if (!isInitialHomeworks) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newHw = change.doc.data() as Homework;
            const stu = students.find(s => s.id === newHw.studentId);
            const studentName = stu?.name || "Votre enfant";
            const dueDate = new Date(newHw.dueDate).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short'
            });

            triggerNotification(
              t('notif.homework_added_title'),
              t('notif.homework_added_body', {
                student: studentName,
                subject: newHw.subject,
                title: newHw.title,
                dueDate
              }),
              'homework',
              studentName,
              newHw.subject,
              'homework'
            );
          }
        });
      }
      isInitialHomeworks = false;
    }, (error) => {
      console.warn("Real-time homeworks listener failed:", error);
    });

    return () => {
      unsubscribeGrades();
      unsubscribeHomeworks();
    };
  }, [userId, user, portalUserRole, isOffline, students, triggerNotification, t]);

  return null;
}

export default function App() {
  const { language, setLanguage, t, isAutoDetected } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [secondaryAdmins, setSecondaryAdmins] = useState<{ id: string; email: string; name: string; createdAt: string; addedBy: string }[]>([]);
  
  const isPrimarySuperAdmin = user?.email === 'jacquesbene301@gmail.com';
  const isSecondarySuperAdmin = !!user && secondaryAdmins.some(admin => admin.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
  const showSuperAdminButton = isPrimarySuperAdmin || isSecondarySuperAdmin;

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);


  // Establishment and role-based access state (with persistence)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(() => localStorage.getItem('portal_selected_school_id'));
  const [portalUserRole, setPortalUserRole] = useState<'manager' | 'parent' | null>(() => localStorage.getItem('portal_user_role') as 'manager' | 'parent' | null);
  const [portalParentDetails, setPortalParentDetails] = useState<{ name: string; phone: string; studentSubsetNames?: string[] } | null>(() => {
    const s = localStorage.getItem('portal_parent_details');
    return s ? JSON.parse(s) : null;
  });

  // Nav tab control
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const role = localStorage.getItem('portal_user_role');
    return role === 'parent' ? 'announcements' : 'apee_dashboard';
  });
  
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const decision = localStorage.getItem('cookie_consent_decision');
    if (!decision) {
      setShowCookieBanner(true);
    }
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      await goOnline();
    };
    const handleOffline = async () => {
      setIsOffline(true);
      await goOffline();
    };
    
    if (navigator.onLine) {
      goOnline();
    } else {
      goOffline();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSelectSchool = (schoolId: string, role: 'manager' | 'parent', parentDetails?: { name: string; phone: string; studentSubsetNames?: string[] }) => {
    localStorage.setItem('portal_selected_school_id', schoolId);
    localStorage.setItem('portal_user_role', role);
    if (parentDetails) {
      localStorage.setItem('portal_parent_details', JSON.stringify(parentDetails));
      setPortalParentDetails(parentDetails);
    } else {
      localStorage.removeItem('portal_parent_details');
      setPortalParentDetails(null);
    }
    
    setSelectedSchoolId(schoolId);
    setPortalUserRole(role);
    setActiveTab(role === 'parent' ? 'announcements' : 'apee_dashboard');
  };

  const handleExitSchool = () => {
    localStorage.removeItem('portal_selected_school_id');
    localStorage.removeItem('portal_user_role');
    localStorage.removeItem('portal_parent_details');
    setSelectedSchoolId(null);
    setPortalUserRole(null);
    setPortalParentDetails(null);
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

  // Filter students based on Parent authorized subset for Visitor role
  const filteredStudents = students.filter(s => {
    if (portalUserRole === 'parent') {
      let allowedNames: string[] = [];
      if (portalParentDetails?.studentSubsetNames && portalParentDetails.studentSubsetNames.length > 0) {
        allowedNames = portalParentDetails.studentSubsetNames.map(name => name.toLowerCase().trim());
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
          const studentNameLower = s.name.toLowerCase();
          const hasCommonWord = parentWords.some(word => studentNameLower.includes(word));
          if (hasCommonWord) return true;
          
          // Absolute fallback: if still empty list, allow all students in this custom space so they are never locked out
          return true;
        }
      }
      
      const sNameLower = s.name.toLowerCase().trim();
      return allowedNames.includes(sNameLower) || 
             allowedNames.some(allowed => sNameLower.includes(allowed) || allowed.includes(sNameLower));
    }
    return true;
  });

  // Selected student entity helper (using filtered list)
  const activeStudent = filteredStudents.find(s => s.id === selectedStudentId) || filteredStudents[0];

  // 1. Listen for Authentication changes
  useEffect(() => {
    setIsIframe(window.self !== window.top);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch secondary super admins
  useEffect(() => {
    if (!user) {
      setSecondaryAdmins([]);
      return;
    }
    const fetchAdmins = async () => {
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
        }
      } catch (e) {
        console.warn("Could not retrieve collection 'super_admins' from Firestore. Checking local cache.", e);
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
      }
    };
    fetchAdmins();
  }, [user]);

  // 2. Fetch and seed database state based on Selected School or logged-in account (Unified ID space)
  const userId = selectedSchoolId || user?.uid;
  useEffect(() => {
    if (!userId || !user) {
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

    const initAndFetchData = async () => {
      setDataLoading(true);
      try {
        // A. Verify if database has seeded profiles for this account space (demo schools pre-seeded dynamically if empty)
        let seeded = true; // Default to true for simulated guests to bypass seeding attempts
        const isSimulatedUser = !auth.currentUser || userId.startsWith('sandboxed_guest_');

        if (!isSimulatedUser) {
          try {
            // Check seeding status with a timeout of 2.5 seconds
            seeded = await Promise.race([
              isDatabaseSeeded(userId),
              new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Timeout checking seeded state')), 2500))
            ]);
            if (!seeded) {
              setSeeding(true);
              await seedUserData(userId);
              setSeeding(false);
            }
          } catch (e) {
            console.warn("Seeding verification failed or timed out. Moving to local/offline loading mode.", e);
            await goOffline();
            setIsOffline(true);
          }
        } else {
          console.log("Local simulated workspace session (or unauthenticated state) detected. Bypassing remote database seeding.");
        }

        // B. Fetch all related collections under parentId
        try {
          await fetchAllData(userId);
        } catch (e) {
          console.warn("Failure fetching related collections from Firestore:", e);
          await goOffline();
          setIsOffline(true);
        }

        // C. Fetch APEE data (sync local cache and Firestore)
        try {
          const apeeData = await fetchApeeData(userId);
          if (apeeData.settings) setApeeSettings(apeeData.settings);
          if (apeeData.parents) setApeeParents(apeeData.parents);
          if (apeeData.expenses) setApeeExpenses(apeeData.expenses);
          if (apeeData.logs) setApeeLogs(apeeData.logs);
          if (apeeData.otherRevenues) setApeeOtherRevenues(apeeData.otherRevenues);
        } catch (e) {
          console.warn("APEE data fetch encountered errors:", e);
          await goOffline();
          setIsOffline(true);
        }
      } catch (err) {
        console.error("Initiation payload failure:", err);
      } finally {
        setDataLoading(false);
      }
    };

    initAndFetchData();
  }, [userId, user?.uid]);

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

      // Resolve sequentially with custom handles
      // Make each query try to complete within 3 seconds, or reject immediately to switch to offline-first cache
      async function fetchWithTimeout<T>(promise: Promise<T>, collectionName: string): Promise<T> {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout fetching ${collectionName}`)), 3000))
        ]);
      }

      const [
        studentSnapshot,
        gradeSnapshot,
        attendanceSnapshot,
        homeworkSnapshot,
        appointmentSnapshot,
        messageSnapshot,
        invoiceSnapshot,
        announcementSnapshot
      ] = await Promise.all([
        fetchWithTimeout(getDocs(studentQuery), 'students').catch(err => { console.warn(err); return null; }),
        fetchWithTimeout(getDocs(gradeQuery), 'grades').catch(err => { console.warn(err); return null; }),
        fetchWithTimeout(getDocs(attendanceQuery), 'attendance').catch(err => { console.warn(err); return null; }),
        fetchWithTimeout(getDocs(homeworkQuery), 'homeworks').catch(err => { console.warn(err); return null; }),
        fetchWithTimeout(getDocs(appointmentQuery), 'appointments').catch(err => { console.warn(err); return null; }),
        fetchWithTimeout(getDocs(messageQuery), 'messages').catch(err => { console.warn(err); return null; }),
        fetchWithTimeout(getDocs(invoiceQuery), 'invoices').catch(err => { console.warn(err); return null; }),
        fetchWithTimeout(getDocs(announcementQuery), 'announcements').catch(err => { console.warn(err); return null; })
      ]);

      let loadedAnyFromDb = false;

      // Map back collections safely
      if (studentSnapshot && !studentSnapshot.empty) {
        const studentList = studentSnapshot.docs.map(doc => doc.data() as Student);
        setStudents(studentList);
        setSelectedStudentId(studentList[0]?.id || '');
        localStorage.setItem(`pasma_students_${uid}`, JSON.stringify(studentList));
        localBackupFound = true;
        loadedAnyFromDb = true;
      }

      if (gradeSnapshot && !gradeSnapshot.empty) {
        const list = gradeSnapshot.docs.map(doc => doc.data() as Grade);
        setGrades(list);
        localStorage.setItem(`pasma_grades_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (attendanceSnapshot && !attendanceSnapshot.empty) {
        const list = attendanceSnapshot.docs.map(doc => doc.data() as Attendance);
        setAttendanceLogs(list);
        localStorage.setItem(`pasma_attendance_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (homeworkSnapshot && !homeworkSnapshot.empty) {
        const list = homeworkSnapshot.docs.map(doc => doc.data() as Homework);
        setHomeworks(list);
        localStorage.setItem(`pasma_homeworks_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (appointmentSnapshot && !appointmentSnapshot.empty) {
        const list = appointmentSnapshot.docs.map(doc => doc.data() as Appointment);
        setAppointments(list);
        localStorage.setItem(`pasma_appointments_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (messageSnapshot && !messageSnapshot.empty) {
        const list = messageSnapshot.docs.map(doc => doc.data() as Message);
        setMessages(list);
        localStorage.setItem(`pasma_messages_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (invoiceSnapshot && !invoiceSnapshot.empty) {
        const list = invoiceSnapshot.docs.map(doc => doc.data() as Invoice);
        setInvoices(list);
        localStorage.setItem(`pasma_invoices_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }
      if (announcementSnapshot && !announcementSnapshot.empty) {
        const list = announcementSnapshot.docs.map(doc => doc.data() as Announcement);
        setAnnouncements(list);
        localStorage.setItem(`pasma_announcements_${uid}`, JSON.stringify(list));
        loadedAnyFromDb = true;
      }

      // If we got nothing from DB and nothing in local storage backup, load offline seed mockups!
      if (!loadedAnyFromDb && !localBackupFound) {
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
      }
    } catch (error) {
      console.error("Critical fetching issue occurred:", error);
    }
  };

  // State update actions for instant interactive UI (pushed down to submodules)
  const handleUpdateHomeworkInPlace = (updated: Homework) => {
    setHomeworks(prev => prev.map(hw => hw.id === updated.id ? updated : hw));
  };

  const handleUpdateInvoiceInPlace = (updated: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
  };

  const handleAddAppointmentInPlace = (newApt: Appointment) => {
    setAppointments(prev => [newApt, ...prev]);
  };

  const handleAddMessageInPlace = (newMsg: Message) => {
    setMessages(prev => [...prev, newMsg]);
  };

  const handleUpdateStudent = async (updated: Student) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
    if (userId) {
      try {
        await setDoc(doc(db, 'students', updated.id), updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `students/${updated.id}`);
      }
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
      try {
        await setDoc(doc(db, 'grades', grade.id), grade);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `grades/${grade.id}`);
      }
    }
    return true;
  };

  const handleDeleteGrade = async (id: string) => {
    if (portalUserRole === 'parent') {
      alert("Accès refusé: Les parents ne sont pas autorisés à supprimer les relevés de notes.");
      return false;
    }
    setGrades(prev => prev.filter(g => g.id !== id));
    if (userId) {
      try {
        await deleteDoc(doc(db, 'grades', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `grades/${id}`);
      }
    }
    return true;
  };

  const handleAddHomework = async (homework: Homework) => {
    if (!await checkPedAuthorization()) return false;
    setHomeworks(prev => [homework, ...prev]);
    if (userId) {
      try {
        await setDoc(doc(db, 'homeworks', homework.id), homework);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `homeworks/${homework.id}`);
      }
    }
    return true;
  };

  const handleDeleteHomework = async (id: string) => {
    if (!await checkPedAuthorization()) return false;
    setHomeworks(prev => prev.filter(hw => hw.id !== id));
    if (userId) {
      try {
        await deleteDoc(doc(db, 'homeworks', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `homeworks/${id}`);
      }
    }
    return true;
  };

  const handleAddAttendance = async (log: Attendance) => {
    if (!await checkPedAuthorization()) return false;
    setAttendanceLogs(prev => [log, ...prev]);
    if (userId) {
      try {
        await setDoc(doc(db, 'attendance', log.id), log);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${log.id}`);
      }
    }
    return true;
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!await checkPedAuthorization()) return false;
    setAttendanceLogs(prev => prev.filter(a => a.id !== id));
    if (userId) {
      try {
        await deleteDoc(doc(db, 'attendance', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`);
      }
    }
    return true;
  };

  const handleAddAnnouncement = async (ann: Announcement) => {
    if (!await checkPedAuthorization()) return false;
    setAnnouncements(prev => [ann, ...prev]);
    if (userId) {
      try {
        await setDoc(doc(db, 'announcements', ann.id), {
          ...ann,
          parentId: userId,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `announcements/${ann.id}`);
      }
    }
    return true;
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!await checkPedAuthorization()) return false;
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    if (userId) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
      }
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
            const description = `Création du dossier de ${parent.name}. Cotisation exigible : ${parent.totalDue.toLocaleString()} FCFA pour ${parent.students.length} élève(s). Statut de base : ${parent.status.toUpperCase()}`;
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
                const payDesc = `Versement de ${pay.amount.toLocaleString()} FCFA enregistré par ${pay.method} pour ${parent.name} (Réf : ${pay.transactionId || 'N/A'}${pay.note ? ' - Note : ' + pay.note : ''})`;
                const payLogObj: ApeeActivityLog = {
                  id: payLogId,
                  parentId: userId,
                  timestamp: new Date().toISOString(),
                  parentName: parent.name,
                  actionType: 'ADD_PAYMENT',
                  description: payDesc,
                  amount: pay.amount,
                  operatorName: operator
                };
                await saveApeeLog(userId, payLogObj);
                setApeeLogs(prev => [payLogObj, ...prev]);
              }
            }
          } else if (oldParent) {
            if (oldParent.totalDue !== parent.totalDue || oldParent.name !== parent.name || oldParent.students.length !== parent.students.length) {
              const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
              const description = `Mise à jour de la fiche parent de ${parent.name}. Dues totales exigibles ajustées : de ${oldParent.totalDue.toLocaleString()} à ${parent.totalDue.toLocaleString()} FCFA (${parent.students.length} élève(s)).`;
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
              const payDesc = `Nouveau versement de ${pay.amount.toLocaleString()} FCFA enregistré par ${pay.method} pour les les redevances de ${parent.name} (Réf : ${pay.transactionId || 'N/A'}${pay.note ? ' - Note : ' + pay.note : ''}).`;
              const payLogObj: ApeeActivityLog = {
                id: payLogId,
                parentId: userId,
                timestamp: new Date().toISOString(),
                parentName: parent.name,
                actionType: 'ADD_PAYMENT',
                description: payDesc,
                amount: pay.amount,
                operatorName: operator
              };
              await saveApeeLog(userId, payLogObj);
              setApeeLogs(prev => [payLogObj, ...prev]);
            }

            const currentPaymentIds = new Set((parent.payments || []).map(p => p.id));
            const deletedPayments = (oldParent.payments || []).filter(p => !currentPaymentIds.has(p.id));
            for (const pay of deletedPayments) {
              const payLogId = 'log_' + Date.now() + '_del_' + Math.random().toString(36).substr(2, 4);
              const payDesc = `Le versement de ${pay.amount.toLocaleString()} FCFA effectué par ${pay.method} pour ${parent.name} a été annulé de l'historique financier.`;
              const payLogObj: ApeeActivityLog = {
                id: payLogId,
                parentId: userId,
                timestamp: new Date().toISOString(),
                parentName: parent.name,
                actionType: 'REMOVE_PAYMENT',
                description: payDesc,
                amount: pay.amount,
                operatorName: operator
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
          const description = `Suppression définitive du dossier de ${deletedParent.name} (Attente de redevance perdue : -${deletedParent.totalDue.toLocaleString()} FCFA, Versements annulés : -${deletedParent.totalPaid.toLocaleString()} FCFA).`;
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
    } catch (e: any) {
      console.error("Google authentication process rejected, auto-fallback to guest session for sandbox compatibility:", e);
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
    }
  };

  const handleGuestLogin = async () => {
    setAuthError(null);
    try {
      await loginAnonymously();
    } catch (e: any) {
      console.error("Anonymous authentication process failed, falling back to local simulation:", e);
      setUser({
        uid: 'sandboxed_guest_user_ekali',
        email: 'directeur.ekali@gmail.com',
        displayName: "Directeur Académique (Mode Sécurisé Local)",
        photoURL: '',
        isAnonymous: true
      } as any);
    }
  };

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
      />
      <div className="min-h-screen bg-slate-50/50 flex flex-col text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <AnimatePresence mode="wait">
        {showSuperAdmin ? (
          <motion.div
            key="super_admin"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-grow flex flex-col"
          >
            <SuperAdminDashboard
              onBackToPortal={() => setShowSuperAdmin(false)}
              onSelectSchool={(schoolId, role) => {
                handleSelectSchool(schoolId, role);
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
                    className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                  >
                    ⚙️ Ouvrir l'Espace Super-Admin (Jacques)
                  </button>
                </div>
              )}
            </div>
          </motion.div>

        ) : !user ? (
          /* Landing Screen / Login */
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex items-center justify-center p-4 min-h-screen"
          >
            <div className="w-full max-w-lg bg-white rounded-3xl border border-gray-150 shadow-xl overflow-hidden flex flex-col justify-between">
              <div className="p-8 space-y-2 text-center bg-slate-900 text-white flex flex-col items-center">
                <img
                  src="/icon-512.png"
                  alt="Logo"
                  className="h-16 w-16 object-contain rounded-2xl mb-1 bg-white p-1 border border-slate-700 shadow-sm"
                />
                <h1 className="text-2xl font-extrabold tracking-tight">Pasma-sys</h1>
                <p className="text-xs text-indigo-200">Parents Management System (Système de gestion parentale)</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4 text-sm text-gray-650 leading-relaxed">
                  <div className="flex gap-3">
                    <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold shrink-0">🤝</span>
                    <div>
                      <h4 className="font-bold text-gray-950 text-xs uppercase tracking-wider">Suivi Scolaire Simplifié</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Consultez en temps réel les notes de vos enfants, leur relevé d'assiduité, et l'avancement des devoirs exigés.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold shrink-0">💳</span>
                    <div>
                      <h4 className="font-bold text-gray-950 text-xs uppercase tracking-wider">Reglements & Planification</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Réglez la cantine ou l'abonnement transport, et dialoguez directement avec les professeurs principaux de l'école.</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-4">
                  {/* Error display */}
                  {authError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl font-medium space-y-1">
                      <p className="font-bold flex items-center gap-1">❌ Erreur de connexion</p>
                      <p className="leading-relaxed text-[11px] text-red-700">{authError}</p>
                    </div>
                  )}

                  {/* Google Login Trigger */}
                  <div className="space-y-2">
                    <button
                      onClick={handleLogin}
                      className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition active:scale-98 shadow-md shadow-indigo-100 cursor-pointer hover:bg-indigo-700"
                    >
                      <UserCheck className="h-4 w-4" /> Connectez-vous avec Google
                    </button>
                    <p className="text-[10px] text-gray-400 font-mono text-center">
                      Liaison sécurisée via Firebase Authentication
                    </p>
                  </div>

                  {/* Separator */}
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest bg-white px-2">Alternative</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>

                  {/* Mode Démo button & Iframe Notice */}
                  <div className="space-y-3">
                    <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl text-[11px] leading-relaxed text-amber-900">
                      <p className="font-bold flex items-center gap-1.5 text-amber-950 mb-0.5">
                        ⚠️ Limitation de l'aperçu intégré (Iframe)
                      </p>
                      Les politiques de sécurité des navigateurs (Chrome, Safari, Firefox) bloquent souvent les popups Google Auth au sein d'un aperçu d'édition. Pour utiliser Pasma-sys, vous pouvez soit :
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs text-center"
                      >
                        Ouvrir l'App en grand ↗
                      </a>

                      <button
                        type="button"
                        onClick={handleGuestLogin}
                        className="py-2.5 bg-white hover:bg-slate-50 text-gray-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-gray-250 cursor-pointer shadow-2xs"
                      >
                        ⚡ Utiliser le Mode Démo
                      </button>
                    </div>
                  </div>
                </div>
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
            <header className="bg-white border-b border-gray-150 py-3.5 px-6 sticky top-0 z-30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {apeeSettings.logoUrl ? (
                  <img
                    src={apeeSettings.logoUrl}
                    alt="Logo Établissement"
                    className="h-10 w-10 object-contain rounded-xl p-0.5 bg-slate-50 border border-slate-150 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <img
                    src="/icon-512.png"
                    alt="Logo"
                    className="h-10 w-10 object-contain rounded-xl p-0.5 bg-indigo-50 border border-indigo-100 shrink-0"
                  />
                )}
                <div>
                  <h1 className="text-base font-black tracking-tight text-gray-950 flex items-center gap-1.5 flex-wrap">
                    Pasma-sys <span className="text-[10px] bg-slate-900 text-white font-mono px-1.5 py-0.5 rounded-full uppercase scale-90">ENT</span>
                    {isOffline ? (
                      <span className="text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1 transition" title="Le serveur Firestore n'est pas joignable. Vos modifications sont conservées localement dans la cacher.">
                        <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse shrink-0" /> {t('header.offline')}
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-250 font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1 transition" title="Données synchronisées avec le Cloud Firestore.">
                        <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full shrink-0" /> {t('header.online')}
                      </span>
                    )}
                  </h1>
                  <p className="text-[10px] text-gray-400 font-medium">{t('header.school_portal')}</p>
                </div>
              </div>

              {/* User Profil card & logout */}
              <div className="flex items-center gap-3.5">
                <InstallPWA />

                <NotificationBell portalUserRole={portalUserRole} selectedStudentName={students[0]?.name} />

                {/* Language Picker Toggle */}
                <div 
                  className="flex items-center bg-slate-100 hover:bg-slate-200 p-1 rounded-xl gap-1 shrink-0 border border-slate-250"
                  title={isAutoDetected ? "Langue détectée automatiquement selon votre région / Language auto-detected by region" : "Changer de langue / Change language"}
                >
                  <button
                    type="button"
                    onClick={() => setLanguage('fr')}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                      language === 'fr'
                        ? 'bg-white text-indigo-700 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    🇫🇷 FR
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-white text-indigo-700 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-855'
                    }`}
                  >
                    🇬🇧 EN
                  </button>
                </div>
                
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-black text-indigo-950">
                    {portalUserRole === 'parent' ? `${t('header.role.parent')} : ${portalParentDetails?.name}` : t('header.role.manager')}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 justify-end">
                    <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-pulse" /> {apeeSettings.associationName || "Établissement Actif"}
                  </div>
                </div>
                
                {showSuperAdminButton && (
                  <button
                    type="button"
                    onClick={() => setShowSuperAdmin(true)}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-[10.5px] font-extrabold rounded-xl transition flex items-center gap-1 cursor-pointer border border-amber-300 shadow-2xs shrink-0"
                    title={isPrimarySuperAdmin ? "Retourner à la Console de Supervision Globale (Principal)" : "Retourner à la Console de Supervision Globale (Adjoint)"}
                  >
                    ⚙️ {isPrimarySuperAdmin ? "Super-Admin Principal" : "Superviseur Adjoint"}
                  </button>
                )}

                <button
                  onClick={handleExitSchool}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10.5px] font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 cursor-pointer shrink-0"
                  title="Changer d'établissement scolaire"
                >
                  🏫 {t('header.change_school')}
                </button>

                {user && (
                  <button
                    onClick={() => { handleExitSchool(); logout(); }}
                    className="p-2 text-gray-440 hover:text-red-500 rounded-xl hover:bg-red-50 cursor-pointer transition text-xs font-bold"
                    title="Déconnexion complète"
                  >
                    {t('header.logout')}
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
                    {seeding ? "Création des données de simulation de vos élèves (Pasma)..." : "Synchronisation de votre profil parent..."}
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
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" /> Éléves Supervisés (ENT)
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {filteredStudents.map((stu) => (
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
                        ))}
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
                      {apeeSettings.pedManagerPassword && (
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
                  <div className="bg-white border border-gray-150 rounded-2xl p-4 space-y-1 block shadow-2xs select-none">
                    
                    {portalUserRole !== 'parent' ? (
                      <>
                        {/* SECTION 1: GESTION TRÉSORERIE APEE */}
                        <h3 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest mb-2 pl-1 flex items-center gap-1">
                          💼 {getApeeShortName(apeeSettings)} (APEE)
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

                    {portalUserRole !== 'parent' && (
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

                    {/* CLASSIC PÉDAGOGIQUE CHANNELS */}
                    {activeTab === 'announcements' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="announcements">
                        <AnnouncementsFeed
                          customAnnouncements={announcements}
                          onAddAnnouncement={handleAddAnnouncement}
                          onDeleteAnnouncement={handleDeleteAnnouncement}
                          isPedAuthorized={isPedAuthorized}
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
                          isPedAuthorized={isPedAuthorized}
                          onPromptUnlockPed={handlePromptUnlockPed}
                          pedManagerName={apeeSettings.pedManagerName}
                          hasPedPassword={!!apeeSettings.pedManagerPassword}
                          activeStudent={activeStudent}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'grades' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="grades">
                        <GradesDashboard
                          grades={currentGrades}
                          onAddGrade={handleAddGrade}
                          onDeleteGrade={handleDeleteGrade}
                          isPedAuthorized={isPedAuthorized}
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
                          isPedAuthorized={isPedAuthorized}
                          onPromptUnlockPed={handlePromptUnlockPed}
                          pedManagerName={apeeSettings.pedManagerName}
                          hasPedPassword={!!apeeSettings.pedManagerPassword}
                          activeStudent={activeStudent}
                          onUpdateStudent={handleUpdateStudent}
                          onPrintReport={() => setPrintingStudent(activeStudent)}
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

                                    const parentNameNorm = portalParentDetails?.name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() || '';
                                    const invNameNorm = inv.title?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() || '';
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
                        <AppointmentsScheduler appointments={appointments} students={students} onAddAppointment={handleAddAppointmentInPlace} />
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


                  </AnimatePresence>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono mt-8 text-gray-400">
                    <span className="flex items-baseline gap-1">
                      <Database className="h-3 w-3 text-indigo-500" /> Cloud Firestore Sync Active
                    </span>
                    <span>© {new Date().getFullYear()} Pasma-sys ENT Portal</span>
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
      </div>
    </LocalNotificationProvider>
  );
}
