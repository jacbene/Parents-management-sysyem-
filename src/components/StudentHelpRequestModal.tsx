import React, { useState } from 'react';
import { Student } from '../types';
import { 
  LifeBuoy, 
  X, 
  Check, 
  CheckCircle2, 
  BookOpen, 
  FileText, 
  Target, 
  HeartPulse, 
  MessageSquare, 
  Clock, 
  User, 
  AlertCircle, 
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../utils/TranslationContext';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface StudentHelpRequestModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStudent?: (updated: Student) => void;
  portalUserRole?: 'manager' | 'parent' | 'teacher' | string | null;
  teacherName?: string;
}

export const HELP_REASONS = [
  {
    id: 'comprehension' as const,
    labelFr: 'Compréhension du cours',
    labelEn: 'Lesson Comprehension',
    descFr: 'Difficultés à assimiler les notions enseignées en classe',
    descEn: 'Struggling with topics taught recently in class',
    icon: BookOpen,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    defaultNoteFr: "L'élève a des difficultés de compréhension sur les leçons récentes et sollicite un éclaircissement ou des explications complémentaires de l'enseignant.",
    defaultNoteEn: "The student is struggling to understand recent lesson concepts and requests additional clarification from the teacher."
  },
  {
    id: 'homework' as const,
    labelFr: 'Devoirs & Exercices',
    labelEn: 'Homework & Exercises',
    descFr: 'Blocage sur des exercices ou consignes de travail à la maison',
    descEn: 'Blocked on homework exercises or instructions',
    icon: FileText,
    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    defaultNoteFr: "L'élève rencontre des difficultés pour réaliser les devoirs à la maison et a besoin de consignes adaptées ou d'un coup de pouce.",
    defaultNoteEn: "The student is having trouble completing home assignments and needs guided assistance."
  },
  {
    id: 'behavior' as const,
    labelFr: 'Méthodologie & Concentration',
    labelEn: 'Methodology & Focus',
    descFr: 'Besoin de soutien sur l\'organisation, la méthode de travail ou l\'attention',
    descEn: 'Need guidance on study methodology, organization, or attention',
    icon: Target,
    color: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    defaultNoteFr: "Besoin de conseils méthodologiques et de suivi personnalisé pour optimiser les révisions et la concentration en classe.",
    defaultNoteEn: "Guidance and focus support requested to improve study methodology and revision habits."
  },
  {
    id: 'health' as const,
    labelFr: 'Santé, Fatigue & Bien-être',
    labelEn: 'Health & Well-being',
    descFr: 'Baisse d\'énergie, convalescence ou besoin d\'une attention particulière',
    descEn: 'Fatigue, recovering from illness, or needing special classroom care',
    icon: HeartPulse,
    color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    defaultNoteFr: "L'élève traverse une période de fatigue ou de convalescence nécessitant de la bienveillance et un rythme adapté en cours.",
    defaultNoteEn: "The student is experiencing fatigue or convalescence requiring attentive classroom care."
  },
  {
    id: 'general' as const,
    labelFr: 'Autre besoin spécifique',
    labelEn: 'Other Specific Need',
    descFr: 'Demande particulière ou message libre pour le corps enseignant',
    descEn: 'Custom inquiry or specific request for staff',
    icon: MessageSquare,
    color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    defaultNoteFr: "Demande d'assistance pédagogique personnalisée pour accompagner au mieux la progression de l'élève.",
    defaultNoteEn: "Custom educational assistance request to support student progression."
  }
];

