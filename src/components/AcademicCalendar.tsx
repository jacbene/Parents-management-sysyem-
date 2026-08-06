import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  CalendarDays, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  Check, 
  X, 
  AlertCircle, 
  Sparkles, 
  Printer, 
  Share2, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  GraduationCap, 
  Clock, 
  MapPin, 
  Users, 
  BookOpen, 
  Award, 
  Flag, 
  Sun, 
  Bell, 
  Layers,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, queuePendingAction } from '../firebase';
import { AcademicEvent, AcademicEventType } from '../types';

interface AcademicCalendarProps {
  schoolId: string;
  portalUserRole?: string;
  schoolName?: string;
  schoolYear?: string;
  language?: string;
}

// Official default Cameroonian/International Academic Calendar Events template
const getDefaultAcademicEvents = (schoolId: string, schoolYearVal: string): AcademicEvent[] => {
  const currentYear = new Date().getFullYear();
  const startYear = schoolYearVal ? parseInt(schoolYearVal.split('-')[0]) || currentYear : currentYear;
  const endYear = startYear + 1;

  return [
    {
      id: `evt_rentree_${schoolId}`,
      schoolId,
      title: 'Rentrée Scolaire & Assemblée Générale',
      description: 'Lancement officiel des cours pour l\'année académique. Accueil de tous les élèves et réunion d\'orientation des parents.',
      startDate: `${startYear}-09-08`,
      endDate: `${startYear}-09-08`,
      type: 'Event',
      targetClassRoom: 'Toutes les classes',
      location: 'Cour Principale & Salles de classe',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_seq1_${schoolId}`,
      schoolId,
      title: 'Évaluations de la 1ère Séquence',
      description: 'Première série d\'évaluations continues et contrôle des connaissances dans toutes les matières.',
      startDate: `${startYear}-10-12`,
      endDate: `${startYear}-10-16`,
      type: 'Exam',
      targetClassRoom: 'Toutes les classes',
      location: 'Salles de classe',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_conseil1_${schoolId}`,
      schoolId,
      title: 'Conseil de Classe - 1ère Séquence',
      description: 'Délibération des notes de la 1ère séquence et établissement du premier bilan pédagogique.',
      startDate: `${startYear}-10-23`,
      endDate: `${startYear}-10-23`,
      type: 'Meeting',
      targetClassRoom: 'Toutes les classes',
      location: 'Salle des Professeurs',
      isPublic: false,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_seq2_${schoolId}`,
      schoolId,
      title: 'Évaluations de la 2ème Séquence (Compositions T1)',
      description: 'Examens de fin du 1er trimestre comptant pour le bulletin d\'évaluation trimestriel.',
      startDate: `${startYear}-11-23`,
      endDate: `${startYear}-11-27`,
      type: 'Exam',
      targetClassRoom: 'Toutes les classes',
      location: 'Salles d\'Examens',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_conges_noel_${schoolId}`,
      schoolId,
      title: 'Congés de Fin du 1er Trimestre (Fêtes de Noël)',
      description: 'Interruption des cours pour les vacances de Noël et de Fin d\'Année.',
      startDate: `${startYear}-12-18`,
      endDate: `${endYear}-01-04`,
      type: 'Holiday',
      targetClassRoom: 'Toutes les classes',
      location: 'Établissement',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_jeunesse_${schoolId}`,
      schoolId,
      title: 'Semaine Nationale de la Jeunesse & Défilé',
      description: 'Activités culturelles, sportives et défilé de la fête de la jeunesse.',
      startDate: `${endYear}-02-08`,
      endDate: `${endYear}-02-12`,
      type: 'Key Event' as any, // 'Event' or 'Key Event'
      targetClassRoom: 'Toutes les classes',
      location: 'Terrain de Sport & Place des Fêtes',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_seq4_${schoolId}`,
      schoolId,
      title: 'Évaluations de la 4ème Séquence (Trimestre 2)',
      description: 'Compositions de clôture du 2ème trimestre académique.',
      startDate: `${endYear}-03-15`,
      endDate: `${endYear}-03-19`,
      type: 'Exam',
      targetClassRoom: 'Toutes les classes',
      location: 'Salles d\'Examens',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_conges_paques_${schoolId}`,
      schoolId,
      title: 'Congés de Pâques (2ème Trimestre)',
      description: 'Vacances de Pâques pour l\'ensemble des élèves et du corps enseignant.',
      startDate: `${endYear}-04-02`,
      endDate: `${endYear}-04-19`,
      type: 'Holiday',
      targetClassRoom: 'Toutes les classes',
      location: 'Établissement',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_examens_blancs_${schoolId}`,
      schoolId,
      title: 'Examens Blancs Officiels (BEPC / Probatoire / BAC)',
      description: 'Simulations d\'examens d\'État en conditions réelles pour les classes d\'examens (3ème, 1ère, Tle).',
      startDate: `${endYear}-05-10`,
      endDate: `${endYear}-05-14`,
      type: 'Exam',
      targetClassRoom: 'Classes d\'Examens (3ème, 1ère, Tle)',
      location: 'Salles Spéciales d\'Examens',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_session_officielle_${schoolId}`,
      schoolId,
      title: 'Session des Examens Officiels d\'État',
      description: 'Déroulement national du BEPC, Probatoire et Baccalauréat.',
      startDate: `${endYear}-06-01`,
      endDate: `${endYear}-06-18`,
      type: 'Exam',
      targetClassRoom: 'Classes d\'Examens',
      location: 'Centres d\'Examens d\'État',
      isPublic: true,
      createdAt: new Date().toISOString()
    },
    {
      id: `evt_grandes_vacances_${schoolId}`,
      schoolId,
      title: 'Remise des Bulletins & Départ en Grandes Vacances',
      description: 'Cérémonie de fin d\'année, remise officielle des bulletins du 3ème trimestre et départ en grandes vacances.',
      startDate: `${endYear}-07-02`,
      endDate: `${endYear}-07-02`,
      type: 'Holiday',
      targetClassRoom: 'Toutes les classes',
      location: 'Grande Cour de l\'Établissement',
      isPublic: true,
      createdAt: new Date().toISOString()
    }
  ];
};

export default function AcademicCalendar({
  schoolId,
  portalUserRole = 'parent',
  schoolName = 'Complexe Scolaire Ekali Pasma',
  schoolYear = '2026-2027',
  language = 'fr'
}: AcademicCalendarProps) {
  const isFr = language !== 'en';
  const isAuthorizedToEdit = portalUserRole === 'manager' || portalUserRole === 'teacher' || portalUserRole === 'admin';

  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'month' | 'list' | 'trimesters'>('month');

  // Month navigation state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<AcademicEvent | null>(null);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ dateStr: string; events: AcademicEvent[] } | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<AcademicEventType>('Holiday');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formTargetClass, setFormTargetClass] = useState<string>('Toutes les classes');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 1. Fetch & Sync Events for current schoolId
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const localCacheKey = `pasma_academic_events_${schoolId}`;
    
    // Load local cached events first for instant UI response
    const cached = localStorage.getItem(localCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed);
        }
      } catch (e) {
        console.warn('[AcademicCalendar] Local cache parse warning:', e);
      }
    }

    // Set up Firestore listener
    let unsubscribe = () => {};
    try {
      const q = query(
        collection(db, 'academic_calendar'),
        where('schoolId', '==', schoolId)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetched: AcademicEvent[] = [];
          snapshot.forEach((docSnap) => {
            fetched.push({ id: docSnap.id, ...docSnap.data() } as AcademicEvent);
          });

          if (fetched.length > 0) {
            // Sort by start date ascending
            fetched.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            setEvents(fetched);
            localStorage.setItem(localCacheKey, JSON.stringify(fetched));
          } else {
            // If DB returns empty for this schoolId, auto-initialize with default official template
            const defaultEvts = getDefaultAcademicEvents(schoolId, schoolYear);
            setEvents(defaultEvts);
            localStorage.setItem(localCacheKey, JSON.stringify(defaultEvts));
          }
          setLoading(false);
        },
        (err) => {
          console.warn('[AcademicCalendar] Firestore listener fallback to default template:', err);
          // Fallback to local default template
          const defaultEvts = getDefaultAcademicEvents(schoolId, schoolYear);
          setEvents((prev) => (prev.length > 0 ? prev : defaultEvts));
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn('[AcademicCalendar] Listener setup error:', e);
      const defaultEvts = getDefaultAcademicEvents(schoolId, schoolYear);
      setEvents((prev) => (prev.length > 0 ? prev : defaultEvts));
      setLoading(false);
    }

    return () => unsubscribe();
  }, [schoolId, schoolYear]);

  // Handle restoring / re-populating default calendar template
  const handleRestoreDefaults = async () => {
    if (!window.confirm(isFr 
      ? "Voulez-vous réinitialiser le calendrier académique avec les dates officielles d'établissement ?" 
      : "Reset academic calendar with default official school dates?")) {
      return;
    }

    const defaultEvts = getDefaultAcademicEvents(schoolId, schoolYear);
    setEvents(defaultEvts);
    localStorage.setItem(`pasma_academic_events_${schoolId}`, JSON.stringify(defaultEvts));

    // Persist to Firestore if authorized
    if (isAuthorizedToEdit) {
      try {
        for (const evt of defaultEvts) {
          await addDoc(collection(db, 'academic_calendar'), {
            schoolId: evt.schoolId,
            title: evt.title,
            description: evt.description || '',
            startDate: evt.startDate,
            endDate: evt.endDate || evt.startDate,
            type: evt.type,
            targetClassRoom: evt.targetClassRoom || 'Toutes les classes',
            location: evt.location || '',
            isPublic: true,
            createdAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('[AcademicCalendar] Error seeding Firestore:', err);
      }
    }
  };

  // Open Add/Edit Modal
  const handleOpenModal = (eventToEdit?: AcademicEvent) => {
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setFormTitle(eventToEdit.title);
      setFormType(eventToEdit.type);
      setFormStartDate(eventToEdit.startDate);
      setFormEndDate(eventToEdit.endDate || eventToEdit.startDate);
      setFormTargetClass(eventToEdit.targetClassRoom || 'Toutes les classes');
      setFormLocation(eventToEdit.location || '');
      setFormDescription(eventToEdit.description || '');
    } else {
      setEditingEvent(null);
      setFormTitle('');
      setFormType('Exam');
      const todayStr = new Date().toISOString().split('T')[0];
      setFormStartDate(todayStr);
      setFormEndDate(todayStr);
      setFormTargetClass('Toutes les classes');
      setFormLocation('');
      setFormDescription('');
    }
    setIsModalOpen(true);
  };

  // Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formStartDate) return;

    setIsSaving(true);
    const eventPayload: Partial<AcademicEvent> = {
      schoolId,
      title: formTitle.trim(),
      type: formType,
      startDate: formStartDate,
      endDate: formEndDate || formStartDate,
      targetClassRoom: formTargetClass,
      location: formLocation.trim(),
      description: formDescription.trim(),
      isPublic: true,
      createdAt: new Date().toISOString()
    };

    try {
      if (editingEvent) {
        // Edit existing
        const updatedEvents = events.map((item) => 
          item.id === editingEvent.id ? { ...item, ...eventPayload } as AcademicEvent : item
        );
        setEvents(updatedEvents);
        localStorage.setItem(`pasma_academic_events_${schoolId}`, JSON.stringify(updatedEvents));

        if (!editingEvent.id.startsWith('evt_')) {
          await updateDoc(doc(db, 'academic_calendar', editingEvent.id), eventPayload as any);
        } else {
          queuePendingAction('UPDATE', 'academic_calendar', editingEvent.id, `Modifier événement ${formTitle}`, eventPayload);
        }
      } else {
        // Create new
        const newId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newEvent: AcademicEvent = { id: newId, ...eventPayload } as AcademicEvent;
        const updatedEvents = [...events, newEvent].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setEvents(updatedEvents);
        localStorage.setItem(`pasma_academic_events_${schoolId}`, JSON.stringify(updatedEvents));

        try {
          const docRef = await addDoc(collection(db, 'academic_calendar'), eventPayload);
          // Update local ID with Firestore generated doc ID
          setEvents((prev) => prev.map((eItem) => eItem.id === newId ? { ...eItem, id: docRef.id } : eItem));
        } catch (dbErr) {
          console.warn('[AcademicCalendar] Firestore add offline fallback:', dbErr);
          queuePendingAction('CREATE', 'academic_calendar', newId, `Créer événement ${formTitle}`, eventPayload);
        }
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving event:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (id: string, title: string) => {
    if (!window.confirm(isFr ? `Supprimer définitivement l'événement "${title}" ?` : `Delete event "${title}"?`)) {
      return;
    }

    const updatedEvents = events.filter((e) => e.id !== id);
    setEvents(updatedEvents);
    localStorage.setItem(`pasma_academic_events_${schoolId}`, JSON.stringify(updatedEvents));

    try {
      if (!id.startsWith('evt_')) {
        await deleteDoc(doc(db, 'academic_calendar', id));
      } else {
        queuePendingAction('DELETE', 'academic_calendar', id, `Supprimer événement ${title}`, {});
      }
    } catch (err) {
      console.warn('[AcademicCalendar] Delete offline queue:', err);
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Type Filter
      if (typeFilter !== 'all' && evt.type.toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }

      // Class Filter
      if (classFilter !== 'all' && evt.targetClassRoom && evt.targetClassRoom !== 'Toutes les classes') {
        if (!evt.targetClassRoom.toLowerCase().includes(classFilter.toLowerCase())) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = evt.title.toLowerCase().includes(q);
        const descMatch = (evt.description || '').toLowerCase().includes(q);
        const locMatch = (evt.location || '').toLowerCase().includes(q);
        const classMatch = (evt.targetClassRoom || '').toLowerCase().includes(q);
        return titleMatch || descMatch || locMatch || classMatch;
      }

      return true;
    });
  }, [events, typeFilter, classFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const holidaysCount = events.filter((e) => e.type === 'Holiday').length;
    const examsCount = events.filter((e) => e.type === 'Exam').length;
    const keyEventsCount = events.filter((e) => e.type === 'Event' || (e.type as any) === 'Key Event').length;
    
    // Next upcoming event
    const upcomingList = events
      .filter((e) => e.startDate >= todayStr)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    const nextEvent = upcomingList[0] || null;

    return {
      total: events.length,
      holidays: holidaysCount,
      exams: examsCount,
      keyEvents: keyEventsCount,
      nextEvent
    };
  }, [events]);

  // Month Calendar Grid Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNamesFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthName = isFr ? monthNamesFr[month] : monthNamesEn[month];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Adjust so Monday is index 0
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const calendarDays = useMemo(() => {
    const daysArr = [];
    // Previous month padding
    for (let i = 0; i < startOffset; i++) {
      daysArr.push({ dayNum: null, dateStr: '', isCurrentMonth: false });
    }
    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      daysArr.push({ dayNum: d, dateStr, isCurrentMonth: true });
    }
    return daysArr;
  }, [year, month, daysInMonth, startOffset]);

  // Map events to date strings for fast grid lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, AcademicEvent[]> = {};
    filteredEvents.forEach((evt) => {
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate || evt.startDate);
      
      // Iterate from start to end date inclusive
      const current = new Date(start);
      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        if (!map[dateKey].some(e => e.id === evt.id)) {
          map[dateKey].push(evt);
        }
        current.setDate(current.getDate() + 1);
      }
    });
    return map;
  }, [filteredEvents]);

  // Type Color Badges Helper
  const getTypeBadge = (type: AcademicEventType) => {
    switch (type) {
      case 'Holiday':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500',
          icon: Sun,
          label: isFr ? '🎄 Congés & Vacances' : 'Holiday'
        };
      case 'Exam':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
          icon: Award,
          label: isFr ? '📝 Examens & Évaluations' : 'Exams'
        };
      case 'Meeting':
      case 'Pedagogic':
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          dot: 'bg-indigo-500',
          icon: Users,
          label: isFr ? '👥 Réunions & Conseils' : 'Meeting'
        };
      default:
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          dot: 'bg-purple-500',
          icon: Flag,
          label: isFr ? '🎉 Événement Majeur' : 'Key Event'
        };
    }
  };

  // Export summary text generator
  const generatedSummaryText = useMemo(() => {
    const todayFormatted = new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    let text = `📅 CALENDRIER ACADÉMIQUE OFFICIEL - ${schoolName.toUpperCase()}\n`;
    text += `Année Scolaire: ${schoolYear} | Identifiant École: ${schoolId}\n`;
    text += `Édité le: ${todayFormatted}\n`;
    text += `--------------------------------------------------\n\n`;

    filteredEvents.forEach((evt, idx) => {
      text += `${idx + 1}. [${evt.type.toUpperCase()}] ${evt.title}\n`;
      text += `   Dates: ${evt.startDate}${evt.endDate && evt.endDate !== evt.startDate ? ' au ' + evt.endDate : ''}\n`;
      if (evt.targetClassRoom) text += `   Classes: ${evt.targetClassRoom}\n`;
      if (evt.location) text += `   Lieu: ${evt.location}\n`;
      if (evt.description) text += `   Note: ${evt.description}\n`;
      text += `\n`;
    });

    text += `--------------------------------------------------\n`;
    text += `Pasma-sys • Parents-Schools Management System`;
    return text;
  }, [schoolName, schoolYear, schoolId, filteredEvents, isFr]);

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(generatedSummaryText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch (e) {
      console.error('Failed to copy calendar text:', e);
    }
  };

  const handlePrintCalendar = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-2">
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                <span>{isFr ? 'Calendrier Officiel' : 'Academic Calendar'}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                {schoolYear}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono border border-emerald-200 dark:border-emerald-800">
                ID: {schoolId}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{isFr ? 'Planification Académique & Événements' : 'Academic Schedule & Events'}</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isFr 
                ? `Suivi centralisé des congés scolaires, examens officiels et réunions de l'établissement ${schoolName}.`
                : `Centralized calendar of holidays, examinations, and official events for ${schoolName}.`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAuthorizedToEdit && (
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{isFr ? 'Ajouter un événement' : 'Add Event'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopySummary}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                copiedSummary 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              {copiedSummary ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSummary ? (isFr ? 'Copié !' : 'Copied!') : (isFr ? 'Copier le texte' : 'Copy Text')}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintCalendar}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              title={isFr ? "Imprimer ou exporter le calendrier en PDF" : "Print or export PDF"}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isFr ? 'Imprimer' : 'Print'}</span>
            </button>

            {isAuthorizedToEdit && (
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                title={isFr ? "Réinitialiser avec le modèle officiel d'établissement" : "Reset default school template"}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-150 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-indigo-500" />
              <span>{isFr ? 'Total Événements' : 'Total Events'}</span>
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {stats.total}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
              <Award className="h-3 w-3 text-amber-500" />
              <span>{isFr ? 'Examens & Compositions' : 'Exams'}</span>
            </div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">
              {stats.exams}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
              <Sun className="h-3 w-3 text-emerald-500" />
              <span>{isFr ? 'Périodes de Congés' : 'Holidays'}</span>
            </div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {stats.holidays}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3 text-indigo-500" />
              <span>{isFr ? 'Prochaine Échéance' : 'Next Event'}</span>
            </div>
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 mt-1 truncate">
              {stats.nextEvent ? (
                <span>{stats.nextEvent.title} ({stats.nextEvent.startDate.split('-').slice(1).join('/')})</span>
              ) : (
                <span className="text-slate-400 italic">{isFr ? 'Aucune à venir' : 'None upcoming'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar & Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search & Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isFr ? "Rechercher un examen, congé..." : "Search event..."}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="all">{isFr ? 'Tous les types' : 'All Types'}</option>
            <option value="exam">{isFr ? '📝 Examens' : 'Exams'}</option>
            <option value="holiday">{isFr ? '🎄 Congés & Vacances' : 'Holidays'}</option>
            <option value="event">{isFr ? '🎉 Événements' : 'Key Events'}</option>
            <option value="meeting">{isFr ? '👥 Réunions/Conseils' : 'Meetings'}</option>
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="all">{isFr ? 'Toutes les classes' : 'All Classes'}</option>
            <option value="6ème">6ème</option>
            <option value="5ème">5ème</option>
            <option value="4ème">4ème</option>
            <option value="3ème">3ème</option>
            <option value="2nde">2nde</option>
            <option value="1ère">1ère</option>
            <option value="Tle">Terminale</option>
          </select>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-auto justify-center">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'month' 
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{isFr ? 'Mois' : 'Month'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'list' 
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{isFr ? 'Liste & Chronologie' : 'Timeline'}</span>
          </button>
        </div>
      </div>

      {/* Main View Display */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">
            {isFr ? 'Chargement du calendrier en cours...' : 'Loading calendar data...'}
          </p>
        </div>
      ) : viewMode === 'month' ? (
        /* Month Grid View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-6 shadow-sm space-y-4">
          {/* Month Header Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-indigo-600" />
              <span>{currentMonthName} {year}</span>
            </h2>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                title={isFr ? 'Mois précédent' : 'Previous month'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-lg transition cursor-pointer"
              >
                {isFr ? "Aujourd'hui" : 'Today'}
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                title={isFr ? 'Mois suivant' : 'Next month'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <div>{isFr ? 'Lun' : 'Mon'}</div>
            <div>{isFr ? 'Mar' : 'Tue'}</div>
            <div>{isFr ? 'Mer' : 'Wed'}</div>
            <div>{isFr ? 'Jeu' : 'Thu'}</div>
            <div>{isFr ? 'Ven' : 'Fri'}</div>
            <div>{isFr ? 'Sam' : 'Sat'}</div>
            <div className="text-rose-400">{isFr ? 'Dim' : 'Sun'}</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {calendarDays.map((cell, idx) => {
              if (!cell.isCurrentMonth || !cell.dayNum) {
                return (
                  <div key={`empty_${idx}`} className="h-20 md:h-24 bg-slate-50/40 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800/40 opacity-40" />
                );
              }

              const dayEvents = eventsByDate[cell.dateStr] || [];
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDayEvents({ dateStr: cell.dateStr, events: dayEvents });
                    } else if (isAuthorizedToEdit) {
                      setFormStartDate(cell.dateStr);
                      setFormEndDate(cell.dateStr);
                      handleOpenModal();
                    }
                  }}
                  className={`h-20 md:h-24 p-1.5 md:p-2 rounded-2xl border transition relative flex flex-col justify-between cursor-pointer group ${
                    isToday 
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-400/30' 
                      : dayEvents.length > 0 
                        ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300' 
                        : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black rounded-full h-6 w-6 flex items-center justify-center ${
                      isToday 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-slate-800 dark:text-slate-200'
                    }`}>
                      {cell.dayNum}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Day Events Indicator Dots / Badges */}
                  <div className="space-y-1 overflow-hidden mt-1">
                    {dayEvents.slice(0, 2).map((evt) => {
                      const badge = getTypeBadge(evt.type);
                      return (
                        <div 
                          key={evt.id}
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md truncate border ${badge.bg}`}
                          title={evt.title}
                        >
                          {evt.title}
                        </div>
                      );
                    })}

                    {dayEvents.length > 2 && (
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 pl-0.5">
                        +{dayEvents.length - 2} {isFr ? 'autres' : 'more'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Timeline / List View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>{isFr ? 'Chronologie de l\'Année Scolaire' : 'School Year Timeline'}</span>
            </h3>

            <span className="text-xs font-bold text-slate-500">
              {filteredEvents.length} {isFr ? 'événements répertoriés' : 'events listed'}
            </span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold">{isFr ? 'Aucun événement correspondant aux critères.' : 'No events matching criteria.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEvents.map((evt) => {
                const badge = getTypeBadge(evt.type);
                const isPassed = new Date(evt.endDate || evt.startDate) < new Date(new Date().toISOString().split('T')[0]);
                const isOngoing = new Date().toISOString().split('T')[0] >= evt.startDate && new Date().toISOString().split('T')[0] <= (evt.endDate || evt.startDate);

                return (
                  <div key={evt.id} className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badge.bg}`}>
                          {badge.label}
                        </span>

                        {isOngoing && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9.5px] font-black animate-pulse">
                            {isFr ? 'EN COURS' : 'ONGOING'}
                          </span>
                        )}

                        {isPassed && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9.5px] font-bold">
                            {isFr ? 'Passé' : 'Passed'}
                          </span>
                        )}

                        {evt.targetClassRoom && (
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Users className="h-3 w-3 text-slate-400" />
                            <span>{evt.targetClassRoom}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 transition">
                        {evt.title}
                      </h4>

                      {evt.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {evt.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="h-3 w-3 text-indigo-500" />
                          <span>{evt.startDate} {evt.endDate && evt.endDate !== evt.startDate ? `➔ ${evt.endDate}` : ''}</span>
                        </span>

                        {evt.location && (
                          <span className="flex items-center gap-1 font-semibold">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span>{evt.location}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions for authorized users */}
                    {isAuthorizedToEdit && (
                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(evt)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title={isFr ? "Modifier" : "Edit"}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(evt.id, evt.title)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title={isFr ? "Supprimer" : "Delete"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Day Details Modal / Drawer */}
      <AnimatePresence>
        {selectedDayEvents && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isFr ? 'Événements du' : 'Events for'} {selectedDayEvents.dateStr}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayEvents(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {selectedDayEvents.events.map((evt) => {
                  const badge = getTypeBadge(evt.type);
                  return (
                    <div key={evt.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-extrabold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {evt.targetClassRoom && (
                          <span className="text-[10px] font-bold text-slate-500">
                            {evt.targetClassRoom}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {evt.title}
                      </h4>

                      {evt.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {evt.description}
                        </p>
                      )}

                      {evt.location && (
                        <div className="text-[10.5px] font-bold text-slate-400 flex items-center gap-1 pt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{evt.location}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDayEvents(null)}
                  className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  {isFr ? 'Fermer' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingEvent 
                      ? (isFr ? 'Modifier l\'Événement Académique' : 'Edit Academic Event') 
                      : (isFr ? 'Ajouter un Événement Académique' : 'Add Academic Event')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFr ? 'Titre de l\'événement / Examen *' : 'Event Title / Exam *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={isFr ? "ex: Évaluations de la 3ème Séquence" : "e.g. 3rd Sequence Exams"}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFr ? 'Catégorie *' : 'Type *'}
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AcademicEventType)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Exam">{isFr ? '📝 Examen / Évaluation' : 'Exam'}</option>
                      <option value="Holiday">{isFr ? '🎄 Congé / Vacances' : 'Holiday'}</option>
                      <option value="Event">{isFr ? '🎉 Événement Majeur' : 'Key Event'}</option>
                      <option value="Meeting">{isFr ? '👥 Réunion / Conseil' : 'Meeting'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFr ? 'Classes Cibles' : 'Target Classes'}
                    </label>
                    <input
                      type="text"
                      value={formTargetClass}
                      onChange={(e) => setFormTargetClass(e.target.value)}
                      placeholder={isFr ? "ex: Toutes les classes / 3ème" : "e.g. All Classes"}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFr ? 'Date de Début *' : 'Start Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFr ? 'Date de Fin' : 'End Date'}
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFr ? 'Lieu / Salle' : 'Location'}
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder={isFr ? "ex: Salles d'Examens, Grande Cour" : "e.g. Exam Hall"}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFr ? 'Description / Notes pour les parents' : 'Description'}
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={isFr ? "Consignes particulières, matériel requis, horaires d'ouverture..." : "Instructions, details..."}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    {isFr ? 'Annuler' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isFr ? 'Enregistrer l\'Événement' : 'Save Event'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
