import React, { useState, useEffect, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  Eye, 
  Layout, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  CheckSquare, 
  Palette, 
  Copy, 
  Share2, 
  Sliders, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Check, 
  GraduationCap, 
  User, 
  BookOpen, 
  School,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Homework, Student, ApeeSettings } from '../types';

export type PdfThemeKey = 'indigo' | 'emerald' | 'slate' | 'crimson' | 'amber';

interface HomeworkPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeworks: Homework[];
  filteredHomeworks: Homework[];
  activeStudent?: Student;
  settings?: ApeeSettings;
  language?: string;
}

// Color palettes for PDF theme branding
const THEME_PRESETS: Record<PdfThemeKey, {
  nameFr: string;
  nameEn: string;
  primaryNavy: [number, number, number];
  accent: [number, number, number];
  accentHex: string;
  bgBadge: string;
  borderBadge: string;
  textBadge: string;
}> = {
  indigo: {
    nameFr: 'Indigo Élite',
    nameEn: 'Elite Indigo',
    primaryNavy: [30, 41, 59], // slate-900
    accent: [79, 70, 229], // indigo-600
    accentHex: '#4f46e5',
    bgBadge: 'bg-indigo-50 dark:bg-indigo-950/50',
    borderBadge: 'border-indigo-200 dark:border-indigo-800',
    textBadge: 'text-indigo-700 dark:text-indigo-300'
  },
  emerald: {
    nameFr: 'Émeraude Scolaire',
    nameEn: 'School Emerald',
    primaryNavy: [6, 78, 59], // emerald-900
    accent: [16, 185, 129], // emerald-600
    accentHex: '#10b981',
    bgBadge: 'bg-emerald-50 dark:bg-emerald-950/50',
    borderBadge: 'border-emerald-200 dark:border-emerald-800',
    textBadge: 'text-emerald-700 dark:text-emerald-300'
  },
  slate: {
    nameFr: 'Ardoise Classique',
    nameEn: 'Classic Slate',
    primaryNavy: [15, 23, 42], // slate-950
    accent: [71, 85, 105], // slate-600
    accentHex: '#475569',
    bgBadge: 'bg-slate-100 dark:bg-slate-800',
    borderBadge: 'border-slate-300 dark:border-slate-700',
    textBadge: 'text-slate-700 dark:text-slate-200'
  },
  crimson: {
    nameFr: 'Rubis Distinction',
    nameEn: 'Distinction Crimson',
    primaryNavy: [136, 19, 55], // rose-900
    accent: [225, 29, 72], // rose-600
    accentHex: '#e11d48',
    bgBadge: 'bg-rose-50 dark:bg-rose-950/50',
    borderBadge: 'border-rose-200 dark:border-rose-800',
    textBadge: 'text-rose-700 dark:text-rose-300'
  },
  amber: {
    nameFr: 'Ambre Académique',
    nameEn: 'Academic Amber',
    primaryNavy: [120, 53, 15], // amber-900
    accent: [217, 119, 6], // amber-600
    accentHex: '#d97706',
    bgBadge: 'bg-amber-50 dark:bg-amber-950/50',
    borderBadge: 'border-amber-200 dark:border-amber-800',
    textBadge: 'text-amber-700 dark:text-amber-300'
  }
};

/**
 * Builds and returns a jsPDF document for the homework summary
 */
