import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  Share2, 
  Phone, 
  Award, 
  Calendar, 
  GraduationCap, 
  User, 
  Clock, 
  Sparkles, 
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { Student, Grade, Attendance } from '../types';
import { useLanguage } from '../utils/TranslationContext';

interface StudentWhatsAppShareModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  parentPhone?: string;
  parentName?: string;
  grades?: Grade[];
  attendanceLogs?: Attendance[];
  teacherName?: string;
  schoolName?: string;
  targetGoal?: number;
}

export type ShareReportType = 'grades' | 'attendance' | 'complete';

export default function StudentWhatsAppShareModal({
  student,
  isOpen,
  onClose,
  parentPhone = '',
  parentName = '',
  grades = [],
  attendanceLogs = [],
  teacherName = 'Enseignant principal',
  schoolName = 'Complexe Scolaire Ekali Pasma',
  targetGoal
}: StudentWhatsAppShareModalProps) {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const [reportType, setReportType] = useState<ShareReportType>('grades');
  const [recipientPhone, setRecipientPhone] = useState<string>(() => parentPhone || '');
  const [customNote, setCustomNote] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Update phone if prop changes and local state is empty
  React.useEffect(() => {
    if (parentPhone && !recipientPhone) {
      setRecipientPhone(parentPhone);
    }
  }, [parentPhone]);

  // Compute student grades stats
  const studentGrades = useMemo(() => {
    return (grades || []).filter(g => g.studentId === student.id);
  }, [grades, student.id]);

  const overallAvg = useMemo(() => {
    if (studentGrades.length === 0) return 0;
    const sum = studentGrades.reduce((acc, g) => acc + ((g.score / g.maxScore) * 20), 0);
    return Number((sum / studentGrades.length).toFixed(1));
  }, [studentGrades]);

  const last5Grades = useMemo(() => {
    const sorted = [...studentGrades].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (isNaN(timeA) || isNaN(timeB)) return 0;
      return timeA - timeB;
    });
    return sorted.slice(-5);
  }, [studentGrades]);

  const last5Avg = useMemo(() => {
    if (last5Grades.length === 0) return 0;
    const sum = last5Grades.reduce((acc, g) => acc + ((g.score / g.maxScore) * 20), 0);
    return Number((sum / last5Grades.length).toFixed(1));
  }, [last5Grades]);

  const { bestSubject, worstSubject } = useMemo(() => {
    const subjectMap: { [key: string]: { sum: number; count: number } } = {};
    studentGrades.forEach(g => {
      const on20 = (g.score / g.maxScore) * 20;
      if (!subjectMap[g.subject]) {
        subjectMap[g.subject] = { sum: 0, count: 0 };
      }
      subjectMap[g.subject].sum += on20;
      subjectMap[g.subject].count += 1;
    });

    const list = Object.keys(subjectMap).map(subj => ({
      subject: subj,
      avg: Number((subjectMap[subj].sum / subjectMap[subj].count).toFixed(1))
    }));

    if (list.length === 0) {
      return { bestSubject: null, worstSubject: null };
    }

    list.sort((a, b) => b.avg - a.avg);
    return {
      bestSubject: list[0],
      worstSubject: list.length > 1 ? list[list.length - 1] : null
    };
  }, [studentGrades]);

  // Compute student attendance stats
  const studentAttendance = useMemo(() => {
    return (attendanceLogs || []).filter(a => a.studentId === student.id);
  }, [attendanceLogs, student.id]);

  const totalLogs = studentAttendance.length;
  const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
  const lateCount = studentAttendance.filter(a => a.status === 'Late').length;
  const absentCount = studentAttendance.filter(a => a.status === 'Absent').length;
  const excusedCount = studentAttendance.filter(a => a.status === 'Excused').length;
  const presenceRate = totalLogs > 0
    ? (((presentCount + excusedCount) / totalLogs) * 100).toFixed(1)
    : '100.0';

  const recentAbsencesOrLates = useMemo(() => {
    const incidents = studentAttendance.filter(a => a.status === 'Absent' || a.status === 'Late');
    return incidents.slice(-3);
  }, [studentAttendance]);

  // Normalization for WhatsApp Phone Link
  const cleanPhoneForWhatsApp = (raw: string): string => {
    if (!raw) return '';
    let digits = raw.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) {
      digits = digits.substring(1);
    } else if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('2'))) {
      // Default to Cameroon country code 237 if standard 9-digit local phone
      digits = `237${digits}`;
    }
    return digits;
  };

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [isFr]);

  // Generate formatted WhatsApp text based on selected report type
  const generatedMessage = useMemo(() => {
    const studentInfo = `👤 *${student.name}*\n📚 Classe : *${student.classRoom || student.grade || 'N/A'}*`;
    const schoolHeader = `🏫 *${schoolName}* (PASMA-SYS)\n${studentInfo}`;

    if (reportType === 'grades') {
      let gradesLines = '';
      if (last5Grades.length > 0) {
        gradesLines = last5Grades.map(g => {
          const on20 = ((g.score / g.maxScore) * 20).toFixed(1);
          return `• ${g.subject} (${g.examName || 'Éval'}) : *${g.score}/${g.maxScore}* (${on20}/20)`;
        }).join('\n');
      } else {
        gradesLines = isFr ? '• Aucune évaluation récente enregistrée.' : '• No recent assessments recorded.';
      }

      const strengthBlock = bestSubject 
        ? `\n🌟 *Points clés* :\n• Point fort : *${bestSubject.subject}* (${bestSubject.avg}/20)${worstSubject ? `\n• À soutenir : *${worstSubject.subject}* (${worstSubject.avg}/20)` : ''}`
        : '';

      const targetBlock = targetGoal 
        ? `\n🎯 Objectif Cible : *${targetGoal}/20* (Moyenne : *${overallAvg}/20*)` 
        : '';

      const noteBlock = customNote.trim()
        ? `\n\n💬 *Observation de l'enseignant / vie scolaire* :\n"${customNote.trim()}"`
        : '';

      return isFr
        ? `🎓 *BULLETIN DES NOTES & ÉVALUATIONS*\n${schoolHeader}\n👨‍🏫 Enseignant : ${teacherName}\n────────────────────────\n📊 *Moyenne Générale* : *${overallAvg}/20*\n📈 *Tendance (5 Dernières)* : *${last5Avg}/20*${targetBlock}${strengthBlock}\n\n📝 *Dernières Évaluations* :\n${gradesLines}${noteBlock}\n\n📅 Transmis le ${currentDateFormatted}\n🔗 Espace ENT : https://pasma.sys/ent`
        : `🎓 *ACADEMIC GRADES & PROGRESS REPORT*\n${schoolHeader}\n👨‍🏫 Teacher: ${teacherName}\n────────────────────────\n📊 *Overall Average*: *${overallAvg}/20*\n📈 *Trend (Last 5)*: *${last5Avg}/20*${targetBlock}${strengthBlock}\n\n📝 *Recent Assessments*:\n${gradesLines}${noteBlock}\n\n📅 Sent on ${currentDateFormatted}\n🔗 School Portal: https://pasma.sys/ent`;
    }

    if (reportType === 'attendance') {
      let incidentLines = '';
      if (recentAbsencesOrLates.length > 0) {
        incidentLines = `\n\n⚠️ *Derniers signalements d'absence/retard* :\n` + recentAbsencesOrLates.map(inc => {
          const dStr = inc.date ? new Date(inc.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : 'N/A';
          const typeLabel = inc.status === 'Late' ? 'Retard' : 'Absence';
          return `• ${dStr} - *${typeLabel}*${inc.remarks ? ` (${inc.remarks})` : ''}`;
        }).join('\n');
      }

      const noteBlock = customNote.trim()
        ? `\n\n💬 *Observation de la vie scolaire* :\n"${customNote.trim()}"`
        : '';

      return isFr
        ? `⏱️ *RELEVÉ OFFICIEL D'ASSIDUITÉ & PRÉSENCES*\n${schoolHeader}\n────────────────────────\n📋 *Taux d'assiduité* : *${presenceRate}%*\n📅 Séances comptabilisées : *${totalLogs}*\n\n✅ Présences : *${presentCount}*\n⏳ Retards constatés : *${lateCount}*\n❌ Absences non justifiées : *${absentCount}*\n📝 Absences excusées : *${excusedCount}*${incidentLines}${noteBlock}\n\n💬 _Rappel : Toute absence doit être motivée auprès de l'établissement ou régularisée via l'espace ENT._\n📅 Transmis le ${currentDateFormatted}\n🔗 Espace ENT : https://pasma.sys/ent`
        : `⏱️ *OFFICIAL ATTENDANCE REPORT*\n${schoolHeader}\n────────────────────────\n📋 *Attendance Rate*: *${presenceRate}%*\n📅 Total Sessions Logged: *${totalLogs}*\n\n✅ Present: *${presentCount}*\n⏳ Late arrivals: *${lateCount}*\n❌ Unexcused Absences: *${absentCount}*\n📝 Excused: *${excusedCount}*${incidentLines}${noteBlock}\n\n💬 _Reminder: Please provide justification for any absence via the school portal._\n📅 Sent on ${currentDateFormatted}\n🔗 School Portal: https://pasma.sys/ent`;
    }

    // Complete Report (Both grades and attendance)
    const recentGradesStr = last5Grades.length > 0
      ? last5Grades.slice(-3).map(g => `${g.subject}: ${g.score}/${g.maxScore}`).join(' | ')
      : 'Aucune récente';

    const noteBlock = customNote.trim()
      ? `\n\n💬 *Message de l'établissement* :\n"${customNote.trim()}"`
      : '';

    return isFr
      ? `🎓 *BILAN SCOLAIRE COMPLET (NOTES & ASSIDUITÉ)*\n${schoolHeader}\n👨‍👩‍👦 Destinataire : *${parentName || 'Parent d\'élève'}*\n────────────────────────\n📊 *RÉSULTATS ACADÉMIQUES*\n• Moyenne générale : *${overallAvg}/20*\n• Tendance récente : *${last5Avg}/20*\n${bestSubject ? `• Matière forte : *${bestSubject.subject}* (${bestSubject.avg}/20)\n` : ''}${worstSubject ? `• Matière à renforcer : *${worstSubject.subject}* (${worstSubject.avg}/20)\n` : ''}• Dernières notes : ${recentGradesStr}\n\n⏱️ *ASSIDUITÉ & DISCIPLINE*\n• Taux de présence : *${presenceRate}%* (${presentCount} Présences, ${lateCount} Retards, ${absentCount} Absences)${noteBlock}\n\n📅 Édité le ${currentDateFormatted} • Complexe Scolaire Ekali Pasma\n🔗 Accès ENT : https://pasma.sys/ent`
      : `🎓 *FULL STUDENT PROGRESS REPORT (GRADES & ATTENDANCE)*\n${schoolHeader}\n👨‍👩‍👦 Recipient: *${parentName || 'Parent / Guardian'}*\n────────────────────────\n📊 *ACADEMIC STANDING*\n• Overall Average: *${overallAvg}/20*\n• Recent Trend: *${last5Avg}/20*\n${bestSubject ? `• Strong subject: *${bestSubject.subject}* (${bestSubject.avg}/20)\n` : ''}${worstSubject ? `• Needs focus: *${worstSubject.subject}* (${worstSubject.avg}/20)\n` : ''}• Recent grades: ${recentGradesStr}\n\n⏱️ *ATTENDANCE STATUS*\n• Attendance Rate: *${presenceRate}%* (${presentCount} Present, ${lateCount} Late, ${absentCount} Absent)${noteBlock}\n\n📅 Generated on ${currentDateFormatted} • Ekali Pasma School\n🔗 School Portal: https://pasma.sys/ent`;
  }, [
    reportType, 
    student, 
    schoolName, 
    teacherName, 
    parentName, 
    overallAvg, 
    last5Avg, 
    last5Grades, 
    bestSubject, 
    worstSubject, 
    targetGoal, 
    presenceRate, 
    totalLogs, 
    presentCount, 
    lateCount, 
    absentCount, 
    excusedCount, 
    recentAbsencesOrLates, 
    customNote, 
    currentDateFormatted, 
    isFr
  ]);

  const handleOpenWhatsApp = () => {
    const cleanPhone = cleanPhoneForWhatsApp(recipientPhone);
    const encodedText = encodeURIComponent(generatedMessage);
    
    // If a phone is available, open direct chat. Otherwise open WhatsApp text composer.
    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy WhatsApp message to clipboard:', err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `Bilan scolaire - ${student.name}`,
          text: generatedMessage
        });
      } catch (err) {
        console.warn('Native share dismissed or not supported:', err);
      }
    } else {
      handleCopyMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl border border-gray-150 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 border border-white/30 shadow-inner">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{isFr ? 'Partager via WhatsApp' : 'Share via WhatsApp'}</span>
                  <span className="text-[10px] bg-white/20 text-white font-mono font-bold px-2 py-0.5 rounded-full border border-white/25">
                    Parent ENT
                  </span>
                </h3>
                <p className="text-xs text-emerald-100 font-medium">
                  {student.name} • {student.classRoom || student.grade}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title={isFr ? 'Fermer' : 'Close'}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
            
            {/* Linked Parent Information & Destination Phone Field */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {isFr ? 'Parent / Tuteur lié :' : 'Linked Parent / Guardian:'}{' '}
                    <strong className="font-extrabold text-emerald-950 dark:text-white">
                      {parentName || (isFr ? 'Non spécifié' : 'Not specified')}
                    </strong>
                  </span>
                </div>
                {parentPhone && (
                  <span className="text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    {isFr ? 'Numéro enregistré' : 'Registered phone'}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{isFr ? 'Numéro de téléphone WhatsApp du destinataire :' : 'Recipient WhatsApp Phone Number:'}</span>
                  </span>
                  {!recipientPhone.trim() && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                      <AlertCircle className="h-3 w-3" />
                      {isFr ? 'À renseigner' : 'Required for direct open'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="Ex: +237 677 11 22 33 ou 699445566"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white shadow-2xs"
                  />
                  {parentPhone && recipientPhone !== parentPhone && (
                    <button
                      type="button"
                      onClick={() => setRecipientPhone(parentPhone)}
                      className="absolute right-2 top-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer bg-emerald-50 dark:bg-slate-700 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-slate-600"
                    >
                      {isFr ? 'Réinitialiser' : 'Reset'}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                  {isFr 
                    ? "Le numéro est automatiquement pré-rempli avec les coordonnées du parent de l'élève." 
                    : "Phone number is automatically pre-filled from the student's linked parent file."}
                </p>
              </div>
            </div>

            {/* Mode Selection Tabs (Grades vs Attendance vs Full) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                {isFr ? 'Choisir le type de rapport à transmettre :' : 'Select report to share:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReportType('grades')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    reportType === 'grades'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Award className="h-4 w-4" />
                  <span>{isFr ? 'Notes & Évals' : 'Grades & Evals'}</span>
                  <span className="text-[9px] font-mono opacity-85">
                    {overallAvg > 0 ? `${overallAvg}/20` : (isFr ? 'Notes' : 'Grades')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReportType('attendance')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    reportType === 'attendance'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  <span>{isFr ? 'Assiduité' : 'Attendance'}</span>
                  <span className="text-[9px] font-mono opacity-85">
                    {presenceRate}%
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReportType('complete')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    reportType === 'complete'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  <span>{isFr ? 'Bilan Complet' : 'Complete Summary'}</span>
                  <span className="text-[9px] font-mono opacity-85">
                    {isFr ? 'Notes + Présence' : 'All-in-one'}
                  </span>
                </button>
              </div>
            </div>

            {/* Optional Teacher / Admin note */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{isFr ? 'Observation ou mot personnalisé (optionnel) :' : 'Custom note or observation (optional):'}</span>
                {customNote && (
                  <button
                    type="button"
                    onClick={() => setCustomNote('')}
                    className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                  >
                    {isFr ? 'Effacer' : 'Clear'}
                  </button>
                )}
              </label>
              <textarea
                rows={2}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder={isFr 
                  ? "Ex: Très bon travail cette semaine, encouragements de l'équipe pédagogique !" 
                  : "Ex: Great progress this week, keep up the consistent effort!"}
                className="w-full p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-none focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Live WhatsApp Message Preview Screen */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  <span>{isFr ? 'Aperçu du message WhatsApp pré-rempli :' : 'Pre-filled WhatsApp Message Preview:'}</span>
                </span>
                <span className="text-[10px] font-mono opacity-75">
                  {generatedMessage.length} car.
                </span>
              </div>

              {/* WhatsApp styled bubble container */}
              <div className="p-3 sm:p-4 rounded-2xl bg-[#efeae2] dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 shadow-inner">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-[9px] text-emerald-800 dark:text-emerald-400 font-bold border-b border-emerald-100 dark:border-slate-800 pb-1.5">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3 text-emerald-600" /> WhatsApp Direct Message
                    </span>
                    <span className="font-mono">
                      {new Date().toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <pre className="text-xs font-sans whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto text-slate-800 dark:text-slate-200">
                    {generatedMessage}
                  </pre>
                </div>
              </div>
            </div>

          </div>

          {/* Modal Footer / Actions */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-150 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCopyMessage}
                className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                  copied
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? (isFr ? 'Copié !' : 'Copied!') : (isFr ? 'Copier le message' : 'Copy Message')}</span>
              </button>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  title={isFr ? 'Partager via les applications mobiles' : 'Share via device apps'}
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{isFr ? 'Partager...' : 'Share...'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {isFr ? 'Fermer' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-97 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="h-4 w-4 fill-white" />
                <span>{isFr ? 'Ouvrir WhatsApp' : 'Open WhatsApp'}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
