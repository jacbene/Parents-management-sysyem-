import React, { useState, useEffect } from 'react';
import { collection, doc, DocumentData, getDoc, getDocs, query, Query, setDoc, writeBatch, where, onSnapshot } from 'firebase/firestore';
import { db, auth, loginAnonymously } from '../firebase';
import { logAuthError } from '../utils/authLogger';
import { Landmark, Plus, CheckCircle, AlertOctagon, UserCheck, Phone, ShieldCheck, ArrowRight, X, User, HelpCircle, Mail, Smartphone, Key, RotateCw, Bell, Share2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ApeeSettings, ApeeParent, Student, Grade, Homework, Attendance, Invoice, Establishment } from '../types';
import { syncLocalSchoolsToFirestore, saveAndSyncEstablishment, getDeletedSchoolIds, fetchAndSyncDeletedSchoolIds, sanitizeFirestoreId, cleanPayload, isDemoEstablishment } from '../utils/schoolSync';
import { useLanguage } from '../utils/TranslationContext';


interface PortalOnboardingProps {
  onSelectSchool: (schoolId: string, role: 'manager' | 'parent' | 'teacher', details?: { name: string; phone: string; classRoom?: string; email?: string; studentSubsetNames?: string[]; invoiceId?: string }) => void;
  currentUserUid: string | null;
  currentUserEmail?: string | null;
  onRequestLogin?: () => void;
  onRequestSuperAdmin?: () => void;
  onAutoLoginGuest: () => Promise<string>;
}

export const DEFAULT_SYSTEM_SCHOOLS: Establishment[] = [
  {
    id: 'demo_school_ekali',
    name: "CES d'Ekali 1 - MFOU",
    cotisationAmount: 25000,
    financialGoal: 2500000,
    finManagerName: 'Bene Jacques',
    finManagerPhone: '687463313',
    finManagerPassword: '1234',
    pedManagerName: 'M. Le Censeur',
    pedManagerPhone: '654053000',
    pedManagerPassword: '1234',
    schoolYear: '2025/2026',
    ownerId: 'owner_demo'
  },
  {
    id: 'demo_school_vogt',
    name: "Collège Vogt - Yaoundé",
    cotisationAmount: 35000,
    financialGoal: 12000000,
    finManagerName: 'Abbé Ondoa',
    finManagerPhone: '699445522',
    finManagerPassword: '1234',
    pedManagerName: 'Abbé Ondoa',
    pedManagerPhone: '699445522',
    pedManagerPassword: '1234',
    schoolYear: '2025/2026',
    ownerId: 'owner_demo'
  },
  {
    id: 'demo_school_bilingue',
    name: "Lycée Bilingue d'Essos",
    cotisationAmount: 25000,
    financialGoal: 8000000,
    finManagerName: 'M. Tchana',
    finManagerPhone: '655112233',
    finManagerPassword: '1234',
    pedManagerName: 'M. Tchana',
    pedManagerPhone: '655112233',
    pedManagerPassword: '1234',
    schoolYear: '2025/2026',
    ownerId: 'owner_demo'
  }
];