export function buildHomeworkJsPdfDoc({
  targetList,
  exportScope,
  exportDetailMode,
  exportIncludeParentVisa,
  exportCustomNotes,
  pdfTheme,
  activeStudent,
  settings,
  isEn
}: {
  targetList: Homework[];
  exportScope: 'displayed' | 'all' | 'pending' | 'completed';
  exportDetailMode: 'detailed' | 'compact';
  exportIncludeParentVisa: boolean;
  exportCustomNotes: string;
  pdfTheme: PdfThemeKey;
  activeStudent?: Student;
  settings?: ApeeSettings;
  isEn: boolean;
}): jsPDF {
  // Sort chronological by due date
  const sortedList = [...targetList].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182mm

  const themeConfig = THEME_PRESETS[pdfTheme] || THEME_PRESETS.indigo;
  const primaryNavy = themeConfig.primaryNavy;
  const accentColor = themeConfig.accent;
  const emeraldAccent: [number, number, number] = [16, 185, 129];
  const roseAccent: [number, number, number] = [225, 29, 72];
  const amberAccent: [number, number, number] = [217, 119, 6];
  const lightCardBg: [number, number, number] = [248, 250, 252];
  const borderGrey: [number, number, number] = [226, 232, 240];

  let y = 14;

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Top decorative accent strip
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 34, pageWidth, 2, 'F');

  // School Name / Association Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  const schoolTitle = (settings?.associationName || "PASMA-SYS - ÉTABLISSEMENT SCOLAIRE").toUpperCase();
  doc.text(schoolTitle, marginX, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    isEn 
      ? "OFFICIAL HOMEWORK & ASSIGNMENT SUMMARY REPORT FOR PARENTS" 
      : "CAHIER DE TEXTES & SYNTHÈSE DES DEVOIRS DE MAISON POUR LES PARENTS", 
    marginX, 
    19
  );

  doc.setFontSize(8);
  const schoolYearStr = settings?.schoolYear ? `Année Scolaire : ${settings.schoolYear}` : `Année Académique en cours`;
  const exportDateStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const exportTimeStr = new Date().toLocaleTimeString(isEn ? 'en-US' : 'fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`${schoolYearStr}  |  Édité le : ${exportDateStr} à ${exportTimeStr}`, marginX, 26);

  // Student & Class Identity Information Box
  y = 42;
  doc.setFillColor(lightCardBg[0], lightCardBg[1], lightCardBg[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, y, contentWidth, 24, 2, 2, 'FD');

  // Identity Grid - Left Column
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.setFont('helvetica', 'bold');
  doc.text(isEn ? "STUDENT :" : "ÉLÈVE :", marginX + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(activeStudent?.name || (isEn ? "All Students / Class Group" : "Groupe Classe / Tous les élèves"), marginX + 28, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isEn ? "CLASS :" : "CLASSE :", marginX + 4, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(activeStudent?.classRoom || activeStudent?.grade || (isEn ? "General" : "Générale"), marginX + 28, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isEn ? "TEACHER :" : "ENSEIGNANT :", marginX + 4, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(activeStudent?.teacherName || settings?.pedManagerName || (isEn ? "Teaching Staff" : "Corps Enseignant"), marginX + 28, y + 18);

  // Identity Grid - Right Column
  const rightColX = marginX + 96;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isEn ? "PARENT / GUARDIAN :" : "PARENT / TUTEUR :", rightColX, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text((activeStudent as any)?.parentName || "Parent d'Élève", rightColX + 38, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isEn ? "TELEPHONE :" : "TÉLÉPHONE :", rightColX, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text((activeStudent as any)?.parentPhone || settings?.directorPhone || "N/A", rightColX + 38, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isEn ? "SCOPE :" : "PÉRIMÈTRE :", rightColX, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  const scopeLabel = 
    exportScope === 'pending' ? (isEn ? "Assignments To Do Only" : "Devoirs en cours / À faire uniquement") :
    exportScope === 'completed' ? (isEn ? "Completed Assignments" : "Devoirs terminés") :
    exportScope === 'displayed' ? (isEn ? `Active View (${sortedList.length} items)` : `Vue active (${sortedList.length} devoirs)`) :
    (isEn ? `Full Assignment History (${sortedList.length})` : `Tous les devoirs (${sortedList.length})`);
  doc.text(scopeLabel, rightColX + 38, y + 18);

  // Stats / Executive Metrics Bar
  y = 70;
  const totalCount = sortedList.length;
  const pendingCount = sortedList.filter(h => h.status === 'Pending').length;
  const completedCount = sortedList.filter(h => h.status === 'Completed').length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(marginX, y, contentWidth, 13, 1.5, 1.5, 'F');

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`${isEn ? "TOTAL ASSIGNMENTS" : "TOTAL DEVOIRS"}: ${totalCount}`, marginX + 6, y + 8.5);
  
  doc.setTextColor(roseAccent[0], roseAccent[1], roseAccent[2]);
  doc.text(`${isEn ? "TO DO" : "À FAIRE"}: ${pendingCount}`, marginX + 54, y + 8.5);

  doc.setTextColor(emeraldAccent[0], emeraldAccent[1], emeraldAccent[2]);
  doc.text(`${isEn ? "COMPLETED" : "TERMINÉS"}: ${completedCount}`, marginX + 94, y + 8.5);

  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(`${isEn ? "COMPLETION" : "TAUX AVANCEMENT"}: ${completionRate}%`, marginX + 138, y + 8.5);

  y = 87;

  // Custom Parent Note if provided
  if (exportCustomNotes && exportCustomNotes.trim()) {
    doc.setFillColor(254, 249, 195); // amber-100
    doc.setDrawColor(251, 191, 36); // amber-400
    doc.setLineWidth(0.3);
    const noteLines = doc.splitTextToSize(`CONSIGNE DE L'ÉTABLISSEMENT : ${exportCustomNotes.trim()}`, contentWidth - 8);
    const noteHeight = (noteLines.length * 4) + 6;
    doc.roundedRect(marginX, y, contentWidth, noteHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15);
    doc.setFont('helvetica', 'italic');
    doc.text(noteLines, marginX + 4, y + 4.5);
    y += noteHeight + 4;
  }

  // Section Title
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(isEn ? "DETAILED LIST OF HOMEWORK & EXERCISES" : "DÉTAIL DU CAHIER DE TEXTES & TRAVAUX À EFFECTUER", marginX, y);
  
  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX, y + 2, marginX + 60, y + 2);
  y += 7;

  if (sortedList.length === 0) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "No homework found for this selection." : "Aucun devoir enregistré pour ce périmètre.", marginX, y + 6);
    y += 15;
  } else {
    sortedList.forEach((hw, idx) => {
      const isCompleted = hw.status === 'Completed';
      const isExpired = new Date(hw.dueDate).getTime() < Date.now() && !isCompleted;
      
      const cleanDesc = (hw.description || '')
        .replace(/###/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
      
      const descLines = cleanDesc ? doc.splitTextToSize(cleanDesc, contentWidth - 12) : [];
      
      // Compute item height
      const itemHeight = exportDetailMode === 'detailed' && descLines.length > 0
        ? Math.max(20, 14 + (descLines.length * 3.6))
        : 16;

      // Auto page break with safety margin
      if (y + itemHeight > (pageHeight - 32)) {
        doc.addPage();
        y = 20;
      }

      // Card Background
      doc.setFillColor(isCompleted ? 252 : 255, isCompleted ? 252 : 255, isCompleted ? 252 : 255);
      doc.setDrawColor(isCompleted ? borderGrey[0] : (isExpired ? roseAccent[0] : borderGrey[0]), isCompleted ? borderGrey[1] : (isExpired ? roseAccent[1] : borderGrey[1]), isCompleted ? borderGrey[2] : (isExpired ? roseAccent[2] : borderGrey[2]));
      doc.setLineWidth(0.35);
      doc.roundedRect(marginX, y, contentWidth, itemHeight, 1.5, 1.5, 'FD');

      // Left indicator strip
      doc.setFillColor(isCompleted ? emeraldAccent[0] : (isExpired ? roseAccent[0] : accentColor[0]), isCompleted ? emeraldAccent[1] : (isExpired ? roseAccent[1] : accentColor[1]), isCompleted ? emeraldAccent[2] : (isExpired ? roseAccent[2] : accentColor[2]));
      doc.roundedRect(marginX, y, 3, itemHeight, 1, 1, 'F');

      // Number, Subject badge & Title
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      
      const titleFormatted = `#${idx + 1}  [${hw.subject}]  ${hw.title}`;
      const maxTitleWidth = contentWidth - 65;
      const truncatedTitle = doc.splitTextToSize(titleFormatted, maxTitleWidth)[0] || titleFormatted;
      doc.text(truncatedTitle, marginX + 5.5, y + 5);

      // Due date with status
      const dueDateFormatted = new Date(hw.dueDate + 'T12:00:00').toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
      
      doc.setFontSize(7.5);
      doc.setFont('helvetica', isExpired ? 'bold' : 'normal');
      doc.setTextColor(isExpired ? roseAccent[0] : (isCompleted ? emeraldAccent[0] : 71), isExpired ? roseAccent[1] : (isCompleted ? emeraldAccent[1] : 85), isExpired ? roseAccent[2] : (isCompleted ? emeraldAccent[2] : 105));
      const dueLabel = `${isEn ? "Due:" : "Pour le :"} ${dueDateFormatted} ${isExpired ? "(RETARD)" : ""}`;
      doc.text(dueLabel, marginX + contentWidth - 4 - doc.getTextWidth(dueLabel), y + 5);

      // Status Badge Pill
      const statusText = isCompleted ? (isEn ? "✓ COMPLETED" : "✓ TERMINÉ") : (isEn ? "⏳ À FAIRE" : "⏳ À FAIRE");
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isCompleted ? emeraldAccent[0] : roseAccent[0], isCompleted ? emeraldAccent[1] : roseAccent[1], isCompleted ? emeraldAccent[2] : roseAccent[2]);
      doc.text(statusText, marginX + 5.5, y + 10);

      if (hw.isRecurring) {
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(isEn ? "• RECURRING" : "• SÉRIE RÉCURRENTE", marginX + 28, y + 10);
      }

      // Checkbox for parent manual verification
      doc.setDrawColor(160, 174, 192);
      doc.setLineWidth(0.3);
      doc.rect(marginX + contentWidth - 40, y + 7.5, 3.2, 3.2);
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(isEn ? "Parent visa [  ]" : "Visa parent [  ]", marginX + contentWidth - 35, y + 10);

      // Detailed text
      if (exportDetailMode === 'detailed' && descLines.length > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(descLines, marginX + 5.5, y + 14.5);
      }

      y += itemHeight + 3;
    });
  }

  // Parent Visa & School Signatures Box (at bottom)
  if (exportIncludeParentVisa) {
    if (y + 34 > (pageHeight - 22)) {
      doc.addPage();
      y = 20;
    } else {
      y += 3;
    }

    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.setFillColor(lightCardBg[0], lightCardBg[1], lightCardBg[2]);
    doc.setLineWidth(0.4);

    const boxWidth = (contentWidth - 6) / 2;

    // Left: Parent signature box
    doc.roundedRect(marginX, y, boxWidth, 30, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(isEn ? "PARENT / GUARDIAN VISA & SIGNATURE" : "VISA & SIGNATURE DES PARENTS / TUTEUR", marginX + 4, y + 5);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "Remarks on home work completion:" : "Observations sur le travail à domicile :", marginX + 4, y + 10);
    doc.text("Date : ....................................", marginX + 4, y + 25);
    doc.text("Signature :", marginX + boxWidth - 28, y + 25);

    // Right: School / Teacher signature box
    doc.roundedRect(marginX + boxWidth + 6, y, boxWidth, 30, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(isEn ? "SCHOOL / PEDAGOGIC VALIDATION" : "VISA DIRECTION / RESPONSABLE PÉDAGOGIQUE", marginX + boxWidth + 10, y + 5);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? "Teacher feedback & official stamp:" : "Appréciation pédagogique & Cachet officiel :", marginX + boxWidth + 10, y + 10);
    doc.text("Date : ....................................", marginX + boxWidth + 10, y + 25);
    doc.text("Cachet / Visa :", marginX + boxWidth + 6 + boxWidth - 32, y + 25);

    y += 34;
  }

  // Footer for all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    
    // Bottom separator line
    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 11, marginX + contentWidth, pageHeight - 11);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    
    const footerSchool = settings?.associationName || "PASMA-SYS";
    const footerPhone = settings?.directorPhone || settings?.pedManagerPhone ? ` | Tél: ${settings.directorPhone || settings.pedManagerPhone}` : "";
    doc.text(`${footerSchool}${footerPhone} - Document Officiel de Suivi Pédagogique`, marginX, pageHeight - 7);

    const pageNumText = `Page ${p} / ${totalPages}`;
    doc.text(pageNumText, marginX + contentWidth - doc.getTextWidth(pageNumText), pageHeight - 7);
  }

  return doc;
}

