import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { 
  FileText, 
  Printer, 
  Download, 
  Plus, 
  Trash2, 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  BadgeHelp, 
  FileSpreadsheet, 
  Check, 
  Sparkles,
  ClipboardList,
  FlameKindling,
  Info
} from 'lucide-react';
import { ApeeSettings } from '../../types';
import { getApeeShortName } from '../../utils/apeeDb';
import { useLanguage } from '../../utils/TranslationContext';

interface ApeeBlankFormsProps {
  settings: ApeeSettings;
}

interface FormItemLine {
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
}

type FormTemplateType = 'command' | 'payment-order' | 'refund' | 'spend-auth' | 'fund-deposit';

export default function ApeeBlankForms({ settings }: ApeeBlankFormsProps) {
  const { language } = useLanguage();
  // Navigation template select
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplateType>('command');
  
  // Custom form header and metadata
  const [isVierge, setIsVierge] = useState<boolean>(true); // Mode "Vierge pour remplissage manuel"
  const [includeOfficialRibbon, setIncludeOfficialRibbon] = useState<boolean>(true);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(''); // empty means blank lines/dots in document
  const [recipientName, setRecipientName] = useState<string>('');
  const [referenceInLetters, setReferenceInLetters] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [fundingLine, setFundingLine] = useState<string>('');
  const [footerNotes, setFooterNotes] = useState<string>('');

  // Tables settings (if customized)
  const [items, setItems] = useState<FormItemLine[]>([
    { description: 'Achat de rames de papier ministre double-format', quantity: '5', unitPrice: '3500', total: '17500' },
  ]);
  const [manualTableRows, setManualTableRows] = useState<number>(5); // How many blank rows to print in manual mode
  
  // Signature blocks
  const [signPresident, setSignPresident] = useState<boolean>(true);
  const [signFinManager, setSignFinManager] = useState<boolean>(true);
  const [signDirector, setSignDirector] = useState<boolean>(true);
  const [signRecipient, setSignRecipient] = useState<boolean>(true);

  // Success alert
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  // Template details definition
  const templateConfig = {
    command: {
      defaultTitle: 'BON DE COMMANDE DE MATÉRIELS / SERVICES',
      color: 'indigo',
      badge: 'B.C.',
      desc: 'Formulaire d\'acquisition de fournitures scolaires, travaux de réparation légers ou achats généraux des délégations parents.',
      refPlaceholder: 'N° BC-____/2026',
      recipientLabel: 'Fournisseur / Prestataire',
    },
    'payment-order': {
      defaultTitle: 'ORDRE DE PAIEMENT & DÉCAISSEMENT',
      color: 'sky',
      badge: 'O.P.',
      desc: 'Pièce comptable autorisant le trésorier à débourser les fonds validés de la caisse pour régler une facture ou créance.',
      refPlaceholder: 'N° OP-____/2026',
      recipientLabel: 'Bénéficiaire des fonds',
    },
    refund: {
      defaultTitle: 'FICHE DE REMBOURSEMENT DE FRAIS',
      color: 'pink',
      badge: 'F.R.',
      desc: 'Justificatif de remboursement d\'un parent d\'élève ou d\'un membre du bureau ayant avancé des fonds sur justificatifs.',
      refPlaceholder: 'N° RF-____/2026',
      recipientLabel: 'Parent / Demandeur d\'avance',
    },
    'spend-auth': {
      defaultTitle: 'AUTORISATION D\'ENGAGEMENT DE DÉPENSES',
      color: 'emerald',
      badge: 'A.E.',
      desc: 'Accord préalable d’affectation de budget requis avant tout lancement de consultations ou engagements financiers majeurs.',
      refPlaceholder: 'N° AE-____/2026',
      recipientLabel: 'Demandeur / Commission',
    },
    'fund-deposit': {
      defaultTitle: 'BORDEREAU DE VERSEMENT DE FONDS (BANQUE/CAISSE)',
      color: 'amber',
      badge: 'B.V.',
      desc: 'Dépôt d’espèces ou de chèques issues des cotisations scolaires auprès de la banque partenaire ou du mandataire de caisse.',
      refPlaceholder: 'N° B-VERS-____/2026',
      recipientLabel: 'Déposant / Trésorier adjoint',
    }
  };

  const currentConf = templateConfig[selectedTemplate];

  const handleReset = () => {
    setIsVierge(true);
    setReferenceNumber('');
    setDateStr('');
    setRecipientName('');
    setReferenceInLetters('');
    setCustomTitle('');
    setFundingLine('');
    setFooterNotes('');
    setItems([{ description: '', quantity: '', unitPrice: '', total: '' }]);
    setManualTableRows(5);
    setSignPresident(true);
    setSignFinManager(true);
    setSignDirector(true);
    setSignRecipient(true);
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: '', unitPrice: '', total: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleItemChange = (index: number, key: keyof FormItemLine, val: string) => {
    const updated = [...items];
    updated[index][key] = val;
    
    // Auto total logic
    if (key === 'quantity' || key === 'unitPrice') {
      const q = parseFloat(updated[index].quantity) || 0;
      const p = parseFloat(updated[index].unitPrice) || 0;
      if (q > 0 && p > 0) {
        updated[index].total = (q * p).toString();
      }
    }
    setItems(updated);
  };

  const totalCalculatedAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);

  // PDF Compilation
  const compileFormPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (2 * margin); // 180mm
    let y = 15;
    const isEn = language === 'en';

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
      
      y += 18;
    }

    // Right block - Stamp/Signature placeholder box for secretary
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.2);
    doc.rect(margin + contentWidth - 55, y - 4, 55, 12);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    const reservedLabel = isEn ? "RESERVED FOR ACCOUNTS OFFICE" : "RÉSERVÉ BUREAU COMPTABLE / ENR";
    const uniqueDocLabel = isEn ? "UNIQUE PIECE - PTA ARCHIVE" : "PIÈCE UNIQUE - ARCHIVE APEE";
    doc.text(reservedLabel, margin + contentWidth - 52, y);
    doc.text(uniqueDocLabel, margin + contentWidth - 52, y + 4);

    y += 14;

    // Title Block with background colors
    let defaultTitleLabel = currentConf.defaultTitle;
    if (isEn) {
      if (selectedTemplate === 'command') defaultTitleLabel = "MATERIALS / SERVICES PURCHASE ORDER";
      else if (selectedTemplate === 'payment-order') defaultTitleLabel = "PAYMENT & DISBURSEMENT ORDER";
      else if (selectedTemplate === 'refund') defaultTitleLabel = "EXPENSE REIMBURSEMENT SHEET";
      else if (selectedTemplate === 'spend-auth') defaultTitleLabel = "FUNDS COMMITMENT AUTHORIZATION";
      else if (selectedTemplate === 'fund-deposit') defaultTitleLabel = "FUNDS DEPOSIT BANK SLIP";
    }
    const activeTitle = customTitle.trim() || defaultTitleLabel;
    doc.setFillColor(30, 41, 59); // Slate 800 dark focus
    doc.rect(margin, y, contentWidth, 12, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(activeTitle, margin + 4, y + 7.5);

    y += 12;

    // Metadata lines - Number and Date
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 10, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    
    const activeRef = referenceNumber.trim() || (isEn ? currentConf.refPlaceholder.replace('N°', 'No.') : currentConf.refPlaceholder);
    const refPrefix = isEn ? "Document Reference: " : "Référence Document : ";
    doc.text(`${refPrefix} ${activeRef}`, margin + 4, y + 6.5);
    
    const activeDate = dateStr.trim()
      ? new Date(dateStr).toLocaleDateString(isEn ? 'en-US' : 'fr-FR', { dateStyle: 'long' })
      : (isEn ? 'Date: ____ / ____ / 2026' : 'Le : ____ / ____ / 2026');
    doc.text(activeDate, margin + contentWidth - 4, y + 6.5, { align: 'right' });

    y += 15;

    // Form Context details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    
    let labelRecipient = currentConf.recipientLabel;
    if (isEn) {
      if (selectedTemplate === 'command') labelRecipient = 'Supplier / Provider';
      else if (selectedTemplate === 'payment-order') labelRecipient = 'Beneficiary of Funds';
      else if (selectedTemplate === 'refund') labelRecipient = 'Parent / Claimant';
      else if (selectedTemplate === 'spend-auth') labelRecipient = 'Claimant / Committee';
      else if (selectedTemplate === 'fund-deposit') labelRecipient = 'Depositor / Treasurer';
    }

    const repValue = isVierge ? '_____________________________________________________________________________' : (recipientName || '_____________________________________________________________________________');
    doc.text(`${labelRecipient} :`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(repValue, margin + 45, y);

    y += 7;

    // Budget line allocation row
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    const flLabelEn = isVierge ? '📁 Budget Line Allocation: _______________________________________________' : `📁 Budget Line Allocation: ${fundingLine || 'Operations / General'}`;
    const flLabelFr = isVierge ? "📁 Rubrique d'imputation : _______________________________________________" : `📁 Rubrique d'imputation : ${fundingLine || 'Fonctionnement / Non spécifiée'}`;
    const flValue = isEn ? flLabelEn : flLabelFr;
    doc.text(flValue, margin, y);

    y += 10;

    // Main particulars table header
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 7, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    
    const tableDesc = isEn ? "Detailed Description of Operations / Deliverables" : "Description détaillée de l'opération";
    const tableQty = isEn ? "Qty" : "Quantité";
    const tablePrice = isEn ? "Unit Price (FCFA)" : "Prix Unitaire (FCFA)";
    doc.text(tableDesc, margin + 3, y + 4.5);
    doc.text(tableQty, margin + contentWidth - 48, y + 4.5, { align: 'right' });
    doc.text(tablePrice, margin + contentWidth - 25, y + 4.5, { align: 'right' });
    doc.text("Total (FCFA)", margin + contentWidth - 3, y + 4.5, { align: 'right' });

    y += 7;

    // Table elements rendering
    if (isVierge) {
      // Manual rows grid
      const rowsCount = Math.max(1, manualTableRows);
      for (let i = 0; i < rowsCount; i++) {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, margin + contentWidth, y);
        doc.line(margin, y + 7, margin + contentWidth, y + 7);
        
        // Blank dots lines
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(203, 213, 225);
        doc.text(". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .", margin + 3, y + 4.5);
        doc.text(". . . . . . . . .", margin + contentWidth - 48, y + 4.5, { align: 'right' });
        doc.text(". . . . . . . . . . .", margin + contentWidth - 25, y + 4.5, { align: 'right' });
        doc.text(". . . . . . . . . . .", margin + contentWidth - 3, y + 4.5, { align: 'right' });
        
        y += 7;
      }
    } else {
      // Render custom values
      items.forEach((item) => {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, margin + contentWidth, y);
        doc.line(margin, y + 7.5, margin + contentWidth, y + 7.5);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        
        // Truncate long descriptions
        const truncDesc = item.description || (isEn ? 'Operation item without title' : 'Opération sans intitulé');
        doc.text(doc.splitTextToSize(truncDesc, 115), margin + 3, y + 4.5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(item.quantity || "0", margin + contentWidth - 48, y + 4.5, { align: 'right' });
        doc.text(parseFloat(item.unitPrice || '0').toLocaleString() + ' F', margin + contentWidth - 25, y + 4.5, { align: 'right' });
        doc.text(parseFloat(item.total || '0').toLocaleString() + ' F', margin + contentWidth - 3, y + 4.5, { align: 'right' });
        
        y += 7.5;
      });
    }

    // Outer table borders
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, margin, y - (isVierge ? (Math.max(1, manualTableRows) * 7 + 7) : (items.length * 7.5 + 7)));
    doc.line(margin + contentWidth, y, margin + contentWidth, y - (isVierge ? (Math.max(1, manualTableRows) * 7 + 7) : (items.length * 7.5 + 7)));
    doc.line(margin + contentWidth - 55, y, margin + contentWidth - 55, y - (isVierge ? (Math.max(1, manualTableRows) * 7 + 7) : (items.length * 7.5 + 7)));
    doc.line(margin + contentWidth - 18, y, margin + contentWidth - 18, y - (isVierge ? (Math.max(1, manualTableRows) * 7 + 7) : (items.length * 7.5 + 7)));

    // Total section box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const stringAmountLabel = isVierge 
      ? (isEn ? "TOTAL CALCULATED SUM: ______________________________________________ FCFA" : "MONTANT TOTAL : ______________________________________________ FCFA")
      : (isEn ? `TOTAL ALLOCATED SUM: ${totalCalculatedAmount.toLocaleString()} FCFA` : `MONTANT TOTAL ALLOUÉ : ${totalCalculatedAmount.toLocaleString()} FCFA`);
    doc.text(stringAmountLabel, margin + 4, y + 5.5);

    if (!isVierge && totalCalculatedAmount > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const inLetters = referenceInLetters.trim() || "...";
      const totalLettersLabel = isEn ? `Certified this document for the premium sum of: ${inLetters} FCFA` : `Arrêté la présente pièce à la somme de : ${inLetters} FCFA`;
      doc.text(totalLettersLabel, margin + 4, y + 13);
      y += 10;
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      const certifiedBlankLabel = isEn 
        ? "Certified this blank document for the total sum of (in letters): __________________________________________________________________________ FCFA"
        : "Arrêté la présente pièce vierge à la somme de (en lettres) : __________________________________________________________________________ FCFA";
      doc.text(certifiedBlankLabel, margin + 4, y + 13);
      y += 10;
    }

    y += 14;

    // Custom user notes
    if (footerNotes.trim()) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const notesLabel = isEn ? "Special observations and details:" : "Notes particulières d'exécution :";
      doc.text(notesLabel, margin, y);
      doc.text(footerNotes.trim(), margin + 5, y + 4);
      y += 10;
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      const impDisc = isEn 
        ? "IMPORTANT: Original purchase bills, matching receipts and signatures must be clipped to the back of this document."
        : "IMPORTANT : Les factures d'achats originaux ou bordereaux de livraisons doivent obligatoirement être agrafés au dos de ce document réglementaire.";
      doc.text(impDisc, margin, y);
      y += 5;
    }

    y += 8;

    // Signature Panel Design
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const controlLabel = isEn ? "CONTROL FRAMEWORK AND REQUIRED REGULATORY SIGNATURES:" : "CADRES DE CONTRÔLES ET SIGNATURES MULTIPLES REQUISES :";
    doc.text(controlLabel, margin, y);
    
    y += 4;
    
    // Draw signature boxes depending on selections
    const boxesCount = [signPresident, signFinManager, signDirector, signRecipient].filter(Boolean).length;
    if (boxesCount > 0) {
      const boxWidth = contentWidth / Math.min(4, Math.max(1, boxesCount)) - 3;
      let nextX = margin;

      if (signFinManager) {
        doc.setFillColor(250, 250, 250);
        doc.rect(nextX, y, boxWidth, 24, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(51, 65, 85);
        const signTreasLabel = isEn ? "PTA TREASURER / FIN OFFICER" : "LE RESPONSABLE FINANCIER";
        doc.text(signTreasLabel, nextX + 2, y + 4);
        doc.text(settings.finManagerName || (isEn ? "Financial Treasurer" : "Le Trésorier APEE"), nextX + 2, y + 7);
        doc.setFont('helvetica', 'italic');
        doc.text(isEn ? "(Visa & Stamp)" : "(Visa et cachet)", nextX + boxWidth - 18, y + 21);
        nextX += boxWidth + 3;
      }

      if (signPresident) {
        doc.setFillColor(250, 250, 250);
        doc.rect(nextX, y, boxWidth, 24, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        const signPresLabel = isEn ? "PTA ASSOCIATION PRESIDENT" : "LE PRÉSIDENT APEE";
        doc.text(signPresLabel, nextX + 2, y + 4);
        doc.text(isEn ? "(Visa to order payment)" : "(Visa pour Ordonnancer)", nextX + 2, y + 7);
        doc.setFont('helvetica', 'italic');
        doc.text(isEn ? "(Signature)" : "(Signature)", nextX + boxWidth - 14, y + 21);
        nextX += boxWidth + 3;
      }

      if (signDirector) {
        doc.setFillColor(250, 250, 250);
        doc.rect(nextX, y, boxWidth, 24, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        const signDirLabel = isEn ? "SCHOOL PRINCIPAL / COGE" : "LE CHEF D'ÉTABLISSEMENT / COGE";
        doc.text(signDirLabel, nextX + 2, y + 4);
        doc.text(settings.directorName || (isEn ? "Visa Principal" : "Visa Direction"), nextX + 2, y + 7);
        doc.setFont('helvetica', 'italic');
        doc.text(isEn ? "(Visa)" : "(Visa)", nextX + boxWidth - 10, y + 21);
        nextX += boxWidth + 3;
      }

      if (signRecipient) {
        doc.setFillColor(250, 250, 250);
        doc.rect(nextX, y, boxWidth, 24, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        const signRec = isEn ? "THE RECIPIENT" : "LE BÉNÉFICIAIRE";
        doc.text(signRec, nextX + 2, y + 4);
        doc.text(isEn ? "Discharge and certification" : "Décharge et Certification", nextX + 2, y + 7);
        doc.setFont('helvetica', 'italic');
        doc.text(isEn ? "(Sign-off)" : "(Émargement)", nextX + boxWidth - 18, y + 21);
      }
    }

    // Footnotes disclaimer
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(156, 163, 175);
    const certifiedFooterLabel = isEn
      ? `Blank document template generated: ${new Date().toLocaleString('en-US')} • PASMA-SYS PTA Educational Platform • ISO certified`
      : `Modèle vierge généré le : ${new Date().toLocaleString('fr-FR')} • Système PASMA-ENT pour Association des Parents d'Élèves • Cachet certifié conforme`;
    doc.text(certifiedFooterLabel, margin, pageHeight - 8);

    const pdfName = `formulaire_vierge_${selectedTemplate}_${referenceNumber || 'standard'}.pdf`.toLowerCase().replace(/[\s\/]/g, '_');
    doc.save(pdfName);

    // Alert toast
    setShowSuccessToast(pdfName);
    setTimeout(() => setShowSuccessToast(null), 5000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm" id="blank_forms_generator_card">
      
      {/* CARD TOP SPLASH COLOURED HEADER */}
      <div className="p-6 bg-slate-950 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <span className="bg-indigo-900/50 text-indigo-300 font-black text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-lg border border-indigo-500/20">
            🏛️ Outils APEE d'Administration
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-1.5 flex items-center gap-2">
            Générateur de Formulaires & Pièces Comptables
          </h2>
          <p className="text-xs text-slate-300 font-medium">
            Générez instantanément des bons, ordres et fiches vierges ou personnalisés conformes aux règles financières du COGE de l'établissement.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="text-[10px] font-black bg-slate-800 hover:bg-slate-700 text-white py-2 px-3 rounded-xl border border-slate-700 cursor-pointer transition flex items-center gap-1 shrink-0 uppercase tracking-wider"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Réinitialiser gabarit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        
        {/* LEFT COLUMN: GABARITS TEMPLATES SELECTOR LIST (lg:col-span-4) */}
        <div className="p-5 lg:col-span-4 bg-slate-50/50 space-y-4">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block select-none">
            1. Sélectionner un format de formulaire
          </span>
          
          <div className="space-y-2.5">
            {Object.entries(templateConfig).map(([key, item]) => {
              const actsSelected = selectedTemplate === key;
              let borderStyle = "border-slate-200 hover:border-slate-300 hover:bg-white";
              let badgeColor = "bg-slate-100 text-slate-600";
              let textTitle = "text-slate-800";
              
              if (actsSelected) {
                if (key === 'command') {
                  borderStyle = "border-indigo-500 bg-indigo-50/25";
                  badgeColor = "bg-indigo-600 text-white";
                  textTitle = "text-indigo-950 font-black";
                } else if (key === 'payment-order') {
                  borderStyle = "border-sky-500 bg-sky-50/25";
                  badgeColor = "bg-sky-600 text-white";
                  textTitle = "text-sky-950 font-black";
                } else if (key === 'refund') {
                  borderStyle = "border-pink-500 bg-pink-50/25";
                  badgeColor = "bg-pink-600 text-white";
                  textTitle = "text-pink-950 font-black";
                } else if (key === 'spend-auth') {
                  borderStyle = "border-emerald-500 bg-emerald-50/25";
                  badgeColor = "bg-emerald-600 text-white";
                  textTitle = "text-emerald-950 font-black";
                } else {
                  borderStyle = "border-amber-500 bg-amber-50/25";
                  badgeColor = "bg-amber-600 text-white";
                  textTitle = "text-amber-950 font-black";
                }
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedTemplate(key as FormTemplateType)}
                  className={`w-full text-left p-3 rounded-2xl border text-xs cursor-pointer transition flex gap-3 items-start select-none ${borderStyle}`}
                >
                  <span className={`shrink-0 text-[10px] font-black font-mono px-2 py-1.5 rounded-lg text-center min-w-10 ${badgeColor}`}>
                    {item.badge}
                  </span>
                  <div className="space-y-1">
                    <h4 className={`text-[12px] font-bold tracking-tight ${textTitle}`}>
                      {item.defaultTitle.replace('DE MATÉRIELS / SERVICES', '').replace(' & DÉCAISSEMENT', '').replace(' DE FRAIS', '')}
                    </h4>
                    <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-indigo-900/10 border border-indigo-200/50 rounded-2xl flex gap-3 text-indigo-950">
            <Info className="h-5 w-5 text-indigo-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] leading-relaxed">
              <span className="font-black uppercase tracking-wider block text-indigo-900">Signatures certifiées :</span>
              Tous nos modèles intègrent des sections d&apos;émargement de décharge conformes au modèle comptable camerounais (APEE + visa direction d&apos;école).
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: CUSTOMIZER FORM EDITOR (lg:col-span-8) */}
        <div className="p-5 lg:col-span-8 space-y-6">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block select-none">
            2. Configurer les options d&apos;édition
          </span>

          {/* MODE SELECTOR */}
          <div className="grid grid-cols-2 gap-3 bg-slate-100 p-1.5 rounded-2xl border select-none">
            <button
              type="button"
              onClick={() => setIsVierge(true)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                isVierge 
                  ? 'bg-white text-slate-900 shadow-tiny ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Document 100% Vierge
            </button>
            <button
              type="button"
              onClick={() => setIsVierge(false)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                !isVierge 
                  ? 'bg-white text-slate-900 shadow-tiny ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="h-4 w-4 text-indigo-650" />
              Saisir & Remplir les données
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Header style */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 uppercase flex items-center gap-1 select-none">
                <input
                  type="checkbox"
                  checked={includeOfficialRibbon}
                  onChange={(e) => setIncludeOfficialRibbon(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500"
                />
                En-tête officielle du Cameroun
              </label>
              <p className="text-[10px] text-gray-400">Inclut &ldquo;RÉPUBLIQUE DU CAMEROUN - Paix Travail Patrie&rdquo; en haut de la fiche.</p>
            </div>

            {/* Custom Form Title */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-black text-slate-500 uppercase">Titre personnalisé du document</label>
              <input
                type="text"
                placeholder={currentConf.defaultTitle}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500 font-medium"
              />
            </div>

            {/* Document Numbering */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-black text-slate-500 uppercase">Numéro / Référence de la pièce</label>
              <input
                type="text"
                placeholder={currentConf.refPlaceholder}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500 font-mono"
              />
            </div>

            {/* Document Date */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-black text-slate-500 uppercase">Date sur le document</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500 focus:border-indigo-550"
              />
            </div>
          </div>

          <div className="border-t border-slate-150 pt-5 space-y-4">
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block select-none">
              3. Détails financiers et bénéficiaire
            </span>

            {/* If Manual / Vierge - select number of lines */}
            {isVierge ? (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800">Nombre de lignes du tableau vierge</h4>
                  <p className="text-[10.5px] text-gray-550">Lignes d&apos;écriture avec pointillés générées dans le tableau principal.</p>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  {[3, 5, 8, 10, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setManualTableRows(num)}
                      className={`h-7 w-8 text-xs font-black rounded-lg transition-all cursor-pointer ${
                        manualTableRows === num
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Custom filled content editor */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-black text-slate-500 uppercase">{currentConf.recipientLabel} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: ETS FOULA & FRERES S.A.R.L"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] font-black text-slate-500 uppercase">Rubrique Budgétaire concernée</label>
                    <input
                      type="text"
                      placeholder="Ex: Frais de photocopies et imprimés"
                      value={fundingLine}
                      onChange={(e) => setFundingLine(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between select-none">
                    <label className="text-[10.5px] font-black text-slate-500 uppercase">Tableau des articles de dépenses</label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-wider"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter une ligne
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-1 grid grid-cols-12 gap-2">
                          <input
                            type="text"
                            placeholder="Description de la dépense..."
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="col-span-6 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500"
                          />
                          <input
                            type="number"
                            placeholder="Qté"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="col-span-2 px-1.5 py-1.5 text-xs text-center border border-slate-200 rounded-lg focus:outline-indigo-500 font-mono"
                          />
                          <input
                            type="number"
                            placeholder="P.U."
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="col-span-2 px-1.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 font-mono"
                          />
                          <div className="col-span-2 px-1.5 py-1.5 text-xs text-right bg-slate-50 rounded-lg border font-black text-slate-700 font-mono flex items-center justify-end">
                            {parseFloat(item.total).toLocaleString() || 0}
                          </div>
                        </div>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg shrink-0 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-3.5 bg-slate-50 border rounded-2xl gap-3 text-slate-800">
                    <span className="text-xs font-bold font-mono">
                      MONTANT TOTAL ESTIMÉ : <strong className="text-indigo-600 font-black text-[13px]">{totalCalculatedAmount.toLocaleString()} FCFA</strong>
                    </span>
                    
                    <input
                      type="text"
                      placeholder="Somme écrite en toutes lettres..."
                      value={referenceInLetters}
                      onChange={(e) => setReferenceInLetters(e.target.value)}
                      className="flex-1 max-w-sm px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-indigo-550 font-serif"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SIGNATURE SELECTION CONFIGURATION */}
          <div className="border-t border-slate-150 pt-5 space-y-3">
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block select-none">
              4. Paramètres d&apos;autorisation (Signatures imprimées)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 select-none">
              <label className="flex items-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border text-[11px] font-bold text-slate-700 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={signPresident}
                  onChange={(e) => setSignPresident(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-650"
                />
                Visa Président
              </label>

              <label className="flex items-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border text-[11px] font-bold text-slate-700 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={signFinManager}
                  onChange={(e) => setSignFinManager(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-650"
                />
                Visa Trésorier
              </label>

              <label className="flex items-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border text-[11px] font-bold text-slate-700 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={signDirector}
                  onChange={(e) => setSignDirector(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-650"
                />
                Visa Directeur (COGE)
              </label>

              <label className="flex items-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border text-[11px] font-bold text-slate-700 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={signRecipient}
                  onChange={(e) => setSignRecipient(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-650"
                />
                Émargement Bénéficiaire
              </label>
            </div>
          </div>

          {/* BOTTOM NOTE FIELD */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-black text-slate-500 uppercase">Notes ou mentions complémentaires (bas de page)</label>
            <input
              type="text"
              placeholder="Ex: Réf Facture proforma, délai de livraison 48h, etc."
              value={footerNotes}
              onChange={(e) => setFooterNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
            />
          </div>

          {/* COMPILATION ACTION CONTAINER */}
          <div className="border-t border-slate-150 pt-5 select-none">
            <button
              type="button"
              onClick={compileFormPDF}
              className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-black rounded-2xl text-xs uppercase tracking-wider cursor-pointer transition shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            >
              <Printer className="h-4.5 w-4.5 text-emerald-400" />
              Générer et Télécharger le document PDF ({isVierge ? 'Vierge' : 'Données Saisies'})
            </button>
          </div>
        </div>

      </div>

      {/* FLOAT SUCCESS TOAST ALERT */}
      <AnimatePresence>
        {showSuccessToast && (
          <div className="fixed bottom-6 right-6 z-50">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 text-white rounded-2xl shadow-xl p-4 flex items-center gap-3 border border-slate-800 ring-1 ring-white/10"
            >
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Download className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-white">Téléchargement Réussi ! ✅</p>
                <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">{showSuccessToast}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
