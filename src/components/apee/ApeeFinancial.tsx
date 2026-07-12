import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, DollarSign, Wallet2, FileText, ArrowDownLeft, ArrowUpRight, Check, AlertCircle, TrendingUp, Download, AlertTriangle, ClipboardList } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ApeeExpense, ApeeSettings, ApeeParent, ApeeOtherRevenue } from '../../types';
import { getApeeShortName } from '../../utils/apeeDb';
import ApeeBlankForms from './ApeeBlankForms';
import ApeeBudgetAnalysis from './ApeeBudgetAnalysis';
import { useLanguage } from '../../utils/TranslationContext';

interface ApeeFinancialProps {
  expenses: ApeeExpense[];
  onSaveExpense: (expense: ApeeExpense) => void;
  onDeleteExpense: (id: string) => void;
  totalRevenue: number;
  settings: ApeeSettings;
  parents?: ApeeParent[];
  otherRevenues?: ApeeOtherRevenue[];
}

export default function ApeeFinancial({ 
  expenses, 
  onSaveExpense, 
  onDeleteExpense, 
  totalRevenue, 
  settings,
  parents = [],
  otherRevenues = []
}: ApeeFinancialProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  // New expense form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'command' | 'payment-order' | 'refund'>('command');
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<'Pending' | 'Approved' | 'Executed'>('Pending');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [budgetLineId, setBudgetLineId] = useState<string>('');
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null);

  // Active filter tab
  const [activeFilter, setActiveFilter] = useState<string>('all'); // 'all' | 'command' | 'payment-order' | 'refund'
  const [activeView, setActiveView] = useState<'journal' | 'generator' | 'analysis'>('journal');

  // Calculations
  const calculatedExpenses = expenses.reduce((sums, e) => {
    if (e.status === 'Executed') {
      sums.totalExecuted += e.amount;
    } else {
      sums.totalPending += e.amount;
    }
    
    if (e.type === 'command') sums.commands += e.amount;
    else if (e.type === 'payment-order') sums.orders += e.amount;
    else if (e.type === 'refund') sums.refunds += e.amount;

    return sums;
  }, { totalExecuted: 0, totalPending: 0, commands: 0, orders: 0, refunds: 0 });

  const parentsContribution = parents.length > 0 ? parents.reduce((sum, p) => sum + p.totalPaid, 0) : totalRevenue;
  const otherContribution = otherRevenues.length > 0 ? otherRevenues.reduce((sum, r) => sum + r.amount, 0) : 0;
  const calculatedTotalRevenue = parentsContribution + otherContribution;
  const currentBoxBalance = calculatedTotalRevenue - calculatedExpenses.totalExecuted;

  const budgetLines = settings.budgetLines || [];

  // Calculate spent per budget category
  const spentByBudgetLine = expenses.reduce((acc, exp) => {
    if (exp.budgetLineId && exp.status === 'Executed') {
      acc[exp.budgetLineId] = (acc[exp.budgetLineId] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) {
      alert("Veuillez remplir correctement les champs obligatoires (libellé et montant).");
      return;
    }

    const newExpense: ApeeExpense = {
      id: 'exp_' + Date.now().toString(36),
      type,
      title: title.trim(),
      amount,
      status,
      date,
      description: description.trim(),
      budgetLineId: budgetLineId || undefined,
    };

    onSaveExpense(newExpense);
    setTitle('');
    setAmount(0);
    setDescription('');
    setStatus('Pending');
    setBudgetLineId('');
    setShowAddForm(false);
  };

  const handleUpdateStatus = (exp: ApeeExpense, newStatus: 'Pending' | 'Approved' | 'Executed') => {
    onSaveExpense({
      ...exp,
      status: newStatus,
    });
  };

  const handleDelete = (id: string) => {
    setExpenseToDeleteId(id);
  };

  // Filter expenses list
  const filteredExpenses = expenses.filter(e => activeFilter === 'all' || e.type === activeFilter)
                                .sort((a,b) => b.date.localeCompare(a.date));

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let y = 15;
    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (2 * margin); // 180mm

    const drawPageHeaderFooter = (pageNum: number) => {
      // Header line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      // Header text
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const headerTextLabel = isEn
        ? `Comprehensive Financial & Ledger Audit Report ${getApeeShortName(settings)} - ${settings.associationName || "Association"} • Academic Year: ${settings.schoolYear || ""}`
        : `Rapport Financier Global et Bilan Comptable ${getApeeShortName(settings)} - ${settings.associationName || "Association"} • Année Scolaire : ${settings.schoolYear || ""}`;
      doc.text(headerTextLabel, margin, 9);
      
      // Footer line
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      
      // Footer text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      const footerTextLabel = isEn 
        ? `Generated via PASMA-ENT ANALYTICS (Accounting & Audit Forms Creation)` 
        : `Édité via PASMA-ENT ANALYTICS (Génération de pièces comptables)`;
      doc.text(footerTextLabel, margin, pageHeight - 8);
      doc.text(`Page ${pageNum}`, margin + contentWidth - 10, pageHeight - 8);
    };

    let pageCount = 1;
    drawPageHeaderFooter(pageCount);

    // Republic of Cameroon Official alignment with Motto
    const actCountry = settings?.country || "Cameroun";
    const countryLabel = isEn 
      ? (actCountry === "Cameroun" ? "REPUBLIC OF CAMEROON" : actCountry.toUpperCase())
      : (actCountry === "Cameroun" ? "RÉPUBLIQUE DU CAMEROUN" : actCountry.toUpperCase());
    const yearLabel = isEn ? "Academic Year" : "Année Académique";

    if (actCountry === "Cameroun") {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text("RÉPUBLIQUE DU CAMEROUN", margin, y + 4);
      doc.text("REPUBLIC OF CAMEROON", margin + contentWidth, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("Paix - Travail - Patrie", margin, y + 7.5);
      doc.text("Peace - Work - Fatherland", margin + contentWidth, y + 7.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`${yearLabel} : ${settings?.schoolYear || "2025/2026"}`, margin + contentWidth, y + 11.5, { align: 'right' });
      
      y += 15;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(countryLabel, margin, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`${yearLabel} : ${settings?.schoolYear || "2025/2026"}`, margin + contentWidth, y + 4, { align: 'right' });
      
      y += 12;
    }

    // Left accent bar
    doc.setFillColor(79, 70, 229); // Primary Indigo (indigo-600)
    doc.rect(margin, y, 4, 18, 'F');

    // Brand and Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(`${(settings.associationName || "BUREAU DES PARENTS D'ÉLÈVES").toUpperCase()}`, margin + 6, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Slate 900
    const journalTitle = isEn ? "COMPREHENSIVE FINANCIAL AUDIT REPORT" : "RAPPORT FINANCIER GLOBAL & COMPTES ANNUELS";
    doc.text(journalTitle, margin + 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    const printDate = isEn 
      ? `School Year: ${settings.schoolYear || "N/A"} • Report Date: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`
      : `Année Scolaire : ${settings.schoolYear || "N/A"} • Date d'édition : ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`;
    doc.text(printDate, margin + 6, y + 17);

    y += 24;

    // Summary Card Box style (Enhanced dual density box)
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 30, 'FD');

    // Divider in summary box
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 15, margin + contentWidth, y + 15);

    // Row 1 of Box Card
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(isEn ? "AVAILABLE NET CASH" : "SOLDE DE CAISSE DISPONIBLE", margin + 6, y + 5);
    doc.text(isEn ? "GRAND TOTAL REVENUE" : "TOTAL GENERAL DES RECETTES", margin + 65, y + 5);
    doc.text(isEn ? "EXECUTED DISBURSEMENTS" : "TOTAL DEPENSES EXECUTEES", margin + 125, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(16, 185, 129); // Emerald-500
    doc.text(`${currentBoxBalance.toLocaleString()} FCFA`, margin + 6, y + 11);

    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text(`${calculatedTotalRevenue.toLocaleString()} FCFA`, margin + 65, y + 11);

    doc.setTextColor(220, 38, 38); // Red-600
    doc.text(`${calculatedExpenses.totalExecuted.toLocaleString()} FCFA`, margin + 125, y + 11);

    // Row 2 of Box Card
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(isEn ? "Parents Fee Receipts" : "Dont Cotisations Parents", margin + 6, y + 20);
    doc.text(isEn ? "External Funds & Subventions" : "Dont Autres Recettes/Aides", margin + 65, y + 20);
    doc.text(isEn ? "Pending Authorized Budget" : "Budget Engagé en Attente", margin + 125, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`${parentsContribution.toLocaleString()} FCFA`, margin + 6, y + 26);
    doc.text(`${otherContribution.toLocaleString()} FCFA`, margin + 65, y + 26);
    doc.text(`${calculatedExpenses.totalPending.toLocaleString()} FCFA`, margin + 125, y + 26);

    y += 36;

    // Parse parents statuses for reports
    const parentsPaidTotal = parents.reduce((sum, p) => sum + p.totalPaid, 0);
    const parentsDueTotal = parents.reduce((sum, p) => sum + p.totalDue, 0);
    const parentsRemaining = Math.max(0, parentsDueTotal - parentsPaidTotal);
    
    const countSoldes = parents.filter(p => p.status === 'soldé').length;
    const sumSoldes = parents.filter(p => p.status === 'soldé').reduce((sum, p) => sum + p.totalPaid, 0);
    
    const countPartiels = parents.filter(p => p.status === 'partiel').length;
    const sumPartiels = parents.filter(p => p.status === 'partiel').reduce((sum, p) => sum + p.totalPaid, 0);
    
    const countRetards = parents.filter(p => p.status === 'retard').length;
    const sumRetards = parents.filter(p => p.status === 'retard').reduce((sum, p) => sum + p.totalPaid, 0);

    // Section I: Audit des Recettes (Parent fees & other contributions)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(isEn ? "I. COMPREHENSIVE SCHOOL REGISTRY REVENUES BREAKDOWN" : "I. AUDIT DE RECOUVREMENT DES RECETTES DE L'ÉTA-COMPTABLE", margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Influx summary block
    doc.setFillColor(250, 250, 252);
    doc.rect(margin, y, contentWidth, 24, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 24, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(isEn ? "A. School Fees Collections Snapshot:" : "A. Tableau statistique des cotisations parents d'élèves (APEE) :", margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    
    const colXRec = {
      col1: margin + 4,
      col2: margin + 65,
      col3: margin + 125,
    };

    doc.text(isEn ? `• Parents Settled (Soldes) : ${countSoldes} (${sumSoldes.toLocaleString()} F)` : `• Tuteurs en règle (Soldés) : ${countSoldes} (${sumSoldes.toLocaleString()} FCFA)`, colXRec.col1, y + 10);
    doc.text(isEn ? `• Parents Partial (Partiels) : ${countPartiels} (${sumPartiels.toLocaleString()} F)` : `• Versements d'acomptes (Partiels) : ${countPartiels} (${sumPartiels.toLocaleString()} FCFA)`, colXRec.col1, y + 15);
    doc.text(isEn ? `• School Feed Registered Sum : ${parentsDueTotal.toLocaleString()} F` : `• Objectif total théorique attendu : ${parentsDueTotal.toLocaleString()} FCFA`, colXRec.col1, y + 20);
    
    doc.text(isEn ? `• Parents Overdue (Retards) : ${countRetards} (${sumRetards.toLocaleString()} F)` : `• Parents insolvables réels (Retards) : ${countRetards} (${sumRetards.toLocaleString()} FCFA)`, colXRec.col2, y + 10);
    doc.text(isEn ? `• Actual Amount Collected : ${parentsContribution.toLocaleString()} F` : `• Cotisations parentales effectivement perçues : ${parentsContribution.toLocaleString()} FCFA`, colXRec.col2, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(isEn ? `• Remainder Arrears to Recover:` : `• Solde de cotisations restant à recouvrer :`, colXRec.col3, y + 10);
    doc.setFontSize(8.5);
    doc.text(`${parentsRemaining.toLocaleString()} FCFA`, colXRec.col3, y + 16);

    y += 29;

    // Detailed other revenues (mécénats) table
    if (otherRevenues.length > 0) {
      if (y > pageHeight - 35) {
        doc.addPage();
        pageCount++;
        drawPageHeaderFooter(pageCount);
        y = 25;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(isEn ? "B. Detailed External Sponsorships & Other Additional Revenues Logs:" : "B. Détails des subventions, dons d'honneur et apports externes additionnels :", margin, y);
      y += 4;

      // Table Header Budget lines
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text(isEn ? "Date" : "Date", margin + 3, y + 4.5);
      doc.text(isEn ? "Payer / Benefactor Name" : "Donateur / Payeur / Institution", margin + 25, y + 4.5);
      doc.text(isEn ? "Category Classification" : "Catégorie de Recette", margin + 85, y + 4.5);
      doc.text(isEn ? "Payment Method" : "Mode de Règlement", margin + 130, y + 4.5);
      doc.text(isEn ? "Revenue (FCFA)" : "Versement (FCFA)", margin + contentWidth - 3, y + 4.5, { align: 'right' });

      y += 6.5;

      otherRevenues.forEach((rev) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;

          // Repeat headers
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 6.5, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105);
          doc.text(isEn ? "Date" : "Date", margin + 3, y + 4.5);
          doc.text(isEn ? "Payer / Benefactor Name" : "Donateur / Payeur / Institution", margin + 25, y + 4.5);
          doc.text(isEn ? "Category Classification" : "Catégorie de Recette", margin + 85, y + 4.5);
          doc.text(isEn ? "Payment Method" : "Mode de Règlement", margin + 130, y + 4.5);
          doc.text(isEn ? "Revenue (FCFA)" : "Versement (FCFA)", margin + contentWidth - 3, y + 4.5, { align: 'right' });
          y += 6.5;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);

        doc.text(rev.date || rev.createdAt.substring(0,10), margin + 3, y + 4.5);
        doc.text(rev.payerName, margin + 25, y + 4.5);

        let statusText = rev.status === 'membre_honneur' ? 'Bienfaiteur / Membre d\'Honneur' : (rev.status === 'institution' ? 'Subvention d\'Institution' : 'Autre source');
        if (isEn) {
          statusText = rev.status === 'membre_honneur' ? 'Honorary Support' : (rev.status === 'institution' ? 'State Subvention' : 'Other Payer');
        }
        if (rev.statusDetails) statusText += ` (${rev.statusDetails})`;
        doc.text(statusText, margin + 85, y + 4.5);
        doc.text(rev.paymentMethod || 'Espèces/Cash', margin + 130, y + 4.5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(rev.amount.toLocaleString(), margin + contentWidth - 3, y + 4.5, { align: 'right' });

        y += 6;
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(margin, y, margin + contentWidth, y);
      });
      y += 6;
    }

    // Section II: Budget lines consumption rate
    if (budgetLines.length > 0) {
      if (y > pageHeight - 35) {
        doc.addPage();
        pageCount++;
        drawPageHeaderFooter(pageCount);
        y = 25;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(isEn ? "II. BUDGET LINE CONSUMPTION RATES BY CATEGORY" : "II. SUIVI BUDGÉTAIRE ET TAUX DE CONSOMMATION PAR RUBRIQUE", margin, y);
      y += 4;
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;

      // Table Header Budget lines
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text(isEn ? "Budget Category Description" : "Rubrique Budgétaire", margin + 3, y + 4.5);
      doc.text(isEn ? "Allocated Sum (FCFA)" : "Montant Alloué (FCFA)", margin + 70, y + 4.5, { align: 'right' });
      doc.text(isEn ? "Spent Sum (FCFA)" : "Montant Consommé (FCFA)", margin + 115, y + 4.5, { align: 'right' });
      doc.text(isEn ? "Remaining (FCFA)" : "Reste (FCFA)", margin + 150, y + 4.5, { align: 'right' });
      doc.text(isEn ? "Usage %" : "Taux %", margin + 175, y + 4.5, { align: 'right' });

      y += 6.5;

      budgetLines.forEach((line) => {
        const spent = spentByBudgetLine[line.id] || 0;
        const allocated = line.allocatedAmount;
        const percent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
        const remaining = Math.max(0, allocated - spent);

        if (y > pageHeight - 25) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        doc.text(line.name, margin + 3, y + 4.5);
        doc.text(allocated.toLocaleString(), margin + 70, y + 4.5, { align: 'right' });
        doc.text(spent.toLocaleString(), margin + 115, y + 4.5, { align: 'right' });
        doc.text(remaining.toLocaleString(), margin + 150, y + 4.5, { align: 'right' });
        doc.text(`${percent}%`, margin + 175, y + 4.5, { align: 'right' });

        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });

      y += 8;
    }

    // New Section III: Reconstructed Monthly Receipts and Disbursements Table (Bilan des flux)
    const monthlyRevenues: Record<string, number> = {};
    const monthlyExpenses: Record<string, number> = {};
    
    // Group expenses (executed only) by Month (YYYY-MM)
    expenses.forEach(exp => {
      if (exp.status === 'Executed') {
        const m = exp.date.substring(0, 7);
        monthlyExpenses[m] = (monthlyExpenses[m] || 0) + exp.amount;
      }
    });
    
    // Group other revenues by Month (YYYY-MM)
    otherRevenues.forEach(rev => {
      const dateStr = rev.date || rev.createdAt || new Date().toISOString();
      const m = dateStr.substring(0, 7);
      monthlyRevenues[m] = (monthlyRevenues[m] || 0) + rev.amount;
    });
    
    // Group parent fee payments by Month (YYYY-MM)
    parents.forEach(p => {
      if (p.payments) {
        p.payments.forEach(pay => {
          const dateStr = pay.date || p.createdAt || new Date().toISOString();
          const m = dateStr.substring(0, 7);
          monthlyRevenues[m] = (monthlyRevenues[m] || 0) + pay.amount;
        });
      }
    });
    
    // Fallback if empty to align stats
    if (Object.keys(monthlyRevenues).length === 0 && totalRevenue > 0) {
      const currentMonth = new Date().toISOString().substring(0, 7);
      monthlyRevenues[currentMonth] = totalRevenue;
    }
    
    // Merge all unique months sorted descending
    const allMonths = Array.from(new Set([
      ...Object.keys(monthlyRevenues),
      ...Object.keys(monthlyExpenses)
    ])).sort().reverse();

    const getFrenchMonthLabel = (key: string) => {
      const parts = key.split('-');
      if (parts.length !== 2) return key;
      const monthIndex = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      const monthsFr = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];
      const monthsEn = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const months = isEn ? monthsEn : monthsFr;
      return `${months[monthIndex] || parts[1]} ${year}`;
    };

    if (allMonths.length > 0) {
      if (y > pageHeight - 40) {
        doc.addPage();
        pageCount++;
        drawPageHeaderFooter(pageCount);
        y = 25;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(isEn ? "III. RECONSTRUCTED MONTHLY RECEIPTS & DISBURSEMENTS SYNTHESIS" : "III. TABLEAU DE SYNTHÈSE MENSUELLE DES FLUX (RECETTES VS DÉPENSES)", margin, y);
      y += 4;
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;

      // Table Header Monthly Summary
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text(isEn ? "Evaluated Month" : "Mois d'Activité", margin + 3, y + 4.5);
      doc.text(isEn ? "Received Inflow (Recettes)" : "Flux Total Recettes (A)", margin + 50, y + 4.5);
      doc.text(isEn ? "Executed Outflow (Disbursed)" : "Décaissements Effectués (B)", margin + 105, y + 4.5);
      doc.text(isEn ? "Net Monthly Flow Margin" : "Marge / Solde Mensuel (A - B)", margin + contentWidth - 3, y + 4.5, { align: 'right' });

      y += 6.5;

      allMonths.forEach((monthKey) => {
        const revAmount = monthlyRevenues[monthKey] || 0;
        const expAmount = monthlyExpenses[monthKey] || 0;
        const netFlow = revAmount - expAmount;

        if (y > pageHeight - 25) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        doc.text(getFrenchMonthLabel(monthKey), margin + 3, y + 4.5);
        doc.text(revAmount.toLocaleString() + " FCFA", margin + 50, y + 4.5);
        doc.text(expAmount.toLocaleString() + " FCFA", margin + 105, y + 4.5);
        
        doc.setFont('helvetica', 'bold');
        if (netFlow >= 0) {
          doc.setTextColor(16, 185, 129); // Emerald margin
        } else {
          doc.setTextColor(220, 38, 38); // Red deficit
        }
        doc.text((netFlow >= 0 ? "+" : "") + netFlow.toLocaleString() + " FCFA", margin + contentWidth - 3, y + 4.5, { align: 'right' });

        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });

      y += 8;
    }

    // Section IV: Detailed log of transactions
    if (y > pageHeight - 35) {
      doc.addPage();
      pageCount++;
      drawPageHeaderFooter(pageCount);
      y = 25;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    const secThreeTitle = isEn
      ? `IV. DETAILED PTA FINANCIAL TRANSACTION JOURNAL LOG`
      : `IV. JOURNAL DÉTAILLÉ DES ENGAGEMENTS ET DÉPENSES DE L'${getApeeShortName(settings).toUpperCase()}`;
    doc.text(secThreeTitle, margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Header values
    doc.setFillColor(15, 23, 42); // Dark slate background for table header
    doc.rect(margin, y, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    
    const colX = {
      date: margin + 3,
      type: margin + 23,
      label: margin + 48,
      status: margin + 128,
      amount: margin + contentWidth - 3,
    };

    doc.text(isEn ? "Date" : "Date", colX.date, y + 4.8);
    doc.text(isEn ? "Doc Type" : "Type Pièce", colX.type, y + 4.8);
    doc.text(isEn ? "Operation & Justificative Title" : "Opération & Description", colX.label, y + 4.8);
    doc.text(isEn ? "Status" : "Statut", colX.status, y + 4.8);
    doc.text(isEn ? "Amount (FCFA)" : "Montant (FCFA)", colX.amount, y + 4.8, { align: 'right' });

    y += 7;

    if (filteredExpenses.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(isEn ? "No administrative forms are referenced in this category." : "Aucune pièce comptable n'est référencée pour cette catégorie dans le journal.", margin + 10, y + 7);
      y += 12;
    } else {
      filteredExpenses.forEach((exp) => {
        if (y > pageHeight - 25) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;

          // Repeat table header
          doc.setFillColor(15, 23, 42);
          doc.rect(margin, y, contentWidth, 7, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(255, 255, 255);
          doc.text(isEn ? "Date" : "Date", colX.date, y + 4.8);
          doc.text(isEn ? "Doc Type" : "Type Pièce", colX.type, y + 4.8);
          doc.text(isEn ? "Operation & Justificative Title" : "Opération & Description", colX.label, y + 4.8);
          doc.text(isEn ? "Status" : "Statut", colX.status, y + 4.8);
          doc.text(isEn ? "Amount (FCFA)" : "Montant (FCFA)", colX.amount, y + 4.8, { align: 'right' });
          y += 7;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85); // Slate 700

        // Date
        doc.text(exp.date, colX.date, y + 4.5);

        // Type
        let typeText = exp.type === 'command' ? 'B. Commande' : (exp.type === 'payment-order' ? 'O. Paiement' : 'Rembours.');
        if (isEn) {
          typeText = exp.type === 'command' ? 'P. Order' : (exp.type === 'payment-order' ? 'Pay Order' : 'Refund');
        }
        doc.text(typeText, colX.type, y + 4.5);

        // Label word wrap
        const fullLabelStr = exp.title + (exp.description ? ` (${exp.description})` : '');
        // Label space is 128 - 48 - 4 = 76mm
        const splitLabel = doc.splitTextToSize(fullLabelStr, 76);
        doc.text(splitLabel, colX.label, y + 4.5);

        // Status text
        let statusText = exp.status === 'Executed' ? 'Payé / Décavé' : (exp.status === 'Approved' ? 'Autorisé' : 'En examen');
        if (isEn) {
          statusText = exp.status === 'Executed' ? 'Disbursed' : (exp.status === 'Approved' ? 'Approved' : 'Review');
        }
        doc.text(statusText, colX.status, y + 4.5);

        // Amount math
        doc.setFont('helvetica', 'bold');
        doc.text(exp.amount.toLocaleString(), colX.amount, y + 4.5, { align: 'right' });

        // Row height calculations
        const lineCountHeight = Math.max(7, splitLabel.length * 4 + 3);
        y += lineCountHeight;

        // Draw light grey divider
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(margin, y, margin + contentWidth, y);
      });
    }

    // Checking for signature space
    if (y > pageHeight - 42) {
      doc.addPage();
      pageCount++;
      drawPageHeaderFooter(pageCount);
      y = 25;
    }

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    // Three columns signatures
    const managerText = settings.finManagerName ? `(${settings.finManagerName})` : (isEn ? "(Signature)" : "(Signature)");
    const finManagerTitle = isEn ? `PTA Financial Officer / Treasurer` : `Le Responsable Financier ${getApeeShortName(settings)}`;
    doc.text(finManagerTitle, margin + 3, y);
    doc.setFont('helvetica', 'normal');
    doc.text(managerText, margin + 3, y + 16);

    doc.setFont('helvetica', 'bold');
    const ptaPresidentTitle = isEn ? `PTA Elected Association President` : `Le Président de l'${getApeeShortName(settings)}`;
    doc.text(ptaPresidentTitle, margin + contentWidth / 2 - 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(isEn ? "(Visa and Signature)" : "(Visa et Signature)", margin + contentWidth / 2 - 20, y + 16);

    const directorText = settings.directorName ? `(${settings.directorName})` : (isEn ? "(Signature)" : "(Signature)");
    doc.setFont('helvetica', 'bold');
    const principalTitle = isEn ? "School Principal / COGE Chair" : "Le Chef d'Établisement / COGE";
    doc.text(principalTitle, margin + contentWidth - 55, y);
    doc.setFont('helvetica', 'normal');
    doc.text(directorText, margin + contentWidth - 55, y + 16);

    const safeFileNameStr = `journal_comptable_${getApeeShortName(settings).toLowerCase()}_${settings.schoolYear || 'archive'}.pdf`.replace(/[\s\/]/g, '_');
    doc.save(safeFileNameStr);
  };

  return (
    <div id="content_apee_financial" className="space-y-6">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-150 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">💸 Gestion Financière & Décaissements</h2>
          <p className="text-xs text-gray-500 font-medium">
            Suivi budgétaire, bons d'achat, ordres d'affectations, remboursements aux parents et états de caisse.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 select-none">
          {activeView === 'journal' && (
            <>
              <button
                onClick={handleExportPDF}
                className="text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                Exporter en PDF
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-xs font-bold bg-slate-900 hover:bg-black text-white px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="h-4 w-4" />
                {showAddForm ? 'Fermer le formulaire' : 'Enregistrer une opération'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation subtabs for Caisse vs Blank Form Generator vs Budget Analysis */}
      <div className="flex bg-slate-100 p-1 rounded-2xl max-w-xl border select-none">
        <button
          type="button"
          onClick={() => setActiveView('journal')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'journal'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet2 className="h-4 w-4 text-indigo-605" />
          {isEn ? "Ledger & Budget" : "Journal & Budget de Caisse"}
        </button>
        <button
          type="button"
          onClick={() => setActiveView('generator')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'generator'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="h-4 w-4 text-emerald-650" />
          {isEn ? "Blank Forms" : "Formulaires Vierges"} <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-md font-black">{isEn ? "New" : "Nouveau"}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView('analysis')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'analysis'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4 text-amber-600" />
          {isEn ? "Budget Analysis" : "Analyse Budgétaire"}
        </button>
      </div>

      {activeView === 'generator' ? (
        <ApeeBlankForms settings={settings} />
      ) : activeView === 'analysis' ? (
        <ApeeBudgetAnalysis
          expenses={expenses}
          settings={settings}
          parents={parents}
          otherRevenues={otherRevenues}
          totalRevenue={totalRevenue}
        />
      ) : (
        <>
          {/* Financial math visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono select-none">
        
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-350 flex items-center gap-1">
            <Wallet2 className="h-3 w-3 text-indigo-400" /> SOLDE DISPONIBLE EN CAISSE
          </span>
          <p className="text-lg font-bold text-indigo-300">
            {currentBoxBalance.toLocaleString()} FCFA
          </p>
          <p className="text-[10px] text-slate-400 font-medium">Total collectes: {totalRevenue.toLocaleString()} FCFA</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-1">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-red-500" /> TOTAL DÉPENSES ENGAGÉES
          </span>
          <p className="text-lg font-bold text-red-600">
            {calculatedExpenses.totalExecuted.toLocaleString()} FCFA
          </p>
          <p className="text-[10px] text-gray-550 font-medium">Lignes de dépenses décaissées</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-1">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-indigo-500" /> DÉPENSES EN ATTENTE D'ACCORD
          </span>
          <p className="text-lg font-bold text-amber-600">
            {calculatedExpenses.totalPending.toLocaleString()} FCFA
          </p>
          <p className="text-[10px] text-gray-550 font-medium">Actions en instance de signature</p>
        </div>

      </div>

      {/* Real-time Budget Consumption Rates */}
      {budgetLines.length > 0 && (
        <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 select-none">
            <h3 className="text-xs font-bold text-slate-850 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="h-4.5 w-4.5 text-indigo-500" /> Taux de Consommation des Rubriques Budgétaires
            </h3>
            <span className="text-[10px] text-gray-400 font-medium">Flux de décaissements effectifs</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetLines.map((line) => {
              const spent = spentByBudgetLine[line.id] || 0;
              const allocated = line.allocatedAmount;
              const percent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
              const remaining = Math.max(0, allocated - spent);

              let barColor = 'bg-indigo-600';
              let badgeColor = 'bg-indigo-50 text-indigo-700';
              if (percent >= 100) {
                barColor = 'bg-rose-500 animate-pulse';
                badgeColor = 'bg-rose-50 text-rose-700 border border-rose-200';
              } else if (percent >= 85) {
                barColor = 'bg-amber-500';
                badgeColor = 'bg-amber-50 text-amber-700 border border-amber-200';
              } else if (percent > 0) {
                barColor = 'bg-emerald-500';
                badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
              }

              return (
                <div key={line.id} className="border border-slate-100 rounded-xl p-3 space-y-2 bg-slate-50/20 hover:border-slate-300 transition-all duration-200">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{line.name}</span>
                    <span className={`text-[9px] font-sans font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${badgeColor}`}>
                      {percent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-semibold text-slate-500 font-mono">
                    <span>Décavé: {spent.toLocaleString()} F</span>
                    <span>Alloué: {allocated.toLocaleString()} F</span>
                  </div>

                  {percent >= 100 ? (
                    <div className="text-[8px] font-bold text-rose-600 uppercase flex items-center gap-1">
                      ⚠️ Rubrique entièrement consommée ({percent}%)
                    </div>
                  ) : (
                    <div className="text-[8px] font-semibold text-gray-400 font-sans">
                      Quota restant : <span className="font-mono text-emerald-600 font-bold">{remaining.toLocaleString()} FCFA</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operation input form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50/50 border border-slate-150 p-4.5 rounded-2xl space-y-4">
          <div className="border-b pb-2 flex justify-between items-center text-xs text-slate-800 font-bold select-none">
            <span>AJOUTER UNE NOUVELLE OPÉRATION BUDGETAIRE</span>
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[9px]">CAISSE {getApeeShortName(settings).toUpperCase()}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Libellé principal <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="Ex: Achat de craies orthopédiques"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white focus:outline-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Type d'opération <span className="text-red-500">*</span></label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white text-slate-700 focus:outline-indigo-500 cursor-pointer"
              >
                <option value="command">🧾 Bon de commande</option>
                <option value="payment-order">💸 Ordre de paiement</option>
                <option value="refund">↩️ Remboursement parent d'élève</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Montant (FCFA) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="1"
                required
                placeholder="Montant total effectif"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-mono focus:outline-indigo-500"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Date de validation des pièces</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white focus:outline-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-550 uppercase">Rubrique Budgétaire Associée</label>
              <select
                value={budgetLineId}
                onChange={(e) => setBudgetLineId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white text-slate-700 focus:outline-indigo-505 cursor-pointer"
              >
                <option value="">-- Non spécifiée / Fonctionnement --</option>
                {budgetLines.map(line => (
                  <option key={line.id} value={line.id}>📁 {line.name} ({line.allocatedAmount.toLocaleString()} FCFA)</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">État de validation</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white text-slate-700 focus:outline-indigo-500 cursor-pointer"
              >
                <option value="Pending">En attente / Brouillon</option>
                <option value="Approved">Accompagnement autorisé (Signé COGE / Chef d'étab)</option>
                <option value="Executed">Décaissement exécuté (Trésorier)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Détail des pièces jointes ou Réfs</label>
              <input
                type="text"
                placeholder="Ex: Facture proforma N°0382, reçu de caisse..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white focus:outline-indigo-500"
              />
            </div>

          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide cursor-pointer transition shadow-xs"
          >
            Confirmer et Enregistrer l'opération budgétaire
          </button>
        </form>
      )}

      {/* Categories filters */}
      <div className="flex bg-slate-50 border p-0.5 rounded-lg text-xs font-semibold max-w-lg select-none">
        {[
          { key: 'all', label: 'Toutes les lignes' },
          { key: 'command', label: 'Bons de Commande' },
          { key: 'payment-order', label: 'Ordres de Paiement' },
          { key: 'refund', label: 'Remboursements' },
        ].map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setActiveFilter(opt.key)}
            className={`flex-1 py-1 px-3 text-center rounded-md cursor-pointer transition ${
              activeFilter === opt.key ? 'bg-slate-900 text-white' : 'text-slate-650 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tabular logs of expenses */}
      <div className="bg-white border rounded-2xl overflow-hidden shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b text-gray-505 font-bold uppercase text-[9px] select-none">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Libellé</th>
              <th className="py-2.5 px-3 text-right">Montant</th>
              <th className="py-2.5 px-3">État</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                  Aucune pièce comptable n'est référencée pour cette catégorie.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-mono text-gray-450">{exp.date}</td>
                  <td className="py-2 px-3">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      exp.type === 'command' ? 'bg-indigo-50 text-indigo-800' : (exp.type === 'payment-order' ? 'bg-sky-50 text-sky-800' : 'bg-pink-50 text-pink-800')
                    }`}>
                      {exp.type === 'command' ? 'B. Commande' : (exp.type === 'payment-order' ? 'O. Paiement' : 'Rembours.')}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <p className="font-bold text-slate-800">{exp.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {exp.description && <span className="text-[10px] text-gray-400 font-serif mr-1">{exp.description}</span>}
                      {exp.budgetLineId && (
                        <span className="text-[8px] font-sans font-extrabold bg-slate-100 text-slate-600 px-1 py-0.5 rounded tracking-wide uppercase select-none">
                          📁 {budgetLines.find(l => l.id === exp.budgetLineId)?.name || 'Rubrique générale'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    {exp.amount.toLocaleString()} FCFA
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-[9px] font-sans font-extrabold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 w-fit select-none ${
                      exp.status === 'Executed' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : (exp.status === 'Approved' ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-amber-100 text-amber-800 border border-amber-200')
                    }`}>
                      {exp.status === 'Executed' ? 'Payé / Décavé' : (exp.status === 'Approved' ? 'Autorisé' : 'En examen')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-2 select-none">
                      {exp.status !== 'Executed' && (
                        <button
                          onClick={() => handleUpdateStatus(exp, 'Executed')}
                          className="p-1 bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 rounded cursor-pointer"
                          title="Exécuter (Payer)"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="p-1 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 rounded cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* Custom Confirmation Modal for Expenses */}
      {expenseToDeleteId && (() => {
        const expToDeleteObj = expenses.find(e => e.id === expenseToDeleteId);
        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] no-print animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in duration-200">
              {/* Header warning zone */}
              <div className="bg-red-50 p-6 flex flex-col items-center gap-3 text-center border-b border-red-100 shrink-0">
                <div className="p-3 bg-red-100 text-red-655 rounded-full animate-bounce">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-900 tracking-tight">Supprimer la Dépense</h3>
                  <p className="text-xs text-red-600 mt-1">Cette opération aura un impact direct sur le solde de la caisse.</p>
                </div>
              </div>
              
              {/* Body details info */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0">
                <p className="text-sm text-slate-655 leading-relaxed mb-4">
                  Voulez-vous vraiment supprimer définitivement cette écriture de d'épenses ?
                </p>
                
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-sm text-slate-900 break-words">{expToDeleteObj?.title}</span>
                    <span className="font-mono font-extrabold text-sm text-red-600 shrink-0 bg-red-50 px-2 py-0.5 rounded">
                      {expToDeleteObj?.amount.toLocaleString()} FCFA
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-500 mt-2 space-y-1.5 pt-2.5 border-t border-slate-200/60">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Date d'opération :</span>
                      <span className="font-medium text-slate-700">{expToDeleteObj?.date}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Type :</span>
                      <span className="font-semibold text-slate-700 uppercase text-[10px]">
                        {expToDeleteObj?.type === 'command' ? 'Bon de Commande' : (expToDeleteObj?.type === 'payment-order' ? 'Ordre de Paiement' : 'Remboursement')}
                      </span>
                    </div>
                    {expToDeleteObj?.budgetLineId && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Rubrique Budgétaire :</span>
                        <span className="font-medium text-slate-650 truncate max-w-[200px]">
                          {budgetLines.find(l => l.id === expToDeleteObj.budgetLineId)?.name || 'Rubrique générale'}
                        </span>
                      </div>
                    )}
                    {expToDeleteObj?.description && (
                      <div className="text-[11px] pt-1.5 border-t border-dashed border-slate-200 text-slate-650">
                        <strong className="text-slate-450 font-normal">Description:</strong> {expToDeleteObj.description}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-slate-655 flex items-start gap-2 bg-amber-50 text-amber-850 p-3.5 rounded-xl border border-amber-200">
                  <span className="shrink-0 mt-0.5 font-bold">⚠️ Impact Solde :</span>
                  <span>
                    La suppression réajustera immédiatement les calculs de budget décaissé et le solde dynamique de la caisse d'association ({getApeeShortName(settings)}).
                  </span>
                </div>
              </div>
              
              {/* Footer action buttons */}
              <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setExpenseToDeleteId(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer transition select-none"
                >
                  Conserver la ligne
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (expenseToDeleteId) {
                      onDeleteExpense(expenseToDeleteId);
                      setExpenseToDeleteId(null);
                    }
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer transition select-none flex items-center justify-center gap-1.5 shadow-xs min-w-[130px]"
                >
                  <Trash2 className="h-3.5 w-3.5 text-white shrink-0" />
                  Confirmer la suppression
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
