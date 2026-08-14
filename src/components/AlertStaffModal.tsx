import React, { useState, useEffect } from 'react';
import { Student, ApeeSettings, Message } from '../types';
import { 
  BellRing, 
  ShieldAlert, 
  Send, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Building, 
  Sparkles, 
  Radio, 
  Clock, 
  GraduationCap,
  MessageSquare,
  Check,
  Bus,
  HeartPulse,
  CalendarX,
  Car,
  Scale,
  BookOpen,
  FileText,
  PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../utils/TranslationContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface PredefinedAlertReason {
  id: string;
  emoji: string;
  icon: React.ElementType;
  labelFr: string;
  labelEn: string;
  subtitleFr: string;
  subtitleEn: string;
  defaultPriority: 'urgent' | 'normal';
  badgeColor: string;
  textFr: (studentName: string, classRoom: string) => string;
  textEn: (studentName: string, classRoom: string) => string;
}

export const PREDEFINED_ALERT_REASONS: PredefinedAlertReason[] = [
  {
    id: 'emergency',
    emoji: '🚨',
    icon: ShieldAlert,
    labelFr: 'Urgence Critique',
    labelEn: 'Critical Emergency',
    subtitleFr: 'Incident grave, accident ou situation requérant une intervention immédiate',
    subtitleEn: 'Severe incident, accident or immediate staff intervention required',
    defaultPriority: 'urgent',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    textFr: (name, cls) => `🚨 URGENCE CRITIQUE : Incident immédiat concernant l'élève ${name} (${cls}). Merci de contacter de toute urgence les parents / tuteurs et de prendre les mesures nécessaires sans délai.`,
    textEn: (name, cls) => `🚨 CRITICAL EMERGENCY: Urgent situation regarding student ${name} (${cls}). Please contact parents / guardians immediately and take necessary emergency actions.`
  },
  {
    id: 'health',
    emoji: '🏥',
    icon: HeartPulse,
    labelFr: 'Problème de Santé / Soins',
    labelEn: 'Health Issue / Medical',
    subtitleFr: 'Malaise, traitement médical, symptômes ou consigne de santé spécifique',
    subtitleEn: 'Illness, medication, symptoms or specific health instruction',
    defaultPriority: 'urgent',
    badgeColor: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    textFr: (name, cls) => `🏥 ALERTE SANTÉ : Consigne médicale ou problème de santé concernant l'élève ${name} (${cls}). Vigilance particulière et suivi requis par l'équipe éducative ce jour.`,
    textEn: (name, cls) => `🏥 HEALTH ALERT: Medical notice or health issue concerning student ${name} (${cls}). Special care and monitoring required by staff today.`
  },
  {
    id: 'bus_delay',
    emoji: '🚌',
    icon: Bus,
    labelFr: 'Retard de Bus / Transport',
    labelEn: 'Bus Delay / Transport',
    subtitleFr: 'Embouteillage, panne ou retard imprévu du ramassage scolaire',
    subtitleEn: 'Traffic congestion, breakdown or unforeseen school bus transport delay',
    defaultPriority: 'normal',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    textFr: (name, cls) => `🚌 RETARD TRANSPORT : En raison d'un retard imprévu de transport / bus scolaire, l'élève ${name} (${cls}) aura un retard à l'arrivée. Merci d'en informer la vie scolaire.`,
    textEn: (name, cls) => `🚌 TRANSPORT DELAY: Due to an unexpected bus/transport delay, student ${name} (${cls}) will arrive late this morning. Please inform the administration.`
  },
  {
    id: 'absence',
    emoji: '📅',
    icon: CalendarX,
    labelFr: 'Absence Exceptionnelle',
    labelEn: 'Unplanned Absence',
    subtitleFr: 'Absence pour motif familial, formalité ou imprévu de dernière minute',
    subtitleEn: 'Absence due to family reasons, official procedure or last-minute unforeseen event',
    defaultPriority: 'normal',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    textFr: (name, cls) => `📅 ABSENCE EXCEPTIONNELLE : L'élève ${name} (${cls}) sera exceptionnellement absent(e) ce jour. Les justificatifs nécessaires seront transmis à la rentrée.`,
    textEn: (name, cls) => `📅 UNPLANNED ABSENCE: Student ${name} (${cls}) will be absent today due to unforeseen circumstances. Supporting documents will be provided upon return.`
  },
  {
    id: 'early_pickup',
    emoji: '🚗',
    icon: Car,
    labelFr: 'Départ Anticipé',
    labelEn: 'Early Pickup',
    subtitleFr: 'Récupération de l\'élève avant la fin officielle des cours',
    subtitleEn: 'Student pickup scheduled prior to normal dismissal time',
    defaultPriority: 'normal',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    textFr: (name, cls) => `🚗 DÉPART ANTICIPÉ : L'élève ${name} (${cls}) devra être récupéré(e) par ses parents avant la fin des cours aujourd'hui pour motif impérieux.`,
    textEn: (name, cls) => `🚗 EARLY PICKUP: Student ${name} (${cls}) will be picked up early by parents before the end of the school day for an important appointment.`
  },
  {
    id: 'incident',
    emoji: '⚖️',
    icon: Scale,
    labelFr: 'Sécurité & Incident',
    labelEn: 'Safety & Incident Report',
    subtitleFr: 'Signalement relatif à la sécurité, altercation ou climat scolaire',
    subtitleEn: 'Report concerning safety, altercations or student well-being',
    defaultPriority: 'urgent',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    textFr: (name, cls) => `⚖️ SIGNALEMENT SÉCURITÉ : Signalement important concernant la sécurité et le bien-être de l'élève ${name} (${cls}). Demande de surveillance et retour de l'équipe éducative.`,
    textEn: (name, cls) => `⚖️ SAFETY REPORT: Important note regarding safety and well-being of student ${name} (${cls}). Increased vigilance requested from school staff.`
  },
  {
    id: 'academic',
    emoji: '📚',
    icon: BookOpen,
    labelFr: 'Suivi Scolaire Urgent',
    labelEn: 'Urgent Academic Follow-up',
    subtitleFr: 'Difficulté majeure, blocage pédagogique ou demande d\'entretien',
    subtitleEn: 'Major learning obstacle or request for an urgent meeting with teachers',
    defaultPriority: 'normal',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    textFr: (name, cls) => `📚 SUIVI SCOLAIRE : Demande d'échange rapide avec l'équipe pédagogique concernant le travail et les devoirs de l'élève ${name} (${cls}).`,
    textEn: (name, cls) => `📚 ACADEMIC FOLLOW-UP: Request for a quick discussion with teaching staff regarding coursework or assignments for student ${name} (${cls}).`
  },
  {
    id: 'other',
    emoji: '📝',
    icon: FileText,
    labelFr: 'Autre Motif Spécifique',
    labelEn: 'Other Specific Reason',
    subtitleFr: 'Autre communication ou consigne administrative pour l\'établissement',
    subtitleEn: 'Other administrative notice or custom communication for the school staff',
    defaultPriority: 'normal',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    textFr: (name, cls) => `📝 NOTIFICATION STAFF : Consigne particulière pour l'équipe éducative concernant l'élève ${name} (${cls}).`,
    textEn: (name, cls) => `📝 STAFF NOTICE: Specific instruction for educational staff regarding student ${name} (${cls}).`
  }
];

interface AlertStaffModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  settings?: ApeeSettings;
  onAddMessage?: (newMsg: Message) => void;
  portalUserRole?: string;
}

