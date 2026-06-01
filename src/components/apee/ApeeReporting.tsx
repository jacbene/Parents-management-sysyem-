import React, { useState } from 'react';
import { Download, FileSpreadsheet, Printer, Calendar, RefreshCw, BarChart2, DollarSign, Percent, TrendingUp, CheckCircle } from 'lucide-react';
import { ApeeParent, ApeeSettings, ApeeOtherRevenue, ApeeExpense } from '../../types';
import { getApeeShortName } from '../../utils/apeeDb';
import { jsPDF } from 'jspdf';

interface ApeeReportingProps {
  parents: ApeeParent[];
  settings: ApeeSettings;
  otherRevenues?: ApeeOtherRevenue[];
  expenses?: ApeeExpense[];
}

export default function ApeeReporting({ parents, settings, otherRevenues = [], expenses = [] }: ApeeReportingProps) {
  const [filterPeriod, setFilterPeriod] = useState<string>('all'); // 'all' | 'today' | 'month' | 'custom'
  const [activeSegment, setActiveSegment] = useState<'parents' | 'others'>('parents');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Visual action alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter payments list based on active dates
  const getFilteredPayments = () => {
    const list: { parentName: string; parentPhone: string; amount: number; date: string; method?: string; note?: string }[] = [];
    
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
        
        if (include) {
          list.push({
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

    // Sort by date desc
    return list.sort((a, b) => b.date.localeCompare(a.date));
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
      return include;
    }).sort((a, b) => b.date.localeCompare(a.date));
  };

  const filteredPayments = getFilteredPayments();
  const filteredOtherRevenues = getFilteredOtherRevenues();
  const totalCollectedInPeriod = activeSegment === 'parents'
    ? filteredPayments.reduce((sum, p) => sum + p.amount, 0)
    : filteredOtherRevenues.reduce((sum, r) => sum + r.amount, 0);

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
    const listToExport = activeSegment === 'parents' ? filteredPayments : filteredOtherRevenues;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(listToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `bilan_APEE_${activeSegment === 'parents' ? 'cotisations_parents' : 'autres_recettes'}_${filterPeriod}.json`);
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
    } else {
      tsv = 'Date\tNom Donneur / Payeur\tQualité / Statut\tMoyen de paiement\tMontant Versé (FCFA)\tObservations / Réf\n';
      filteredOtherRevenues.forEach(r => {
        let statLabel = "Autre tiers";
        if (r.status === 'membre_honneur') statLabel = "Membre d'Honneur";
        else if (r.status === 'institution') statLabel = `Institution (${r.statusDetails || ''})`;
        tsv += `${r.date}\t${r.payerName}\t${statLabel}\t${r.paymentMethod}\t${r.amount}\t${(r.notes || '') + (r.transactionId ? ' - Réf : ' + r.transactionId : '')}\n`;
      });
    }

    navigator.clipboard.writeText(tsv).then(() => {
      setSuccessMsg('Tableau copié ! Vous pouvez maintenant le coller directement dans Excel ou Google Sheets.');
      setTimeout(() => setSuccessMsg(null), 3500);
    }).catch(err => {
      alert("Échec de la copie automatique: " + err);
    });
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
      doc.text(`Bilan Financier ${getApeeShortName(settings)} - ${settings.associationName || "CES Ekali 1"} • Année : ${settings.schoolYear || ""}`, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text(`Page ${num}`, margin + contentWidth - 12, pageHeight - 8);
      doc.text(`Édité par PASMA-SYS Analytics • Période : ${filterPeriod.toUpperCase()}`, margin, pageHeight - 8);
    };

    drawPageHeaderFooter(pageCount);

    // Cameroon Official Top Headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("RÉPUBLIQUE DU CAMEROUN", margin, y + 4);
    doc.text("REPUBLIC OF CAMEROON", margin + contentWidth, y + 4, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Paix - Travail - Patrie", margin, y + 8);
    doc.text("Peace - Work - Fatherland", margin + contentWidth, y + 8, { align: 'right' });

    y += 15;

    // Title Block
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`BILAN FINANCIER GLOBAL : RECOUVREMENT DES COTISATIONS ${getApeeShortName(settings).toUpperCase()}`, margin + 5, y + 9);

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
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
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
      doc.text(`Bilan Mensuel Consolidé - ${getApeeShortName(settings)} • Période : ${currentMonthName} ${currentYear}`, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text(`Page ${num}`, margin + contentWidth - 12, pageHeight - 8);
      doc.text(`Généré par PASMA-SYS Secrétariat • Date d'édition : ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR')}`, margin, pageHeight - 8);
    };

    drawPageHeaderFooter(pageCount);

    // Cameroon Official Top Headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("RÉPUBLIQUE DU CAMEROUN", margin, y + 4);
    doc.text("REPUBLIC OF CAMEROON", margin + contentWidth, y + 4, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Paix - Travail - Patrie", margin, y + 8);
    doc.text("Peace - Work - Fatherland", margin + contentWidth, y + 8, { align: 'right' });

    y += 15;

    // Title Block
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`BILAN MENSUEL CONSOLIDÉ : ${currentMonthName.toUpperCase()} ${currentYear}`, margin + 5, y + 9);

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
        
        <div className="flex items-center gap-2 select-none shrink-0">
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
            <span className="text-[10px] font-mono text-gray-450 font-bold bg-slate-100 hover:bg-slate-150 rounded-md px-2 py-0.5">
              Total : {activeSegment === 'parents' ? filteredPayments.length : filteredOtherRevenues.length} lignes
            </span>
          </div>

          {/* Segment selection tabs switcher */}
          <div className="flex bg-slate-100/80 border border-slate-205 rounded-xl p-0.75 font-bold text-[11px] max-w-xs select-none">
            <button
              onClick={() => setActiveSegment('parents')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-155 cursor-pointer flex justify-center items-center gap-1 ${
                activeSegment === 'parents' ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              👨‍👩‍👧‍👦 Cotisations Parents
            </button>
            <button
              onClick={() => setActiveSegment('others')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-155 cursor-pointer flex justify-center items-center gap-1 ${
                activeSegment === 'others' ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              💸 Autres Recettes
            </button>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400 text-[11px] font-medium leading-relaxed">
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
                        <td className="py-2 px-2 text-gray-500 text-[10px] truncate max-w-[150px]">{p.note || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-gray-505 font-bold uppercase text-[9px] tracking-wider select-none">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Nom Donneur / Payeur</th>
                    <th className="py-2 px-2">Qualité/Statut</th>
                    <th className="py-2 px-2">Moyen</th>
                    <th className="py-2 px-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOtherRevenues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400 text-[11px] font-medium leading-relaxed">
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
                            {rev.notes && <span className="text-[9px] text-[indigo-600]/70 font-sans tracking-wide leading-none select-none italic block mt-0.5">Note: {rev.notes}</span>}
                          </td>
                          <td className="py-2 px-2 font-medium text-slate-655 font-mono text-[10px]">{statLabel}</td>
                          <td className="py-2 px-2">
                            <span className="text-[9px] font-sans font-extrabold bg-emerald-50 text-emerald-750 px-1.5 py-0.5 rounded uppercase tracking-wider border border-emerald-100/50">
                              {rev.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600">{rev.amount.toLocaleString()} FCFA</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Class level breakdown list */}
        <div className="lg:col-span-5 bg-white border border-slate-150 rounded-2xl p-4 space-y-3.5">
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

      </div>

    </div>
  );
}