export default function StudentHelpRequestModal({
  student,
  isOpen,
  onClose,
  onUpdateStudent,
  portalUserRole,
  teacherName = 'Enseignant'
}: StudentHelpRequestModalProps) {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const isStaff = portalUserRole === 'teacher' || portalUserRole === 'manager' || portalUserRole === 'admin';
  const isHelpActive = !!student.helpRequested;

  const [selectedReason, setSelectedReason] = useState<'comprehension' | 'homework' | 'behavior' | 'health' | 'general'>(
    student.helpRequestReason || 'comprehension'
  );
  const [note, setNote] = useState<string>(
    student.helpRequestNote || HELP_REASONS.find(r => r.id === (student.helpRequestReason || 'comprehension'))?.[isFr ? 'defaultNoteFr' : 'defaultNoteEn'] || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successAction, setSuccessAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectReason = (reasonId: 'comprehension' | 'homework' | 'behavior' | 'health' | 'general') => {
    setSelectedReason(reasonId);
    const found = HELP_REASONS.find(r => r.id === reasonId);
    if (found && (!note || HELP_REASONS.some(r => r.defaultNoteFr === note || r.defaultNoteEn === note))) {
      setNote(isFr ? found.defaultNoteFr : found.defaultNoteEn);
    }
  };

  const handleActivateHelp = async () => {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const updated: Student = {
      ...student,
      helpRequested: true,
      helpRequestedAt: now,
      helpRequestReason: selectedReason,
      helpRequestNote: note.trim() || undefined,
      helpAcknowledgedBy: undefined,
      helpAcknowledgedAt: undefined,
    };

    try {
      await setDoc(doc(db, 'students', student.id), {
        helpRequested: true,
        helpRequestedAt: now,
        helpRequestReason: selectedReason,
        helpRequestNote: note.trim() || null,
        helpAcknowledgedBy: null,
        helpAcknowledgedAt: null,
      }, { merge: true });

      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setSuccessAction('activated');
      setTimeout(() => {
        onClose();
        setSuccessAction(null);
      }, 1400);
    } catch (err) {
      console.warn("Error saving help request to Firestore, updating local state:", err);
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setSuccessAction('activated');
      setTimeout(() => {
        onClose();
        setSuccessAction(null);
      }, 1400);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledgeHelp = async () => {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const acknowledgedByName = teacherName || (isStaff ? 'Staff Enseignant' : 'Direction');
    const updated: Student = {
      ...student,
      helpRequested: false,
      helpAcknowledgedBy: acknowledgedByName,
      helpAcknowledgedAt: now,
    };

    try {
      await setDoc(doc(db, 'students', student.id), {
        helpRequested: false,
        helpAcknowledgedBy: acknowledgedByName,
        helpAcknowledgedAt: now,
      }, { merge: true });

      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setSuccessAction('acknowledged');
      setTimeout(() => {
        onClose();
        setSuccessAction(null);
      }, 1400);
    } catch (err) {
      console.warn("Error acknowledging help request in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setSuccessAction('acknowledged');
      setTimeout(() => {
        onClose();
        setSuccessAction(null);
      }, 1400);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelHelp = async () => {
    if (!confirm(isFr ? "Voulez-vous retirer cette demande d'assistance ?" : "Do you want to cancel this help request?")) {
      return;
    }
    setIsSubmitting(true);
    const updated: Student = {
      ...student,
      helpRequested: false,
      helpRequestedAt: undefined,
      helpRequestReason: undefined,
      helpRequestNote: undefined,
    };

    try {
      await setDoc(doc(db, 'students', student.id), {
        helpRequested: false,
        helpRequestedAt: null,
        helpRequestReason: null,
        helpRequestNote: null,
      }, { merge: true });

      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setSuccessAction('cancelled');
      setTimeout(() => {
        onClose();
        setSuccessAction(null);
      }, 1200);
    } catch (err) {
      console.warn("Error cancelling help request:", err);
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setSuccessAction('cancelled');
      setTimeout(() => {
        onClose();
        setSuccessAction(null);
      }, 1200);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeReasonObj = HELP_REASONS.find(r => r.id === (student.helpRequestReason || selectedReason));

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className={`p-5 text-white flex items-center justify-between ${
            isHelpActive 
              ? 'bg-gradient-to-r from-rose-600 via-amber-600 to-rose-700' 
              : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 text-white shrink-0">
                <LifeBuoy className={`h-6 w-6 ${isHelpActive ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
              </div>
              <div>
                <h3 className="text-base font-black flex items-center gap-2 font-sans leading-tight">
                  <span>{isFr ? "Besoin d'Aide & Assistance" : "Need Help & Assistance"}</span>
                  {isHelpActive && (
                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-white/20 border border-white/30 text-white animate-pulse">
                      {isFr ? "Actif" : "Active"}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-white/85 font-sans mt-0.5">
                  {student.name} • {student.classRoom || student.grade || (isFr ? "Classe" : "Class")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/25 text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-800 dark:text-slate-200 text-xs">
            {successAction ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center space-y-3"
              >
                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-8 w-8 animate-bounce" />
                </div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  {successAction === 'activated' && (isFr ? "Demande d'assistance transmise !" : "Help request activated!")}
                  {successAction === 'acknowledged' && (isFr ? "Lecture confirmée avec succès !" : "Read acknowledged successfully!")}
                  {successAction === 'cancelled' && (isFr ? "Demande d'assistance retirée." : "Help request cancelled.")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {successAction === 'activated' && (isFr 
                    ? `La fiche de ${student.name} est maintenant mise en surbrillance avec le badge 'Assistance demandée' dans la vue enseignant.` 
                    : `The profile of ${student.name} is now highlighted with the 'Help Requested' badge in the teacher view.`)}
                  {successAction === 'acknowledged' && (isFr 
                    ? `La demande d'aide a été marquée comme prise en charge par ${teacherName}. La surbrillance a été désactivée.` 
                    : `The help request has been marked as acknowledged by ${teacherName}. The highlight is cleared.`)}
                  {successAction === 'cancelled' && (isFr 
                    ? `La demande d'aide a été retirée et la surbrillance effacée.` 
                    : `The help request was removed.`)}
                </p>
              </motion.div>
            ) : isHelpActive ? (
              /* When Help is Currently Active */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                      <LifeBuoy className="h-3 w-3 animate-spin" style={{ animationDuration: '6s' }} />
                      <span>{isFr ? "Assistance demandée" : "Help Requested"}</span>
                    </span>
                    {student.helpRequestedAt && (
                      <span className="text-[10.5px] font-mono text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(student.helpRequestedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="font-extrabold text-sm text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                      {activeReasonObj && React.createElement(activeReasonObj.icon, { className: "h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" })}
                      <span>{activeReasonObj ? (isFr ? activeReasonObj.labelFr : activeReasonObj.labelEn) : (isFr ? "Assistance générale" : "General Help")}</span>
                    </p>
                    {student.helpRequestNote ? (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200/80 dark:border-rose-900/60 text-xs italic text-slate-800 dark:text-slate-200 leading-relaxed">
                        "{student.helpRequestNote}"
                      </div>
                    ) : (
                      <p className="text-xs text-rose-700 dark:text-rose-300 italic">
                        {isFr ? "Aucune note additionnelle n'a été spécifiée." : "No additional note specified."}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/50 flex items-center justify-between text-[11px] text-rose-800 dark:text-rose-300">
                    <span className="font-bold">
                      {isFr ? "Statut : En attente de confirmation de lecture par l'équipe pédagogique" : "Status: Waiting for staff read confirmation"}
                    </span>
                  </div>
                </div>

                {/* Staff action: Confirm read / Acknowledge */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/15 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {isFr ? "Prise en charge & Confirmation de lecture" : "Staff Read & Acknowledgment"}
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        {isFr 
                          ? "Dès qu'un membre du corps enseignant ou administratif confirme la lecture, la surbrillance de l'élève est levée." 
                          : "Once a staff member confirms reading, the card highlight will be cleared."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleAcknowledgeHelp}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      <span>{isFr ? "Confirmer la lecture (Pris en charge)" : "Confirm Read (Handled)"}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleCancelHelp}
                      className="py-2.5 px-3 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      title={isFr ? "Retirer la demande d'aide" : "Cancel help request"}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isFr ? "Retirer" : "Cancel"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* When Help is Inactive: Configuration Form */
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
                    {isFr 
                      ? "En activant cette demande, la fiche de l'élève sera immédiatement mise en surbrillance avec le badge 'Assistance demandée' dans la vue de l'enseignant jusqu'à ce qu'un membre du staff confirme la lecture."
                      : "Activating this request will immediately highlight the student's profile with the 'Help Requested' badge in the teacher view until a staff member confirms reading."}
                  </p>
                </div>

                {/* Predefined Reasons Selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    {isFr ? "Motif principal de l'assistance :" : "Primary Assistance Reason:"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {HELP_REASONS.map(reason => {
                      const isSelected = selectedReason === reason.id;
                      const IconComp = reason.icon;
                      return (
                        <button
                          key={reason.id}
                          type="button"
                          onClick={() => handleSelectReason(reason.id)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <div className={`p-1 rounded-lg ${isSelected ? 'bg-white/20 text-white' : reason.color}`}>
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                              <span className="truncate">{isFr ? reason.labelFr : reason.labelEn}</span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0" />}
                          </div>
                          <p className={`text-[10px] leading-tight line-clamp-2 ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                            {isFr ? reason.descFr : reason.descEn}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Note Textarea */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>{isFr ? "Précisions ou consignes pour l'enseignant :" : "Instructions / details for teacher:"}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({note.length}/300)</span>
                  </label>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={isFr ? "Expliquez brièvement le blocage ou la difficulté rencontrée..." : "Briefly describe the topic or assistance needed..."}
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Action Submit */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-150 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    {isFr ? "Annuler" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleActivateHelp}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-xs shadow-md shadow-rose-200 dark:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    <LifeBuoy className="h-4 w-4" />
                    <span>{isFr ? "Activer la demande d'aide" : "Activate Help Request"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