export default function AlertStaffModal({
  student,
  isOpen,
  onClose,
  settings,
  onAddMessage,
  portalUserRole = 'parent'
}: AlertStaffModalProps) {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  // Find class teacher info
  const foundTeacher = settings?.classTeachers?.find(t => {
    const classRoomName = (student.classRoom || '').toLowerCase();
    const tClassRoom = (t.classRoom || '').toLowerCase();
    return tClassRoom === classRoomName || 
           classRoomName.includes(tClassRoom) ||
           tClassRoom.includes(classRoomName);
  });

  const teacherName = foundTeacher?.teacherName || student.teacherName || (isFr ? 'Professeur Principal' : 'Head Teacher');

  // Modal State
  const [selectedReasonId, setSelectedReasonId] = useState<string>('emergency');
  const [targetRecipient, setTargetRecipient] = useState<'teacher' | 'admin' | 'all'>('all');
  const [priority, setPriority] = useState<'urgent' | 'normal'>('urgent');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const activeReason = PREDEFINED_ALERT_REASONS.find(r => r.id === selectedReasonId) || PREDEFINED_ALERT_REASONS[0];

  // Initialize or update pre-filled message when reason changes
  useEffect(() => {
    if (activeReason) {
      const cls = student.classRoom || student.grade || (isFr ? 'Classe' : 'Class');
      const generated = isFr ? activeReason.textFr(student.name, cls) : activeReason.textEn(student.name, cls);
      setCustomMessage(generated);
      setPriority(activeReason.defaultPriority);
    }
  }, [selectedReasonId, language, student.name, student.classRoom, student.grade]);

  if (!isOpen) return null;

  const handleSelectReason = (reasonId: string) => {
    setSelectedReasonId(reasonId);
    const found = PREDEFINED_ALERT_REASONS.find(r => r.id === reasonId);
    if (found) {
      const cls = student.classRoom || student.grade || (isFr ? 'Classe' : 'Class');
      const text = isFr ? found.textFr(student.name, cls) : found.textEn(student.name, cls);
      setCustomMessage(text);
      setPriority(found.defaultPriority);
    }
  };

  const handleSendAlert = async () => {
    if (!customMessage.trim()) return;
    setIsSending(true);

    const msgId = `msg_alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const recipientText = 
      targetRecipient === 'teacher' 
        ? `${teacherName}` 
        : targetRecipient === 'admin' 
        ? (isFr ? 'Vie Scolaire & Direction' : 'School Administration') 
        : (isFr ? `Staff Complet (${student.classRoom || 'Classe'})` : `All Staff (${student.classRoom || 'Class'})`);

    const reasonLabel = isFr ? activeReason.labelFr : activeReason.labelEn;
    const prefix = priority === 'urgent' 
      ? `🚨 [URGENT • ${reasonLabel.toUpperCase()}] ` 
      : `🔔 [STAFF • ${reasonLabel.toUpperCase()}] `;
    
    const newMsg: Message = {
      id: msgId,
      studentId: student.id,
      parentId: student.parentId || 'parent_user',
      senderType: portalUserRole === 'parent' ? 'Parent' : 'Teacher',
      content: `${prefix}${customMessage.trim()}`,
      timestamp: new Date().toISOString(),
      category: priority === 'urgent' ? 'Urgent' : 'General',
      teacherName: teacherName,
      senderRole: portalUserRole === 'parent' ? (isFr ? 'Parent / Tuteur' : 'Parent') : (isFr ? 'Vie Scolaire' : 'Staff'),
      recipientName: recipientText,
      recipientRole: isFr ? 'Staff Éducatif' : 'Educational Staff',
      isRead: false,
      ...({
        alertReasonId: activeReason.id,
        alertReasonLabel: reasonLabel,
        alertEmoji: activeReason.emoji
      } as any)
    };

    try {
      // Save locally & to Firestore
      await setDoc(doc(db, 'messages', msgId), newMsg).catch((err) => {
        console.warn("[AlertStaffModal] Firestore write warning (saved locally):", err);
      });

      if (onAddMessage) {
        onAddMessage(newMsg);
      }

      // Also trigger a system notification event
      window.dispatchEvent(new CustomEvent('pasma_staff_alert_sent', {
        detail: {
          studentName: student.name,
          classRoom: student.classRoom,
          recipient: recipientText,
          reasonId: activeReason.id,
          reasonLabel: reasonLabel,
          priority
        }
      }));

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2200);
    } catch (error) {
      console.error("[AlertStaffModal] Error sending alert:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999] overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header Bar with Gradient */}
          <div className="bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-600 p-5 text-white relative shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 bg-black/20 hover:bg-black/40 text-white rounded-full transition cursor-pointer"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shrink-0 shadow-inner">
                <BellRing className="h-6 w-6 text-amber-200 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block bg-white/20 text-white text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {isFr ? 'Notification au Personnel Éducatif' : 'Staff Alert Action'}
                  </span>
                  <span className="text-amber-300 font-mono text-xs font-bold">
                    • {student.classRoom || student.grade || 'Classe'}
                  </span>
                </div>
                <h3 className="text-lg font-black leading-tight text-white mt-1 flex items-center gap-2">
                  <span>{isFr ? 'Alerter le Staff' : 'Alert Class Staff'}</span>
                  <span className="text-sm font-semibold opacity-90">({student.name})</span>
                </h3>
                <p className="text-xs text-rose-100/90 mt-0.5">
                  {isFr 
                    ? `Sélectionnez un motif précis pour notifier instantanément l'équipe de ${student.name}` 
                    : `Select a specific reason to notify ${student.name}'s educational staff`}
                </p>
              </div>
            </div>
          </div>

          {/* Body Content */}
          {isSuccess ? (
            <div className="p-8 text-center space-y-4 animate-in zoom-in duration-300 my-auto">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <span>{activeReason.emoji}</span>
                  <span>{isFr ? activeReason.labelFr : activeReason.labelEn}</span>
                </div>
                <h4 className="text-lg font-extrabold text-slate-850 dark:text-white">
                  {isFr ? 'Alerte Transmise au Staff avec Succès !' : 'Staff Alert Dispatched Successfully!'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {isFr 
                    ? `Votre alerte concernant ${student.name} a été transmise aux destinataires sélectionnés et enregistrée dans le journal.`
                    : `Your notification regarding ${student.name} has been dispatched to selected staff members.`}
                </p>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  {isFr ? 'Diffusion temps réel effectuée' : 'Real-time broadcast completed'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-4.5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
              
              {/* Student Identity Pill */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-200/50 shrink-0">
                    {student.avatar && student.avatar.length <= 3 ? student.avatar : <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white leading-tight truncate">{student.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {isFr ? 'Professeur Référent :' : 'Main Teacher:'} {teacherName}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-[10.5px] font-extrabold px-2.5 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                    {student.classRoom || student.grade || 'CM2'}
                  </span>
                </div>
              </div>

              {/* Predefined Reason Selection Grid (The Core Feature) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>{isFr ? '1. Sélectionner un motif d\'alerte :' : '1. Select a Specific Reason:'}</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/40">
                    {PREDEFINED_ALERT_REASONS.length} {isFr ? 'motifs disponibles' : 'reasons'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PREDEFINED_ALERT_REASONS.map((r) => {
                    const isSelected = selectedReasonId === r.id;
                    const IconComp = r.icon;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectReason(r.id)}
                        className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 relative group ${
                          isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border-indigo-500 dark:border-indigo-400 shadow-md shadow-indigo-100/40 dark:shadow-none ring-2 ring-indigo-500/20'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 hover:bg-slate-50/80 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 group-hover:text-indigo-700'
                        }`}>
                          <IconComp className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={`text-xs font-black truncate flex items-center gap-1.5 ${
                              isSelected ? 'text-indigo-950 dark:text-white' : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              <span>{r.emoji}</span>
                              <span className="truncate">{isFr ? r.labelFr : r.labelEn}</span>
                            </h4>
                            {isSelected && (
                              <span className="shrink-0 text-indigo-600 dark:text-indigo-400">
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] line-clamp-1 mt-0.5 leading-tight ${
                            isSelected ? 'text-indigo-900/80 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {isFr ? r.subtitleFr : r.subtitleEn}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Recipient & Priority Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                
                {/* Target Recipient */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFr ? '2. Destinataire :' : '2. Target Staff:'}</span>
                  </label>
                  
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setTargetRecipient('teacher')}
                      className={`p-2 rounded-xl border transition text-center cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        targetRecipient === 'teacher'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-[10.5px] font-bold truncate max-w-full">
                        {isFr ? 'Prof Principal' : 'Teacher'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetRecipient('admin')}
                      className={`p-2 rounded-xl border transition text-center cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        targetRecipient === 'admin'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-[10.5px] font-bold truncate max-w-full">
                        {isFr ? 'Vie Scolaire' : 'Admin'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetRecipient('all')}
                      className={`p-2 rounded-xl border transition text-center cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        targetRecipient === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-[10.5px] font-bold truncate max-w-full">
                        {isFr ? 'Tout le Staff' : 'All Staff'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Priority Level */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span>{isFr ? '3. Niveau d\'Urgence :' : '3. Priority Level:'}</span>
                  </label>

                  <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPriority('urgent')}
                      className={`p-2 rounded-xl border transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                        priority === 'urgent'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-black'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>🔴</span>
                      <span className="text-[11px]">{isFr ? 'Urgent / Prioritaire' : 'Urgent / High'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPriority('normal')}
                      className={`p-2 rounded-xl border transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                        priority === 'normal'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs font-black'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>🟠</span>
                      <span className="text-[11px]">{isFr ? 'Normal / Informatif' : 'Normal / Info'}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Custom / Editable Message Area */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFr ? '4. Message & Précisions pour le Staff :' : '4. Alert Message & Details:'}</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                    {customMessage.length} / 400
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  maxLength={400}
                  placeholder={isFr ? "Personnalisez ou ajoutez des détails pour l'équipe éducative..." : "Customize or add specific details for the staff..."}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans text-slate-850 dark:text-white resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 leading-relaxed shadow-inner"
                />

                <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                  {isFr 
                    ? `💡 Astuce : Le message est prérempli selon le motif sélectionné ("${activeReason.labelFr}"), mais vous pouvez le modifier librement.`
                    : `💡 Tip: The message is pre-formatted for "${activeReason.labelEn}", but you can edit it freely.`}
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSending}
                  className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {isFr ? 'Annuler' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSendAlert}
                  disabled={isSending || !customMessage.trim()}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white shadow-md hover:shadow-lg disabled:opacity-50 transition cursor-pointer flex items-center gap-2 active:scale-97"
                >
                  {isSending ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>
                    {isSending 
                      ? (isFr ? 'Envoi en cours...' : 'Sending...') 
                      : (isFr ? 'Transmettre l\'Alerte au Staff' : 'Send Staff Alert')}
                  </span>
                </button>
              </div>

            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

