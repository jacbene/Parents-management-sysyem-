import React, { useState, useEffect, useMemo } from 'react';
import { Homework, Student, HomeworkStatus, ApeeSettings } from '../types';
import { BookOpen, CheckCircle, Circle, Clock, CheckCircle2, AlertCircle, Plus, Trash2, Lock, Unlock, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

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
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Add Homework states
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const handleQuickAction = (e: any) => {
      if (e.detail?.actionKey === 'add_homework') {
        setShowAddForm(true);
      }
    };
    window.addEventListener('pasma_trigger_quick_action', handleQuickAction);
    return () => window.removeEventListener('pasma_trigger_quick_action', handleQuickAction);
  }, []);
  const [subject, setSubject] = useState('Mathématiques');
  const [customSubject, setCustomSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [hwGradeValue, setHwGradeValue] = useState('');

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

  // Filter homeworks
  const filteredHomeworks = homeworks.filter(hw => {
    if (activeTab === 'pending') return hw.status === 'Pending';
    if (activeTab === 'completed') return hw.status === 'Completed';
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
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) {
      alert('Veuillez sélectionner un élève avant de pouvoir introduire des devoirs.');
      return;
    }
    if (!title.trim()) {
      alert('Veuillez spécifier le titre du travail exigé.');
      return;
    }

    if (onAddHomework) {
      const targetSubj = (subject === 'Autre' || subject === '__custom__') ? (customSubject.trim() || 'Autre') : subject;
      const newHw: Homework = {
        id: 'hw_' + Date.now(),
        studentId: activeStudent.id,
        parentId: activeStudent.parentId,
        subject: targetSubj,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        status: 'Pending',
        grade: hwGradeValue.trim() || undefined
      };

      const success = await onAddHomework(newHw);
      if (success) {
        setTitle('');
        setDescription('');
        setHwGradeValue('');
        setShowAddForm(false);
      }
    }
  };

  const handleDelete = async (id: string, hwTitle: string) => {
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    const confirm = window.confirm(`Voulez-vous supprimer ce devoir "${hwTitle}" du cahier de textes ?`);
    if (confirm && onDeleteHomework) {
      await onDeleteHomework(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            Cahier de Textes & Devoirs
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Suivi des devoirs maison à faire, dates de rendu et validation en ligne par les parents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Action Trigger */}
          <button
            onClick={handleOpenForm}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" /> Ajouter un Devoir
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
                  📚 Enregistrer un nouveau devoir pour {activeStudent.name} ({activeStudent.grade || 'Classe'})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold uppercase transition cursor-pointer"
                >
                  Annuler
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Matière / Discipline <span className="text-red-500">*</span></label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-850"
                  >
                    {configuredSubjectsList.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__custom__">✏️ Autre matière sur-mesure...</option>
                  </select>
                  {(subject === '__custom__' || subject === 'Autre') && (
                    <input
                      type="text"
                      placeholder="Saisir la matière..."
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      className="w-full mt-1.5 px-2.5 py-1 text-xs border border-indigo-200 rounded-md focus:outline-indigo-500 bg-white"
                    />
                  )}
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Intitulé du Travail exigé <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Devoir de mathématiques à rendre sur feuille double"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Date limite de rendu <span className="text-red-500">*</span></label>
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
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Consignes / Exercices à faire</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Exercices 4, 5 et 9 p. 234. Faire attention au schéma récapitulatif."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Note indicative (Pondération)</label>
                  <input
                    type="text"
                    value={hwGradeValue}
                    onChange={(e) => setHwGradeValue(e.target.value)}
                    placeholder="Ex: Note coef. 2 — /20"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-250 bg-white text-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-50 cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer text-center shadow-xs"
                >
                  <CheckSquare className="h-4 w-4" /> Enregistrer Devoir
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtering list & layout */}
      <div className="flex justify-end">
        <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Tous ({homeworks.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            À Faire ({homeworks.filter(h => h.status === 'Pending').length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'completed'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Terminés ({homeworks.filter(h => h.status === 'Completed').length})
          </button>
        </div>
      </div>

      {filteredHomeworks.length === 0 ? (
        <div className="text-center p-12 bg-gray-50/50 rounded-2xl border border-gray-100 select-none">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Parfait ! Aucun devoir en attente pour cette sélection.</p>
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
                      {hw.grade && (
                        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md">
                          Note / Éval : {hw.grade}
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> En retard !
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

                    <div className="pt-2 flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Rendu exigé le {new Date(hw.dueDate).toLocaleDateString('fr-FR', { weekday: 'short', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Delete button option */}
                  {onDeleteHomework && (
                    <button
                      type="button"
                      onClick={() => handleDelete(hw.id, hw.title)}
                      className={`text-red-600 hover:text-red-850 p-1.5 bg-red-100/10 hover:bg-red-200/20 border border-transparent hover:border-red-500/10 rounded-xl transition duration-200 shrink-0 self-center cursor-pointer ${
                        isPedAuthorized || isCustom ? 'opacity-100' : 'opacity-40 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      }`}
                      title="Supprimer ce devoir"
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
    </div>
  );
}
