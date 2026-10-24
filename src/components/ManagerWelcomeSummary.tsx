import React from 'react';
import {
  ShieldAlert,
  Coins,
  Receipt,
  Award,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  UserX,
  Send,
  Calculator,
  History,
  Settings,
  Database,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Smartphone,
  Users
} from 'lucide-react';
import { 
  ApeeParent, 
  ApeeExpense, 
  ApeeSettings, 
  Grade, 
  Student, 
  Attendance, 
  Message 
} from '../types';
import { useLanguage } from '../utils/TranslationContext';

interface ManagerDetails {
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  schoolName?: string;
}

interface ManagerWelcomeSummaryProps {
  managerDetails: ManagerDetails | null;
  settings: ApeeSettings;
  parents: ApeeParent[];
  expenses: ApeeExpense[];
  grades: Grade[];
  students: Student[];
  attendanceLogs: Attendance[];
  messages: Message[];
  isApeeAuthorized: boolean;
  isPedAuthorized: boolean;
  onNavigateToTab: (tab: any) => void;
  onPromptUnlockApee: () => void;
  onPromptUnlockPed: () => void;
}

export default function ManagerWelcomeSummary({
  managerDetails,
  settings,
  parents,
  expenses,
  grades,
  students,
  attendanceLogs,
  messages,
  isApeeAuthorized,
  isPedAuthorized,
  onNavigateToTab,
  onPromptUnlockApee,
  onPromptUnlockPed
}: ManagerWelcomeSummaryProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const managerName = managerDetails?.name || (isEn ? 'Administrator' : 'Administrateur');
  const managerRole = managerDetails?.role || (isEn ? 'Management Executive' : 'Direction Générale');
  const currency = settings.currency || 'FCFA';

  // Format currency
  const formatMoney = (val: number) => {
    return val.toLocaleString() + ' ' + currency;
  };

  // 1. Recouvrement APEE & Parents en retard
  const overdueParents = React.useMemo(() => {
    return parents.filter(p => p.status === 'retard' || (p.totalDue - p.totalPaid) > 0);
  }, [parents]);

  const totalOverdueAmount = React.useMemo(() => {
    return overdueParents.reduce((sum, p) => sum + Math.max(0, p.totalDue - p.totalPaid), 0);
  }, [overdueParents]);

  const zeroPaidParents = React.useMemo(() => {
    return overdueParents.filter(p => p.totalPaid === 0 && p.totalDue > 0);
  }, [overdueParents]);

  // 2. Bons de dépenses & Commandes en attente de validation
  const pendingExpenses = React.useMemo(() => {
    return expenses.filter(e => e.status === 'Pending');
  }, [expenses]);

  const pendingExpensesAmount = React.useMemo(() => {
    return pendingExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [pendingExpenses]);

  // 3. Notes sous révision / contestations
  const pendingReviewGrades = React.useMemo(() => {
    return grades.filter(g => g.status === 'PendingReview');
  }, [grades]);

  // 4. Décrochage scolaire & Absences critiques (> 3 absences non excusées)
  const criticalAbsenceStudents = React.useMemo(() => {
    const absenceCounts: Record<string, number> = {};
    attendanceLogs.forEach(log => {
      if (log.status === 'Absent') {
        absenceCounts[log.studentId] = (absenceCounts[log.studentId] || 0) + 1;
      }
    });

    const flagged: Array<{ student: Student; count: number }> = [];
    students.forEach(student => {
      const count = absenceCounts[student.id] || 0;
      if (count >= 3) {
        flagged.push({ student, count });
      }
    });

    return flagged.sort((a, b) => b.count - a.count);
  }, [attendanceLogs, students]);

  // 5. Total revenue vs Executed expenses
  const totalRevenue = React.useMemo(() => {
    return parents.reduce((sum, p) => sum + p.totalPaid, 0);
  }, [parents]);

  const totalExecutedExpenses = React.useMemo(() => {
    return expenses
      .filter(e => e.status === 'Executed')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const cashBalance = totalRevenue - totalExecutedExpenses;
  const financialGoal = settings.financialGoal || 1;
  const realizationRate = Math.min(100, Math.round((totalRevenue / financialGoal) * 100));

  // Count total urgent administrative issues
  const urgentCount = 
    (pendingExpenses.length > 0 ? 1 : 0) +
    (overdueParents.length > 0 ? 1 : 0) +
    (pendingReviewGrades.length > 0 ? 1 : 0) +
    (criticalAbsenceStudents.length > 0 ? 1 : 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-8 text-left">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden shadow-sm border border-slate-800">
        <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isEn ? 'Executive Command Center' : 'Poste de Commandement Exécutif'}</span>
              <span className="font-bold text-white bg-indigo-600/60 px-2 py-0.5 rounded-full ml-1">
                {managerRole}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isEn ? `Welcome, ${managerName}` : `Bienvenue, ${managerName}`}
            </h1>
            <p className="text-slate-350 text-sm max-w-xl">
              {isEn 
                ? `Executive synthesis of pending financial orders, overdue collections, and academic governance for ${settings.associationName || 'the establishment'}.`
                : `Synthèse exécutive des bons de dépenses, des retards de cotisations et des arbitrages académiques pour ${settings.associationName || "l'établissement"}.`}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-4 py-3 rounded-2xl border flex items-center gap-3 backdrop-blur-md ${
              urgentCount > 0 
                ? 'bg-rose-500/15 border-rose-400/30 text-rose-100' 
                : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
            }`}>
              {urgentCount > 0 ? (
                <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              )}
              <div>
                <div className="text-xl font-black leading-none">
                  {urgentCount}
                </div>
                <div className="text-[11px] font-medium opacity-90">
                  {urgentCount > 1 
                    ? (isEn ? 'Points of Attention' : "Points d'attention") 
                    : (isEn ? 'Point of Attention' : "Point d'attention")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Authorization Quick Status */}
      {(!isApeeAuthorized || !isPedAuthorized) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-200">
                {isEn ? 'Protected Management Actions Locked' : 'Modules Protégés par Mots de Passe'}
              </p>
              <p className="text-amber-800 dark:text-amber-400 text-[11px]">
                {!isApeeAuthorized && !isPedAuthorized
                  ? (isEn ? 'Treasury and Academic modules require authorization to edit.' : 'Trésorerie et Académique nécessitent un déverrouillage pour validation.')
                  : !isApeeAuthorized
                    ? (isEn ? 'Treasury / Cash operations are currently locked.' : 'Opérations financières et dépenses sont verrouillées.')
                    : (isEn ? 'Academic notes & attendance validation are locked.' : 'Gestion des notes et délibérations sont verrouillées.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isApeeAuthorized && (
              <button
                onClick={onPromptUnlockApee}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
              >
                {isEn ? 'Unlock Treasury' : 'Débloquer Trésorerie'}
              </button>
            )}
            {!isPedAuthorized && (
              <button
                onClick={onPromptUnlockPed}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
              >
                {isEn ? 'Unlock Academic' : 'Débloquer Académique'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Executive Key Figures Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Total Collected' : 'Recettes Encaissées'}
            </span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {formatMoney(totalRevenue)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="font-extrabold text-emerald-600">{realizationRate}%</span>
            <span>{isEn ? 'of annual goal' : "de l'objectif"}</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Cash in Hand' : 'Solde Disponible'}
            </span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 rounded-lg">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-indigo-650 dark:text-indigo-400 mt-2">
            {formatMoney(cashBalance)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {isEn ? 'After executed expenses' : 'Après dépenses exécutées'}
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Overdue Arrears' : 'Retards à Recouvrer'}
            </span>
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {formatMoney(totalOverdueAmount)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {overdueParents.length} {isEn ? 'families in arrears' : 'familles en retard'}
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isEn ? 'Pending Orders' : 'Bons en Attente'}
            </span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {pendingExpenses.length}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {formatMoney(pendingExpensesAmount)} {isEn ? 'to approve' : 'à valider'}
          </p>
        </div>
      </div>

      {/* Main Urgent Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Card 1: Pending Expenses to Approve */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isEn ? 'Expense Orders to Approve' : 'Dépenses à Valider'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isEn ? 'Purchase orders awaiting executive sign-off' : 'Bons de caisse et commandes en instance'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                pendingExpenses.length > 0
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 animate-pulse'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {pendingExpenses.length}
              </span>
            </div>

            {pendingExpenses.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500 opacity-80" />
                <span>{isEn ? 'No pending expense orders' : 'Aucun bon de dépense en attente'}</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {pendingExpenses.map(expense => (
                  <div
                    key={expense.id}
                    className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {expense.title}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {expense.date} • {expense.type === 'command' ? 'Bon de commande' : expense.type === 'payment-order' ? 'Ordre de virement' : 'Remboursement'}
                      </p>
                      {expense.description && (
                        <p className="text-[10px] text-slate-650 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                          "{expense.description}"
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-black text-amber-700 dark:text-amber-300 shrink-0">
                      {formatMoney(expense.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
            <button
              onClick={() => onNavigateToTab('apee_finance')}
              className="w-full text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 flex items-center justify-between cursor-pointer"
            >
              <span>{isEn ? 'Review in Treasury Journal' : 'Examiner dans le Journal Financier'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: APEE Arrears & Fee Recovery */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isEn ? 'APEE Overdue Accounts' : 'Cotisations en Retard'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isEn ? 'Uncollected parent contributions' : 'Relances nécessaires & recouvrement'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                overdueParents.length > 0
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {overdueParents.length}
              </span>
            </div>

            {overdueParents.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500 opacity-80" />
                <span>{isEn ? 'All parents are up-to-date!' : 'Toutes les cotisations sont à jour !'}</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {overdueParents.slice(0, 4).map(parent => {
                  const rest = Math.max(0, parent.totalDue - parent.totalPaid);
                  return (
                    <div
                      key={parent.id}
                      className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {parent.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {parent.phone} • {parent.students?.map(s => s.name).join(', ') || '1 élève'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-rose-600 dark:text-rose-400">
                          -{formatMoney(rest)}
                        </p>
                        <span className="text-[9px] font-bold text-slate-400">
                          {parent.totalPaid > 0 ? 'Partiel' : '0% Versé'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => onNavigateToTab('apee_reminders')}
              className="text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isEn ? 'Launch SMS Reminders' : 'Lancer les Relances'}</span>
            </button>
            <button
              onClick={() => onNavigateToTab('apee_recording')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isEn ? 'Record Payment' : 'Encaisser'}</span>
            </button>
          </div>
        </div>

        {/* Card 3: Academic Review Flags & Chronic Absences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isEn ? 'Academic & Absence Alerts' : 'Alertes Académiques & Décrochage'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isEn ? 'Contested marks and critical absenteeism' : 'Notes en révision & absences > 3'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                (pendingReviewGrades.length + criticalAbsenceStudents.length) > 0
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {pendingReviewGrades.length + criticalAbsenceStudents.length}
              </span>
            </div>

            {(pendingReviewGrades.length === 0 && criticalAbsenceStudents.length === 0) ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500 opacity-80" />
                <span>{isEn ? 'No academic contentions or critical dropouts' : 'Aucune anomalie académique détectée'}</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {/* Contested grades */}
                {pendingReviewGrades.map(grade => {
                  const s = students.find(x => x.id === grade.studentId);
                  return (
                    <div
                      key={grade.id}
                      className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {s?.name || 'Élève'} ({s?.classRoom || 'Classe'})
                        </span>
                        <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                          {grade.score}/{grade.maxScore || 20}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {grade.subject} • Note contestée
                      </p>
                    </div>
                  );
                })}

                {/* Critical Absences */}
                {criticalAbsenceStudents.map(({ student, count }) => (
                  <div
                    key={student.id}
                    className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {student.name}
                      </p>
                      <p className="text-[10px] text-rose-700 dark:text-rose-300">
                        {student.classRoom} • {count} absences enregistrées
                      </p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 rounded-md">
                      Alerte
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => onNavigateToTab('grades')}
              className="text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>{isEn ? 'Supervise Grades' : 'Modérer les Notes'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateToTab('attendance')}
              className="text-xs font-bold text-slate-650 dark:text-slate-350 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <span>{isEn ? 'Absence Registry' : "Registres d'Appel"}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Operational Executive Command Grid */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
            ⚡ {isEn ? 'Executive Operations & Fast Navigation' : 'Raccourcis de Pilotage Opérationnel'}
          </h3>
          <span className="text-[11px] font-bold text-indigo-650">
            {settings.associationName || 'Gestionnaire APEE'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          <button
            onClick={() => onNavigateToTab('apee_dashboard')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-650 dark:text-indigo-400 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Dashboard' : 'Tableau APEE'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('apee_recording')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Calculator className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Cash Receipt' : 'Encaisser'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('apee_finance')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Treasury' : 'Trésorerie'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('apee_reporting')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <History className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Reports' : 'Rapports & Audit'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('apee_reminders')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
              <Send className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Reminders' : 'Relances SMS'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('attendance')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Attendance' : 'Registres'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('apee_archives')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl">
              <Database className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Archives' : 'Sauvegardes'}
            </span>
          </button>

          <button
            onClick={() => onNavigateToTab('apee_settings')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-2xl flex flex-col items-center text-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
          >
            <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl">
              <Settings className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isEn ? 'Settings' : 'Paramètres'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
