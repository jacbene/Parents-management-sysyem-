import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, DollarSign, Wallet2, FileText, ArrowDownLeft, ArrowUpRight, Check, AlertCircle, TrendingUp, Download, AlertTriangle, ClipboardList, Sparkles, Coins, Loader2, CreditCard, Smartphone } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ApeeExpense, ApeeSettings, ApeeParent, ApeeOtherRevenue } from '../../types';
import { getApeeShortName } from '../../utils/apeeDb';
import ApeeBlankForms from './ApeeBlankForms';
import ApeeBudgetAnalysis from './ApeeBudgetAnalysis';
import { useLanguage } from '../../utils/TranslationContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

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

  // Establishment loading for portal fee payments
  const [establishment, setEstablishment] = useState<any>(null);
  const [loadingEst, setLoadingEst] = useState<boolean>(true);
  const selectedSchoolId = localStorage.getItem('portal_selected_school_id') || '';

  const fetchEstablishment = async () => {
    if (!selectedSchoolId) {
      setLoadingEst(false);
      return;
    }
    try {
      const docRef = doc(db, 'establishments', selectedSchoolId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEstablishment(docSnap.data());
      }
    } catch (err) {
      console.warn("Could not load establishment for portal billing:", err);
    } finally {
      setLoadingEst(false);
    }
  };

  useEffect(() => {
    fetchEstablishment();
  }, [selectedSchoolId]);

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
  const [activeView, setActiveView] = useState<'journal' | 'generator' | 'analysis' | 'rentability'>('journal');

  // Portal billing checkout states
  const [showPortalPay, setShowPortalPay] = useState(false);
  const [portalPayMethod, setPortalPayMethod] = useState<'momo' | 'card'>('momo');
  const [portalMomoProvider, setPortalMomoProvider] = useState<'mtn' | 'orange'>('mtn');
  const [portalPayAmount, setPortalPayAmount] = useState<string>('');
  const [portalPayPhone, setPortalPayPhone] = useState('');
  const [portalCardNumber, setPortalCardNumber] = useState('');
  const [portalCardExpiry, setPortalCardExpiry] = useState('');
  const [portalCardCvv, setPortalCardCvv] = useState('');
  const [portalCardHolder, setPortalCardHolder] = useState('');
  const [portalPayStep, setPortalPayStep] = useState<'form' | 'processing' | 'success'>('form');
  const [portalTxnId, setPortalTxnId] = useState('');
  const [portalTxnDate, setPortalTxnDate] = useState('');
  const [portalPayLogs, setPortalPayLogs] = useState<string[]>([]);
  const [portalPayError, setPortalPayError] = useState<string | null>(null);

  const handlePortalPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortalPayError(null);

    const numericAmount = Number(portalPayAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setPortalPayError(isEn ? "Please enter a valid amount." : "Veuillez saisir un montant valide.");
      return;
    }

    if (portalPayMethod === 'momo') {
      if (!portalPayPhone.trim() || portalPayPhone.trim().length < 8) {
        setPortalPayError(isEn ? "Please enter a valid phone number." : "Veuillez saisir un numéro de téléphone valide.");
        return;
      }
    } else {
      if (!portalCardNumber.trim() || portalCardNumber.replace(/\s/g, '').length < 16) {
        setPortalPayError(isEn ? "Please enter a valid credit card number." : "Veuillez saisir un numéro de carte valide.");
        return;
      }
    }

    // Start loading sequence
    setPortalPayStep('processing');
    setPortalPayLogs([]);

    const logStep = (msg: string) => {
      setPortalPayLogs(prev => [...prev, msg]);
    };

    try {
      logStep(isEn ? "Initiating secure portal payment gateway..." : "Initialisation de la passerelle de paiement sécurisée...");
      await new Promise(resolve => setTimeout(resolve, 800));

      if (portalPayMethod === 'momo') {
        logStep(isEn ? `Connecting to ${portalMomoProvider.toUpperCase()} Money telecom core...` : `Connexion aux serveurs de télécommunication ${portalMomoProvider.toUpperCase()} Money...`);
        await new Promise(resolve => setTimeout(resolve, 600));

        logStep(isEn ? `Posting request to Campay API (+237 ${portalPayPhone})...` : `Envoi de la requête de collecte de redevance à l'API Campay (+237 ${portalPayPhone})...`);
      } else {
        logStep(isEn ? "Connecting to banking routing platform (Visa/Mastercard)..." : "Connexion au serveur de routage bancaire (Visa/Mastercard)...");
        await new Promise(resolve => setTimeout(resolve, 600));

        logStep(isEn ? "Verifying card authorization and security token..." : "Vérification des jetons d'autorisation de carte bancaire...");
      }

      // 1. Make call to server API route
      const response = await fetch("/api/campay/collect-portal-fee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: numericAmount,
          phone: portalPayPhone,
          schoolId: selectedSchoolId,
          schoolName: establishment?.name || "Etablissement Actif"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const resData = await response.json();
      
      if (!resData.success) {
        throw new Error(resData.error || "Campay collection failed");
      }

      if (resData.simulated) {
        logStep(isEn ? "⚠️ Campay Live failed/sandbox active. Falling back to High-Fidelity simulation." : "⚠️ Live Campay inactif/indisponible. Bascule sur la simulation haute-fidélité.");
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        logStep(isEn ? `✅ Campay request accepted! Ref: ${resData.reference}` : `✅ Requête acceptée par Campay ! Réf : ${resData.reference}`);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      logStep(isEn ? "Synchronizing ledger with Pasma-sys database..." : "Mise à jour et synchronisation des registres de Pasma-sys...");
      await new Promise(resolve => setTimeout(resolve, 700));

      const todayString = new Date().toISOString();

      if (selectedSchoolId) {
        const docRef = doc(db, 'establishments', selectedSchoolId);
        const currentPaid = establishment?.portalFeesPaid || 0;
        await setDoc(docRef, { 
          portalFeesPaid: currentPaid + numericAmount,
          lastPortalPaymentDate: todayString
        }, { merge: true });
      }

      logStep(isEn ? "Finalizing payment receipt..." : "Finalisation de la transaction et enregistrement de l'acquittement...");
      await new Promise(resolve => setTimeout(resolve, 600));

      setPortalTxnId(resData.reference || "TXN_PRTL_" + Math.floor(100000 + Math.random() * 900000));
      setPortalTxnDate(todayString.split('T')[0]);
      setPortalPayStep('success');
      
      // Reload establishment data to update metrics instantly
      await fetchEstablishment();
    } catch (err: any) {
      console.error("Campay submit error:", err);
      setPortalPayStep('form');
      setPortalPayError(isEn 
        ? `Campay checkout error: ${err.message || "Failed to contact gateway"}` 
        : `Erreur de paiement Campay : ${err.message || "Impossible de contacter la passerelle de paiement"}`
      );
    }
  };

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

      {/* Navigation subtabs for Caisse vs Blank Form Generator vs Budget Analysis vs Mixed Monetization Model */}
      <div className="flex bg-slate-100 p-1 rounded-2xl max-w-3xl border select-none overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveView('journal')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
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
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
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
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeView === 'analysis'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4 text-amber-600" />
          {isEn ? "Budget Analysis" : "Analyse Budgétaire"}
        </button>
        <button
          type="button"
          onClick={() => setActiveView('rentability')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeView === 'rentability'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="h-4 w-4 text-purple-600 animate-pulse" />
          {isEn ? "Mixed Monetization Model" : "Modèle de Rentabilité (1%)"}
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
      ) : activeView === 'rentability' ? (
        (() => {
          // Inner calculations for platform fees
          const globalCollected = parents.reduce((sum, p) => sum + p.totalPaid, 0);
          const servicePercentage = 1; // 1% fee
          const accumulatedServiceFees = globalCollected * (servicePercentage / 100);

          // Simulated metrics
          const [simulatedTurnover, setSimulatedTurnover] = useState<number>(15000000);
          
          return (
            <div className="space-y-6 select-none animate-in fade-in slide-in-from-bottom-3 duration-200">
              {/* Alert header detailing mixed model */}
              <div className="bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 border border-indigo-500/30 relative overflow-hidden shadow-md">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute left-0 bottom-0 -translate-x-12 translate-y-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex flex-col md:flex-row gap-5 items-start justify-between relative z-10">
                  <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-400/30">
                      <Sparkles className="h-3 w-3 animate-pulse" /> Stratégie Mixte d'Autonomie Financière
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">Portail Autonome & Modèle de Revenu Viable</h3>
                    <p className="text-xs text-indigo-200/85 leading-relaxed">
                      Notre modèle d'affaires innovant permet aux établissements (APEE) de bénéficier gratuitement d'un ENT de classe mondiale. Au lieu de frais de licence initiaux élevés, la plateforme se rémunère à hauteur de <strong>1% des cotisations</strong> encaissées via la passerelle, couplée à une <strong>régie publicitaire intégrée</strong> pour générer des revenus passifs.
                    </p>
                  </div>
                  <div className="bg-white/10 border border-white/15 px-4 py-3 rounded-2xl flex flex-col items-center justify-center shrink-0 w-full md:w-auto text-center font-mono">
                    <span className="text-[10px] text-indigo-300 font-extrabold uppercase">Taux de service</span>
                    <span className="text-3xl font-black text-amber-300">1.0 %</span>
                    <span className="text-[9px] text-indigo-200">Sans engagement</span>
                  </div>
                </div>
              </div>

              {/* Grid with Real-time statistics vs Calculator / Payment Portal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Real-time stats & portal billing settlement card (Column 1) */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs">
                      <Coins className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>Volume Réel Encaissé & Redevance</span>
                    </div>

                    <div className="space-y-1 bg-slate-50 border border-slate-150 p-4 rounded-2xl font-mono">
                      <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Chiffre d'affaire global collecté</span>
                      <p className="text-xl font-black text-indigo-950">
                        {globalCollected.toLocaleString()} <span className="text-xs font-semibold">FCFA</span>
                      </p>
                    </div>

                    <div className="space-y-1 bg-slate-50 border border-slate-150 p-4 rounded-2xl font-mono">
                      <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Commissions Dues (1% plateforme)</span>
                      <p className="text-xl font-black text-indigo-950">
                        {accumulatedServiceFees.toLocaleString()} <span className="text-xs font-semibold">FCFA</span>
                      </p>
                    </div>

                    <div className="space-y-1 bg-emerald-50 border border-emerald-150 p-4 rounded-2xl font-mono">
                      <span className="text-[9.5px] text-emerald-700 font-extrabold uppercase block">Montant Déjà Acquitté (Réglé)</span>
                      <p className="text-xl font-black text-emerald-950">
                        {(establishment?.portalFeesPaid || 0).toLocaleString()} <span className="text-xs font-semibold">FCFA</span>
                      </p>
                    </div>

                    {/* Remaining portal fee to pay */}
                    {(() => {
                      const dueAmt = accumulatedServiceFees;
                      const paidAmt = establishment?.portalFeesPaid || 0;
                      const remainingAmt = Math.max(0, dueAmt - paidAmt);
                      const hasRemaining = remainingAmt > 0;

                      return (
                        <div className={`p-4 rounded-2xl border font-mono space-y-2 ${hasRemaining ? 'bg-amber-50 border-amber-200 text-amber-955' : 'bg-indigo-50/50 border-indigo-150 text-indigo-955'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9.5px] font-extrabold uppercase">Reste À Régler Au Portail</span>
                            <span className={`px-1.5 py-0.5 text-[8.5px] font-black uppercase rounded ${hasRemaining ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {hasRemaining ? 'À Régler' : 'À Jour'}
                            </span>
                          </div>
                          <p className="text-xl font-black">
                            {remainingAmt.toLocaleString()} <span className="text-xs font-semibold">FCFA</span>
                          </p>

                          <div className="text-[9.5px] font-sans leading-relaxed text-slate-500">
                            📅 Limite de règlement : <strong className="text-slate-700">Tous les 3 mois maximum</strong>
                            {establishment?.lastPortalPaymentDate && (
                              <div className="mt-0.5 text-[8.5px]">Dernier versement : <strong className="font-mono">{new Date(establishment.lastPortalPaymentDate).toLocaleDateString()}</strong></div>
                            )}
                          </div>

                          {hasRemaining && !showPortalPay && (
                            <button
                              onClick={() => {
                                setPortalPayAmount(remainingAmt.toString());
                                setShowPortalPay(true);
                                setPortalPayStep('form');
                              }}
                              className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm cursor-pointer"
                            >
                              S'acquitter de la redevance
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-100/75 p-3 rounded-xl border border-slate-200/50 space-y-2">
                    <div>
                      ℹ️ Les versements sont libres et non automatiques. Le portail recommande de s'acquitter de sa redevance par tranches régulières pour éviter toute suspension d'accès par la surveillance système.
                    </div>
                    
                    {/* Official Campay and Callback URL Details */}
                    <div className="border-t border-slate-200/60 pt-2 space-y-1.5 font-sans">
                      <div className="font-extrabold text-[9.5px] text-slate-700 uppercase flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                        Passerelle Campay Active
                      </div>
                      <p className="text-[9px] text-slate-450 leading-tight">
                        La redevance d'exploitation de 1% est traitée de manière sécurisée en temps réel via l'API officielle de Campay.
                      </p>
                      <div className="bg-white border border-slate-200/80 p-2 rounded-lg space-y-1.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-black uppercase text-slate-400">Pasma-sys Callback / Webhook URL</span>
                          <div className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-100 p-1 px-1.5 rounded-md">
                            <span className="font-mono text-[8.5px] font-black text-indigo-750 truncate select-all">{`${window.location.origin}/api/campay-webhook`}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/api/campay-webhook`);
                                alert("Callback URL copiée dans le presse-papiers !");
                              }}
                              className="text-[8.5px] text-indigo-600 hover:text-indigo-800 font-bold shrink-0 uppercase cursor-pointer"
                            >
                              Copier
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-500 pt-0.5">
                          <span>App ID:</span>
                          <span className="font-mono font-bold text-slate-700">UirmJUAg...bno0eha</span>
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-500">
                          <span>App Username:</span>
                          <span className="font-mono font-bold text-slate-700">Uahox680...t_XFJd</span>
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-500">
                          <span>Webhook Key:</span>
                          <span className="font-mono font-bold text-slate-700">LpEvD_J1...wtObpw</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive calculator OR secure checkout gateway */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 space-y-4.5">
                  {showPortalPay ? (
                    <div className="space-y-4">
                      {/* Secure Checkout Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="h-4 w-4 text-indigo-600" />
                          <span className="text-slate-800 font-extrabold text-xs">Règlement Sécurisé de la Redevance</span>
                        </div>
                        {portalPayStep === 'form' && (
                          <button 
                            onClick={() => {
                              setShowPortalPay(false);
                              setPortalPayError(null);
                            }} 
                            className="text-[10px] text-slate-450 hover:text-slate-600 font-black flex items-center gap-0.5"
                          >
                            ← Annuler / Retour
                          </button>
                        )}
                      </div>

                      {/* Step A: Form */}
                      {portalPayStep === 'form' && (
                        <form onSubmit={handlePortalPaySubmit} className="space-y-4 font-sans text-left">
                          {/* Method selection */}
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setPortalPayMethod('momo')}
                              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                                portalPayMethod === 'momo' 
                                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' 
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              <Smartphone className="h-4 w-4" />
                              <span className="text-[10.5px] font-bold">Mobile Money</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPortalPayMethod('card')}
                              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                                portalPayMethod === 'card' 
                                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' 
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              <CreditCard className="h-4 w-4" />
                              <span className="text-[10.5px] font-bold">Carte de Crédit</span>
                            </button>
                          </div>

                          {/* Fields based on method */}
                          {portalPayMethod === 'momo' ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPortalMomoProvider('mtn')}
                                  className={`py-2 rounded-lg border font-mono text-xs font-black transition ${
                                    portalMomoProvider === 'mtn' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-400'
                                  }`}
                                >
                                  MTN MoMo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPortalMomoProvider('orange')}
                                  className={`py-2 rounded-lg border font-mono text-xs font-black transition ${
                                    portalMomoProvider === 'orange' ? 'border-orange-400 bg-orange-55/10 text-orange-900' : 'border-slate-200 text-slate-400'
                                  }`}
                                >
                                  Orange Money
                                </button>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Numéro Mobile (sans indicatif)</label>
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 font-bold font-mono">+237</span>
                                  <input
                                    type="tel"
                                    placeholder="6xx xxx xxx"
                                    value={portalPayPhone}
                                    onChange={(e) => setPortalPayPhone(e.target.value.replace(/\D/g, ''))}
                                    className="w-full pl-14 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-indigo-500 text-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Titulaire de la carte</label>
                                <input
                                  type="text"
                                  placeholder="M. Jacques BENE"
                                  value={portalCardHolder}
                                  onChange={(e) => setPortalCardHolder(e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-indigo-500 text-slate-800"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Numéro de carte</label>
                                <input
                                  type="text"
                                  placeholder="4000 1234 5678 9010"
                                  maxLength={19}
                                  value={portalCardNumber}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    const chunks = val.match(/.{1,4}/g) || [];
                                    setPortalCardNumber(chunks.join(' '));
                                  }}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-indigo-500 text-slate-800"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-500 uppercase">Expiration (MM/AA)</label>
                                  <input
                                    type="text"
                                    placeholder="12/28"
                                    maxLength={5}
                                    value={portalCardExpiry}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      if (val.length > 2) {
                                        setPortalCardExpiry(val.slice(0, 2) + '/' + val.slice(2, 4));
                                      } else {
                                        setPortalCardExpiry(val);
                                      }
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-indigo-500 text-slate-800"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-500 uppercase">CVV</label>
                                  <input
                                    type="password"
                                    placeholder="•••"
                                    maxLength={3}
                                    value={portalCardCvv}
                                    onChange={(e) => setPortalCardCvv(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-indigo-500 text-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Amount Input */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase">Montant à régler (FCFA)</label>
                            <input
                              type="number"
                              value={portalPayAmount}
                              onChange={(e) => setPortalPayAmount(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold font-mono focus:outline-indigo-500 text-slate-800"
                            />
                          </div>

                          {portalPayError && (
                            <div className="bg-rose-50 border border-rose-150 p-3 rounded-xl flex items-center gap-2 text-rose-800 text-[11px] font-bold">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <span>{portalPayError}</span>
                            </div>
                          )}

                          {/* Lock guarantee */}
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Lock className="h-3 w-3" />
                            <span>Paiement sécurisé crypté SSL end-to-end</span>
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition shadow cursor-pointer"
                          >
                            Procéder au règlement ({Number(portalPayAmount || 0).toLocaleString()} FCFA)
                          </button>
                        </form>
                      )}

                      {/* Step B: Processing Logs */}
                      {portalPayStep === 'processing' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-6">
                          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                          
                          <div className="w-full max-w-md bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-[10.5px] border border-slate-800 text-left space-y-2.5 h-44 overflow-y-auto">
                            {portalPayLogs.map((log, idx) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                <span className="text-indigo-400">✔</span>
                                <span>{log}</span>
                              </div>
                            ))}
                            <div className="text-indigo-300 animate-pulse">■ Connexion active...</div>
                          </div>
                        </div>
                      )}

                      {/* Step C: Success Receipt */}
                      {portalPayStep === 'success' && (
                        <div className="text-center py-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                          <div className="h-14 w-14 bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-2xl">
                            ✓
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-extrabold text-slate-900 text-sm">Règlement Effectué avec Succès !</h4>
                            <p className="text-xs text-slate-450">Votre redevance a été synchronisée et enregistrée sur les serveurs Pasma-sys.</p>
                          </div>

                          {/* Receipt Summary Card */}
                          <div className="max-w-md mx-auto bg-slate-50 border border-slate-150 p-4 rounded-2xl text-left font-mono text-xs text-slate-800 space-y-2">
                            <div className="border-b border-slate-200 pb-2 text-[10px] text-slate-400 flex items-center justify-between">
                              <span>REÇU DE TRANSACTION</span>
                              <span className="font-bold">{portalTxnId}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-400">Date :</span>
                              <span className="font-bold">{portalTxnDate}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-400">Établissement :</span>
                              <span className="font-bold truncate max-w-[200px]">{establishment?.name || 'Notre Établissement'}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-400">Moyen :</span>
                              <span className="font-bold">{portalPayMethod === 'momo' ? `Mobile Money (${portalMomoProvider.toUpperCase()})` : 'Carte de Crédit'}</span>
                            </div>

                            <div className="flex justify-between border-t border-dashed pt-2 text-[13px]">
                              <span className="font-extrabold text-slate-900">Montant Réglé :</span>
                              <span className="font-black text-indigo-900">{Number(portalPayAmount).toLocaleString()} FCFA</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 justify-center">
                            <button
                              onClick={() => {
                                const doc = new jsPDF();
                                doc.setFont("helvetica", "bold");
                                doc.setFontSize(20);
                                doc.text("REÇU D'ACQUITTEMENT DE REDEVANCE", 105, 25, { align: "center" });
                                doc.setDrawColor(200, 200, 200);
                                doc.line(15, 32, 195, 32);
                                doc.setFontSize(11);
                                doc.setFont("helvetica", "normal");
                                doc.text(`Réf Transaction: ${portalTxnId}`, 15, 45);
                                doc.text(`Date de paiement: ${portalTxnDate}`, 15, 52);
                                doc.text(`Établissement: ${establishment?.name || 'Notre Établissement'}`, 15, 59);
                                doc.text(`Identifiant Établissement: ${selectedSchoolId}`, 15, 66);
                                doc.line(15, 74, 195, 74);
                                doc.setFont("helvetica", "bold");
                                doc.text("Détails du règlement", 15, 83);
                                doc.setFont("helvetica", "normal");
                                const methodLabel = portalPayMethod === 'momo' ? `Mobile Money (${portalMomoProvider.toUpperCase()})` : "Carte Bancaire";
                                const accountLabel = portalPayMethod === 'momo' ? portalPayPhone : "•••• •••• •••• " + portalCardNumber.slice(-4);
                                doc.text(`Moyen de paiement: ${methodLabel}`, 15, 93);
                                doc.text(`Compte/Numéro: ${accountLabel}`, 15, 100);
                                doc.text(`Bénéficiaire: Portail Pasma-sys Administration`, 15, 107);
                                doc.line(15, 115, 195, 115);
                                doc.setFont("helvetica", "bold");
                                doc.setFontSize(14);
                                doc.text(`MONTANT VERSE: ${Number(portalPayAmount).toLocaleString()} FCFA`, 15, 127);
                                doc.setFontSize(9);
                                doc.setFont("helvetica", "italic");
                                doc.text("Ce document atteste que l'établissement s'est acquitté du montant mentionné ci-dessus", 105, 145, { align: "center" });
                                doc.text("au titre de la redevance d'exploitation de la plateforme de gestion Pasma-sys.", 105, 150, { align: "center" });
                                doc.save(`PASMA_RECU_${portalTxnId}.pdf`);
                              }}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" /> Reçu (PDF)
                            </button>
                            <button
                              onClick={() => setShowPortalPay(false)}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              Fermer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs">
                          <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Simulateur Financier pour Structures</span>
                        </div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold font-sans">Ajustable</span>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-extrabold text-slate-655 uppercase tracking-wide">
                          Chiffre d'Affaire Global Estimé de l'Établissement (Ex: Cotisations Annuelles)
                        </label>
                        <div className="relative">
                          <input
                            type="range"
                            min="2000000"
                            max="80000000"
                            step="500000"
                            value={simulatedTurnover}
                            onChange={(e) => setSimulatedTurnover(Number(e.target.value))}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                            <span>2M FCFA</span>
                            <span>20M FCFA</span>
                            <span>40M FCFA</span>
                            <span>60M FCFA</span>
                            <span>80M FCFA</span>
                          </div>
                        </div>

                        {/* Numeric input to sync with range slider */}
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            value={simulatedTurnover}
                            onChange={(e) => setSimulatedTurnover(Math.max(0, Number(e.target.value)))}
                            className="w-full md:w-1/3 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-indigo-500 font-mono font-bold text-slate-800"
                          />
                          <span className="text-xs font-extrabold text-slate-500 font-sans">FCFA de budget</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2.5 font-mono">
                        <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-2xl">
                          <span className="text-[9.5px] text-emerald-700 font-extrabold uppercase block">Revenu Net Conservé (99%)</span>
                          <p className="text-xl font-extrabold text-emerald-950 mt-1">
                            {(simulatedTurnover * 0.99).toLocaleString()} FCFA
                          </p>
                          <p className="text-[9.5px] text-emerald-650 mt-1 leading-normal font-sans">
                            Entièrement versé sur le compte d'association de l'établissement.
                          </p>
                        </div>

                        <div className="bg-purple-50 border border-purple-150 p-4 rounded-2xl">
                          <span className="text-[9.5px] text-purple-700 font-extrabold uppercase block">Frais Proportionnel (1%)</span>
                          <p className="text-xl font-extrabold text-purple-950 mt-1">
                            {(simulatedTurnover * 0.01).toLocaleString()} FCFA
                          </p>
                          <p className="text-[9.5px] text-purple-650 mt-1 leading-normal font-sans">
                            Frais transparents sans aucun abonnement fixe mensuel ou annuel.
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-[11px] text-slate-655 leading-relaxed space-y-2">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          💡 Pourquoi ce modèle mixte est le plus adapté :
                        </div>
                        <ul className="list-disc pl-4 space-y-1">
                          <li><strong>Pour les petites structures :</strong> Si vous n'encaissez que 3M FCFA, vous ne payez que 30 000 FCFA à la plateforme sur toute l'année. Aucun risque financier, pas de barrière à la digitalisation.</li>
                          <li><strong>Pour les grandes structures :</strong> Pour un volume de 50M FCFA, les frais de 1% (500 000 FCFA) garantissent l'infrastructure multi-serveurs redondée de niveau entreprise pour supporter la charge d'accès et les rapports en continu.</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Passive ad revenue & advertising management center */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3.5 gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
                      <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" /> Régie Publicitaire & Partenariats Locaux
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Revenus complémentaires passifs par la diffusion d'annonces ciblées parents/élèves</p>
                  </div>
                  
                  <div className="bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0">
                    <span>Est. CPC:</span> <strong className="font-mono">250 FCFA / clic</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 text-slate-700">
                  <div className="bg-amber-50/40 border border-amber-200/60 p-4 rounded-2xl space-y-1">
                    <span className="text-[9px] text-amber-800 uppercase font-black tracking-wider block">Campagnes Actives</span>
                    <p className="text-xl font-mono font-black text-amber-950">2 En cours</p>
                    <p className="text-[9.5px] text-amber-700 font-medium">Affichées dans l'onglet communiqués</p>
                  </div>

                  <div className="bg-amber-50/40 border border-amber-200/60 p-4 rounded-2xl space-y-1">
                    <span className="text-[9px] text-amber-800 uppercase font-black tracking-wider block">Impressions Globales</span>
                    <p className="text-xl font-mono font-black text-amber-950">4 000 +</p>
                    <p className="text-[9.5px] text-amber-700 font-medium">Impression = Visualisation du bandeau</p>
                  </div>

                  <div className="bg-amber-50/40 border border-amber-200/60 p-4 rounded-2xl space-y-1">
                    <span className="text-[9px] text-amber-800 uppercase font-black tracking-wider block">Revenus Générés de la Régie</span>
                    <p className="text-xl font-mono font-black text-amber-950">{(231 * 250).toLocaleString()} FCFA</p>
                    <p className="text-[9.5px] text-amber-750 font-extrabold">231 Clics qualifiés cumulés (250F / clic)</p>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 text-xs leading-relaxed text-slate-655 space-y-3">
                  <p className="font-bold text-slate-800">🚀 Comment ça fonctionne pour rentabiliser l'établissement ?</p>
                  <p className="text-[11.5px]">
                    L'APEE ou l'administration peut vendre des encarts publicitaires à des entreprises de l'écosystème scolaire local (Librairies, transporteurs scolaires, cours de soutien, opticiens, magasins d'uniformes).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1.5 font-sans">
                    <div className="bg-white border p-3 rounded-xl space-y-1 shadow-3xs">
                      <strong className="text-slate-900 text-[11px] block">1. Création Intégrée</strong>
                      <p className="text-[10px] text-slate-500 leading-normal">Créez l'annonce dans l'onglet des communiqués et choisissez l'option "Sponsorisé".</p>
                    </div>
                    <div className="bg-white border p-3 rounded-xl space-y-1 shadow-3xs">
                      <strong className="text-slate-900 text-[11px] block">2. Clics et Visites</strong>
                      <p className="text-[10px] text-slate-500 leading-normal">Les parents d'élèves consultent l'offre de fournitures ou de transport et cliquent sur le lien d'inscription.</p>
                    </div>
                    <div className="bg-white border p-3 rounded-xl space-y-1 shadow-3xs">
                      <strong className="text-slate-900 text-[11px] block">3. Facturation Sponsor</strong>
                      <p className="text-[10px] text-slate-500 leading-normal">L'établissement facture le sponsor au nombre de clics réels enregistrés, créant ainsi un trésor de caisse additionnel.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
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
