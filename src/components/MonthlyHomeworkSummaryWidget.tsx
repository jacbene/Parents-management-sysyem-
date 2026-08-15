import React, { useMemo } from 'react';
import { Homework } from '../types';
import { 
  CalendarCheck2, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  CalendarDays, 
  ChevronRight, 
  Sparkles, 
  BookOpen, 
  Target,
  Repeat
} from 'lucide-react';

interface MonthlyHomeworkSummaryWidgetProps {
  homeworks: Homework[];
  filteredHomeworks: Homework[];
  year: number;
  month: number; // 0-indexed
  onSelectDate: (dateStr: string) => void;
  language?: string;
}

export default function MonthlyHomeworkSummaryWidget({
  homeworks,
  filteredHomeworks,
  year,
  month,
  onSelectDate,
  language = 'fr'
}: MonthlyHomeworkSummaryWidgetProps) {
  const isEn = language === 'en';

  const monthName = useMemo(() => {
    const d = new Date(year, month, 1);
    return d.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
      month: 'long',
      year: 'numeric'
    });
  }, [year, month, isEn]);

  // Calculations for current selected month
  const stats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const thisMonthHws = filteredHomeworks.filter(h => h.dueDate && h.dueDate.startsWith(prefix));
    const total = thisMonthHws.length;
    const completed = thisMonthHws.filter(h => h.status === 'Completed').length;
    const pending = thisMonthHws.filter(h => h.status === 'Pending').length;
    const recurring = thisMonthHws.filter(h => h.isRecurring).length;

    const now = Date.now();
    const overdue = thisMonthHws.filter(h => {
      if (h.status === 'Completed' || !h.dueDate) return false;
      return new Date(h.dueDate + 'T23:59:59').getTime() < now;
    }).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Upcoming deadlines in this month (or next immediate days)
    const upcomingDeadlines = thisMonthHws
      .filter(h => h.status === 'Pending')
      .sort((a, b) => new Date(a.dueDate + 'T00:00:00').getTime() - new Date(b.dueDate + 'T00:00:00').getTime())
      .slice(0, 4);

    // Subject distribution
    const subjectMap: Record<string, { total: number; completed: number }> = {};
    thisMonthHws.forEach(h => {
      const subj = h.subject || (isEn ? 'General' : 'Général');
      if (!subjectMap[subj]) {
        subjectMap[subj] = { total: 0, completed: 0 };
      }
      subjectMap[subj].total += 1;
      if (h.status === 'Completed') subjectMap[subj].completed += 1;
    });

    const topSubjects = Object.entries(subjectMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        completed: data.completed,
        rate: Math.round((data.completed / data.total) * 100)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return {
      total,
      completed,
      pending,
      recurring,
      overdue,
      completionRate,
      upcomingDeadlines,
      topSubjects
    };
  }, [filteredHomeworks, year, month, isEn]);

  // Color theme for completion rate
  const rateColor = useMemo(() => {
    if (stats.completionRate >= 80) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500';
    if (stats.completionRate >= 50) return 'text-indigo-600 dark:text-indigo-400 bg-indigo-500';
    if (stats.completionRate >= 25) return 'text-amber-600 dark:text-amber-400 bg-amber-500';
    return 'text-slate-600 dark:text-slate-400 bg-slate-500';
  }, [stats.completionRate]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-3xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-indigo-50 to-indigo-100/80 dark:from-indigo-950/80 dark:to-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200/60 dark:border-indigo-800/50">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white capitalize flex items-center gap-2">
              <span>{isEn ? 'Monthly Homework Summary' : 'Bilan Mensuel des Devoirs'}</span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {monthName}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isEn 
                ? 'Overview of assignment progress, completion rate and upcoming deadlines' 
                : 'Progression globale, taux d\'achèvement et échéances prioritaires'}
            </p>
          </div>
        </div>

        {/* Global summary badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {stats.overdue > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{stats.overdue} {isEn ? 'overdue' : 'en retard'}</span>
            </span>
          )}
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
            {stats.total} {isEn ? 'total' : 'au total'}
          </span>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Completion Rate & Progress Gauge */}
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-850/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-indigo-500" />
              {isEn ? 'Completion Rate' : 'Taux d\'Achèvement'}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
              {stats.completed}/{stats.total} {isEn ? 'done' : 'rendus'}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className={`text-2xl font-black font-mono ${rateColor.split(' ')[0]}`}>
                {stats.completionRate}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {stats.completionRate >= 80 
                  ? (isEn ? 'Excellent pace' : 'Excellent rythme')
                  : stats.completionRate >= 50 
                  ? (isEn ? 'On track' : 'En bonne voie')
                  : stats.total === 0 
                  ? (isEn ? 'No tasks' : 'Aucun devoir')
                  : (isEn ? 'Action needed' : 'Effort requis')}
              </span>
            </div>

            {/* Custom styled progress bar */}
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  stats.completionRate >= 80 ? 'bg-emerald-500' :
                  stats.completionRate >= 50 ? 'bg-indigo-600' :
                  stats.completionRate >= 25 ? 'bg-amber-500' : 'bg-slate-400'
                }`}
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/50">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              {stats.completed} {isEn ? 'Completed' : 'Terminés'}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              {stats.pending} {isEn ? 'Pending' : 'À faire'}
            </span>
            {stats.recurring > 0 && (
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                <Repeat className="h-2.5 w-2.5" />
                {stats.recurring} {isEn ? 'Recur.' : 'Réc.'}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Upcoming Deadlines List */}
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-850/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              {isEn ? 'Upcoming & Priority Deadlines' : 'Prochaines Échéances & Priorités'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {stats.upcomingDeadlines.length > 0 
                ? (isEn ? `${stats.upcomingDeadlines.length} scheduled` : `${stats.upcomingDeadlines.length} programmés`)
                : (isEn ? 'All caught up' : 'À jour')}
            </span>
          </div>

          {stats.upcomingDeadlines.length === 0 ? (
            <div className="py-4 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center gap-1">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>{isEn ? 'No pending deadlines for this month!' : 'Aucun devoir en attente pour ce mois !'}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.upcomingDeadlines.map((item) => {
                const isOverdue = new Date(item.dueDate + 'T23:59:59').getTime() < Date.now();
                const d = new Date(item.dueDate + 'T12:00:00');
                const dayStr = d.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                });

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectDate(item.dueDate)}
                    className={`p-2 rounded-lg border text-left transition hover:scale-[1.01] cursor-pointer flex items-start justify-between gap-2 ${
                      isOverdue
                        ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/80 hover:bg-rose-100/60'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {item.subject}
                        </span>
                        {item.isRecurring && (
                          <Repeat className="h-2.5 w-2.5 text-indigo-500" />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-mono font-bold block ${
                        isOverdue ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-600 dark:text-slate-300'
                      }`}>
                        {dayStr}
                      </span>
                      {isOverdue && (
                        <span className="text-[8.5px] font-bold text-rose-500 uppercase">
                          {isEn ? 'Late' : 'Retard'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Top Subjects Progress Mini-Pills */}
          {stats.topSubjects.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-750 flex-wrap">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isEn ? 'By subject:' : 'Par matière :'}
              </span>
              {stats.topSubjects.map(subj => (
                <span 
                  key={subj.name}
                  className="text-[10.5px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5"
                >
                  <span className="font-bold">{subj.name}</span>
                  <span className="font-mono text-[9.5px] text-slate-500 dark:text-slate-400">
                    ({subj.completed}/{subj.total})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
