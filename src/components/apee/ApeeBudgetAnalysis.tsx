import React, { useState, useEffect } from 'react';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  PieChart as PieIcon, 
  BarChart3, 
  Activity, 
  Check, 
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { ApeeExpense, ApeeSettings, ApeeParent, ApeeOtherRevenue, ApeeBudgetLine } from '../../types';
import { useLanguage } from '../../utils/TranslationContext';

interface ApeeBudgetAnalysisProps {
  expenses: ApeeExpense[];
  settings: ApeeSettings;
  parents?: ApeeParent[];
  otherRevenues?: ApeeOtherRevenue[];
  totalRevenue: number;
}

export default function ApeeBudgetAnalysis({
  expenses,
  settings,
  parents = [],
  otherRevenues = [],
  totalRevenue
}: ApeeBudgetAnalysisProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'healthy' | 'overspent'>('all');
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'compare' | 'distribution'>('compare');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Get raw budget lines from settings
  const budgetLines = settings.budgetLines || [];

  // 2. Calculations for revenues
  const parentsContribution = parents.length > 0 ? parents.reduce((sum, p) => sum + p.totalPaid, 0) : totalRevenue;
  const otherContribution = otherRevenues.length > 0 ? otherRevenues.reduce((sum, r) => sum + r.amount, 0) : 0;
  const grandTotalRevenue = parentsContribution + otherContribution;

  // 3. Pre-calculate expenses by budget line ID
  const executedByBudgetLine = expenses.reduce((acc, exp) => {
    if (exp.budgetLineId && exp.status === 'Executed') {
      acc[exp.budgetLineId] = (acc[exp.budgetLineId] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const pendingByBudgetLine = expenses.reduce((acc, exp) => {
    if (exp.budgetLineId && exp.status !== 'Executed') {
      acc[exp.budgetLineId] = (acc[exp.budgetLineId] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  // 4. Calculate overall totals
  const totalPlannedBudget = budgetLines.reduce((sum, line) => sum + line.allocatedAmount, 0);
  const totalExecutedExpenses = expenses.filter(e => e.status === 'Executed').reduce((sum, e) => sum + e.amount, 0);
  const totalPendingExpenses = expenses.filter(e => e.status !== 'Executed').reduce((sum, e) => sum + e.amount, 0);

  // Uncategorized expenses (no budget line ID assigned)
  const uncategorizedExecuted = expenses
    .filter(e => !e.budgetLineId && e.status === 'Executed')
    .reduce((sum, e) => sum + e.amount, 0);

  const uncategorizedPending = expenses
    .filter(e => !e.budgetLineId && e.status !== 'Executed')
    .reduce((sum, e) => sum + e.amount, 0);

  const uncategorizedExpensesList = expenses.filter(e => !e.budgetLineId);

  // 5. Construct analysis rows for each budget line
  const analysisData = budgetLines.map(line => {
    const executed = executedByBudgetLine[line.id] || 0;
    const pending = pendingByBudgetLine[line.id] || 0;
    const allocated = line.allocatedAmount;
    const remaining = Math.max(0, allocated - executed);
    const consumptionPercent = allocated > 0 ? (executed / allocated) * 100 : 0;
    const lineExpenses = expenses.filter(e => e.budgetLineId === line.id);

    return {
      id: line.id,
      name: line.name,
      description: line.description || '',
      allocated,
      executed,
      pending,
      remaining,
      consumptionPercent,
      isOverspent: executed > allocated,
      expenses: lineExpenses
    };
  });

  // Filter and search
  const filteredAnalysisRows = analysisData.filter(row => {
    const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          row.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterLevel === 'critical') {
      return row.consumptionPercent >= 80 && row.consumptionPercent <= 100;
    } else if (filterLevel === 'healthy') {
      return row.consumptionPercent < 80;
    } else if (filterLevel === 'overspent') {
      return row.consumptionPercent > 100;
    }
    return true;
  });

  // 6. Chart Datasets
  const chartDataCompare = analysisData.map(row => ({
    name: row.name.length > 20 ? row.name.substring(0, 18) + '...' : row.name,
    fullName: row.name,
    [isEn ? "Allocated" : "Budget Prévu"]: row.allocated,
    [isEn ? "Executed" : "Dépenses Exécutées"]: row.executed,
    [isEn ? "Pending" : "Dépenses Planifiées"]: row.pending,
    [isEn ? "Consumption %" : "Taux Exécution %"]: Math.round(row.consumptionPercent)
  }));

  // Pie chart dataset (only rows with actual executed expenses > 0)
  const pieData = analysisData
    .filter(row => row.executed > 0)
    .map(row => ({
      name: row.name,
      value: row.executed
    }));

  if (uncategorizedExecuted > 0) {
    pieData.push({
      name: isEn ? "Uncategorized Expenses" : "Dépenses Non Affectées",
      value: uncategorizedExecuted
    });
  }

  // Beautiful modern colors for the distribution pie chart
  const PIE_COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#14b8a6', '#6366f1', '#a855f7'
  ];

  // Global percentages
  const overallExecutionRate = totalPlannedBudget > 0 ? (totalExecutedExpenses / totalPlannedBudget) * 100 : 0;
  const overallTreasuryRatio = grandTotalRevenue > 0 ? (totalExecutedExpenses / grandTotalRevenue) * 100 : 0;
  const remainingGeneralFunds = grandTotalRevenue - totalExecutedExpenses;

  // Toggle expanded budget line details
  const toggleExpand = (id: string) => {
    if (expandedLineId === id) {
      setExpandedLineId(null);
    } else {
      setExpandedLineId(id);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('fr-FR') + ' FCFA';
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono select-none">
        
        {/* Card 1: Total Planned Budget */}
        <div className="bg-white border border-slate-150 p-4.5 rounded-2xl flex flex-col justify-between space-y-2 shadow-3xs">
          <span className="text-[10px] text-slate-450 font-black uppercase tracking-wider flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-indigo-550" />
            {isEn ? "TOTAL PLANNED BUDGET" : "ENVELOPPE BUDGÉTAIRE"}
          </span>
          <div>
            <p className="text-xl font-bold text-slate-850">
              {formatCurrency(totalPlannedBudget)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {budgetLines.length} {isEn ? "budget rubrics defined" : "lignes budgétaires allouées"}
            </p>
          </div>
        </div>

        {/* Card 2: Total Executed Budget */}
        <div className="bg-white border border-slate-150 p-4.5 rounded-2xl flex flex-col justify-between space-y-2 shadow-3xs">
          <span className="text-[10px] text-slate-450 font-black uppercase tracking-wider flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-emerald-550" />
            {isEn ? "TOTAL EXECUTED EXPENSES" : "DÉPENSES EFFECTIVES"}
          </span>
          <div>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(totalExecutedExpenses)}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
              <span className="bg-emerald-100 text-emerald-850 px-1.5 py-0.2 rounded-md font-black">
                {Math.round(overallExecutionRate)}%
              </span>
              <span>{isEn ? "global consumption" : "du budget alloué consommé"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Cash balance and safety ratio */}
        <div className="bg-white border border-slate-150 p-4.5 rounded-2xl flex flex-col justify-between space-y-2 shadow-3xs">
          <span className="text-[10px] text-slate-450 font-black uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-blue-550" />
            {isEn ? "CASH FLOW RESERVE" : "DISPONIBILITÉS EN CAISSE"}
          </span>
          <div>
            <p className="text-xl font-bold text-blue-650">
              {formatCurrency(remainingGeneralFunds)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <span>{isEn ? "Total revenues:" : "Total recettes:"}</span>
              <span className="font-bold text-slate-600">{grandTotalRevenue.toLocaleString()} FCFA</span>
            </p>
          </div>
        </div>

        {/* Card 4: Overspend Risks */}
        <div className="bg-white border border-slate-150 p-4.5 rounded-2xl flex flex-col justify-between space-y-2 shadow-3xs">
          <span className="text-[10px] text-slate-450 font-black uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            {isEn ? "BUDGET OVERRUNS" : "RISQUES DE DÉPASSEMENT"}
          </span>
          <div>
            {analysisData.filter(d => d.isOverspent).length > 0 ? (
              <>
                <p className="text-xl font-bold text-rose-600 animate-pulse">
                  {analysisData.filter(d => d.isOverspent).length} {isEn ? "Rubric(s)" : "Rubrique(s)"}
                </p>
                <p className="text-[10px] text-red-500 font-black tracking-tight uppercase">
                  ⚠️ {isEn ? "DEFICIT ALERTS DETECTED" : "LIGNES BUDGÉTAIRES DEPASSÉES"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {isEn ? "Perfect" : "Aucun"}
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold">
                  {isEn ? "All expenses under check" : "Toutes les lignes sont équilibrées"}
                </p>
              </>
            )}
          </div>
        </div>

      </div>

      {/* 2. Charts Visualizer Section */}
      {budgetLines.length > 0 ? (
        <div className="bg-white border border-slate-150 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-850 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-500" />
                {isEn ? "Interactive Budget Consumption Charts" : "Représentation Graphique de l'Exécution Budgétaire"}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {isEn ? "Visualize planned amounts versus executed and pending payouts" : "Analyse visuelle et répartition des fonds mobilisés et décaissés"}
              </p>
            </div>

            {/* Chart toggle tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl self-end sm:self-auto select-none">
              <button
                type="button"
                onClick={() => setActiveChartTab('compare')}
                className={`py-1 px-3 text-[11px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeChartTab === 'compare'
                    ? 'bg-white text-slate-900 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>{isEn ? "Comparison View" : "Comparatif Rubriques"}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('distribution')}
                className={`py-1 px-3 text-[11px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeChartTab === 'distribution'
                    ? 'bg-white text-slate-900 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <PieIcon className="h-3.5 w-3.5" />
                <span>{isEn ? "Expense Breakdown" : "Répartition des dépenses"}</span>
              </button>
            </div>
          </div>

          {/* Render Recharts Area */}
          {isMounted ? (
            <div className="h-[340px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {activeChartTab === 'compare' ? (
                  <ComposedChart
                    data={chartDataCompare}
                    margin={{ top: 10, right: 10, bottom: 25, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000)}k` : val}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                      labelStyle={{ fontWeight: 'black', color: '#38bdf8', fontSize: '11px', marginBottom: '4px' }}
                      itemStyle={{ fontSize: '11px', padding: '1px 0' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
                    />
                    {/* Primary Bars for comparison */}
                    <Bar 
                      dataKey={isEn ? "Allocated" : "Budget Prévu"} 
                      fill="#6366f1" 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={45}
                    />
                    <Bar 
                      dataKey={isEn ? "Executed" : "Dépenses Exécutées"} 
                      fill="#10b981" 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={45}
                    />
                    {/* Stacked/Secondary representation or execution rate line */}
                    <Line 
                      type="monotone" 
                      dataKey={isEn ? "Consumption %" : "Taux Exécution %"} 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      yAxisId={0}
                      name={isEn ? "Consumption Rate (%)" : "Taux d'Exécution (%)"}
                    />
                  </ComposedChart>
                ) : (
                  pieData.length > 0 ? (
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => formatCurrency(Number(value))}
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', marginTop: '10px' }}
                      />
                    </PieChart>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 font-medium text-xs select-none">
                      <FolderOpen className="h-8 w-8 text-slate-300 mb-2" />
                      <span>{isEn ? "No executed expenses to display in the breakdown." : "Aucune dépense exécutée à afficher dans la répartition."}</span>
                    </div>
                  )
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[340px] bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center">
              <span className="text-xs text-slate-400 font-mono">Chargement de la zone graphique...</span>
            </div>
          )}
        </div>
      ) : null}

      {/* 3. Detailed breakdown table */}
      <div className="bg-white border border-slate-150 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-850 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="h-4.5 w-4.5 text-indigo-500" />
              {isEn ? "Line-by-Line Budget Auditing" : "Suivi Détaillé Rubrique par Rubrique"}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {isEn ? "Expand individual lines to review localized ledger expenses" : "Cliquez sur une ligne pour inspecter l'historique des bons et paiements associés"}
            </p>
          </div>

          {/* Search and filter controls */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={isEn ? "Search Rubric..." : "Rechercher rubrique..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 w-full sm:w-[180px]"
              />
            </div>

            {/* Filter select */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none bg-slate-50 text-slate-600"
            >
              <option value="all">📊 {isEn ? "All lines" : "Toutes les lignes"}</option>
              <option value="healthy">🟢 {isEn ? "Under 80% Consumed" : "Moins de 80% consommé"}</option>
              <option value="critical">🟡 {isEn ? "Warning (80%-100%)" : "Alerte de consommation (80%-100%)"}</option>
              <option value="overspent">🔴 {isEn ? "Overspent (>100%)" : "Lignes en dépassement"}</option>
            </select>
          </div>
        </div>

        {/* Budget lines table */}
        {budgetLines.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-250">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2 animate-bounce" />
            <h4 className="text-xs font-black text-slate-800 uppercase mb-1">
              {isEn ? "No Budget Lines Configured" : "Aucune ligne budgétaire configurée"}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed mb-4">
              {isEn 
                ? "Go to the Settings tab to initialize your school's structural budget lines, allocate funds, and link expenses."
                : "Rendez-vous dans l'onglet Configuration pour initialiser les rubriques budgétaires de l'établissement (allouer les fonds annuels)."}
            </p>
          </div>
        ) : filteredAnalysisRows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-medium text-xs">
            {isEn ? "No budget lines match your search filters." : "Aucune ligne budgétaire ne correspond à vos filtres."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-slate-400 font-black tracking-wider uppercase text-[10px] bg-slate-50/50">
                  <th className="py-3 px-3 w-[8px]"></th>
                  <th className="py-3 px-3">{isEn ? "Budget Line" : "Rubrique Budgétaire"}</th>
                  <th className="py-3 px-3 text-right">{isEn ? "Allocated" : "Budget Alloué"}</th>
                  <th className="py-3 px-3 text-right text-emerald-600">{isEn ? "Executed" : "Montant Consommé"}</th>
                  <th className="py-3 px-3 text-right text-amber-600">{isEn ? "Pending" : "Engagé / En Attente"}</th>
                  <th className="py-3 px-3 text-right">{isEn ? "Remaining" : "Solde Restant"}</th>
                  <th className="py-3 px-3 text-center w-[120px]">{isEn ? "Utilization" : "Consommation"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAnalysisRows.map((row) => {
                  const isExpanded = expandedLineId === row.id;
                  
                  // progress bar styling
                  let progressColor = 'bg-indigo-600';
                  let textColorClass = 'text-indigo-700';
                  let bgBadgeClass = 'bg-indigo-50 border-indigo-200';
                  
                  if (row.consumptionPercent >= 100) {
                    progressColor = 'bg-rose-500';
                    textColorClass = 'text-rose-700 font-black';
                    bgBadgeClass = 'bg-rose-50 border-rose-200 animate-pulse';
                  } else if (row.consumptionPercent >= 80) {
                    progressColor = 'bg-amber-500';
                    textColorClass = 'text-amber-700 font-black';
                    bgBadgeClass = 'bg-amber-50 border-amber-200';
                  } else if (row.consumptionPercent > 0) {
                    progressColor = 'bg-emerald-500';
                    textColorClass = 'text-emerald-700 font-black';
                    bgBadgeClass = 'bg-emerald-50 border-emerald-200';
                  }

                  return (
                    <React.Fragment key={row.id}>
                      <tr 
                        onClick={() => toggleExpand(row.id)}
                        className={`hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer ${
                          isExpanded ? 'bg-slate-50/50' : ''
                        }`}
                      >
                        {/* Expand Icon */}
                        <td className="py-3 px-3 text-center">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </td>

                        {/* Name and desc */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block text-xs">{row.name}</span>
                            {row.description && (
                              <span className="text-[10px] text-slate-400 font-medium block line-clamp-1">{row.description}</span>
                            )}
                          </div>
                        </td>

                        {/* Budget amount */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                          {row.allocated.toLocaleString()} FCFA
                        </td>

                        {/* Executed Expenses */}
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-650">
                          {row.executed.toLocaleString()} FCFA
                        </td>

                        {/* Pending Expenses */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-655">
                          {row.pending > 0 ? `${row.pending.toLocaleString()} FCFA` : '-'}
                        </td>

                        {/* Remaining balance */}
                        <td className={`py-3 px-3 text-right font-mono font-semibold ${
                          row.isOverspent ? 'text-rose-600 font-black' : 'text-slate-600'
                        }`}>
                          {row.isOverspent ? `-${Math.abs(row.allocated - row.executed).toLocaleString()} FCFA` : `${row.remaining.toLocaleString()} FCFA`}
                        </td>

                        {/* Utilization Bar */}
                        <td className="py-3 px-3">
                          <div className="space-y-1 w-full max-w-[120px] mx-auto">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className={`px-1.5 py-0.2 rounded border text-[9px] ${bgBadgeClass} ${textColorClass}`}>
                                {Math.round(row.consumptionPercent)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                              <div 
                                className={`${progressColor} h-full rounded-full`} 
                                style={{ width: `${Math.min(100, row.consumptionPercent)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-ledger view */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/40 p-4 border-l-2 border-indigo-500">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-150 pb-1.5">
                                <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5 text-indigo-550" />
                                  {isEn ? "Ledger entries linked to this rubric" : "Opérations et décaissements comptabilisés"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {row.expenses.length} {isEn ? "record(s) found" : "ligne(s) d'opération(s)"}
                                </span>
                              </div>

                              {row.expenses.length === 0 ? (
                                <div className="text-center py-4 text-[11px] text-slate-400 font-semibold select-none bg-white border rounded-xl">
                                  📭 {isEn ? "No physical expenses tied to this budget line yet." : "Aucune transaction comptable affectée à cette rubrique budgétaire."}
                                </div>
                              ) : (
                                <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-3xs">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50/80 text-slate-450 font-black border-b border-slate-150 text-[9px] uppercase tracking-wider">
                                        <th className="py-2 px-3">{isEn ? "Date" : "Date"}</th>
                                        <th className="py-2 px-3">{isEn ? "Reference/Title" : "Libellé / Opération"}</th>
                                        <th className="py-2 px-3">{isEn ? "Type" : "Type"}</th>
                                        <th className="py-2 px-3">{isEn ? "Status" : "Statut"}</th>
                                        <th className="py-2 px-3 text-right">{isEn ? "Amount" : "Montant"}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-sans">
                                      {row.expenses.map((exp) => (
                                        <tr key={exp.id} className="hover:bg-slate-50/50">
                                          <td className="py-2 px-3 font-mono text-slate-400 font-medium">
                                            {new Date(exp.date).toLocaleDateString('fr-FR')}
                                          </td>
                                          <td className="py-2 px-3">
                                            <div className="font-bold text-slate-750">{exp.title}</div>
                                            {exp.description && (
                                              <div className="text-[10px] text-slate-400 line-clamp-1">{exp.description}</div>
                                            )}
                                          </td>
                                          <td className="py-2 px-3">
                                            {exp.type === 'command' ? (
                                              <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-150">Bons</span>
                                            ) : exp.type === 'payment-order' ? (
                                              <span className="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-150">Mandats</span>
                                            ) : (
                                              <span className="text-[9px] font-extrabold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-150">Remboursements</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3">
                                            {exp.status === 'Executed' ? (
                                              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-extrabold text-[10px]">
                                                <Check className="h-3 w-3 stroke-[3]" /> {isEn ? "Executed" : "Décassé / Payé"}
                                              </span>
                                            ) : exp.status === 'Approved' ? (
                                              <span className="text-blue-500 font-extrabold text-[10px]">{isEn ? "Approved" : "Approuvé"}</span>
                                            ) : (
                                              <span className="text-amber-500 font-extrabold text-[10px]">{isEn ? "Pending" : "En instance"}</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                            {formatCurrency(exp.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Uncategorized Expenses Sub-Section */}
        {uncategorizedExpensesList.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-850 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-slate-400" />
                {isEn ? "Uncategorized School Expenses" : "Dépenses Hors Lignes Budgétaires Spécifiques"}
              </h4>
              <span className="text-[10px] font-bold text-amber-650 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                {formatCurrency(uncategorizedExecuted)} {isEn ? "Executed Total" : "Consommé Total"}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              {isEn
                ? "These expenses are successfully tracked but do not specify any precise budget allocation link."
                : "Ces dépenses générales d'intendance sont tracées en comptabilité mais n'ont pas été rattachées à une rubrique d'allocation budgétaire spécifique."}
            </p>

            <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-3xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-450 font-black border-b border-slate-150 text-[9px] uppercase tracking-wider">
                    <th className="py-2 px-3">{isEn ? "Date" : "Date"}</th>
                    <th className="py-2 px-3">{isEn ? "Title / Purpose" : "Libellé de l'Opération"}</th>
                    <th className="py-2 px-3">{isEn ? "Type" : "Type"}</th>
                    <th className="py-2 px-3">{isEn ? "Status" : "Statut"}</th>
                    <th className="py-2 px-3 text-right">{isEn ? "Amount" : "Montant"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uncategorizedExpensesList.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/40">
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                        {new Date(exp.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-750 block">{exp.title}</span>
                        {exp.description && (
                          <span className="text-[10px] text-slate-400 block line-clamp-1">{exp.description}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {exp.type === 'command' ? (
                          <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-150">Bons</span>
                        ) : exp.type === 'payment-order' ? (
                          <span className="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-150">Mandats</span>
                        ) : (
                          <span className="text-[9px] font-extrabold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-150">Remboursements</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {exp.status === 'Executed' ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 font-extrabold text-[10px]">
                            <Check className="h-3 w-3 stroke-[3]" /> {isEn ? "Executed" : "Décassé / Payé"}
                          </span>
                        ) : (
                          <span className="text-amber-500 font-extrabold text-[10px]">{isEn ? "Pending" : "En instance"}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
