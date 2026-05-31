import React, { useState } from 'react';
import { Search, UserCheck, MessageSquare, Edit2, Trash2, Printer, X, Phone, MapPin, Tag, Calendar, AlertTriangle, ChevronRight, Notebook, Download } from 'lucide-react';
import { ApeeParent, ApeeStudentLink } from '../../types';
import { jsPDF } from 'jspdf';

interface ApeeSearchProps {
  parents: ApeeParent[];
  onEditParentRequest: (parent: ApeeParent) => void;
  onDeleteParent: (id: string) => Promise<boolean> | void;
  settings?: any;
}

export default function ApeeSearch({ parents, onEditParentRequest, onDeleteParent, settings }: ApeeSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  
  // Active detail modal/card selection
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [parentToDeleteId, setParentToDeleteId] = useState<string | null>(null);

  // Filter list of parents
  const filteredParents = parents.filter(p => {
    // 1. Text Query matches Parent Name, Parent Phone, or Pupil Name
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = query === '' || 
      p.name.toLowerCase().includes(query) ||
      p.phone.includes(query) ||
      p.students.some(s => s.name.toLowerCase().includes(query));

    // 2. Status matches
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    // 3. Class matches
    const matchesClass = classFilter === 'all' || p.students.some(s => s.classRoom === classFilter);

    return matchesQuery && matchesStatus && matchesClass;
  });

  const selectedParent = parents.find(p => p.id === selectedParentId);

  const handleDeleteClick = (id: string) => {
    setParentToDeleteId(id);
  };

  const handleTriggerPrint = () => {
    if (!selectedParent) return;

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
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Aperçu Reçu APEE • Année : ${settings?.schoolYear || "2025/2026"}`, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`PASMA-ENT SYSTEM - Trésorerie d'Établissement`, margin, pageHeight - 8);
      doc.text(`Reçu certifié conforme`, margin + contentWidth - 35, pageHeight - 8);
    };

    drawPageHeaderFooter();

    // Top Official Header
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

    // Amber left stripe
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.rect(margin, y, 4, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(217, 119, 6);
    doc.text(`${(settings?.associationName || "APEE CES EKALI 1").toUpperCase()}`, margin + 6, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("REÇU OFFICIEL DE COTISATION APEE", margin + 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Facturé le : ${new Date(selectedParent.createdAt || Date.now()).toLocaleDateString('fr-FR')} • Émis le : ${new Date().toLocaleDateString('fr-FR')}`, margin + 6, y + 17);

    y += 24;

    // Financial calculations box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL DU EXIGIBLE", margin + 6, y + 7);
    doc.text("TOTAL PAYÉ À CE JOUR", margin + 65, y + 7);
    doc.text("RESTE À RECOUVRER", margin + 125, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${selectedParent.totalDue.toLocaleString()} FCFA`, margin + 6, y + 15);

    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(`${selectedParent.totalPaid.toLocaleString()} FCFA`, margin + 65, y + 15);

    const rest = Math.max(0, selectedParent.totalDue - selectedParent.totalPaid);
    doc.setTextColor(rest > 0 ? 239 : 16, rest > 0 ? 68 : 185, rest > 0 ? 68 : 129); // Red if due, green if paid
    doc.text(`${rest.toLocaleString()} FCFA`, margin + 125, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Montant forfaitaire réglementaire", margin + 6, y + 20);
    doc.text(`Statut dossier : ${selectedParent.status.toUpperCase()}`, margin + 65, y + 20);
    doc.text(rest === 0 ? "Compte entièrement soldé (Merci)" : "Solde restant exigible", margin + 125, y + 20);

    y += 32;

    // Parent details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("COORDONNÉES DU PARENT PAYEUR", margin, y);
    y += 4;
    
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.setFont('helvetica', 'bold');
    doc.text("Nom complet du Parent :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedParent.name, margin + 45, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text("Téléphone :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedParent.phone, margin + 45, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text("Quartier / Adresse habituelle :", margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedParent.address || 'Non spécifié', margin + 45, y);
    y += 6;

    if (selectedParent.email) {
      doc.setFont('helvetica', 'bold');
      doc.text("Adresse de messagerie :", margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedParent.email, margin + 45, y);
      y += 6;
    }

    if (selectedParent.note) {
      doc.setFont('helvetica', 'bold');
      doc.text("Note / Observations :", margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedParent.note, margin + 45, y);
      y += 6;
    }

    y += 6;

    // Pupils table list
    if (selectedParent.students && selectedParent.students.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("PUPILLES (ÉLÈVES À CHARGE ENREGISTRÉS)", margin, y);
      y += 4;
      
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;

      // Table Header Pupils
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("N°", margin + 4, y + 4.5);
      doc.text("Nom de l'élève", margin + 15, y + 4.5);
      doc.text("Classe assignée", margin + 105, y + 4.5);
      doc.text("Date de l'opération", margin + 140, y + 4.5);

      y += 6.5;

      selectedParent.students.forEach((kid, idx) => {
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

      y += 6;
    }

    // Payment history section (Section III)
    if (selectedParent.payments && selectedParent.payments.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("HISTORIQUE DÉTAILLÉ DES TRANSACTIONS ÉMARGÉES", margin, y);
      y += 4;
      
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;

      // Table Header Payments
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Date de Paiement", margin + 4, y + 4.5);
      doc.text("Mode de Versement", margin + 45, y + 4.5);
      doc.text("Référence transaction", margin + 90, y + 4.5);
      doc.text("Montant versé", margin + 175, y + 4.5, { align: 'right' });

      y += 6.5;

      selectedParent.payments.forEach((pay) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);

        doc.text(new Date(pay.date).toLocaleDateString('fr-FR'), margin + 4, y + 4.5);
        doc.text(pay.method || 'Espèces', margin + 45, y + 4.5);
        doc.text(pay.transactionId || 'N/A', margin + 90, y + 4.5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${pay.amount.toLocaleString()} FCFA`, margin + 175, y + 4.5, { align: 'right' });

        y += 6.5;

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, margin + contentWidth, y);
      });

      y += 6;
    }

    // Signatures block
    if (y > pageHeight - 45) {
      doc.addPage();
      drawPageHeaderFooter();
      y = 25;
    }

    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text("Émargement Parent d'Élève", margin + 10, y);
    doc.text("Trésorier de l'Association APEE", margin + contentWidth - 70, y);

    const safeFilename = `bulletin_apee_${selectedParent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
    doc.save(safeFilename);
  };

  return (
    <div id="content_apee_search" className="space-y-6">
      
      {/* Header and description */}
      <div className="border-b border-slate-150 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">🔍 Recherche Parents & Élèves</h2>
        <p className="text-xs text-gray-500 font-medium">
          Moteur de recherche temps réel. Saisir un nom de parent ou d'élève pour retrouver sa fiche et son solde.
        </p>
      </div>

      {/* Filter and input controls */}
      <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-4">
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-505" />
          <input
            type="text"
            placeholder="Rechercher par nom de parent, nom d'élève, ou numéro de téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 shadow-2xs"
          />
        </div>

        {/* multifaceted dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Statut :</span>
            <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 text-[11px] font-semibold">
              {[
                { key: 'all', label: 'Tous' },
                { key: 'soldé', label: 'Soldés' },
                { key: 'partiel', label: 'Partiels' },
                { key: 'retard', label: 'En retard' }
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                    statusFilter === opt.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Classe :</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 text-slate-700 cursor-pointer"
            >
              <option value="all">Toutes les classes</option>
              <option value="6ème">6ème</option>
              <option value="5ème">5ème</option>
              <option value="4ème ALL">4ème ALL</option>
              <option value="4ème ESP">4ème ESP</option>
              <option value="3ème ALL">3ème ALL</option>
              <option value="3ème ESP">3ème ESP</option>
              <option value="2nde">Seconde</option>
              <option value="1ère">Première</option>
              <option value="Tle">Terminale</option>
            </select>
          </div>

        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Results List column */}
        <div className={`lg:col-span-7 space-y-3 ${selectedParentId ? 'hidden md:block' : ''}`}>
          
          <div className="flex justify-between items-center px-1 text-xs text-gray-500 font-bold select-none">
            <span>RÉSULTATS DE LA RECHERCHE</span>
            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md">{filteredParents.length} parents</span>
          </div>

          {filteredParents.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-gray-400 space-y-2">
              <p className="text-xs font-medium">Aucun parent d'élève ne correspond à vos critères de recherche.</p>
              <p className="text-[10px]">Essayez de modifier l'orthographe du nom ou réinitialisez les filtres.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredParents.map((parent) => (
                <div
                  key={parent.id}
                  onClick={() => setSelectedParentId(parent.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center gap-3 ${
                    selectedParentId === parent.id
                      ? 'bg-slate-900 border-slate-800 text-white shadow-xs'
                      : 'bg-white border-slate-150 hover:bg-slate-50 hover:border-slate-350'
                  }`}
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      {parent.status === 'retard' && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" title="En retard de paiement" />
                      )}
                      <span className="text-xs font-bold leading-tight truncate">{parent.name}</span>
                      <span className={`text-[9px] font-extrabold font-mono px-1.5 py-0.5 rounded uppercase shrink-0 ${
                        parent.status === 'soldé' 
                          ? 'bg-emerald-500 text-white' 
                          : (parent.status === 'partiel' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white')
                      }`}>
                        {parent.status}
                      </span>
                    </div>
                    <div className={`text-[10px] truncate ${selectedParentId === parent.id ? 'text-slate-300' : 'text-gray-500'}`}>
                      Pupilles: <strong className="font-semibold">{parent.students.map(s => s.name).join(', ')}</strong>
                    </div>
                    <div className={`text-[9px] font-mono ${selectedParentId === parent.id ? 'text-slate-400' : 'text-gray-400'}`}>
                      Classes: {parent.students.map(s => s.classRoom).join(', ')}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold font-mono">
                        {parent.totalPaid.toLocaleString()} / {parent.totalDue.toLocaleString()}
                      </div>
                      <div className={`text-[9px] font-mono ${selectedParentId === parent.id ? 'text-slate-400' : 'text-gray-400'}`}>
                        FCFA
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Parent Details column */}
        <div className="lg:col-span-5">
          {!selectedParent ? (
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-center text-gray-400 space-y-3 flex/col items-center justify-center min-h-[300px]">
              <AlertTriangle className="h-8 w-8 text-indigo-400 mx-auto" />
              <div>
                <p className="text-xs font-bold text-slate-800">Aucune fiche parent sélectionnée</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-xs mx-auto">
                  Cliquez sur un parent de la liste de gauche pour afficher son historique de cotisations, ré-imprimer son reçu et envoyer des rappels.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm relative">
              
              {/* Close detail button for mobile devices */}
              <button
                onClick={() => setSelectedParentId(null)}
                className="absolute top-4 right-4 p-1 rounded-lg border hover:bg-slate-50 text-slate-600 md:hidden cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-slate-900 leading-tight">{selectedParent.name}</h3>
                  <span className={`text-[9px] font-extrabold uppercase font-mono px-1.5 py-0.5 rounded ${
                    selectedParent.status === 'soldé' 
                      ? 'bg-emerald-500 text-white' 
                      : (selectedParent.status === 'partiel' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white')
                  }`}>
                    {selectedParent.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-mono">ID: {selectedParent.id}</p>
              </div>

              {/* Personal details table */}
              <div className="bg-slate-50/50 rounded-xl p-3 space-y-2 border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span><strong>Téléphone :</strong> {selectedParent.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span><strong>Adresse / Résidence :</strong> {selectedParent.address || 'Non spécifiée'}</span>
                </div>
              </div>

              {/* Pupils listed */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1 border-b border-slate-100 pb-1">
                  <Notebook className="h-3.5 w-3.5 text-emerald-500" /> Élèves inscrits / Classes
                </h4>
                <div className="space-y-1.5">
                  {selectedParent.students.map((student, idx) => (
                    <div key={idx} className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-xs flex justify-between items-center font-medium text-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold">{student.name}</span>
                        {student.dateOperation && (
                          <span className="text-[10px] text-gray-500 mt-0.5">
                            📅 Opération : {new Date(student.dateOperation).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
                          </span>
                        )}
                      </div>
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono">{student.classRoom}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transaction payment list */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1 border-b border-slate-100 pb-1">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" /> Historique Financier
                </h4>
                {selectedParent.payments.length === 0 ? (
                  <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded-lg text-center">Aucun versement n'a encore été enregistré pour ce parent.</p>
                ) : (
                  <div className="space-y-1.5 font-mono max-h-40 overflow-y-auto">
                    {selectedParent.payments.map((p, idx) => (
                      <div key={p.id || idx} className="bg-white border rounded-lg p-2 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-extrabold text-slate-850 flex items-center gap-1.5">
                            <span>{p.amount.toLocaleString()} FCFA</span>
                            <span className="text-[8px] font-sans font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {p.method || 'Espèces'}
                            </span>
                          </div>
                          <div className="text-[9px] text-gray-400 mt-0.5">
                            {p.date} {p.note && `(${p.note})`}
                            {p.transactionId && (
                              <span className="ml-1 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-700 bg-indigo-50 rounded">
                                TX: {p.transactionId} ({p.provider || 'N/A'})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 font-sans">Versement #{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dues breakdown statistics panel */}
              <div className="bg-slate-900 text-white rounded-xl p-3.5 font-mono text-xs space-y-1 border border-slate-850">
                <div className="flex justify-between">
                  <span className="text-slate-400">Exigible global :</span>
                  <span>{selectedParent.totalDue.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payé cumulé :</span>
                  <span className="text-emerald-400">{selectedParent.totalPaid.toLocaleString()} FCFA</span>
                </div>
                <hr className="border-slate-800 my-1" />
                <div className="flex justify-between text-sm font-bold">
                  <span>Reste à payer :</span>
                  <span className={selectedParent.totalDue - selectedParent.totalPaid > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {Math.max(0, selectedParent.totalDue - selectedParent.totalPaid).toLocaleString()} FCFA
                  </span>
                </div>
              </div>

              {selectedParent.note && (
                <div className="bg-amber-50 rounded-xl p-3 text-[11px] text-amber-900 border border-amber-200">
                  <strong>Notes :</strong> {selectedParent.note}
                </div>
              )}

              {/* Bottom quick actions bar */}
              <div className="grid grid-cols-2 gap-2 border-t pt-3">
                <button
                  onClick={() => onEditParentRequest(selectedParent)}
                  disabled={isDeleting}
                  className={`px-2.5 py-1.5 text-xs font-semibold border rounded-lg flex items-center justify-center gap-1 transition select-none ${
                    isDeleting
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-slate-105 hover:bg-slate-150 text-slate-700 cursor-pointer'
                  }`}
                  title="Modifier la fiche parent"
                >
                  <Edit2 className="h-3.5 w-3.5 text-slate-700" /> Modifier
                </button>

                <button
                  onClick={() => handleDeleteClick(selectedParent.id)}
                  disabled={isDeleting}
                  className={`px-2.5 py-1.5 text-xs font-semibold border rounded-lg flex items-center justify-center gap-1 transition select-none ${
                    isDeleting
                      ? 'bg-red-50 text-red-400 border-red-100 cursor-not-allowed'
                      : 'bg-red-50 text-red-650 hover:bg-red-100 border-red-200 cursor-pointer'
                  }`}
                  title="Supprimer la fiche parent"
                >
                  {isDeleting ? (
                    <>
                      <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-red-600 border-t-transparent rounded-full" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" /> Supprimer
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={handleTriggerPrint}
                className="w-full mt-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl py-2.5 text-xs uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer transition shadow-xs"
                title="Générer et télécharger un reçu de cotisation APEE officiel au format PDF"
              >
                <Download className="h-4 w-4 text-amber-300" /> Télécharger Reçu (PDF)
              </button>

            </div>
          )}
        </div>

      </div>

      {/* Custom Confirmation Modal */}
      {parentToDeleteId && (() => {
        const parentToDeleteObj = parents.find(p => p.id === parentToDeleteId);
        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] no-print">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in duration-200">
              {/* Header warning zone */}
              <div className="bg-red-50 p-6 flex flex-col items-center gap-3 text-center border-b border-red-100 shrink-0">
                <div className="p-3 bg-red-100 text-red-655 rounded-full animate-pulse">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-900 tracking-tight">Suppression Définitive</h3>
                  <p className="text-xs text-red-600 mt-1">Cette action est irréversible et effacera toutes les données liées.</p>
                </div>
              </div>
              
              {/* Body details info */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0">
                <p className="text-sm text-slate-650 leading-relaxed mb-4">
                  Vous êtes sur le point de supprimer de manière permanente le parent d'élève suivant :
                </p>
                
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 mb-4">
                  <div className="font-bold text-sm text-slate-900">{parentToDeleteObj?.name}</div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {parentToDeleteObj?.phone || 'Téléphone non indiqué'}
                  </div>
                  {parentToDeleteObj?.students && parentToDeleteObj.students.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Élèves associés :</div>
                      <div className="space-y-1.5">
                        {parentToDeleteObj.students.map((s, idx) => (
                          <div key={idx} className="text-xs text-slate-700 flex justify-between items-center">
                            <span className="font-medium">• {s.name}</span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">{s.classRoom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-slate-655 flex items-start gap-2 bg-amber-50 text-amber-850 p-3.5 rounded-xl border border-amber-200">
                  <span className="shrink-0 mt-0.5 font-bold">⚠️ Important:</span>
                  <span>L'historique des cotisations correspondantes, les reçus d'impressions PDF et toutes les traces financières de ce compte seront supprimés.</span>
                </div>
              </div>
              
              {/* Footer action buttons */}
              <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setParentToDeleteId(null)}
                  disabled={isDeleting}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer transition select-none"
                >
                  Annuler la suppression
                </button>
                
                <button
                  type="button"
                  onClick={async () => {
                    if (!parentToDeleteId) return;
                    setIsDeleting(true);
                    try {
                      // CRITICAL REFACTOR: The deleteDoc / batch.delete operations in App.tsx / apeeDb.ts
                      // are triggered exclusively here, only after this custom confirmation dialog resolves to true
                      // (when the user explicitly clicks this 'Confirmer la suppression' button).
                      const success = await onDeleteParent(parentToDeleteId);
                      if (success !== false) {
                        if (selectedParentId === parentToDeleteId) {
                          setSelectedParentId(null);
                        }
                        setParentToDeleteId(null);
                      }
                    } catch (err) {
                      console.error("Erreur de suppression du parent d'élève:", err);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-xl cursor-pointer transition select-none flex items-center justify-center gap-1.5 min-w-[130px]"
                >
                  {isDeleting ? (
                    <>
                      <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5 text-white shrink-0" />
                      Confirmer la suppression
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
