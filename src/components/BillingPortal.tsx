import React, { useState } from 'react';
import { Invoice, Student } from '../types';
import { CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, X, Landmark, Receipt, QrCode, Smartphone, Search, Download, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import PaymentMethodSelector from './PaymentMethodSelector';

interface BillingPortalProps {
  invoices: Invoice[];
  onUpdateInvoice: (updated: Invoice) => void;
  parentPhone?: string;
  students?: Student[];
  portalUserRole?: 'manager' | 'parent' | null;
  filteredStudents?: Student[];
}

export default function BillingPortal({ 
  invoices, 
  onUpdateInvoice, 
  parentPhone, 
  students,
  portalUserRole,
  filteredStudents
}: BillingPortalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  // States for Receipt Retrieval
  const [searchRefId, setSearchRefId] = useState('');
  const [searchResult, setSearchResult] = useState<Invoice | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [searchType, setSearchType] = useState<'not_found' | 'paid' | 'unpaid' | null>(null);

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

    const drawPageHeaderFooter = () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Reçu de Paiement Électronique • Réf : ${inv.id.toUpperCase()}`, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text(`Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')} • PASMA-SYS`, margin, pageHeight - 8);
    };

    drawPageHeaderFooter();

    // Republic of Cameroon Official alignment
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

    // Title Title Block with Green accent (since it is paid)
    doc.setFillColor(13, 148, 136); // Teal 650
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("QUITTANCE DE PAIEMENT & REÇU DE RÈGLEMENT ACQUITTE", margin + 6, y + 9);

    y += 20;

    // Transaction Meta Block
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 26, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 26, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`RÉFÉRENCE UNIQUE DE TRANSACTION : ${inv.id.toUpperCase()}`, margin + 6, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date de versement : ${inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, margin + 6, y + 13);
    doc.text(`Canal de paiement : Orange Money / MTN MoMo / Carte Bancaire`, margin + 6, y + 18);

    doc.line(margin + 90, y + 3, margin + 90, y + 23);

    // Right meta column
    doc.setFont('helvetica', 'bold');
    doc.text("STATION DE RECEPTION", margin + 95, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text("CES d'EKALI I - Trésorerie Générale APEE", margin + 95, y + 13);
    doc.text("Mbankomo, District de la Mefou-et-Akono, Cameroun", margin + 95, y + 18);

    y += 32;

    // Payer / Student Info
    const relatedStudent = students?.find(s => s.id === inv.studentId);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("DÉTAILS COMPTABLES DU CONTRIBUABLE & BÉNÉFICIAIRE", margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Élève bénéficiaire :", margin + 6, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(relatedStudent ? relatedStudent.name.toUpperCase() : "ÉLÈVE INSCRIT", margin + 45, y);

    y += 6;
    doc.setFont('helvetica', 'semibold');
    doc.setTextColor(71, 85, 105);
    doc.text("Classe administrative :", margin + 6, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(relatedStudent ? `${relatedStudent.grade} ${relatedStudent.classRoom}` : "Néant / Tous niveaux", margin + 45, y);

    y += 6;
    doc.setFont('helvetica', 'semibold');
    doc.setTextColor(71, 85, 105);
    doc.text("Identificateur Parent :", margin + 6, y);
    doc.setFont('helvetica', 'normal');
    doc.text(parentPhone ? `${parentPhone}` : "Parent d'Élève Enregistré", margin + 45, y);

    y += 12;

    // Invoice Itemized Details Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("VENTILATION FINANCIÈRE DE LA COTISATION", margin, y);
    y += 4;
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    // Table Header
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Libellé de la prestation", margin + 5, y + 4.5);
    doc.text("Montant (FCFA)", margin + 110, y + 4.5, { align: 'right' });
    doc.text("Montant (EUR)", margin + 145, y + 4.5, { align: 'right' });
    doc.text("Statut", margin + contentWidth - 5, y + 4.5, { align: 'right' });

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
    doc.setTextColor(16, 185, 129); // Green emerald
    doc.text("RÉGLÉ / VALIDÉ", margin + contentWidth - 5, y + 7.5, { align: 'right' });

    y += 24;

    // Certification and Signature
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 8;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Certification comptable : Cet acquit de paiement numérique remplace tout reçu manuel pré-édité.", margin, y);
    y += 4;
    doc.text("Cette quittance vaut reçu libératoire des obligations financières correspondantes.", margin, y);

    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("SERVICES FINANCIERS PORTAIL", margin + 6, y);
    doc.text("L'AGENCE COMPTABLE DE L'APEE", margin + (contentWidth / 2) + 6, y);

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("(Preuve d'authentification par certificat)", margin + 6, y);
    doc.text("(Cachet officiel de raccordement)", margin + (contentWidth / 2) + 6, y);

    doc.save(`recu_paiement_${inv.id.toLowerCase()}.pdf`);
  };

  // Helper to format currency and fetch student name
  const student = payingInvoice ? students?.find(s => s.id === payingInvoice.studentId) : null;
  const studentName = student ? student.name : "Élève de l'établissement";
  const studentInfo = student ? `${student.grade} - ${student.classRoom}` : "";

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
      inv.studentId === 'apee_ces_ekali_1' ||
      inv.studentId === 'apee_expense' ||
      inv.studentId === 'apee_settings' ||
      inv.id.endsWith('_settings')
    ) {
      return false;
    }
    // If the active role is parent and filteredStudents list is available, restrict to matching active pupils
    if (portalUserRole === 'parent' && filteredStudents) {
      return filteredStudents.some(s => s.id === inv.studentId);
    }
    return true;
  });

  // Filter invoices for tabs
  const filteredInvoices = studentInvoices.filter(inv => {
    if (activeTab === 'unpaid') return inv.status === 'Unpaid' || inv.status === 'Overdue';
    if (activeTab === 'paid') return inv.status === 'Paid';
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
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <Landmark className="h-5 w-5 text-indigo-600" />
            Régie Financière & Facturation
          </h2>
          <p className="text-sm text-gray-500">
            Paiement sécurisé en ligne des frais de scolarité, de cantine, d'APEE et d'activités périscolaires.
          </p>
        </div>

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
                <h3 className="font-bold text-gray-900 text-sm">{inv.title}</h3>
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

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="text-base font-black text-indigo-750 font-mono">
                    {formatAmountTtc(inv.amount).fcfa}
                  </div>
                  <span className="text-[10px] text-gray-400 block">
                    soit {formatAmountTtc(inv.amount).euro} (TTC)
                  </span>
                </div>
                {inv.status !== 'Paid' && (
                  <button
                    onClick={() => startPayment(inv)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer hover:bg-indigo-700 transition"
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Payer ma dette
                  </button>
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
      </AnimatePresence>
    </div>
  );
}
