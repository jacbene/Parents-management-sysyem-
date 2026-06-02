import React from 'react';
import { Landmark, TrendingUp, Users, GraduationCap, Percent, AlertCircle, Coins, ArrowRight, Sparkles, Search, Activity, History, Plus, Wallet2 } from 'lucide-react';
import { ComposedChart, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, Line, ReferenceLine, PieChart, Pie } from 'recharts';
import { ApeeParent, ApeeExpense, ApeeSettings, ApeeActivityLog, ApeeOtherRevenue } from '../../types';
import ApeeFinancialOverview from './ApeeFinancialOverview';
import { useLanguage } from '../../utils/TranslationContext';

interface ApeeDashboardProps {
  parents: ApeeParent[];
  expenses: ApeeExpense[];
  settings: ApeeSettings;
  onNavigate: (tab: string) => void;
  logs?: ApeeActivityLog[];
  otherRevenues?: ApeeOtherRevenue[];
}

export default function ApeeDashboard({ parents, expenses, settings, onNavigate, logs = [], otherRevenues = [] }: ApeeDashboardProps) {
  const { t, language } = useLanguage();
  const [isMounted, setIsMounted] = React.useState(false);
  const [searchLogQuery, setSearchLogQuery] = React.useState('');
  const [selectedActionFilter, setSelectedActionFilter] = React.useState('all');
  const [visibleLogsCount, setVisibleLogsCount] = React.useState(10);
  
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculations
  const parentsCount = parents.length;
  const pupilsCount = parents.reduce((sum, p) => sum + p.students.length, 0);
  const expectedStudents = settings.expectedStudents || 100;
  const expectedParentCotisations = expectedStudents * (settings.cotisationAmount || 12500);
  
  const totalDueAmount = expectedParentCotisations;
  const honorary = settings.honoraryContributions || 0;
  const subventions = settings.subventionsAndAids || 0;
  const financialGoal = settings.financialGoal || (expectedParentCotisations + honorary + subventions);

  const actualParentsPaid = parents.reduce((sum, p) => sum + p.totalPaid, 0);
  const actualHonorary = otherRevenues && otherRevenues.length > 0
    ? otherRevenues.filter(r => r.status === 'membre_honneur').reduce((sum, r) => sum + r.amount, 0)
    : (settings.actualHonoraryContributions || 0);
  const actualSubventions = otherRevenues && otherRevenues.length > 0
    ? otherRevenues.filter(r => r.status === 'institution' || r.status === 'autre').reduce((sum, r) => sum + r.amount, 0)
    : (settings.actualSubventionsAndAids || 0);
  const totalPaidRevenue = actualParentsPaid + actualHonorary + actualSubventions;
  
  const totalDeficit = Math.max(0, financialGoal - totalPaidRevenue);
  const realizationRate = financialGoal > 0 ? (totalPaidRevenue / financialGoal) * 100 : 0;
  
  // Progress against the APEE General Financial Goal Target
  const goalPercent = financialGoal > 0 ? Math.min(100, (totalPaidRevenue / financialGoal) * 100) : 0;
  const averagePayment = parentsCount > 0 ? actualParentsPaid / parentsCount : 0;

  // Expenses summary
  const totalExecutedExpenses = expenses
    .filter(e => e.status === 'Executed')
    .reduce((sum, e) => sum + e.amount, 0);
  const activeBalance = totalPaidRevenue - totalExecutedExpenses;

  // Budget calculations
  const budgetLines = settings.budgetLines || [];
  const spentByBudgetLine = expenses.reduce((acc, exp) => {
    if (exp.budgetLineId && exp.status === 'Executed') {
      acc[exp.budgetLineId] = (acc[exp.budgetLineId] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  // Budget allocation chart calculations
  const totalAllocatedBudget = budgetLines.reduce((sum, line) => sum + line.allocatedAmount, 0);
  const pieChartData = budgetLines.map(line => ({
    name: line.name,
    value: line.allocatedAmount,
    percentage: totalAllocatedBudget > 0 ? ((line.allocatedAmount / totalAllocatedBudget) * 100).toFixed(1) : '0',
    spent: spentByBudgetLine[line.id] || 0
  })).filter(item => item.value > 0);

  // Fallback if no budget lines are registered yet
  const displayPieData = pieChartData.length > 0 ? pieChartData : [
    { name: 'Fournitures scolaires', value: 1200000, percentage: '24.0', spent: 450000 },
    { name: 'Entretien & Travaux', value: 1500000, percentage: '30.0', spent: 600005 },
    { name: 'Primes enseignants', value: 1000000, percentage: '20.0', spent: 300000 },
    { name: 'Activités culturelles', value: 800000, percentage: '16.0', spent: 150000 },
    { name: 'Caisse de secours', value: 500000, percentage: '10.0', spent: 50000 },
  ];

  const PIE_COLORS = [
    '#4f46e5', // Indigo 605
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#3b82f6', // Blue 500
    '#ec4899', // Pink 500
    '#8b5cf6', // Violet 500
    '#06b6d4', // Cyan 500
    '#f43f5e', // Rose 500
  ];

  // Recharts Month level data processing
  const monthlyDataMap: { [month: string]: number } = {};
  parents.forEach(p => {
    p.payments.forEach(pay => {
      // Month format: e.g. "2026-05" -> May
      const monthStr = pay.date.slice(0, 7); 
      monthlyDataMap[monthStr] = (monthlyDataMap[monthStr] || 0) + pay.amount;
    });
  });

  // Map month names
  const monthNamesFR: { [m: string]: string } = {
    '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
    '07': 'Juil', '08': 'Août', '09': 'Sept', '10': 'Oct', '11': 'Nov', '12': 'Déc'
  };
  const monthNamesEN: { [m: string]: string } = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
  };
  const monthNames = language === 'en' ? monthNamesEN : monthNamesFR;

  const monthlyChartData = Object.keys(monthlyDataMap)
    .sort()
    .map(mKey => {
      const parts = mKey.split('-');
      const monthLabel = parts.length === 2 ? `${monthNames[parts[1]] || parts[1]} ${parts[0]}` : mKey;
      return {
        name: monthLabel,
        Montant: monthlyDataMap[mKey],
      };
    });

  // If empty, generate fallback default data so that the chart is visually stunning
  const displayChartData = monthlyChartData.length > 0 ? monthlyChartData : [
    { name: 'Spt 2025', Montant: 0 },
    { name: 'Oct 2025', Montant: 0 },
    { name: 'Nov 2025', Montant: 0 },
    { name: 'Déc 2025', Montant: 0 },
    { name: 'Jan 2026', Montant: 0 },
    { name: 'Fév 2026', Montant: 0 },
    { name: 'Mar 2026', Montant: 0 },
    { name: 'Avr 2026', Montant: 0 },
    { name: 'Mai 2026', Montant: 0 },
  ];

  // Progressive monthly-level calculations for goal visualization
  const sortedMonths = Object.keys(monthlyDataMap).sort();
  let accumulatedSum = 0;
  
  const progressionData = sortedMonths.map(mKey => {
    const parts = mKey.split('-');
    const monthLabel = parts.length === 2 ? `${monthNames[parts[1]] || parts[1]} ${parts[0]}` : mKey;
    const currentMonthAmount = monthlyDataMap[mKey];
    accumulatedSum += currentMonthAmount;
    return {
      name: monthLabel,
      "Collecte Mensuelle": currentMonthAmount,
      "Cumul Recouvré": accumulatedSum,
      "Objectif Financier": settings.financialGoal
    };
  });

  const fallbackGoal = settings.financialGoal || 5000000;
  const displayProgressionData = progressionData.length > 0 ? progressionData : [
    { name: 'Sept 2025', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Oct 2025', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Nov 2025', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Déc 2025', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Jan 2026', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Fév 2026', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Mar 2026', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Avr 2026', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
    { name: 'Mai 2026', "Collecte Mensuelle": 0, "Cumul Recouvré": 0, "Objectif Financier": fallbackGoal },
  ];

  // Class level breakdown
  const classBreakdown: { [cls: string]: { due: number; paid: number; count: number } } = {};
  parents.forEach(p => {
    p.students.forEach(s => {
      const cls = s.classRoom || 'Inconnue';
      if (!classBreakdown[cls]) {
        classBreakdown[cls] = { due: 0, paid: 0, count: 0 };
      }
      classBreakdown[cls].count += 1;
      classBreakdown[cls].due += settings.cotisationAmount;
      // Distribute parent payments proportionally to their students
      const proportionalPaid = p.totalPaid / p.students.length;
      classBreakdown[cls].paid += proportionalPaid;
    });
  });

  const classDataKeys = ['6ème', '5ème', '4ème ALL', '4ème ESP', '3ème ALL', '3ème ESP', '2nde', '1ère', 'Tle'];
  const classChartData = classDataKeys.map(cls => {
    const val = classBreakdown[cls] || { due: 0, paid: 0, count: 0 };
    return {
      name: cls,
      "Payé (FCFA)": Math.round(val.paid),
      "Exigible (FCFA)": val.due,
      "Élèves": val.count
    };
  }).filter(c => c.Élèves > 0 || parentsCount === 0);

  // If no data yet, create starter mock labels
  const displayClassData = classChartData.length > 0 ? classChartData : [
    { name: '6ème', "Payé (FCFA)": 0, "Exigible (FCFA)": 0, Élèves: 0 },
    { name: '5ème', "Payé (FCFA)": 0, "Exigible (FCFA)": 0, Élèves: 0 },
    { name: '4ème', "Payé (FCFA)": 0, "Exigible (FCFA)": 0, Élèves: 0 },
    { name: '3ème', "Payé (FCFA)": 0, "Exigible (FCFA)": 0, Élèves: 0 },
  ];

  const statCards = [
    {
      id: 'stat_revenue',
      title: language === 'en' ? 'Parent Contribution Revenues' : 'Recettes Cotisations Parents',
      value: `${actualParentsPaid.toLocaleString()} ${settings.currency || 'FCFA'}`,
      description: language === 'en' ? `Household Target: ${totalDueAmount.toLocaleString()} ${settings.currency || 'FCFA'}` : `Objectif Parent: ${totalDueAmount.toLocaleString()} F`,
      icon: Landmark,
      colorClass: 'text-emerald-650 bg-emerald-50 border-emerald-100',
    },
    {
      id: 'stat_other_revenue',
      title: t('dash.stats.other_revenues'),
      value: `${(actualHonorary + actualSubventions).toLocaleString()} ${settings.currency || 'FCFA'}`,
      description: language === 'en' ? `Sponsors: ${actualHonorary.toLocaleString()} | Grants: ${actualSubventions.toLocaleString()}` : `Honneur: ${actualHonorary.toLocaleString()} F | Aides: ${actualSubventions.toLocaleString()} F`,
      icon: Wallet2,
      colorClass: 'text-cyan-600 bg-cyan-50 border-cyan-100/80',
    },
    {
      id: 'stat_parents',
      title: t('dash.stats.registered_parents'),
      value: language === 'en' ? `${parentsCount} Households` : `${parentsCount} Parents`,
      description: language === 'en' ? `Enrolled pupils: ${pupilsCount}` : `Élèves inscrits: ${pupilsCount} enfants`,
      icon: Users,
      colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      id: 'stat_realization',
      title: t('dash.stats.rate_recette'),
      value: `${realizationRate.toFixed(1)}%`,
      description: language === 'en' ? `Average fee: ${Math.round(averagePayment).toLocaleString()} ${settings.currency || 'FCFA'}` : `Moyenne payée: ${Math.round(averagePayment).toLocaleString()} F`,
      icon: Percent,
      colorClass: 'text-amber-600 bg-amber-50 border-amber-100',
    },
    {
      id: 'stat_expenses',
      title: language === 'en' ? 'Cash Box Balance / Spent' : 'Caisse Active / Dépenses',
      value: `${activeBalance.toLocaleString()} ${settings.currency || 'FCFA'}`,
      description: language === 'en' ? `Total Spent: ${totalExecutedExpenses.toLocaleString()} ${settings.currency || 'FCFA'}` : `Caisse réelle : ${totalExecutedExpenses.toLocaleString()} F décaissés`,
      icon: Coins,
      colorClass: 'text-blue-600 bg-blue-50 border-blue-100',
    }
  ];

  return (
    <div id="content_apee_dashboard" className="space-y-6">
      
      {/* Association Header Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-slate-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-350 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold select-none border border-indigo-500/30">
            <Sparkles className="h-3 w-3 text-indigo-400" /> {language === 'en' ? 'PWA Offline & Cloud Sync Active' : 'Mode Hors Ligne PWA & Cloud Actifs'}
          </div>
          <h1 className="text-xl md:text-2xl font-bold font-sans tracking-tight">
            {settings.associationName}
          </h1>
          <p className="text-xs text-slate-300 font-medium">
            {language === 'en' ? 'Financial tracker dashboard for school year' : 'Tableau de bord financier pour l\'année scolaire'} <strong className="text-white font-semibold">{settings.schoolYear}</strong>.
          </p>
        </div>
        
        {/* Dynamic target bar on the banner itself */}
        <div className="w-full md:w-64 space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 relative z-10">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-300">
            <span>{language === 'en' ? 'BUDGETARY TARGET :' : 'OBJECTIF DU BUDGET :'}</span>
            <span className="text-slate-100 font-bold">{settings.financialGoal.toLocaleString()} {settings.currency || 'FCFA'}</span>
          </div>
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-1000"
              style={{ width: `${goalPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono font-medium text-slate-400">
            <span>{language === 'en' ? 'Reached' : 'Atteint'} : {goalPercent.toFixed(1)}%</span>
            <span>{totalPaidRevenue.toLocaleString()} {settings.currency || 'FCFA'}</span>
          </div>
        </div>
      </div>

      {/* Grid of Key Numerical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className={`p-4 rounded-2xl border bg-white flex items-start gap-3.5 transition hover:shadow-xs shadow-2xs`}>
              <div className={`p-2.5 rounded-xl border ${card.colorClass} shrink-0`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{card.title}</p>
                <p className="text-base font-bold text-slate-900 font-mono tracking-tight">{card.value}</p>
                <p className="text-[10px] text-gray-550 font-medium">{card.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bento Navigation Grid / Dynamic Shortcuts */}
      <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Accès Rapide aux Salles de Gestion</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          
          <div 
            onClick={() => onNavigate('recording')}
            className="group cursor-pointer p-4 bg-white hover:bg-slate-900 hover:text-white rounded-xl border border-slate-200/80 transition flex flex-col justify-between h-28 hover:shadow-xs"
          >
            <div className="text-xs font-bold text-slate-500 group-hover:text-amber-400 font-mono">01. ENREGISTREMENTS</div>
            <div>
              <h4 className="text-sm font-bold tracking-tight">Saisie d'une Cotisation</h4>
              <p className="text-[10px] text-gray-500 group-hover:text-slate-400 mt-0.5">Enregistrer un parent et ses versements.</p>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('search')}
            className="group cursor-pointer p-4 bg-white hover:bg-slate-900 hover:text-white rounded-xl border border-slate-200/80 transition flex flex-col justify-between h-28 hover:shadow-xs"
          >
            <div className="text-xs font-bold text-slate-500 group-hover:text-indigo-400 font-mono">02. RECHERCHES</div>
            <div>
              <h4 className="text-sm font-bold tracking-tight">Fiches Parents & Reçus</h4>
              <p className="text-[10px] text-gray-500 group-hover:text-slate-400 mt-0.5">Recherche multicritère instantanée.</p>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('reporting')}
            className="group cursor-pointer p-4 bg-white hover:bg-slate-900 hover:text-white rounded-xl border border-slate-200/80 transition flex flex-col justify-between h-28 hover:shadow-xs"
          >
            <div className="text-xs font-bold text-slate-500 group-hover:text-emerald-400 font-mono">03. BILANS</div>
            <div>
              <h4 className="text-sm font-bold tracking-tight">Générateur de Bilans</h4>
              <p className="text-[10px] text-gray-500 group-hover:text-slate-400 mt-0.5">Bilans périodiques consolidés.</p>
            </div>
          </div>

        </div>
      </div>

      {/* Annual Budget Lines Analytics Widget */}
      {budgetLines.length > 0 && (
        <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-3xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-slate-850 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                💼 Planification Budgétaire & Dépenses Consommées
              </h3>
              <p className="text-[10px] text-gray-400 font-sans">
                Taux de consommation des rubriques budgétaires approuvées pour l'exercice {settings.schoolYear}.
              </p>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="text-[10px] bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold px-3 py-1 rounded-lg transition cursor-pointer"
            >
              Plus Répartir / Modifier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1.5">
            {budgetLines.map((line) => {
              const spent = spentByBudgetLine[line.id] || 0;
              const allocated = line.allocatedAmount;
              const percent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
              
              let progressColor = 'bg-indigo-600';
              let badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-100';
              if (percent >= 100) {
                progressColor = 'bg-rose-500';
                badgeStyle = 'bg-rose-50 text-rose-700 border-rose-150';
              } else if (percent >= 80) {
                progressColor = 'bg-amber-500';
                badgeStyle = 'bg-amber-50 text-amber-700 border-amber-150';
              } else if (percent > 0) {
                progressColor = 'bg-emerald-500';
                badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-150';
              }

              return (
                <div key={line.id} className="border border-slate-150 rounded-xl p-3.5 space-y-2.5 bg-slate-50/10 hover:border-slate-300 transition duration-150 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold text-slate-800 line-clamp-1">{line.name}</span>
                      <span className={`text-[9px] font-sans font-black px-1.5 py-0.5 rounded border ${badgeStyle} shrink-0`}>
                        {percent}%
                      </span>
                    </div>
                    {line.description && (
                      <p className="text-[10px] text-gray-400 line-clamp-1 font-serif leading-none italic">{line.description}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-bold font-mono text-slate-500">
                      <span>Usé: {spent.toLocaleString()} F</span>
                      <span>Restant: {Math.max(0, allocated - spent).toLocaleString()} F</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Overview (Recharts totalExecutedExpenses vs totalRevenue over last 6 months) */}
      <ApeeFinancialOverview parents={parents} expenses={expenses} settings={settings} otherRevenues={otherRevenues} />

      {/* Journal d'Audit Financier Automatique (Temps Réel) */}
      <div id="financial_logs_audit_trail" className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-3xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase flex items-center gap-2 font-mono">
              <Activity className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
              🛡️ Journal d'Audit Financier Automatique (Temps Réel)
            </h3>
            <p className="text-[10px] text-gray-400 font-sans">
              Historique immuable généré automatiquement lors de chaque modification financière sur les fiches des parents.
            </p>
          </div>
          <div className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2.5 py-1 font-mono">
            Total : {logs.length} Événements
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center select-none text-xs">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-405" />
            <input 
              type="text" 
              placeholder="Rechercher un parent, opérateur, montant..."
              value={searchLogQuery}
              onChange={(e) => {
                setSearchLogQuery(e.target.value);
                setVisibleLogsCount(10); // reset page count
              }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans text-xs"
            />
            {searchLogQuery && (
              <button 
                onClick={() => setSearchLogQuery('')}
                className="absolute right-2 top-2.5 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
              >
                Vider
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Filtrer par action:</span>
            <select
              value={selectedActionFilter}
              onChange={(e) => {
                setSelectedActionFilter(e.target.value);
                setVisibleLogsCount(10); // reset page count
              }}
              className="px-2.5 py-2 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs text-slate-700"
            >
              <option value="all">Toutes les actions</option>
              <option value="CREATE_PARENT">Nouveau dossier parent</option>
              <option value="UPDATE_PARENT">Mise à jour des fiches</option>
              <option value="ADD_PAYMENT">Nouveau versement (acompte)</option>
              <option value="REMOVE_PAYMENT">Annulation de versement</option>
              <option value="DELETE_PARENT">Suppression complète</option>
              <option value="MANUAL_ENTRY">Saisie administrative</option>
            </select>
          </div>
        </div>

        {/* Live Logs stream list */}
        <div className="space-y-2">
          {(() => {
            const sortedLogsList = [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            const filtered = sortedLogsList.filter(log => {
              const query = searchLogQuery.toLowerCase();
              const termMatches = 
                log.parentName.toLowerCase().includes(query) ||
                log.description.toLowerCase().includes(query) ||
                (log.operatorName || '').toLowerCase().includes(query) ||
                log.id.toLowerCase().includes(query);
              
              const actionMatches = selectedActionFilter === 'all' || log.actionType === selectedActionFilter;
              return termMatches && actionMatches;
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-8 bg-slate-50 border border-slate-150 rounded-xl space-y-2 select-none">
                  <History className="h-7 w-7 text-gray-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Aucun événement de log financier ne correspond à vos filtres.</p>
                  <p className="text-[10px] text-slate-400 font-mono">Modifiez vos critères de recherche.</p>
                </div>
              );
            }

            const pageLogs = filtered.slice(0, visibleLogsCount);

            return (
              <div className="space-y-2.5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date & Heure</th>
                        <th className="py-2.5 px-3">Type d'opération</th>
                        <th className="py-2.5 px-3">Parent d'élève</th>
                        <th className="py-2.5 px-3">Détails de l'action</th>
                        <th className="py-2.5 px-3 text-right">Mouvement</th>
                        <th className="py-2.5 px-3">Auteur / Opérateur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageLogs.map((log) => {
                        let actionLabel = 'Audit';
                        let actionClass = 'text-slate-700 bg-slate-50 border-slate-200';
                        
                        switch (log.actionType) {
                          case 'CREATE_PARENT':
                            actionLabel = 'Création Fiche';
                            actionClass = 'text-blue-700 bg-blue-50 border-blue-150';
                            break;
                          case 'UPDATE_PARENT':
                            actionLabel = 'Mise à jour';
                            actionClass = 'text-indigo-700 bg-indigo-50 border-indigo-150';
                            break;
                          case 'ADD_PAYMENT':
                            actionLabel = 'Versement';
                            actionClass = 'text-emerald-700 bg-emerald-50 border-emerald-150';
                            break;
                          case 'REMOVE_PAYMENT':
                            actionLabel = 'Suppr. Versement';
                            actionClass = 'text-amber-700 bg-amber-50 border-amber-150';
                            break;
                          case 'DELETE_PARENT':
                            actionLabel = 'Suppression Fiche';
                            actionClass = 'text-rose-700 bg-rose-50 border-rose-150';
                            break;
                          case 'MANUAL_ENTRY':
                            actionLabel = 'Administratif';
                            actionClass = 'text-purple-700 bg-purple-50 border-purple-150';
                            break;
                        }

                        // Format timestamp nicely
                        let finalDateStr = log.timestamp;
                        try {
                          const dateObj = new Date(log.timestamp);
                          if (!isNaN(dateObj.getTime())) {
                            finalDateStr = dateObj.toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }) + ' à ' + dateObj.toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          }
                        } catch (e) {
                          // fallback to raw
                        }

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-3 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">{finalDateStr}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded border text-[9.5px] font-bold inline-block whitespace-nowrap ${actionClass}`}>
                                {actionLabel}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-slate-900 leading-none whitespace-nowrap">{log.parentName}</div>
                              <span className="text-[9.5px] text-gray-400 font-mono tracking-wider">Réf: {log.parentId}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-650 leading-relaxed max-w-sm shrink-0 min-w-[200px]">{log.description}</td>
                            <td className="py-3 px-3 text-right">
                              {log.amount > 0 ? (
                                <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                                  log.actionType === 'REMOVE_PAYMENT' || log.actionType === 'DELETE_PARENT'
                                    ? 'text-red-700 bg-red-50'
                                    : 'text-emerald-700 bg-emerald-50'
                                }`}>
                                  {log.actionType === 'REMOVE_PAYMENT' || log.actionType === 'DELETE_PARENT' ? '-' : '+'} {log.amount.toLocaleString()} F
                                </span>
                              ) : (
                                <span className="font-mono text-slate-350 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-sans text-[11px] text-slate-500 font-medium whitespace-nowrap">
                              🧑‍💻 {log.operatorName || 'Jacques Béné'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filtered.length > visibleLogsCount && (
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => setVisibleLogsCount(prev => prev + 15)}
                      className="text-[10px] font-black bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl px-4 py-2 transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Charger plus de logs
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Visual Analytics Block (Charts) */}
      <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase pt-2">Graphiques et Indicateurs de Collecte</h3>
      
      {/* Full-width cumulative vs target composed chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-150 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-indigo-600" /> Progression Cumulative de la Trésorerie vs Objectif Financier
            </h4>
            <p className="text-[10px] text-gray-400">Progression des montants cumulés face au budget global annuel de {settings.financialGoal.toLocaleString()} FCFA.</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block"></span> Cumul Recouvré</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-indigo-200 inline-block rounded-xs"></span> Collectes mensuelles</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t border-dashed border-rose-500 inline-block"></span> Objectif ({settings.financialGoal.toLocaleString()} F)</span>
          </div>
        </div>
        
        <div className="h-72">
          {isMounted ? (
            <ResponsiveContainer width="100%" height={288} minWidth={0}>
              <ComposedChart data={displayProgressionData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCumulativeProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip 
                  formatter={(value, name) => [`${Number(value).toLocaleString()} FCFA`, name]} 
                  contentStyle={{ fontSize: 11, borderRadius: 12, backgroundColor: '#0f172a', color: '#fff', border: 'none' }} 
                />
                <Bar dataKey="Collecte Mensuelle" fill="#6366f1" opacity={0.6} radius={[4, 4, 0, 0]} barSize={34} />
                <Area type="monotone" dataKey="Cumul Recouvré" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCumulativeProgress)" />
                <ReferenceLine y={settings.financialGoal} stroke="#f43f5e" strokeDasharray="5 5" label={{ value: 'Objectif de Caisse', fill: '#f43f5e', fontSize: 9, position: 'top', fontWeight: 'bold' }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400 font-medium">Chargement du graphique...</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Area chart of cumulative revenues */}
        <div className="bg-white p-4 rounded-2xl border border-slate-150 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Flux mensuel des versements
            </h4>
            <p className="text-[10px] text-gray-400">Total cumulé inscrit par mois fiscal.</p>
          </div>
          <div className="h-56">
            {isMounted ? (
              <ResponsiveContainer width="100%" height={224} minWidth={0}>
                <AreaChart data={displayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip formatter={(value) => [`${value.toLocaleString()} FCFA`, 'Collectes']} contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                  <Area type="monotone" dataKey="Montant" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400 font-medium font-sans">Chargement...</div>
            )}
          </div>
        </div>

        {/* Bar chart comparing class values */}
        <div className="bg-white p-4 rounded-2xl border border-slate-150 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-indigo-500" /> Versements par Classe d'élèves
            </h4>
            <p className="text-[10px] text-gray-400">Comparatif entre montants reçus et exigibles.</p>
          </div>
          <div className="h-56">
            {isMounted ? (
              <ResponsiveContainer width="100%" height={224} minWidth={0}>
                <BarChart data={displayClassData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip formatter={(value) => [`${value.toLocaleString()} FCFA`, '']} contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Payé (FCFA)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Exigible (FCFA)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400 font-medium font-sans">Chargement...</div>
            )}
          </div>
        </div>

        {/* Pie chart of Budget Allocation */}
        <div className="bg-white p-4 rounded-2xl border border-slate-150 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-indigo-600" /> Répartition du Budget Prévu
            </h4>
            <p className="text-[10px] text-gray-400">Distribution par ligne de budget allouée.</p>
          </div>
          <div className="h-56 relative flex items-center justify-center">
            {isMounted ? (
              <ResponsiveContainer width="100%" height={224} minWidth={0}>
                <PieChart>
                  <Pie
                    data={displayPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {displayPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const entry = props.payload as any;
                      return [
                        `${Number(value).toLocaleString()} FCFA (${entry?.percentage || 0}%)`, 
                        'Allocation Prévue'
                      ];
                    }}
                    contentStyle={{ fontSize: 10, borderRadius: 12 }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400 font-medium font-sans">Chargement...</div>
            )}
            {/* Centered Total Indicator */}
            <div className="absolute inset-x-0 top-18 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[8px] font-sans font-black text-slate-400 uppercase tracking-widest leading-none">Alloué</span>
              <span className="text-[10px] font-mono font-bold text-slate-800 tracking-tight mt-1">
                {totalAllocatedBudget > 0 ? totalAllocatedBudget.toLocaleString() : '5 000 000'} F
              </span>
            </div>
          </div>
          
          {/* Custom Mini Legende representing the slices */}
          <div className="grid grid-cols-2 gap-1.5 text-[9px] max-h-24 overflow-y-auto pt-1 border-t border-slate-100">
            {displayPieData.slice(0, 6).map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5 min-w-0" title={`${item.name} (${item.percentage}%)`}>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                <span className="text-slate-650 truncate font-semibold">{item.name}</span>
                <span className="text-slate-400 font-mono shrink-0 font-medium">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
