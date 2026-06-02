import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, CheckCircle, Smartphone, Tag, User, Hash, MapPin, Notebook, DollarSign, Calendar, Mail, X, Download } from 'lucide-react';
import { ApeeParent, ApeeStudentLink, ApeePaymentItem, ApeeSettings, ApeeOtherRevenue } from '../../types';
import { getApeeShortName, calculateParentDebtBreakdown } from '../../utils/apeeDb';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';

interface ApeeFormProps {
  settings: ApeeSettings;
  onSaveParent: (parent: ApeeParent) => Promise<boolean>;
  activeParentToEdit?: ApeeParent | null;
  onCancelEdit?: () => void;
  onSaveOtherRevenue: (revenue: ApeeOtherRevenue) => Promise<boolean>;
}

export default function ApeeForm({ settings, onSaveParent, activeParentToEdit, onCancelEdit, onSaveOtherRevenue }: ApeeFormProps) {
  // Get dynamic classrooms configured in settings or fall back to standard high-school levels
  const configuredClassrooms = settings?.classTeachers && settings.classTeachers.length > 0
    ? settings.classTeachers.map(tc => tc.classRoom)
    : [
        '6ème',
        '5ème',
        '4ème ALL',
        '4ème ESP',
        '3ème ALL',
        '3ème ESP',
        '2nde',
        '1ère',
        'Tle',
        'CM2-A',
        'CE2-B',
        'CM1-A',
      ];
  const defaultClassroom = configuredClassrooms[0] || '6ème';

  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentAddress, setParentAddress] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [students, setStudents] = useState<ApeeStudentLink[]>([{ name: '', classRoom: defaultClassroom, dateOperation: new Date().toISOString().slice(0, 10) }]);
  const [showPrintToast, setShowPrintToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [note, setNote] = useState('');
  
  // Payment states
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('Espèces');
  const [paymentNote, setPaymentNote] = useState('');
  const [payments, setPayments] = useState<ApeePaymentItem[]>([]);
  const [transactionId, setTransactionId] = useState('');
  const [provider, setProvider] = useState('MTN');
  
  // Alert visual confirmations
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [smsMockMsg, setSmsMockMsg] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isSavedJustNow, setIsSavedJustNow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Other revenues states
  const [formMode, setFormMode] = useState<'parent' | 'other_revenue'>('parent');
  const [otherPayerName, setOtherPayerName] = useState('');
  const [otherStatus, setOtherStatus] = useState<'membre_honneur' | 'institution' | 'autre'>('membre_honneur');
  const [otherStatusDetails, setOtherStatusDetails] = useState('');
  const [otherAmount, setOtherAmount] = useState<number>(0);
  const [otherPaymentMethod, setOtherPaymentMethod] = useState('Espèces');
  const [otherTransactionId, setOtherTransactionId] = useState('');
  const [otherDate, setOtherDate] = useState(new Date().toISOString().slice(0, 10));
  const [otherNotes, setOtherNotes] = useState('');

  const clearOtherForm = () => {
    setOtherPayerName('');
    setOtherStatus('membre_honneur');
    setOtherStatusDetails('');
    setOtherAmount(0);
    setOtherPaymentMethod('Espèces');
    setOtherTransactionId('');
    setOtherDate(new Date().toISOString().slice(0, 10));
    setOtherNotes('');
  };

  const handleDownloadOtherRevenueReceiptPDF = (revenueToPrint: ApeeOtherRevenue) => {
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

    const drawPageHeaderFooter = () => {
      // Header line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      // Header text
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Reçu ${getApeeShortName(settings)} • Autres Recettes • Année : ${settings.schoolYear || ""}`, margin, 9);
      
      // Footer line
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      
      // Footer text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Édité par PASMA-ENT ANALYTICS (Génération de pièces comptables)`, margin, pageHeight - 8);
      doc.text(`Reçu Officiel Autre Recette`, margin + contentWidth - 40, pageHeight - 8);
    };

    drawPageHeaderFooter();

    // Top Cameroonian Official Ribbon
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text("RÉPUBLIQUE DU CAMEROUN", margin, y + 4);
    doc.text("REPUBLIC OF CAMEROON", margin + contentWidth, y + 4, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Paix - Travail - Patrie", margin, y + 8);
    doc.text("Peace - Work - Fatherland", margin + contentWidth, y + 8, { align: 'right' });

    y += 15;

    // Left accent bar (Green for Other Receipts)
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(margin, y, 4, 18, 'F');

    // Brand and Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 124, 65); // Emerald hex
    doc.text(`${(settings.associationName || "APEE CES EKALI 1").toUpperCase()}`, margin + 6, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("REÇU OFFICIEL DE CO-OPÉRATION ET AUTRES RECETTES", margin + 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Année Scolaire : ${settings.schoolYear || "N/A"} • Saisi le : ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`, margin + 6, y + 17);

    y += 24;

    // Summary Card Box style (Green layout)
    doc.setFillColor(240, 253, 250); // Emerald 50
    doc.setDrawColor(209, 250, 229); // Emerald 200
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(5, 150, 105); // Emerald-600
    doc.text("MONTANT DÉPOSÉ (RÉGIE)", margin + 6, y + 7);
    doc.text("CATÉGORIE PAYEUR", margin + 75, y + 7);
    doc.text("DATE DE L'OPÉRATION", margin + 135, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Black
    doc.text(`${revenueToPrint.amount.toLocaleString()} ${currency}`, margin + 6, y + 15);

    let catLabel = "Autre Tiers / Donateur";
    if (revenueToPrint.status === 'membre_honneur') catLabel = "Membre d'Honneur";
    else if (revenueToPrint.status === 'institution') catLabel = `${revenueToPrint.statusDetails || 'Institution'}`;

    doc.setTextColor(16, 124, 65);
    doc.text(catLabel, margin + 75, y + 15);

    doc.setTextColor(15, 23, 42);
    doc.text(new Date(revenueToPrint.date).toLocaleDateString('fr-FR', { dateStyle: 'medium' }), margin + 135, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Pris en compte comptable`, margin + 6, y + 20);
    doc.text(`Mode de paiement: ${revenueToPrint.paymentMethod}`, margin + 75, y + 20);
    doc.text(`Enregistré par régie de ${getApeeShortName(settings)}`, margin + 135, y + 20);

    y += 32;

    // Payer details section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("COORDONNÉES DU DÉPOSANT / PAYEUR", margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.setFont('helvetica', 'bold');
    doc.text("Nom / Raison Sociale :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(revenueToPrint.payerName || 'Non désigné', margin + 45, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text("Statut du Tiers :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(revenueToPrint.status === 'membre_honneur' ? "Membre d'Honneur (Mécène)" : revenueToPrint.status === 'institution' ? "Institution publique / privée" : "Autre donateur tiers", margin + 45, y);
    y += 6;

    if (revenueToPrint.statusDetails) {
      doc.setFont('helvetica', 'bold');
      doc.text("Précisions :", margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(revenueToPrint.statusDetails, margin + 45, y);
      y += 6;
    }

    if (revenueToPrint.transactionId) {
      doc.setFont('helvetica', 'bold');
      doc.text("Réf. Transaction / Pièce :", margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(revenueToPrint.transactionId, margin + 45, y);
      y += 6;
    }

    if (revenueToPrint.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text("Observations / Objet :", margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(revenueToPrint.notes, margin + 45, y);
      y += 6;
    }

    y += 10;

    // Signature boxes
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    doc.text("Signature du Donateur / Déposant", margin + 10, y);
    doc.text(`Le Trésorier de la régie (${getApeeShortName(settings)})`, margin + contentWidth - 75, y);

    y += 18;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Cette pièce justificative vaut reçu pour comptabilité.", margin + 10, y);
    doc.text("Sceau et cachet officiel de régie financière.", margin + contentWidth - 75, y);

    const safeFilename = `recu_recette_${(revenueToPrint.payerName || 'autre').toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
    doc.save(safeFilename);
  };

  const handleOtherFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherPayerName.trim()) {
      alert("Le nom du payeur est obligatoire.");
      return;
    }
    if (otherAmount <= 0) {
      alert("Le montant doit être supérieur à 0.");
      return;
    }

    const payload: ApeeOtherRevenue = {
      id: 'rev_' + Date.now().toString(36),
      payerName: otherPayerName.trim(),
      status: otherStatus,
      statusDetails: otherStatus === 'institution' ? otherStatusDetails.trim() : undefined,
      amount: otherAmount,
      paymentMethod: otherPaymentMethod,
      date: otherDate,
      transactionId: otherTransactionId.trim() || undefined,
      notes: otherNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const savedSuccessfully = await onSaveOtherRevenue(payload);
      if (savedSuccessfully) {
        setSuccessMsg('Recette enregistrée et reçu de caisse édité avec succès !');
        // Instantly download PDF
        handleDownloadOtherRevenueReceiptPDF(payload);
        clearOtherForm();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de l'opération.");
    } finally {
      setIsSaving(false);
    }
  };

  // Sync provider selection when payment method changes
  useEffect(() => {
    if (payMethod === 'Orange Money') {
      setProvider('Orange');
    } else if (payMethod === 'MTN Mobile Money') {
      setProvider('MTN');
    } else if (payMethod === 'Wave') {
      setProvider('Wave');
    } else if (payMethod === 'Moov Money') {
      setProvider('Moov');
    }
  }, [payMethod]);

  useEffect(() => {
    if (activeParentToEdit) {
      setParentName(activeParentToEdit.name);
      setParentPhone(activeParentToEdit.phone);
      setParentAddress(activeParentToEdit.address);
      setParentEmail(activeParentToEdit.email || '');
      setStudents(activeParentToEdit.students.length > 0 ? activeParentToEdit.students : [{ name: '', classRoom: defaultClassroom }]);
      setNote(activeParentToEdit.note);
      setPayments(activeParentToEdit.payments);
      // Default payment input to 0 in edit mode
      setPayAmount(0);
      setTransactionId('');
      setProvider('MTN');
    } else {
      clearForm();
    }
  }, [activeParentToEdit]);

  const clearForm = () => {
    setParentName('');
    setParentPhone('');
    setParentAddress('');
    setParentEmail('');
    setStudents([{ name: '', classRoom: defaultClassroom, dateOperation: new Date().toISOString().slice(0, 10) }]);
    setNote('');
    setPayments([]);
    setPayAmount(0);
    setPaymentNote('');
    setPayMethod('Espèces');
    setTransactionId('');
    setProvider('MTN');
  };

  const handleAddStudent = () => {
    setStudents([...students, { name: '', classRoom: defaultClassroom, dateOperation: new Date().toISOString().slice(0, 10) }]);
  };

  const handleRemoveStudent = (index: number) => {
    const updated = [...students];
    updated.splice(index, 1);
    setStudents(updated.length > 0 ? updated : [{ name: '', classRoom: defaultClassroom }]);
  };

  const handleStudentChange = (index: number, field: keyof ApeeStudentLink, value: string) => {
    const updated = [...students];
    updated[index][field] = value;
    setStudents(updated);
  };

  // Get active currency
  const currency = settings?.currency || 'FCFA';

  // Automated dues calculator using global helper for breakdown of obligations
  const validStudentsCount = students.filter(s => s.name.trim() !== '').length;
  
  // Calculate dynamic breakdown including any un-added typed payment
  const mockParentForCalc = {
    students: students.filter(s => s.name.trim() !== ''),
    payments: [...payments, ...(payAmount > 0 ? [{ id: 'temp_input', amount: payAmount, date: '', method: '' }] : [])]
  };
  
  const {
    rubricBreakdown,
    globalDue: totalDueAmount,
    globalPaid: currentTotalPaid,
    globalDebt: restToPay
  } = calculateParentDebtBreakdown(mockParentForCalc, settings);

  const handleAddPaymentNode = () => {
    if (payAmount <= 0) return;
    
    const isDigitalMethod = ['Orange Money', 'MTN Mobile Money', 'Wave', 'Moov Money', 'Virement'].includes(payMethod);
    if (isDigitalMethod && !transactionId.trim()) {
      alert("Veuillez renseigner le numéro de transaction pour les paiements numériques.");
      return;
    }

    const newPayment: ApeePaymentItem = {
      id: 'pay_' + Date.now(),
      amount: payAmount,
      date: new Date().toISOString().slice(0, 10),
      note: paymentNote.trim() || undefined,
      method: payMethod,
      transactionId: isDigitalMethod ? transactionId.trim() : undefined,
      provider: isDigitalMethod ? provider : undefined,
    };
    setPayments([...payments, newPayment]);
    setPayAmount(0);
    setPaymentNote('');
    setTransactionId('');
    setSuccessMsg('Versement validé et ajouté à la liste !');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleRemovePaymentNode = (payId: string) => {
    setPayments(payments.filter(p => p.id !== payId));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim()) {
      alert("Le nom du parent est obligatoire.");
      return;
    }

    const filteredStudents = students.filter(s => s.name.trim() !== '');
    if (filteredStudents.length === 0) {
      alert("Veuillez saisir au moins un élève avec un nom valide.");
      return;
    }

    // Incorporate current active payment input if entered but not clicked add
    const finalPayments = [...payments];
    if (payAmount > 0) {
      const isDigitalMethod = ['Orange Money', 'MTN Mobile Money', 'Wave', 'Moov Money', 'Virement'].includes(payMethod);
      if (isDigitalMethod && !transactionId.trim()) {
        alert("Veuillez renseigner le numéro de transaction pour les paiements numériques.");
        return;
      }
      finalPayments.push({
        id: 'pay_' + Date.now(),
        amount: payAmount,
        date: new Date().toISOString().slice(0, 10),
        note: paymentNote.trim() || 'Versement direct à l\'enregistrement',
        method: payMethod,
        transactionId: isDigitalMethod ? transactionId.trim() : undefined,
        provider: isDigitalMethod ? provider : undefined,
      });
    }

    const sumPaid = finalPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Call our breakdown generator with final values
    const finalBreakdown = calculateParentDebtBreakdown({ students: filteredStudents, payments: finalPayments }, settings);
    const calculatedDue = finalBreakdown.globalDue;
    
    let computedStatus: 'soldé' | 'partiel' | 'retard' = 'retard';
    if (sumPaid >= calculatedDue) {
      computedStatus = 'soldé';
    } else if (sumPaid > 0) {
      computedStatus = 'partiel';
    }

    const parentPayload: ApeeParent = {
      id: activeParentToEdit?.id || 'par_' + Date.now().toString(36),
      name: parentName.trim(),
      phone: parentPhone.trim(),
      address: parentAddress.trim(),
      email: parentEmail.trim(),
      lastReminded: activeParentToEdit?.lastReminded || '',
      students: filteredStudents,
      totalDue: calculatedDue,
      totalPaid: sumPaid,
      status: computedStatus,
      note: note.trim(),
      payments: finalPayments,
      createdAt: activeParentToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const savedSuccessfully = await onSaveParent(parentPayload);
      if (savedSuccessfully) {
        setSuccessMsg(activeParentToEdit ? 'Fiche parent mise à jour avec succès !' : 'Parent et cotisation enregistrés avec succès !');
        setIsSavedJustNow(true);
        setShowReceiptModal(true);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Mock SMS template builder
  const handleTriggerSmsMock = () => {
    if (!parentName.trim() || !parentPhone.trim()) {
      alert("Veuillez renseigner le nom et le numéro de téléphone pour simuler l'envoi du SMS.");
      return;
    }
    const finalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + payAmount;
    const kidsStr = students.filter(s => s.name.trim() !== '').map(s => s.name).join(', ');
    const msg = `${getApeeShortName(settings)}: Bonjour M./Mme ${parentName}. Nous confirmons la réception de ${finalPaid.toLocaleString()} ${currency} pour la cotisation ${getApeeShortName(settings)} de (${kidsStr}). Solde restant: ${Math.max(0, totalDueAmount - finalPaid).toLocaleString()} ${currency}. Merci pour votre contribution active!`;
    setSmsMockMsg(msg);
  };

  const handleDownloadReceiptPDF = () => {
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

    const drawPageHeaderFooter = () => {
      // Header line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      // Header text
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Reçu ${getApeeShortName(settings)} • Année : ${settings.schoolYear || ""}`, margin, 9);
      
      // Footer line
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      
      // Footer text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Édité par PASMA-ENT ANALYTICS (Génération de pièces comptables)`, margin, pageHeight - 8);
      doc.text(`Reçu Numérique d'Archive`, margin + contentWidth - 35, pageHeight - 8);
    };

    drawPageHeaderFooter();

    // Top Cameroonian Official Ribbon
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text("RÉPUBLIQUE DU CAMEROUN", margin, y + 4);
    doc.text("REPUBLIC OF CAMEROON", margin + contentWidth, y + 4, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Paix - Travail - Patrie", margin, y + 8);
    doc.text("Peace - Work - Fatherland", margin + contentWidth, y + 8, { align: 'right' });

    y += 15;

    // Left accent bar
    doc.setFillColor(245, 158, 11); // Amber accent (amber-500)
    doc.rect(margin, y, 4, 18, 'F');

    // Brand and Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(217, 119, 6); // Amber dark
    doc.text(`${(settings.associationName || "APEE CES EKALI 1").toUpperCase()}`, margin + 6, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(`REÇU OFFICIEL DE COTISATION ${getApeeShortName(settings).toUpperCase()}`, margin + 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Année Scolare : ${settings.schoolYear || "N/A"} • Saisi le : ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`, margin + 6, y + 17);

    y += 24;

    // Summary Card Box style
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text("TOTAL DU EXIGIBLE", margin + 6, y + 7);
    doc.text("VERSEMENT REÇU", margin + 65, y + 7);
    doc.text("RESTE À RECOUVRER", margin + 125, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // Black
    doc.text(`${totalDueAmount.toLocaleString()} ${currency}`, margin + 6, y + 15);

    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text(`${payAmount.toLocaleString()} ${currency}`, margin + 65, y + 15);

    doc.setTextColor(245, 158, 11); // Amber-500
    doc.text(`${Math.max(0, restToPay).toLocaleString()} ${currency}`, margin + 125, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Frais et dotations`, margin + 6, y + 20);
    doc.text(`Méthode: ${payMethod || 'Espèces'}`, margin + 65, y + 20);
    doc.text(`Cumul payeur : ${currentTotalPaid.toLocaleString()} ${currency}`, margin + 125, y + 20);

    y += 32;

    // Parent details section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("COORDONNÉES DU PARENT PAYEUR", margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.setFont('helvetica', 'bold');
    doc.text("Nom du Parent :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(parentName || 'Non désigné', margin + 40, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text("Téléphone :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(parentPhone || 'Non spécifié', margin + 40, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text("Quartier / Adresse :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(parentAddress || 'Non spécifié', margin + 40, y);
    y += 6;

    if (parentEmail) {
      doc.setFont('helvetica', 'bold');
      doc.text("Adresse Email :", margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(parentEmail, margin + 40, y);
      y += 6;
    }

    if (transactionId) {
      doc.setFont('helvetica', 'bold');
      doc.text("Transaction ID :", margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(transactionId, margin + 40, y);
      y += 6;
    }

    y += 6;

    // Section II: Pupils list
    const filteredKids = students.filter(s => s.name.trim() !== '');
    if (filteredKids.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text("ÉLÈVES ASSOCIÉS AU DOSSIER (PUPILLES)", margin, y);
      y += 4;
      
      doc.line(margin, y, margin + contentWidth, y);
      y += 6;

      // Table Header Pupils
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text("N°", margin + 4, y + 4.5);
      doc.text("Nom complet de l'élève", margin + 15, y + 4.5);
      doc.text("Classe assignée", margin + 105, y + 4.5);
      doc.text("Date de l'opération", margin + 140, y + 4.5);

      y += 6.5;

      filteredKids.forEach((kid, idx) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);

        doc.text(String(idx + 1), margin + 4, y + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(kid.name.toUpperCase(), margin + 15, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(kid.classRoom, margin + 105, y + 4.5);
        const opDateStr = kid.dateOperation ? new Date(kid.dateOperation).toLocaleDateString('fr-FR') : '-';
        doc.text(opDateStr, margin + 140, y + 4.5);

        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });

      y += 8;
    }

    // Signature boxes
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    doc.text("Signature du Parent d'Élève", margin + 10, y);
    doc.text(`Le Trésorier du bureau (${getApeeShortName(settings)})`, margin + contentWidth - 75, y);

    y += 18;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Le parent s'engage à respecter les délais de versement.", margin + 10, y);
    doc.text("Sceau et cachet officiel de régie financière.", margin + contentWidth - 75, y);

    const safeFilename = `recu_${getApeeShortName(settings).toLowerCase()}_${(parentName || 'parent').toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
    doc.save(safeFilename);
  };

  const handlePrintReceiptDirectly = () => {
    setShowReceiptModal(true);
  };

  const handleCloseReceiptModal = () => {
    setShowReceiptModal(false);
    if (isSavedJustNow) {
      setIsSavedJustNow(false);
      if (!activeParentToEdit) {
        clearForm();
      } else if (onCancelEdit) {
        onCancelEdit();
      }
    }
  };

  return (
    <div id="content_apee_form" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-150 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {activeParentToEdit ? '🖊️ Modifier la Cotisation' : '📝 Enregistrement d\'une Opération de Caisse'}
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Enregistrer les cotisations scolaires des parents ou d\'autres types de recettes de l\'association.
          </p>
        </div>
        {activeParentToEdit && (
          <button
            onClick={onCancelEdit}
            className="mt-2 md:mt-0 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Annuler la modification
          </button>
        )}
      </div>

      {/* Tab switcher for parents vs other arbitrary revenues */}
      {!activeParentToEdit && (
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => { setFormMode('parent'); setSuccessMsg(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              formMode === 'parent'
                ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            👨‍👩‍👧‍👦 Cotisations de Parents
          </button>
          <button
            type="button"
            onClick={() => { setFormMode('other_revenue'); setSuccessMsg(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              formMode === 'other_revenue'
                ? 'bg-white text-emerald-950 shadow-xs border border-emerald-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            💸 Autres Recettes (Membres d'honneur, Dons...)
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-semibold">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {formMode === 'other_revenue' ? (
        <form onSubmit={handleOtherFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left half: Other Revenue details */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-4">
              <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-2 border-b border-emerald-100/50 pb-2">
                <User className="h-4 w-4 text-emerald-600 shrink-0" /> Coordonnées du Tiers / Organisme Payeur
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Nom complet / Raison sociale <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={otherPayerName}
                      onChange={(e) => setOtherPayerName(e.target.value)}
                      placeholder="Ex: M. Jean Elanga ou Fondation Orange"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Statut / Catégorie <span className="text-red-500">*</span></label>
                    <select
                      value={otherStatus}
                      onChange={(e) => setOtherStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-emerald-500 font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="membre_honneur">🌟 Membre d'Honneur (Mécène)</option>
                      <option value="institution">🏢 Institution (À préciser ci-contre)</option>
                      <option value="autre">🤝 Autre donateur tiers</option>
                    </select>
                  </div>

                  {otherStatus === 'institution' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-800 tracking-wide uppercase">Détails Institution <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={otherStatusDetails}
                        onChange={(e) => setOtherStatusDetails(e.target.value)}
                        placeholder="Ex: Mairie, Ministère d'Éducation, etc."
                        className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-emerald-550 font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Calendar className="h-4 w-4 text-emerald-600 shrink-0" /> Date et Référence d'Opération
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Date de l'opération</label>
                  <input
                    type="date"
                    required
                    value={otherDate}
                    onChange={(e) => setOtherDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-emerald-500 font-semibold font-mono text-center cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">N° Reçu / Réf. Transaction (Optionnel)</label>
                  <input
                    type="text"
                    value={otherTransactionId}
                    onChange={(e) => setOtherTransactionId(e.target.value)}
                    placeholder="Ex: CHQ-84920 ou Ref-MOMO"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Observations / Descriptif du Don (Optionnel)</label>
                <textarea
                  value={otherNotes}
                  onChange={(e) => setOtherNotes(e.target.value)}
                  placeholder="Inscrivez toutes les remarques (Ex: Don de rentrée pour matériel d'aménagement public)"
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-emerald-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Right half: Financial amounts */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-emerald-50/40 border border-emerald-150 rounded-2xl p-5 md:p-6 space-y-6">
              <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wide border-b border-emerald-100 pb-2 flex items-center gap-1.5 leading-none select-none">
                🤝 Validation Financière
              </h3>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-emerald-900 uppercase">Montant Déposé ({currency}) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600" />
                  <input
                    type="number"
                    min="100"
                    required
                    value={otherAmount || ''}
                    onChange={(e) => setOtherAmount(Number(e.target.value))}
                    placeholder="Ex: 500000"
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-black text-emerald-950 border border-emerald-300 bg-white rounded-xl focus:outline-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-emerald-900 uppercase">Mode de Paiement <span className="text-red-500">*</span></label>
                <select
                  value={otherPaymentMethod}
                  onChange={(e) => setOtherPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-bold text-slate-800 border border-emerald-250 bg-white rounded-xl focus:outline-emerald-500 cursor-pointer"
                >
                  <option value="Espèces">💵 Espèces (Cash)</option>
                  <option value="Chèque">✍️ Chèque de Banque</option>
                  <option value="Orange Money">🍊 Orange Money</option>
                  <option value="MTN Mobile Money">📲 MTN MoMo</option>
                  <option value="Wave">🌊 Wave Mobile</option>
                  <option value="Virement Bancaire">🏛️ Virement Bancaire</option>
                </select>
              </div>

              <div className="pt-4 border-t border-emerald-100">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer disabled:opacity-50 select-none shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSaving ? 'Enregistrement...' : '📥 Enregistrer la Recette & Délivrer Reçu'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left half: Parent and Students */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="h-4 w-4 text-indigo-500" /> Identité du Parent Responsable
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Nom complet <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: M. Jean-Baptiste TALLA"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Téléphone (SMS) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: +237 6xx xxx xxx"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Quartier de résidence / Adresse</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Ex: Ekali 1, à côté de l'antenne"
                    value={parentAddress}
                    onChange={(e) => setParentAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Adresse E-mail (Optionnel)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Ex: parent.grandjean@gmail.com"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Students list block */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Notebook className="h-4 w-4 text-emerald-500" /> Élèves Associés (Pupilles)
              </h3>
              <button
                type="button"
                onClick={handleAddStudent}
                className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="h-3 w-3" /> Ajouter un élève
              </button>
            </div>

            <p className="text-[10px] text-gray-400 mt-1">
              Chaque élève enregistré active les obligations financières de l'établissement (par élève ou par parent) définies dans les paramètres.
            </p>

            <div className="space-y-3 pt-2">
              {students.map((student, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end bg-white p-3.5 rounded-xl border border-slate-150 relative group">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Nom de l'élève {idx + 1}</label>
                    <input
                      type="text"
                      required={idx === 0}
                      placeholder="Nom et prénoms de l'élève"
                      value={student.name}
                      onChange={(e) => handleStudentChange(idx, 'name', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500"
                    />
                  </div>
                  <div className="sm:w-32 space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Classe</label>
                    <select
                      value={student.classRoom}
                      onChange={(e) => handleStudentChange(idx, 'classRoom', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50 cursor-pointer text-slate-800"
                    >
                      {configuredClassrooms.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:w-36 space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5 text-indigo-500" /> Date d'opération
                    </label>
                    <input
                      type="date"
                      value={student.dateOperation || ''}
                      onChange={(e) => handleStudentChange(idx, 'dateOperation', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50 text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStudent(idx)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer shrink-0 border border-transparent hover:border-red-100 flex items-center justify-center self-end sm:self-auto h-8 sm:h-auto"
                    title="Supprimer l'élève"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Observations Node */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">Notes ou observations particulières</label>
            <textarea
              rows={2}
              placeholder="Ex: Parent s'engage à solder le reste avant le début du 2e trimestre."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 text-xs border border-slate-200 rounded-2xl focus:outline-indigo-500"
            />
          </div>
        </div>

        {/* Right half: Financial Summary & Payments */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold border-b border-slate-800 pb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" /> Synthèse des Obligations & Dettes
            </h3>

            <div className="space-y-2.5">
              <div className="flex justify-between text-xs font-medium text-slate-350">
                <span>Régime de tarification :</span>
                <span className="font-bold text-white uppercase">{settings.country || 'Cameroun'} ({currency})</span>
              </div>
              <div className="flex justify-between text-[11px] font-medium text-slate-350">
                <span>Nombre de pupilles inscrites :</span>
                <span className="font-bold text-white font-mono bg-slate-800 px-1.5 py-0.2 rounded">{validStudentsCount}</span>
              </div>
              
              <hr className="border-slate-800 my-1.5" />
              
              {/* Detailed debts rubrics list */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
                {rubricBreakdown.map((r) => (
                  <div key={r.id} className="bg-slate-850 border border-slate-800 p-2 rounded-xl text-[11px] space-y-1">
                    <div className="flex justify-between items-center text-slate-200">
                      <span className="font-bold text-slate-200">{r.name} <span className="text-[8.5px] text-slate-400 font-normal">({r.type === 'per_student' ? 'par élève' : 'par parent'})</span></span>
                      <span className="font-mono text-slate-100 font-semibold">{r.totalDue.toLocaleString()} {currency}</span>
                    </div>
                    {validStudentsCount > 0 && (
                      <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                        <span>Payé: {r.totalPaid.toLocaleString()} {currency}</span>
                        <span className={r.remainingDebt > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                          Dette: {r.remainingDebt.toLocaleString()} {currency}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <hr className="border-slate-800 my-1" />
              
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs font-bold text-amber-400 uppercase">Dette Globale (Dû) :</span>
                <span className="text-lg font-mono font-bold text-amber-300">
                  {totalDueAmount.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs bg-slate-850">
              <span className="text-slate-350 font-bold">Total Encaissé (Payé) :</span>
              <span className="font-bold text-emerald-400 font-mono text-xs">
                {currentTotalPaid.toLocaleString()} {currency}
              </span>
            </div>

            <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-350 font-bold">Reste Global à Recouvrer :</span>
              <span className={`font-mono font-black text-xs ${restToPay > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {Math.max(0, restToPay).toLocaleString()} {currency}
              </span>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 flex items-center gap-1 select-none">
              <Tag className="h-3 w-3 text-indigo-400" />
              <span>Statut estimé : </span>
              <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase ${
                currentTotalPaid >= totalDueAmount ? 'bg-emerald-950 text-emerald-300 border border-emerald-900' : (currentTotalPaid > 0 ? 'bg-amber-950 text-amber-300 border border-amber-900' : 'bg-red-950 text-red-300 border border-red-900')
              }`}>
                {currentTotalPaid >= totalDueAmount ? 'Soldé' : (currentTotalPaid > 0 ? 'Partiel' : 'Retard')}
              </span>
            </div>
          </div>

          {/* Record payment block */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Plus className="h-4 w-4 text-indigo-500" /> Enregistrer un Versement (Acompte)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Montant versé ({currency})</label>
                <div className="relative">
                  <span className="absolute left-2 text-xs top-2 font-mono text-gray-550">{currency}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full pl-12 pr-3 py-1.5 text-xs text-right font-mono border border-slate-200 rounded-lg focus:outline-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Moyen de paiement</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white cursor-pointer text-slate-700"
                >
                  <option value="Espèces">💵 Espèces (Physique)</option>
                  <option value="Orange Money">🍊 Orange Money</option>
                  <option value="MTN Mobile Money">💛 MTN Mobile Money</option>
                  <option value="Wave">🌊 Wave</option>
                  <option value="Moov Money">🟢 Moov Money</option>
                  <option value="Chèque">✍️ Chèque</option>
                  <option value="Virement">🏦 Virement</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Libellé / Note</label>
                <input
                  type="text"
                  placeholder="Ex: Acompte 1"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500"
                />
              </div>
            </div>

            {/* Custom transaction metadata inputs */}
            {['Orange Money', 'MTN Mobile Money', 'Wave', 'Moov Money', 'Virement'].includes(payMethod) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/40 mt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-900 uppercase">Fournisseur de services <span className="text-red-500">*</span></label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-indigo-200 focus:border-indigo-500 rounded-lg bg-white cursor-pointer font-semibold text-indigo-950"
                  >
                    <option value="MTN">💛 MTN Mobile Money</option>
                    <option value="Orange">🍊 Orange Money</option>
                    <option value="Wave">🌊 Wave</option>
                    <option value="Moov">🟢 Moov Money</option>
                    <option value="Autre">🏦 Autre / Banque de transfert</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-900 uppercase">Numéro de transaction <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required={payAmount > 0}
                    placeholder="Référence de transaction"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-indigo-200 focus:border-indigo-500 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            )}

            {payAmount > 0 && (
              <button
                type="button"
                onClick={handleAddPaymentNode}
                className="w-full text-center bg-indigo-600 text-white font-semibold rounded-lg px-2 py-1.5 text-xs hover:bg-indigo-700 cursor-pointer transition shadow-2xs"
              >
                Ajouter ce versement au tableau historique
              </button>
            )}

            {/* Existing payments list */}
            {payments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Historique des versements</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {payments.map((p, pIdx) => (
                    <div key={p.id || pIdx} className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-150 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{p.amount.toLocaleString()} FCFA</span>
                          <span className="text-[8px] font-sans font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {p.method || 'Espèces'}
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-2.5 w-2.5" /> {p.date} {p.note && `(${p.note})`}
                        </div>
                        {p.transactionId && (
                          <div className="text-[9px] text-indigo-700 bg-indigo-50/50 rounded-md px-1.5 py-0.5 font-mono inline-block mt-1 border border-indigo-100/40">
                            Tx: <span className="font-bold">{p.transactionId}</span> ({p.provider || 'N/A'})
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentNode(p.id)}
                        className="p-1 text-red-500 hover:bg-slate-50 rounded-md cursor-pointer"
                        title="Supprimer ce versement"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons list */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTriggerSmsMock}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-800 rounded-xl hover:bg-slate-200 flex items-center justify-center gap-2 border border-slate-200 cursor-pointer transition whitespace-nowrap"
                title="Générer le SMS de reçu"
              >
                <Smartphone className="h-3.5 w-3.5 text-slate-500" /> Simuler SMS Reçu
              </button>

              <button
                type="button"
                onClick={handlePrintReceiptDirectly}
                className="px-3 py-2 text-xs font-semibold bg-amber-50 text-amber-800 rounded-xl hover:bg-amber-100 flex items-center justify-center gap-2 border border-amber-200 cursor-pointer transition whitespace-nowrap"
                title="Imprimer directement"
              >
                <Printer className="h-3.5 w-3.5 text-amber-600" /> Imprimer Reçu
              </button>
            </div>

            {smsMockMsg && (
              <div className="bg-slate-900 text-slate-200 rounded-xl p-3 border border-slate-800 relative">
                <div className="text-[10px] font-mono text-indigo-400 mb-1 border-b border-slate-800 pb-1 flex justify-between items-center">
                  <span>📱 SMS Simulatrice de Reçu (Reçu par Parent) :</span>
                  <button onClick={() => setSmsMockMsg(null)} className="text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer">fermer</button>
                </div>
                <p className="text-[11px] font-mono leading-relaxed bg-slate-950 p-2 rounded border border-slate-850">
                  {smsMockMsg}
                </p>
                <div className="text-[9px] text-gray-500 mt-1.5 text-right">
                  Numéro destinataire : <strong className="text-slate-350">{parentPhone || 'Aucun'}</strong>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className={`w-full text-center border text-white font-bold rounded-xl py-3 text-xs uppercase tracking-wide transition shadow-md ${
                isSaving 
                  ? 'bg-slate-400 border-slate-350 cursor-not-allowed' 
                  : 'bg-slate-900 border-slate-800 hover:border-black hover:bg-black cursor-pointer'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Enregistrement...
                </span>
              ) : (
                <>🚀 {activeParentToEdit ? 'Enregistrer les Modifications' : 'Enregistrer la Fiche Cotisation'}</>
              )}
            </button>
          </div>

        </div>

      </form>
      )}

      {/* Receipt Preview Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] no-print">
          
          {/* Print Style Injector for this APEE receipt while open */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-section-apee, #print-section-apee * {
                visibility: visible !important;
              }
              #print-section-apee {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
                font-size: 10pt !important;
                font-family: system-ui, -apple-system, sans-serif !important;
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 1.5cm !important;
              }
            }
          `}} />

          <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden text-slate-800">
            
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-sm tracking-tight">Imprimerie & Aperçu du Reçu de Cotisation</span>
              </div>
              <button
                type="button"
                onClick={handleCloseReceiptModal}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer transition flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Guide Notification */}
            {isSavedJustNow ? (
              <div className="bg-emerald-600 text-white p-4 shrink-0 text-xs font-semibold flex items-center gap-2 shadow-xs">
                <CheckCircle className="h-5 w-5 shrink-0 text-amber-300" />
                <span>
                  <strong>🎉 Succès :</strong> La cotisation a été enregistrée et archivée en base de données ! Vous pouvez imprimer le reçu officiel ci-dessous.
                </span>
              </div>
            ) : (
              <div className="bg-amber-50 border-b border-amber-100 p-4 shrink-0 text-xs text-amber-900 leading-relaxed font-semibold">
                💡 <strong>Note de compatibilité :</strong> L'application s'exécute dans un aperçu sécurisé (iframe). Si le bouton de votre imprimante ne réagit pas, veuillez <strong>Ouvrir dans un nouvel onglet</strong> (bouton en haut à droite) pour imprimer librement vos reçus. Vous pouvez aussi sauvegarder cet écran !
              </div>
            )}

            {/* Modal scrollable preview page sheet */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100 flex justify-center">
              <div 
                id="print-section-apee"
                className="bg-white border border-gray-200 rounded-xl p-8 max-w-xl w-full shadow-sm text-slate-900 font-sans relative flex flex-col justify-between"
                style={{ minHeight: '29.7cm', width: '21cm', maxWidth: '100%' }}
              >
                
                <div className="space-y-6">
                  {/* Header of the receipt */}
                  <div className="text-center border-b pb-4 space-y-1">
                    <h2 className="text-sm font-black tracking-wider uppercase text-slate-900">{settings.associationName || "APEE CES Ekali 1"}</h2>
                    <p className="text-[10px] uppercase font-black text-slate-600 tracking-wide">REPUBLIQUE DU CAMEROUN - PAIX-TRAVAIL-PATRIE</p>
                    <p className="text-[10px] font-mono text-slate-500 font-semibold">Année Scolaire : {settings.schoolYear || "2025/2026"}</p>
                    <div className="text-xs font-black bg-slate-100 border border-slate-200 py-1.5 uppercase rounded-lg tracking-wider max-w-sm mx-auto my-2 text-slate-800">
                      REÇU OFFICIEL DE COTISATION {getApeeShortName(settings).toUpperCase()}
                    </div>
                  </div>

                  {/* Metadata and Financial numbers info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <p className="text-[11px]"><strong className="text-slate-500">Référence du Reçu :</strong> <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">REC-{Date.now().toString(36).toUpperCase()}</span></p>
                      <p className="text-[11px]"><strong className="text-slate-500">Date d'Émission :</strong> <span className="font-semibold">{new Date().toLocaleDateString('fr-FR')}</span></p>
                      <p className="pt-2 text-[13px]"><strong className="text-slate-800">Parent Payeur :</strong> <span className="font-extrabold text-slate-900">{parentName || 'Non désigné'}</span></p>
                      <p className="text-[11px]"><strong className="text-slate-500">Téléphone de contact :</strong> <span className="font-mono font-semibold">{parentPhone || 'Non renseigné'}</span></p>
                      <p className="text-[11px]"><strong className="text-slate-500">Quartier / Adresse :</strong> <span>{parentAddress || 'Non spécifié'}</span></p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 flex flex-col justify-between">
                      {/* Rubric specific details on receipt */}
                      <div className="space-y-1 text-[10px] pb-1.5 border-b border-slate-200">
                        {rubricBreakdown.map(r => (
                          <div key={r.id} className="flex justify-between text-slate-600">
                            <span>{r.name} ({r.type === 'per_student' ? 'élève' : 'parent'}) :</span>
                            <span className="font-mono font-semibold">{r.totalDue.toLocaleString()} {currency} (rest. {r.remainingDebt.toLocaleString()})</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center text-[11px] font-bold pt-1">
                        <span className="text-slate-800">Dette Globale (Dû) :</span>
                        <span className="font-bold font-mono text-slate-900">{totalDueAmount.toLocaleString()} {currency}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-600">Versement Saisi :</span>
                        <span className="font-bold font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">+{payAmount.toLocaleString()} {currency}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] border-t border-slate-200 pt-1">
                        <span className="font-bold text-slate-800">Cumul payé :</span>
                        <span className="font-black font-mono text-emerald-700">{(currentTotalPaid).toLocaleString()} {currency}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-red-700 bg-red-50/50 p-1 rounded font-bold">
                        <span>Reste Exigible :</span>
                        <span className="font-mono">{Math.max(0, restToPay).toLocaleString()} {currency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pupils table */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide font-black text-slate-500">📋 Élèves Associés (Pupilles bénéficiaires) :</p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-2 px-3 border-r border-slate-200 font-extrabold text-[#111827]">N°</th>
                            <th className="py-2 px-3 border-r border-slate-200 font-extrabold text-[#111827]">Nom complet</th>
                            <th className="py-2 px-3 border-r border-slate-200 font-extrabold text-[#111827]">Classe assignée</th>
                            <th className="py-2 px-3 font-extrabold text-[#111827]">Date d'opération</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.filter(s => s.name.trim() !== '').map((s, idx) => (
                            <tr key={idx} className="border-b border-slate-150 hover:bg-slate-50/50">
                              <td className="py-1.5 px-3 border-r border-slate-200 font-medium text-slate-500">{idx + 1}</td>
                              <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[11px] font-extrabold text-slate-900 uppercase tracking-wide">{s.name}</td>
                              <td className="py-1.5 px-3 border-r border-slate-200 font-semibold text-slate-700">{s.classRoom}</td>
                              <td className="py-1.5 px-3 font-mono font-bold text-gray-600 text-[11px]">
                                {s.dateOperation ? new Date(s.dateOperation).toLocaleDateString('fr-FR') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Payments list history */}
                  {(payments.length > 0 || payAmount > 0) && (
                    <div className="space-y-1.5 border-t border-slate-200 pt-4">
                      <p className="text-[10px] uppercase tracking-wide font-black text-slate-500">📜 Historique détaillé des Transactions :</p>
                      <div className="space-y-1">
                        {payAmount > 0 && (
                          <p className="text-[11px] text-slate-800 bg-amber-50/50 p-1.5 border border-amber-200/50 rounded flex justify-between">
                            <span>• {new Date().toLocaleDateString('fr-FR')} : <strong>{payAmount.toLocaleString()} {currency}</strong> - {payMethod} ({paymentNote || 'Versement en cours'})</span>
                            {transactionId && <span className="font-mono font-bold text-[10px] bg-white px-2 border rounded">TID: {transactionId}</span>}
                          </p>
                        )}
                        {payments.map((p, idx) => (
                          <p key={p.id || idx} className="text-[11px] text-slate-700 flex justify-between">
                            <span>• {p.date} : <strong>{p.amount.toLocaleString()} {currency}</strong> ({p.method || 'Espèces'}) {p.note ? `- ${p.note}` : ''}</span>
                            {p.transactionId && <span className="font-mono text-[10px] bg-slate-100 px-1.5 border rounded">TID: {p.transactionId}</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom stamp and signature blocks */}
                <div className="space-y-8 mt-8">
                  <div className="grid grid-cols-2 text-center text-xs gap-8 border-t border-slate-200 pt-4">
                    <div>
                      <p className="font-extrabold text-slate-800">Le Parent d'Élève</p>
                      <p className="text-[9px] text-slate-400 mt-1">Sceau d'approbation et signature</p>
                      <div className="h-14 border border-dashed border-slate-200 rounded-lg mt-2 flex items-center justify-center text-[10px] text-slate-300 font-mono">Signer ici</div>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800">Le Trésorier de l'{getApeeShortName(settings)}</p>
                      <p className="text-[9px] text-slate-400 mt-1">Cachet et Signature réglementaire</p>
                      <div className="h-14 border border-dashed border-slate-200 rounded-lg mt-2 flex items-center justify-center text-[10px] text-slate-300 font-mono font-semibold">Cachet de régie</div>
                    </div>
                  </div>

                  <div className="text-center text-[9px] text-slate-400 font-mono border-t border-slate-150 pt-2">
                    {settings.associationName || "Établissement"} - Système Informatisé d'Émargement des Recettes {getApeeShortName(settings)} • {settings.schoolYear}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-5 py-4 flex justify-between items-center shrink-0 gap-3">
              <button
                type="button"
                onClick={handleCloseReceiptModal}
                className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Retourner au Formulaire
              </button>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadReceiptPDF}
                  className="px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-black tracking-wide shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="h-4 w-4" /> Télécharger Reçu (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setToastMessage("Le module d'impression a été déclenché pour ce reçu de paiement. Si l'aperçu ne s'affiche pas, vérifiez vos permissions d'onglet.");
                    setShowPrintToast(true);
                    setTimeout(() => {
                      setShowPrintToast(false);
                    }, 5500);
                    window.print();
                  }}
                  className="px-3 py-2.5 bg-slate-700 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" /> Imprimer en Direct
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <AnimatePresence>
        {showPrintToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-[9999] bg-slate-900 border border-slate-700/50 text-white rounded-2xl p-4 shadow-xl flex items-center gap-3.5 max-w-sm no-print no-print-interface"
          >
            <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex flex-center items-center justify-center text-emerald-400 border border-emerald-500/30 shrink-0">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-100">Impression lancée</h4>
              <p className="text-[11px] text-slate-300 leading-normal mt-0.5">{toastMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPrintToast(false)}
              className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
