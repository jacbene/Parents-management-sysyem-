import React, { useState, useMemo } from 'react';
import { Homework } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Trash2, 
  Plus, 
  Repeat, 
  CheckCircle2, 
  Sparkles,
  CalendarDays,
  Check,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MonthlyHomeworkSummaryWidget from './MonthlyHomeworkSummaryWidget';

interface HomeworkCalendarViewProps {
  homeworks: Homework[];
  filteredHomeworks: Homework[];
  onToggleStatus: (hw: Homework) => void;
  onDeletePrompt: (hw: Homework) => void;
  onQuickAddForDate: (dateStr: string) => void;
  updatingId: string | null;
  isPedAuthorized?: boolean;
  language?: string;
  onExportPDF?: () => void;
}

export default function HomeworkCalendarView({
  homeworks,
  filteredHomeworks,
  onToggleStatus,
  onDeletePrompt,
  onQuickAddForDate,
  updatingId,
  isPedAuthorized = false,
  language = 'fr',
  onExportPDF
}: HomeworkCalendarViewProps) {
  const isEn = language === 'en';

  // Current viewed month & year
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Group homeworks by dueDate ("YYYY-MM-DD")
  const homeworksByDate = useMemo(() => {
    const map: Record<string, Homework[]> = {};
    filteredHomeworks.forEach(hw => {
      const d = hw.dueDate ? hw.dueDate.split('T')[0] : '';
      if (d) {
        if (!map[d]) map[d] = [];
        map[d].push(hw);
      }
    });
    return map;
  }, [filteredHomeworks]);

  // Statistics for current month
  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const thisMonthHws = filteredHomeworks.filter(h => h.dueDate && h.dueDate.startsWith(prefix));
    const completed = thisMonthHws.filter(h => h.status === 'Completed').length;
    const pending = thisMonthHws.filter(h => h.status === 'Pending').length;
    const recurring = thisMonthHws.filter(h => h.isRecurring).length;
    const overdue = thisMonthHws.filter(h => h.status === 'Pending' && new Date(h.dueDate + 'T23:59:59').getTime() < Date.now()).length;

    return {
      total: thisMonthHws.length,
      completed,
      pending,
      recurring,
      overdue
    };
  }, [filteredHomeworks, year, month]);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    // Monday-based indexing: Mon=0, Tue=1, ..., Sun=6
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      homeworksList: Homework[];
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dStr = prevDate.toISOString().split('T')[0];
      days.push({
        dayNumber: dNum,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        homeworksList: homeworksByDate[dStr] || []
      });
    }

    // Current month days
    for (let dNum = 1; dNum <= totalDays; dNum++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dayNumber: dNum,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        homeworksList: homeworksByDate[dStr] || []
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        const nextDate = new Date(year, month + 1, i);
        const dStr = nextDate.toISOString().split('T')[0];
        days.push({
          dayNumber: i,
          dateStr: dStr,
          isCurrentMonth: false,
          isToday: dStr === todayStr,
          homeworksList: homeworksByDate[dStr] || []
        });
      }
    }

    return days;
  }, [year, month, homeworksByDate]);

  const weekDayLabels = isEn 
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const monthName = currentDate.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
    month: 'long',
    year: 'numeric'
  });

  const selectedDayHomeworks = useMemo(() => {
    return homeworksByDate[selectedDateStr] || [];
  }, [homeworksByDate, selectedDateStr]);

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateStr) return '';
    const d = new Date(selectedDateStr + 'T12:00:00');
    return d.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [selectedDateStr, isEn]);

  return (
    <div className="space-y-4">
      {/* Calendar Header & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white capitalize leading-tight flex items-center gap-2">
              <span>{monthName}</span>
              {monthStats.total > 0 && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  {monthStats.total} {isEn ? 'due' : 'à rendre'}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isEn ? "Click on any day to inspect or add assignments" : "Cliquez sur un jour pour consulter ou planifier un devoir"}
            </p>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
          {onExportPDF && (
            <button
              type="button"
              onClick={onExportPDF}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5"
              title={isEn ? "Export PDF Summary" : "Exporter Synthèse PDF"}
            >
              <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isEn ? "PDF Summary" : "Synthèse PDF"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-slate-200/80 dark:border-slate-800"
            title={isEn ? "Previous month" : "Mois précédent"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-slate-200/80 dark:border-slate-800"
          >
            {isEn ? "Today" : "Aujourd'hui"}
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-slate-200/80 dark:border-slate-800"
            title={isEn ? "Next month" : "Mois suivant"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Monthly Homework Summary Widget */}
      <MonthlyHomeworkSummaryWidget
        homeworks={homeworks}
        filteredHomeworks={filteredHomeworks}
        year={year}
        month={month}
        onSelectDate={(dStr) => setSelectedDateStr(dStr)}
        language={language}
      />

      {/* Monthly Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-3xs">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 text-center">
          {weekDayLabels.map((lbl, i) => (
            <div 
              key={lbl} 
              className={`py-2.5 text-[11px] font-black uppercase tracking-wider ${
                i >= 5 ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {lbl}
            </div>
          ))}
        </div>

        {/* Days matrix */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-150 dark:divide-slate-800">
          {calendarDays.map((cDay) => {
            const hasHw = cDay.homeworksList.length > 0;
            const isSelected = cDay.dateStr === selectedDateStr;
            const completedCount = cDay.homeworksList.filter(h => h.status === 'Completed').length;
            const pendingCount = cDay.homeworksList.filter(h => h.status === 'Pending').length;

            return (
              <div
                key={cDay.dateStr}
                onClick={() => setSelectedDateStr(cDay.dateStr)}
                className={`min-h-[92px] sm:min-h-[105px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between group relative select-none ${
                  !cDay.isCurrentMonth
                    ? 'bg-slate-50/40 dark:bg-slate-950/40 text-slate-300 dark:text-slate-600'
                    : 'bg-white dark:bg-slate-900 hover:bg-indigo-50/25 dark:hover:bg-indigo-950/20'
                } ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/30 dark:bg-indigo-950/40 z-10'
                    : ''
                }`}
              >
                {/* Day Header Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-bold h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                      cDay.isToday
                        ? 'bg-indigo-600 text-white font-black shadow-xs'
                        : isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-extrabold'
                        : cDay.isCurrentMonth
                        ? 'text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 font-semibold'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  >
                    {cDay.dayNumber}
                  </span>

                  {hasHw && (
                    <span 
                      className={`text-[9.5px] font-mono font-black px-1.5 py-0.2 rounded-full border ${
                        pendingCount > 0
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {cDay.homeworksList.length}
                    </span>
                  )}
                </div>

                {/* Homework Chips Preview */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {cDay.homeworksList.slice(0, 2).map((item) => {
                    const isDone = item.status === 'Completed';
                    const isPast = new Date(item.dueDate + 'T23:59:59').getTime() < Date.now() && !isDone;

                    return (
                      <div
                        key={item.id}
                        title={`${item.subject}: ${item.title}`}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate flex items-center gap-1 border transition ${
                          isDone
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 opacity-80'
                            : isPast
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 font-bold'
                            : item.isRecurring
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                        ) : item.isRecurring ? (
                          <Repeat className="h-2.5 w-2.5 text-indigo-600 shrink-0" />
                        ) : (
                          <Circle className="h-2 w-2 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{item.subject}</span>
                      </div>
                    );
                  })}

                  {cDay.homeworksList.length > 2 && (
                    <div className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 pl-1">
                      +{cDay.homeworksList.length - 2} {isEn ? 'more' : 'autres'}
                    </div>
                  )}
                </div>

                {/* Hover Add Shortcut indicator */}
                <div className="h-1 flex items-center justify-end">
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-3xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-150 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white capitalize">
                {selectedDateFormatted}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedDayHomeworks.length === 0
                  ? (isEn ? "No assignments scheduled for this date" : "Aucun devoir programmé pour cette date")
                  : `${selectedDayHomeworks.length} ${isEn ? "assignment(s) for this day" : "devoir(s) prévu(s) ce jour"}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onQuickAddForDate(selectedDateStr)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isEn ? "Add for this Date" : "Ajouter pour ce jour"}</span>
          </button>
        </div>

        {selectedDayHomeworks.length === 0 ? (
          <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-1.5 text-slate-300 dark:text-slate-600" />
            <p>{isEn ? "You can plan homework for this day using the button above." : "Vous pouvez planifier un nouveau devoir pour cette journée avec le bouton ci-dessus."}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDayHomeworks.map((hw) => {
              const isExpired = new Date(hw.dueDate + 'T23:59:59').getTime() < Date.now() && hw.status === 'Pending';
              const isCustom = hw.id.startsWith('hw_') && Number(hw.id.split('_')[1]) > 10000;

              return (
                <div
                  key={hw.id}
                  className={`p-3.5 bg-slate-50/70 dark:bg-slate-850/60 border rounded-xl flex items-start gap-3 transition-all ${
                    hw.status === 'Completed'
                      ? 'border-emerald-200/60 dark:border-emerald-900/40 opacity-80'
                      : isExpired
                      ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/20'
                      : hw.isRecurring
                      ? 'border-indigo-200 dark:border-indigo-900/50'
                      : 'border-slate-200 dark:border-slate-750'
                  }`}
                >
                  {/* Status checkbox */}
                  <button
                    type="button"
                    onClick={() => onToggleStatus(hw)}
                    disabled={updatingId === hw.id}
                    className="mt-0.5 shrink-0 cursor-pointer text-gray-400 hover:text-indigo-600 transition"
                  >
                    {updatingId === hw.id ? (
                      <span className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin block" />
                    ) : hw.status === 'Completed' ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 fill-emerald-50" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300 hover:text-indigo-600" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        {hw.subject}
                      </span>

                      {hw.isRecurring && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center gap-1">
                          <Repeat className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
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
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md">
                          Note : {hw.grade}
                        </span>
                      )}

                      {isExpired && (
                        <span className="text-[9.5px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {isEn ? "Overdue" : "En retard"}
                        </span>
                      )}
                    </div>

                    <h5 className={`text-xs font-bold ${hw.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {hw.title}
                    </h5>

                    {hw.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {hw.description}
                      </p>
                    )}
                  </div>

                  {/* Delete action */}
                  <button
                    type="button"
                    onClick={() => onDeletePrompt(hw)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100/40 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer shrink-0"
                    title={isEn ? "Delete this assignment" : "Supprimer ce devoir"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
