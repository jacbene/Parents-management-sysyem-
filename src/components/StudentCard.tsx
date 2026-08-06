import React, { useState, useEffect } from 'react';
import { Student, ApeeSettings, ApeeParent, Grade, Attendance, Message } from '../types';
import { Mail, GraduationCap, Calendar, User, UserCheck, Camera, Printer, Phone, TrendingUp, TrendingDown, Clock, MessageSquare, Send, X, Check, AlertCircle, QrCode, Trash2, Activity, Sparkles, Award, Target, Edit3, Trophy, Share2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import StudentCameraModal from './StudentCameraModal';
import StudentIDCardModal from './StudentIDCardModal';
import { useLanguage } from '../utils/TranslationContext';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const GradeEvolutionTooltip = ({ active, payload, isSelected, isFr }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className={`p-2.5 rounded-xl shadow-xl text-xs border backdrop-blur-md z-30 ${
        isSelected 
          ? 'bg-slate-900/95 text-white border-indigo-400/50' 
          : 'bg-white/95 text-slate-800 border-slate-200 shadow-slate-200 dark:bg-slate-900/95 dark:text-slate-100 dark:border-slate-700'
      }`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 pb-1 font-bold text-indigo-400">
          <span>{data.subject}</span>
          <span className="text-[10px] text-slate-400 font-mono">{data.dateStr}</span>
        </div>
        <p className="text-[11px] font-medium text-slate-300 mt-0.5">{data.examName}</p>
        <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-slate-700/30">
          <span className="text-[10px] text-slate-400 uppercase font-bold">{isFr ? 'Note :' : 'Score:'}</span>
          <span className={`font-mono font-black text-xs ${data.score >= 10 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.score} / 20 <span className="text-[9.5px] font-normal text-slate-400">({data.rawScore})</span>
          </span>
        </div>
        {data.remarks && (
          <p className="text-[10px] italic text-slate-400 mt-1 max-w-[160px] truncate">
            "{data.remarks}"
          </p>
        )}
      </div>
    );
  }
  return null;
};

interface StudentCardProps {
  key?: string;
  student: Student;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateStudent?: (updated: Student) => void;
  onDeleteStudent?: (studentId: string) => Promise<boolean>;
  onPrint?: () => void;
  settings?: ApeeSettings;
  apeeParents?: ApeeParent[];
  grades?: Grade[];
  attendanceLogs?: Attendance[];
  portalUserRole?: 'manager' | 'parent' | null;
  onAddMessage?: (newMsg: Message) => void;
  isCompactMode?: boolean;
}

const isImageAvatar = (avatar: string) => {
  return avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/');
};

export default function StudentCard({ 
  student, 
  isSelected, 
  onSelect, 
  onUpdateStudent, 
  onDeleteStudent,
  onPrint, 
  settings, 
  apeeParents, 
  grades, 
  attendanceLogs,
  portalUserRole,
  onAddMessage,
  isCompactMode = true
}: StudentCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showIDCard, setShowIDCard] = useState(false);
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('absence');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Grade Goal state
  const [targetGoal, setTargetGoal] = useState<number>(() => {
    const saved = localStorage.getItem(`pasma_grade_goal_${student.id}`);
    return saved ? Math.min(20, Math.max(1, parseFloat(saved))) : 16.0;
  });
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [customGoalInput, setCustomGoalInput] = useState<string>(targetGoal.toString());

  // Grade Goal parent comment / reflection state
  const [goalComment, setGoalComment] = useState<string>(() => {
    return localStorage.getItem(`pasma_grade_goal_comment_${student.id}`) || '';
  });
  const [commentInput, setCommentInput] = useState<string>(goalComment);
  const [isEditingComment, setIsEditingComment] = useState<boolean>(false);

  const handleSaveGoal = (goalVal: number, commentVal?: string) => {
    const validGoal = Math.min(20, Math.max(1, goalVal));
    setTargetGoal(validGoal);
    localStorage.setItem(`pasma_grade_goal_${student.id}`, validGoal.toString());

    if (commentVal !== undefined) {
      const trimmed = commentVal.trim();
      setGoalComment(trimmed);
      localStorage.setItem(`pasma_grade_goal_comment_${student.id}`, trimmed);
    }
    setIsEditingGoal(false);
  };

  const handleSaveCommentOnly = (commentVal: string) => {
    const trimmed = commentVal.trim();
    setGoalComment(trimmed);
    localStorage.setItem(`pasma_grade_goal_comment_${student.id}`, trimmed);
    setIsEditingComment(false);
  };

  const handleClearComment = () => {
    setGoalComment('');
    setCommentInput('');
    localStorage.removeItem(`pasma_grade_goal_comment_${student.id}`);
    setIsEditingComment(false);
  };

  const { language } = useLanguage();
  const isFr = language === 'fr';

  useEffect(() => {
    if (showQuickContact) {
      const defaultText = isFr 
        ? `Bonjour, je vous informe que ${student.name} sera absent(e) aujourd'hui pour des raisons de santé. Merci pour votre compréhension.`
        : `Hello, I am writing to inform you that ${student.name} will be absent today due to health reasons. Thank you for your understanding.`;
      setMessageText(defaultText);
      setSelectedTemplateId('absence');
      setSentSuccess(false);
    }
  }, [showQuickContact, language]);

  // Find titular teacher for classroom in settings
  const foundTeacher = settings?.classTeachers?.find(t => {
    const classRoomName = (student.classRoom || '').toLowerCase();
    const tClassRoom = (t.classRoom || '').toLowerCase();
    return tClassRoom === classRoomName || 
           classRoomName.includes(tClassRoom) ||
           tClassRoom.includes(classRoomName);
  });

  const teacherName = foundTeacher?.teacherName || student.teacherName || 'Enseignant principal';
  const teacherEmail = foundTeacher?.teacherEmail || student.teacherEmail || '';

  // Find matching parent/guardian details
  const getMatchingParent = (): ApeeParent | undefined => {
    if (!apeeParents) return undefined;
    if (student.id.startsWith('stu_')) {
      const parts = student.id.split('_');
      if (parts.length >= 3 && parts[0] === 'stu') {
        const parentId = parts.slice(1, -1).join('_');
        const found = apeeParents.find(p => p.id === parentId);
        if (found) return found;
      }
    }
    const foundByName = apeeParents.find(p =>
      p.students?.some(stu => (stu?.name || '').trim().toLowerCase() === (student?.name || '').trim().toLowerCase())
    );
    if (foundByName) return foundByName;
    return undefined;
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setSendingMessage(true);

    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const matchingParent = getMatchingParent();
    const newMsg: Message = {
      id,
      studentId: student.id,
      parentId: student.parentId || matchingParent?.id || 'unknown_parent',
      senderType: 'Parent',
      content: messageText.trim(),
      timestamp: new Date().toISOString(),
      ...({
        recipientName: teacherName,
        recipientRole: isFr ? 'Professeur Principal' : 'Class Teacher'
      } as any)
    };

    try {
      await setDoc(doc(db, 'messages', id), newMsg);
      if (onAddMessage) {
        onAddMessage(newMsg);
      }
      setSentSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `messages/${id}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const matchingParent = getMatchingParent();

  // Calculate best and worst subjects
  const studentGrades = (grades || []).filter(g => g.studentId === student.id);
  const subjectAveragesMap: { [subj: string]: { sumBase20: number; count: number } } = {};
  studentGrades.forEach(g => {
    const scoreOn20 = (g.score / g.maxScore) * 20;
    if (!subjectAveragesMap[g.subject]) {
      subjectAveragesMap[g.subject] = { sumBase20: 0, count: 0 };
    }
    subjectAveragesMap[g.subject].sumBase20 += scoreOn20;
    subjectAveragesMap[g.subject].count += 1;
  });

  const subjectAverages = Object.keys(subjectAveragesMap).map(subj => {
    const stats = subjectAveragesMap[subj];
    return {
      subject: subj,
      avg: stats.sumBase20 / stats.count
    };
  });

  let bestSubject = null;
  let worstSubject = null;

  if (subjectAverages.length > 0) {
    const sorted = [...subjectAverages].sort((a, b) => b.avg - a.avg);
    bestSubject = sorted[0];
    worstSubject = sorted[sorted.length - 1];
  }

  // Calculate attendance rate
  const studentAttendance = (attendanceLogs || []).filter(a => a.studentId === student.id);
  const totalLogs = studentAttendance.length;
  const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
  const excusedCount = studentAttendance.filter(a => a.status === 'Excused').length;
  const presenceRate = totalLogs > 0
    ? (((presentCount + excusedCount) / totalLogs) * 100).toFixed(1)
    : '100.0';

  // Recharts grade evolution data: last 5 assessments
  const last5GradesData = React.useMemo(() => {
    const sGrades = (grades || []).filter(g => g.studentId === student.id);
    if (sGrades.length === 0) return [];

    // Sort chronologically by date
    const sorted = [...sGrades].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (isNaN(timeA) || isNaN(timeB)) return 0;
      return timeA - timeB;
    });

    // Take last 5
    const last5 = sorted.slice(-5);

    return last5.map((g, idx) => {
      const scoreOn20 = Number(((g.score / g.maxScore) * 20).toFixed(1));
      const formattedDate = g.date 
        ? new Date(g.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })
        : `N°${idx + 1}`;
      
      const shortSubject = g.subject 
        ? (g.subject.length > 8 ? `${g.subject.substring(0, 7)}.` : g.subject)
        : `Éval ${idx + 1}`;

      return {
        id: g.id || `grade-${idx}`,
        idx: idx + 1,
        examName: g.examName || (isFr ? `Évaluation ${idx + 1}` : `Exam ${idx + 1}`),
        subject: g.subject || 'Général',
        label: shortSubject,
        score: scoreOn20,
        rawScore: `${g.score}/${g.maxScore}`,
        dateStr: formattedDate,
        remarks: g.teacherRemarks || ''
      };
    });
  }, [grades, student.id, isFr]);

  const last5Average = React.useMemo(() => {
    if (last5GradesData.length === 0) return 0;
    const sum = last5GradesData.reduce((acc, curr) => acc + curr.score, 0);
    return Number((sum / last5GradesData.length).toFixed(1));
  }, [last5GradesData]);

  const last5TrendDelta = React.useMemo(() => {
    if (last5GradesData.length < 2) return 0;
    const first = last5GradesData[0].score;
    const last = last5GradesData[last5GradesData.length - 1].score;
    return Number((last - first).toFixed(1));
  }, [last5GradesData]);

  const overallAvg = React.useMemo(() => {
    if (studentGrades.length === 0) return 0;
    const sum = studentGrades.reduce((acc, g) => acc + ((g.score / g.maxScore) * 20), 0);
    return Number((sum / studentGrades.length).toFixed(1));
  }, [studentGrades]);

  const goalProgress = React.useMemo(() => {
    const currentAvg = last5GradesData.length > 0 ? last5Average : overallAvg;
    const percent = Math.min(100, Math.max(0, Math.round((currentAvg / targetGoal) * 100)));
    const gap = Number((currentAvg - targetGoal).toFixed(1));
    const isReached = currentAvg >= targetGoal;

    return {
      currentAvg,
      targetGoal,
      percent,
      gap,
      isReached
    };
  }, [last5Average, last5GradesData.length, overallAvg, targetGoal]);

  // Share Goal Progress state
  const [isSharingProgress, setIsSharingProgress] = useState<boolean>(false);
  const [copiedShareText, setCopiedShareText] = useState<boolean>(false);

  const generatedShareSummary = React.useMemo(() => {
    const currentDateStr = new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const header = isFr
      ? `📊 [PASMA-SYS] Rapport d'Objectif de Note - ${student.name} (${student.classRoom || student.grade || 'Élève'})`
      : `📊 [PASMA-SYS] Grade Goal Progress Report - ${student.name} (${student.classRoom || student.grade || 'Student'})`;

    const goalText = isFr
      ? `🎯 Objectif Cible : ${goalProgress.targetGoal}/20`
      : `🎯 Target Goal: ${goalProgress.targetGoal}/20`;

    const avgText = isFr
      ? `📈 Moyenne Actuelle (5 Dernières Évals) : ${goalProgress.currentAvg}/20`
      : `📈 Current Average (Last 5 Assessments): ${goalProgress.currentAvg}/20`;

    const percentText = isFr
      ? `⏳ Progression : ${goalProgress.percent}% de l'objectif`
      : `⏳ Progress: ${goalProgress.percent}% of goal`;

    const gapText = goalProgress.isReached
      ? (isFr ? `🏆 Statut : Objectif Atteint ! (+${goalProgress.gap} pts)` : `🏆 Status: Goal Achieved! (+${goalProgress.gap} pts)`)
      : (isFr ? `📉 Écart restant : ${goalProgress.gap} pts` : `📉 Remaining Gap: ${goalProgress.gap} pts`);

    const commentBlock = goalComment
      ? (isFr ? `\n💬 Note & Réflexion des parents :\n"${goalComment}"` : `\n💬 Parent Note & Reflection:\n"${goalComment}"`)
      : '';

    const footer = isFr
      ? `\n📅 Édité le ${currentDateStr} • Complexe Scolaire Ekali Pasma`
      : `\n📅 Generated on ${currentDateStr} • Ekali Pasma School`;

    return `${header}\n--------------------------------------------------\n${goalText}\n${avgText}\n${percentText}\n${gapText}${commentBlock}\n${footer}`;
  }, [student.name, student.classRoom, student.grade, goalProgress, goalComment, isFr]);

  const handleCopyShareText = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(generatedShareSummary);
      setCopiedShareText(true);
      setTimeout(() => setCopiedShareText(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleNativeShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: isFr ? `Progression de ${student.name}` : `Progress report for ${student.name}`,
          text: generatedShareSummary,
        });
      } catch (err) {
        console.warn('Native share error or dismissed:', err);
      }
    } else {
      handleCopyShareText();
    }
  };

  const showFullDetails = !isCompactMode || isExpanded;

  return (
    <>
      <motion.div
        onClick={onSelect}
        className={`StudentCard relative rounded-2xl border transition-all cursor-pointer duration-300 ${
          isCompactMode && !isExpanded ? 'p-3.5' : 'p-4.5'
        } ${
          isSelected
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
            : 'bg-white border-gray-100 text-gray-900 dark:text-slate-100 hover:border-gray-200 hover:shadow-sm dark:bg-slate-900 dark:border-slate-800/80 dark:hover:border-slate-700'
        }`}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        {/* Top Header Row (Always visible) */}
        <div className="flex gap-3 items-center justify-between">
          
          {/* Avatar & Main Identification */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCamera(true);
                }}
                className={`group ${
                  isCompactMode && !isExpanded ? 'w-10 h-10' : 'w-12 h-12'
                } rounded-xl overflow-hidden flex items-center justify-center relative border cursor-pointer transition-all duration-300 ${
                  isSelected 
                    ? 'border-indigo-400 bg-white/10 hover:bg-white/20' 
                    : 'border-gray-150 bg-slate-50 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800/85'
                }`}
                title="Cliquer pour changer la photo"
              >
                {isImageAvatar(student.avatar) ? (
                  <img 
                    src={student.avatar} 
                    alt={student.name} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span className={`${isCompactMode && !isExpanded ? 'text-xl' : 'text-2xl'} font-sans`} role="img" aria-label="student avatar">
                    {student.avatar}
                  </span>
                )}
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white">
                  <Camera className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Quick Camera Badge Trigger */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCamera(true);
                }}
                className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border shadow-2xs hover:scale-110 active:scale-95 transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-amber-500 border-amber-400 text-white' 
                    : 'bg-indigo-600 border-indigo-500 text-white'
                }`}
                title="Prendre une photo de l'élève"
              >
                <Camera className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className={`font-bold font-sans text-xs sm:text-sm truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {student.name}
                </h3>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md shrink-0 ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {student.classRoom || student.grade}
                </span>
                {isSelected && (
                  <span className="bg-emerald-400/30 text-white text-[8.5px] uppercase font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0 border border-emerald-300/30">
                    <UserCheck className="h-2.5 w-2.5" /> Actif
                  </span>
                )}
              </div>

              {/* Compact Metrics Row */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                <span className={`font-bold px-1.5 py-0.5 rounded-md ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : last5Average > 0 && last5Average >= 12
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : last5Average > 0 && last5Average >= 10
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    : last5Average > 0
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {last5Average > 0 ? `Moy: ${last5Average}/20` : (isFr ? 'Sans note' : 'No grades')}
                </span>

                <span className={`font-medium px-1.5 py-0.5 rounded-md ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  Assiduité: {presenceRate}%
                </span>

                {matchingParent?.name && (
                  <span className={`hidden sm:inline-block truncate max-w-[120px] text-[9.5px] opacity-85 ${
                    isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    Tuteur: {matchingParent.name.split(' ')[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Toggle Button */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                isSelected
                  ? 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title={isExpanded ? "Masquer la fiche complète" : "Afficher la fiche complète"}
            >
              <span className="hidden sm:inline">{isExpanded ? "Réduire" : "Détails"}</span>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Section: Full details, charts, goals & action bar */}
        <AnimatePresence>
          {showFullDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-3 mt-3 border-t border-dashed border-white/20 dark:border-slate-800 space-y-3"
            >
              <div className="space-y-1 text-[11px] sm:text-xs">
                <div className={`flex items-center justify-between gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500 dark:text-slate-400'}`}>
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">Enseignant : <strong className={isSelected ? 'text-white' : 'text-gray-700 dark:text-slate-300'}>{teacherName}</strong></span>
                  </div>
                  {portalUserRole === 'parent' && onAddMessage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuickContact(true);
                      }}
                      className={`p-1 rounded-md border transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                          : 'bg-indigo-50 dark:bg-slate-800 border-indigo-100 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700'
                      }`}
                      title={isFr ? "Contacter rapidement l'enseignant" : "Quick contact teacher"}
                    >
                      <MessageSquare className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">Tuteur : <strong className={isSelected ? 'text-white' : 'text-gray-700'}>{matchingParent?.name || 'Non renseigné'}</strong></span>
                </div>
                {matchingParent?.phone && (
                  <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">Tél Parent : <strong className={isSelected ? 'text-white font-mono' : 'text-gray-700 font-mono'}>{matchingParent.phone}</strong></span>
                  </div>
                )}
                <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                  <TrendingUp className={`h-3 w-3 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-emerald-600'}`} />
                  <span className="truncate">Best : <strong className={isSelected ? 'text-white' : 'text-emerald-700 font-bold'}>{bestSubject ? `${bestSubject.subject} (${bestSubject.avg.toFixed(1)}/20)` : 'N/A'}</strong></span>
                </div>
                <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                  <TrendingDown className={`h-3 w-3 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-rose-600'}`} />
                  <span className="truncate">Pire : <strong className={isSelected ? 'text-white' : 'text-rose-700 font-bold'}>{worstSubject ? `${worstSubject.subject} (${worstSubject.avg.toFixed(1)}/20)` : 'N/A'}</strong></span>
                </div>
                <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="truncate">Assiduité : <strong className={isSelected ? 'text-white font-mono' : 'text-gray-700 font-mono'}>{presenceRate}%</strong></span>
                </div>
              </div>

            {/* Recharts Grade Evolution Section (Last 5 Assessments) */}
            <div className={`mt-3 pt-3 border-t ${isSelected ? 'border-white/20' : 'border-slate-100 dark:border-slate-800/80'}`}>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isSelected ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-300'
                }`}>
                  <Activity className={`h-3.5 w-3.5 ${isSelected ? 'text-amber-300' : 'text-indigo-600 dark:text-indigo-400'}`} />
                  <span>{isFr ? 'Évolution (5 Dernières Évals)' : 'Trend (Last 5 Grades)'}</span>
                </span>

                {last5GradesData.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-indigo-300'
                    }`}>
                      Moy: {last5Average}/20
                    </span>
                    {last5GradesData.length >= 2 && (
                      <span className={`px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                        last5TrendDelta >= 0 
                          ? (isSelected ? 'bg-emerald-400/30 text-emerald-100' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')
                          : (isSelected ? 'bg-rose-400/30 text-rose-100' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300')
                      }`}>
                        {last5TrendDelta >= 0 ? '↗ +' : '↘ '}{last5TrendDelta} pts
                      </span>
                    )}
                  </div>
                )}
              </div>

              {last5GradesData.length > 0 ? (
                <div className="space-y-2">
                  {/* Recharts Area/Line Chart */}
                  <div className={`w-full p-2 rounded-xl transition-colors ${
                    isSelected 
                      ? 'bg-slate-900/40 border border-white/10' 
                      : 'bg-slate-50/80 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800'
                  }`}>
                    <div className="h-28 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={last5GradesData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`gradeGrad-${student.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isSelected ? '#38bdf8' : '#6366f1'} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={isSelected ? '#38bdf8' : '#6366f1'} stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={isSelected ? 'rgba(255,255,255,0.1)' : '#e2e8f0'} />
                          <XAxis 
                            dataKey="label" 
                            tickLine={false} 
                            axisLine={false}
                            tick={{ fill: isSelected ? '#cbd5e1' : '#64748b', fontSize: 9, fontWeight: 600 }}
                          />
                          <YAxis 
                            domain={[0, 20]} 
                            ticks={[0, 10, 20]}
                            tickLine={false} 
                            axisLine={false}
                            tick={{ fill: isSelected ? '#cbd5e1' : '#64748b', fontSize: 9, fontWeight: 600 }}
                          />
                          <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
                          <Tooltip content={<GradeEvolutionTooltip isSelected={isSelected} isFr={isFr} />} />
                          <Area 
                            type="monotone" 
                            dataKey="score" 
                            stroke={isSelected ? '#38bdf8' : '#4f46e5'} 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill={`url(#gradeGrad-${student.id})`} 
                            dot={{ r: 3, fill: isSelected ? '#ffffff' : '#4f46e5', strokeWidth: 1.5, stroke: isSelected ? '#38bdf8' : '#ffffff' }}
                            activeDot={{ r: 5, strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Individual grade tags for the last 5 evaluations */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {last5GradesData.map((item) => (
                      <div 
                        key={item.id}
                        title={`${item.subject} (${item.examName}) : ${item.rawScore}`}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all flex items-center justify-between gap-1 flex-1 min-w-[62px] ${
                          isSelected
                            ? (item.score >= 10 ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-rose-500/20 border-rose-400/40 text-rose-100')
                            : (item.score >= 10 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300')
                        }`}
                      >
                        <span className="truncate max-w-[42px]">{item.label}</span>
                        <span className="font-black">{item.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`p-2.5 rounded-xl border text-center text-[11px] italic ${
                  isSelected ? 'bg-white/10 border-white/20 text-indigo-100' : 'bg-slate-50 border-slate-200/80 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800'
                }`}>
                  {isFr ? 'Aucune évaluation récente à afficher' : 'No recent evaluation recorded'}
                </div>
              )}
            </div>

            {/* Grade Goal & Progress Ring Section */}
            <div className={`mt-3 pt-3 border-t ${isSelected ? 'border-white/20' : 'border-slate-100 dark:border-slate-800/80'}`}>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isSelected ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-300'
                }`}>
                  <Target className={`h-3.5 w-3.5 ${isSelected ? 'text-amber-300' : 'text-indigo-600 dark:text-indigo-400'}`} />
                  <span>{isFr ? 'Objectif de Note' : 'Grade Goal'}</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingGoal(false);
                      setIsSharingProgress(!isSharingProgress);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      isSelected 
                        ? (isSharingProgress ? 'bg-amber-400 text-slate-900 font-extrabold' : 'bg-amber-400/30 hover:bg-amber-400/40 text-amber-100 border border-amber-300/30') 
                        : (isSharingProgress ? 'bg-emerald-600 text-white font-extrabold shadow-xs' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800')
                    }`}
                    title={isFr ? "Partager la progression de l'objectif" : "Share goal progress"}
                  >
                    <Share2 className="h-2.5 w-2.5" />
                    <span>{isSharingProgress ? (isFr ? 'Fermer' : 'Close') : (isFr ? 'Partager' : 'Share Progress')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSharingProgress(false);
                      setCustomGoalInput(targetGoal.toString());
                      setIsEditingGoal(!isEditingGoal);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      isSelected 
                        ? 'bg-white/20 hover:bg-white/30 text-white' 
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-indigo-300 border border-indigo-100 dark:border-slate-700'
                    }`}
                    title={isFr ? "Ajuster l'objectif de note" : "Edit grade goal"}
                  >
                    <Edit3 className="h-2.5 w-2.5" />
                    <span>{isEditingGoal ? (isFr ? 'Fermer' : 'Close') : (isFr ? 'Ajuster' : 'Edit')}</span>
                  </button>
                </div>
              </div>

              {/* Share Progress Drawer */}
              {isSharingProgress && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={`p-3 mb-2.5 rounded-xl border space-y-2 text-xs ${
                    isSelected ? 'bg-slate-900/90 border-amber-400/30 text-white' : 'bg-emerald-50/80 border-emerald-200 text-slate-800 dark:bg-slate-800/95 dark:border-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                      <Share2 className="h-3 w-3" />
                      <span>{isFr ? 'Partager le Bilan d\'Objectif' : 'Share Progress Summary'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSharingProgress(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10.5px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words max-h-36 overflow-y-auto leading-relaxed shadow-inner">
                      {generatedShareSummary}
                    </pre>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-[10px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer"
                      >
                        <Share2 className="h-3 w-3" />
                        <span>{isFr ? 'Partager...' : 'Device Share'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleCopyShareText}
                      className={`px-3 py-1.5 text-[10.5px] font-bold rounded-md shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                        copiedShareText 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {copiedShareText ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedShareText ? (isFr ? 'Copié !' : 'Copied!') : (isFr ? 'Copier le texte' : 'Copy Summary')}</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Edit Goal Drawer/Presets */}
              {isEditingGoal && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={`p-2.5 mb-2.5 rounded-xl border space-y-2 text-xs ${
                    isSelected ? 'bg-slate-900/80 border-indigo-400/30 text-white' : 'bg-indigo-50/70 border-indigo-200 text-slate-800 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-200'
                  }`}
                >
                  <p className="font-bold text-[11px]">
                    {isFr ? 'Définir la note cible (sur 20) :' : 'Set target score (out of 20):'}
                  </p>
                  
                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1">
                    {[12, 14, 15, 16, 17, 18, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setCustomGoalInput(preset.toString());
                          handleSaveGoal(preset, commentInput);
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
                          targetGoal === preset
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {preset}/20
                      </button>
                    ))}
                  </div>

                  {/* Custom Manual Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="0.5"
                      value={customGoalInput}
                      onChange={(e) => setCustomGoalInput(e.target.value)}
                      placeholder="Ex: 15.5"
                      className="w-24 px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseFloat(customGoalInput);
                        if (!isNaN(val)) handleSaveGoal(val, commentInput);
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="h-3 w-3" />
                      <span>{isFr ? 'Valider' : 'Save'}</span>
                    </button>
                  </div>

                  {/* Parent Reflection / Comment Field */}
                  <div className="pt-2 border-t border-indigo-200/50 dark:border-slate-700/60 space-y-1">
                    <label className="font-bold text-[10.5px] block text-slate-700 dark:text-slate-300">
                      {isFr ? 'Note ou réflexion des parents (optionnel) :' : 'Parent note or reflection (optional):'}
                    </label>
                    <textarea
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder={isFr ? "Ex: Encourager les révisions en mathématiques avant le prochain examen..." : "Ex: Encourage math revision on weekends before next exam..."}
                      className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white resize-none focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </motion.div>
              )}

              {/* Progress Ring & Goal Visualizer */}
              <div className={`p-3 rounded-2xl border flex items-center gap-3 transition-colors ${
                isSelected 
                  ? 'bg-slate-900/40 border-white/10' 
                  : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-150 dark:border-slate-800'
              }`}>
                {/* SVG Circular Progress Ring */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 60 60">
                    {/* Track */}
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      stroke={isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(203, 213, 225, 0.6)'}
                      strokeWidth="5"
                      fill="transparent"
                    />
                    {/* Progress Indicator */}
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      stroke={
                        goalProgress.isReached 
                          ? '#10b981' 
                          : goalProgress.percent >= 80 
                          ? (isSelected ? '#38bdf8' : '#6366f1') 
                          : '#f59e0b'
                      }
                      strokeWidth="5"
                      strokeDasharray="150.8"
                      strokeDashoffset={150.8 - (150.8 * goalProgress.percent) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  {/* Center Text inside Ring */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className={`text-[12px] font-mono font-black leading-none ${
                      isSelected 
                        ? 'text-white' 
                        : goalProgress.isReached ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'
                    }`}>
                      {goalProgress.percent}%
                    </span>
                    <span className={`text-[8px] uppercase font-bold tracking-tight mt-0.5 ${
                      isSelected ? 'text-indigo-200' : 'text-slate-400'
                    }`}>
                      {isFr ? 'atteint' : 'goal'}
                    </span>
                  </div>
                </div>

                {/* Text Metrics & Status */}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-300'}`}>
                      {isFr ? 'Moy. 5 Dernières Évals' : 'Last 5 Assessments Avg'}
                    </span>
                    <span className={`text-xs font-mono font-black ${
                      isSelected 
                        ? 'text-white' 
                        : goalProgress.currentAvg >= 10 ? 'text-slate-900 dark:text-white' : 'text-rose-600'
                    }`}>
                      {goalProgress.currentAvg} / 20
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className={`font-semibold ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                      {isFr ? 'Objectif Cible :' : 'Target Goal:'}
                    </span>
                    <span className={`font-mono font-bold ${isSelected ? 'text-amber-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                      {goalProgress.targetGoal} / 20
                    </span>
                  </div>

                  {/* Gap Status Pill */}
                  <div className="pt-1 flex items-center justify-between gap-1 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                      goalProgress.isReached
                        ? (isSelected ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-400/30' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300')
                        : goalProgress.gap >= -2
                        ? (isSelected ? 'bg-amber-400/20 text-amber-100 border border-amber-400/30' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300')
                        : (isSelected ? 'bg-rose-400/20 text-rose-100 border border-rose-400/30' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300')
                    }`}>
                      {goalProgress.isReached ? (
                        <>
                          <Trophy className="h-3 w-3 shrink-0" />
                          <span>{isFr ? 'Objectif Atteint !' : 'Goal Achieved!'} (+{goalProgress.gap} pts)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 shrink-0" />
                          <span>
                            {isFr 
                              ? `Écart : ${goalProgress.gap} pts` 
                              : `Gap: ${goalProgress.gap} pts`}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parent Reflection / Comment Display or Inline Editor */}
              {isEditingComment ? (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className={`mt-2 p-2.5 rounded-xl border space-y-2 text-xs ${
                    isSelected ? 'bg-slate-900/80 border-indigo-400/30 text-white' : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-200'
                  }`}
                >
                  <label className="font-bold text-[11px] flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <MessageSquare className="h-3 w-3" />
                    <span>{isFr ? 'Réflexion des Parents sur l\'Objectif' : 'Parent Goal Reflection'}</span>
                  </label>
                  <textarea
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder={isFr ? "Ajoutez une note, observation ou encouragement..." : "Add a note, observation, or encouragement..."}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white resize-none focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    {goalComment && (
                      <button
                        type="button"
                        onClick={handleClearComment}
                        className="px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition cursor-pointer"
                      >
                        {isFr ? 'Supprimer' : 'Delete'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingComment(false)}
                      className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 transition cursor-pointer"
                    >
                      {isFr ? 'Annuler' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveCommentOnly(commentInput)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="h-3 w-3" />
                      <span>{isFr ? 'Enregistrer' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              ) : goalComment ? (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className={`mt-2 p-2.5 rounded-xl border flex items-start justify-between gap-2 text-xs transition-all ${
                    isSelected 
                      ? 'bg-indigo-950/40 border-indigo-400/30 text-indigo-100' 
                      : 'bg-indigo-50/60 dark:bg-slate-800/60 border-indigo-100 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <MessageSquare className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-amber-300' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    <div className="min-w-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${isSelected ? 'text-indigo-200' : 'text-indigo-800 dark:text-indigo-300'}`}>
                        {isFr ? 'Note & Réflexion des parents :' : 'Parent Note & Reflection:'}
                      </span>
                      <p className="text-[11px] italic leading-relaxed mt-0.5 break-words">
                        "{goalComment}"
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCommentInput(goalComment);
                      setIsEditingComment(true);
                    }}
                    className={`p-1 rounded-md shrink-0 transition cursor-pointer ${
                      isSelected ? 'hover:bg-white/20 text-indigo-200' : 'hover:bg-indigo-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600'
                    }`}
                    title={isFr ? "Modifier la réflexion" : "Edit reflection"}
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCommentInput('');
                      setIsEditingComment(true);
                    }}
                    className={`text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                      isSelected 
                        ? 'text-indigo-200 hover:text-white' 
                        : 'text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300'
                    }`}
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    <span>{isFr ? '+ Ajouter une réflexion parentale' : '+ Add parent reflection note'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isSelected && (
              <div className="pt-3 mt-3 border-t border-white/20 flex flex-col sm:flex-row gap-2">
                {onPrint && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrint();
                    }}
                    className="bg-white hover:bg-slate-50 text-indigo-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all flex-1 active:scale-97"
                    title="Générer un dossier d'élève imprimable"
                  >
                    <Printer className="h-3.5 w-3.5 shrink-0" />
                    <span>Imprimer fiche</span>
                  </button>
                )}

                {portalUserRole !== 'parent' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowIDCard(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-xl border border-indigo-500 shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all flex-1 active:scale-97"
                    title="Afficher la carte scolaire officielle avec QR code"
                  >
                    <QrCode className="h-3.5 w-3.5 shrink-0" />
                    <span>Carte ID (QR)</span>
                  </button>
                )}

                {portalUserRole !== 'parent' && onDeleteStudent && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="bg-rose-500/20 hover:bg-rose-600 text-rose-100 hover:text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-xl border border-rose-400/30 shadow-xs cursor-pointer flex items-center justify-center gap-1 transition-all active:scale-97"
                    title="Supprimer cet élève"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Supprimer</span>
                  </button>
                )}

                {portalUserRole === 'parent' && onAddMessage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickContact(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-xl shadow-xs border border-amber-400 cursor-pointer flex items-center justify-center gap-1.5 transition-all flex-1 active:scale-97"
                    title="Contacter rapidement l'enseignant"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>Contact rapide</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

      {/* Modal interface rendered dynamically */}
      {showCamera && onUpdateStudent && (
        <StudentCameraModal
          student={student}
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onUpdate={onUpdateStudent}
        />
      )}

      {showIDCard && (
        <StudentIDCardModal
          student={student}
          isOpen={showIDCard}
          onClose={() => setShowIDCard(false)}
          settings={settings}
        />
      )}

      {/* Quick Contact Modal */}
      {showQuickContact && onAddMessage && (
        <AnimatePresence>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setShowQuickContact(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md border border-gray-150 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2 font-sans">
                    <MessageSquare className="h-5 w-5" />
                    <span>{isFr ? "Contact Rapide" : "Quick Contact"}</span>
                  </h3>
                  <p className="text-xs text-indigo-100 font-sans mt-0.5 font-medium">
                    {isFr ? `Élève : ${student.name} • Classe : ${student.classRoom}` : `Student: ${student.name} • Class: ${student.classRoom}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickContact(false)}
                  className="p-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-slate-800">
                {sentSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center text-center py-6 space-y-3"
                  >
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                      <Check className="h-10 w-10 animate-bounce" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 font-sans">
                      {isFr ? "Message envoyé !" : "Message Sent!"}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {isFr 
                        ? `Votre message de contact rapide a été transmis avec succès à l'enseignant ${teacherName} dans la messagerie.` 
                        : `Your quick contact message has been successfully transmitted to classroom teacher ${teacherName} in the messaging board.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowQuickContact(false)}
                      className="w-full mt-4 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold rounded-xl transition text-xs cursor-pointer"
                    >
                      {isFr ? "Fermer" : "Close"}
                    </button>
                  </motion.div>
                ) : (
                  <>
                    {/* Recipient banner */}
                    <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {isFr ? "REPRÉSENTANT ENSEIGNANT DE LA CLASSE" : "CLASSROOM FACULTY DELEGATE"}
                        </span>
                        <h4 className="font-sans font-black text-slate-800 text-sm truncate">{teacherName}</h4>
                        {teacherEmail && <p className="text-[10.5px] text-slate-500 truncate">{teacherEmail}</p>}
                      </div>
                    </div>

                    {/* Pre-formatted choice selectors */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                        {isFr ? "Sélectionner un motif de message :" : "Select a message reason:"}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            id: 'absence',
                            label: isFr ? 'Absence' : 'Absence',
                            emoji: '🤒',
                            text: isFr 
                              ? `Bonjour, je vous informe que ${student.name} sera absent(e) aujourd'hui pour des raisons de santé. Merci pour votre compréhension.`
                              : `Hello, I am writing to inform you that ${student.name} will be absent today due to health reasons. Thank you for your understanding.`
                          },
                          {
                            id: 'late',
                            label: isFr ? 'Retard' : 'Late',
                            emoji: '⏰',
                            text: isFr
                              ? `Bonjour, je vous informe que ${student.name} aura un léger retard ce matin en raison d'un contretemps de transport. Merci pour votre compréhension.`
                              : `Hello, I wanted to let you know that ${student.name} will be slightly late this morning due to transportation delays. Thank you for your understanding.`
                          },
                          {
                            id: 'appointment',
                            label: isFr ? 'Rendez-vous' : 'Meeting',
                            emoji: '📅',
                            text: isFr
                              ? `Bonjour, je souhaiterais prendre rendez-vous avec vous à votre convenance pour échanger sur le suivi scolaire et les progrès de ${student.name}. Merci d'avance.`
                              : `Hello, I would like to request a parent-teacher meeting at your earliest convenience to discuss the academic progress of ${student.name}. Thank you.`
                          },
                          {
                            id: 'homework',
                            label: isFr ? 'Devoirs' : 'Homework',
                            emoji: '📚',
                            text: isFr
                              ? `Bonjour, ${student.name} rencontre des difficultés sur les devoirs demandés aujourd'hui. Pourriez-vous nous guider ou réexpliquer le point de blocage ? Cordialement.`
                              : `Hello, ${student.name} is struggling with the homework assigned today. Could you please provide some guidance or clarify the requirements? Best regards.`
                          },
                          {
                            id: 'progress',
                            label: isFr ? 'Bilan Progrès' : 'Progress check',
                            emoji: '📈',
                            text: isFr
                              ? `Bonjour, j'aimerais avoir un retour rapide sur le comportement et le travail général de ${student.name} ces derniers temps. Merci pour votre dévouement.`
                              : `Hello, I would love to get a quick update on ${student.name}'s behavior and academic participation lately. Thank you for your dedication.`
                          }
                        ].map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplateId(tpl.id);
                              setMessageText(tpl.text);
                            }}
                            className={`flex items-center gap-1.5 p-2 rounded-xl border text-left transition cursor-pointer text-xs ${
                              selectedTemplateId === tpl.id
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50/50'
                            }`}
                          >
                            <span role="img" aria-label={tpl.id}>{tpl.emoji}</span>
                            <span className="truncate">{tpl.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview Area / Text Area */}
                    <div className="space-y-1.5 pt-1 text-left">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                        {isFr ? "Aperçu et personnalisation du message :" : "Preview and customize direct message:"}
                      </label>
                      <textarea
                        rows={4}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-sans text-slate-800 leading-relaxed bg-slate-50/25 resize-none"
                        placeholder={isFr ? "Écrivez votre message..." : "Type custom message..."}
                        required
                      />
                    </div>

                    {/* Modal Actions */}
                    <div className="flex gap-2.5 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowQuickContact(false)}
                        className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                      >
                        {isFr ? "Annuler" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={sendingMessage || !messageText.trim()}
                        onClick={handleSendMessage}
                        className="flex-1 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        {sendingMessage ? (
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            <span>{isFr ? "Envoyer" : "Send message"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <AnimatePresence>
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200/60 dark:border-rose-800/40 shrink-0">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {isFr ? "Supprimer l'élève" : "Delete Student"}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    {isFr 
                      ? `Êtes-vous sûr de vouloir supprimer définitivement ${student.name} (${student.classRoom || 'Sans classe'}) ?`
                      : `Are you sure you want to permanently delete ${student.name} (${student.classRoom || 'No class'})?`}
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 p-3 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {isFr 
                    ? "Cette action supprimera l'élève de la base de données de l'établissement."
                    : "This action will remove the student from the school database."}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  {isFr ? "Annuler" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (!onDeleteStudent) return;
                    setIsDeleting(true);
                    try {
                      await onDeleteStudent(student.id);
                      setShowDeleteConfirm(false);
                    } catch (err) {
                      console.error("Failed deleting student:", err);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-97 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isDeleting ? (isFr ? "Suppression..." : "Deleting...") : (isFr ? "Oui, Supprimer" : "Yes, Delete")}</span>
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </>
  );
}
