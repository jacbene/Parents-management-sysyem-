import React from 'react';
import { 
  GraduationCap, 
  Calendar, 
  Award, 
  BookOpen, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  ArrowRight, 
  Sparkles, 
  Users, 
  HelpCircle,
  FileText,
  TrendingUp,
  AlertTriangle,
  Send,
  CalendarDays
} from 'lucide-react';
import { Student, Grade, Attendance, Homework, Message } from '../types';
import { useLanguage } from '../utils/TranslationContext';

interface TeacherDetails {
  name: string;
  phone?: string;
  email?: string;
  classRoom: string;
  schoolName?: string;
}

interface TeacherWelcomeSummaryProps {
  teacherDetails: TeacherDetails | null;
  students: Student[];
  grades: Grade[];
  attendanceLogs: Attendance[];
  homeworks: Homework[];
  messages: Message[];
  onNavigateToTab: (tab: any) => void;
  onSelectStudent?: (student: Student) => void;
}

export default function TeacherWelcomeSummary({
  teacherDetails,
  students,
  grades,
  attendanceLogs,
  homeworks,
  messages,
  onNavigateToTab,
  onSelectStudent
}: TeacherWelcomeSummaryProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const teacherName = teacherDetails?.name || (isEn ? 'Teacher' : 'Enseignant');
  const classRoom = teacherDetails?.classRoom || '';

  // Filter students relevant to this teacher's assigned classroom
  const classStudents = React.useMemo(() => {
    if (!classRoom || classRoom === 'Toutes les classes' || classRoom.toLowerCase() === 'all') {
      return students;
    }
    return students.filter(s => 
      s.classRoom?.trim().toLowerCase() === classRoom.trim().toLowerCase()
    );
  }, [students, classRoom]);

  const classStudentIds = React.useMemo(() => new Set(classStudents.map(s => s.id)), [classStudents]);

  // Today's date YYYY-MM-DD
  const todayStr = React.useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  // 1. Attendance status for today
  const todayAttendance = React.useMemo(() => {
    return attendanceLogs.filter(a => a.date === todayStr && classStudentIds.has(a.studentId));
  }, [attendanceLogs, todayStr, classStudentIds]);

  const isAttendanceDoneToday = todayAttendance.length > 0;
  const presentCountToday = todayAttendance.filter(a => a.status === 'Present').length;
  const absentCountToday = todayAttendance.filter(a => a.status === 'Absent').length;
  const lateCountToday = todayAttendance.filter(a => a.status === 'Late').length;

  // 2. Urgent student help requests
  const helpRequestedStudents = React.useMemo(() => {
    return classStudents.filter(s => s.helpRequested === true);
  }, [classStudents]);

  // 3. Contested or Pending Review grades
  const pendingReviewGrades = React.useMemo(() => {
    return grades.filter(g => 
      g.status === 'PendingReview' && classStudentIds.has(g.studentId)
    );
  }, [grades, classStudentIds]);

  // 4. Pending / Overdue Homework for this class
  const classHomeworks = React.useMemo(() => {
    return homeworks.filter(h => classStudentIds.has(h.studentId));
  }, [homeworks, classStudentIds]);

  const pendingHomeworkList = React.useMemo(() => {
    return classHomeworks.filter(h => h.status === 'Pending' || h.status === 'Overdue');
  }, [classHomeworks]);

  // 5. Unread Parent Messages
  const unreadParentMessages = React.useMemo(() => {
    return messages.filter(m => 
      !m.isRead && 
      m.senderType === 'Parent' && 
      classStudentIds.has(m.studentId)
    );
  }, [messages, classStudentIds]);

  // 6. Overall class statistics
  const totalClassGrades = React.useMemo(() => {
    return grades.filter(g => classStudentIds.has(g.studentId));
  }, [grades, classStudentIds]);

  const classAverage = React.useMemo(() => {
    if (totalClassGrades.length === 0) return null;
    const sum = totalClassGrades.reduce((acc, g) => acc + (g.score / (g.maxScore || 20)) * 20, 0);
    return (sum / totalClassGrades.length).toFixed(1);
  }, [totalClassGrades]);

  // Count total urgent tasks
  const urgentCount = 
    (!isAttendanceDoneToday ? 1 : 0) + 
    helpRequestedStudents.length + 
    pendingReviewGrades.length + 
    (unreadParentMessages.length > 0 ? 1 : 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-8 text-left">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 translate-x-10 -translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isEn ? 'Teacher Command Center' : 'Tableau de Bord Enseignant'}</span>
              {classRoom && (
                <span className="font-extrabold text-white bg-indigo-600/60 px-2 py-0.5 rounded-full ml-1">
                  {classRoom}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isEn ? `Welcome back, ${teacherName}` : `Bonjour, ${teacherName}`}
            </h1>
            <p className="text-indigo-200/90 text-sm max-w-xl">
              {isEn 
                ? `Here is your pedagogical agenda and the urgent pending actions for your class today (${new Date().toLocaleDateString(isEn ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}).`
                : `Voici votre feuille de route pédagogique et les urgences du jour pour votre classe (${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}).`}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-4 py-3 rounded-2xl border flex items-center gap-3 backdrop-blur-md ${
              urgentCount > 0 
                ? 'bg-rose-500/15 border-rose-400/30 text-rose-100' 
                : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
            }`}>
              {urgentCount > 0 ? (
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              )}
              <div>
                <div className="text-xl font-black leading-none">
                  {urgentCount}
                </div>
                <div className="text-[11px] font-medium opacity-90">
                  {urgentCount > 1 
                    ? (isEn ? 'Urgent tasks' : 'Tâches prioritaires') 
                    : (isEn ? 'Urgent task' : 'Tâche prioritaire')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Urgency 1: Attendance of the day */}
      {!isAttendanceDoneToday ? (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800/60 rounded-3xl p-5 lg:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 shadow-xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 rounded-md">
                  {isEn ? 'Immediate Action' : 'Action Immédiate'}
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {isEn ? 'Attendance Call Pending' : 'Appel du jour non effectué'}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {isEn 
                  ? `Today's attendance has not been registered for ${classRoom || 'your class'}.`
                  : `L'appel du jour n'a pas encore été enregistré pour la classe ${classRoom || 'assignée'}.`}
              </h3>
              <p className="text-xs text-slate-650 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'Record student absences and late arrivals to keep administration and parents synchronized.'
                  : 'Pointez les présents, absents et retards pour tenir le registre et les parents informés en direct.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab('attendance')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm hover:shadow transition shrink-0 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>{isEn ? 'Take Attendance Now' : "Faire l'appel maintenant"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                {isEn ? "Today's attendance call is completed!" : "Appel du jour clôturé pour aujourd'hui !"}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                {isEn
                  ? `${presentCountToday} Present • ${absentCountToday} Absent • ${lateCountToday} Late`
                  : `${presentCountToday} Présent(s) • ${absentCountToday} Absent(s) • ${lateCountToday} En retard`}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('attendance')}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{isEn ? 'View register' : 'Voir le registre'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Grid of Urgent Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Urgent Module 1: Student Help Requests */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isEn ? 'Student Help Requests' : "Demandes d'Aide Élèves"}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isEn ? 'Struggling learners flagging support' : 'Élèves ayant signalé un blocage'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                helpRequestedStudents.length > 0 
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 animate-pulse' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {helpRequestedStudents.length}
              </span>
            </div>

            {helpRequestedStudents.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500 opacity-80" />
                <span>{isEn ? 'No pending help requests' : 'Aucune demande d\'aide en attente'}</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {helpRequestedStudents.map(student => (
                  <div 
                    key={student.id}
                    className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {student.name}
                      </p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                        {student.helpRequestReason ? `Motif: ${student.helpRequestReason}` : 'Difficulté signalée'}
                      </p>
                      {student.helpRequestNote && (
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                          "{student.helpRequestNote}"
                        </p>
                      )}
                    </div>
                    {onSelectStudent && (
                      <button
                        onClick={() => onSelectStudent(student)}
                        className="px-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-800 shrink-0 hover:bg-rose-50 cursor-pointer transition"
                      >
                        {isEn ? 'Profile' : 'Fiche'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
            <button
              onClick={() => onNavigateToTab('messages')}
              className="w-full text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 flex items-center justify-between cursor-pointer"
            >
              <span>{isEn ? 'Contact concerned parents' : 'Contacter les parents'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Urgent Module 2: Contested / Pending Review Grades */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isEn ? 'Grade Review Requests' : 'Notes sous Révision'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isEn ? 'Grades flagged for teacher check' : 'Évaluations contestées ou en attente'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                pendingReviewGrades.length > 0 
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {pendingReviewGrades.length}
              </span>
            </div>

            {pendingReviewGrades.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500 opacity-80" />
                <span>{isEn ? 'All class grades are validated' : 'Toutes les notes sont validées'}</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {pendingReviewGrades.map(grade => {
                  const student = classStudents.find(s => s.id === grade.studentId);
                  return (
                    <div 
                      key={grade.id}
                      className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {student?.name || (isEn ? 'Student' : 'Élève')}
                        </span>
                        <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300">
                          {grade.score}/{grade.maxScore || 20}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                        {grade.subject} • {grade.examName}
                      </p>
                      {grade.reviewReason && (
                        <p className="text-[10px] text-amber-800 dark:text-amber-300 mt-1 italic line-clamp-1">
                          Motif: {grade.reviewReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
            <button
              onClick={() => onNavigateToTab('grades')}
              className="w-full text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 flex items-center justify-between cursor-pointer"
            >
              <span>{isEn ? 'Open Grades Board' : 'Examiner les notes'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Urgent Module 3: Unread Parent Inquiries */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isEn ? 'Parent Messages' : 'Messages Parents'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isEn ? 'Unread inquiries from families' : 'Questions non lues des parents'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                unreadParentMessages.length > 0 
                  ? 'bg-indigo-150 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {unreadParentMessages.length}
              </span>
            </div>

            {unreadParentMessages.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500 opacity-80" />
                <span>{isEn ? 'No unread messages' : 'Aucun message en attente'}</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {unreadParentMessages.slice(0, 4).map(msg => {
                  const student = classStudents.find(s => s.id === msg.studentId);
                  return (
                    <div 
                      key={msg.id}
                      className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/40"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                        <span className="truncate">{student?.name ? `Parent de ${student.name}` : 'Parent'}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 mt-1">
                        {msg.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
            <button
              onClick={() => onNavigateToTab('messages')}
              className="w-full text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 flex items-center justify-between cursor-pointer"
            >
              <span>{isEn ? 'Open Message Inbox' : 'Ouvrir la messagerie'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Quick Class Pedagogical Snapshot */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-650" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {isEn ? 'Pedagogical Overview' : 'Aperçu Pédagogique de la Classe'}
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {classRoom || (isEn ? 'All Classes' : 'Toutes les classes')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Enrolled Students' : 'Élèves Inscrits'}
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {classStudents.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {isEn ? 'In your classroom' : 'Dans votre classe'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Active Homework' : 'Devoirs en Cours'}
            </p>
            <p className="text-2xl font-black text-indigo-650 dark:text-indigo-400 mt-1">
              {pendingHomeworkList.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {isEn ? 'Assigned or due' : 'À collecter / corriger'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Class Average' : 'Moyenne Générale'}
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {classAverage ? `${classAverage}/20` : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {isEn ? 'Published grades' : 'Calculée sur les notes saisies'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Daily Attendance' : "Taux d'Appel"}
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {isAttendanceDoneToday 
                ? (classStudents.length > 0 ? `${Math.round((presentCountToday / classStudents.length) * 100)}%` : '100%') 
                : '0%'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {isAttendanceDoneToday ? (isEn ? 'Present today' : 'Présents du jour') : (isEn ? 'Pending check' : 'Appel non fait')}
            </p>
          </div>
        </div>
      </div>

      {/* Pedagogical Quick Actions */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
          ⚡ {isEn ? 'Direct Pedagogical Shortcuts' : 'Raccourcis Directs Enseignant'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateToTab('attendance')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-650 dark:text-indigo-400 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Attendance' : "Faire l'appel"}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('grades')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Enter Grades' : 'Saisir Notes'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('homework')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Add Homework' : 'Donner Devoir'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('lessons')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Lessons / Course' : 'Cahier de Texte'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('academic_calendar')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <CalendarDays className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Calendar' : 'Calendrier'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('messages')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
              <Send className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Messages' : 'Messagerie'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
