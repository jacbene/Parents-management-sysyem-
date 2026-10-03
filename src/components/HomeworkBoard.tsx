import React, { useState, useEffect, useMemo } from 'react';
import { Homework, Student, HomeworkStatus, ApeeSettings, HomeworkFrequency } from '../types';
import { BookOpen, CheckCircle, Circle, Clock, CheckCircle2, AlertCircle, Plus, Trash2, Lock, Unlock, CheckSquare, X, RotateCw, AlertTriangle, Calendar, Sparkles, Repeat, CalendarDays, Layers, List, Loader2, Download, FileText, Printer, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, getAuthHeader } from '../firebase';
import { useLanguage } from '../utils/TranslationContext';
import HomeworkCalendarView from './HomeworkCalendarView';
import HomeworkPdfPreviewModal from './HomeworkPdfPreviewModal';
import { jsPDF } from 'jspdf';

interface HomeworkBoardProps {
  homeworks: Homework[];
  onUpdateHomework: (updated: Homework) => void;
  onAddHomework?: (homework: Homework) => Promise<boolean>;
  onDeleteHomework?: (id: string) => Promise<boolean>;
  isPedAuthorized?: boolean;
  onPromptUnlockPed?: () => void;
  pedManagerName?: string;
  hasPedPassword?: boolean;
  activeStudent?: Student | null;
  settings?: ApeeSettings;
}

