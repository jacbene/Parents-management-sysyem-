import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, ArrowUpRight, ArrowDownLeft, Landmark, Percent, Receipt, Sparkles, Download } from 'lucide-react';
import { ApeeParent, ApeeExpense, ApeeSettings } from '../../types';

interface ApeeFinancialOverviewProps {
  parents: ApeeParent[];
  expenses: ApeeExpense[];
  settings: ApeeSettings;
}

export default function ApeeFinancialOverview({ parents, expenses, settings }: ApeeFinancialOverviewProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Gather all chronological months represented in the database records
  const allMonthsSet = new Set<string>();
  
  parents.forEach(p => {
    p.payments.forEach(pay => {
      if (pay.date) {
        allMonthsSet.add(pay.date.slice(0, 7)); // "YYYY-MM"
      }
    });
  });

  expenses.forEach(e => {
    if (e.status === 'Executed' && e.date) {
      allMonthsSet.add(e.date.slice(0, 7)); // "YYYY-MM"
    }
  });

  let sortedAllMonths = Array.from(allMonthsSet).sort();

  // 2. Pad or slice to exactly the last 6 months
  if (sortedAllMonths.length < 6) {
    const latestMonthStr = sortedAllMonths[sortedAllMonths.length - 1] || '2026-05';
    const [latestYear, latestMonth] = latestMonthStr.split('-').map(Number);
    const refDate = new Date(latestYear, latestMonth - 1, 1);
    
    const paddedMonths: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      paddedMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    sortedAllMonths = paddedMonths;
  } else {
    // Only take the last 6 months
    sortedAllMonths = sortedAllMonths.slice(-6);
  }

  // Month labels helper
  const monthNamesFR: { [key: string]: string } = {
    '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
    '07': 'Juil', '08': 'Août', '09': 'Sept', '10': 'Oct', '11': 'Nov', '12': 'Déc'
  };

  // 3. Populate monthly series
  const originalChartData = sortedAllMonths.map(mKey => {
    let revenue = 0;
    let expense = 0;

    parents.forEach(p => {
      p.payments.forEach(pay => {
        if (pay.date && pay.date.startsWith(mKey)) {
          revenue += pay.amount;
        }
      });
    });

    expenses.forEach(e => {
      if (e.status === 'Executed' && e.date && e.date.startsWith(mKey)) {
        expense += e.amount;
      }
    });

    const [year, month] = mKey.split('-');
    const label = `${monthNamesFR[month] || month} ${year}`;

    return {
      monthKey: mKey,
      name: label,
      'Revenus (Recettes)': revenue,
      'Dépenses Exécutées': expense,
      'Marge de Trésorerie': revenue - expense,
    };
  });

  const hasActualData = originalChartData.some(d => d['Revenus (Recettes)'] > 0 || d['Dépenses Exécutées'] > 0);

  // Beautiful fallback stats for presentation if there aren't many records (avoids empty blank screens)
  const displayChartData = hasActualData ? originalChartData : [
    { monthKey: '2025-12', name: 'Déc 2025', 'Revenus (Recettes)': 1850000, 'Dépenses Exécutées': 890000, 'Marge de Trésorerie': 960000 },
    { monthKey: '2026-01', name: 'Jan 2026', 'Revenus (Recettes)': 3200000, 'Dépenses Exécutées': 1450000, 'Marge de Trésorerie': 1750000 },
    { monthKey: '2026-02', name: 'Fév 2026', 'Revenus (Recettes)': 2450000, 'Dépenses Exécutées': 1900000, 'Marge de Trésorerie': 550000 },
    { monthKey: '2026-03', name: 'Mar 2026', 'Revenus (Recettes)': 4100000, 'Dépenses Exécutées': 2200000, 'Marge de Trésorerie': 1900000 },
    { monthKey: '2026-04', name: 'Avr 2026', 'Revenus (Recettes)': 1500000, 'Dépenses Exécutées': 2400000, 'Marge de Trésorerie': -900000 },
    { monthKey: '2026-05', name: 'Mai 2026', 'Revenus (Recettes)': 5200000, 'Dépenses Exécutées': 3100000, 'Marge de Trésorerie': 2100000 }
  ];

  // 4. Cumulative calculations for the specific 6-month subset
  const total6MonthRevenue = displayChartData.reduce((sum, d) => sum + d['Revenus (Recettes)'], 0);
  const total6MonthExpenses = displayChartData.reduce((sum, d) => sum + d['Dépenses Exécutées'], 0);
  const net6MonthCashFlow = total6MonthRevenue - total6MonthExpenses;
  const realizationRate = total6MonthRevenue > 0 ? (total6MonthRevenue / settings.financialGoal) * 100 : 0;

  const handleExportCSV = () => {
    // Columns headers
    const headers = [
      "Mois",
      "Code Mois",
      "Revenus (Recettes) FCFA",
      "Dépenses Exécutées FCFA",
      "Marge de Trésorerie FCFA"
    ];

    // Format data rows
    const rows = displayChartData.map(d => [
      d.name,
      d.monthKey,
      d['Revenus (Recettes)'],
      d['Dépenses Exécutées'],
      d['Marge de Trésorerie']
    ]);

    // Total consolidated row
    const totalRow = [
      "TOTAL CONSOLIDÉ (6 Mois)",
      "",
      total6MonthRevenue,
      total6MonthExpenses,
      net6MonthCashFlow
    ];

    // Meta information header for Excel/Sheets readability
    const docTitle = `RÉCAPITULATIF FINANCIER DE L'APEE : ${settings.associationName || "Association"}`;
    const dateGenerated = `Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
    const financialGoalVal = `Objectif Annuel de l'APEE : ${settings.financialGoal.toLocaleString()} FCFA`;

    // Construct the CSV string with semi-colon delimiter (Excel French safe)
    const csvLines = [
      [docTitle],
      [dateGenerated],
      [financialGoalVal],
      [],
      headers,
      ...rows,
      [],
      totalRow
    ];

    const csvContent = csvLines
      .map(row => row.map(val => {
        const textStr = val === undefined || val === null ? "" : String(val);
        // Replace quotes with escaped quotes, and double wrap if special chars present
        if (textStr.includes(';') || textStr.includes(',') || textStr.includes('"') || textStr.includes('\n')) {
          return `"${textStr.replace(/"/g, '""')}"`;
        }
        return textStr;
      }).join(';'))
      .join('\r\n');

    // Create file blob with UTF-8 BOM to satisfy Excel rendering of accents
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    
    // Creating download link and trigger click
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = blobUrl;
    downloadAnchor.download = `recapitulatif_financier_${(settings.associationName || 'apee').toLowerCase().replace(/\s+/g, '_')}_6mois.csv`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    // Cleanup reference
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div id="financial_overview_section" className="bg-white border border-slate-150 rounded-2xl p-5 space-y-6 shadow-3xs">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-100">
            <Sparkles className="h-3 w-3" /> Analyse Multi-Factuelle (Derniers 6 mois)
          </div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            📊 Tableau Comparatif : Revenus vs Dépenses Exécutées
          </h3>
          <p className="text-[11px] text-slate-500">
            Suivi mensuel consolidé de la trésorerie active de {settings.associationName || "l'association"}.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto self-stretch md:self-auto justify-end">
          {!hasActualData && (
            <div className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 shrink-0">
              ⚠️ Données de démo
            </div>
          )}
          
          <button
            id="btn_export_csv"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:indigo-800 text-white text-[11px] font-bold px-4 py-1.5 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.5} /> Exporter en CSV
          </button>
        </div>
      </div>

      {/* Grid of Key Analytical Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Revenues Widget */}
        <div className="bg-slate-50/40 border border-slate-150 p-4 rounded-xl space-y-1.5 hover:border-indigo-200 transition">
          <div className="flex justify-between items-center text-slate-450">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Revenus (6M)</span>
            <div className="p-1 bg-indigo-50 text-indigo-600 rounded">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-lg font-extrabold text-slate-900 font-mono tracking-tight leading-none">
            {total6MonthRevenue.toLocaleString()} FCFA
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            Taux d'atteinte de l'objectif: <span className="font-bold text-indigo-650">{realizationRate.toFixed(1)}%</span>
          </p>
        </div>

        {/* Total Expenses Widget */}
        <div className="bg-slate-50/40 border border-slate-150 p-4 rounded-xl space-y-1.5 hover:border-rose-200 transition">
          <div className="flex justify-between items-center text-slate-450">
            <span className="text-[10px] font-bold uppercase tracking-wider">Dépenses Exécutées (6M)</span>
            <div className="p-1 bg-rose-50 text-rose-600 rounded">
              <ArrowDownLeft className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-lg font-extrabold text-slate-900 font-mono tracking-tight leading-none">
            {total6MonthExpenses.toLocaleString()} FCFA
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            Volume décaissé de la caisse d'association
          </p>
        </div>

        {/* Net Savings / Flow Widget */}
        <div className={`border p-4 rounded-xl space-y-1.5 transition ${
          net6MonthCashFlow >= 0 
            ? 'bg-emerald-50/20 border-emerald-150 hover:border-emerald-300' 
            : 'bg-rose-50/20 border-rose-150 hover:border-rose-300'
        }`}>
          <div className="flex justify-between items-center text-slate-450">
            <span className="text-[10px] font-bold uppercase tracking-wider">Marge de Trésorerie (6M)</span>
            <div className={`p-1 rounded ${net6MonthCashFlow >= 0 ? 'bg-emerald-50 text-emerald-650' : 'bg-rose-50 text-rose-650'}`}>
              <Landmark className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className={`text-lg font-extrabold font-mono tracking-tight leading-none ${
            net6MonthCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {net6MonthCashFlow.toLocaleString()} FCFA
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            Statut : <span className={`font-bold ${net6MonthCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {net6MonthCashFlow >= 0 ? 'Excédent Budgétaire' : 'Déficit / Tirage'}
            </span>
          </p>
        </div>

      </div>

      {/* Main Comparative Recharts Visualization */}
      <div className="space-y-2 pt-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-[11px] font-medium text-slate-500 gap-1 pb-1">
          <span>Axe d'analyse chronologique (6 Mois terminant en Mai 2026)</span>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-indigo-500 inline-block rounded-xs" /> Revenus / Cotisations
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-400 inline-block rounded-xs" /> Dépenses Exécutées
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-emerald-500 inline-block" /> Solde Net Monétaire
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={displayChartData}
                margin={{ top: 15, right: 10, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  dy={6}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false}
                  tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toLocaleString()} FCFA`]}
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 12,
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 12px'
                  }}
                />
                
                {/* Dual comparative bars for revenue vs expenses */}
                <Bar 
                  dataKey="Revenus (Recettes)" 
                  fill="#6366f1" 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                  name="Recettes"
                />
                <Bar 
                  dataKey="Dépenses Exécutées" 
                  fill="#f43f5e" 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                  name="Dépenses Exécutées"
                />

                {/* Overlaid Line Chart representing net balance */}
                <Line 
                  type="monotone" 
                  dataKey="Marge de Trésorerie" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  dot={{ r: 3.5, strokeWidth: 1.5, fill: '#fff' }}
                  name="Solde Net"
                />

                {/* Reference line for break-even state (y = 0) */}
                <ReferenceLine 
                  y={0} 
                  stroke="#94a3b8" 
                  strokeDasharray="4 4" 
                  strokeWidth={1}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400 font-medium">
              Génération du graphique financier en cours...
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