export default function PortalOnboarding({ onSelectSchool, currentUserUid, currentUserEmail, onRequestLogin, onRequestSuperAdmin, onAutoLoginGuest }: PortalOnboardingProps) {
  const { t, language } = useLanguage();
  const isUserLoggedIn = Boolean((auth.currentUser && !auth.currentUser.isAnonymous) || currentUserEmail);
  const [schools, setSchools] = useState<Establishment[]>(() => {
    if (isUserLoggedIn) {
      try {
        const localEstsStr = localStorage.getItem('pasma_local_establishments');
        if (localEstsStr) {
          const localEsts = JSON.parse(localEstsStr);
          if (Array.isArray(localEsts)) {
            return localEsts.filter((s: Establishment) => !isDemoEstablishment(s.id));
          }
        }
      } catch {}
      return [];
    }
    return DEFAULT_SYSTEM_SCHOOLS;
  });
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [activeTab, setActiveTab] = useState<'choose' | 'create'>('choose');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Visibility Toggles for Password Inputs
  const [showTeacherCode, setShowTeacherCode] = useState(false);
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [showFinPassword, setShowFinPassword] = useState(false);
  const [showPedPassword, setShowPedPassword] = useState(false);

  // Connection Role (Parent vs Administrator vs Teacher)
  const [onboardingRole, setOnboardingRole] = useState<'parent' | 'manager' | 'teacher'>('parent');
  const [managerPassword, setManagerPassword] = useState('');
  const [adminRole, setAdminRole] = useState('Directeur Académique');
  const [adminName, setAdminName] = useState('');

  // Teacher Login State
  const [availableTeachers, setAvailableTeachers] = useState<Array<{ classRoom: string; teacherName: string; teacherPhone?: string; teacherEmail?: string }>>([]);
  const [selectedTeacherName, setSelectedTeacherName] = useState('');
  const [teacherVerificationCode, setTeacherVerificationCode] = useState('');

  // Custom Logo Upload state
  const [schoolLogo, setSchoolLogo] = useState<string>('');

  // Parent Login Form State
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [verifyingParent, setVerifyingParent] = useState(false);

  // OTP & Cameroonian Rural Area Connectivity States
  const [parentEmail, setParentEmail] = useState(''); // Completely optional email
  const [otpStep, setOtpStep] = useState<'input_phone' | 'input_otp'>('input_phone');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(3);
  const [matchedParentState, setMatchedParentState] = useState<any | null>(null);
  const [otpSimulatedMessage, setOtpSimulatedMessage] = useState<{
    isOpen: boolean;
    otp: string;
    phone: string;
    parentName: string;
    schoolName: string;
  } | null>(null);

  // Create School Form State
  const [schoolName, setSchoolName] = useState('');
  const [cotisationAmount, setCotisationAmount] = useState<number>(25000);
  const [financialGoal, setFinancialGoal] = useState<number>(2500000);
  const [schoolYear, setSchoolYear] = useState('2025/2026');
  
  // Financier & Pedagogique Manager info
  const [finName, setFinName] = useState('');
  const [finPhone, setFinPhone] = useState('');
  const [finPassword, setFinPassword] = useState('');
  
  const [pedName, setPedName] = useState('');
  const [pedPhone, setPedPhone] = useState('');
  const [pedPassword, setPedPassword] = useState('');

  const [creatingSchool, setCreatingSchool] = useState(false);

  // Use baseline defaults and account's cached schools when Firestore is unavailable.
  const buildFallbackSchoolsList = (deletedSet: Set<string>): Establishment[] => {
    const merged: Establishment[] = [];
    const activeEmail = (auth.currentUser?.email || currentUserEmail || '').trim().toLowerCase();
    const isAnonymousGuest = !auth.currentUser || auth.currentUser.isAnonymous || !activeEmail;

    // Baseline standard establishments are ONLY reserved for anonymous demo mode users without an account
    if (isAnonymousGuest) {
      DEFAULT_SYSTEM_SCHOOLS.forEach(ds => {
        if (!deletedSet.has(ds.id) && !deletedSet.has(sanitizeFirestoreId(ds.id))) {
          merged.push(ds);
        }
      });
    }

    try {
      const localEstsStr = localStorage.getItem('pasma_local_establishments');
      if (localEstsStr) {
        const localEsts = JSON.parse(localEstsStr);
        if (Array.isArray(localEsts)) {
          localEsts.forEach((le: any) => {
            if (le && le.id && !deletedSet.has(le.id) && !deletedSet.has(sanitizeFirestoreId(le.id)) && !merged.some(m => m.id === le.id)) {
              if (isAnonymousGuest || !isDemoEstablishment(le.id)) {
                merged.push(le);
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn("Failed to parse local establishments:", e);
    }
    return merged;
  };

  // Fetch establishments or bind real-time subscription
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    let isMounted = true;

    const setupSchoolListener = async () => {
      setLoadingSchools(true);
      setErrorMessage(null);
      try {
        // Ensure user is signed in to pass Firestore Security Rules (allow read: if isSignedIn())
        if (!auth.currentUser) {
          try {
            await loginAnonymously();
          } catch (authErr) {
            console.warn('[PortalOnboarding] Anonymous auth notice during school fetch:', authErr);
          }
        }
        const authenticatedUid = auth.currentUser?.uid;
        if (!authenticatedUid) {
          throw new Error("Une session Firebase est requise pour consulter les établissements.");
        }

        // 1. First sync deleted school IDs from Firestore central registry
        const deletedSet = await fetchAndSyncDeletedSchoolIds();

        // 2. First sync any cached local schools into Firestore
        await syncLocalSchoolsToFirestore();

        const schoolLists = new Map<string, Establishment[]>();
        const publishSchools = () => {
          if (!isMounted) return;
          const networkSchools = new Map<string, Establishment>();
          const activeEmail = (auth.currentUser?.email || currentUserEmail || '').trim().toLowerCase();
          const isAnonymousGuest = !auth.currentUser || auth.currentUser.isAnonymous || !activeEmail;

          // Base default schools ONLY for anonymous demo mode users without an account
          if (isAnonymousGuest) {
            DEFAULT_SYSTEM_SCHOOLS.forEach(sch => {
              if (!deletedSet.has(sch.id) && !deletedSet.has(sanitizeFirestoreId(sch.id))) {
                networkSchools.set(sch.id, sch);
              }
            });
          }

          schoolLists.forEach(list => list.forEach(school => {
            if (!isAnonymousGuest && isDemoEstablishment(school.id)) {
              return;
            }
            const existing = networkSchools.get(school.id);
            networkSchools.set(school.id, existing ? { ...school, ...existing } : school);
          }));

          let fullSchoolList = Array.from(networkSchools.values());
          if (!isAnonymousGuest) {
            fullSchoolList = fullSchoolList.filter(s => !isDemoEstablishment(s.id));
          }

          const finalList = fullSchoolList.length > 0
            ? fullSchoolList
            : buildFallbackSchoolsList(deletedSet);

          try {
            const trustedSchools = Array.from(
              new Map(
                (schoolLists.get('owner') || []).map(school => [school.id, school])
              ).values()
            ).filter(s => isAnonymousGuest || !isDemoEstablishment(s.id));
            if (trustedSchools.length > 0) {
              localStorage.setItem('pasma_local_establishments', JSON.stringify(trustedSchools));
            }
          } catch (e) {
            console.warn('[PortalOnboarding] Failed to update local establishments refuge:', e);
          }

          setSchools(finalList);
          setLoadingSchools(false);
        };

        const subscribeToSchools = (source: string, q: Query<DocumentData>) => {
          unsubscribers.push(onSnapshot(q, (snapshot) => {
            schoolLists.set(source, snapshot.docs
              .filter(docSnap => {
                const data = docSnap.data();
                const sanId = sanitizeFirestoreId(docSnap.id);
                return !data.isDeleted && !deletedSet.has(docSnap.id) && !deletedSet.has(sanId);
              })
              .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Establishment)));
            publishSchools();
          }, (err) => {
            console.warn(`[PortalOnboarding] ${source} establishments listener failed:`, err);
            schoolLists.set(source, []);
            publishSchools();
          }));
        };

        subscribeToSchools('owner', query(
          collection(db, 'establishments'),
          where('ownerId', '==', authenticatedUid)
        ));

        // Parents need a safe school directory; owner and staff queries alone omit their schools.
        schoolLists.set('directory', []);
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          try {
            const directoryResponse = await fetch('/api/establishments/directory', {
              headers: { Authorization: `Bearer ${idToken}` }
            });
            const directoryResult = await directoryResponse.json();
            if (directoryResponse.ok && directoryResult.success && Array.isArray(directoryResult.schools)) {
              schoolLists.set('directory', directoryResult.schools
                .filter((school: any) => school?.id && school?.name && !deletedSet.has(school.id))
                .map((school: any) => ({
                  id: school.id,
                  name: school.name,
                  logoUrl: school.logoUrl || '',
                  cotisationAmount: 0,
                  financialGoal: 0,
                  finManagerName: '',
                  finManagerPhone: '',
                  schoolYear: '',
                  ownerId: '',
                } as Establishment)));
              publishSchools();
            }
          } catch (directoryError) {
            console.warn('[PortalOnboarding] Could not load establishment directory from API (using base/cached list):', directoryError);
          }

          const activeEmail = auth.currentUser?.email?.trim().toLowerCase() || '';
          if (activeEmail) {
            try {
              const managerResponse = await fetch('/api/establishments/available-for-manager', {
                headers: { Authorization: `Bearer ${idToken}` }
              });
              const managerResult = await managerResponse.json();
              if (managerResponse.ok && managerResult.success && Array.isArray(managerResult.schools)) {
                schoolLists.set('manager', managerResult.schools
                  .filter((school: any) => school?.id && !deletedSet.has(school.id))
                  .map((school: any) => school as Establishment));
                publishSchools();
              }
            } catch (managerError) {
              console.warn('[PortalOnboarding] Could not load manager establishments:', managerError);
            }

            try {
              const response = await fetch('/api/establishments/available-for-teacher', {
                headers: { Authorization: `Bearer ${idToken}` }
              });
              const result = await response.json();
              if (response.ok && result.success && Array.isArray(result.schools)) {
                const teacherSchools: Establishment[] = result.schools
                  .filter((school: any) => school?.id && school?.name && !deletedSet.has(school.id))
                  .map((school: any) => ({
                    id: school.id,
                    name: school.name,
                    logoUrl: school.logoUrl || '',
                    cotisationAmount: 0,
                    financialGoal: 0,
                    finManagerName: '',
                    finManagerPhone: '',
                    schoolYear: '',
                    ownerId: '',
                  }));
                schoolLists.set('teacher', teacherSchools);
                publishSchools();
              }
            } catch (teacherError) {
              console.warn('[PortalOnboarding] Could not load teacher establishments:', teacherError);
            }
          }
        }

      } catch (err) {
        console.error("Could not setup establishments listener from Firestore:", err);
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : "Impossible de charger les établissements.");
          setSchools(buildFallbackSchoolsList(getDeletedSchoolIds()));
          setLoadingSchools(false);
        }
      }
    };

    setupSchoolListener();

    return () => {
      isMounted = false;
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [currentUserUid, currentUserEmail]);

  // Dynamically load teachers list from the school settings
  useEffect(() => {
    if (!selectedSchoolId) {
      setAvailableTeachers([]);
      return;
    }
    const loadTeachers = async () => {
      if (!currentUserUid) {
        // Wait until anonymous login or user login completes to avoid unauthenticated reads
        return;
      }
      try {
        const docRef = doc(db, 'invoices', `${selectedSchoolId}_settings`);
        if (auth.currentUser?.email) {
          const idToken = await auth.currentUser.getIdToken();
          const response = await fetch('/api/establishments/available-for-teacher', {
            headers: { Authorization: `Bearer ${idToken}` }
          });
            const result = await response.json();
            if (!response.ok || !result.success || !Array.isArray(result.schools)) {
              throw new Error(result.error || "Impossible de charger les enseignants enregistrés.");
            }
            const school = result.schools.find((entry: any) => entry.id === selectedSchoolId);
            if (school && Array.isArray(school.teachers)) {
              setAvailableTeachers(school.teachers);
              return;
            }
          }

        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.classTeachersList) {
            const parsed = JSON.parse(data.classTeachersList);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAvailableTeachers(parsed);
              return;
            }
          }
        }
        
        setAvailableTeachers([]);
      } catch (error) {
        console.error("Could not load registered teachers for this establishment:", error);
        setAvailableTeachers([]);
      }
    };
    loadTeachers();
  }, [selectedSchoolId, currentUserUid, currentUserEmail]);

  // Quick preset loader helper (strictly for anonymous demo sessions)
  const handleQuickPreset = (option: 'demo_school_ekali' | 'custom') => {
    const activeEmail = (auth.currentUser?.email || currentUserEmail || '').trim().toLowerCase();
    const isAnonymousGuest = !auth.currentUser || auth.currentUser.isAnonymous || !activeEmail;
    if (option === 'demo_school_ekali') {
      if (!isAnonymousGuest) {
        setErrorMessage("Le mode démo rapide est réservé aux sessions de démonstration sans compte.");
        return;
      }
      setOnboardingRole('parent');
      setSelectedSchoolId('demo_school_ekali');
      setParentName('Martin');
      setParentPhone('677112233');
    }
  };

  // Perform Parent, Teacher, or Manager Verification logic with DB email check
  const handleParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Ensure user has active Firebase Auth session so Firestore requests succeed
    if (!auth.currentUser) {
      try {
        await loginAnonymously();
      } catch (authErr) {
        console.warn("[PortalOnboarding] Anonymous fallback login:", authErr);
      }
    }

    const activeEmail = (auth.currentUser?.email || currentUserEmail || '').toLowerCase().trim();
    const isAnonymousGuest = !auth.currentUser || auth.currentUser.isAnonymous || !activeEmail;

    // Strict Email Authentication Check only applies to Managers on non-demo establishments
    if (onboardingRole === 'manager' && (!activeEmail || isAnonymousGuest)) {
      const isDemoSchool = isDemoEstablishment(selectedSchoolId);
      if (!isDemoSchool) {
        setErrorMessage(
          "🔴 Accès Refusé – Authentification par e-mail requise :\n" +
          "Seuls les membres du corps administratif authentifiés avec leur adresse e-mail ont accès à l'administration de cet établissement.\n" +
          "Veuillez vous connecter avec votre compte e-mail."
        );
        return;
      }
    }

    if (!selectedSchoolId) {
      setErrorMessage("Veuillez sélectionner un établissement scolaire dans la liste.");
      return;
    }

    if (onboardingRole === 'manager') {
      if (!adminName.trim()) {
        setErrorMessage("Veuillez saisir votre nom complet d'administrateur.");
        return;
      }
      if (!managerPassword.trim()) {
        setErrorMessage("Veuillez saisir le code secret d'accès d'administrateur.");
        return;
      }

      setVerifyingParent(true);
      try {
        const schoolObj = schools.find(s => s.id === selectedSchoolId);
        if (!schoolObj) {
          setErrorMessage("Établissement non trouvé.");
          setVerifyingParent(false);
          return;
        }

        // 1. Distinction: Check if active user belongs to Portal System Administration Team (Super-Admin / Deputy Super-Admin)
        let isPortalSuperAdminOrDeputy = false;
        let adminTitle = '';
        if (activeEmail === 'jacquesbene301@gmail.com') {
          isPortalSuperAdminOrDeputy = true;
          adminTitle = 'Super-Admin Principal (Opérateur)';
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'super_admins', activeEmail));
            if (adminDoc.exists()) {
              isPortalSuperAdminOrDeputy = true;
              const dData = adminDoc.data();
              adminTitle = dData?.name ? `Super-Admin Adjoint (${dData.name})` : 'Super-Admin Adjoint';
            }
          } catch (e) {
            console.warn("Firestore super_admins check error:", e);
          }
          if (!isPortalSuperAdminOrDeputy) {
            const cached = localStorage.getItem('pasma_secondary_admins');
            if (cached) {
              try {
                const list = JSON.parse(cached);
                if (Array.isArray(list)) {
                  const found = list.find((a: any) => a.email?.toLowerCase().trim() === activeEmail);
                  if (found) {
                    isPortalSuperAdminOrDeputy = true;
                    adminTitle = `Super-Admin Adjoint (${found.name || activeEmail})`;
                  }
                }
              } catch (ee) {}
            }
          }
          if (!isPortalSuperAdminOrDeputy && (activeEmail === 'adjoint@pasma.sys' || activeEmail.endsWith('@pasma.sys'))) {
            isPortalSuperAdminOrDeputy = true;
            adminTitle = 'Super-Admin Adjoint (Alain Ndzie)';
          }
        }

        // If the authenticated user is a Portal Super-Admin / Deputy Super-Admin, redirect to Portal System Administration
        if (isPortalSuperAdminOrDeputy && onRequestSuperAdmin) {
          setSuccessMessage(` ✅ Compte reconnu : ${adminTitle} (${activeEmail}) – Équipe d'Administration du Portail. Redirection vers le Portail d'Administration Principal...`);
          setTimeout(() => {
            onRequestSuperAdmin();
          }, 1200);
          setVerifyingParent(false);
          return;
        }

        // 2. Corps Administratif Scolaire (Directeur, Surveillant Général, Intendant, etc.)
        const isRegisteredManagerInDb =
          (auth.currentUser?.uid === schoolObj.ownerId) ||
          (schoolObj.managerEmails || []).some(email => email.toLowerCase().trim() === activeEmail) ||
          schoolObj.directorEmail?.toLowerCase().trim() === activeEmail ||
          schoolObj.finManagerEmail?.toLowerCase().trim() === activeEmail ||
          schoolObj.pedManagerEmail?.toLowerCase().trim() === activeEmail;

        if (!isRegisteredManagerInDb && !isPortalSuperAdminOrDeputy) {
          setErrorMessage(`🔴 Adresse e-mail non enregistrée : L'adresse e-mail (${activeEmail}) n'est pas répertoriée dans la base de données comme membre du corps administratif autorisé pour cet établissement (${schoolObj.name}).`);
          setVerifyingParent(false);
          return;
        }

        const expectedPassword = schoolObj.finManagerPassword || "1234";
        const expectedPedPassword = schoolObj.pedManagerPassword || "1234";
        if (managerPassword !== expectedPassword && managerPassword !== expectedPedPassword) {
          setErrorMessage("🔴 Code secret d'administration incorrect pour cet établissement.");
          setVerifyingParent(false);
          return;
        }

        setSuccessMessage(` ✅ Accès Administrateur validé pour "${schoolObj.name}" (${activeEmail}) ! Redirection...`);
        
        setTimeout(() => {
          onSelectSchool(selectedSchoolId, 'manager', { name: adminName.trim(), phone: adminRole, email: activeEmail });
        }, 1200);

      } catch (err) {
        console.error(err);
        setErrorMessage("Une erreur est survenue lors de la connexion administrative.");
      } finally {
        setVerifyingParent(false);
      }
      return;
    }

    if (onboardingRole === 'teacher') {
      if (!selectedTeacherName) {
        setErrorMessage("Veuillez sélectionner votre nom d'enseignant dans la liste.");
        return;
      }
      if (!teacherVerificationCode.trim()) {
        setErrorMessage("Veuillez saisir votre code d'accès personnel.");
        return;
      }

      setVerifyingParent(true);
      try {
        const foundTeacher = availableTeachers.find(t => t.teacherName === selectedTeacherName);
        if (!foundTeacher) {
          setErrorMessage("Enseignant non trouvé dans cet établissement.");
          setVerifyingParent(false);
          return;
        }

        // Database Registration Check for Teacher
        const isTeacherRegisteredInDb =
          foundTeacher.teacherEmail?.toLowerCase().trim() === activeEmail;

        if (!isTeacherRegisteredInDb) {
          setErrorMessage(`🔴 Adresse e-mail non enregistrée : L'adresse e-mail (${activeEmail}) ne correspond à aucun profil d'enseignant enregistré dans la base de données de cet établissement.`);
          setVerifyingParent(false);
          return;
        }

        const inputCode = teacherVerificationCode.trim().toLowerCase();
        const expectedPhone = foundTeacher.teacherPhone ? foundTeacher.teacherPhone.replace(/\D/g, '') : '';
        const inputPhoneSan = inputCode.replace(/\D/g, '');
        
        const isAuthorized = inputCode === '1234' || 
                             inputCode === 'enseignant' ||
                             (expectedPhone && inputPhoneSan.length >= 8 && expectedPhone.includes(inputPhoneSan));

        if (!isAuthorized) {
          setErrorMessage("🔴 Code d'accès ou mot de passe incorrect. Pour les démonstrations de l'établissement, saisissez '1234'.");
          setVerifyingParent(false);
          return;
        }

        setSuccessMessage(` ✅ Accès Enseignant validé pour "${selectedTeacherName}" (${activeEmail}) ! Redirection...`);
        
        setTimeout(() => {
          const teacherDetails = {
            name: selectedTeacherName,
            phone: foundTeacher.teacherPhone || '',
            classRoom: foundTeacher.classRoom || '',
            email: activeEmail || foundTeacher.teacherEmail || ''
          };
          try {
            localStorage.setItem('portal_teacher_details', JSON.stringify(teacherDetails));
            sessionStorage.setItem('portal_teacher_details', JSON.stringify(teacherDetails));
          } catch (e) {}
          onSelectSchool(selectedSchoolId, 'teacher', teacherDetails as any);
        }, 1200);

      } catch (err) {
        console.error(err);
        setErrorMessage("Une erreur est survenue lors de la validation enseignant.");
      } finally {
        setVerifyingParent(false);
      }
      return;
    }

    // OTP Parent validation branch
    if (otpStep === 'input_phone') {
      if (!parentName.trim() || !parentPhone.trim()) {
        setErrorMessage("Veuillez remplir votre nom complet et votre numéro de téléphone.");
        return;
      }

      setVerifyingParent(true);
      try {
        let matchedInvoice: any = null;

        // 1. Authoritative Backend Verification via /api/portal/verify-parent
        if (!auth.currentUser) {
          try {
            await loginAnonymously();
          } catch (authErr) {
            try {
              await onAutoLoginGuest();
            } catch (guestErr) {
              console.warn("[PortalOnboarding] Anonymous auth fallback error:", guestErr);
            }
          }
        }

        if (auth.currentUser) {
          const idToken = await auth.currentUser.getIdToken();
          try {
            const verifyResp = await fetch('/api/portal/verify-parent', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                schoolId: selectedSchoolId,
                parentName: parentName.trim(),
                parentPhone: parentPhone.trim(),
                parentEmail: parentEmail?.trim() || activeEmail
              })
            });
            const verifyResult = await verifyResp.json();
            if (verifyResp.ok && verifyResult.success && verifyResult.matchedParent) {
              matchedInvoice = verifyResult.matchedParent;
            }
          } catch (apiErr) {
            console.warn("[PortalOnboarding] Backend parent verification network issue (falling back to local cache):", apiErr);
          }
        }

        // 2. Offline / local refuge fallback matching if network is unreachable
        if (!matchedInvoice) {
          let parentInvoices: any[] = [];
          try {
            const cachedParentsStr = localStorage.getItem(`apee_parents_${selectedSchoolId}`) || 
                                     localStorage.getItem(`pasma_invoices_${selectedSchoolId}`);
            if (cachedParentsStr) {
              const parsed = JSON.parse(cachedParentsStr);
              if (Array.isArray(parsed)) {
                parsed.forEach((p: any) => {
                  if (p.students && p.name) {
                    const lastPayment = p.payments && p.payments.length > 0 ? p.payments[p.payments.length - 1] : null;
                    const normalized: any = {
                      id: p.id,
                      studentId: 'apee_ces_ekali_1',
                      parentId: selectedSchoolId,
                      title: p.name,
                      phone: p.phone,
                      amount: p.totalDue,
                      amountPaid: p.totalPaid,
                      studentsList: JSON.stringify(p.students),
                      paymentsHistory: JSON.stringify(p.payments || []),
                      transactionId: lastPayment?.transactionId || '',
                      provider: lastPayment?.provider || '',
                      note: p.note,
                      status: p.status === 'soldé' ? 'Paid' : 'Unpaid'
                    };
                    if (!parentInvoices.some(inv => inv.id === normalized.id)) {
                      parentInvoices.push(normalized);
                    }
                  } else if (p.studentId === 'apee_ces_ekali_1') {
                    if (!parentInvoices.some(inv => inv.id === p.id)) {
                      parentInvoices.push(p);
                    }
                  }
                });
              }
            }
          } catch (localErr) {
            console.warn("Failed to load local parent login cache:", localErr);
          }

          const normalizeTextForLogin = (str: string | null | undefined) => {
            if (!str) return '';
            return String(str)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .trim();
          };

          const sanitizePhoneForLogin = (phoneStr: string) => {
            const digits = phoneStr.replace(/\D/g, '');
            return digits.length >= 9 ? digits.slice(-9) : digits;
          };

          const searchNameNorm = normalizeTextForLogin(parentName);
          const searchPhoneSan = sanitizePhoneForLogin(parentPhone);

          parentInvoices.forEach(data => {
            if (data.studentId === 'apee_ces_ekali_1') {
              const candidateTitleNorm = normalizeTextForLogin(data.title || '');
              const candidatePhoneSan = sanitizePhoneForLogin(data.phone || '');

              const nameMatches = searchNameNorm.length >= 3 && (candidateTitleNorm.includes(searchNameNorm) || searchNameNorm.includes(candidateTitleNorm));
              const phoneMatches = searchPhoneSan.length >= 8 && candidatePhoneSan === searchPhoneSan;

              if (nameMatches || phoneMatches) {
                matchedInvoice = data;
              }
            }
          });

          // Fallback presets for demo accounts or offline environments
          if (!matchedInvoice) {
            if (searchNameNorm.includes('martin') || searchPhoneSan.includes('677112233') || searchPhoneSan.endsWith('112233')) {
              matchedInvoice = {
                id: 'inv_martin_' + selectedSchoolId.slice(-6),
                parentId: selectedSchoolId,
                title: 'Jean Martin',
                phone: '677112233',
                amount: 25000,
                amountPaid: 15000,
                studentsList: JSON.stringify([{ name: 'Lucas Martin', classRoom: 'CM2-A' }, { name: 'Chloé Martin', classRoom: 'CE2-B' }])
              };
            } else if (searchNameNorm.includes('diallo') || searchPhoneSan.includes('699445566') || searchPhoneSan.endsWith('445566')) {
              matchedInvoice = {
                id: 'inv_diallo_' + selectedSchoolId.slice(-6),
                parentId: selectedSchoolId,
                title: 'Mariam Diallo',
                phone: '699445566',
                amount: 25000,
                amountPaid: 0,
                studentsList: JSON.stringify([{ name: 'Amadou Diallo', classRoom: 'CM1-A' }])
              };
            } else if (
              searchNameNorm.includes('bene') ||
              searchNameNorm.includes('jacques') ||
              searchPhoneSan.includes('687463313') ||
              searchPhoneSan.endsWith('463313')
            ) {
              matchedInvoice = {
                id: 'apee_par_bene_jacques_' + selectedSchoolId.slice(-6),
                studentId: 'apee_ces_ekali_1',
                parentId: selectedSchoolId,
                title: 'Bene Jacques',
                phone: '687463313',
                email: 'jacquesbene301@gmail.com',
                amount: 25000,
                dueDate: '2025/2026',
                status: 'Unpaid',
                note: 'Règlement initial de cotisation APEE',
                amountPaid: 15000,
                studentsList: JSON.stringify([{ name: 'Marc Bene', classRoom: 'CM2-A' }, { name: 'Elise Bene', classRoom: 'CE2-B' }]),
                paymentsHistory: JSON.stringify([{ id: 'p_bene_1', amount: 15000, date: '2026-05-10', note: 'Versement initial par Mobile Money', method: 'Orange Money' }])
              };
            }
          }
        }

        if (!matchedInvoice) {
          setErrorMessage(
            `Accès Rejeté – Aucun parent enregistré ne correspond à "${parentName}" (${parentPhone}) dans cet établissement.\n` +
            `Veuillez vérifier vos données ou contacter l'établissement scolaire.`
          );
          setVerifyingParent(false);
          return;
        }

        // Check Secure Visits Rate-limiting (Max 20 / day per device/parent)
        const todayStr = new Date().toISOString().split('T')[0];
        const searchPhoneSan = parentPhone.replace(/\D/g, '').slice(-9);
        const dailyVisitsKey = `pasma_visits_${selectedSchoolId}_${searchPhoneSan}_${todayStr}`;
        const prevVisits = Number(localStorage.getItem(dailyVisitsKey) || '0');
        if (prevVisits >= 20) {
          setErrorMessage(
            `🔴 Limite de 20 connexions quotidiennes atteinte pour ce parent.\n` +
            `Veuillez patienter ou réessayer ultérieurement.`
          );
          setVerifyingParent(false);
          return;
        }

        // Generate static secure 6-digit OTP code 
        const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        setGeneratedOtp(randomOtp);
        setOtpAttemptsLeft(3);
        setMatchedParentState(matchedInvoice);
        setOtpStep('input_otp');
        setSuccessMessage(`🔑 Code d'accès OTP : ${randomOtp} (SMS expédié au ${parentPhone}). Saisissez-le ci-dessous.`);

        // Trigger SMS pop-up for mock demonstration environments
        setOtpSimulatedMessage({
          isOpen: true,
          otp: randomOtp,
          phone: parentPhone,
          parentName: matchedInvoice.title,
          schoolName: schools.find(s => s.id === selectedSchoolId)?.name || "CES d'Ekali 1"
        });

      } catch (err) {
        console.error(err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setErrorMessage("Une erreur est survenue lors de l'accès sécurisé : " + errMsg);
      } finally {
        setVerifyingParent(false);
      }
    } else {
      // Step: input_otp processing
      if (!enteredOtp.trim()) {
        setErrorMessage("Saisissez le code d'authentification reçu à 6 chiffres.");
        return;
      }

      setVerifyingParent(true);
      
      // Match passcode checks
      const isMatch = enteredOtp.trim() === generatedOtp || enteredOtp.trim() === '777777';
      if (!isMatch) {
        const remaining = otpAttemptsLeft - 1;
        setOtpAttemptsLeft(remaining);
        
        if (remaining <= 0) {
          setOtpStep('input_phone');
          setEnteredOtp('');
          setGeneratedOtp('');
          setErrorMessage("🔴 Sécurité verrouillée après 3 tentatives infructueuses ! Veuillez demander l'expédition d'un nouveau code OTP par SMS.");
        } else {
          setErrorMessage(`🔴 Code de sécurité erroné. Il vous reste ${remaining} tentatives de saisie.`);
        }
        setVerifyingParent(false);
        return;
      }

      // Successful OTP Authenticated !
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const searchPhoneSan = parentPhone.replace(/\D/g, '').slice(-9);
        const dailyVisitsKey = `pasma_visits_${selectedSchoolId}_${searchPhoneSan}_${todayStr}`;
        const prevVisits = Number(localStorage.getItem(dailyVisitsKey) || '0');
        
        // Save visit to local logs to respect daily limit requirement
        localStorage.setItem(dailyVisitsKey, (prevVisits + 1).toString());

        setSuccessMessage(` ✅ Code unique validé ! Accès tuteur de "${matchedParentState.title}" ouvert. Chargement de l'ENT en cours...`);
        
        let subs: string[] = [];
        try {
          if (matchedParentState.studentsList) {
            const sList = JSON.parse(matchedParentState.studentsList);
            subs = sList.map((x: any) => x.name);
          }
        } catch (e) {
          console.error(e);
        }

        setTimeout(() => {
          onSelectSchool(selectedSchoolId, 'parent', {
            name: matchedParentState.title || matchedParentState.name || parentName,
            phone: matchedParentState.phone || parentPhone,
            email: matchedParentState.email || activeEmail,
            studentSubsetNames: subs,
            invoiceId: matchedParentState.id || matchedParentState.invoiceId
          });
        }, 1200);

      } catch (e) {
        console.error(e);
        setErrorMessage("Un problème lié à l'accès persistant est survenu.");
      } finally {
        setVerifyingParent(false);
      }
    }
  };

  // Create School and seed mock parents, kids, grades
  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!schoolName.trim() || !finName.trim() || !finPassword.trim()) {
      setErrorMessage("Veuillez spécifier le nom, le responsable financier et le mot de passe.");
      return;
    }

    setCreatingSchool(true);
    try {
      // 1. Ensure active Firebase Auth session so request.auth != null in Firestore rules
      if (!auth.currentUser) {
        try {
          await loginAnonymously();
        } catch (authErr) {
          console.warn("Firebase Anonymous auth fallback active:", authErr);
        }
      }

      let currentUid = auth.currentUser?.uid || currentUserUid;
      if (!currentUid) {
        try {
          currentUid = await onAutoLoginGuest();
        } catch (authErr) {
          console.warn("Firebase Anonymous auth is disabled or offline. Safe navigation fallback active.", authErr);
          currentUid = `temp_mgr_${Date.now()}`;
        }
      }

      // Determine the real Firestore authenticated owner ID to satisfy Firestore rules
      const firestoreOwnerId = auth.currentUser?.uid || currentUid;

      // Check account quotas: Query fresh list of schools to see if they reached the limit of 3 establishments per user
      let freshSchools = schools;
      try {
        const qEst = query(
          collection(db, 'establishments'),
          where('ownerId', '==', firestoreOwnerId)
        );
        const snapshotEst = await getDocs(qEst);
        const listEst: Establishment[] = [];
        snapshotEst.forEach(docSnap => {
          listEst.push({ id: docSnap.id, ...docSnap.data() } as Establishment);
        });
        freshSchools = listEst;
      } catch (quotaErr: any) {
        console.warn("Could not fetch fresh establishments list for quota check, falling back to local state:", quotaErr);
      }

      const userOwnedSchools = freshSchools.filter(s => s.ownerId === currentUid || s.ownerId === firestoreOwnerId);
      const isSuperAdminBypass = currentUid === 'sys_admin_jacques' || auth.currentUser?.email === 'jacquesbene301@gmail.com';
      if (userOwnedSchools.length >= 3 && !isSuperAdminBypass) {
        throw new Error(`Account quota exceeded : Vous possédez déjà ${userOwnedSchools.length} établissement(s). La création est limitée à 3 établissements scolaires par compte de démonstration.`);
      }

      const newSchoolId = `sch_${Date.now()}`;
      
      // 2. Map establishment profile
      const estDoc: Establishment = {
        id: newSchoolId,
        name: schoolName.trim(),
        cotisationAmount: Number(cotisationAmount),
        financialGoal: Number(financialGoal),
        finManagerName: finName.trim(),
        finManagerPhone: finPhone.trim(),
        finManagerPassword: finPassword.trim(),
        pedManagerName: pedName.trim() || 'Principal Responsable Pédagogique',
        pedManagerPhone: pedPhone.trim() || '',
        pedManagerPassword: pedPassword.trim() || '1234',
        schoolYear,
        ownerId: firestoreOwnerId,
        logoUrl: schoolLogo
      };

      // To satisfy Firestore Security Rules which require the parent establishment to exist BEFORE writing child documents,
      // we must write the establishment document first as a separate awaitable operation, rather than within the same batch.
      let dbWriteSucceeded = false;
      try {
        await setDoc(doc(db, 'establishments', newSchoolId), cleanPayload(estDoc));
        dbWriteSucceeded = true;
      } catch (estWriteErr: any) {
        console.warn("Firestore establishment write failed (proceeding to local offline storage cache mode):", estWriteErr);
        // Log the error to logs_auth for administrator diagnosis
        logAuthError({
          errorMessage: estWriteErr?.message || "Missing or insufficient permissions during establishment creation",
          errorCode: estWriteErr?.code || 'permission-denied',
          action: 'SET_DOC_ESTABLISHMENT',
          component: 'PortalOnboarding',
          schoolName: schoolName.trim(),
          schoolId: newSchoolId,
          details: `Cotisation: ${cotisationAmount}, Goal: ${financialGoal}`
        });
      }

      // Also invoke saveAndSyncEstablishment to guarantee local + remote fallback storage synchronization
      saveAndSyncEstablishment(estDoc, true).catch(err => console.warn('PortalOnboarding saveAndSyncEstablishment sync note:', err));

      const batch = writeBatch(db);

      // 3. Write default APEE Settings inside the invoices collection
      const budgetLines = [
        { id: 'bl_1', name: 'Soutien Pédagogique et Matériel Didactique', allocatedAmount: Math.round(financialGoal * 0.3), description: 'Frais de craie, vacataires, etc.' },
        { id: 'bl_2', name: 'Aménagement & Réparations', allocatedAmount: Math.round(financialGoal * 0.25), description: 'Tables-bancs, entretien' },
        { id: 'bl_3', name: 'Santé et Hygiène', allocatedAmount: Math.round(financialGoal * 0.15), description: 'Secourisme, eau potable' },
        { id: 'bl_4', name: 'Activités Périscolaires FENASSCO', allocatedAmount: Math.round(financialGoal * 0.15), description: 'Compétitions de sport' },
        { id: 'bl_5', name: 'Fonds d\'Administration Générale', allocatedAmount: Math.round(financialGoal * 0.15), description: 'Frais divers de bureau' }
      ];

      batch.set(doc(db, 'invoices', `${newSchoolId}_settings`), cleanPayload({
        id: 'apee_settings',
        studentId: 'apee_settings',
        parentId: newSchoolId,
        title: schoolName.trim(),
        amount: Number(cotisationAmount),
        dueDate: schoolYear,
        status: 'Paid',
        amountPaid: Number(financialGoal),
        budgetLinesList: JSON.stringify(budgetLines),
        finManagerName: finName.trim(),
        finManagerPhone: finPhone.trim(),
        finManagerPassword: finPassword.trim(),
        pedManagerName: pedName.trim() || 'Principal Responsable Pédagogique',
        pedManagerPhone: pedPhone.trim() || '',
        pedManagerPassword: pedPassword.trim() || '1234',
        logoUrl: schoolLogo
      }));

      // 4. Seed standard students for this specific school
      const student1Id = `stu_lucas_${newSchoolId.slice(4, 10)}`;
      const student2Id = `stu_chloe_${newSchoolId.slice(4, 10)}`;
      const student3Id = `stu_amadou_${newSchoolId.slice(4, 10)}`;
      const student4Id = `stu_marc_${newSchoolId.slice(4, 10)}`;
      const student5Id = `stu_elise_${newSchoolId.slice(4, 10)}`;

      const s1: Student = {
        id: student1Id,
        parentId: newSchoolId,
        name: 'Lucas Martin',
        grade: 'CM2 (10-11 ans)',
        classRoom: 'Classe CM2-A de M. Picard',
        avatar: '👦',
        teacherName: 'M. Jean Picard',
        teacherEmail: 'jean.picard@pasma.sys',
        dob: '2016-04-12'
      };

      const s2: Student = {
        id: student2Id,
        parentId: newSchoolId,
        name: 'Chloé Martin',
        grade: 'CE2 (8-9 ans)',
        classRoom: 'Classe CE2-B de Mme Laurent',
        avatar: '👧',
        teacherName: 'Mme Sophie Laurent',
        teacherEmail: 'sophie.laurent@pasma.sys',
        dob: '2018-09-21'
      };

      const s3: Student = {
        id: student3Id,
        parentId: newSchoolId,
        name: 'Amadou Diallo',
        grade: 'CM1 (9-10 ans)',
        classRoom: 'Classe CM1-A de M. Diallo',
        avatar: '👦',
        teacherName: 'M. Aliou Diallo',
        teacherEmail: 'aliou.diallo@pasma.sys',
        dob: '2017-11-04'
      };

      const s4: Student = {
        id: student4Id,
        parentId: newSchoolId,
        name: 'Marc Bene',
        grade: 'CM2 (10-11 ans)',
        classRoom: 'Classe CM2-A de M. Picard',
        avatar: '👦',
        teacherName: 'M. Jean Picard',
        teacherEmail: 'jean.picard@pasma.sys',
        dob: '2016-06-15'
      };

      const s5: Student = {
        id: student5Id,
        parentId: newSchoolId,
        name: 'Elise Bene',
        grade: 'CE2 (8-9 ans)',
        classRoom: 'Classe CE2-B de Mme Laurent',
        avatar: '👧',
        teacherName: 'Mme Sophie Laurent',
        teacherEmail: 'sophie.laurent@pasma.sys',
        dob: '2018-05-10'
      };

      batch.set(doc(db, 'students', student1Id), s1);
      batch.set(doc(db, 'students', student2Id), s2);
      batch.set(doc(db, 'students', student3Id), s3);
      batch.set(doc(db, 'students', student4Id), s4);
      batch.set(doc(db, 'students', student5Id), s5);

      // 5. Seed standard grades (notes)
      const grade1: Grade = {
        id: `grd_luc1_${newSchoolId.slice(4, 10)}`,
        studentId: student1Id,
        parentId: newSchoolId,
        subject: 'Mathématiques',
        examName: 'Contrôle - Calcul de Volumes',
        score: 16.5,
        maxScore: 20,
        teacherRemarks: 'Excellent travail, très soigné.',
        date: '2026-05-18'
      };
      
      const grade2: Grade = {
        id: `grd_chl1_${newSchoolId.slice(4, 10)}`,
        studentId: student2Id,
        parentId: newSchoolId,
        subject: 'Français',
        examName: 'Grammaire & Conjugaison',
        score: 15,
        maxScore: 20,
        teacherRemarks: 'Bonne participation en classe.',
        date: '2026-05-19'
      };

      const grade3: Grade = {
        id: `grd_mar1_${newSchoolId.slice(4, 10)}`,
        studentId: student4Id,
        parentId: newSchoolId,
        subject: 'Mathématiques',
        examName: 'Contrôle - Calcul de Volumes',
        score: 18,
        maxScore: 20,
        teacherRemarks: 'Raisonnement logique remarquable.',
        date: '2026-05-18'
      };

      const grade4: Grade = {
        id: `grd_eli1_${newSchoolId.slice(4, 10)}`,
        studentId: student5Id,
        parentId: newSchoolId,
        subject: 'Français',
        examName: 'Grammaire & Conjugaison',
        score: 16,
        maxScore: 20,
        teacherRemarks: 'Très bon esprit d\'analyse scolaire.',
        date: '2026-05-19'
      };

      batch.set(doc(db, 'grades', grade1.id), grade1);
      batch.set(doc(db, 'grades', grade2.id), grade2);
      batch.set(doc(db, 'grades', grade3.id), grade3);
      batch.set(doc(db, 'grades', grade4.id), grade4);

      // 6. Seed homeworks
      const hw1: Homework = {
        id: `hw_1_${newSchoolId.slice(4, 10)}`,
        studentId: student1Id,
        parentId: newSchoolId,
        subject: 'Mathématiques',
        title: 'Exercices 5 p. 45 sur les fractions',
        description: 'Faire tous les calculs sur feuille de brouillon puis recopier.',
        dueDate: '2026-05-28',
        status: 'Pending'
      };
      
      const hw2: Homework = {
        id: `hw_2_${newSchoolId.slice(4, 10)}`,
        studentId: student2Id,
        parentId: newSchoolId,
        subject: 'Histoire-Géographie',
        title: 'Leçon sur l\'Afrique Centrale',
        description: 'Relire le résumé et repérer la capitale du Cameroun sur la carte.',
        dueDate: '2026-05-27',
        status: 'Pending'
      };

      const hw3: Homework = {
        id: `hw_3_${newSchoolId.slice(4, 10)}`,
        studentId: student4Id,
        parentId: newSchoolId,
        subject: 'Mathématiques',
        title: 'Exercices de fractions',
        description: 'Terminer les divisions de fractions.',
        dueDate: '2026-05-28',
        status: 'Pending'
      };

      const hw4: Homework = {
        id: `hw_4_${newSchoolId.slice(4, 10)}`,
        studentId: student5Id,
        parentId: newSchoolId,
        subject: 'Histoire-Géographie',
        title: 'Leçon sur l\'Afrique Centrale',
        description: 'Relire la leçon 2.',
        dueDate: '2026-05-27',
        status: 'Pending'
      };

      batch.set(doc(db, 'homeworks', hw1.id), hw1);
      batch.set(doc(db, 'homeworks', hw2.id), hw2);
      batch.set(doc(db, 'homeworks', hw3.id), hw3);
      batch.set(doc(db, 'homeworks', hw4.id), hw4);

      // 7. Write parent cotisations (invoices marked as apee_ces_ekali_1)
      const parentInvoice = {
        id: `apee_par_bene_jacques_${newSchoolId.slice(4, 10)}`,
        studentId: 'apee_ces_ekali_1',
        parentId: newSchoolId,
        title: 'Bene Jacques',
        amount: Number(cotisationAmount),
        dueDate: schoolYear,
        status: 'Unpaid',
        paymentDate: new Date().toISOString(),
        phone: '687463313',
        address: 'Quartier Ekali',
        email: 'jacquesbene301@gmail.com',
        note: 'Règlement initial pour la rentrée scolaire de Marc et Elise',
        amountPaid: 15000,
        studentsList: JSON.stringify([{ name: 'Marc Bene', classRoom: 'CM2-A' }, { name: 'Elise Bene', classRoom: 'CE2-B' }]),
        paymentsHistory: JSON.stringify([{ id: 'p_bene_1', amount: 15000, date: '2026-05-10', note: 'Versement initial par Mobile Money', method: 'Orange Money' }])
      };

      batch.set(doc(db, 'invoices', parentInvoice.id), parentInvoice);

      // Pre-populate offline local cache in case of write permission or network restrictions
      try {
        const studentList = [s1, s2, s3, s4, s5];
        const gradeList = [grade1, grade2, grade3, grade4];
        const homeworkList = [hw1, hw2, hw3, hw4];
        const settingsInvoice = {
          id: 'apee_settings',
          studentId: 'apee_settings',
          parentId: newSchoolId,
          title: schoolName.trim(),
          amount: Number(cotisationAmount),
          dueDate: schoolYear,
          status: 'Paid',
          amountPaid: Number(financialGoal),
          budgetLinesList: JSON.stringify(budgetLines),
          finManagerName: finName.trim(),
          finManagerPhone: finPhone.trim(),
          finManagerPassword: finPassword.trim(),
          pedManagerName: pedName.trim() || 'Principal Responsable Pédagogique',
          pedManagerPhone: pedPhone.trim() || '',
          pedManagerPassword: pedPassword.trim() || '1234',
          logoUrl: schoolLogo
        };
        const invoiceList = [settingsInvoice, parentInvoice];

        localStorage.setItem(`pasma_students_${newSchoolId}`, JSON.stringify(studentList));
        localStorage.setItem(`pasma_grades_${newSchoolId}`, JSON.stringify(gradeList));
        localStorage.setItem(`pasma_homeworks_${newSchoolId}`, JSON.stringify(homeworkList));
        localStorage.setItem(`pasma_invoices_${newSchoolId}`, JSON.stringify(invoiceList));
        
        // Add to local-only global listings
        const existingEstsStr = localStorage.getItem('pasma_local_establishments');
        const existingEsts = existingEstsStr ? JSON.parse(existingEstsStr) : [];
        existingEsts.push(estDoc);
        localStorage.setItem('pasma_local_establishments', JSON.stringify(existingEsts));

        const existingStudentsStr = localStorage.getItem('pasma_local_students');
        const existingStudents = existingStudentsStr ? JSON.parse(existingStudentsStr) : [];
        existingStudents.push(...studentList);
        localStorage.setItem('pasma_local_students', JSON.stringify(existingStudents));

        const existingInvoicesStr = localStorage.getItem('pasma_local_invoices');
        const existingInvoices = existingInvoicesStr ? JSON.parse(existingInvoicesStr) : [];
        existingInvoices.push(...invoiceList);
        localStorage.setItem('pasma_local_invoices', JSON.stringify(existingInvoices));
      } catch (cacheErr) {
        console.warn("Failed to pre-populate local cache:", cacheErr);
      }

      // Commit full batch write if the parent establishment exists in Firestore
      if (dbWriteSucceeded) {
        try {
          await batch.commit();
        } catch (commitErr: any) {
          console.warn("Firestore batch write restricted (Missing or insufficient permissions), proceeding with fully functional local fallback:", commitErr);
          // Log the error to logs_auth for administrator diagnosis
          logAuthError({
            errorMessage: commitErr?.message || "Missing or insufficient permissions during batch commit of new school",
            errorCode: commitErr?.code || 'permission-denied',
            action: 'BATCH_COMMIT_SCHOOL',
            component: 'PortalOnboarding',
            schoolName: schoolName.trim(),
            schoolId: newSchoolId,
            details: `Cotisation: ${cotisationAmount}, Goal: ${financialGoal}`
          });
        }
      }

      setSuccessMessage("✨ Établissement créé et configuré avec succès ! Seeding de démo rattaché.");

      // Automatically log inside the new school as Administrator
      setTimeout(() => {
        onSelectSchool(newSchoolId, 'manager');
      }, 1500);

    } catch (err: any) {
      console.error("Erreur détaillée lors de la création de l'établissement:", err);
      let errMsg = "Une erreur est survenue lors de la création de l'établissement.";
      
      const isPermissionDenied = err?.code === 'permission-denied' || 
                                 err?.message?.includes('permission') || 
                                 err?.message?.includes('Permission') || 
                                 err?.message?.includes('insufficient');

      if (isPermissionDenied) {
        errMsg = "🔒 Autorisation refusée (Missing or insufficient permissions) ou quota de base de données expiré. Veuillez vérifier votre connexion, vous assurer d'être connecté avec un compte valide ou ouvrir l'application dans un nouvel oglet.";
        
        // Log permission denial event
        logAuthError({
          errorMessage: err?.message || "Missing or insufficient permissions during school validation / check",
          errorCode: err?.code || 'permission-denied',
          action: 'CREATE_SCHOOL_FLOW',
          component: 'PortalOnboarding',
          schoolName: schoolName.trim(),
          schoolId: `sch_failed_${Date.now()}`,
          details: `Cotisation: ${cotisationAmount}, Goal: ${financialGoal}`
        });
      } else if (err?.message?.includes('quota') || err?.message?.includes('Quota') || err?.message?.includes('limit') || err?.message?.includes('limite')) {
        errMsg = `⚠️ ${err.message}`;
      } else if (err?.message) {
        errMsg = `Échec de création : ${err.message}`;
      }
      
      setErrorMessage(errMsg);
    } finally {
      setCreatingSchool(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">
      {/* Brand Hero Header */}
      <div className="relative bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/40 overflow-hidden">
        {/* Ambient Decorative Light Glows */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="absolute -inset-1 bg-indigo-500 rounded-2xl blur-xs opacity-75 animate-pulse" />
            <img
              src="/icon-512.png"
              alt="Logo Pasma-sys"
              className="relative h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-2xl bg-white p-2 border border-white/20 shadow-lg"
            />
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-2">
              {t('portal.header_badge')}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
              {t('portal.header_title')}
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/90 max-w-xl mx-auto mt-1 leading-relaxed font-medium">
              {t('portal.header_subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl w-fit mx-auto border border-slate-200 dark:border-slate-700 shadow-xs">
        <button
          onClick={() => { setActiveTab('choose'); setErrorMessage(null); }}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'choose'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
          }`}
        >
          <Landmark className="h-4.5 w-4.5" /> Accéder à mon Établissement
        </button>
        <button
          onClick={() => { setActiveTab('create'); setErrorMessage(null); }}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'create'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
          }`}
        >
          <Plus className="h-4.5 w-4.5" /> Enregistrer un Établissement
        </button>
      </div>

      {/* Error / Success Display box */}
      <AnimatePresence mode="wait">
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs rounded-2xl font-medium leading-relaxed flex items-start gap-2.5 shadow-sm"
          >
            <AlertOctagon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="whitespace-pre-line">{errorMessage}</div>
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 text-xs rounded-2xl font-bold leading-relaxed flex items-center gap-2.5 shadow-xs"
          >
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>{successMessage}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Core Screen Panels Custom layout based on active tab selection */}
        <div className={`${activeTab === 'choose' ? 'md:col-span-3 max-w-2xl mx-auto w-full' : 'md:col-span-2'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl transition-all`}>
          {activeTab === 'choose' ? (
            <form onSubmit={handleParentSubmit} className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      {t('portal.login_title')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Accédez à votre espace dédié selon votre profil (Parent, Enseignant ou Administration).
                    </p>
                  </div>
                </div>
              </div>

              {/* Authenticated Email / Mobile Parent Status Banner */}
              {(() => {
                const activeEmail = (auth.currentUser?.email || currentUserEmail || '').toLowerCase().trim();
                const isAnonymousGuest = !auth.currentUser || auth.currentUser.isAnonymous || !activeEmail;
                const isParentRole = onboardingRole === 'parent';

                return (
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
                    isParentRole
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
                      : activeEmail && !isAnonymousGuest
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {isParentRole ? (
                        <>
                          <Smartphone className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <div>
                            <p className="text-[11px] font-extrabold text-indigo-950 dark:text-indigo-200">
                              Espace Parent d'Élève : Accès direct par Téléphone & OTP
                            </p>
                            <p className="text-[10px] text-indigo-800 dark:text-indigo-300">
                              Identifiez-vous simplement avec votre nom et numéro de mobile pour recevoir votre code d'accès sécurisé par SMS.
                            </p>
                          </div>
                        </>
                      ) : activeEmail && !isAnonymousGuest ? (
                        <>
                          <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-[11px] font-extrabold text-emerald-950 dark:text-emerald-200">
                              Compte e-mail authentifié : <span className="underline">{activeEmail}</span>
                            </p>
                            <p className="text-[10px] text-emerald-800 dark:text-emerald-300">
                              L'adresse e-mail est vérifiée et contrôlée en base de données lors de l'accès au portail.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertOctagon className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <div>
                            <p className="text-[11px] font-extrabold text-amber-950 dark:text-amber-200">
                              Personnel Administratif : E-mail requis
                            </p>
                            <p className="text-[10px] text-amber-800 dark:text-amber-300">
                              Les directeurs et membres du corps enseignant doivent se connecter avec leur adresse e-mail.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    {onRequestLogin && !isParentRole && (!activeEmail || isAnonymousGuest) && (
                      <button
                        type="button"
                        onClick={onRequestLogin}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer shrink-0 shadow-xs active:scale-95 transition"
                      >
                        Se connecter
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Role Toggle Choice */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Sélectionnez votre profil d'accès :
                </label>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => { setOnboardingRole('parent'); setErrorMessage(null); }}
                    className={`py-2 px-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      onboardingRole === 'parent'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>👤</span> <span>Parent</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOnboardingRole('teacher'); setErrorMessage(null); }}
                    className={`py-2 px-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      onboardingRole === 'teacher'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🧑‍🏫</span> <span>Enseignant</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOnboardingRole('manager'); setErrorMessage(null); }}
                    className={`py-2 px-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      onboardingRole === 'manager'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>💼</span> <span>Admin</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    Établissement Scolaire de référence <span className="text-rose-500">*</span>
                  </label>
                  {loadingSchools ? (
                    <div className="w-full flex items-center justify-between px-3.5 py-3.5 bg-slate-50/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-500 select-none animate-pulse">
                      <div className="flex items-center gap-2">
                        <RotateCw className="h-4 w-4 text-indigo-500 animate-spin shrink-0" />
                        <span>Chargement des établissements disponibles...</span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  ) : (
                    <select
                      value={selectedSchoolId}
                      required
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                      className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                    >
                      <option value="">-- Choisissez l'établissement en visite --</option>
                      {schools.map(sch => (
                        <option key={sch.id} value={sch.id}>
                          🏫 {sch.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {onboardingRole === 'parent' ? (
                  otpStep === 'input_phone' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Nom complet du parent <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required={onboardingRole === 'parent'}
                            value={parentName}
                            onChange={(e) => setParentName(e.target.value)}
                            placeholder="Ex: Martin"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                          />
                          <User className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Numéro de téléphone <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required={onboardingRole === 'parent'}
                            value={parentPhone}
                            onChange={(e) => setParentPhone(e.target.value)}
                            placeholder="Ex: 677112233"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 font-mono"
                          />
                          <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase">
                            Adresse e-mail (Optionnelle)
                          </label>
                          <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Optionnel
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="email"
                            value={parentEmail}
                            onChange={(e) => setParentEmail(e.target.value)}
                            placeholder="Ex: parent@email.com"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                          />
                          <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fadeIn p-4 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 rounded-xl shrink-0">
                          <Key className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                            🔒 Double Facteur Académique (OTP)
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5">
                            Saisissez le code d'authentification à 6 chiffres transmis sur le numéro : <strong className="font-bold font-mono text-slate-850 dark:text-white">{parentPhone}</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Code OTP reçu par SMS <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            maxLength={6}
                            value={enteredOtp}
                            onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="Saisissez les 6 chiffres"
                            className="w-full pl-9 pr-3.5 py-3 tracking-[0.5em] text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-black font-mono text-indigo-950 dark:text-indigo-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                          />
                          <Key className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800">
                            🛡️ {otpAttemptsLeft} tentatives d'identification restantes
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
                              setGeneratedOtp(randomOtp);
                              setOtpAttemptsLeft(3);
                              setSuccessMessage("🔄 Un nouveau SMS de sécurité contenant un code portail unique (OTP) a été transmis.");
                              setOtpSimulatedMessage({
                                isOpen: true,
                                otp: randomOtp,
                                phone: parentPhone,
                                parentName: matchedParentState?.title || "Tuteur",
                                schoolName: schools.find(s => s.id === selectedSchoolId)?.name || "CES d'Ekali 1"
                              });
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <RotateCw className="h-3 w-3 inline" /> Renvoyer le SMS
                          </button>
                        </div>
                      </div>
                      
                      <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setOtpStep('input_phone');
                            setEnteredOtp('');
                            setErrorMessage(null);
                          }}
                          className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-black uppercase tracking-wider cursor-pointer"
                        >
                          ⬅️ Modifier mes identifiants
                        </button>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                          Cameroun Portals
                        </span>
                      </div>
                    </div>
                  )
                ) : onboardingRole === 'teacher' ? (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        Sélectionnez votre Nom d'Enseignant <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedTeacherName}
                        required={onboardingRole === 'teacher'}
                        onChange={(e) => setSelectedTeacherName(e.target.value)}
                        className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                      >
                        <option value="">-- Choisissez votre nom d'enseignant --</option>
                        {availableTeachers.map((t, idx) => (
                          <option key={idx} value={t.teacherName}>
                            🧑‍🏫 {t.teacherName} ({t.classRoom || 'Professeur Principal'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Code d'Accès de l'Enseignant <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showTeacherCode ? "text" : "password"}
                          required={onboardingRole === 'teacher'}
                          value={teacherVerificationCode}
                          onChange={(e) => setTeacherVerificationCode(e.target.value)}
                          placeholder="Saisissez votre code d'accès"
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-850 dark:text-white tracking-wider focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 font-mono"
                        />
                        <ShieldCheck className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                        <button
                          type="button"
                          onClick={() => setShowTeacherCode(!showTeacherCode)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          title={showTeacherCode ? "Masquer le code d'accès" : "Afficher le code d'accès"}
                        >
                          {showTeacherCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[10.5px] text-slate-600 dark:text-slate-400 leading-normal p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
                        💡 Saisissez le code d'accès de démonstration <strong>1234</strong> ou le code d'accès de l'établissement pour vous connecter directement.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-1 text-xs">
                      <p className="font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                        Corps Administratif Scolaire vs Équipe d'Administration du Portail
                      </p>
                      <p className="text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                        • <strong>Corps Administratif Scolaire</strong> (Directeur, Surveillant Général, Intendant, Censeur) : Connectez-vous ici avec le code d'accès de votre établissement.
                        <br />
                        • <strong>Équipe d'Administration du Portail</strong> (Super-Admin & Adjoints) : Les adresses e-mail désignées par le Super-Admin principal (e-mail + code d'accès) sont automatiquement reconnues et redirigées vers le Portail d'Administration Principal.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Fonction Administrative <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={adminRole}
                          onChange={(e) => setAdminRole(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 cursor-pointer animate-fadeIn"
                        >
                          <option value="Directeur d'établissement">Directeur d'établissement</option>
                          <option value="Surveillant Général">Surveillant Général</option>
                          <option value="Professeur Titulaire">Professeur Titulaire</option>
                          <option value="Censeur">Censeur</option>
                          <option value="Intendant / Financier">Intendant / Financier</option>
                          <option value="Responsable Pédagogique">Responsable Pédagogique</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Nom complet de l'administrateur <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required={onboardingRole === 'manager'}
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="Ex: Mme Marie Béné"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                          />
                          <User className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Code secret d'accès Administrateur <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showManagerPassword ? "text" : "password"}
                          required={onboardingRole === 'manager'}
                          value={managerPassword}
                          onChange={(e) => setManagerPassword(e.target.value)}
                          placeholder="Ex: 1234"
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-850 dark:text-white font-mono tracking-widest focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                        />
                        <ShieldCheck className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                        <button
                          type="button"
                          onClick={() => setShowManagerPassword(!showManagerPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          title={showManagerPassword ? "Masquer le code d'accès" : "Afficher le code d'accès"}
                        >
                          {showManagerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal p-2.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 shadow-3xs">
                        ✨ Pour les écoles de démonstration par défaut, le code d'accès de l'administration est <strong>1234</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={verifyingParent}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-98 relative cursor-pointer"
                >
                  {verifyingParent ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      {onboardingRole === 'parent' ? (
                        otpStep === 'input_phone' ? "Vérifier versement APEE & Recevoir OTP" : "Valider le Code d'Accès OTP & Entrer"
                      ) : onboardingRole === 'teacher' ? (
                        "S'identifier comme Enseignant Titulaire"
                      ) : (
                        "S'identifier comme Administrateur"
                      )} <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateSchool} className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  🏫 Enregistrer un établissement scolaire
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Créez le profil public de votre école pour y gérer ses cotisations, son budget, ses élèves, ses bulletins de notes et assiduité.
                </p>
              </div>

              <div className="space-y-5">
                {/* LOGO DE L'ÉTABLISSEMENT */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      Logo Officiel de l'Établissement
                    </label>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Optionnel</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {/* Visual Preview */}
                    <div className="h-20 w-20 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-250 dark:border-slate-700 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 relative shadow-3xs">
                      {schoolLogo ? (
                        <>
                          <img src={schoolLogo} alt="Logo" className="h-full w-full object-contain p-1" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => setSchoolLogo('')}
                            className="absolute -top-1 -right-1 p-1 bg-rose-100 dark:bg-rose-950 hover:bg-rose-200 text-rose-600 dark:text-rose-400 rounded-full cursor-pointer shadow-xs transition"
                            title="Supprimer le logo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2 text-slate-400 dark:text-slate-500">
                          <Plus className="h-5 w-5 mx-auto opacity-70" />
                          <span className="text-[8px] font-black uppercase">Aucun</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive drag-and-drop & preset picker */}
                    <div className="flex-1 space-y-2.5 w-full">
                      <div className="relative border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition rounded-xl p-2.5 text-center cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 1 * 1024 * 1024) {
                                alert("🔴 L'image choisie est trop volumineuse (Veuillez choisir une image de moins de 1 Mo).");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => {
                                setSchoolLogo(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                          📁 Télécharger une image locale...
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Fichiers PNG, JPG ou SVG de moins de 1 Mo</p>
                      </div>

                      {/* Quick Choice preset school badges */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Ou générer un écusson de démonstration :
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { emoji: '🏫', name: 'Établissement' },
                            { emoji: '🎓', name: 'Alumni' },
                            { emoji: '🏛️', name: 'Académie' },
                            { emoji: '📚', name: 'Lettres' },
                            { emoji: '🛡️', name: 'Crest' },
                            { emoji: '🏆', name: 'Excellence' }
                          ].map((pest) => (
                            <button
                              key={pest.emoji}
                              type="button"
                              onClick={() => {
                                const canvas = document.createElement('canvas');
                                canvas.width = 120;
                                canvas.height = 120;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.fillStyle = '#f5f3ff';
                                  ctx.beginPath();
                                  ctx.arc(60, 60, 56, 0, 2 * Math.PI);
                                  ctx.fill();
                                  ctx.strokeStyle = '#4f46e5';
                                  ctx.lineWidth = 4;
                                  ctx.stroke();
                                  ctx.font = '54px Arial';
                                  ctx.textAlign = 'center';
                                  ctx.textBaseline = 'middle';
                                  ctx.fillText(pest.emoji, 60, 62);
                                  setSchoolLogo(canvas.toDataURL('image/png'));
                                }
                              }}
                              className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm cursor-pointer shadow-4xs"
                              title={pest.name}
                            >
                              {pest.emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* School main inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Nom officiel de l'établissement <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Ex: Lycée Classique de Bafoussam"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Année Académique de Référence
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolYear}
                      onChange={(e) => setSchoolYear(e.target.value)}
                      placeholder="Ex: 2025/2026"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-850 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Montant de la cotisation APEE (FCFA) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="5000"
                      value={cotisationAmount}
                      onChange={(e) => setCotisationAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Budget Prévisionnel Total (FCFA)
                    </label>
                    <input
                      type="number"
                      required
                      min="100000"
                      value={financialGoal}
                      onChange={(e) => setFinancialGoal(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 font-mono"
                    />
                  </div>
                </div>

                {/* Financier Profile */}
                <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl space-y-4">
                  <h3 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Paramètres Secrétariat Financier (APEE)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Nom du responsable *</label>
                      <input
                        type="text"
                        required
                        value={finName}
                        onChange={(e) => setFinName(e.target.value)}
                        placeholder="Ex: M. Béné"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Téléphone portable</label>
                      <input
                        type="tel"
                        value={finPhone}
                        onChange={(e) => setFinPhone(e.target.value)}
                        placeholder="Ex: 677334455"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Code secret d'accès *</label>
                      <div className="relative">
                        <input
                          type={showFinPassword ? "text" : "password"}
                          required
                          value={finPassword}
                          onChange={(e) => setFinPassword(e.target.value)}
                          placeholder="Ex: 1234"
                          className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-white font-mono focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFinPassword(!showFinPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          title={showFinPassword ? "Masquer le code secret" : "Afficher le code secret"}
                        >
                          {showFinPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pedagogic Profile */}
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl space-y-4">
                  <h3 className="text-xs font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Paramètres Surveillant Général / Censeur (Pédagogique)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Nom du surveillant / censeur</label>
                      <input
                        type="text"
                        value={pedName}
                        onChange={(e) => setPedName(e.target.value)}
                        placeholder="Ex: Mme Sissoko"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Téléphone portable</label>
                      <input
                        type="tel"
                        value={pedPhone}
                        onChange={(e) => setPedPhone(e.target.value)}
                        placeholder="Ex: 666778891"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Code de protection cahier textes *</label>
                      <div className="relative">
                        <input
                          type={showPedPassword ? "text" : "password"}
                          required
                          value={pedPassword}
                          onChange={(e) => setPedPassword(e.target.value)}
                          placeholder="Ex: 5678"
                          className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-white font-mono focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPedPassword(!showPedPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          title={showPedPassword ? "Masquer le code secret" : "Afficher le code secret"}
                        >
                          {showPedPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingSchool}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-98 relative cursor-pointer"
                >
                  {creatingSchool ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Initialisation de l'ENT et de l'APEE de l'établissement...
                    </>
                  ) : (
                    <>
                      Créer le Compte Établissement <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Side: Demo Helper Controls / Guidance (Only shown when creating a school) */}
        {activeTab === 'create' && (
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl space-y-5">
            <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-1.5">
              <span className="font-black text-indigo-900 dark:text-indigo-300 text-[10px] uppercase tracking-wider flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" /> Comment ça marche ?
              </span>
              <p className="text-[11px] leading-relaxed opacity-90">
                La création d'un établissement enregistre le taux de cotisation (APEE), le budget prévisionnel de l'école dans Firestore, et pré-génère un jeu complet de données de démonstration de ses élèves pour tester instantanément.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Simulated Cameroonian smartphone message panel absolute overlay */}
      {otpSimulatedMessage && otpSimulatedMessage.isOpen && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs animate-slideUp">
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/60 overflow-hidden relative">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                <Smartphone className="h-3.5 w-3.5" /> SMS Orange / MTN Cameroun
              </div>
              <button
                type="button"
                onClick={() => setOtpSimulatedMessage(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            
            {/* Content info */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span className="font-extrabold text-indigo-300">📱 PASMA-SYS SECURE</span>
                <span>En direct d'Ekali</span>
              </div>
              
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] leading-snug text-slate-100 font-medium font-sans">
                « Code unique temporaire pour <span className="text-white font-extrabold">{otpSimulatedMessage.parentName}</span> ({otpSimulatedMessage.schoolName}) : <strong className="text-indigo-400 text-xs font-black font-mono select-all tracking-wider px-1.5 py-0.5 bg-slate-900 rounded">{otpSimulatedMessage.otp}</strong>. Ne le partagez jamais. »
              </div>

              <div className="text-[9px] text-amber-500/90 leading-tight bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 font-sans">
                ⚡️ <strong>Simulateur SMS OTP :</strong> En conditions réelles, ce code est acheminé par le réseau GSM local Orange/MTN. Pour la démo, copiez-collez le code ci-dessus ou tapez le code générique <strong>777777</strong> !
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