export default function HomeworkPdfPreviewModal({
  isOpen,
  onClose,
  homeworks,
  filteredHomeworks,
  activeStudent,
  settings,
  language = 'fr'
}: HomeworkPdfPreviewModalProps) {
  const isEn = language === 'en';

  // Config States
  const [exportScope, setExportScope] = useState<'displayed' | 'all' | 'pending' | 'completed'>('displayed');
  const [exportDetailMode, setExportDetailMode] = useState<'detailed' | 'compact'>('detailed');
  const [exportIncludeParentVisa, setExportIncludeParentVisa] = useState(true);
  const [exportCustomNotes, setExportCustomNotes] = useState('');
  const [pdfTheme, setPdfTheme] = useState<PdfThemeKey>('indigo');
  const [previewTab, setPreviewTab] = useState<'interactive_pdf' | 'paper_sheet'>('interactive_pdf');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Live PDF preview Blob URL
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const generatedDocRef = useRef<jsPDF | null>(null);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Compute selected list
  const targetList = useMemo(() => {
    let list: Homework[] = [];
    if (exportScope === 'displayed') {
      list = filteredHomeworks;
    } else if (exportScope === 'pending') {
      list = homeworks.filter(h => h.status === 'Pending');
    } else if (exportScope === 'completed') {
      list = homeworks.filter(h => h.status === 'Completed');
    } else {
      list = homeworks;
    }
    return [...list].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [exportScope, filteredHomeworks, homeworks]);

  // Generate and refresh PDF preview
  const refreshPdfPreview = () => {
    setIsGenerating(true);
    try {
      const doc = buildHomeworkJsPdfDoc({
        targetList,
        exportScope,
        exportDetailMode,
        exportIncludeParentVisa,
        exportCustomNotes,
        pdfTheme,
        activeStudent,
        settings,
        isEn
      });

      generatedDocRef.current = doc;
      const blob = doc.output('blob');
      const newUrl = URL.createObjectURL(blob);

      // Clean old url
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }

      setPdfBlobUrl(newUrl);
    } catch (err) {
      console.error("Failed to generate preview PDF:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Re-run whenever options change or modal opens
  useEffect(() => {
    if (isOpen) {
      refreshPdfPreview();
    }
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [isOpen, exportScope, exportDetailMode, exportIncludeParentVisa, exportCustomNotes, pdfTheme, targetList]);

  if (!isOpen) return null;

  // Stats calculation
  const totalCount = targetList.length;
  const pendingCount = targetList.filter(h => h.status === 'Pending').length;
  const completedCount = targetList.filter(h => h.status === 'Completed').length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  // Handle Download action
  const handleDownload = () => {
    try {
      const doc = generatedDocRef.current || buildHomeworkJsPdfDoc({
        targetList,
        exportScope,
        exportDetailMode,
        exportIncludeParentVisa,
        exportCustomNotes,
        pdfTheme,
        activeStudent,
        settings,
        isEn
      });

      const cleanStudentName = (activeStudent?.name || "Classe").replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Devoirs_${cleanStudentName}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Error saving PDF:", err);
    }
  };

  // Handle direct print action
  const handleDirectPrint = () => {
    if (pdfBlobUrl) {
      const printWindow = window.open(pdfBlobUrl);
      if (printWindow) {
        printWindow.focus();
      } else {
        window.print();
      }
    } else {
      window.print();
    }
  };

  // Handle copy summary text
  const handleCopyTextSummary = () => {
    const lines = [
      `📚 ${settings?.associationName || "Établissement Scolaire"} - Synthèse des Devoirs`,
      `👤 Élève : ${activeStudent?.name || "Tous"} (${activeStudent?.classRoom || "Générale"})`,
      `📅 Édité le : ${new Date().toLocaleDateString('fr-FR')}`,
      `📊 Total : ${totalCount} | À Faire : ${pendingCount} | Terminés : ${completedCount} (${completionRate}%)`,
      '',
      '--- LISTE DES DEVOIRS ---'
    ];

    targetList.forEach((hw, i) => {
      lines.push(
        `${i + 1}. [${hw.subject}] ${hw.title} - Pour le ${new Date(hw.dueDate).toLocaleDateString('fr-FR')} (${hw.status === 'Completed' ? '✓ Terminé' : '⏳ À faire'})`
      );
    });

    if (exportCustomNotes.trim()) {
      lines.push('', `💡 Note : ${exportCustomNotes.trim()}`);
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'w-full h-full max-w-none rounded-none' 
            : 'w-full max-w-6xl max-h-[92vh] h-[860px]'
        }`}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-850/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                  {isEn ? "Live PDF Preview - Homework Summary" : "Aperçu Direct du Document PDF - Synthèse des Devoirs"}
                </h3>
                <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0 hidden sm:inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {isEn ? "Live Preview Ready" : "Aperçu en direct prêt"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {settings?.associationName || "Établissement Scolaire"} • {activeStudent?.name || "Tous les élèves"} ({activeStudent?.classRoom || "Classe Générale"})
              </p>
            </div>
          </div>

          {/* Action Bar in Header */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyTextSummary}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={isEn ? "Copy text summary" : "Copier le texte de la synthèse"}
            >
              {copiedNotification ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              <span className="hidden md:inline">{copiedNotification ? (isEn ? "Copied!" : "Copié !") : (isEn ? "Copy text" : "Copier texte")}</span>
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={isEn ? "Print document" : "Imprimer le document"}
            >
              <Printer className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">{isEn ? "Print" : "Imprimer"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isEn ? "Download PDF" : "Télécharger PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
              title={isFullscreen ? "Réduire" : "Plein écran"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body: 2 Columns (Controls + Live Preview) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Column: Live Customization & Filters (4 cols on lg) */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-900/40">
            {/* Identity Card */}
            <div className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="truncate flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-indigo-600" />
                  {settings?.associationName || "Pasma-sys Établissement"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-750 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  {settings?.schoolYear || "2025/2026"}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                <span>👤 Élève : <strong>{activeStudent?.name || "Tous"}</strong></span>
                <span>📚 Classe : <strong>{activeStudent?.classRoom || activeStudent?.grade || "Générale"}</strong></span>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>{isEn ? "Homework Scope" : "Périmètre des devoirs"}</span>
                <span className="text-indigo-600 dark:text-indigo-400 text-[10px] font-normal lowercase">{targetList.length} retenus</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setExportScope('displayed')}
                  className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                    exportScope === 'displayed'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{isEn ? "Active View" : "Vue active"}</span>
                    <span className="px-1.5 py-0.2 bg-white dark:bg-slate-700 text-[10px] font-mono font-black rounded border border-slate-200 dark:border-slate-600">
                      {filteredHomeworks.length}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('pending')}
                  className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                    exportScope === 'pending'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{isEn ? "To Do Only" : "À Faire"}</span>
                    <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-mono font-black rounded border border-rose-200 dark:border-rose-800">
                      {homeworks.filter(h => h.status === 'Pending').length}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                    exportScope === 'all'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{isEn ? "All Items" : "Tous les devoirs"}</span>
                    <span className="px-1.5 py-0.2 bg-white dark:bg-slate-700 text-[10px] font-mono font-black rounded border border-slate-200 dark:border-slate-600">
                      {homeworks.length}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('completed')}
                  className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                    exportScope === 'completed'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{isEn ? "Completed" : "Terminés"}</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-black rounded border border-emerald-200 dark:border-emerald-800">
                      {homeworks.filter(h => h.status === 'Completed').length}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Presentation Format */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isEn ? "Layout & Detail Level" : "Niveau de détail"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportDetailMode('detailed')}
                  className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                    exportDetailMode === 'detailed'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">📝 {isEn ? "Detailed" : "Détaillé"}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    {isEn ? "Full texts & questions" : "Consignes & énoncés"}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportDetailMode('compact')}
                  className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                    exportDetailMode === 'compact'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">📊 {isEn ? "Compact" : "Condensé"}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    {isEn ? "Summary table" : "Grille synthétique"}
                  </div>
                </button>
              </div>
            </div>

            {/* School Theme Color Palette */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                <span>{isEn ? "School Branding Palette" : "Palette & Charte Établissement"}</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(THEME_PRESETS) as PdfThemeKey[]).map((themeKey) => {
                  const t = THEME_PRESETS[themeKey];
                  const isSelected = pdfTheme === themeKey;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setPdfTheme(themeKey)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                        isSelected 
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                      title={isEn ? t.nameEn : t.nameFr}
                    >
                      <span 
                        className="h-3.5 w-3.5 rounded-full ring-2 ring-white/50"
                        style={{ backgroundColor: t.accentHex }}
                      />
                      <span className="text-[9px] font-bold truncate max-w-full">
                        {themeKey.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checkbox: Parent Signature Visa */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={exportIncludeParentVisa}
                  onChange={(e) => setExportIncludeParentVisa(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-200 select-none">
                    {isEn ? "Official Parent Visa & School Signature Box" : "Cadre officiel de Visa & Signature Parentale"}
                  </div>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 select-none mt-0.5">
                    {isEn ? "Appends signature and feedback section at document bottom." : "Ajoute les zones d'émargement et d'observation en bas de page."}
                  </p>
                </div>
              </label>
            </div>

            {/* Custom Notes */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                {isEn ? "Instructions / Notes for Parents" : "Consigne ou recommandation pour les parents"}
              </label>
              <textarea
                value={exportCustomNotes}
                onChange={(e) => setExportCustomNotes(e.target.value)}
                rows={2}
                placeholder={isEn ? "e.g. Please check and sign assignments weekly." : "ex: Merci de contrôler les devoirs et de signer chaque fin de semaine."}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-indigo-500 text-slate-850 dark:text-slate-100 resize-none shadow-2xs"
              />
            </div>

            {/* Quick Metrics Recap */}
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-1.5 text-xs text-indigo-950 dark:text-indigo-200">
              <div className="font-bold flex items-center justify-between">
                <span>{isEn ? "Document Stats" : "Statistiques Document"}</span>
                <span>{completionRate}% {isEn ? "Completed" : "Terminés"}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[11px] pt-1">
                <div className="text-center p-1 bg-white/70 dark:bg-slate-800/70 rounded">
                  <div className="font-bold text-slate-800 dark:text-slate-200">{totalCount}</div>
                  <div className="text-[9.5px] text-slate-500">Total</div>
                </div>
                <div className="text-center p-1 bg-rose-50/80 dark:bg-rose-950/40 rounded">
                  <div className="font-bold text-rose-700 dark:text-rose-300">{pendingCount}</div>
                  <div className="text-[9.5px] text-rose-600 dark:text-rose-400">À Faire</div>
                </div>
                <div className="text-center p-1 bg-emerald-50/80 dark:bg-emerald-950/40 rounded">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300">{completedCount}</div>
                  <div className="text-[9.5px] text-emerald-600 dark:text-emerald-400">Terminés</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live PDF Preview Canvas (8 cols on lg) */}
          <div className="lg:col-span-8 flex flex-col bg-slate-200/70 dark:bg-slate-950/70 overflow-hidden relative">
            {/* View Mode Toolbar */}
            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewTab('interactive_pdf')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    previewTab === 'interactive_pdf'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{isEn ? "Live PDF Stream" : "Flux PDF Direct"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('paper_sheet')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    previewTab === 'paper_sheet'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layout className="h-3.5 w-3.5" />
                  <span>{isEn ? "Paper Sheet View" : "Feuille Imprimable"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshPdfPreview}
                  disabled={isGenerating}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title={isEn ? "Refresh preview" : "Actualiser l'aperçu"}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  Format A4 Portrait
                </span>
              </div>
            </div>

            {/* Preview Container */}
            <div className="flex-1 p-3 sm:p-5 overflow-y-auto flex items-center justify-center">
              {previewTab === 'interactive_pdf' ? (
                pdfBlobUrl ? (
                  <iframe
                    src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    title="Live Homework PDF Document Preview"
                    className="w-full h-full min-h-[500px] rounded-xl border border-slate-300 dark:border-slate-750 shadow-lg bg-white"
                  />
                ) : (
                  <div className="text-center py-20 text-slate-500 dark:text-slate-400 space-y-2">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                    <p className="text-xs">{isEn ? "Rendering PDF..." : "Génération de l'aperçu PDF..."}</p>
                  </div>
                )
              ) : (
                /* High Fidelity Visual Paper Sheet Preview */
                <div 
                  className="w-full max-w-2xl bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-5 my-auto text-xs"
                  style={{ minHeight: '650px' }}
                >
                  {/* Paper Header */}
                  <div 
                    className="p-4 rounded-xl text-white space-y-1 shadow-xs"
                    style={{ backgroundColor: THEME_PRESETS[pdfTheme].accentHex }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm uppercase tracking-wide">
                        {settings?.associationName || "PASMA-SYS - ÉTABLISSEMENT SCOLAIRE"}
                      </h4>
                      <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded">
                        {settings?.schoolYear || "2025/2026"}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      {isEn ? "OFFICIAL HOMEWORK SUMMARY REPORT" : "CAHIER DE TEXTES & SYNTHÈSE DES DEVOIRS DE MAISON"}
                    </p>
                  </div>

                  {/* Student Identity Box */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-[11.5px]">
                    <div>
                      <span className="text-slate-500 font-bold">ÉLÈVE :</span>{' '}
                      <strong className="text-slate-900">{activeStudent?.name || "Tous les élèves"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">TUTEUR :</span>{' '}
                      <span className="text-slate-800">{(activeStudent as any)?.parentName || "Parent d'Élève"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">CLASSE :</span>{' '}
                      <span className="text-slate-800">{activeStudent?.classRoom || "Générale"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">ENSEIGNANT :</span>{' '}
                      <span className="text-slate-800">{activeStudent?.teacherName || "Corps Enseignant"}</span>
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div className="p-2.5 bg-slate-100 rounded-xl flex items-center justify-around text-xs font-bold">
                    <span>TOTAL : {totalCount}</span>
                    <span className="text-rose-600">À FAIRE : {pendingCount}</span>
                    <span className="text-emerald-600">TERMINÉS : {completedCount}</span>
                    <span className="text-indigo-600">AVANCEMENT : {completionRate}%</span>
                  </div>

                  {/* Optional Custom Note */}
                  {exportCustomNotes.trim() && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] italic">
                      <strong>CONSIGNE DE L'ÉTABLISSEMENT :</strong> {exportCustomNotes.trim()}
                    </div>
                  )}

                  {/* Homework List Preview */}
                  <div className="space-y-2 pt-1">
                    <h5 className="font-black text-slate-800 text-xs border-b border-slate-200 pb-1">
                      {isEn ? "HOMEWORK & ASSIGNMENTS LIST" : "CAHIER DE TEXTES & TRAVAUX"}
                    </h5>
                    {targetList.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 italic">
                        {isEn ? "No assignments for this selection." : "Aucun devoir pour cette sélection."}
                      </div>
                    ) : (
                      targetList.map((hw, i) => (
                        <div 
                          key={hw.id || i}
                          className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900">
                              #{i + 1} [{hw.subject}] {hw.title}
                            </div>
                            {exportDetailMode === 'detailed' && hw.description && (
                              <p className="text-[11px] text-slate-600 line-clamp-2">
                                {hw.description.replace(/[#*]/g, '')}
                              </p>
                            )}
                            <div className="text-[10px] text-slate-500">
                              Pour le : <strong>{new Date(hw.dueDate).toLocaleDateString('fr-FR')}</strong> • {hw.status === 'Completed' ? '✓ Terminé' : '⏳ À Faire'}
                            </div>
                          </div>
                          <div className="border border-slate-300 rounded px-2 py-1 text-[10px] text-slate-500 shrink-0 select-none">
                            Visa parent [  ]
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Visa Signatures Box */}
                  {exportIncludeParentVisa && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 border border-slate-300 rounded-xl bg-slate-50/50 space-y-6 text-[10px]">
                        <div className="font-bold text-slate-800">VISA & SIGNATURE DES PARENTS</div>
                        <div className="flex justify-between text-slate-500">
                          <span>Date : ..................</span>
                          <span>Signature :</span>
                        </div>
                      </div>
                      <div className="p-3 border border-slate-300 rounded-xl bg-slate-50/50 space-y-6 text-[10px]">
                        <div className="font-bold text-slate-800">VISA DIRECTION / PÉDAGOGIE</div>
                        <div className="flex justify-between text-slate-500">
                          <span>Date : ..................</span>
                          <span>Cachet / Visa :</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="hidden sm:inline">{isEn ? "Document ready for export or printing." : "Document officiel prêt à être téléchargé ou imprimé."}</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">({targetList.length} devoirs)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {isEn ? "Close" : "Fermer"}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-md shadow-indigo-600/25"
            >
              <Download className="h-4 w-4" />
              <span>{isEn ? "Download PDF Summary" : "Télécharger la Synthèse PDF"}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