// Helper to compute recurrence dates
const computeRecurrenceDates = (startDateStr: string, freq: HomeworkFrequency, count: number): string[] => {
  const dates: string[] = [];
  if (!startDateStr || count <= 0) return dates;

  for (let i = 0; i < count; i++) {
    const d = new Date(startDateStr + 'T12:00:00');
    if (isNaN(d.getTime())) break;

    if (freq === 'daily') {
      d.setDate(d.getDate() + i);
    } else if (freq === 'weekly') {
      d.setDate(d.getDate() + i * 7);
    } else if (freq === 'biweekly') {
      d.setDate(d.getDate() + i * 14);
    } else if (freq === 'monthly') {
      d.setMonth(d.getMonth() + i);
    }

    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

export default function HomeworkBoard({
  homeworks,
  onUpdateHomework,
  onAddHomework,
  onDeleteHomework,
  isPedAuthorized = false,
  onPromptUnlockPed,
  pedManagerName = '',
  hasPedPassword = false,
  activeStudent,
  settings,
}: HomeworkBoardProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed' | 'recurring'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Add Homework states
  const [showAddForm, setShowAddForm] = useState(false);
  const [hwToDelete, setHwToDelete] = useState<Homework | null>(null);
  const [isDeletingHw, setIsDeletingHw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Homework Assistant Modal states
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSubject, setAiSubject] = useState('Mathématiques');
  const [aiDifficulty, setAiDifficulty] = useState('Standard');
  const [isGeneratingAiHw, setIsGeneratingAiHw] = useState(false);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<any>(null);

  // PDF Export Summary Live Modal State
  const [showExportModal, setShowExportModal] = useState(false);

  // Form Fields
  const [subject, setSubject] = useState('Mathématiques');
  const [customSubject, setCustomSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [hwGradeValue, setHwGradeValue] = useState('');

  // Generate Homework with Gemini AI
  const handleGenerateAiHomework = async () => {
    if (!aiTopic.trim()) {
      alert(isEn ? "Please enter a topic or chapter." : "Veuillez préciser le sujet ou chapitre (ex: Fractions, Verbes du 1er groupe, Histoire du Cameroun).");
      return;
    }

    setIsGeneratingAiHw(true);
    setAiGeneratedResult(null);

    try {
      const studentClass = activeStudent?.classRoom || activeStudent?.grade || 'Primaire/Secondaire';
      const authHeader = await getAuthHeader();
      const response = await fetch('/api/gemini/generate-homework-topic', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          subject: aiSubject,
          grade: studentClass,
          studentName: activeStudent?.name,
          difficulty: aiDifficulty
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setAiGeneratedResult(resData.data);
      } else {
        throw new Error(resData.message || 'Generation error');
      }
    } catch (err) {
      console.error("AI Homework generation error:", err);
      alert(isEn ? "Failed to generate homework with AI." : "Erreur lors de la génération du devoir par l'IA.");
    } finally {
      setIsGeneratingAiHw(false);
    }
  };

  const handleApplyAiGeneratedToForm = (autoSave = false) => {
    if (!aiGeneratedResult) return;

    const formattedDesc = `### ${aiGeneratedResult.title}\n\n**Objectifs :**\n${aiGeneratedResult.objectives.map((o: string) => `- ${o}`).join('\n')}\n\n${aiGeneratedResult.exercises.map((ex: any, idx: number) => `**Exercice ${idx + 1} : ${ex.title}**\n*Consigne :* ${ex.instruction}\n\nQuestions :\n${ex.questions.map((q: string, qidx: number) => `${qidx + 1}. ${q}`).join('\n')}\n\n*Corrigé :*\n${ex.solutions.map((s: string, sidx: number) => `R${sidx + 1} : ${s}`).join('\n')}`).join('\n\n')}\n\n**Conseils :**\n${aiGeneratedResult.parentTips}`;

    setSubject(aiSubject);
    setTitle(aiGeneratedResult.title);
    setDescription(formattedDesc);
    if (!dueDate) {
      setDueDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
    }
    setShowAiModal(false);
    setShowAddForm(true);

    if (autoSave && activeStudent && onAddHomework) {
      const newHw: Homework = {
        id: 'hw_' + Date.now(),
        studentId: activeStudent.id,
        parentId: activeStudent.parentId,
        subject: aiSubject,
        title: `IA: ${aiGeneratedResult.title}`,
        description: formattedDesc,
        dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        status: 'Pending',
        isRecurring: false
      };
      onAddHomework(newHw);
      setShowAddForm(false);
    }
  };

  // Quick Add for specific calendar date
  const handleQuickAddForDate = (dateStr: string) => {
    setDueDate(dateStr);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Recurring Homework Options
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<HomeworkFrequency>('weekly');
  const [recurrenceCount, setRecurrenceCount] = useState<number>(4);
  const [includeSeriesIndex, setIncludeSeriesIndex] = useState(true);

  useEffect(() => {
    const handleQuickAction = (e: any) => {
      if (e.detail?.actionKey === 'add_homework') {
        setShowAddForm(true);
      }
    };
    window.addEventListener('pasma_trigger_quick_action', handleQuickAction);
    return () => window.removeEventListener('pasma_trigger_quick_action', handleQuickAction);
  }, []);

  const configuredSubjectsList = useMemo(() => {
    if (settings?.classSubjects && Array.isArray(settings.classSubjects) && settings.classSubjects.length > 0) {
      const studentClass = activeStudent?.classRoom || activeStudent?.grade || '';
      if (studentClass) {
        const filtered = settings.classSubjects.filter(
          (s: any) => !s.classRoom || s.classRoom === 'Toutes les classes' || s.classRoom.toLowerCase().includes(studentClass.toLowerCase()) || studentClass.toLowerCase().includes(s.classRoom.toLowerCase())
        );
        if (filtered.length > 0) {
          return Array.from(new Set(filtered.map((s: any) => s.name as string)));
        }
      }
      return Array.from(new Set(settings.classSubjects.map((s: any) => s.name as string)));
    }
    return [
      'Mathématiques',
      'Physique-Chimie',
      'Sciences de la Vie et de la Terre (SVT)',
      'Français',
      'Anglais',
      'Histoire-Géographie',
      'Informatique',
      'Éducation à la Citoyenneté et à la Morale (ECM)',
      'Allemand / Espagnol',
      'Philosophie'
    ];
  }, [settings?.classSubjects, activeStudent?.classRoom, activeStudent?.grade]);

  // Preview dates for recurring schedule
  const previewScheduleDates = useMemo(() => {
    if (!isRecurring || !dueDate) return [];
    return computeRecurrenceDates(dueDate, recurrenceFrequency, recurrenceCount);
  }, [isRecurring, dueDate, recurrenceFrequency, recurrenceCount]);

  // Filter homeworks
  const recurringHomeworksCount = useMemo(() => {
    return homeworks.filter(h => h.isRecurring).length;
  }, [homeworks]);

  const filteredHomeworks = homeworks.filter(hw => {
    if (activeTab === 'pending') return hw.status === 'Pending';
    if (activeTab === 'completed') return hw.status === 'Completed';
    if (activeTab === 'recurring') return hw.isRecurring;
    return true;
  });

  // Toggle status inside Firestore database
  const handleToggleStatus = async (hw: Homework) => {
    const newStatus = hw.status === 'Completed' ? 'Pending' : 'Completed';
    setUpdatingId(hw.id);
    try {
      const hwRef = doc(db, 'homeworks', hw.id);
      await updateDoc(hwRef, {
        status: newStatus
      });
      // Update local state in App wrapper
      onUpdateHomework({
        ...hw,
        status: newStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `homeworks/${hw.id}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenForm = () => {
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    setDueDate(new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]); // Default 2 days later
    setIsRecurring(false);
    setRecurrenceFrequency('weekly');
    setRecurrenceCount(4);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) {
      alert(isEn ? 'Please select a student before adding homework.' : 'Veuillez sélectionner un élève avant de pouvoir introduire des devoirs.');
      return;
    }
    if (!title.trim()) {
      alert(isEn ? 'Please specify the assignment title.' : 'Veuillez spécifier le titre du travail exigé.');
      return;
    }
    if (!dueDate) {
      alert(isEn ? 'Please specify the initial due date.' : 'Veuillez renseigner la date d\'échéance.');
      return;
    }

    if (!onAddHomework) return;

    setIsSubmitting(true);
    try {
      const targetSubj = (subject === 'Autre' || subject === '__custom__') ? (customSubject.trim() || 'Autre') : subject;
      const baseTimestamp = Date.now();

      if (isRecurring && previewScheduleDates.length > 1) {
        const seriesId = `series_${baseTimestamp}`;
        const frequencyLabel = 
          recurrenceFrequency === 'weekly' ? (isEn ? 'Weekly' : 'Hebdomadaire') :
          recurrenceFrequency === 'biweekly' ? (isEn ? 'Bi-weekly' : 'Bimensuel') :
          recurrenceFrequency === 'monthly' ? (isEn ? 'Monthly' : 'Mensuel') :
          (isEn ? 'Daily' : 'Quotidien');

        const durationStr = `${previewScheduleDates.length} ${
          recurrenceFrequency === 'weekly' ? (isEn ? 'weeks' : 'semaines') :
          recurrenceFrequency === 'biweekly' ? (isEn ? 'periods (2 wks)' : 'quinzaines') :
          recurrenceFrequency === 'monthly' ? (isEn ? 'months' : 'mois') :
          (isEn ? 'days' : 'jours')
        }`;

        for (let idx = 0; idx < previewScheduleDates.length; idx++) {
          const itemDate = previewScheduleDates[idx];
          const unitWord = recurrenceFrequency === 'weekly' ? (isEn ? 'Week' : 'Semaine') : (isEn ? 'Session' : 'Séance');
          const instanceTitle = includeSeriesIndex
            ? `${title.trim()} (${unitWord} ${idx + 1}/${previewScheduleDates.length})`
            : title.trim();

          const recurringHw: Homework = {
            id: `hw_${baseTimestamp}_${idx}`,
            studentId: activeStudent.id,
            parentId: activeStudent.parentId,
            subject: targetSubj,
            title: instanceTitle,
            description: description.trim() || undefined,
            dueDate: itemDate,
            status: 'Pending',
            grade: hwGradeValue.trim() || undefined,
            isRecurring: true,
            recurrenceFrequency,
            recurrenceCount: previewScheduleDates.length,
            recurrenceDuration: durationStr,
            recurrenceSeriesId: seriesId,
            recurrenceIndex: idx + 1,
          };

          await onAddHomework(recurringHw);
        }
      } else {
        const singleHw: Homework = {
          id: 'hw_' + baseTimestamp,
          studentId: activeStudent.id,
          parentId: activeStudent.parentId,
          subject: targetSubj,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate,
          status: 'Pending',
          grade: hwGradeValue.trim() || undefined,
          isRecurring: false
        };

        await onAddHomework(singleHw);
      }

      // Reset form
      setTitle('');
      setDescription('');
      setHwGradeValue('');
      setIsRecurring(false);
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrompt = (hw: Homework) => {
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    setHwToDelete(hw);
  };

  const handleConfirmDeleteHw = async () => {
    if (!hwToDelete || !onDeleteHomework) return;
    setIsDeletingHw(true);
    try {
      await onDeleteHomework(hwToDelete.id);
      setHwToDelete(null);
    } finally {
      setIsDeletingHw(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            {isEn ? "Homework & Assignment Tracker" : "Cahier de Textes & Devoirs"}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEn
              ? "Track homework assignments, due dates, recurring tasks, and parent validation."
              : "Suivi des devoirs maison à faire, dates de rendu, devoirs récurrents et validation en ligne par les parents."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* PDF Summary Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 border border-slate-250 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            type="button"
            title={isEn ? "Export current homework list to PDF summary" : "Exporter la liste des devoirs au format PDF"}
          >
            <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{isEn ? "Export PDF Summary" : "Exporter Synthèse PDF"}</span>
          </button>

          {/* AI Homework Generator Button */}
          <button
            onClick={() => {
              if (activeStudent) {
                setShowAiModal(true);
              } else {
                handleOpenForm();
              }
            }}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            type="button"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{isEn ? "Generate with AI" : "Générer Devoir IA"}</span>
          </button>

          {/* Action Trigger */}
          <button
            onClick={handleOpenForm}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" /> {isEn ? "Add Homework" : "Ajouter un Devoir"}
          </button>
        </div>
      </div>

      {/* Security Status Header */}
      {hasPedPassword && (
        <div className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isPedAuthorized ? 'bg-emerald-50 text-emerald-950 border-emerald-150' : 'bg-slate-50 text-slate-800 border-slate-150'
        }`}>
          <div className="flex items-center gap-2">
            {isPedAuthorized ? (
              <Unlock className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="h-4.5 w-4.5 text-slate-500 shrink-0" />
            )}
            <div>
              <span className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-slate-650">
                {isPedAuthorized ? '🔓 Accès Officiel Débloqué' : '🔒 Cahier de Textes Verrouillé (Lecture Seule)'}
              </span>
              <p className="font-medium text-slate-600 mt-0.5">
                {isPedAuthorized 
                  ? `Vous agissez en qualité de : ${pedManagerName || "Principal Responsable Pédagogique"}`
                  : `L'introduction ou la suppression de devoirs officiels requiert le mot de passe du Surveillant ou Censeur.`}
              </p>
            </div>
          </div>
          {!isPedAuthorized && onPromptUnlockPed && (
            <button
              onClick={onPromptUnlockPed}
              className="px-3 py-1.5 bg-white text-slate-800 border border-slate-250 font-bold rounded-lg text-[10px] hover:bg-slate-50 uppercase tracking-wider transition cursor-pointer shrink-0"
            >
              Saisir mot de passe
            </button>
          )}
        </div>
      )}

      {/* Add Homework Section Form */}
      <AnimatePresence>
        {showAddForm && activeStudent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 shadow-3xs">
              <div className="flex items-center justify-between border-b border-slate-205 pb-2 select-none">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  📚 {isEn ? `Create Assignment for ${activeStudent.name}` : `Enregistrer un devoir pour ${activeStudent.name}`} ({activeStudent.grade || 'Classe'})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold uppercase transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Annuler"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">
                    {isEn ? "Subject / Course" : "Matière / Discipline"} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-850"
                  >
                    {configuredSubjectsList.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__custom__">✏️ {isEn ? "Custom Subject..." : "Autre matière sur-mesure..."}</option>
                  </select>
                  {(subject === '__custom__' || subject === 'Autre') && (
                    <input
                      type="text"
                      placeholder={isEn ? "Enter custom subject..." : "Saisir la matière..."}
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      className="w-full mt-1.5 px-2.5 py-1 text-xs border border-indigo-200 rounded-md focus:outline-indigo-500 bg-white"
                    />
                  )}
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">
                    {isEn ? "Assignment Title" : "Intitulé du Travail exigé"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isEn ? "E.g.: Mathematics review sheet #4" : "Ex: Devoir de mathématiques à rendre sur feuille double"}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">
                    {isRecurring 
                      ? (isEn ? "First Due Date" : "1ère Date de rendu") 
                      : (isEn ? "Due Date" : "Date limite de rendu")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">
                    {isEn ? "Instructions / Exercise details" : "Consignes / Exercices à faire"}
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isEn ? "E.g.: Exercises 4, 5 and 9 p. 234. Pay attention to diagrams." : "Ex: Exercices 4, 5 et 9 p. 234. Faire attention au schéma récapitulatif."}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">
                    {isEn ? "Indicative Grade / Weight" : "Note indicative (Pondération)"}
                  </label>
                  <input
                    type="text"
                    value={hwGradeValue}
                    onChange={(e) => setHwGradeValue(e.target.value)}
                    placeholder={isEn ? "E.g.: Grade Coef. 2 — /20" : "Ex: Note coef. 2 — /20"}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Recurring Homework Switch & Options */}
              <div className="p-4 rounded-xl border border-indigo-150 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg transition-colors ${isRecurring ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-100 text-indigo-700'}`}>
                      <Repeat className={`h-4 w-4 ${isRecurring ? 'animate-spin-slow' : ''}`} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>{isEn ? "Recurring Homework" : "Devoir Récurrent (Répétition programmée)"}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {isEn ? "Automated Series" : "Série automatique"}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {isEn
                          ? "Automatically generate repeating assignments across future dates (weekly, monthly, etc.)."
                          : "Planifiez automatiquement la répétition de ce devoir à fréquence régulière (hebdo, quinzaine, etc.)."}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {isRecurring && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-3 border-t border-indigo-150/80 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Frequency Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-indigo-600" />
                          {isEn ? "Frequency" : "Fréquence de répétition"}
                        </label>
                        <select
                          value={recurrenceFrequency}
                          onChange={(e) => setRecurrenceFrequency(e.target.value as HomeworkFrequency)}
                          className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-indigo-500 font-semibold text-slate-850 shadow-2xs"
                        >
                          <option value="weekly">📅 {isEn ? "Weekly (Every week)" : "Hebdomadaire (Chaque semaine)"}</option>
                          <option value="biweekly">📆 {isEn ? "Bi-weekly (Every 2 weeks)" : "Bimensuel (Toutes les 2 semaines)"}</option>
                          <option value="monthly">🗓️ {isEn ? "Monthly (Every month)" : "Mensuel (Chaque mois)"}</option>
                          <option value="daily">⚡ {isEn ? "Daily (Every day)" : "Quotidien (Chaque jour)"}</option>
                        </select>
                      </div>

                      {/* Duration / Occurrence Count */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                          <Layers className="h-3 w-3 text-indigo-600" />
                          {isEn ? "Duration / Repetitions" : "Durée / Répétitions"}
                        </label>
                        <select
                          value={recurrenceCount}
                          onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-indigo-500 font-semibold text-slate-850 shadow-2xs"
                        >
                          <option value={2}>2 {isEn ? "occurrences (2 sessions)" : "échéances (2 séances)"}</option>
                          <option value={3}>3 {isEn ? "occurrences (3 sessions)" : "échéances (3 séances)"}</option>
                          <option value={4}>4 {isEn ? "occurrences (~1 month)" : "échéances (~1 mois / 4 séances)"}</option>
                          <option value={6}>6 {isEn ? "occurrences (6 sessions)" : "échéances (6 séances)"}</option>
                          <option value={8}>8 {isEn ? "occurrences (~2 months)" : "échéances (~2 mois / 8 séances)"}</option>
                          <option value={12}>12 {isEn ? "occurrences (1 term / 3 months)" : "échéances (1 trimestre / 12 séances)"}</option>
                        </select>
                      </div>

                      {/* Title Indexing Option */}
                      <div className="space-y-1 flex flex-col justify-end">
                        <label className="flex items-center gap-2 p-2 bg-white border border-indigo-200 rounded-lg cursor-pointer hover:bg-indigo-50/50 transition">
                          <input
                            type="checkbox"
                            checked={includeSeriesIndex}
                            onChange={(e) => setIncludeSeriesIndex(e.target.checked)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span className="text-[11px] font-bold text-slate-700 select-none">
                            {isEn ? "Include numbering in title (e.g. [1/4])" : "Numéroter les titres (ex: Semaine 1/4)"}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Live Schedule Dates Preview */}
                    {previewScheduleDates.length > 0 && (
                      <div className="p-3 bg-white border border-indigo-150 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                            {isEn
                              ? `Schedule Preview (${previewScheduleDates.length} assignments will be created):`
                              : `Aperçu du calendrier (${previewScheduleDates.length} devoirs seront créés automatiquement) :`}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            {recurrenceFrequency === 'weekly' ? 'Intervalle: +7j' : recurrenceFrequency === 'biweekly' ? 'Intervalle: +14j' : recurrenceFrequency === 'monthly' ? 'Intervalle: +1 mois' : 'Intervalle: +1j'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {previewScheduleDates.map((pDate, idx) => (
                            <div
                              key={pDate + idx}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-[10.5px] font-mono flex items-center gap-1.5 font-bold"
                            >
                              <span className="text-[9.5px] px-1 py-0.2 rounded-md bg-indigo-600 text-white font-sans font-black">
                                #{idx + 1}
                              </span>
                              <span>
                                {new Date(pDate + 'T12:00:00').toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-250 bg-white text-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-50 cursor-pointer text-center disabled:opacity-50"
                >
                  {isEn ? "Cancel" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 cursor-pointer text-center shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      <span>{isEn ? "Creating Series..." : "Génération en cours..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      <span>
                        {isRecurring 
                          ? (isEn ? `Create ${previewScheduleDates.length} Recurring Assignments` : `Générer ${previewScheduleDates.length} Devoirs Récurrents`) 
                          : (isEn ? "Save Assignment" : "Enregistrer Devoir")}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtering list & layout + View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* View Mode Switcher (List vs Calendar) */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>{isEn ? "List View" : "Vue Liste"}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{isEn ? "Calendar View" : "Vue Calendrier"}</span>
          </button>
        </div>

        {/* Status Filtering Tabs */}
        <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isEn ? "All" : "Tous"} ({homeworks.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              activeTab === 'pending'
                ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isEn ? "To Do" : "À Faire"} ({homeworks.filter(h => h.status === 'Pending').length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              activeTab === 'completed'
                ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isEn ? "Completed" : "Terminés"} ({homeworks.filter(h => h.status === 'Completed').length})
          </button>
          {recurringHomeworksCount > 0 && (
            <button
              onClick={() => setActiveTab('recurring')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'recurring'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-900'
              }`}
            >
              <Repeat className="h-3 w-3" />
              <span>{isEn ? "Recurring" : "Récurrents"} ({recurringHomeworksCount})</span>
            </button>
          )}

          {/* Quick PDF export trigger in tab bar */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-900 transition flex items-center gap-1.5 shrink-0 cursor-pointer border-l border-gray-200 dark:border-slate-700 ml-1 pl-2"
            title={isEn ? "Export PDF Summary" : "Exporter Synthèse PDF"}
          >
            <Download className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">{isEn ? "PDF Summary" : "Synthèse PDF"}</span>
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <HomeworkCalendarView
          homeworks={homeworks}
          filteredHomeworks={filteredHomeworks}
          onToggleStatus={handleToggleStatus}
          onDeletePrompt={handleDeletePrompt}
          onQuickAddForDate={handleQuickAddForDate}
          updatingId={updatingId}
          isPedAuthorized={isPedAuthorized}
          language={language}
          onExportPDF={() => setShowExportModal(true)}
        />
      ) : filteredHomeworks.length === 0 ? (
        <div className="text-center p-12 bg-gray-50/50 rounded-2xl border border-gray-100 select-none">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">
            {isEn ? "Great! No assignments pending for this selection." : "Parfait ! Aucun devoir en attente pour cette sélection."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredHomeworks.map((hw, idx) => {
              const isExpired = new Date(hw.dueDate).getTime() < Date.now() && hw.status === 'Pending';
              const isCustom = hw.id.startsWith('hw_') && Number(hw.id.split('_')[1]) > 10000;

              return (
                <motion.div
                  key={hw.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`p-4 bg-white border rounded-2xl flex items-start gap-4 transition-all group relative duration-300 ${
                    hw.status === 'Completed'
                      ? 'border-gray-100 opacity-80'
                      : isExpired
                      ? 'border-red-200 bg-red-50/10'
                      : hw.isRecurring
                      ? 'border-indigo-150 hover:border-indigo-300'
                      : 'border-gray-150 hover:border-gray-200'
                  }`}
                >
                  {/* Status checkbox toggle */}
                  <button
                    onClick={() => handleToggleStatus(hw)}
                    disabled={updatingId === hw.id}
                    className="mt-1 flex items-center justify-center shrink-0 cursor-pointer text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    {updatingId === hw.id ? (
                      <span className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : hw.status === 'Completed' ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 fill-emerald-50" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300 hover:text-indigo-600" />
                    )}
                  </button>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                        {hw.subject}
                      </span>

                      {hw.isRecurring && (
                        <span 
                          title={isEn 
                            ? `Recurring assignment: ${hw.recurrenceFrequency || 'weekly'} series (${hw.recurrenceIndex || 1}/${hw.recurrenceCount || '?'})` 
                            : `Devoir récurrent : série ${hw.recurrenceFrequency === 'weekly' ? 'hebdomadaire' : hw.recurrenceFrequency === 'biweekly' ? 'bimensuelle' : hw.recurrenceFrequency === 'monthly' ? 'mensuelle' : 'quotidienne'} (${hw.recurrenceIndex || 1}/${hw.recurrenceCount || '?'})`}
                          className="text-[10.5px] font-black px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center gap-1"
                        >
                          <Repeat className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>
                            {hw.recurrenceFrequency === 'weekly' ? (isEn ? 'Weekly' : 'Hebdo') :
                             hw.recurrenceFrequency === 'biweekly' ? (isEn ? 'Bi-weekly' : 'Bimensuel') :
                             hw.recurrenceFrequency === 'monthly' ? (isEn ? 'Monthly' : 'Mensuel') :
                             (isEn ? 'Daily' : 'Quotidien')}
                            {hw.recurrenceIndex && hw.recurrenceCount ? ` (${hw.recurrenceIndex}/${hw.recurrenceCount})` : ''}
                          </span>
                        </span>
                      )}

                      {hw.grade && (
                        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md">
                          Note / Éval : {hw.grade}
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {isEn ? "Overdue!" : "En retard !"}
                        </span>
                      )}
                    </div>

                    <h3 className={`font-semibold text-sm ${hw.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {hw.title}
                    </h3>

                    {hw.description && (
                      <p className={`text-xs leading-relaxed ${hw.status === 'Completed' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {hw.description}
                      </p>
                    )}

                    <div className="pt-2 flex items-center gap-3 text-xs text-gray-400 font-mono flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                        <span>
                          {isEn ? "Due on " : "Rendu exigé le "}
                          {new Date(hw.dueDate + 'T12:00:00').toLocaleDateString(isEn ? 'en-US' : 'fr-FR', { weekday: 'short', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                      {hw.isRecurring && hw.recurrenceDuration && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-150">
                          Série : {hw.recurrenceDuration}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete button option */}
                  {onDeleteHomework && (
                    <button
                      type="button"
                      onClick={() => handleDeletePrompt(hw)}
                      className={`text-red-600 hover:text-red-850 p-1.5 bg-red-100/10 hover:bg-red-200/20 border border-transparent hover:border-red-500/10 rounded-xl transition duration-200 shrink-0 self-center cursor-pointer ${
                        isPedAuthorized || isCustom ? 'opacity-100' : 'opacity-40 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      }`}
                      title={isEn ? "Delete this homework" : "Supprimer ce devoir"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Visually Harmonized Confirmation Modal for Homework Deletion */}
      <AnimatePresence>
        {hwToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200/80 dark:border-rose-900/50 max-w-md w-full p-6 space-y-5 overflow-hidden relative text-slate-900 dark:text-slate-100"
            >
              {/* Top Accent Gradient Bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-600 to-amber-500" />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                    <Trash2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      {isEn ? "Delete Homework Assignment" : "Suppression de Devoir"}
                    </h3>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                      {isEn ? "Irreversible action • Immediate removal" : "Action irréversible • Retrait immédiat"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHwToDelete(null)}
                  disabled={isDeletingHw}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Homework Preview Summary Box */}
              <div className="p-4 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-rose-900/70 dark:text-rose-300/70 uppercase tracking-wider">
                    {isEn ? "Homework details" : "Détails du devoir ciblé"}
                  </span>
                  <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg">
                    {hwToDelete.subject}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                    {hwToDelete.title}
                  </p>
                  {hwToDelete.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-normal">
                      {hwToDelete.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span>
                      {isEn ? "Due date: " : "Rendu le : "}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {new Date(hwToDelete.dueDate + 'T12:00:00').toLocaleDateString(isEn ? 'en-US' : 'fr-FR', { weekday: 'short', month: 'long', day: 'numeric' })}
                      </strong>
                    </span>
                  </div>
                  {hwToDelete.isRecurring && (
                    <div className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 pt-0.5">
                      <Repeat className="h-3 w-3" />
                      <span>{isEn ? "Part of a recurring assignment series" : "Fait partie d'une série de devoirs récurrents"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{isEn ? "Consequences of deletion" : "Conséquences de la suppression"}</span>
                </div>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                  {isEn
                    ? "This assignment will be permanently removed from the class homework tracker and will no longer appear on student/parent portals."
                    : "Ce devoir sera définitivement supprimé du cahier de textes et ne sera plus visible par les élèves ni par les parents sur leur portail."}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setHwToDelete(null)}
                  disabled={isDeletingHw}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isEn ? "Cancel" : "Annuler"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteHw}
                  disabled={isDeletingHw}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeletingHw ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      <span>{isEn ? "Deleting..." : "Suppression en cours..."}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>{isEn ? "Confirm Deletion" : "Supprimer définitivement"}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Homework Generator Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {isEn ? "AI Homework Generator" : "Assistant Générateur de Devoir IA"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeStudent 
                        ? `${isEn ? "Custom homework for" : "Conçu sur-mesure pour"} ${activeStudent.name} (${activeStudent.grade || activeStudent.classRoom || "Classe"})`
                        : (isEn ? "Generate homework with exercises and answer key" : "Concevez instantanément un devoir avec exercices et corrigés types")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Generator Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                      {isEn ? "Subject" : "Matière"}
                    </label>
                    <select
                      value={aiSubject}
                      onChange={(e) => setAiSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
                    >
                      {configuredSubjectsList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                      {isEn ? "Difficulty" : "Niveau de difficulté"}
                    </label>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
                    >
                      <option value="Facile">{isEn ? "Easy / Reinforcement" : "Facile (Remédiation / Base)"}</option>
                      <option value="Standard">{isEn ? "Standard (Curriculum)" : "Standard (Niveau de classe)"}</option>
                      <option value="Avancé">{isEn ? "Challenging / Advanced" : "Avancé (Perfectionnement)"}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                      {isEn ? "Classroom / Target" : "Classe ciblée"}
                    </label>
                    <div className="px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-indigo-700 dark:text-indigo-400 truncate">
                      {activeStudent?.grade || activeStudent?.classRoom || "Classe générale"}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                    {isEn ? "Topic, Chapter, or Specific keywords" : "Chapitre, Thématique ou Notions clés"} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder={isEn ? "E.g.: Addition of fractions, Pythagorean theorem, Past tense verbs..." : "Ex: Addition et soustraction des fractions, Théorème de Thalès, Imparfait de l'indicatif..."}
                      className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAiHomework}
                      disabled={isGeneratingAiHw || !aiTopic.trim()}
                      className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50 shadow-md shadow-indigo-600/20"
                    >
                      {isGeneratingAiHw ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{isEn ? "Generating..." : "Génération..."}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>{isEn ? "Generate" : "Générer"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Generated Result Preview */}
              {aiGeneratedResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/40 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/40 pb-2">
                    <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                      📝 {aiGeneratedResult.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full">
                      {aiSubject}
                    </span>
                  </div>

                  {aiGeneratedResult.objectives && aiGeneratedResult.objectives.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{isEn ? "Objectives:" : "Objectifs visés :"}</p>
                      <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc list-inside space-y-0.5">
                        {aiGeneratedResult.objectives.map((obj: string, i: number) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiGeneratedResult.exercises && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {aiGeneratedResult.exercises.map((ex: any, i: number) => (
                        <div key={i} className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-100 dark:border-slate-700 text-xs space-y-1">
                          <p className="font-black text-slate-900 dark:text-white">
                            Exercice {i + 1} : {ex.title}
                          </p>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] italic">{ex.instruction}</p>
                          <div className="pl-2 space-y-0.5 text-slate-800 dark:text-slate-200 text-[11px]">
                            {ex.questions.map((q: string, qi: number) => (
                              <div key={qi}>• {q}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiGeneratedResult.parentTips && (
                    <p className="text-[11px] text-indigo-900 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-950/40 p-2.5 rounded-xl">
                      💡 <strong>{isEn ? "Tips: " : "Conseils d'accompagnement : "}</strong> {aiGeneratedResult.parentTips}
                    </p>
                  )}

                  {/* Actions to Insert / Apply */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                    <button
                      type="button"
                      onClick={() => handleApplyAiGeneratedToForm(false)}
                      className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-250 dark:border-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      {isEn ? "Edit in Form" : "Personnaliser dans le formulaire"}
                    </button>
                    {activeStudent && (
                      <button
                        type="button"
                        onClick={() => handleApplyAiGeneratedToForm(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                      >
                        <CheckSquare className="h-4 w-4" />
                        <span>{isEn ? "Save to Notebook" : "Inscrire directement au Cahier"}</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live PDF Preview & Export Modal for Parents */}
      <HomeworkPdfPreviewModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        homeworks={homeworks}
        filteredHomeworks={filteredHomeworks}
        activeStudent={activeStudent || undefined}
        settings={settings}
        language={language}
      />
    </div>
  );
}
