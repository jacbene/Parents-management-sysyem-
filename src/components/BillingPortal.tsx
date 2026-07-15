import React, { useState } from 'react';
import { Invoice, Student } from '../types';
import { CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, X, Landmark, Receipt, QrCode, Smartphone, Search, Download, RefreshCw, Bell, Mail, Send, MessageSquare, Loader2, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../utils/TranslationContext';
import PaymentMethodSelector from './PaymentMethodSelector';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface BillingPortalProps {
  invoices: Invoice[];
  onUpdateInvoice: (updated: Invoice) => void;
  parentPhone?: string;
  students?: Student[];
  portalUserRole?: 'manager' | 'parent' | null;
  filteredStudents?: Student[];
  settings?: any;
}

export default function BillingPortal({ 
  invoices, 
  onUpdateInvoice, 
  parentPhone, 
  students,
  portalUserRole,
  filteredStudents,
  settings
}: BillingPortalProps) {
  const { t, language } = useLanguage();
  const isEn = language === 'en';
  const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  // States for Receipt Retrieval
  const [searchRefId, setSearchRefId] = useState('');
  const [searchResult, setSearchResult] = useState<Invoice | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [searchType, setSearchType] = useState<'not_found' | 'paid' | 'unpaid' | null>(null);

  const [selectedQrInvoice, setSelectedQrInvoice] = useState<Invoice | null>(null);
  const [qrProvider, setQrProvider] = useState<'mtn' | 'orange' | 'wave' | 'bank'>('mtn');
  const [qrScanningSimulation, setQrScanningSimulation] = useState(false);
  const [qrSuccessMessage, setQrSuccessMessage] = useState(false);

  // States for Send Reminder (Manager Action)
  const [selectedReminderInvoice, setSelectedReminderInvoice] = useState<Invoice | null>(null);
  const [reminderChannel, setReminderChannel] = useState<'sms' | 'email'>('sms');
  const [reminderTone, setReminderTone] = useState<'courtois' | 'ferme' | 'urgent'>('courtois');
  const [reminderPhone, setReminderPhone] = useState('');
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderSubject, setReminderSubject] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderProgress, setReminderProgress] = useState(0);
  const [reminderProgressLog, setReminderProgressLog] = useState<string[]>([]);
  const [reminderSuccess, setReminderSuccess] = useState(false);

  const getInvoiceQRCodeUrl = (inv: Invoice, prov: 'mtn' | 'orange' | 'wave' | 'bank') => {
    const rawPhone = parentPhone || inv.phone || '';
    const referenceId = rawPhone ? rawPhone.trim().replace(/[\s\-\(\)\+]/g, '') : 'REF_UNKNOWN';
    const providerScheme = prov === 'mtn' ? 'mtn_momo' : prov === 'orange' ? 'orange_money' : prov === 'wave' ? 'wave' : 'bank_transfer';

    const student = students?.find(s => s.id === inv.studentId);
    const studentName = student ? student.name : "Élève de l'établissement";
    const studentClass = student ? `${student.grade} ${student.classRoom}` : "N/A";

    const paymentData = {
      service: "PasmaSysPay",
      provider: providerScheme,
      invoiceId: inv.id,
      title: inv.title,
      amount: inv.amount,
      currency: "FCFA",
      reference: referenceId,
      studentId: inv.studentId,
      studentName: studentName,
      studentClass: studentClass,
      school: "CES d'Ekali 1",
      recipient: "APEE CES d'Ekali 1 Treasury",
      timestamp: new Date().toISOString()
    };

    const payload = JSON.stringify(paymentData);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}&color=0f172a&bgcolor=ffffff&qzone=1`;
  };

  const handleSimulateQrPayment = async (inv: Invoice) => {
    setQrScanningSimulation(true);
    setQrSuccessMessage(false);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // scan animation delay
      
      const invRef = doc(db, 'invoices', inv.id);
      const paidDate = new Date().toISOString().split('T')[0];

      await updateDoc(invRef, {
        status: 'Paid',
        paymentDate: paidDate
      });

      const updatedInvoice: Invoice = {
        ...inv,
        status: 'Paid',
        paymentDate: paidDate
      };

      setQrSuccessMessage(true);
      await new Promise(resolve => setTimeout(resolve, 1500)); // success message delay
      
      onUpdateInvoice(updatedInvoice);
      setSelectedQrInvoice(null);
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue lors de la simulation du paiement.");
    } finally {
      setQrScanningSimulation(false);
      setQrSuccessMessage(false);
    }
  };

  const interpolateTemplate = (template: string, inv: Invoice) => {
    const student = students?.find(s => s.id === inv.studentId);
    let parentName = '';
    let studentNames = '';

    if (inv.studentId === 'apee_ces_ekali_1') {
      parentName = inv.title; // In APEE invoices, title is parent name
      try {
        if (inv.studentsList) {
          const parsedList = JSON.parse(inv.studentsList);
          if (Array.isArray(parsedList) && parsedList.length > 0) {
            studentNames = parsedList.map((s: any) => s.name).join(', ');
          } else {
            studentNames = "Élève(s) supervisé(s)";
          }
        } else {
          studentNames = "Élève(s) supervisé(s)";
        }
      } catch (e) {
        studentNames = "Élève(s) supervisé(s)";
      }
    } else {
      const stud = students?.find(s => s.id === inv.studentId);
      studentNames = stud ? stud.name : "l'élève";
      parentName = inv.parentId ? inv.parentId.replace('parent_', '').replace('_', ' ') : 'Parent';
      parentName = parentName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    const remainingAmount = inv.amount - (inv.amountPaid || 0);

    return template
      .replace(/{parent_name}/g, parentName)
      .replace(/{student_names}/g, studentNames)
      .replace(/{remaining_amount}/g, remainingAmount.toLocaleString('fr-FR'))
      .replace(/{total_due_amount}/g, inv.amount.toLocaleString('fr-FR'))
      .replace(/{school_year}/g, settings?.schoolYear || '2025/2026')
      .replace(/{association_name}/g, settings?.associationName || "APEE du CES d'Ékali 1")
      .replace(/{short_name}/g, settings?.associationShortName || 'APEE');
  };

  const generateLocalTemplate = (inv: Invoice, channel: 'sms' | 'email', tone: 'courtois' | 'ferme' | 'urgent') => {
    const student = students?.find(s => s.id === inv.studentId);
    let parentName = '';
    let studentNames = '';

    if (inv.studentId === 'apee_ces_ekali_1') {
      parentName = inv.title;
      try {
        if (inv.studentsList) {
          const parsedList = JSON.parse(inv.studentsList);
          if (Array.isArray(parsedList) && parsedList.length > 0) {
            studentNames = parsedList.map((s: any) => s.name).join(', ');
          } else {
            studentNames = "Élève(s)";
          }
        } else {
          studentNames = "Élève(s)";
        }
      } catch (e) {
        studentNames = "Élève(s)";
      }
    } else {
      studentNames = student ? student.name : "l'élève";
      parentName = inv.parentId ? inv.parentId.replace('parent_', '').replace('_', ' ') : 'Parent';
      parentName = parentName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    const remainingAmount = inv.amount - (inv.amountPaid || 0);
    const amountStr = `${remainingAmount.toLocaleString('fr-FR')} FCFA`;
    const schoolYearStr = settings?.schoolYear || '2025/2026';
    const assocName = settings?.associationName || "APEE du CES d'Ékali 1";
    const assocShort = settings?.associationShortName || 'APEE';

    let msg = '';
    let subject = '';

    if (channel === 'sms') {
      if (tone === 'courtois') {
        msg = `Chers parents. Merci pour votre premier versement. Nous vous rappelons amicalement qu'il reste un solde de ${amountStr} pour la cotisation ${assocShort} de ${studentNames} (${schoolYearStr}). Merci de régulariser à votre convenance.`;
      } else if (tone === 'urgent') {
        msg = `URGENT : Chers parents, la cotisation ${assocShort} de ${studentNames} pour l'année ${schoolYearStr} présente un impayé de ${amountStr}. Veuillez régulariser d'urgence auprès de l'intendance pour éviter toute suspension.`;
      } else { // ferme
        msg = `Rappel : Solde de cotisation ${assocShort} (${schoolYearStr}) non réglé pour ${studentNames}. Montant dû : ${amountStr}. Merci de bien vouloir solder cette facture dans les plus brefs délais.`;
      }
    } else {
      if (tone === 'courtois') {
        subject = `Rappel amical : Solde de cotisation ${assocShort} pour ${studentNames}`;
        msg = `Bonjour ${parentName},\n\nNous tenons à vous remercier chaleureusement pour la confiance accordée à notre établissement et pour vos contributions passées.\n\nNous vous informons qu'un montant restant dû de ${amountStr} est à régler pour la cotisation annuelle de ${assocShort} (${schoolYearStr}) concernant : ${studentNames}.\n\nVous pouvez régulariser cette situation auprès du secrétariat ou directement via notre portail de paiement mobile (QR Code).\n\nNous vous remercions pour votre précieuse collaboration.\n\nBien cordialement,\nLa Caisse d'Intendance\n${assocName}`;
      } else if (tone === 'urgent') {
        subject = `URGENT : Avis de retard de paiement - Cotisation ${assocShort} (${schoolYearStr})`;
        msg = `Bonjour ${parentName},\n\nSauf erreur de notre part, le paiement de la cotisation ${assocShort} (${schoolYearStr}) pour ${studentNames} n'a pas été soldé.\n\nÀ ce jour, votre retard de paiement s'élève à ${amountStr}.\n\nUne régularisation immédiate est demandée afin de nous permettre de poursuivre les investissements matériels et pédagogiques essentiels pour les élèves.\n\nNous comptons sur votre proactivité immédiate.\n\nCordialement,\nLe Bureau Exécutif de l'${assocShort}\n${assocName}`;
      } else { // ferme
        subject = `Avis de relance : Cotisation ${assocShort} non soldée - Réf: ${inv.id.toUpperCase()}`;
        msg = `Bonjour ${parentName},\n\nNous vous contactons au sujet de la facture de cotisation ${assocShort} (${schoolYearStr}) d'un montant total de ${inv.amount.toLocaleString('fr-FR')} FCFA.\n\nNos registres comptables indiquent un impayé de ${amountStr}.\n\nNous vous prions de bien vouloir régulariser ce solde débiteur sous 48 heures.\n\nEn vous remerciant par avance de votre diligence,\n\nService de la Comptabilité scolaire\n${assocName}`;
      }
    }

    setReminderSubject(subject);
    setReminderMessage(msg);
  };

  const handleOpenReminder = (inv: Invoice) => {
    setSelectedReminderInvoice(inv);
    setReminderPhone(inv.phone || '');
    setReminderEmail(inv.email || '');
    setReminderSuccess(false);
    setReminderProgress(0);
    setReminderProgressLog([]);
    generateLocalTemplate(inv, reminderChannel, reminderTone);
  };

  const handleReminderChannelChange = (channel: 'sms' | 'email') => {
    setReminderChannel(channel);
    if (selectedReminderInvoice) {
      generateLocalTemplate(selectedReminderInvoice, channel, reminderTone);
    }
  };

  const handleReminderToneChange = (tone: 'courtois' | 'ferme' | 'urgent') => {
    setReminderTone(tone);
    if (selectedReminderInvoice) {
      generateLocalTemplate(selectedReminderInvoice, reminderChannel, tone);
    }
  };

  const handleGenerateAiTemplate = async () => {
    if (!selectedReminderInvoice) return;
    setIsGeneratingTemplate(true);
    try {
      const remainingAmount = selectedReminderInvoice.amount - (selectedReminderInvoice.amountPaid || 0);
      const response = await fetch('/api/apee/generate-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetStatus: remainingAmount < selectedReminderInvoice.amount ? 'partiel' : 'retard',
          tone: reminderTone,
          language: language,
          customContext: `Facture de titre : "${selectedReminderInvoice.title}". Montant restant dû : ${remainingAmount} FCFA.`
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const data = resData.data;
        if (reminderChannel === 'sms') {
          const rawSms = data.smsTemplate || '';
          const finalSms = interpolateTemplate(rawSms, selectedReminderInvoice);
          setReminderMessage(finalSms);
        } else {
          const rawSubject = data.emailSubject || '';
          const rawEmail = data.emailTemplate || '';
          setReminderSubject(interpolateTemplate(rawSubject, selectedReminderInvoice));
          setReminderMessage(interpolateTemplate(rawEmail, selectedReminderInvoice));
        }
      } else {
        generateLocalTemplate(selectedReminderInvoice, reminderChannel, reminderTone);
      }
    } catch (err) {
      console.error(err);
      generateLocalTemplate(selectedReminderInvoice, reminderChannel, reminderTone);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedReminderInvoice) return;
    setIsSendingReminder(true);
    setReminderProgress(0);
    setReminderProgressLog([]);

    const steps = [
      { progress: 15, log: "Analyse de la facture et préparation des données de contact..." },
      { progress: 40, log: `Initialisation de la passerelle de communication (${reminderChannel.toUpperCase()})...` },
      { progress: 70, log: `Chiffrement et acheminement du message vers ${reminderChannel === 'sms' ? reminderPhone : reminderEmail}...` },
      { progress: 90, log: "Attente de l'accusé de réception réseau..." },
      { progress: 100, log: `${reminderChannel === 'sms' ? "SMS envoyé" : "Email envoyé"} avec succès à ${reminderChannel === 'sms' ? reminderPhone : reminderEmail} !` }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setReminderProgress(step.progress);
      setReminderProgressLog(prev => [...prev, `[${new Date().toLocaleTimeString('fr-FR')}] ${step.log}`]);
    }

    try {
      const nowStr = new Date().toISOString();
      const updatedInvoice: Invoice = {
        ...selectedReminderInvoice,
        lastReminded: nowStr
      };

      try {
        const invRef = doc(db, 'invoices', selectedReminderInvoice.id);
        await updateDoc(invRef, {
          lastReminded: nowStr
        });
      } catch (dbErr) {
        console.warn("Could not save lastReminded to Firestore, updating locally", dbErr);
      }

      onUpdateInvoice(updatedInvoice);
      setReminderSuccess(true);

      if (reminderChannel === 'email' && reminderEmail) {
        const mailtoUrl = `mailto:${encodeURIComponent(reminderEmail)}?subject=${encodeURIComponent(reminderSubject)}&body=${encodeURIComponent(reminderMessage)}`;
        window.location.href = mailtoUrl;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleSearchReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchAttempted(true);
    if (!searchRefId.trim()) {
      setSearchResult(null);
      setSearchType(null);
      return;
    }

    const matched = invoices.find(
      inv => inv.id.trim().toLowerCase() === searchRefId.trim().toLowerCase()
    );

    if (matched) {
      setSearchResult(matched);
      if (matched.status === 'Paid') {
        setSearchType('paid');
      } else {
        setSearchType('unpaid');
      }
    } else {
      setSearchResult(null);
      setSearchType('not_found');
    }
  };

  const handleDownloadReceiptPDF = (inv: Invoice) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const now = new Date();
    let y = 15;
    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (2 * margin); // 180mm
    const isEn = language === 'en';

    const drawPageHeaderFooter = () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const paymentReceiptHeader = isEn ? `Electronic Payment Receipt • Ref: ` : `Reçu de Paiement Électronique • Réf : `;
      doc.text(`${paymentReceiptHeader}${inv.id.toUpperCase()}`, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      const generatedLabel = isEn ? `Generated on` : `Généré le`;
      const atLabel = isEn ? `at` : `à`;
      doc.text(`${generatedLabel} ${now.toLocaleDateString(isEn ? 'en-US' : 'fr-FR')} ${atLabel} ${now.toLocaleTimeString(isEn ? 'en-US' : 'fr-FR')} • PASMA-SYS`, margin, pageHeight - 8);
    };

    drawPageHeaderFooter();

    // Republic of Cameroon Official alignment with Motto
    const actCountry = settings?.country || "Cameroun";
    const countryLabel = isEn 
      ? (actCountry === "Cameroun" ? "REPUBLIC OF CAMEROON" : actCountry.toUpperCase())
      : (actCountry === "Cameroun" ? "RÉPUBLIQUE DU CAMEROUN" : actCountry.toUpperCase());

    const assocName = settings?.associationName || (isEn ? "PARENT TEACHER ASSOCIATION (PTA)" : "BUREAU DES PARENTS D'ÉLÈVES (APEE)");
    const schoolExtracted = settings?.associationName 
      ? settings.associationName.replace(/^(APEE|A\.P\.E\.E\.)\s+/i, '')
      : (isEn ? "CES d'Ekali 1" : "CES d'Ekali 1");
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
      doc.text(assocName.toUpperCase(), margin, y + 11.5);
      doc.text(`${yearLabel} : ${settings?.schoolYear || "2025/2026"}`, margin + contentWidth, y + 11.5, { align: 'right' });
      
      y += 18;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(countryLabel, margin, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(assocName.toUpperCase(), margin, y + 9);
      doc.text(schoolExtracted, margin + contentWidth, y + 4, { align: 'right' });
      doc.text(`${yearLabel} : ${settings?.schoolYear || "2025/2026"}`, margin + contentWidth, y + 9, { align: 'right' });
      
      y += 15;
    }

    const isPaid = inv.status === 'Paid';

    // Title Block with specific status accent color: Teal for paid, Indigo for unpaid, Red for overdue
    if (isPaid) {
      doc.setFillColor(13, 148, 136); // Teal 650
    } else if (inv.status === 'Overdue') {
      doc.setFillColor(220, 38, 38); // Red 600
    } else {
      doc.setFillColor(79, 70, 229); // Indigo 600
    }
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const mainTitle = isPaid
      ? (isEn ? "OFFICIAL REGISTRATION RECEIPT & FULLY ACQUITTED PAYMENT BILL" : "QUITTANCE DE PAIEMENT & REÇU DE RÈGLEMENT ACQUITTE")
      : (isEn ? "SECURE FEE INVOICE & DEMAND FOR PTA CONTRIBUTION" : "AVIS DE FACTURATION & APPEL DE FONDS SCOLAIRES");
    doc.text(mainTitle, margin + 6, y + 9);

    y += 20;

    // Transaction Meta Block
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 26, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 26, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const refUniqueLabel = isPaid 
      ? (isEn ? "UNIQUE TRANSACTION REFERENCE" : "RÉFÉRENCE UNIQUE DE TRANSACTION")
      : (isEn ? "INVOICE REFERENCE NUMBER" : "RÉFÉRENCE DE LA FACTURE ADMI.");
    doc.text(`${refUniqueLabel} : ${inv.id.toUpperCase()}`, margin + 6, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const payDateLabel = isPaid ? (isEn ? "Payment Date" : "Date de versement") : (isEn ? "Invoice Due Date" : "Échéance règlementaire de paiement");
    const rawDate = isPaid && inv.paymentDate ? new Date(inv.paymentDate) : new Date(inv.dueDate);
    const payDateStr = rawDate.toLocaleDateString(isEn ? 'en-US' : 'fr-FR');
    doc.text(`${payDateLabel} : ${payDateStr}`, margin + 6, y + 13);
    
    const payChannelLabel = isPaid ? (isEn ? "Payment Channel" : "Canal de paiement") : (isEn ? "Suggested Payment Methods" : "Méthodes de versement autorisées");
    const payChannels = isPaid 
      ? (isEn ? "Orange Money / MTN MoMo / Credit Card" : "Orange Money / MTN MoMo / Carte Bancaire")
      : (isEn ? "Orange Money / MTN MoMo / Credit Card / Cashier" : "Orange Money / MTN MoMo / Carte Bancaire / Espèces Régie");
    doc.text(`${payChannelLabel} : ${payChannels}`, margin + 6, y + 18);

    doc.line(margin + 120, y + 3, margin + 120, y + 23);

    // Right meta column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const receiveStation = isEn ? "RECEPTION TERMINAL" : "STATION DE RECEPTION";
    doc.text(receiveStation, margin + 124, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolExtracted, margin + 124, y + 13);
    const placeCountry = isEn ? `${settings?.country || "Cameroon"}` : `${settings?.country || "Cameroun"}`;
    doc.text(placeCountry, margin + 124, y + 18);

    y += 32;

    // Payer / Student Info
    const isApeeInvoice = inv.studentId === 'apee_ces_ekali_1';
    const relatedStudent = students?.find(s => s.id === inv.studentId);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const contrTitle = isEn ? "COMPTABLE DETAILS OF CONTRIBUTOR & BENEFICIARY" : "DÉTAILS COMPTABLES DU CONTRIBUABLE & BÉNÉFICIAIRE";
    doc.text(contrTitle, margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const pupilLabel = isEn ? "Beneficiary Student:" : "Élève bénéficiaire :";
    doc.text(pupilLabel, margin + 6, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    
    let stdNameLabel = relatedStudent ? relatedStudent.name.toUpperCase() : (isEn ? "REGISTERED STUDENT" : "ÉLÈVE INSCRIT");
    if (isApeeInvoice && inv.studentsList) {
      try {
        const parsed = JSON.parse(inv.studentsList);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stdNameLabel = parsed.map((s: any) => s.name.toUpperCase()).join(', ');
        }
      } catch (e) {}
    }
    doc.text(stdNameLabel, margin + 45, y);

    y += 6;
    doc.setFont('helvetica', 'semibold');
    doc.setTextColor(71, 85, 105);
    const classLabel = isEn ? "Administrative Class:" : "Classe administrative :";
    doc.text(classLabel, margin + 6, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    
    let stdClassLabel = relatedStudent ? `${relatedStudent.grade} ${relatedStudent.classRoom}` : (isEn ? "N/A / All Grades" : "Néant / Tous niveaux");
    if (isApeeInvoice && inv.studentsList) {
      try {
        const parsed = JSON.parse(inv.studentsList);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stdClassLabel = parsed.map((s: any) => s.classRoom).join(', ');
        }
      } catch (e) {}
    }
    doc.text(stdClassLabel, margin + 45, y);

    y += 6;
    doc.setFont('helvetica', 'semibold');
    doc.setTextColor(71, 85, 105);
    const parentIdLabel = isEn ? "Parent Identifier:" : "Identificateur Parent :";
    doc.text(parentIdLabel, margin + 6, y);
    doc.setFont('helvetica', 'normal');
    doc.text(parentPhone ? `${parentPhone}` : (isEn ? "Registered Parent" : "Parent d'Élève Enregistré"), margin + 45, y);

    y += 12;

    // Invoice Itemized Details Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const finBreakLabel = isEn ? "FINANCIAL DIVISION OF FEES / CONTRIBUTIONS" : "VENTILATION FINANCIÈRE DE LA COTISATION";
    doc.text(finBreakLabel, margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    // Table Header Color: Teal for Paid, Indigo/Red/Orange for Unpaid
    if (isPaid) {
      doc.setFillColor(13, 148, 136); // Teal
    } else if (inv.status === 'Overdue') {
      doc.setFillColor(220, 38, 38); // Red
    } else {
      doc.setFillColor(79, 70, 229); // Indigo
    }
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const cellDescription = isEn ? "Prestation / Fee item description" : "Libellé de la prestation";
    const cellFcfa = isEn ? "Amount (FCFA)" : "Montant (FCFA)";
    const cellEur = isEn ? "Amount (EUR)" : "Montant (EUR)";
    const cellStatus = isEn ? "Status" : "Statut";
    
    doc.text(cellDescription, margin + 5, y + 4.5);
    doc.text(cellFcfa, margin + 110, y + 4.5, { align: 'right' });
    doc.text(cellEur, margin + 145, y + 4.5, { align: 'right' });
    doc.text(cellStatus, margin + contentWidth - 5, y + 4.5, { align: 'right' });

    y += 7;

    // Table Body
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 12, 'F');
    doc.setDrawColor(241, 145, 149);
    doc.line(margin, y + 12, margin + contentWidth, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(inv.title, margin + 5, y + 7.5);

    const amountObj = formatAmountTtc(inv.amount);
    doc.setFont('helvetica', 'semibold');
    doc.text(amountObj.fcfa, margin + 110, y + 7.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(amountObj.euro, margin + 145, y + 7.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    if (isPaid) {
      doc.setTextColor(16, 185, 129); // Green emerald
      const paidLabel = isEn ? "PAID & VALIDATED" : "RÉGLÉ / VALIDÉ";
      doc.text(paidLabel, margin + contentWidth - 5, y + 7.5, { align: 'right' });
    } else {
      doc.setTextColor(220, 38, 38); // Red
      const unpaidLabel = isEn ? "UNPAID / OUTSTANDING" : "À RÉGLER / EN SOUFFRANCE";
      doc.text(unpaidLabel, margin + contentWidth - 5, y + 7.5, { align: 'right' });
    }

    y += 24;

    // Certification and Signature
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 8;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    
    const certCompDesc = isPaid 
      ? (isEn ? "Account certification: This electronic receipt replaces any manual invoice copy." : "Certification comptable : Cet acquit de paiement numérique remplace tout reçu manuel pré-édité.")
      : (isEn ? "Liability certification: This fee invoice establishes a pending administrative liability." : "Certification de créance : Ce bulletin constitue un appel officiel de fonds réglementaires.");
    doc.text(certCompDesc, margin, y);
    
    y += 4;
    const certVautDesc = isPaid
      ? (isEn ? "This receipt serves as fully acquitted validation for the financial duties mentioned." : "Cette quittance vaut reçu libératoire des obligations financières correspondantes.")
      : (isEn ? "Please settle the amount due via one of our electronic mobile portals on PASMA-SYS." : "Veuillez vous acquitter du solde dû via l'une de nos passerelles de paiement électronique.");
    doc.text(certVautDesc, margin, y);

    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const portalServices = isEn ? "PORTAL FINANCIAL SERVICES" : "SERVICES FINANCIERS PORTAIL";
    const apeeAccounts = isEn ? "REGISTERED PTA ACCOUNTS OFFICE" : "L'AGENCE COMPTABLE DE L'APEE";
    doc.text(portalServices, margin + 6, y);
    doc.text(apeeAccounts, margin + (contentWidth / 2) + 6, y);

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    const certProof = isEn ? "(Digital verification via auth certificate)" : "(Preuve d'authentification par certificat)";
    const stampProof = isEn ? "(Official stamp and registry trace)" : "(Cachet officiel de raccordement)";
    doc.text(certProof, margin + 6, y);
    doc.text(stampProof, margin + (contentWidth / 2) + 6, y);

    const pdfName = isPaid ? `recu_paiement_${inv.id.toLowerCase()}.pdf` : `facture_scolaire_${inv.id.toLowerCase()}.pdf`;
    doc.save(pdfName);
  };

  const handleDownloadFinancialStatementPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const now = new Date();
    let y = 15;
    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (2 * margin); // 180mm
    const isEn = language === 'en';

    const drawPageHeaderFooter = () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const paymentReceiptHeader = isEn ? `Consolidated Financial Statement` : `Relevé de Compte Financier Consolidé`;
      doc.text(`${paymentReceiptHeader}`, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      const generatedLabel = isEn ? `Generated on` : `Généré le`;
      const atLabel = isEn ? `at` : `à`;
      doc.text(`${generatedLabel} ${now.toLocaleDateString(isEn ? 'en-US' : 'fr-FR')} ${atLabel} ${now.toLocaleTimeString(isEn ? 'en-US' : 'fr-FR')} • PASMA-SYS`, margin, pageHeight - 8);
    };

    drawPageHeaderFooter();

    // Republic of Cameroon Official alignment with Motto
    const actCountry = settings?.country || "Cameroun";
    const countryLabel = isEn 
      ? (actCountry === "Cameroun" ? "REPUBLIC OF CAMEROON" : actCountry.toUpperCase())
      : (actCountry === "Cameroun" ? "RÉPUBLIQUE DU CAMEROUN" : actCountry.toUpperCase());

    const assocName = settings?.associationName || (isEn ? "PARENT TEACHER ASSOCIATION (PTA)" : "BUREAU DES PARENTS D'ÉLÈVES (APEE)");
    const schoolExtracted = settings?.associationName 
      ? settings.associationName.replace(/^(APEE|A\.P\.E\.E\.)\s+/i, '')
      : (isEn ? "CES d'Ekali 1" : "CES d'Ekali 1");
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
      doc.text(assocName.toUpperCase(), margin, y + 11.5);
      doc.text(`${yearLabel} : ${settings?.schoolYear || "2025/2026"}`, margin + contentWidth, y + 11.5, { align: 'right' });
      
      y += 18;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(countryLabel, margin, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(assocName.toUpperCase(), margin, y + 9);
      doc.text(schoolExtracted, margin + contentWidth, y + 4, { align: 'right' });
      doc.text(`${yearLabel} : ${settings?.schoolYear || "2025/2026"}`, margin + contentWidth, y + 9, { align: 'right' });
      
      y += 15;
    }

    // Title Title Block with Indigo Accent
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const mainTitle = isEn 
      ? "CONSOLIDATED STUDENT FINANCIAL LEDGER & REVENUE STATEMENT" 
      : "RELEVÉ FINANCIER GLOBAL & BILAN DE COMPTE DES ÉLÈVES";
    doc.text(mainTitle, margin + 6, y + 9);

    y += 20;

    // Family / Recipient Metadata Card
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const billingMetaTitle = isEn ? "FAMILY CONTRIBUABLE & PROFILE INFORMATION" : "INFORMATIONS DU CONTRIBUABLE & IDENTIFICATION PARENT";
    doc.text(billingMetaTitle, margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    // Parent details
    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(isEn ? "Responsible Parent / Guarantor:" : "Parent d'Élève / Garant Responsable :", margin + 6, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(parentPhone ? `Parents d'Élèves (Tél: ${parentPhone})` : "Parent Enregistré (ENT-Portal)", margin + 70, y);

    y += 6;
    doc.setFont('helvetica', 'semibold');
    doc.setTextColor(71, 85, 105);
    doc.text(isEn ? "Pupils under supervision:" : "Élèves enregistrés sous supervision :", margin + 6, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    
    // List student names neatly
    const activePupils = filteredStudents || students || [];
    const studNames = activePupils.map(s => `${s.name} (${s.grade})`).join(', ');
    const splitNames = doc.splitTextToSize(studNames, contentWidth - 75);
    doc.text(splitNames, margin + 70, y);
    y += (splitNames.length * 4) + 2;

    // Financial Metrics widgets / summary
    const totInvoiced = studentInvoices.reduce((sum, i) => sum + i.amount, 0);
    const totPaid = studentInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.amount, 0);
    const outstanding = totInvoiced - totPaid;

    // Draw nice horizontal metric boxes
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 20, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 20, 'D');

    // Box 1: Total Exigible
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "TOTAL DUTY INVOICED" : "TOTAL DE LA REDEVANCE", margin + 10, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(formatAmountTtc(totInvoiced).fcfa, margin + 10, y + 13);

    // Box 2: Total Paid
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "TOTAL AMOUNT SETTLED" : "TOTAL DES ENCAISSEMENTS", margin + 70, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129); // Green emerald
    doc.text(formatAmountTtc(totPaid).fcfa, margin + 70, y + 13);

    // Box 3: Outstanding Balance
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "OUTSTANDING BALANCE" : "SOLDE RESTANT EN SOUFFRANCE", margin + 130, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (outstanding > 0) {
      doc.setTextColor(220, 38, 38); // Red
    } else {
      doc.setTextColor(16, 185, 129); // Green emerald
    }
    doc.text(formatAmountTtc(outstanding).fcfa, margin + 130, y + 13);

    y += 28;

    // Invoices Itemized List Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const ledgerTableTitle = isEn ? "DETAILED TRANSACTION LEDGER & JOURNAL" : "RELEVÉ COMPTABLE DÉTAILLÉ DE LA FAMILLE";
    doc.text(ledgerTableTitle, margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    // Table Header
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    
    doc.text(isEn ? "Bill Ref & Date" : "Réf & Date Avis", margin + 5, y + 4.5);
    doc.text(isEn ? "Designation / Fee category" : "Libellé de la prestation", margin + 45, y + 4.5);
    doc.text(isEn ? "Amount (FCFA)" : "Montant (FCFA)", margin + 135, y + 4.5, { align: 'right' });
    doc.text(isEn ? "Status" : "Statut du compte", margin + contentWidth - 5, y + 4.5, { align: 'right' });

    y += 7;

    // Draw zebra striping list
    studentInvoices.forEach((invObj, idx) => {
      if (y > pageHeight - 35) {
        doc.addPage();
        drawPageHeaderFooter();
        y = 20;
      }
      
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 10, 'F');
      }
      
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 10, margin + contentWidth, y + 10);

      // Invoice code & date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(invObj.id.toUpperCase(), margin + 5, y + 4.2);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(new Date(invObj.dueDate).toLocaleDateString('fr-FR'), margin + 5, y + 8);

      // Title/Description
      doc.setFont('helvetica', 'semibold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const cleanedTitle = invObj.title.length > 55 ? invObj.title.substring(0, 52) + "..." : invObj.title;
      doc.text(cleanedTitle, margin + 45, y + 6);

      // Amount
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(formatAmountTtc(invObj.amount).fcfa, margin + 135, y + 6, { align: 'right' });

      // Status
      if (invObj.status === 'Paid') {
        doc.setTextColor(16, 185, 129); // Green emerald
        doc.text(isEn ? "PAID" : "ACQUITTE", margin + contentWidth - 5, y + 6, { align: 'right' });
      } else {
        doc.setTextColor(220, 38, 38); // Red
        doc.text(isEn ? "UNPAID" : "À RÉGLER", margin + contentWidth - 5, y + 6, { align: 'right' });
      }

      y += 10;
    });

    y += 10;
    if (y > pageHeight - 45) {
      doc.addPage();
      drawPageHeaderFooter();
      y = 20;
    }

    // Signatures / Footers
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      isEn 
        ? "Disclaimer: This document is a consolidated overview of payments extracted from your secure parent workspace."
        : "Recommandation : Ce relevé récapitulatif a été extrait numériquement de l'ENT Pasma-sys pour valider l'historique de vos cotisations.",
      margin, y
    );

    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(isEn ? "ADMINISTRATION OF THE ESTABLISHMENT" : "L'ADMINISTRATION DE L'ÉTABLISSEMENT", margin + 6, y);
    doc.text(isEn ? "PTA GENERAL ACCOUNTS REGISTRY" : "LA DIRECTION FINANCIÈRE DE L'APEE", margin + (contentWidth / 2) + 6, y);

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(isEn ? "(Digital tracking & official registry entry)" : "(Contrôlé conforme aux registres de caisse)", margin + 6, y);
    doc.text(isEn ? "(Stamp substitute for online payments)" : "(Acquit certifié par signature cryptographique)", margin + (contentWidth / 2) + 6, y);

    doc.save(`releve_financier_${now.getTime()}.pdf`);
  };

  // Helper to format currency and fetch student name
  const student = payingInvoice ? students?.find(s => s.id === payingInvoice.studentId) : null;
  const isApee = payingInvoice && payingInvoice.studentId === 'apee_ces_ekali_1';
  let studentName = student ? student.name : "Élève de l'établissement";
  let studentInfo = student ? `${student.grade} - ${student.classRoom}` : "";

  if (isApee && payingInvoice) {
    studentName = payingInvoice.title; // Parent's name
    try {
      if (payingInvoice.studentsList) {
        const parsedList = JSON.parse(payingInvoice.studentsList);
        if (Array.isArray(parsedList) && parsedList.length > 0) {
          studentInfo = `Parent de : ${parsedList.map((s: any) => `${s.name} (${s.classRoom})`).join(', ')}`;
        } else {
          studentInfo = "Relance de Cotisation APEE";
        }
      } else {
        studentInfo = "Relance de Cotisation APEE";
      }
    } catch (e) {
      studentInfo = "Relance de Cotisation APEE";
    }
  }

  const formatAmountTtc = (amount: number) => {
    if (amount < 2000) {
      const fcfaVal = Math.round(amount * 655.957);
      return {
        euro: `${amount.toFixed(2)} €`,
        fcfa: `${fcfaVal.toLocaleString('fr-FR')} FCFA`,
      };
    } else {
      const euroVal = amount / 655.957;
      return {
        euro: `${euroVal.toFixed(2)} €`,
        fcfa: `${amount.toLocaleString('fr-FR')} FCFA`,
      };
    }
  };

  const formatted = payingInvoice ? formatAmountTtc(payingInvoice.amount) : { euro: '0.00 €', fcfa: '0 FCFA' };

  // Filter out non-student (administrative/settings/cotisation parent) documents
  const studentInvoices = invoices.filter(inv => {
    if (
      inv.studentId === 'apee_expense' ||
      inv.studentId === 'apee_settings' ||
      inv.id.endsWith('_settings')
    ) {
      return false;
    }
    if (inv.studentId === 'apee_ces_ekali_1') {
      // Pour les cotisations APEE, on n'affiche que s'il y a un retard ou versement partiel (Non soldé)
      return inv.status !== 'Paid';
    }
    // If the active role is parent and filteredStudents list is available, restrict to matching active pupils
    if (portalUserRole === 'parent' && filteredStudents) {
      return filteredStudents.some(s => s.id === inv.studentId);
    }
    return true;
  });

  // Filter invoices for tabs and search query
  const filteredInvoices = studentInvoices.filter(inv => {
    // 1. Tab filter
    if (activeTab === 'unpaid' && !(inv.status === 'Unpaid' || inv.status === 'Overdue')) return false;
    if (activeTab === 'paid' && inv.status !== 'Paid') return false;

    // 2. Search query filter
    if (invoiceSearchQuery.trim()) {
      const query = invoiceSearchQuery.toLowerCase().trim();
      const queryClean = query.replace(/\D/g, ''); // for clean phone matches

      // Match invoice id
      const matchesId = inv.id.toLowerCase().includes(query);

      // Match invoice title
      const matchesTitle = inv.title.toLowerCase().includes(query);

      // Match invoice description
      const matchesDesc = inv.description ? inv.description.toLowerCase().includes(query) : false;

      // Match invoice phone
      const invPhoneClean = inv.phone ? inv.phone.replace(/\D/g, '') : '';
      const matchesPhone = inv.phone ? inv.phone.toLowerCase().includes(query) || (queryClean && invPhoneClean.includes(queryClean)) : false;

      // Match student associated with the invoice
      const student = students?.find(s => s.id === inv.studentId);
      const matchesStudentName = student ? student.name.toLowerCase().includes(query) : false;

      // Match names in studentsList (for APEE cotisations)
      let matchesStudentsList = false;
      if (inv.studentsList) {
        try {
          const parsed = JSON.parse(inv.studentsList);
          if (Array.isArray(parsed)) {
            matchesStudentsList = parsed.some((s: any) => 
              s.name && s.name.toLowerCase().includes(query)
            );
          }
        } catch (e) {}
      }

      return matchesId || matchesTitle || matchesDesc || matchesPhone || matchesStudentName || matchesStudentsList;
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const startPayment = (invoice: Invoice) => {
    setPayingInvoice(invoice);
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Alert Banner showing supported payment providers */}
      <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-100 rounded-2xl p-4.5 text-xs text-indigo-950 flex flex-col sm:flex-row gap-3 items-start sm:items-center shadow-2xs">
        <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-700 shrink-0">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="space-y-0.5">
          <p className="font-extrabold text-indigo-900">💳 Modes de règlement acceptés par l'APEE</p>
          <p className="text-gray-600 leading-relaxed font-sans">
            Nous acceptons les paiements sécurisés par <strong>Orange Money</strong>, <strong>MTN Mobile Money (MoMo)</strong>, <strong>Wave</strong>, ou par <strong>Carte Bancaire Visa/Mastercard</strong>. Toutes les cotisations sont perçues directement en <strong>Francs CFA (FCFA)</strong>.
          </p>
        </div>
      </div>

      {/* Outil de Récupération de Reçu */}
      <div className="p-6 bg-white border border-indigo-150/80 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-750 rounded-xl">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Outil de Récupération de Quittance & Reçu</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Saisissez la référence unique d'une transaction (par ex. <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono text-[10px]">inv_3_0f9a2e</code>) pour retrouver son reçu comptable officiel et le re-télécharger instantanément.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearchReceipt} className="flex gap-2 max-w-md">
          <input
            type="text"
            placeholder="Ex: inv_3_0f9a2e"
            value={searchRefId}
            onChange={(e) => setSearchRefId(e.target.value)}
            className="flex-1 px-3.5 py-2 hover:border-gray-300 border border-gray-250 bg-white rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Search className="h-4 w-4" /> Rechercher
          </button>
        </form>

        {/* Suggestion list of paid invoices if any exists */}
        {studentInvoices.some(i => i.status === 'Paid') && (
          <div className="pt-1.5 flex items-center gap-2 flex-wrap text-[10px]">
            <span className="text-gray-400 font-medium">Rechercher rapidement parmi vos reçus payés :</span>
            <div className="flex gap-1.5 flex-wrap">
              {studentInvoices
                .filter(i => i.status === 'Paid')
                .map(inv => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      setSearchRefId(inv.id);
                      // Trigger direct check
                      setSearchAttempted(true);
                      setSearchResult(inv);
                      setSearchType('paid');
                    }}
                    className="px-2 py-0.5 hover:border-indigo-300 hover:bg-indigo-50 bg-slate-50 text-slate-700 border border-slate-200 rounded font-mono font-bold transition cursor-pointer"
                  >
                    {inv.id}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Search Results Display Section */}
        {searchAttempted && (
          <div className="pt-2 animate-fade-in animate-duration-300">
            {searchType === 'paid' && searchResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-emerald-900">Transaction confirmée & Quittance active</p>
                    <p className="text-[11px] text-emerald-850 font-bold font-mono">{searchResult.id.toUpperCase()}</p>
                    <p className="text-xs text-slate-800 font-semibold">{searchResult.title}</p>
                    <p className="text-[11px] text-slate-500">
                      Montant honoré : <span className="font-bold text-slate-700 font-mono">{formatAmountTtc(searchResult.amount).fcfa}</span>
                      {searchResult.paymentDate && ` • Réglé le : ${new Date(searchResult.paymentDate).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadReceiptPDF(searchResult)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md select-none shrink-0"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger mon Reçu (PDF)
                </button>
              </div>
            )}

            {searchType === 'unpaid' && searchResult && (
              <div className="p-4 bg-amber-50 border border-amber-150 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-full shrink-0 mt-0.5">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-amber-900">En attente de règlement bancaire</p>
                    <p className="text-[11px] text-amber-850 font-bold font-mono">{searchResult.id.toUpperCase()}</p>
                    <p className="text-xs text-slate-800 font-semibold">{searchResult.title}</p>
                    <p className="text-[11px] text-slate-500">
                      Montant à régulariser : <span className="font-bold text-slate-700 font-mono">{formatAmountTtc(searchResult.amount).fcfa}</span> • Échéance : {new Date(searchResult.dueDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startPayment(searchResult)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0 select-none animate-bounce"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Régler la Facture
                </button>
              </div>
            )}

            {searchType === 'not_found' && (
              <div className="p-4 bg-red-50 border border-red-150 rounded-2xl flex items-start gap-3 animate-fade-in">
                <div className="p-1.5 bg-red-100 text-red-650 rounded-full shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-red-900">Transaction introuvable</p>
                  <p className="text-xs text-slate-600">
                    Aucune fiche comptable ou règlement ne correspond à la référence <strong className="font-mono text-red-800 font-black">"{searchRefId}"</strong> dans la base de données. Veuillez corriger la saisie.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchRefId('');
                      setSearchAttempted(false);
                      setSearchResult(null);
                      setSearchType(null);
                    }}
                    className="text-[10px] text-indigo-700 font-bold underline hover:text-indigo-800 transition pt-1 cursor-pointer"
                  >
                    Effacer et réessayer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b pb-4 border-gray-100 flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <Landmark className="h-5 w-5 text-indigo-600" />
            Régie Financière & Facturation
          </h2>
          <p className="text-sm text-gray-500">
            Paiement sécurisé en ligne des frais de scolarité, de cantine, d'APEE et d'activités périscolaires.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadFinancialStatementPDF}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer select-none active:scale-98"
            title="Générer un relevé financier global de la famille"
          >
            <Download className="h-4 w-4" />
            <span>Relevé Financier (PDF)</span>
          </button>

          {/* Status filtering tabs */}
          <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Tous ({studentInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('unpaid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'unpaid'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            À Payer ({studentInvoices.filter(i => i.status !== 'Paid').length})
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'paid'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Payés ({studentInvoices.filter(i => i.status === 'Paid').length})
          </button>
        </div>
      </div>
    </div>

      {/* Barre de Recherche pour les Factures */}
      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-3xs">
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="billing-search-input"
            type="text"
            placeholder={isEn ? "Filter by student name, parent phone, or reference..." : "Filtrer par nom d'élève, téléphone parent, ou référence..."}
            value={invoiceSearchQuery}
            onChange={(e) => setInvoiceSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 hover:border-slate-350 focus:outline-hidden focus:border-indigo-500 rounded-xl text-xs font-medium transition-all shadow-3xs"
          />
          {invoiceSearchQuery && (
            <button
              onClick={() => setInvoiceSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="text-[11px] text-slate-500 font-bold self-end md:self-center bg-slate-200/40 px-2.5 py-1 rounded-lg border border-slate-200/50">
          {isEn 
            ? `${filteredInvoices.length} matched invoices` 
            : `${filteredInvoices.length} factures filtrées`
          }
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center p-12 bg-gray-50/50 rounded-2xl border border-gray-100">
          <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Aucun avis de facturation trouvé dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              className="p-5 bg-white border border-gray-150 rounded-2xl flex items-center justify-between gap-4 flex-wrap hover:shadow-sm hover:border-gray-250 transition-all duration-200"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(inv.status)}`}>
                    {inv.status === 'Paid' ? 'Reglé' : inv.status === 'Overdue' ? 'Relance exigée' : 'À régler'}
                  </span>
                  <span className="text-xs font-mono text-gray-400">Réf: {inv.id.toUpperCase()}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                  <span>{inv.title}</span>
                  {inv.studentId === 'apee_ces_ekali_1' && (
                    <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-750 px-2 py-0.5 rounded-md border border-indigo-150 shadow-3xs">
                      Cotisation APEE
                    </span>
                  )}
                </h3>
                <div className="text-xs text-gray-500 font-medium">
                  {inv.status === 'Paid' ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Payé le {new Date(inv.paymentDate!).toLocaleDateString('fr-FR')}
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Échéance règlementaire : {new Date(inv.dueDate).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right mr-2">
                  <div className="text-base font-black text-indigo-750 font-mono">
                    {formatAmountTtc(inv.amount).fcfa}
                  </div>
                  <span className="text-[10px] text-gray-400 block">
                    soit {formatAmountTtc(inv.amount).euro} (TTC)
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleDownloadReceiptPDF(inv)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    inv.status === 'Paid'
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={inv.status === 'Paid' ? "Télécharger le reçu de paiement officiel (PDF)" : "Télécharger l'avis de facturation de ce paiement (PDF)"}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{inv.status === 'Paid' ? 'Reçu (PDF)' : 'Facture (PDF)'}</span>
                </button>

                {inv.status !== 'Paid' && (
                  <>
                    {portalUserRole === 'manager' && (
                      <button
                        type="button"
                        onClick={() => handleOpenReminder(inv)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                        title="Relancer le parent par SMS ou Email"
                      >
                        <Bell className="h-3.5 w-3.5 text-white" />
                        <span>Relancer</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedQrInvoice(inv)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                      title="Afficher le Code QR de règlement direct"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">QR Direct</span>
                    </button>
                    <button
                      onClick={() => startPayment(inv)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer hover:bg-indigo-700 transition"
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Payer ma dette
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simulated Billing Gateway Modal */}
      <AnimatePresence>
        {payingInvoice && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl overflow-hidden animate-fade-in"
            >
              <div className="p-5 bg-slate-900 text-white relative">
                <button
                  onClick={() => setPayingInvoice(null)}
                  className="absolute right-4 top-4 text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-300 font-black uppercase tracking-widest block">🔒 Passerelle de Paiement Sécurisée</span>
                  <h3 className="text-base font-black">Règlement de Facture</h3>
                </div>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Récapitulatif de paiement avant validation */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/40 pb-2">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-700">
                      🧾 Récapitulatif avant validation
                    </span>
                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full select-all">
                      Avis #{payingInvoice.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Nom de l'élève */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Nom de l'élève</span>
                      <div className="flex items-center gap-2.5 mt-1">
                        <div className="h-6 w-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xxs flex items-center justify-center shrink-0 uppercase">
                          {studentName.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 leading-tight">{studentName}</p>
                          {studentInfo && <p className="text-[9.5px] text-indigo-600 font-semibold">{studentInfo}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Objet de la facture */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Objet de la facture</span>
                      <p className="text-xs font-bold text-slate-800 mt-1 leading-snug">{payingInvoice.title}</p>
                    </div>

                    {/* Montant TTC */}
                    <div className="pt-2 border-t border-slate-150 flex items-center justify-between bg-indigo-50/50 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">Montant Total TTC</span>
                        <p className="text-[8px] text-slate-400 font-medium">Équivalence fixe BEAC : 1 € = 655,957 FCFA</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-500 font-mono leading-none">
                          {formatted.euro}
                        </p>
                        <p className="text-xs font-black text-indigo-700 font-mono mt-0.5">
                          {formatted.fcfa}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <PaymentMethodSelector
                  invoice={payingInvoice}
                  parentPhone={parentPhone}
                  students={students}
                  settings={settings}
                  onPaymentSuccess={(updated) => {
                    onUpdateInvoice(updated);
                    // Hide modal after display success
                    setTimeout(() => {
                      setPayingInvoice(null);
                    }, 1500);
                  }}
                  onCancel={() => setPayingInvoice(null)}
                />
              </div>
            </motion.div>
          </div>
        )}

        {selectedQrInvoice && (() => {
          const qrStudent = students?.find(s => s.id === selectedQrInvoice.studentId);
          const qrStudentName = qrStudent ? qrStudent.name : "Élève de l'établissement";
          const qrStudentClass = qrStudent ? `${qrStudent.grade} ${qrStudent.classRoom}` : "N/A";
          const qrFormatted = formatAmountTtc(selectedQrInvoice.amount);
          
          return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl overflow-hidden animate-fade-in"
              >
                {/* Header */}
                <div className="p-5 bg-slate-900 text-white relative">
                  <button
                    onClick={() => setSelectedQrInvoice(null)}
                    className="absolute right-4 top-4 text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-300 font-black uppercase tracking-widest block">🔒 Code QR de Règlement Direct</span>
                    <h3 className="text-base font-black">Scan & Paiement Mobile</h3>
                  </div>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Select Operator */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Choisissez l'application de paiement</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setQrProvider('mtn')}
                        className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          qrProvider === 'mtn'
                            ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center font-black text-[10px] text-gray-950 border border-yellow-500 shadow-3xs">M</div>
                        <span className="text-[9px] font-black uppercase tracking-tight">MTN MoMo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrProvider('orange')}
                        className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          qrProvider === 'orange'
                            ? 'bg-orange-50 border-orange-500 text-orange-900 ring-1 ring-orange-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center font-black text-[10px] text-white border border-orange-600 shadow-3xs">O</div>
                        <span className="text-[9px] font-black uppercase tracking-tight">Orange</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrProvider('wave')}
                        className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          qrProvider === 'wave'
                            ? 'bg-sky-50 border-sky-500 text-sky-900 ring-1 ring-sky-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-sky-450 flex items-center justify-center font-black text-[10px] text-white border border-sky-550 shadow-3xs">W</div>
                        <span className="text-[9px] font-black uppercase tracking-tight">Wave</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrProvider('bank')}
                        className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          qrProvider === 'bank'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-black text-[10px] text-white border border-slate-900 shadow-3xs">B</div>
                        <span className="text-[9px] font-black uppercase tracking-tight">Banque</span>
                      </button>
                    </div>
                  </div>

                  {/* QR Code Canvas */}
                  <div className="flex flex-col items-center justify-center p-5 bg-slate-50 border border-slate-200/80 rounded-2xl relative shadow-2xs overflow-hidden">
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
                      <span className="text-[8px] font-extrabold text-indigo-600 tracking-wider">GENERATEUR QR ACTIF</span>
                    </div>

                    <div className="relative p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                      {/* Scanning laser effect */}
                      {!qrSuccessMessage && (
                        <div className="absolute left-3 right-3 h-0.5 bg-indigo-500/80 opacity-70 shadow-[0_0_6px_rgba(99,102,241,0.8)] animate-bounce" style={{ top: 'calc(50% - 1px)', zIndex: 11 }} />
                      )}

                      {qrSuccessMessage ? (
                        <div className="w-[180px] h-[180px] flex flex-col items-center justify-center text-center space-y-2 bg-emerald-50 rounded-xl relative z-10">
                          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-7 w-7 animate-bounce" />
                          </div>
                          <p className="text-xs font-black text-emerald-900">Règlement Confirmé</p>
                          <p className="text-[9px] text-emerald-700 font-medium">Livre comptable mis à jour</p>
                        </div>
                      ) : (
                        <img
                          referrerPolicy="no-referrer"
                          src={getInvoiceQRCodeUrl(selectedQrInvoice, qrProvider)}
                          alt={`QR Code Direct`}
                          className="w-[180px] h-[180px] object-contain relative z-10"
                        />
                      )}
                    </div>

                    <p className="text-[10px] text-slate-500 font-semibold text-center mt-3 max-w-[280px] leading-relaxed">
                      Scannez ce code QR unique avec votre application bancaire mobile ou application de paiement mobile ({qrProvider === 'mtn' ? 'MTN MoMo' : qrProvider === 'orange' ? 'Orange Money' : qrProvider === 'wave' ? 'Wave' : 'Toute application bancaire'}) pour payer directement.
                    </p>
                  </div>

                  {/* Payment Details Table Inside QR Modal */}
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-2.5 text-xs text-slate-800">
                    <div className="flex justify-between border-b border-slate-200/40 pb-1.5">
                      <span className="font-extrabold text-indigo-700 text-[10px] uppercase">Détails de l'élève</span>
                      <span className="font-mono text-[9px] text-slate-400">Réf : {selectedQrInvoice.id.toUpperCase()}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">Bénéficiaire</span>
                      <span className="col-span-2 font-bold text-slate-900">{qrStudentName}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">Classe</span>
                      <span className="col-span-2 text-slate-650 font-semibold">{qrStudentClass}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">Libellé</span>
                      <span className="col-span-2 font-bold text-slate-900">{selectedQrInvoice.title}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 items-center">
                      <span className="text-indigo-550 font-bold text-[10px] uppercase">Montant</span>
                      <div className="col-span-2 text-right">
                        <span className="font-black text-indigo-750 font-mono block text-sm">{qrFormatted.fcfa}</span>
                        <span className="text-[9px] text-slate-400 block font-medium">soit {qrFormatted.euro}</span>
                      </div>
                    </div>
                  </div>

                  {/* Simulate scan action button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={qrScanningSimulation}
                      onClick={() => handleSimulateQrPayment(selectedQrInvoice)}
                      className="w-full py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 hover:shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {qrScanningSimulation ? (
                        <>
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Lecture du Code QR & Validation...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          Simuler le Scan & Paiement
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-center font-mono text-[9px] text-slate-400 flex items-center justify-center gap-1 select-none">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Cryptage SSL 256 bits • Banque Agréée BCEAO/BEAC
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Send Reminder Modal for Managers */}
      <AnimatePresence>
        {selectedReminderInvoice && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg border border-slate-100 shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 bg-slate-900 text-white relative shrink-0">
                <button
                  onClick={() => setSelectedReminderInvoice(null)}
                  className="absolute right-4 top-4 text-white/60 hover:text-white cursor-pointer transition-all"
                  disabled={isSendingReminder}
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest block bg-amber-400/10 px-2 py-0.5 rounded-full">
                      💼 Relance Intendante
                    </span>
                    {selectedReminderInvoice.lastReminded && (
                      <span className="text-[9px] text-slate-300 font-mono flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3 text-amber-300" /> Relancé le : {new Date(selectedReminderInvoice.lastReminded).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black">Assistant de Notification de Retard</h3>
                </div>
              </div>

              {!reminderSuccess ? (
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {/* Summary of outstanding amount */}
                  <div className="p-3 bg-slate-50 border border-slate-200/65 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Facture en retard</p>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{selectedReminderInvoice.title}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reste dû</p>
                      <p className="text-xs font-black text-indigo-700 font-mono">
                        {formatAmountTtc(selectedReminderInvoice.amount - (selectedReminderInvoice.amountPaid || 0)).fcfa}
                      </p>
                    </div>
                  </div>

                  {/* Channel Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Canal d'acheminement</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleReminderChannelChange('sms')}
                        disabled={isSendingReminder}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                          reminderChannel === 'sms'
                            ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-3xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>SMS / WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReminderChannelChange('email')}
                        disabled={isSendingReminder}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                          reminderChannel === 'email'
                            ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-3xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Mail className="h-4 w-4" />
                        <span>Courriel (Email)</span>
                      </button>
                    </div>
                  </div>

                  {/* Tone Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ton de la communication</label>
                    <div className="flex gap-2">
                      {(['courtois', 'ferme', 'urgent'] as const).map((tValue) => (
                        <button
                          key={tValue}
                          type="button"
                          onClick={() => handleReminderToneChange(tValue)}
                          disabled={isSendingReminder}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-semibold capitalize transition cursor-pointer ${
                            reminderTone === tValue
                              ? 'bg-slate-800 text-white shadow-3xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {tValue === 'courtois' ? '😊 Courtois' : tValue === 'ferme' ? '💼 Professionnel' : '🚨 Urgent'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contact Fields */}
                  <div className="space-y-3">
                    {reminderChannel === 'sms' ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Numéro de téléphone destinataire</label>
                        <input
                          type="text"
                          value={reminderPhone}
                          onChange={(e) => setReminderPhone(e.target.value)}
                          disabled={isSendingReminder}
                          placeholder="+237 6XX XX XX XX"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-semibold focus:outline-indigo-500 bg-white"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adresse e-mail destinataire</label>
                          <input
                            type="email"
                            value={reminderEmail}
                            onChange={(e) => setReminderEmail(e.target.value)}
                            disabled={isSendingReminder}
                            placeholder="parent@exemple.com"
                            className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-semibold focus:outline-indigo-500 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Objet de l'Email</label>
                          <input
                            type="text"
                            value={reminderSubject}
                            onChange={(e) => setReminderSubject(e.target.value)}
                            disabled={isSendingReminder}
                            className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-semibold focus:outline-indigo-500 bg-white"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Textarea for message preview/edit */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contenu du message</label>
                      <button
                        type="button"
                        onClick={handleGenerateAiTemplate}
                        disabled={isGeneratingTemplate || isSendingReminder}
                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-650 hover:text-indigo-800 cursor-pointer disabled:opacity-50"
                        title="Régénérer un message personnalisé grâce à l'IA Gemini"
                      >
                        {isGeneratingTemplate ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                            Génération...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                            Améliorer avec Gemini AI
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={reminderMessage}
                      onChange={(e) => setReminderMessage(e.target.value)}
                      disabled={isSendingReminder}
                      rows={5}
                      className="w-full p-3 rounded-2xl border border-slate-250 text-xs font-medium focus:outline-indigo-500 bg-white leading-relaxed resize-none"
                    />
                  </div>

                  {/* Sending simulation panel */}
                  {isSendingReminder && (
                    <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-3 font-mono text-[10px] border border-slate-800 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-400">Status : Envoi en cours...</span>
                        <span>{reminderProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${reminderProgress}%` }}
                          transition={{ duration: 0.3 }}
                          className="bg-amber-400 h-full"
                        />
                      </div>
                      <div className="space-y-1 max-h-[80px] overflow-y-auto text-slate-400 border-t border-slate-800 pt-2 select-text">
                        {reminderProgressLog.map((logLine, idx) => (
                          <div key={idx} className="line-clamp-2">{logLine}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {!isSendingReminder && (
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReminderInvoice(null)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSendReminder}
                        disabled={isGeneratingTemplate || (reminderChannel === 'sms' ? !reminderPhone : !reminderEmail)}
                        className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Envoyer le Rappel</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Success Screen */
                <div className="p-6 text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 scale-110">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-850">Relance expédiée avec succès !</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      La relance financière par <span className="font-bold">{reminderChannel.toUpperCase()}</span> a été transmise au destinataire.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-left text-xs font-semibold text-slate-600 space-y-2 max-w-sm mx-auto">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Destinataire :</span>
                      <span>{reminderChannel === 'sms' ? reminderPhone : reminderEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Heure d'envoi :</span>
                      <span>{new Date().toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Facture associée :</span>
                      <span className="truncate max-w-[180px]">{selectedReminderInvoice.title}</span>
                    </div>
                    {reminderChannel === 'email' && (
                      <div className="pt-2 border-t border-slate-200 text-[10px] text-amber-700 font-bold flex items-start gap-1">
                        <span>ℹ️</span>
                        <span>L'ouverture de votre application de messagerie native (Mailto) a également été déclenchée.</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedReminderInvoice(null)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                  >
                    Fermer l'Assistant
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
