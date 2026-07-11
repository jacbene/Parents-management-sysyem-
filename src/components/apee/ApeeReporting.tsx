import React, { useState } from 'react';
import { Download, FileSpreadsheet, Printer, Calendar, RefreshCw, BarChart2, DollarSign, Percent, TrendingUp, CheckCircle, Edit2, Trash2, X, TrendingDown, Coins, Activity, ArrowUpRight, ArrowDownRight, Eye, EyeOff, ArrowUpDown, Filter } from 'lucide-react';
import { ApeeParent, ApeeSettings, ApeeOtherRevenue, ApeeExpense } from '../../types';
import { getApeeShortName } from '../../utils/apeeDb';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../../utils/TranslationContext';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

interface ApeeReportingProps {
  parents: ApeeParent[];
  settings: ApeeSettings;
  otherRevenues?: ApeeOtherRevenue[];
  expenses?: ApeeExpense[];
  onSaveParent?: (parent: ApeeParent) => any;
  onSaveOtherRevenue?: (revenue: ApeeOtherRevenue) => any;
  onDeleteOtherRevenue?: (id: string) => any;
  onSaveExpense?: (expense: ApeeExpense) => any;
  onDeleteExpense?: (id: string) => any;
}

export default function ApeeReporting({ 
  parents, 
  settings, 
  otherRevenues = [], 
  expenses = [],
  onSaveParent,
  onSaveOtherRevenue,
  onDeleteOtherRevenue,
  onSaveExpense,
  onDeleteExpense
}: ApeeReportingProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [filterPeriod, setFilterPeriod] = useState<string>('all'); // 'all' | 'today' | 'month' | 'custom'
  const [activeSegment, setActiveSegment] = useState<'parents' | 'others' | 'expenses'>('parents');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [specificDateFilter, setSpecificDateFilter] = useState<string>('');
  
  // Visual action alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // State for selected parent accounting situation
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  // States for 'Annual Financial Summary' Recharts Report
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [expenseFilter, setExpenseFilter] = useState<'executed' | 'all'>('executed');
  const [showChartPanel, setShowChartPanel] = useState<boolean>(true);

  // States for Editing
  const [editingParentItem, setEditingParentItem] = useState<{ parentId: string; paymentId: string; parentName: string; amount: number; date: string; method?: string; note?: string } | null>(null);
  const [editingOtherItem, setEditingOtherItem] = useState<ApeeOtherRevenue | null>(null);
  const [editingExpenseItem, setEditingExpenseItem] = useState<ApeeExpense | null>(null);
  const [deleteExpenseConfirmId, setDeleteExpenseConfirmId] = useState<string | null>(null);
  const [deletePaymentConfirm, setDeletePaymentConfirm] = useState<{ parentId: string; paymentId: string } | null>(null);
  const [deleteOtherRevenueConfirmId, setDeleteOtherRevenueConfirmId] = useState<string | null>(null);
  
  // Filter payments list based on active dates
  const getFilteredPayments = () => {
    const list: { parentId: string; paymentId: string; parentName: string; parentPhone: string; amount: number; date: string; method?: string; note?: string; allocations?: { [obligationId: string]: number } }[] = [];
    
    parents.forEach(p => {
      p.payments.forEach(pay => {
        // Evaluate dates
        const dateStr = pay.date; // "YYYY-MM-DD"
        let include = true;
        
        if (filterPeriod === 'today') {
          const todayStr = new Date().toISOString().slice(0, 10);
          include = (dateStr === todayStr);
        } else if (filterPeriod === 'month') {
          const activeMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
          include = dateStr.startsWith(activeMonth);
        } else if (filterPeriod === 'custom') {
          if (startDate && dateStr < startDate) include = false;
          if (endDate && dateStr > endDate) include = false;
        }
        
        if (specificDateFilter && dateStr !== specificDateFilter) {
          include = false;
        }
        
        if (include) {
          list.push({
            parentId: p.id,
            paymentId: pay.id,
            parentName: p.name,
            parentPhone: p.phone,
            amount: pay.amount,
            date: pay.date,
            method: pay.method,
            note: pay.note,
            allocations: pay.allocations
          });
        }
      });
    });

    // Sort by date desc or asc
    return list.sort((a, b) => {
      return sortOrder === 'desc' 
        ? b.date.localeCompare(a.date) 
        : a.date.localeCompare(b.date);
    });
  };

  const getFilteredOtherRevenues = () => {
    return otherRevenues.filter(r => {
      const dateStr = r.date;
      let include = true;
      
      if (filterPeriod === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        include = (dateStr === todayStr);
      } else if (filterPeriod === 'month') {
        const activeMonth = new Date().toISOString().slice(0, 7);
        include = dateStr.startsWith(activeMonth);
      } else if (filterPeriod === 'custom') {
        if (startDate && dateStr < startDate) include = false;
        if (endDate && dateStr > endDate) include = false;
      }

      if (specificDateFilter && dateStr !== specificDateFilter) {
        include = false;
      }

      return include;
    }).sort((a, b) => {
      return sortOrder === 'desc' 
        ? b.date.localeCompare(a.date) 
        : a.date.localeCompare(b.date);
    });
  };

  const getFilteredExpenses = () => {
    return expenses.filter(e => {
      const dateStr = e.date;
      let include = true;
      
      if (filterPeriod === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        include = (dateStr === todayStr);
      } else if (filterPeriod === 'month') {
        const activeMonth = new Date().toISOString().slice(0, 7);
        include = dateStr.startsWith(activeMonth);
      } else if (filterPeriod === 'custom') {
        if (startDate && dateStr < startDate) include = false;
        if (endDate && dateStr > endDate) include = false;
      }

      if (specificDateFilter && dateStr !== specificDateFilter) {
        include = false;
      }

      return include;
    }).sort((a, b) => {
      return sortOrder === 'desc' 
        ? b.date.localeCompare(a.date) 
        : a.date.localeCompare(b.date);
    });
  };

  // Save & delete processors inside ApeeReporting:
  const handleSaveEditedPaymentItem = async () => {
    if (!editingParentItem || !onSaveParent) return;
    const parent = parents.find(p => p.id === editingParentItem.parentId);
    if (!parent) return;

    const updatedPayments = parent.payments.map(pay => {
      if (pay.id === editingParentItem.paymentId) {
        return {
          ...pay,
          amount: Number(editingParentItem.amount),
          date: editingParentItem.date,
          method: editingParentItem.method || 'Espèces',
          note: editingParentItem.note
        };
      }
      return pay;
    });

    const sumPaid = updatedPayments.reduce((sum, pay) => sum + pay.amount, 0);
    let computedStatus: 'soldé' | 'partiel' | 'retard' = 'retard';
    if (sumPaid >= parent.totalDue) {
      computedStatus = 'soldé';
    } else if (sumPaid > 0) {
      computedStatus = 'partiel';
    }

    const updatedParent: ApeeParent = {
      ...parent,
      payments: updatedPayments,
      totalPaid: sumPaid,
      status: computedStatus,
      updatedAt: new Date().toISOString()
    };

    const success = await onSaveParent(updatedParent);
    if (success) {
      setSuccessMsg(isEn ? "Payment updated successfully." : "La cotisation a été modifiée avec succès.");
      setEditingParentItem(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleDeletePaymentItem = async (parentId: string, paymentId: string) => {
    if (!onSaveParent) return;
    setDeletePaymentConfirm({ parentId, paymentId });
  };

  const handleSaveEditedOtherRevenueItem = async () => {
    if (!editingOtherItem || !onSaveOtherRevenue) return;

    const success = await onSaveOtherRevenue({
      ...editingOtherItem,
      payerName: editingOtherItem.payerName.trim(),
      amount: Number(editingOtherItem.amount),
      date: editingOtherItem.date,
      paymentMethod: editingOtherItem.paymentMethod
    });

    if (success) {
      setSuccessMsg(isEn ? "Revenue updated successfully." : "La recette d'appoint a été modifiée avec succès.");
      setEditingOtherItem(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleDeleteOtherRevenueItem = async (id: string) => {
    if (!onDeleteOtherRevenue) return;
    setDeleteOtherRevenueConfirmId(id);
  };

  const handleSaveEditedExpenseItem = async () => {
    if (!editingExpenseItem || !onSaveExpense) return;

    const success = await onSaveExpense({
      ...editingExpenseItem,
      title: editingExpenseItem.title.trim(),
      amount: Number(editingExpenseItem.amount),
      date: editingExpenseItem.date,
      description: editingExpenseItem.description.trim()
    });

    if (success) {
      setSuccessMsg(isEn ? "Expense updated successfully." : "La dépense a été modifiée avec succès.");
      setEditingExpenseItem(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleDeleteExpenseItem = async (id: string) => {
    if (!onDeleteExpense) return;
    setDeleteExpenseConfirmId(id);
  };

  const filteredPayments = getFilteredPayments();
  const filteredOtherRevenues = getFilteredOtherRevenues();
  const filteredExpenses = getFilteredExpenses();

  const totalCollectedInPeriod = activeSegment === 'parents'
    ? filteredPayments.reduce((sum, p) => sum + p.amount, 0)
    : activeSegment === 'others'
    ? filteredOtherRevenues.reduce((sum, r) => sum + r.amount, 0)
    : filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Global calculations
  const totalExpectedAmount = parents.reduce((sum, p) => sum + p.totalDue, 0);
  const totalCollectedAmountAlready = parents.reduce((sum, p) => sum + p.totalPaid, 0);
  const totalDebtAmount = Math.max(0, totalExpectedAmount - totalCollectedAmountAlready);
  const rateCollectedPercent = totalExpectedAmount > 0 ? (totalCollectedAmountAlready / totalExpectedAmount) * 100 : 0;

  // Class by class statistics calculation
  const classStatsMap: { [cls: string]: { pupilsCount: number; expected: number; collected: number } } = {};
  
  // Seed basic classes
  const ALL_CLASSES = ['6ème', '5ème', '4ème ALL', '4ème ESP', '3ème ALL', '3ème ESP', '2nde', '1ère', 'Tle'];
  ALL_CLASSES.forEach(c => {
    classStatsMap[c] = { pupilsCount: 0, expected: 0, collected: 0 };
  });

  parents.forEach(p => {
    p.students.forEach(s => {
      const cls = s.classRoom || 'Inconnue';
      if (!classStatsMap[cls]) {
        classStatsMap[cls] = { pupilsCount: 0, expected: 0, collected: 0 };
      }
      classStatsMap[cls].pupilsCount += 1;
      classStatsMap[cls].expected += settings.cotisationAmount;
      // Distribute parent payments proportionally
      const proportionalPaid = p.students.length > 0 ? p.totalPaid / p.students.length : 0;
      classStatsMap[cls].collected += proportionalPaid;
    });
  });

  // Export JSON function
  const handleExportJson = () => {
    const listToExport = activeSegment === 'parents' 
      ? filteredPayments 
      : activeSegment === 'others' 
      ? filteredOtherRevenues 
      : filteredExpenses;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(listToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    
    let suffix = 'cotisations_parents';
    if (activeSegment === 'others') suffix = 'autres_recettes';
    if (activeSegment === 'expenses') suffix = 'depenses_apee';

    downloadAnchor.setAttribute('download', `bilan_APEE_${suffix}_${filterPeriod}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setSuccessMsg('Fichier JSON du bilan exporté avec succès !');
    setTimeout(() => setSuccessMsg(null), 3050);
  };

  // Copy values as tab-separated values ready for Excel/Spreadsheets
  const handleCopyTsv = () => {
    let tsv = '';
    if (activeSegment === 'parents') {
      tsv = 'Date\tNom Parent\tTéléphone\tMoyen de paiement\tMontant Versé (FCFA)\tObservations\n';
      filteredPayments.forEach(p => {
        tsv += `${p.date}\t${p.parentName}\t${p.parentPhone}\t${p.method || 'Espèces'}\t${p.amount}\t${p.note || ''}\n`;
      });
    } else if (activeSegment === 'others') {
      tsv = 'Date\tNom Donneur / Payeur\tQualité / Statut\tMoyen de paiement\tMontant Versé (FCFA)\tObservations / Réf\n';
      filteredOtherRevenues.forEach(r => {
        let statLabel = "Autre tiers";
        if (r.status === 'membre_honneur') statLabel = "Membre d'Honneur";
        else if (r.status === 'institution') statLabel = `Institution (${r.statusDetails || ''})`;
        tsv += `${r.date}\t${r.payerName}\t${statLabel}\t${r.paymentMethod}\t${r.amount}\t${(r.notes || '') + (r.transactionId ? ' - Réf : ' + r.transactionId : '')}\n`;
      });
    } else {
      tsv = 'Date\tDésignation de la Dépense\tType / Nature\tÉtat d\'exécution\tMontant (FCFA)\tDescription\n';
      filteredExpenses.forEach(e => {
        const typeLabel = e.type === 'payment-order' ? 'Ordre de paiement' : (e.type === 'command' ? 'Bon de commande' : 'Remboursement');
        const statusLabel = e.status === 'Executed' ? 'Exécuté / Payé' : (e.status === 'Approved' ? 'Approuvé' : 'En attente');
        tsv += `${e.date}\t${e.title}\t${typeLabel}\t${statusLabel}\t${e.amount}\t${e.description || ''}\n`;
      });
    }

    navigator.clipboard.writeText(tsv).then(() => {
      setSuccessMsg('Tableau copié ! Vous pouvez maintenant le coller directement dans Excel ou Google Sheets.');
      setTimeout(() => setSuccessMsg(null), 3500);
    }).catch(err => {
      alert("Échec de la copie automatique: " + err);
    });
  };

  const handlePrintParentReportPdf = (parent: ApeeParent) => {
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
    let pageCount = 1;

    const drawPageHeaderFooter = (num: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const headerTitle = isEn 
        ? `Individual PTA Accounting Statement - ${getApeeShortName(settings)} • Academic Year: ${settings.schoolYear || ""}`
        : `Relevé de Situation Comptable Individuelle - ${getApeeShortName(settings)} • Année : ${settings.schoolYear || ""}`;
      doc.text(headerTitle, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text(`Page ${num}`, margin + contentWidth - 12, pageHeight - 8);
      const printDateLabel = isEn ? "Généré via PASMA-SYS" : "Généré via PASMA-SYS";
      doc.text(`${printDateLabel} • ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`, margin, pageHeight - 8);
    };

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
      
      y += 18;
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

    // Title Block
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    const reportTitle = isEn 
      ? `INDIVIDUAL ACCOUNTING STATEMENT: PTA CONTRIBUTIONS`
      : `RELEVÉ DE SITUATION COMPTABLE INDIVIDUELLE : COTISATIONS APEE`;
    doc.text(reportTitle, margin + 5, y + 9);

    y += 20;

    // Parent & Students Cards
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 38, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 38, 'D');

    // Left Column: Parent Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(isEn ? "PARENT IDENTIFICATION" : "COORDONNÉES DU PARENT D'ÉLÈVE", margin + 6, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`${isEn ? "Full Name" : "Nom complet"} :`, margin + 6, y + 14);
    doc.text(`${isEn ? "Phone" : "Téléphone"} :`, margin + 6, y + 20);
    doc.text(`${isEn ? "Address" : "Adresse"} :`, margin + 6, y + 26);
    doc.text(`${isEn ? "Email" : "Email"} :`, margin + 6, y + 32);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(parent.name.toUpperCase(), margin + 30, y + 14);
    doc.text(parent.phone || '-', margin + 30, y + 20);
    doc.text(parent.address || '-', margin + 30, y + 26);
    doc.text(parent.email || '-', margin + 30, y + 32);

    // Vertical separator
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + 92, y + 4, margin + 92, y + 34);

    // Right Column: Student Details
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(isEn ? "LINKED STUDENTS" : "ÉLÈVES / ENFANTS ASSOCIÉS", margin + 98, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    if (!parent.students || parent.students.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text(isEn ? "No students linked to this parent record." : "Aucun élève n'est lié à ce dossier parent.", margin + 98, y + 14);
    } else {
      parent.students.forEach((stud, idx) => {
        if (idx < 4) { // limit height to avoid spill
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(51, 65, 85);
          doc.text(`- ${stud.name.toUpperCase()}`, margin + 98, y + 14 + (idx * 6));
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(` (${stud.classRoom || "-"})`, margin + 148, y + 14 + (idx * 6));
        }
      });
    }

    y += 46;

    // Financial Status Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(isEn ? "I. FINANCIAL OBLIGATIONS & RECOVERY STATUS" : "I. BILAN DE LA SITUATION COMPTABLE", margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // KPI Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 18, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 18, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "TOTAL EXPECTED FEES" : "MONTANT DÛ / EXIGIBLE", margin + 4, y + 5);
    doc.text(isEn ? "TOTAL AMOUNT PAID" : "CUMUL DES VERSEMENTS", margin + 50, y + 5);
    doc.text(isEn ? "REMAINING BALANCE" : "RESTE À PAYER (SOLDE)", margin + 98, y + 5);
    doc.text(isEn ? "ACCOUNT STATUS" : "STATUT DU COMPTE", margin + 144, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${parent.totalDue.toLocaleString()} FCFA`, margin + 4, y + 12);
    
    doc.setTextColor(16, 185, 129); // Green
    doc.text(`${parent.totalPaid.toLocaleString()} FCFA`, margin + 50, y + 12);

    const remainingDebt = parent.totalDue - parent.totalPaid;
    doc.setTextColor(remainingDebt > 0 ? 239 : 16, remainingDebt > 0 ? 68 : 185, remainingDebt > 0 ? 68 : 129); // Red if has debt, green if settled
    doc.text(`${remainingDebt.toLocaleString()} FCFA`, margin + 98, y + 12);

    // Status format
    let statusLabelFr = "En retard";
    let statusColor = [239, 68, 68]; // Red
    if (parent.status === 'soldé' || remainingDebt <= 0) {
      statusLabelFr = "SOLDÉ";
      statusColor = [16, 185, 129]; // Green
    } else if (parent.status === 'partiel') {
      statusLabelFr = "SOLDE PARTIEL";
      statusColor = [79, 70, 229]; // Indigo
    }
    
    let statusLabelEn = "OVERDUE";
    if (parent.status === 'soldé' || remainingDebt <= 0) statusLabelEn = "SETTLED";
    else if (parent.status === 'partiel') statusLabelEn = "PARTIAL";

    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(isEn ? statusLabelEn : statusLabelFr, margin + 144, y + 12);

    y += 26;

    // Section II: Payment History Ledger
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(isEn ? "II. HISTORY OF TRANSACTIONS / DEPOSITS" : "II. HISTORIQUE DES ENCAISSEMENTS ET VERSEMENTS", margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Ledger Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "Date" : "Date de versement", margin + 3, y + 5);
    doc.text(isEn ? "Receipt ID / Ref" : "Référence / ID Versement", margin + 30, y + 5);
    doc.text(isEn ? "Pymt Method" : "Moyen", margin + 85, y + 5);
    doc.text(isEn ? "Observations / Notes" : "Observations", margin + 115, y + 5);
    doc.text(isEn ? "Amount" : "Montant", margin + 175, y + 5, { align: 'right' });
    y += 7;

    const paymentsHistory = parent.payments || [];
    if (paymentsHistory.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(isEn ? "No payment records found for this parent." : "Aucun historique de paiement enregistré pour ce parent.", margin + 3, y + 6);
      y += 10;
    } else {
      paymentsHistory.forEach((pay) => {
        if (y > pageHeight - 40) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        const dDate = pay.date ? new Date(pay.date).toLocaleDateString('fr-FR') : '-';
        doc.text(dDate, margin + 3, y + 5);
        doc.text(pay.id ? pay.id.substring(0, 12).toUpperCase() : '-', margin + 30, y + 5);
        doc.text(pay.method || 'Espèces', margin + 85, y + 5);
        
        // Truncate note if too long
        const payNote = pay.note || '-';
        const displayNote = payNote.length > 35 ? payNote.substring(0, 32) + '...' : payNote;
        doc.text(displayNote, margin + 115, y + 5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${pay.amount.toLocaleString()} FCFA`, margin + 175, y + 5, { align: 'right' });

        y += 7;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });
    }

    y += 15;

    // Signatures / Closing Box
    if (y > pageHeight - 50) {
      doc.addPage();
      pageCount++;
      drawPageHeaderFooter(pageCount);
      y = 25;
    }

    // Fait à... Le...
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Relevé certifié exact et arrêté à la somme de ${parent.totalPaid.toLocaleString()} FCFA payés sur un exigible de ${parent.totalDue.toLocaleString()} FCFA.`, margin, y);
    y += 6;
    doc.text(`Fait à ${getApeeShortName(settings)}, le ${new Date().toLocaleDateString('fr-FR')}`, margin, y);

    y += 12;

    // Signature boxes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(isEn ? "The Financial Secretary" : "Le Secrétaire Financier", margin + 10, y);
    doc.text(isEn ? "The PTA President" : "Le Président de l'APEE", margin + 120, y);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(isEn ? "(Signature & Stamp)" : "(Signature & Cachet)", margin + 10, y + 16);
    doc.text(isEn ? "(Signature & Stamp)" : "(Signature & Cachet)", margin + 120, y + 16);

    doc.save(`releve_comptable_${parent.name.replace(/\s+/g, '_').toLowerCase()}_${settings.schoolYear.replace(/\//g, '_')}.pdf`);
    setSuccessMsg(isEn ? `Accounting report for ${parent.name} generated successfully!` : `Rapport de situation comptable pour ${parent.name} généré et téléchargé !`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Dynamically generate a gorgeous, formal PDF report of the currently selected period and active tab
  const handlePrintActiveSegmentViewPdf = () => {
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
    let pageCount = 1;

    const drawPageHeaderFooter = (num: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const segmentTitle = activeSegment === 'parents' 
        ? (isEn ? "Detailed PTA Fees Recovery Report" : "Rapport de recouvrement des cotisations parents")
        : activeSegment === 'others'
        ? (isEn ? "Detailed Other Revenue Report" : "Rapport détaillé des autres recettes d'appoint")
        : (isEn ? "Detailed Budget Execution/Expenses Report" : "Rapport d'exécution budgétaire / Dépenses");

      const headerTitle = `${getApeeShortName(settings)} - ${settings.associationName || "PTA"} • ${segmentTitle}`;
      doc.text(headerTitle, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text(`Page ${num}`, margin + contentWidth - 12, pageHeight - 8);
      const periodLabel = isEn ? `Period: ${filterPeriod.toUpperCase()}` : `Période du filtre : ${filterPeriod.toUpperCase()}`;
      doc.text(`PASMA-SYS SECRETARY • ${periodLabel}`, margin, pageHeight - 8);
    };

    drawPageHeaderFooter(pageCount);

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
      
      y += 18;
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

    // Title Block
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    
    let titleStr = '';
    if (activeSegment === 'parents') {
      titleStr = isEn 
        ? `EXPORT: PARENTS PTA FEES RECOVERY REPORT`
        : `EXPORT : RAPPORT DES COTISATIONS DES PARENTS D'ÉLÈVES`;
    } else if (activeSegment === 'others') {
      titleStr = isEn
        ? `EXPORT: OTHER GENERAL SYSTEM REVENUES`
        : `EXPORT : RAPPORT DES AUTRES RECETTES D'APPOINT`;
    } else {
      titleStr = isEn
        ? `EXPORT: BUDGET DEPLOYMENT & EXPENSES STATEMENT`
        : `EXPORT : RAPPORT ET RELEVÉ DES DÉPENSES EXÉCUTÉES`;
    }
    
    doc.text(titleStr, margin + 5, y + 9);
    y += 20;

    // Filtered data count check
    const itemsList = activeSegment === 'parents' 
      ? filteredPayments 
      : activeSegment === 'others' 
      ? filteredOtherRevenues 
      : filteredExpenses;

    const totalPeriodAmount = itemsList.reduce((sum: number, item: any) => sum + item.amount, 0);

    // KPI Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 16, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 16, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "EXPORTED PERIOD" : "PÉRIODE EXTRACTIBLE", margin + 4, y + 5);
    doc.text(isEn ? "TOTAL LINE COUNT" : "NOMBRE DE LIGNES", margin + 65, y + 5);
    doc.text(isEn ? "CUMULATIVE AMOUNT" : "MONTANT CUMULÉ DU RAPPORT", margin + 115, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    
    let periodTextFr = "Tous les enregistrements";
    if (filterPeriod === 'today') periodTextFr = "Aujourd'hui";
    else if (filterPeriod === 'month') periodTextFr = "Ce mois";
    else if (filterPeriod === 'custom') periodTextFr = `Du ${startDate || '?'} au ${endDate || '?'}`;
    
    let periodTextEn = "All Records";
    if (filterPeriod === 'today') periodTextEn = "Today";
    else if (filterPeriod === 'month') periodTextEn = "Current Month";
    else if (filterPeriod === 'custom') periodTextEn = `From ${startDate || '?'} to ${endDate || '?'}`;

    doc.text(isEn ? periodTextEn : periodTextFr, margin + 4, y + 11);
    doc.text(`${itemsList.length} ${isEn ? 'entries' : 'lignes'}`, margin + 65, y + 11);
    doc.setTextColor(activeSegment === 'expenses' ? 220 : 79, activeSegment === 'expenses' ? 38 : 70, activeSegment === 'expenses' ? 38 : 229); // Red for expenses, Blue for incomes
    doc.text(`${totalPeriodAmount.toLocaleString()} FCFA`, margin + 115, y + 11);

    y += 24;

    // Table view
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);

    if (activeSegment === 'parents') {
      doc.text(isEn ? "Payment Date" : "Date Versement", margin + 3, y + 4.5);
      doc.text(isEn ? "Parent's Full Name" : "Nom complet du Parent", margin + 28, y + 4.5);
      doc.text(isEn ? "Phone Number" : "Téléphone", margin + 85, y + 4.5);
      doc.text(isEn ? "Pymt Method" : "Moyen Encaissé", margin + 120, y + 4.5);
      doc.text(isEn ? "Amount Slipped" : "Montant Reçu (FCFA)", margin + 175, y + 4.5, { align: 'right' });
    } else if (activeSegment === 'others') {
      doc.text(isEn ? "Received Date" : "Date de Perception", margin + 3, y + 4.5);
      doc.text(isEn ? "Donor/Payer Name" : "Nom du Donneur/Payeur", margin + 28, y + 4.5);
      doc.text(isEn ? "Status/Quality" : "Qualité / Statut", margin + 85, y + 4.5);
      doc.text(isEn ? "Method" : "Moyen reçu", margin + 125, y + 4.5);
      doc.text(isEn ? "Amount (FCFA)" : "Montant (FCFA)", margin + 175, y + 4.5, { align: 'right' });
    } else {
      doc.text(isEn ? "Expense Date" : "Date Enregistrée", margin + 3, y + 4.5);
      doc.text(isEn ? "Expense Title" : "Libellé de la Dépense", margin + 28, y + 4.5);
      doc.text(isEn ? "Expense Type" : "Type/Nature", margin + 85, y + 4.5);
      doc.text(isEn ? "Status" : "État execution", margin + 125, y + 4.5);
      doc.text(isEn ? "Amount (FCFA)" : "Montant Dépensé", margin + 175, y + 4.5, { align: 'right' });
    }

    y += 6.5;

    if (itemsList.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(isEn ? "No records match the current reporting filter criteria." : "Aucun dossier financier ne correspond à vos critères de filtre.", margin + 5, y + 6);
    } else {
      itemsList.forEach((item: any) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        // Date cell
        const rawDate = item.date;
        const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('fr-FR') : '-';
        doc.text(formattedDate, margin + 3, y + 4.5);

        if (activeSegment === 'parents') {
          doc.text(item.parentName.toUpperCase(), margin + 28, y + 4.5);
          doc.text(item.parentPhone || '-', margin + 85, y + 4.5);
          doc.text(item.method || 'Espèces', margin + 120, y + 4.5);
        } else if (activeSegment === 'others') {
          doc.text(item.payerName.toUpperCase(), margin + 28, y + 4.5);
          let statLabel = "Autre tiers";
          if (item.status === 'membre_honneur') statLabel = "Membre d'Honneur";
          else if (item.status === 'institution') statLabel = `Institution (${item.statusDetails || ''})`;
          doc.text(statLabel, margin + 85, y + 4.5);
          doc.text(item.paymentMethod || 'Espèces', margin + 125, y + 4.5);
        } else {
          doc.text(item.title, margin + 28, y + 4.5);
          const typeLabel = item.type === 'payment-order' ? 'Ordre de paiement' : (item.type === 'command' ? 'Bon de commande' : 'Remboursement');
          doc.text(typeLabel, margin + 85, y + 4.5);
          const statusLabel = item.status === 'Executed' ? 'Exécuté' : (item.status === 'Approved' ? 'Approuvé' : 'En attente');
          doc.text(statusLabel, margin + 125, y + 4.5);
        }

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(activeSegment === 'expenses' ? 180 : 15, activeSegment === 'expenses' ? 20 : 23, activeSegment === 'expenses' ? 20 : 42);
        doc.text(`${item.amount.toLocaleString()} F`, margin + 175, y + 4.5, { align: 'right' });

        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });
    }

    doc.save(`rapport_${activeSegment}_${filterPeriod}_${settings.schoolYear.replace(/\//g, '_')}.pdf`);
    setSuccessMsg(isEn ? 'Reporting PDF generated successfully !' : 'Rapport PDF généré et téléchargé avec succès !');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handlePrintBilan = () => {
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
    let pageCount = 1;

    const drawPageHeaderFooter = (num: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const headerTitle = isEn 
        ? `Financial Report ${getApeeShortName(settings)} - ${settings.associationName || "PTA"} • Academic Year: ${settings.schoolYear || ""}`
        : `Bilan Financier ${getApeeShortName(settings)} - ${settings.associationName || "CES Ekali 1"} • Année : ${settings.schoolYear || ""}`;
      doc.text(headerTitle, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text(`Page ${num}`, margin + contentWidth - 12, pageHeight - 8);
      const periodLabel = isEn ? `Period: ${filterPeriod.toUpperCase()}` : `Période : ${filterPeriod.toUpperCase()}`;
      doc.text(`PASMA-SYS Analytics • ${periodLabel}`, margin, pageHeight - 8);
    };

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
      
      y += 18;
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

    // Title Block
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    const billingSummaryTitle = isEn 
      ? `GLOBAL FINANCIAL REPORT: PTA FEES RECOVERY SUMMARIZATION`
      : `BILAN FINANCIER GLOBAL : RECOUVREMENT DES COTISATIONS ${getApeeShortName(settings).toUpperCase()}`;
    doc.text(billingSummaryTitle, margin + 5, y + 9);

    y += 20;

    // Section I: Global KPIs Cards
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("I. COMPTE SYNTHÉTIQUE DE TRÉSORERIE GLOBLALE", margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Layout four metric columns
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 18, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 18, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("BUDGET ATTENDU", margin + 4, y + 5);
    doc.text("SOMME RECOUVREÉ", margin + 50, y + 5);
    doc.text("DÉSERTE / RESTE", margin + 98, y + 5);
    doc.text("TAUX DE RECOUV.", margin + 144, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalExpectedAmount.toLocaleString()} F`, margin + 4, y + 12);
    
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(`${totalCollectedAmountAlready.toLocaleString()} F`, margin + 50, y + 12);

    doc.setTextColor(239, 68, 68); // Red
    doc.text(`${totalDebtAmount.toLocaleString()} F`, margin + 98, y + 12);

    doc.setTextColor(16, 185, 129); // Green
    doc.text(`${rateCollectedPercent.toFixed(1)} %`, margin + 144, y + 12);

    y += 26;

    // Section II: Class level statistics
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("II. RÉCAPITULATIF STATISTIQUE DES RECOUVREMENTS PAR NIVEAU / CLASSE", margin, y);
    y += 4;
    
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Classes Table Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Classe Évaluée", margin + 3, y + 4.5);
    doc.text("Effectifs", margin + 45, y + 4.5);
    doc.text("Montant Attendu (FCFA)", margin + 75, y + 4.5);
    doc.text("Montant Recouvré (FCFA)", margin + 120, y + 4.5);
    doc.text("Taux Réel", margin + 175, y + 4.5, { align: 'right' });

    y += 6.5;

    const classesKeys = Object.keys(classStatsMap);
    classesKeys.forEach((clsKey) => {
      const info = classStatsMap[clsKey];
      if (y > pageHeight - 20) {
        doc.addPage();
        pageCount++;
        drawPageHeaderFooter(pageCount);
        y = 25;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      doc.text(clsKey, margin + 3, y + 4.5);
      doc.text(`${info.pupilsCount} élèves`, margin + 45, y + 4.5);
      doc.text(info.expected.toLocaleString(), margin + 75, y + 4.5);
      doc.text(info.collected.toLocaleString(), margin + 120, y + 4.5);

      const clsRate = info.expected > 0 ? (info.collected / info.expected) * 100 : 0;
      doc.setFont('helvetica', 'bold');
      doc.text(`${clsRate.toFixed(1)} %`, margin + 175, y + 4.5, { align: 'right' });

      y += 6.5;

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, margin + contentWidth, y);
    });

    y += 8;

    // Section III: Detailed periodic logs
    if (filteredPayments.length > 0) {
      if (y > pageHeight - 35) {
        doc.addPage();
        pageCount++;
        drawPageHeaderFooter(pageCount);
        y = 25;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`III. JOURNAL DES OPÉRATIONS D'ÉMARGEMENT DE LA PÉRIODE (${filterPeriod.toUpperCase()})`, margin, y);
      y += 4;
      
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;

      // Payments Table Headers
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Date Saisie", margin + 3, y + 4.5);
      doc.text("Nom du Parent d'Élève", margin + 30, y + 4.5);
      doc.text("Téléphone", margin + 95, y + 4.5);
      doc.text("Mode Versement", margin + 128, y + 4.5);
      doc.text("Montant Saisi", margin + 175, y + 4.5, { align: 'right' });

      y += 6.5;

      filteredPayments.forEach((pay) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        doc.text(new Date(pay.date).toLocaleDateString('fr-FR'), margin + 3, y + 4.5);
        doc.text(pay.parentName.toUpperCase(), margin + 30, y + 4.5);
        doc.text(pay.parentPhone, margin + 95, y + 4.5);
        doc.text(pay.method || 'Espèces', margin + 128, y + 4.5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${pay.amount.toLocaleString()} F`, margin + 175, y + 4.5, { align: 'right' });

        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });
    }

    // Section IV: Detailed other revenues logs
    const filterOthersList = getFilteredOtherRevenues();
    if (filterOthersList.length > 0) {
      if (y > pageHeight - 35) {
        doc.addPage();
        pageCount++;
        drawPageHeaderFooter(pageCount);
        y = 25;
      } else {
        y += 10;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`IV. AUTRES RECETTES ENCAISSÉES DE LA PÉRIODE (${filterPeriod.toUpperCase()})`, margin, y);
      y += 4;
      
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;

      // Other Receipts Headers
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Date", margin + 3, y + 4.5);
      doc.text("Nom du Donneur / Payeur", margin + 30, y + 4.5);
      doc.text("Qualité/Statut", margin + 95, y + 4.5);
      doc.text("Mode Paiement", margin + 140, y + 4.5);
      doc.text("Montant Saisi", margin + 175, y + 4.5, { align: 'right' });

      y += 6.5;

      filterOthersList.forEach((rev) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        doc.text(new Date(rev.date).toLocaleDateString('fr-FR'), margin + 3, y + 4.5);
        doc.text(rev.payerName.toUpperCase(), margin + 30, y + 4.5);

        let statLabel = "Autre tiers";
        if (rev.status === 'membre_honneur') statLabel = "Membre d'Honneur";
        else if (rev.status === 'institution') statLabel = `Institution (${rev.statusDetails || ''})`;
        doc.text(statLabel, margin + 95, y + 4.5);

        doc.text(rev.paymentMethod, margin + 140, y + 4.5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${rev.amount.toLocaleString()} F`, margin + 175, y + 4.5, { align: 'right' });

        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });
    }

    doc.save(`bilan_financier_${getApeeShortName(settings).toLowerCase()}_${settings.schoolYear.replace(/\//g, '_')}_${filterPeriod}.pdf`);
    setSuccessMsg('Bilan financier exporté avec succès sous format PDF !');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handlePrintMonthlyReport = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // "YYYY-MM"
    const monthNamesFr = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const monthNamesEn = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthNames = isEn ? monthNamesEn : monthNamesFr;
    const currentMonthName = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    let y = 15;
    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (2 * margin); // 180mm
    let pageCount = 1;

    const drawPageHeaderFooter = (num: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const repHeaderTitle = isEn
        ? `Consolidated Monthly Statement - ${getApeeShortName(settings)} • Period: ${currentMonthName} ${currentYear}`
        : `Bilan Mensuel Consolidé - ${getApeeShortName(settings)} • Période : ${currentMonthName} ${currentYear}`;
      doc.text(repHeaderTitle, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text(`Page ${num}`, margin + contentWidth - 12, pageHeight - 8);
      const repEditDate = isEn
        ? `Generated via PASMA-SYS Secretary • Print Date: ${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US')}`
        : `Généré par PASMA-SYS Secrétariat • Date d'édition : ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR')}`;
      doc.text(repEditDate, margin, pageHeight - 8);
    };

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
      
      y += 18;
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

    // Title Block
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    const monthlyConsTitle = isEn 
      ? `CONSOLIDATED MONTHLY REPORT: ${currentMonthName.toUpperCase()} ${currentYear}`
      : `BILAN MENSUEL CONSOLIDÉ : ${currentMonthName.toUpperCase()} ${currentYear}`;
    doc.text(monthlyConsTitle, margin + 5, y + 9);

    y += 20;

    // Filter payments, other revenues, and expenses for the current month
    const monthlyPayments: { parentName: string; parentPhone: string; amount: number; date: string; method?: string; note?: string }[] = [];
    parents.forEach(p => {
      p.payments.forEach(pay => {
        if (pay.date && pay.date.startsWith(currentMonth)) {
          monthlyPayments.push({
            parentName: p.name,
            parentPhone: p.phone,
            amount: pay.amount,
            date: pay.date,
            method: pay.method,
            note: pay.note,
          });
        }
      });
    });
    monthlyPayments.sort((a, b) => b.date.localeCompare(a.date));

    const monthlyOtherRevenues = (otherRevenues || []).filter(r => r.date && r.date.startsWith(currentMonth));
    monthlyOtherRevenues.sort((a, b) => b.date.localeCompare(a.date));

    const monthlyExpenses = (expenses || []).filter(e => e.status === 'Executed' && e.date && e.date.startsWith(currentMonth));
    monthlyExpenses.sort((a, b) => b.date.localeCompare(a.date));

    const totalMonthlyParents = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalMonthlyOthers = monthlyOtherRevenues.reduce((sum, r) => sum + r.amount, 0);
    const totalMonthlyIncome = totalMonthlyParents + totalMonthlyOthers;
    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyNetBalance = totalMonthlyIncome - totalMonthlyExpenses;

    // Section I: Financial summary table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("I. COMPTE SECONDAIRE DU RÉSULTAT MENSUEL", margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Compte de Résultat Card
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 32, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 32, 'D');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Recettes des cotisations de parents d'élèves :", margin + 6, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalMonthlyParents.toLocaleString()} FCFA`, margin + 115, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text("Autres entrées financières d'appoint :", margin + 6, y + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalMonthlyOthers.toLocaleString()} FCFA`, margin + 115, y + 14);

    doc.line(margin + 6, y + 17, margin + contentWidth - 6, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL DES REVENUS ET APPORTS MENSUELS (+)", margin + 6, y + 23);
    doc.setTextColor(16, 185, 129); // Green
    doc.text(`${totalMonthlyIncome.toLocaleString()} FCFA`, margin + 115, y + 23);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text("DÉPENSES DE FONCTIONNEMENT EXÉCUTÉES (-)", margin + 6, y + 28);
    doc.setTextColor(239, 68, 68); // Red
    doc.text(`${totalMonthlyExpenses.toLocaleString()} FCFA`, margin + 115, y + 28);

    y += 37;

    // Ending Cash Box
    doc.setFillColor(240, 253, 244); // light green
    doc.rect(margin, y, contentWidth, 12, 'F');
    doc.setDrawColor(187, 247, 208);
    doc.rect(margin, y, contentWidth, 12, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(21, 128, 61); // emerald 700
    doc.text("SOLDE FINANCIER NET DU MOIS (EXCÉDENT / TRÉSORERIE) :", margin + 6, y + 7.5);
    doc.setFontSize(10.5);
    doc.text(`${monthlyNetBalance >= 0 ? '+' : ''}${monthlyNetBalance.toLocaleString()} FCFA`, margin + contentWidth - 60, y + 8);

    y += 18;

    // Section II: Detail of payments/revenues
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("II. DÉTAIL DES RECETTES ET APPORTS PERÇUS CE MOIS", margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Date", margin + 3, y + 4.5);
    doc.text("Nom du Parent ou Donateur", margin + 25, y + 4.5);
    doc.text("Qualité/Description", margin + 85, y + 4.5);
    doc.text("Moyen", margin + 140, y + 4.5);
    doc.text("Montant (FCFA)", margin + 175, y + 4.5, { align: 'right' });
    y += 6.5;

    const allIncomesList = [
      ...monthlyPayments.map(p => ({
        date: p.date,
        name: p.parentName,
        desc: "Cotisation Parent",
        method: p.method || "Espèces",
        amount: p.amount
      })),
      ...monthlyOtherRevenues.map(r => {
        let statLabel = "Autre tiers";
        if (r.status === 'membre_honneur') statLabel = "Membre d'Honneur";
        else if (r.status === 'institution') statLabel = `Institution (${r.statusDetails || ''})`;
        return {
          date: r.date,
          name: r.payerName,
          desc: `Donateur : ${statLabel}`,
          method: r.paymentMethod,
          amount: r.amount
        };
      })
    ].sort((a, b) => b.date.localeCompare(a.date));

    if (allIncomesList.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Aucun encaissement enregistré pour ce mois.", margin + 3, y + 5);
      y += 8;
    } else {
      allIncomesList.forEach(inc => {
        if (y > pageHeight - 20) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(new Date(inc.date).toLocaleDateString('fr-FR'), margin + 3, y + 4.5);
        doc.text(inc.name.toUpperCase(), margin + 25, y + 4.5);
        doc.text(inc.desc, margin + 85, y + 4.5);
        doc.text(inc.method, margin + 140, y + 4.5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${inc.amount.toLocaleString()} F`, margin + 175, y + 4.5, { align: 'right' });
        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });
    }

    y += 8;

    // Section III: Executed expenses detail
    if (y > pageHeight - 35) {
      doc.addPage();
      pageCount++;
      drawPageHeaderFooter(pageCount);
      y = 25;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("III. DÉTAIL DES DÉPENSES EXÉCUTÉES DU MOIS", margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    // Expenses Table Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Date Saisie", margin + 3, y + 4.5);
    doc.text("Libellé de la Dépense", margin + 30, y + 4.5);
    doc.text("Nature", margin + 95, y + 4.5);
    doc.text("Statut", margin + 140, y + 4.5);
    doc.text("Montant (FCFA)", margin + 175, y + 4.5, { align: 'right' });
    y += 6.5;

    if (monthlyExpenses.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Aucune dépense exécutée ce mois.", margin + 3, y + 5);
      y += 8;
    } else {
      monthlyExpenses.forEach(exp => {
        if (y > pageHeight - 20) {
          doc.addPage();
          pageCount++;
          drawPageHeaderFooter(pageCount);
          y = 25;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(new Date(exp.date).toLocaleDateString('fr-FR'), margin + 3, y + 4.5);
        doc.text(exp.title, margin + 30, y + 4.5);
        doc.text(exp.type === 'payment-order' ? 'Ordre de paiement' : (exp.type === 'command' ? 'Bon de commande' : 'Remboursement'), margin + 95, y + 4.5);
        doc.text('Payé', margin + 140, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.text(`${exp.amount.toLocaleString()} F`, margin + 175, y + 4.5, { align: 'right' });
        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });
    }

    doc.save(`bilan_mensuel_consolide_${getApeeShortName(settings).toLowerCase()}_${currentMonth}.pdf`);
    setSuccessMsg('Bilan mensuel consolidé exporté avec succès sous format PDF !');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ----------------------------------------------------
  // ANNUAL FINANCIAL SUMMARY (Month-by-Month Recharts Data Construction)
  // ----------------------------------------------------
  
  // Destructure school year start/end years with strong fallbacks
  let startYear = 2025;
  let endYear = 2026;
  if (settings && settings.schoolYear) {
    const parts = settings.schoolYear.split('/');
    if (parts.length === 2) {
      const s = parseInt(parts[0].trim(), 10);
      const e = parseInt(parts[1].trim(), 10);
      if (!isNaN(s) && !isNaN(e)) {
        startYear = s;
        endYear = e;
      }
    } else {
      const y = parseInt(settings.schoolYear.trim(), 10);
      if (!isNaN(y)) {
        startYear = y;
        endYear = y + 1;
      }
    }
  } else {
    // Fallback based on current date
    const curYear = new Date().getUTCFullYear();
    const curMonth = new Date().getUTCMonth() + 1;
    if (curMonth >= 9) {
      startYear = curYear;
      endYear = curYear + 1;
    } else {
      startYear = curYear - 1;
      endYear = curYear;
    }
  }

  const monthsList = [
    { monthNum: 9, year: startYear, labelFr: 'Septembre', labelEn: 'September' },
    { monthNum: 10, year: startYear, labelFr: 'Octobre', labelEn: 'October' },
    { monthNum: 11, year: startYear, labelFr: 'Novembre', labelEn: 'November' },
    { monthNum: 12, year: startYear, labelFr: 'Décembre', labelEn: 'December' },
    { monthNum: 1, year: endYear, labelFr: 'Janvier', labelEn: 'January' },
    { monthNum: 2, year: endYear, labelFr: 'Février', labelEn: 'February' },
    { monthNum: 3, year: endYear, labelFr: 'Mars', labelEn: 'March' },
    { monthNum: 4, year: endYear, labelFr: 'Avril', labelEn: 'April' },
    { monthNum: 5, year: endYear, labelFr: 'Mai', labelEn: 'May' },
    { monthNum: 6, year: endYear, labelFr: 'Juin', labelEn: 'June' },
    { monthNum: 7, year: endYear, labelFr: 'Juillet', labelEn: 'July' },
    { monthNum: 8, year: endYear, labelFr: 'Août', labelEn: 'August' },
  ];

  const keyRevenue = isEn ? "Revenue" : "Recettes";
  const keyExpenses = isEn ? "Expenses" : "Dépenses";
  const keyParents = isEn ? "Parents Contributions" : "Cotisations Parents";
  const keyOthers = isEn ? "Other Revenues" : "Autres Recettes";
  const keyNet = isEn ? "Net Balance" : "Solde Net";

  let schoolYearTotalRevenue = 0;
  let schoolYearTotalExpenses = 0;

  const annualChartData = monthsList.map(month => {
    let parentRevenue = 0;
    let otherRevenue = 0;
    let executedExpense = 0;
    let totalExpense = 0;

    // Filter parents' payments matching month and year
    parents.forEach(p => {
      if (p.payments) {
        p.payments.forEach(pay => {
          if (pay.date) {
            const d = pay.date.split('-');
            if (d.length >= 2) {
              const payYear = parseInt(d[0], 10);
              const payMonth = parseInt(d[1], 10);
              if (payYear === month.year && payMonth === month.monthNum) {
                parentRevenue += pay.amount;
              }
            } else {
              const pDate = new Date(pay.date);
              if (!isNaN(pDate.getTime())) {
                const payYear = pDate.getUTCFullYear();
                const payMonth = pDate.getUTCMonth() + 1;
                if (payYear === month.year && payMonth === month.monthNum) {
                  parentRevenue += pay.amount;
                }
              }
            }
          }
        });
      }
    });

    // Filter other revenues matching month and year
    otherRevenues.forEach(rev => {
      if (rev.date) {
        const d = rev.date.split('-');
        if (d.length >= 2) {
          const revYear = parseInt(d[0], 10);
          const revMonth = parseInt(d[1], 10);
          if (revYear === month.year && revMonth === month.monthNum) {
            otherRevenue += rev.amount;
          }
        } else {
          const rDate = new Date(rev.date);
          if (!isNaN(rDate.getTime())) {
            const revYear = rDate.getUTCFullYear();
            const revMonth = rDate.getUTCMonth() + 1;
            if (revYear === month.year && revMonth === month.monthNum) {
              otherRevenue += rev.amount;
            }
          }
        }
      }
    });

    // Filter expenses matching month and year
    expenses.forEach(exp => {
      if (exp.date) {
        const d = exp.date.split('-');
        if (d.length >= 2) {
          const expYear = parseInt(d[0], 10);
          const expMonth = parseInt(d[1], 10);
          if (expYear === month.year && expMonth === month.monthNum) {
            totalExpense += exp.amount;
            if (exp.status === 'Executed') {
              executedExpense += exp.amount;
            }
          }
        } else {
          const eDate = new Date(exp.date);
          if (!isNaN(eDate.getTime())) {
            const expYear = eDate.getUTCFullYear();
            const expMonth = eDate.getUTCMonth() + 1;
            if (expYear === month.year && expMonth === month.monthNum) {
              totalExpense += exp.amount;
              if (exp.status === 'Executed') {
                executedExpense += exp.amount;
              }
            }
          }
        }
      }
    });

    const totalRev = parentRevenue + otherRevenue;
    const selectedExpense = expenseFilter === 'executed' ? executedExpense : totalExpense;

    schoolYearTotalRevenue += totalRev;
    schoolYearTotalExpenses += selectedExpense;

    return {
      monthLabel: isEn ? month.labelEn.substring(0, 3) : month.labelFr.substring(0, 4) + '.',
      monthFullName: isEn ? month.labelEn : month.labelFr,
      year: month.year,
      [keyRevenue]: totalRev,
      [keyExpenses]: selectedExpense,
      [keyParents]: parentRevenue,
      [keyOthers]: otherRevenue,
      [keyNet]: totalRev - selectedExpense,
    };
  });

  const schoolYearNetSavings = schoolYearTotalRevenue - schoolYearTotalExpenses;

  return (
    <div id="content_apee_report" className="space-y-6">

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-150 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">📈 Générateur de Bilans Financiers</h2>
          <p className="text-xs text-gray-500 font-medium">
            Générer des états récapitulatifs périodiques des cotisations récupérées. Filtres dynamiques de trésorerie.
          </p>
        </div>
        
        <div className="flex items-center gap-2 select-none shrink-0 flex-wrap md:flex-nowrap">
          <button
            onClick={handleCopyTsv}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-800 rounded-xl hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 cursor-pointer transition"
            title="Copier le tableau pour coller dans Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Vers Excel (Copier)
          </button>
          
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-800 rounded-xl hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 cursor-pointer transition"
            title="Télécharger fichier JSON"
          >
            <Download className="h-3.5 w-3.5 text-indigo-600" /> Export JSON
          </button>

          <button
            onClick={handlePrintActiveSegmentViewPdf}
            className="px-3.5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-md active:scale-97"
            title="Télécharger un rapport détaillé au format PDF contenant l'affichage ciblé du tableau filtré ci-dessous"
          >
            <Download className="h-4 w-4 text-amber-250" /> Télécharger Rapport Actuel (PDF)
          </button>

          <button
            onClick={handlePrintMonthlyReport}
            className="px-3.5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-md active:scale-97"
            title="Télécharger le bilan mensuel consolidé du mois en cours contenant revenus et dépenses exécutées"
            type="button"
          >
            <Printer className="h-4 w-4 text-emerald-300" /> Télécharger Bilan Mensuel
          </button>

          <button
            onClick={handlePrintBilan}
            className="px-3.5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-md active:scale-97"
            title="Générer un bilan financier au format PDF prêt pour l'édition et l'impression physique"
          >
            <Download className="h-4 w-4 text-amber-300" /> Télécharger Bilan (PDF)
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Numerical summaries */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wide">Total Recettes Brut</span>
          <p className="text-sm font-bold text-emerald-600 font-mono">{totalCollectedAmountAlready.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wide">Reste Dû Établissement</span>
          <p className="text-sm font-bold text-amber-600 font-mono">{totalDebtAmount.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wide">Taux Moyen d'Apport</span>
          <p className="text-sm font-bold text-sky-600 font-mono">{rateCollectedPercent.toFixed(1)}%</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-1 text-center">
          <span className="text-[10px] text-indigo-700 uppercase font-extrabold tracking-wide">Période Active Filtrée</span>
          <p className="text-sm font-bold text-indigo-900 font-mono">{totalCollectedInPeriod.toLocaleString()} FCFA</p>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-slate-50/45 border rounded-2xl p-4 flex flex-wrap items-end gap-4">
        
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Période fiscale
          </label>
          <div className="flex bg-white border rounded-lg p-0.5 font-semibold text-xs">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'today', label: "Aujourd'hui" },
              { id: 'month', label: 'Ce mois' },
              { id: 'custom', label: 'Personnalisé' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setFilterPeriod(p.id)}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition ${
                  filterPeriod === p.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {filterPeriod === 'custom' && (
          <div className="flex items-center gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Du :</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 text-xs border rounded bg-white text-slate-700 focus:outline-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Au :</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 text-xs border rounded bg-white text-slate-700 focus:outline-indigo-500"
              />
            </div>
          </div>
        )}

      </div>

      {/* Visual 'Annual Financial Summary' report */}
      <div id="annual_financial_summary_panel" className="bg-white border border-slate-205 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500 animate-pulse" />
              {isEn ? "Annual Financial Summary" : "Bilan Annuel Consolidé"}
              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full select-none font-mono">
                {settings?.schoolYear || "2025/2026"}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {isEn 
                ? "Consolidated month-by-month cashflow comparing total collected revenues versus school year expenses." 
                : "Évolution mensuelle consolidée de la trésorerie comparant les recettes totales perçues aux dépenses."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Collapse Toggle */}
            <button
              type="button"
              onClick={() => setShowChartPanel(!showChartPanel)}
              className="px-2.5 py-1.5 font-semibold text-slate-700 hover:text-slate-950 bg-slate-50 border border-slate-205 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
            >
              {showChartPanel ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  {isEn ? "Hide Chart" : "Masquer le graphique"}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  {isEn ? "Show Chart" : "Afficher le graphique"}
                </>
              )}
            </button>

            {showChartPanel && (
              <>
                {/* Expense Status Filter */}
                <div className="flex bg-slate-100 p-0.5 border rounded-lg font-semibold text-[11px] text-slate-600">
                  <button
                    type="button"
                    onClick={() => setExpenseFilter('executed')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition ${
                      expenseFilter === 'executed' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'hover:text-slate-900'
                    }`}
                    title={isEn ? "Show actual executed expenses only" : "Ne prendre en compte que les dépenses décaissées de l'exercice"}
                  >
                    {isEn ? "Paid Only" : "Décaissé uniquement"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseFilter('all')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition ${
                      expenseFilter === 'all' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'hover:text-slate-900'
                    }`}
                    title={isEn ? "Show all expenses regardless of status" : "Montrer toutes les dépenses y compris en attente ou approuvées"}
                  >
                    {isEn ? "All Projected" : "Tout le budget proposé"}
                  </button>
                </div>

                {/* Chart Type Toggle */}
                <div className="flex bg-slate-100 p-0.5 border rounded-lg font-semibold text-[11px] text-slate-600">
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                      chartType === 'bar' ? 'bg-indigo-600 text-white shadow-sm font-black' : 'hover:text-slate-900'
                    }`}
                  >
                    {isEn ? "Bars" : "Colonnes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('line')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                      chartType === 'line' ? 'bg-indigo-600 text-white shadow-sm font-black' : 'hover:text-slate-900'
                    }`}
                  >
                    {isEn ? "Line" : "Courbes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('area')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                      chartType === 'area' ? 'bg-indigo-600 text-white shadow-sm font-black' : 'hover:text-slate-900'
                    }`}
                  >
                    {isEn ? "Area" : "Aires"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {showChartPanel && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Visual Overview metrics of the school year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              <div className="bg-slate-50/85 hover:bg-slate-100/90 pb-3.5 pt-3 px-4 border border-slate-150 rounded-xl space-y-1 select-none transition">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Coins className="h-3 w-3 text-emerald-500" />
                  {isEn ? "School Year Revenue" : "Recettes Globales Scolaires"}
                </span>
                <div className="flex items-baseline justify-between">
                  <p className="text-base font-extrabold text-slate-800 font-mono">
                    {schoolYearTotalRevenue.toLocaleString()} FCFA
                  </p>
                  <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.25 flex items-center gap-0.5">
                    <ArrowUpRight className="h-3 w-3" />
                    INFLOW
                  </span>
                </div>
              </div>

              <div className="bg-slate-50/85 hover:bg-slate-100/90 pb-3.5 pt-3 px-4 border border-slate-150 rounded-xl space-y-1 select-none transition">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-rose-500" />
                  {isEn ? "School Year Expenses" : "Dépenses Globales Scolaires"}
                </span>
                <div className="flex items-baseline justify-between">
                  <p className="text-base font-extrabold text-slate-800 font-mono">
                    {schoolYearTotalExpenses.toLocaleString()} FCFA
                  </p>
                  <span className="text-[10px] text-rose-600 font-extrabold bg-rose-50 border border-rose-100 rounded px-1.5 py-0.25 flex items-center gap-0.5">
                    <ArrowDownRight className="h-3 w-3" />
                    OUTFLOW
                  </span>
                </div>
              </div>

              <div className={`pb-3.5 pt-3 px-4 border rounded-xl space-y-1 select-none transition ${
                schoolYearNetSavings >= 0 
                  ? 'bg-emerald-50/40 hover:bg-emerald-50/60 border-emerald-150' 
                  : 'bg-rose-50/40 hover:bg-rose-50/60 border-rose-150'
              }`}>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Activity className="h-3 w-3 text-indigo-550 animate-pulse" />
                  {isEn ? "Consolidated Net Savings" : "Trésorerie / Solde Net Cumulé"}
                </span>
                <div className="flex items-baseline justify-between">
                  <p className={`text-base font-black font-mono ${
                    schoolYearNetSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {schoolYearNetSavings.toLocaleString()} FCFA
                  </p>
                  <span className={`text-[10px] font-black rounded px-1.5 py-0.25 border ${
                    schoolYearNetSavings >= 0 
                      ? 'text-emerald-700 bg-emerald-100/60 border-emerald-200' 
                      : 'text-rose-700 bg-rose-100/60 border-rose-200'
                  }`}>
                    {schoolYearNetSavings >= 0 ? '+' : ''} {isEn ? "SURPLUS" : "EXTREME"}
                  </span>
                </div>
              </div>

            </div>

            {/* Recharts Graphical implementation */}
            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
              <div className="w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart
                      data={annualChartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="monthLabel" 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-lg p-3.5 space-y-2 select-none text-[11px] max-w-xs transition-transform duration-100">
                                <div className="flex justify-between items-baseline gap-4 font-black border-b border-white/10 pb-1">
                                  <span className="text-slate-300">{data.monthFullName} {data.year}</span>
                                  <span className="font-mono text-indigo-400 text-[10px]">PASMA-SYS</span>
                                </div>
                                <div className="space-y-1 font-semibold leading-relaxed">
                                  <div className="flex justify-between items-center gap-6">
                                    <span className="flex items-center gap-1 text-emerald-420">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                      {keyRevenue}:
                                    </span>
                                    <span className="font-mono text-slate-100 font-bold">{(data[keyRevenue] || 0).toLocaleString()} F</span>
                                  </div>
                                  <div className="pl-3 text-[10px] text-slate-400 font-sans space-y-0.5">
                                    <div className="flex justify-between gap-4">
                                      <span>• {isEn ? "Parents:" : "Cotisations:"}</span>
                                      <span className="font-mono">{(data[keyParents] || 0).toLocaleString()} F</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>• {isEn ? "Other Sources:" : "Autres Recettes:"}</span>
                                      <span className="font-mono">{(data[keyOthers] || 0).toLocaleString()} F</span>
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center gap-6 pt-1 border-t border-white/5">
                                    <span className="flex items-center gap-1 text-rose-420">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                      {keyExpenses}:
                                    </span>
                                    <span className="font-mono text-slate-100 font-bold">{(data[keyExpenses] || 0).toLocaleString()} F</span>
                                  </div>

                                  <div className="flex justify-between items-center gap-6 pt-1 border-t border-white/10">
                                    <span className={`flex items-center gap-1 ${data[keyNet] >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      <Activity className="h-3.5 w-3.5 animate-pulse" />
                                      {isEn ? "Net Excess" : "Excédent Mensuel"}:
                                    </span>
                                    <span className={`font-mono text-xs font-black ${data[keyNet] >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                      {data[keyNet] >= 0 ? '+' : ''}{(data[keyNet] || 0).toLocaleString()} F
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        iconType="circle"
                        verticalAlign="top"
                        height={36}
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}
                      />
                      <Bar 
                        dataKey={keyRevenue} 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={45}
                      />
                      <Bar 
                        dataKey={keyExpenses} 
                        fill="#f43f5e" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={45}
                      />
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart
                      data={annualChartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="monthLabel" 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-lg p-3.5 space-y-2 select-none text-[11px] max-w-xs transition-transform duration-100">
                                <div className="flex justify-between items-baseline gap-4 font-black border-b border-white/10 pb-1">
                                  <span className="text-slate-300">{data.monthFullName} {data.year}</span>
                                  <span className="font-mono text-indigo-400 text-[10px]">PASMA-SYS</span>
                                </div>
                                <div className="space-y-1 font-semibold leading-relaxed">
                                  <div className="flex justify-between items-center gap-6">
                                    <span className="flex items-center gap-1 text-emerald-420">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                      {keyRevenue}:
                                    </span>
                                    <span className="font-mono text-slate-100 font-bold">{(data[keyRevenue] || 0).toLocaleString()} F</span>
                                  </div>
                                  <div className="pl-3 text-[10px] text-slate-400 font-sans space-y-0.5">
                                    <div className="flex justify-between gap-4">
                                      <span>• {isEn ? "Parents:" : "Cotisations:"}</span>
                                      <span className="font-mono">{(data[keyParents] || 0).toLocaleString()} F</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>• {isEn ? "Other Sources:" : "Autres Recettes:"}</span>
                                      <span className="font-mono">{(data[keyOthers] || 0).toLocaleString()} F</span>
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center gap-6 pt-1 border-t border-white/5">
                                    <span className="flex items-center gap-1 text-rose-420">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                      {keyExpenses}:
                                    </span>
                                    <span className="font-mono text-slate-100 font-bold">{(data[keyExpenses] || 0).toLocaleString()} F</span>
                                  </div>

                                  <div className="flex justify-between items-center gap-6 pt-1 border-t border-white/10">
                                    <span className={`flex items-center gap-1 ${data[keyNet] >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      <Activity className="h-3.5 w-3.5 animate-pulse" />
                                      {isEn ? "Net Excess" : "Excédent Mensuel"}:
                                    </span>
                                    <span className={`font-mono text-xs font-black ${data[keyNet] >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                      {data[keyNet] >= 0 ? '+' : ''}{(data[keyNet] || 0).toLocaleString()} F
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        iconType="circle"
                        verticalAlign="top"
                        height={36}
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey={keyRevenue} 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 1 }} 
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey={keyExpenses} 
                        stroke="#f43f5e" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 1 }} 
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey={keyNet} 
                        stroke="#6366f1" 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        dot={{ r: 3 }} 
                      />
                    </LineChart>
                  ) : (
                    <AreaChart
                      data={annualChartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="monthLabel" 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-lg p-3.5 space-y-2 select-none text-[11px] max-w-xs transition-transform duration-100">
                                <div className="flex justify-between items-baseline gap-4 font-black border-b border-white/10 pb-1">
                                  <span className="text-slate-300">{data.monthFullName} {data.year}</span>
                                  <span className="font-mono text-indigo-400 text-[10px]">PASMA-SYS</span>
                                </div>
                                <div className="space-y-1 font-semibold leading-relaxed">
                                  <div className="flex justify-between items-center gap-6">
                                    <span className="flex items-center gap-1 text-emerald-420">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                      {keyRevenue}:
                                    </span>
                                    <span className="font-mono text-slate-100 font-bold">{(data[keyRevenue] || 0).toLocaleString()} F</span>
                                  </div>
                                  <div className="pl-3 text-[10px] text-slate-400 font-sans space-y-0.5">
                                    <div className="flex justify-between gap-4">
                                      <span>• {isEn ? "Parents:" : "Cotisations:"}</span>
                                      <span className="font-mono">{(data[keyParents] || 0).toLocaleString()} F</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>• {isEn ? "Other Sources:" : "Autres Recettes:"}</span>
                                      <span className="font-mono">{(data[keyOthers] || 0).toLocaleString()} F</span>
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center gap-6 pt-1 border-t border-white/5">
                                    <span className="flex items-center gap-1 text-rose-420">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                      {keyExpenses}:
                                    </span>
                                    <span className="font-mono text-slate-100 font-bold">{(data[keyExpenses] || 0).toLocaleString()} F</span>
                                  </div>

                                  <div className="flex justify-between items-center gap-6 pt-1 border-t border-white/10">
                                    <span className={`flex items-center gap-1 ${data[keyNet] >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      <Activity className="h-3.5 w-3.5 animate-pulse" />
                                      {isEn ? "Net Excess" : "Excédent Mensuel"}:
                                    </span>
                                    <span className={`font-mono text-xs font-black ${data[keyNet] >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                      {data[keyNet] >= 0 ? '+' : ''}{(data[keyNet] || 0).toLocaleString()} F
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        iconType="circle"
                        verticalAlign="top"
                        height={36}
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey={keyRevenue} 
                        stroke="#10b981" 
                        fillOpacity={1} 
                        fill="url(#colorRev)" 
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey={keyExpenses} 
                        stroke="#f43f5e" 
                        fillOpacity={1} 
                        fill="url(#colorExp)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main reporting logs list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Tabular payment log */}
        <div className="lg:col-span-7 bg-white border border-slate-150 rounded-2xl p-4 space-y-3.5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Journal de Trésorerie Découpé
              </h3>
              <p className="text-[10px] text-gray-400 font-sans mt-0.5">Cliquez sur un onglet pour basculer la liste active.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintActiveSegmentViewPdf}
                className="px-2 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-md flex items-center gap-1 cursor-pointer transition shadow-xs"
                title="Imprimer cette liste active"
              >
                <Printer className="h-3 w-3" /> Imprimer la liste
              </button>
              <span className="text-[10px] font-mono text-gray-450 font-bold bg-slate-100 hover:bg-slate-150 rounded-md px-2 py-1">
                Total : {
                  activeSegment === 'parents' 
                    ? filteredPayments.length 
                    : activeSegment === 'others' 
                    ? filteredOtherRevenues.length 
                    : filteredExpenses.length
                } lignes
              </span>
            </div>
          </div>

          {/* Segment selection tabs switcher */}
          <div className="flex bg-slate-100/80 border border-slate-205 rounded-xl p-0.75 font-bold text-[11px] max-w-sm select-none gap-1">
            <button
              onClick={() => setActiveSegment('parents')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all duration-155 cursor-pointer flex justify-center items-center gap-1 ${
                activeSegment === 'parents' ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              👨‍👩‍👧‍👦 Cotisations
            </button>
            <button
              onClick={() => setActiveSegment('others')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all duration-155 cursor-pointer flex justify-center items-center gap-1 ${
                activeSegment === 'others' ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              💸 Appoint
            </button>
            <button
              onClick={() => setActiveSegment('expenses')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all duration-155 cursor-pointer flex justify-center items-center gap-1 ${
                activeSegment === 'expenses' ? 'bg-white text-slate-905 shadow-3xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🧾 Dépenses
            </button>
          </div>

          {/* Tri et Filtrage par Date */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Filter className="h-3 w-3 text-indigo-500" /> {isEn ? "Filter by single date:" : "Filtrer par date précise :"}
              </span>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={specificDateFilter}
                  onChange={(e) => setSpecificDateFilter(e.target.value)}
                  className="pl-2 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[160px]"
                />
                {specificDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSpecificDateFilter('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-650 font-bold p-0.5"
                    title={isEn ? "Clear date" : "Effacer la date"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-1.5 font-bold text-[11px] bg-white border border-slate-205 hover:bg-slate-100 text-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-2xs"
                title={isEn ? "Toggle date sort order" : "Inverser l'ordre de tri des dates"}
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {isEn 
                    ? `Sort: ${sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}` 
                    : `Tri : ${sortOrder === 'desc' ? 'Plus récents d\'abord ⬇️' : 'Plus anciens d\'abord ⬆️'}`}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeSegment === 'parents' ? (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-gray-505 font-bold uppercase text-[9px] tracking-wider select-none">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Parent d'Élève</th>
                    <th className="py-2 px-2">Moyen</th>
                    <th className="py-2 px-2 text-right">Montant</th>
                    <th className="py-2 px-2">Observations</th>
                    <th className="py-2 px-2 text-center w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400 text-[11px] font-medium leading-relaxed">
                        Aucune transaction financière n'a été enregistrée pour les parents durant cette période.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2 font-mono text-gray-450">{p.date}</td>
                        <td className="py-2 px-2 font-semibold text-slate-800">{p.parentName}</td>
                        <td className="py-2 px-2">
                          <span className="text-[9px] font-sans font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {p.method || 'Espèces'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600">{p.amount.toLocaleString()} FCFA</td>
                        <td className="py-2 px-2 text-gray-500 text-[10px] max-w-[200px]">
                          <div className="font-medium">{p.note || '-'}</div>
                          {p.allocations && Object.keys(p.allocations).length > 0 && (
                            <div className="text-[8.5px] font-sans text-slate-600 mt-1.5 flex flex-wrap gap-1">
                              {Object.entries(p.allocations).map(([oblId, amt]) => {
                                const oblName = settings?.financialObligations?.find((o: any) => o.id === oblId)?.name || oblId;
                                return (
                                  <span key={oblId} className="bg-emerald-50 text-emerald-800 font-bold px-1 rounded shadow-3xs">
                                    {oblName} ({Number(amt).toLocaleString()} {settings?.currency || 'FCFA'})
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingParentItem(p)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePaymentItem(p.parentId, p.paymentId)}
                              className="p-1 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded transition cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : activeSegment === 'others' ? (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-gray-505 font-bold uppercase text-[9px] tracking-wider select-none">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Nom Donneur / Payeur</th>
                    <th className="py-2 px-2">Qualité/Statut</th>
                    <th className="py-2 px-2">Moyen</th>
                    <th className="py-2 px-2 text-right">Montant</th>
                    <th className="py-2 px-2 text-center w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOtherRevenues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400 text-[11px] font-medium leading-relaxed">
                        Aucune autre recette n'a été encaissée durant cette période.
                      </td>
                    </tr>
                  ) : (
                    filteredOtherRevenues.map((rev) => {
                      let statLabel = "Autre tiers";
                      if (rev.status === 'membre_honneur') statLabel = "Membre d'Honneur";
                      else if (rev.status === 'institution') statLabel = `Institution (${rev.statusDetails || ''})`;

                      return (
                        <tr key={rev.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-2 font-mono text-gray-450">{rev.date}</td>
                          <td className="py-2 px-2 font-semibold text-slate-800">
                            <div>{rev.payerName}</div>
                            {rev.notes && <span className="text-[9px] text-indigo-600/75 font-sans tracking-wide leading-none select-none italic block mt-0.5">Note: {rev.notes}</span>}
                          </td>
                          <td className="py-2 px-2 font-medium text-slate-655 font-mono text-[10px]">{statLabel}</td>
                          <td className="py-2 px-2">
                            <span className="text-[9px] font-sans font-extrabold bg-emerald-50 text-emerald-750 px-1.5 py-0.5 rounded uppercase tracking-wider border border-emerald-100/50">
                              {rev.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600">{rev.amount.toLocaleString()} FCFA</td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingOtherItem(rev)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOtherRevenueItem(rev.id)}
                                className="p-1 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded transition cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-gray-505 font-bold uppercase text-[9px] tracking-wider select-none">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Désignation de la Dépense</th>
                    <th className="py-2 px-2">Type / Nature</th>
                    <th className="py-2 px-2">Statut execution</th>
                    <th className="py-2 px-2 text-right">Montant</th>
                    <th className="py-2 px-2 text-center w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400 text-[11px] font-medium leading-relaxed">
                        Aucune dépense enregistrée durant cette période.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const typeLabel = exp.type === 'payment-order' ? 'Ordre de paiement' : (exp.type === 'command' ? 'Bon de commande' : 'Remboursement');
                      const statusLabel = exp.status === 'Executed' ? 'Exécuté' : (exp.status === 'Approved' ? 'Approuvé' : 'En attente');
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-2 font-mono text-gray-450">{exp.date}</td>
                          <td className="py-2 px-2 font-semibold text-slate-800">
                            <div>{exp.title}</div>
                            {exp.description && <span className="text-[9px] text-slate-400 font-sans block mt-0.5">{exp.description}</span>}
                          </td>
                          <td className="py-2 px-2 font-medium text-slate-655 font-mono text-[10px]">{typeLabel}</td>
                          <td className="py-2 px-2">
                            <span className={`text-[9px] font-sans font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                              exp.status === 'Executed' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : exp.status === 'Approved'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-red-650">{exp.amount.toLocaleString()} FCFA</td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingExpenseItem(exp)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExpenseItem(exp.id)}
                                className="p-1 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded transition cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right side panel containing stats and individual parent statements */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Class level breakdown list */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4 space-y-3.5">
            <div className="border-b pb-2 font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <BarChart2 className="h-4 w-4 text-indigo-500" /> Performances par division de classe
            </div>

            <div className="space-y-2.5">
              {Object.keys(classStatsMap).map(cls => {
                const item = classStatsMap[cls];
                if (item.pupilsCount === 0) return null; // Only show classes with students
                const percent = item.expected > 0 ? (item.collected / item.expected) * 100 : 0;
                
                return (
                  <div key={cls} className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline font-medium text-slate-700">
                      <span>
                        <strong className="font-bold text-slate-900">{cls}</strong> ({item.pupilsCount} élève{item.pupilsCount > 1 ? 's' : ''})
                      </span>
                      <span className="font-mono text-[10px] font-bold text-indigo-700">
                        {percent.toFixed(0)}% ({Math.round(item.collected).toLocaleString()} FCFA / {item.expected.toLocaleString()} FCFA)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          percent >= 100 ? 'bg-emerald-500' : (percent >= 50 ? 'bg-indigo-500' : 'bg-red-500')
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {parents.length === 0 && (
                <p className="text-center text-gray-400 text-[11px] py-4">Aucune donnée disponible pour le comparatif par classe.</p>
              )}
            </div>
          </div>

          {/* Individual Parent accounting PDF generator */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4 space-y-3.5">
            <div className="border-b pb-2 font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Printer className="h-4 w-4 text-indigo-500" /> Situation Comptable par Parent
            </div>
            
            <div className="space-y-3 text-xs">
              <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                Générez instantanément un relevé de situation comptable certifié (PDF) au format officiel pour n'importe quel parent d'élève.
              </p>
              
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Sélectionner un Parent d'Élève</label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-semibold text-slate-705"
                >
                  <option value="">-- Choisir un parent d'élève ({parents.length}) --</option>
                  {[...parents].sort((a, b) => a.name.localeCompare(b.name)).map((parent) => {
                    const remaining = parent.totalDue - parent.totalPaid;
                    const statusText = remaining <= 0 ? "Soldé" : `Reste: ${remaining.toLocaleString()} F`;
                    return (
                      <option key={parent.id} value={parent.id}>
                        {parent.name.toUpperCase()} ({statusText})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedParentId ? (() => {
                const parent = parents.find(p => p.id === selectedParentId);
                if (!parent) return null;
                const remaining = parent.totalDue - parent.totalPaid;
                
                return (
                  <div className="bg-slate-50 border rounded-xl p-3 space-y-2.5 animate-in fade-in duration-150 mt-2">
                    <div className="flex justify-between items-baseline border-b border-slate-100 pb-1.5">
                      <span className="font-bold text-slate-850 truncate max-w-[170px]" title={parent.name}>
                        👤 {parent.name.toUpperCase()}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        remaining <= 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {remaining <= 0 ? 'Soldé' : 'Partiel/Retard'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 leading-relaxed font-sans">
                      <div>
                        <span className="text-[9px] text-gray-400 block uppercase font-bold">Téléphone</span>
                        <span>{parent.phone || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 block uppercase font-bold">Élèves associés</span>
                        <span className="font-bold text-slate-800">
                          {parent.students?.length || 0} enfant{parent.students?.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="col-span-2 border-t border-slate-100 pt-1.5 grid grid-cols-3 gap-1 text-center mt-1">
                        <div>
                          <span className="text-[9px] text-gray-400 block uppercase font-bold">Exigible</span>
                          <span className="font-mono text-slate-700 font-bold">{parent.totalDue.toLocaleString()} F</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 block uppercase font-bold">Réglé</span>
                          <span className="font-mono text-emerald-600 font-bold">{parent.totalPaid.toLocaleString()} F</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 block uppercase font-bold">Reste dû</span>
                          <span className="font-mono text-rose-600 font-extrabold">{remaining.toLocaleString()} F</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePrintParentReportPdf(parent)}
                      className="w-full mt-2.5 py-2 px-3 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-1.5 transition active:scale-97 cursor-pointer shadow-sm"
                    >
                      <Printer className="h-4 w-4 text-indigo-200" /> Générer le Rapport PDF (Situation)
                    </button>
                  </div>
                );
              })() : (
                <div className="bg-slate-50/50 border border-dashed rounded-xl p-4 text-center text-gray-400 text-[10px] leading-relaxed">
                  Aucun parent sélectionné. Sélectionnez un parent dans la liste ci-dessus pour inspecter sa situation comptable et éditer son relevé officiel de paiement de cotisations.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {editingParentItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Modifier la Cotisation</h3>
                <p className="text-[10px] text-indigo-205 font-medium mt-0.5">Parent d'élève: {editingParentItem.parentName}</p>
              </div>
              <button 
                type="button"
                onClick={() => setEditingParentItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Date du versement</label>
                <input
                  type="date"
                  value={editingParentItem.date}
                  onChange={(e) => setEditingParentItem({ ...editingParentItem, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Montant (FCFA)</label>
                <input
                  type="number"
                  value={editingParentItem.amount}
                  onChange={(e) => setEditingParentItem({ ...editingParentItem, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Moyen de paiement</label>
                <select
                  value={editingParentItem.method || 'Espèces'}
                  onChange={(e) => setEditingParentItem({ ...editingParentItem, method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-semibold text-slate-705"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="MTN Mobile Money">MTN Mobile Money</option>
                  <option value="Wave">Wave</option>
                  <option value="Moov Money">Moov Money</option>
                  <option value="Virement">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Observations</label>
                <textarea
                  value={editingParentItem.note || ''}
                  onChange={(e) => setEditingParentItem({ ...editingParentItem, note: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500"
                  placeholder="Notes, numéro de transaction, banque, etc."
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingParentItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEditedPaymentItem}
                className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm active:scale-97 cursor-pointer"
              >
                Enregistrer la modification
              </button>
            </div>
          </div>
        </div>
      )}

      {editingOtherItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Modifier une Recette d'Appoint</h3>
                <p className="text-[10px] text-indigo-205 font-medium mt-0.5">Référence: {editingOtherItem.payerName}</p>
              </div>
              <button 
                type="button"
                onClick={() => setEditingOtherItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Nom Donneur / Payeur</label>
                <input
                  type="text"
                  value={editingOtherItem.payerName}
                  onChange={(e) => setEditingOtherItem({ ...editingOtherItem, payerName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Qualité / Statut</label>
                <select
                  value={editingOtherItem.status || 'autre'}
                  onChange={(e) => setEditingOtherItem({ ...editingOtherItem, status: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-semibold text-slate-705"
                >
                  <option value="autre">Autre tiers</option>
                  <option value="membre_honneur">Membre d'Honneur</option>
                  <option value="institution">Institution / Subvention</option>
                </select>
              </div>

              {editingOtherItem.status === 'institution' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Précisions Institution</label>
                  <input
                    type="text"
                    value={editingOtherItem.statusDetails || ''}
                    onChange={(e) => setEditingOtherItem({ ...editingOtherItem, statusDetails: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500"
                    placeholder="e.g. Mairie, Ministère..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Montant (FCFA)</label>
                  <input
                    type="number"
                    value={editingOtherItem.amount}
                    onChange={(e) => setEditingOtherItem({ ...editingOtherItem, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Date</label>
                  <input
                    type="date"
                    value={editingOtherItem.date}
                    onChange={(e) => setEditingOtherItem({ ...editingOtherItem, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Moyen de règlement</label>
                <input
                  type="text"
                  value={editingOtherItem.paymentMethod}
                  onChange={(e) => setEditingOtherItem({ ...editingOtherItem, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500"
                  placeholder="e.g. Espèces, Orange Money, Wave..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Notes / Détails</label>
                <textarea
                  value={editingOtherItem.notes || ''}
                  onChange={(e) => setEditingOtherItem({ ...editingOtherItem, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500"
                  placeholder="Plus de précisions..."
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingOtherItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEditedOtherRevenueItem}
                className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm active:scale-97 cursor-pointer"
              >
                Enregistrer la modification
              </button>
            </div>
          </div>
        </div>
      )}

      {editingExpenseItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Modifier une Dépense</h3>
                <p className="text-[10px] text-indigo-205 font-medium mt-0.5">Titre: {editingExpenseItem.title}</p>
              </div>
              <button 
                type="button"
                onClick={() => setEditingExpenseItem(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Désignation de la dépense</label>
                <input
                  type="text"
                  value={editingExpenseItem.title}
                  onChange={(e) => setEditingExpenseItem({ ...editingExpenseItem, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Type / Nature</label>
                <select
                  value={editingExpenseItem.type || 'payment-order'}
                  onChange={(e) => setEditingExpenseItem({ ...editingExpenseItem, type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-semibold text-slate-705"
                >
                  <option value="payment-order">Ordre de paiement</option>
                  <option value="command">Bon de commande</option>
                  <option value="refund">Remboursement</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Statut d'exécution</label>
                <select
                  value={editingExpenseItem.status || 'Pending'}
                  onChange={(e) => setEditingExpenseItem({ ...editingExpenseItem, status: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-semibold text-slate-705"
                >
                  <option value="Pending">En attente</option>
                  <option value="Approved">Approuvé</option>
                  <option value="Executed">Exécuté</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Montant (FCFA)</label>
                  <input
                    type="number"
                    value={editingExpenseItem.amount}
                    onChange={(e) => setEditingExpenseItem({ ...editingExpenseItem, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Date</label>
                  <input
                    type="date"
                    value={editingExpenseItem.date}
                    onChange={(e) => setEditingExpenseItem({ ...editingExpenseItem, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Description</label>
                <textarea
                  value={editingExpenseItem.description || ''}
                  onChange={(e) => setEditingExpenseItem({ ...editingExpenseItem, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-indigo-500"
                  placeholder="Détails de la dépense..."
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingExpenseItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEditedExpenseItem}
                className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm active:scale-97 cursor-pointer"
              >
                Enregistrer la modification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Expenses */}
      {deleteExpenseConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-50 text-red-600 mb-4 shadow-3xs">
                <Trash2 className="h-6.5 w-6.5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-950">
                {isEn ? "Confirm deletion" : "Confirmer la suppression"}
              </h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                {isEn 
                  ? "Are you sure you want to permanently delete this expense? This action is irreversible." 
                  : "Êtes-vous sûr de vouloir supprimer définitivement cette dépense ? Cette action est irréversible."}
              </p>
              
              {(() => {
                const exp = expenses.find(e => e.id === deleteExpenseConfirmId);
                if (!exp) return null;
                return (
                  <div className="mt-4 p-3 bg-red-50/50 rounded-2xl border border-red-100 text-left space-y-1">
                    <div className="text-[10px] font-bold text-red-800 uppercase tracking-wide">Détails de la dépense :</div>
                    <div className="text-xs font-extrabold text-slate-800">{exp.title}</div>
                    <div className="text-xs font-mono font-black text-red-600">{exp.amount.toLocaleString()} {settings?.currency || 'FCFA'}</div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteExpenseConfirmId(null)}
                className="flex-1 px-4 py-2 text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer text-center"
              >
                {isEn ? "Cancel" : "Annuler"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteExpenseConfirmId;
                  setDeleteExpenseConfirmId(null);
                  if (onDeleteExpense && id) {
                    await onDeleteExpense(id);
                    setSuccessMsg(isEn ? "Expense deleted successfully." : "La dépense a été supprimée avec succès.");
                    setTimeout(() => setSuccessMsg(null), 3000);
                  }
                }}
                className="flex-1 px-4 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-xs active:scale-97 cursor-pointer text-center"
              >
                {isEn ? "Delete" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Cotisations */}
      {deletePaymentConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-50 text-red-600 mb-4 shadow-3xs">
                <Trash2 className="h-6.5 w-6.5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-950">
                {isEn ? "Confirm deletion" : "Confirmer la suppression"}
              </h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                {isEn 
                  ? "Are you sure you want to permanently delete this student contribution record?" 
                  : "Êtes-vous sûr de vouloir supprimer cette cotisation d'élève ? Cette action est irréversible."}
              </p>
              
              {(() => {
                const parent = parents.find(p => p.id === deletePaymentConfirm.parentId);
                const pay = parent?.payments?.find(pay => pay.id === deletePaymentConfirm.paymentId);
                if (!parent || !pay) return null;
                return (
                  <div className="mt-4 p-3 bg-red-50/50 rounded-2xl border border-red-100 text-left space-y-1">
                    <div className="text-[10px] font-bold text-red-800 uppercase tracking-wide">Détails de la cotisation :</div>
                    <div className="text-xs font-extrabold text-slate-800">Parent : {parent.name}</div>
                    <div className="text-xs font-semibold text-slate-700">Date : {pay.date} | Mode : {pay.method || 'Espèces'}</div>
                    <div className="text-xs font-mono font-black text-red-600">{pay.amount.toLocaleString()} {settings?.currency || 'FCFA'}</div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletePaymentConfirm(null)}
                className="flex-1 px-4 py-2 text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer text-center"
              >
                {isEn ? "Cancel" : "Annuler"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { parentId, paymentId } = deletePaymentConfirm;
                  setDeletePaymentConfirm(null);
                  if (onSaveParent && parentId && paymentId) {
                    const parent = parents.find(p => p.id === parentId);
                    if (!parent) return;

                    const updatedPayments = parent.payments.filter(pay => pay.id !== paymentId);
                    const sumPaid = updatedPayments.reduce((sum, pay) => sum + pay.amount, 0);

                    let computedStatus: 'soldé' | 'partiel' | 'retard' = 'retard';
                    if (sumPaid >= parent.totalDue) {
                      computedStatus = 'soldé';
                    } else if (sumPaid > 0) {
                      computedStatus = 'partiel';
                    }

                    const updatedParent: ApeeParent = {
                      ...parent,
                      payments: updatedPayments,
                      totalPaid: sumPaid,
                      status: computedStatus,
                      updatedAt: new Date().toISOString()
                    };

                    const success = await onSaveParent(updatedParent);
                    if (success) {
                      setSuccessMsg(isEn ? "Payment deleted successfully." : "La cotisation a été supprimée avec succès.");
                      setTimeout(() => setSuccessMsg(null), 3000);
                    }
                  }
                }}
                className="flex-1 px-4 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-xs active:scale-97 cursor-pointer text-center"
              >
                {isEn ? "Delete" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Appoints */}
      {deleteOtherRevenueConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-50 text-red-600 mb-4 shadow-3xs">
                <Trash2 className="h-6.5 w-6.5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-950">
                {isEn ? "Confirm deletion" : "Confirmer la suppression"}
              </h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                {isEn 
                  ? "Are you sure you want to permanently delete this other revenue record? This action is irreversible." 
                  : "Êtes-vous sûr de vouloir supprimer définitivement cette recette d'appoint ? Cette action est irréversible."}
              </p>
              
              {(() => {
                const rev = otherRevenues.find(r => r.id === deleteOtherRevenueConfirmId);
                if (!rev) return null;
                return (
                  <div className="mt-4 p-3 bg-red-50/50 rounded-2xl border border-red-100 text-left space-y-1">
                    <div className="text-[10px] font-bold text-red-800 uppercase tracking-wide">Détails de la recette :</div>
                    <div className="text-xs font-extrabold text-slate-800">Payeur : {rev.payerName}</div>
                    <div className="text-xs font-semibold text-slate-700">Date : {rev.date} | Mode : {rev.paymentMethod}</div>
                    <div className="text-xs font-mono font-black text-red-600">{rev.amount.toLocaleString()} {settings?.currency || 'FCFA'}</div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteOtherRevenueConfirmId(null)}
                className="flex-1 px-4 py-2 text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer text-center"
              >
                {isEn ? "Cancel" : "Annuler"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteOtherRevenueConfirmId;
                  setDeleteOtherRevenueConfirmId(null);
                  if (onDeleteOtherRevenue && id) {
                    await onDeleteOtherRevenue(id);
                    setSuccessMsg(isEn ? "Revenue deleted successfully." : "La recette d'appoint a été supprimée avec succès.");
                    setTimeout(() => setSuccessMsg(null), 3000);
                  }
                }}
                className="flex-1 px-4 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-xs active:scale-97 cursor-pointer text-center"
              >
                {isEn ? "Delete" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
