import React, { useEffect, useState } from 'react';
import { Student, Grade, Attendance, ApeeSettings } from '../types';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../utils/TranslationContext';
import { 
  X, 
  Printer, 
  Award, 
  Calendar, 
  User, 
  Mail, 
  GraduationCap, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  ListChecks, 
  NotebookPen,
  Download,
  BarChart2,
  TrendingUp,
  Phone
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

interface StudentPrintModalProps {
  student: Student;
  grades: Grade[];
  attendance: Attendance[];
  isOpen: boolean;
  onClose: () => void;
  settings?: ApeeSettings;
}

export default function StudentPrintModal({ student, grades, attendance, isOpen, onClose, settings }: StudentPrintModalProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  
  // Parent Configuration states for PDF visual preview
  const [pdfTheme, setPdfTheme] = useState<'indigo' | 'emerald' | 'crimson' | 'amber' | 'slate'>('indigo');
  const [selectedTerm, setSelectedTerm] = useState<'all' | 't1' | 't2' | 't3'>('all');
  const [showChart, setShowChart] = useState(true);
  const [showAttendance, setShowAttendance] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [parentCustomNotes, setParentCustomNotes] = useState('');

  const [isMounted, setIsMounted] = useState(false);
  const [showPrintToast, setShowPrintToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Disable main window scroll when open
    if (isOpen && student) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  // Theme definition mapping for cohesive premium design
  const themeColors = {
    indigo: {
      primary: [79, 70, 229] as [number, number, number],
      primaryHex: '#4f46e5',
      bgLight: 'bg-indigo-50/50',
      bgSoft: 'bg-indigo-50',
      borderLight: 'border-indigo-100',
      borderAccent: 'border-indigo-200',
      textPrimary: 'text-indigo-600',
      textPrimaryDark: 'text-indigo-950',
      accentFill: 'bg-indigo-50 border-indigo-150 text-indigo-850',
      badge: 'bg-indigo-50 text-indigo-700 border border-indigo-100'
    },
    emerald: {
      primary: [16, 185, 129] as [number, number, number],
      primaryHex: '#10b981',
      bgLight: 'bg-emerald-50/50',
      bgSoft: 'bg-emerald-50',
      borderLight: 'border-emerald-100',
      borderAccent: 'border-emerald-200',
      textPrimary: 'text-emerald-600',
      textPrimaryDark: 'text-emerald-950',
      accentFill: 'bg-emerald-50 border-emerald-150 text-emerald-850',
      badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100'
    },
    crimson: {
      primary: [225, 29, 72] as [number, number, number],
      primaryHex: '#e11d48',
      bgLight: 'bg-rose-50/50',
      bgSoft: 'bg-rose-50',
      borderLight: 'border-rose-100',
      borderAccent: 'border-rose-200',
      textPrimary: 'text-rose-600',
      textPrimaryDark: 'text-rose-950',
      accentFill: 'bg-rose-50 border-rose-150 text-rose-850',
      badge: 'bg-rose-50 text-rose-700 border border-rose-100'
    },
    amber: {
      primary: [217, 119, 6] as [number, number, number],
      primaryHex: '#d97706',
      bgLight: 'bg-amber-50/50',
      bgSoft: 'bg-amber-50',
      borderLight: 'border-amber-100',
      borderAccent: 'border-amber-200',
      textPrimary: 'text-amber-600',
      textPrimaryDark: 'text-amber-950',
      accentFill: 'bg-amber-50 border-amber-150 text-amber-850',
      badge: 'bg-amber-50 text-amber-700 border border-amber-100'
    },
    slate: {
      primary: [71, 85, 105] as [number, number, number],
      primaryHex: '#475569',
      bgLight: 'bg-slate-50',
      bgSoft: 'bg-slate-100/50',
      borderLight: 'border-slate-200',
      borderAccent: 'border-slate-300',
      textPrimary: 'text-slate-600',
      textPrimaryDark: 'text-slate-950',
      accentFill: 'bg-slate-50 border-slate-150 text-slate-850',
      badge: 'bg-slate-100 text-slate-700 border border-slate-200'
    }
  };

  const activeTheme = themeColors[pdfTheme];

  // Filter grades & attendance based on selected academic period
  const filteredGrades = grades.filter(item => {
    if (selectedTerm === 'all') return true;
    const d = new Date(item.date);
    const month = d.getMonth(); // 0 = Jan, 11 = Dec
    if (selectedTerm === 't1') {
      // Sept (8), Oct (9), Nov (10), Dec (11)
      return month >= 8 && month <= 11;
    } else if (selectedTerm === 't2') {
      // Jan (0), Feb (1), Mar (2)
      return month >= 0 && month <= 2;
    } else if (selectedTerm === 't3') {
      // Apr (3), May (4), June (5), July (6), Aug (7)
      return month >= 3 && month <= 7;
    }
    return true;
  });

  const filteredAttendance = attendance.filter(item => {
    if (selectedTerm === 'all') return true;
    const d = new Date(item.date);
    const month = d.getMonth();
    if (selectedTerm === 't1') {
      return month >= 8 && month <= 11;
    } else if (selectedTerm === 't2') {
      return month >= 0 && month <= 2;
    } else if (selectedTerm === 't3') {
      return month >= 3 && month <= 7;
    }
    return true;
  });

  // Find titular teacher for student's classroom in global ApeeSettings
  const foundTeacher = settings?.classTeachers?.find(t => {
    if (!t) return false;
    const classRoomName = (student?.classRoom || '').toLowerCase();
    const tClassRoom = (t?.classRoom || '').toLowerCase();
    return tClassRoom && classRoomName && (
           tClassRoom === classRoomName || 
           classRoomName.includes(tClassRoom) ||
           tClassRoom.includes(classRoomName)
    );
  });

  const teacherName = foundTeacher?.teacherName || student.teacherName || 'Enseignant principal';
  const teacherEmail = foundTeacher?.teacherEmail || student.teacherEmail || '';
  const teacherPhone = foundTeacher?.teacherPhone || '';

  const schoolExtracted = settings?.associationName 
    ? settings.associationName.replace(/^(APEE|A\.P\.E\.E\.|Association des Parents d'élèves de l'|Association des Parents d'élèves du|Association des Parents d'élèves de|Association des Parents d'élèves|Association des Parents du|Association des Parents de|Association des Parents d'|Association des Parents|Association des Parents CES d')\s+/i, '').trim()
    : (isEn ? "CES d'Ekali 1" : "CES d'Ekali 1");

  // 1. Grade stats computations (using filtered grades)
  const totalTests = filteredGrades.length;
  const averagePercentage = totalTests > 0
    ? (filteredGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 100, 0) / totalTests)
    : 0;

  const averageBase20 = totalTests > 0
    ? (filteredGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / totalTests)
    : 0;

  // Grade classification label in French
  const getAppreciation = (avg: number) => {
    if (avg >= 16) return { text: 'Très Bien (Excellent)', color: 'text-emerald-600 border-emerald-200 bg-emerald-50' };
    if (avg >= 14) return { text: 'Bien', color: 'text-indigo-650 border-indigo-200 bg-indigo-50' };
    if (avg >= 12) return { text: 'Assez Bien', color: 'text-blue-600 border-blue-200 bg-blue-50' };
    if (avg >= 10) return { text: 'Passable', color: 'text-amber-600 border-amber-200 bg-amber-50' };
    return { text: 'Insuffisant', color: 'text-rose-600 border-rose-200 bg-rose-50' };
  };

  const apprec = getAppreciation(averageBase20);

  // 2. Attendance Stats computations (using filtered attendance)
  const totalLogs = filteredAttendance.length;
  const presentCount = filteredAttendance.filter(a => a.status === 'Present').length;
  const absentCount = filteredAttendance.filter(a => a.status === 'Absent').length;
  const lateCount = filteredAttendance.filter(a => a.status === 'Late').length;
  const excusedCount = filteredAttendance.filter(a => a.status === 'Excused').length;

  const presenceRate = totalLogs > 0
    ? (((presentCount + excusedCount) / totalLogs) * 100).toFixed(1)
    : '100.0';

  // Group grades by subject to show a consolidated performance per subject inside the report
  const subjectAveragesMap: { [subj: string]: { sumBase20: number; count: number } } = {};
  filteredGrades.forEach(g => {
    const scoreOn20 = (g.score / g.maxScore) * 20;
    if (!subjectAveragesMap[g.subject]) {
      subjectAveragesMap[g.subject] = { sumBase20: 0, count: 0 };
    }
    subjectAveragesMap[g.subject].sumBase20 += scoreOn20;
    subjectAveragesMap[g.subject].count += 1;
  });

  const subjectChartData = Object.keys(subjectAveragesMap).map(subj => {
    const stats = subjectAveragesMap[subj];
    const avg = stats.sumBase20 / stats.count;
    return {
      subject: subj,
      Moyenne: parseFloat(avg.toFixed(2)),
      "Seuil d'Admissibilité": 10
    };
  });

  const handlePrint = () => {
    setToastMessage("Report successfully sent to printer");
    setShowPrintToast(true);
    setTimeout(() => {
      setShowPrintToast(false);
    }, 5500);
    window.print();
  };

  const handleDownloadCSV = () => {
    const escapeCSV = (val: string | number) => {
      const str = String(val === undefined || val === null ? '' : val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows: string[] = [];
    
    // Header
    rows.push('"RAPPORT ACADEMIQUE ET SCOLAIRE - PASMA-SYS"');
    rows.push(`"Date de generation",${escapeCSV(new Date().toLocaleString('fr-FR'))}`);
    rows.push(`"Periode selectionnee",${escapeCSV(selectedTerm === 'all' ? 'Année Complète' : selectedTerm === 't1' ? 'Trimestre 1' : selectedTerm === 't2' ? 'Trimestre 2' : 'Trimestre 3')}`);
    rows.push('');
    
    // Section 1: Student Details
    rows.push('"INFORMATIONS DE L\'ELEVE"');
    rows.push(`"Nom de l'eleve",${escapeCSV(student.name)}`);
    rows.push(`"Date de naissance",${escapeCSV(new Date(student.dob).toLocaleDateString('fr-FR'))}`);
    rows.push(`"Niveau / Classe",${escapeCSV(`${student.grade} - ${student.classRoom}`)}`);
    rows.push(`"Enseignant principal",${escapeCSV(student.teacherName)}`);
    rows.push(`"Email de l'enseignant",${escapeCSV(student.teacherEmail)}`);
    rows.push('');

    // Section 2: Summary Stats
    rows.push('"SYNTHESE DES PERFORMANCES"');
    rows.push(`"Moyenne Generale (/20)",${escapeCSV(totalTests > 0 ? averageBase20.toFixed(2) : '--')}`);
    rows.push(`"Pourcentage de Reussite",${escapeCSV(totalTests > 0 ? `${averagePercentage.toFixed(1)}%` : '--')}`);
    rows.push(`"Appreciation globale",${escapeCSV(totalTests > 0 ? apprec.text : 'Non evalue')}`);
    rows.push(`"Taux de presence globale",${escapeCSV(`${presenceRate}%`)}`);
    rows.push(`"Absences",${escapeCSV(absentCount)}`);
    rows.push(`"Retards",${escapeCSV(lateCount)}`);
    rows.push(`"Justifiees",${escapeCSV(excusedCount)}`);
    rows.push('');

    // Section 3: Grades List
    rows.push('"NOTES ET EVALUATIONS DETALLEES"');
    rows.push('"Matiere","Intitule de l\'examen","Date d\'evaluation","Note","Bareme","Remarques"');
    
    if (filteredGrades.length === 0) {
      rows.push('"Aucune note disponible"');
    } else {
      filteredGrades.forEach(g => {
        rows.push([
          escapeCSV(g.subject),
          escapeCSV(g.examName),
          escapeCSV(new Date(g.date).toLocaleDateString('fr-FR')),
          g.score,
          g.maxScore,
          escapeCSV(g.teacherRemarks || '')
        ].join(','));
      });
    }
    rows.push('');

    // Section 4: Attendance List
    if (showAttendance) {
      rows.push('"REGISTRE DE PRESENCE ET ASSIDUITE"');
      rows.push('"Date","Statut de presence","Remarques & Justifications"');
      
      if (filteredAttendance.length === 0) {
        rows.push('"Aucune donnee de presence"');
      } else {
        filteredAttendance.forEach(att => {
          let statusFr: string = att.status;
          if (att.status === 'Present') statusFr = 'Présent';
          if (att.status === 'Absent') statusFr = 'Absent';
          if (att.status === 'Late') statusFr = 'En Retard';
          if (att.status === 'Excused') statusFr = 'Justifié';

          rows.push([
            escapeCSV(new Date(att.date).toLocaleDateString('fr-FR')),
            escapeCSV(statusFr),
            escapeCSV(att.remarks || '')
          ].join(','));
        });
      }
    }

    // Convert rows and create Download Link
    const csvContent = "\uFEFF" + rows.join('\r\n'); // Add BOM for Excel French accents support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Clean filename
    const safeStudentName = (student?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `bulletin_${safeStudentName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage(isEn ? `Student CSV record for ${student.name} downloaded successfully!` : `Le relevé CSV de l'élève ${student.name} a été téléchargé avec succès !`);
    setShowPrintToast(true);
    setTimeout(() => {
      setShowPrintToast(false);
    }, 4500);
  };

  const handleDownloadPDF = () => {
    setToastMessage(isEn ? "Generating and downloading formatted PDF report card..." : "Génération et téléchargement du bulletin scolaire PDF...");
    setShowPrintToast(true);
    setTimeout(() => {
      setShowPrintToast(false);
    }, 4500);

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

    const activeColor = themeColors[pdfTheme].primary;
    const activeColorHex = themeColors[pdfTheme].primaryHex;

    const checkPageBreak = (heightNeeded: number) => {
      if (y + heightNeeded > pageHeight - 20) {
        doc.addPage();
        drawPageHeaderFooter();
        y = 25; // Reset y to top margin on new page
      }
    };

    const drawPageHeaderFooter = () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const statusTitle = isEn
        ? `Academic Performance Statement - ${student.name} - Class: ${student.grade} ${student.classRoom}`
        : `Bulletin de situation - ${student.name} - Classe : ${student.grade} ${student.classRoom}`;
      doc.text(statusTitle, margin, 9);
    };

    // Republic of Cameroon Official alignment with Motto
    const actCountry = settings?.country || "Cameroun";
    const countryLabel = isEn 
      ? (actCountry === "Cameroun" ? "REPUBLIC OF CAMEROON" : actCountry.toUpperCase())
      : (actCountry === "Cameroun" ? "RÉPUBLIQUE DU CAMEROUN" : actCountry.toUpperCase());
    const yearLabel = isEn ? "Academic Year" : "Année Académique";
    const printedSchoolYear = settings?.schoolYear || "2025/2026";

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

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
      doc.text(`${isEn ? 'School' : 'Établissement'} : ${schoolExtracted.toUpperCase()}`, margin, y + 11.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`${yearLabel} : ${printedSchoolYear}`, margin + contentWidth, y + 11.5, { align: 'right' });
      
      y += 18;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(countryLabel, margin, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
      doc.text(`${isEn ? 'School' : 'Établissement'} : ${schoolExtracted.toUpperCase()}`, margin, y + 8.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`${yearLabel} : ${printedSchoolYear}`, margin + contentWidth, y + 4, { align: 'right' });
      
      y += 15;
    }

    // Elegant accent: Deep custom theme color header bar
    doc.setFillColor(activeColor[0], activeColor[1], activeColor[2]);
    doc.rect(margin, y, 4, 18, 'F');

    // Title text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
    
    const termLabel = selectedTerm === 'all' 
      ? (isEn ? "FULL YEAR" : "ANNÉE COMPLÈTE") 
      : selectedTerm === 't1' 
      ? (isEn ? "1ST TRIMESTER" : "1ER TRIMESTRE") 
      : selectedTerm === 't2' 
      ? (isEn ? "2ND TRIMESTER" : "2ÈME TRIMESTRE") 
      : (isEn ? "3RD TRIMESTER" : "3ÈME TRIMESTRE");

    doc.text(`${isEn ? "PASMA-SYS PORTAL" : "PORTAIL SCOLAIRE PASMA-SYS"} • ${termLabel}`, margin + 6, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(isEn ? "ACADEMIC PROFILE CONFIGURATION & GRADES TRANSCRIPT" : "BILAN DE CONFIGURATION SCOLAIRE & NOTES", margin + 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    const formattedPrintDate = isEn
      ? `Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`
      : `Édité le ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`;
    doc.text(formattedPrintDate, margin + 6, y + 17);

    y += 24;

    // Student & Pedagogical Supervisor Card
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 34, 'FD'); // 34mm height

    // Left block: Student details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(student.name.toUpperCase(), margin + 5, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text(`Né(e) le: ${new Date(student.dob).toLocaleDateString('fr-FR', { dateStyle: 'long' })}`, margin + 5, y + 14);
    doc.text(`Niveau / Classe: ${student.grade} • ${student.classRoom}`, margin + 5, y + 20);
    
    // Status badges or additional key
    doc.setFillColor(238, 242, 255); // Indigo 100
    doc.rect(margin + 5, y + 24, 45, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
    doc.text("ÉLÈVE INSCRIT ET ACTIF", margin + 8, y + 28);

    // Vertical separator line
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.line(margin + 90, y + 4, margin + 90, y + 30);

    // Right block: Supervisor details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text("SUPERVISEUR PÉDAGOGIQUE", margin + 95, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text(`Professeur principal: ${teacherName}`, margin + 95, y + 14);
    if (teacherPhone) {
      doc.text(`Téléphone: ${teacherPhone}`, margin + 95, y + 20);
    } else {
      doc.text(`Téléphone: Non répertorié`, margin + 95, y + 20);
    }
    if (teacherEmail) {
      doc.text(`E-mail: ${teacherEmail}`, margin + 95, y + 26);
    } else {
      doc.text(`E-mail: Non disponible`, margin + 95, y + 26);
    }

    y += 39;

    // KPI widgets side-by-side
    const colWidth = (contentWidth - 6) / 2; // 87mm each

    // Card 1: Rendement Académique (Academic Performance)
    doc.setFillColor(245, 247, 255); // Very soft indigo-tinted background
    doc.setDrawColor(199, 210, 254); // Indigo 200
    doc.rect(margin, y, colWidth, 26, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
    doc.text("RENDEMENT ACADÉMIQUE", margin + 5, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // Slate 900
    const finalAvg = totalTests > 0 ? averageBase20.toFixed(2) : '--';
    doc.text(`${finalAvg} / 20`, margin + 5, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Appréciation: ${totalTests > 0 ? apprec.text : 'Non évalué'}`, margin + 5, y + 22);

    // Card 2: Assiduité (Attendance)
    doc.setFillColor(240, 253, 244); // Very soft mint/green-tinted background
    doc.setDrawColor(187, 247, 208); // Green 200
    doc.rect(margin + colWidth + 6, y, colWidth, 26, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52); // Green 850
    doc.text("TAUX D'ASSIDUITÉ", margin + colWidth + 11, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // Slate 950
    doc.text(`${presenceRate}%`, margin + colWidth + 11, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text(`${presentCount} Prés. | ${lateCount} Ret. | ${absentCount} Abs. | ${excusedCount} Exc.`, margin + colWidth + 11, y + 22);

    y += 32;

    // Averages per Subject (Bilan par Discipline)
    if (showChart && subjectChartData.length > 0) {
      checkPageBreak(35);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text("RÉCAPITULATIF DES MOYENNES PAR DISCIPLINE", margin, y + 5);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 7, margin + contentWidth, y + 7);
      
      y += 10;

      // Table of averages
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(margin, y, contentWidth, 7, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85); // Slate 700
      doc.text("Discipline / Matière", margin + 4, y + 4.5);
      doc.text("Moyenne obtenue", margin + 100, y + 4.5);
      doc.text("Seuil d'admissibilité", margin + 140, y + 4.5);
      
      y += 7;

      subjectChartData.forEach((row, rIdx) => {
        checkPageBreak(7);
        if (rIdx % 2 === 0) {
          doc.setFillColor(248, 250, 252); // Slate 50
          doc.rect(margin, y, contentWidth, 6, 'F');
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(row.subject, margin + 4, y + 4);
        
        const avgVal = row.Moyenne;
        if (avgVal < 10) {
          doc.setTextColor(239, 68, 68); // Red-500
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
          doc.setFont('helvetica', 'bold');
        }
        doc.text(`${avgVal.toFixed(2)} / 20`, margin + 100, y + 4);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text("10.00 / 20", margin + 140, y + 4);
        
        y += 6;
      });
      
      y += 5;
    }

    // Detailed test-by-test report (TABLE DES ÉVALUATIONS DE NOTES)
    checkPageBreak(25);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("TABLEAU DÉTAILLÉ DES ÉVALUATIONS ET EXAMENS", margin, y + 5);
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 7, margin + contentWidth, y + 7);
    
    y += 10;

    // Detailed table headers
    doc.setFillColor(activeColor[0], activeColor[1], activeColor[2]);
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255); // White font
    doc.text("Matière", margin + 3, y + 5);
    doc.text("Examen", margin + 45, y + 5);
    doc.text("Date", margin + 85, y + 5);
    doc.text("Note / Barème", margin + 110, y + 5);
    doc.text("Appréciation & Observations", margin + 135, y + 5);

    y += 8;

    const truncateString = (text: string, maxChars: number) => {
      return text.length > maxChars ? text.substring(0, maxChars - 3) + '...' : text;
    };

    if (filteredGrades.length === 0) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("Aucune note de contrôle enregistrée pour cet élève.", margin + 4, y + 5);
      y += 8;
    } else {
      filteredGrades.forEach((g, gIdx) => {
        checkPageBreak(8);

        if (gIdx % 2 === 0) {
          doc.setFillColor(248, 250, 252); // Slate 50
          doc.rect(margin, y, contentWidth, 7, 'F');
        }

        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(margin, y + 7, margin + contentWidth, y + 7);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42); // Slate 900
        
        doc.text(truncateString(g.subject, 18), margin + 3, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85); // Slate 700
        doc.text(truncateString(g.examName, 20), margin + 45, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text(new Date(g.date).toLocaleDateString('fr-FR'), margin + 85, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.text(`${g.score} / ${g.maxScore}`, margin + 110, y + 4.5);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate 500
        const remarks = g.teacherRemarks || "Aucun commentaire";
        doc.text(truncateString(remarks, 24), margin + 135, y + 4.5);

        y += 7;
      });
    }

    y += 6;

    // Detailed attendance report
    if (showAttendance) {
      checkPageBreak(25);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // Slate 950
      doc.text("RAPPORT DU REGISTRE DE PRÉSENCE ET ASSIDUITÉ", margin, y + 5);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 7, margin + contentWidth, y + 7);
      
      y += 10;

      // Attendance Table Header
      doc.setFillColor(51, 65, 85); // Charcoal / Slate 700 header
      doc.rect(margin, y, contentWidth, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255); // White font
      doc.text("Date du contrôle", margin + 3, y + 5);
      doc.text("Statut de présence", margin + 55, y + 5);
      doc.text("Motif justificatif / Remarques de la vie scolaire", margin + 100, y + 5);

      y += 8;

      if (filteredAttendance.length === 0) {
        checkPageBreak(8);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text("Aucun retard ou absence répertorié au dossier de présence.", margin + 4, y + 5);
        y += 8;
      } else {
        filteredAttendance.forEach((att, attIdx) => {
          checkPageBreak(8);

          if (attIdx % 2 === 0) {
            doc.setFillColor(248, 250, 252); // Slate 50
            doc.rect(margin, y, contentWidth, 7, 'F');
          }

          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.15);
          doc.line(margin, y + 7, margin + contentWidth, y + 7);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42); // Slate 900
          doc.text(new Date(att.date).toLocaleDateString('fr-FR', { dateStyle: 'long' }), margin + 3, y + 4.5);

          let statusFr = 'Présent';
          if (att.status === 'Present') {
            doc.setTextColor(22, 101, 52); // Green
            statusFr = 'Présent';
          } else if (att.status === 'Absent') {
            doc.setTextColor(185, 28, 28); // Red
            statusFr = 'Absent';
          } else if (att.status === 'Late') {
            doc.setTextColor(180, 83, 9); // Amber
            statusFr = 'En Retard';
          } else if (att.status === 'Excused') {
            doc.setTextColor(79, 70, 229); // Indigo
            statusFr = 'Justifié';
          }

          doc.setFont('helvetica', 'bold');
          doc.text(statusFr, margin + 55, y + 4.5);

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139); // Slate 500
          const altRemark = att.remarks || (att.status === 'Present' ? 'Élève ponctuel et assidu' : 'Aucun motif renseigné');
          doc.text(truncateString(altRemark, 42), margin + 100, y + 4.5);

          y += 7;
        });
      }
      y += 6;
    }

    // Custom Parent Remarks Section
    if (parentCustomNotes.trim()) {
      checkPageBreak(30);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("OBSERVATIONS ET REMARQUES DES PARENTS D'ÉLÈVES", margin, y + 5);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 7, margin + contentWidth, y + 7);

      y += 10;

      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(activeColor[0], activeColor[1], activeColor[2]);
      doc.setLineWidth(0.4);
      doc.rect(margin, y, contentWidth, 16, 'FD');

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(truncateString(parentCustomNotes.trim(), 95), margin + 5, y + 6);
      doc.text(parentCustomNotes.trim().length > 95 ? truncateString(parentCustomNotes.trim().substring(95), 95) : "", margin + 5, y + 11);

      y += 22;
    }

    // Administrative signatures block
    if (showSignatures) {
      checkPageBreak(40);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 5, margin + contentWidth, y + 5);

      y += 12;

      const signatureWidth = contentWidth / 3;

      // Column 1: Teacher
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // Slate 700
      doc.text("L'Enseignant Principal", margin + (signatureWidth / 2), y, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(teacherName, margin + (signatureWidth / 2), y + 5, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.line(margin + 10, y + 22, margin + signatureWidth - 10, y + 22);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Signature & Date", margin + (signatureWidth / 2), y + 26, { align: 'center' });

      // Column 2: Principal/Director
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text("Le Directeur d'Établissement", margin + signatureWidth + (signatureWidth / 2), y, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const dName = settings?.directorName || 'Administration';
      doc.text(dName, margin + signatureWidth + (signatureWidth / 2), y + 5, { align: 'center' });

      doc.line(margin + signatureWidth + 10, y + 22, margin + 2 * signatureWidth - 10, y + 22);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Cachet et signature", margin + signatureWidth + (signatureWidth / 2), y + 26, { align: 'center' });

      // Column 3: Parents
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text("Signature des Parents", margin + 2 * signatureWidth + (signatureWidth / 2), y, { align: 'center' });

      doc.line(margin + 2 * signatureWidth + 10, y + 22, margin + 3 * signatureWidth - 10, y + 22);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Mention 'Lu et Approuvé'", margin + 2 * signatureWidth + (signatureWidth / 2), y + 26, { align: 'center' });

      y += 36;
    }

    // Footnote
    checkPageBreak(18);
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Ce bulletin de situation fait foi sous réserve de vérification physique auprès de la Direction d'École.", margin + (contentWidth / 2), y, { align: 'center' });
    doc.text("Portail Scolaire Pasma-sys • Administré par Jacques Bene Mbama (+237 656 454 053).", margin + (contentWidth / 2), y + 4, { align: 'center' });

    // Multi-page numbers numbering
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
       doc.setPage(i);
       doc.setFont('helvetica', 'normal');
       doc.setFontSize(7.5);
       doc.setTextColor(148, 163, 184);
       doc.text(`Page ${i} sur ${totalPages}`, margin + contentWidth, pageHeight - 8, { align: 'right' });
       doc.text("PASMA-SYS ENT • BULLETIN TRIMESTRIEL DE L'ÉLÈVE", margin, pageHeight - 8);
    }

    const safePdfFileName = (student?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`bulletin_${safePdfFileName}.pdf`);
  };

  const isImageAvatar = (avatar: string) => {
    return avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/');
  };

  return (
    <div className="StudentPrintModal fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 md:p-4 z-[1000] no-print">
      
      {/* Print Style Injector */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-section, #print-section * {
            visibility: visible !important;
          }
          #print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            background: white !important;
            color: black !important;
            font-size: 10pt !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 15mm !important;
          }
          .no-print-interface {
            display: none !important;
          }
        }
      `}} />

      {/* Main Preview Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Modal Top Header (Non-printable) */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0 no-print-interface">
          <div className="flex items-center gap-2.5">
            <Printer className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Portail d'Impression et de Configuration du Bulletin</h3>
              <p className="text-[11px] text-slate-300">Personnalisez et visualisez le dossier scolaire de l'élève en temps réel</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dual-Pane Split Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100">
          
          {/* Left Configuration Pane (320px sidebar) */}
          <div className="w-full md:w-80 bg-white border-r border-slate-200 p-5 flex flex-col gap-6 overflow-y-auto shrink-0 no-print-interface">
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Options du Document</h4>
              
              {/* Academic Period Selector */}
              <div className="space-y-2 mb-5">
                <label className="text-[11px] font-bold text-slate-700 block">Période Académique / Trimestre</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTerm('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center ${
                      selectedTerm === 'all'
                        ? `bg-${pdfTheme}-50 border-${pdfTheme}-300 text-${pdfTheme}-700 font-extrabold`
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Année Complète
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTerm('t1')}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center ${
                      selectedTerm === 't1'
                        ? `bg-${pdfTheme}-50 border-${pdfTheme}-300 text-${pdfTheme}-700 font-extrabold`
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    1er Trimestre
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTerm('t2')}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center ${
                      selectedTerm === 't2'
                        ? `bg-${pdfTheme}-50 border-${pdfTheme}-300 text-${pdfTheme}-700 font-extrabold`
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    2e Trimestre
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTerm('t3')}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center ${
                      selectedTerm === 't3'
                        ? `bg-${pdfTheme}-50 border-${pdfTheme}-300 text-${pdfTheme}-700 font-extrabold`
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    3e Trimestre
                  </button>
                </div>
              </div>

              {/* Theme Color Picker Swatches */}
              <div className="space-y-2 mb-5">
                <label className="text-[11px] font-bold text-slate-700 block">Thème de Couleur du Bulletin</label>
                <div className="flex gap-3 pt-1">
                  {(['indigo', 'emerald', 'crimson', 'amber', 'slate'] as const).map((colorName) => {
                    const bgColors = {
                      indigo: 'bg-indigo-600',
                      emerald: 'bg-emerald-500',
                      crimson: 'bg-rose-600',
                      amber: 'bg-amber-500',
                      slate: 'bg-slate-600'
                    };
                    return (
                      <button
                        key={colorName}
                        onClick={() => setPdfTheme(colorName)}
                        className={`h-7 w-7 rounded-full ${bgColors[colorName]} relative flex items-center justify-center transition cursor-pointer active:scale-90 hover:opacity-90 shadow-sm border ${
                          pdfTheme === colorName ? 'ring-2 ring-offset-2 ring-slate-850 border-white scale-110' : 'border-slate-200'
                        }`}
                        title={`Thème ${colorName}`}
                      >
                        {pdfTheme === colorName && (
                          <span className="text-[10px] text-white font-bold">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Controls for Sections */}
              <div className="space-y-3 mb-5 border-t border-slate-100 pt-4">
                <label className="text-[11px] font-bold text-slate-700 block">Sections à Inclure</label>
                
                <label className="flex items-center gap-2.5 text-[11px] font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={showChart}
                    onChange={(e) => setShowChart(e.target.checked)}
                    className="rounded text-slate-600 focus:ring-slate-500 h-3.5 w-3.5 border-slate-300"
                  />
                  <span>Graphique par discipline</span>
                </label>

                <label className="flex items-center gap-2.5 text-[11px] font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={showAttendance}
                    onChange={(e) => setShowAttendance(e.target.checked)}
                    className="rounded text-slate-600 focus:ring-slate-500 h-3.5 w-3.5 border-slate-300"
                  />
                  <span>Registre d'assiduité</span>
                </label>

                <label className="flex items-center gap-2.5 text-[11px] font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={showSignatures}
                    onChange={(e) => setShowSignatures(e.target.checked)}
                    className="rounded text-slate-600 focus:ring-slate-500 h-3.5 w-3.5 border-slate-300"
                  />
                  <span>Signatures administratives</span>
                </label>
              </div>

              {/* Custom Parent Remarks Notes Block */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <label className="text-[11px] font-bold text-slate-700 block flex justify-between items-center">
                  <span>Remarques des Parents / Famille</span>
                  <span className="text-[9px] text-slate-400 font-mono">{parentCustomNotes.length}/180</span>
                </label>
                <textarea
                  value={parentCustomNotes}
                  onChange={(e) => setParentCustomNotes(e.target.value.substring(0, 180))}
                  placeholder="Saisissez une observation ou signature parentale (par ex: Signature électronique des parents M. et Mme...)"
                  className="w-full h-24 p-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-400 leading-normal"
                />
                <p className="text-[9px] text-slate-400 italic leading-snug">
                  Ces remarques s'afficheront instantanément dans l'aperçu et figureront sur le bulletin PDF final.
                </p>
              </div>

            </div>
          </div>

          {/* Right Live Preview Area */}
          <div className="flex-1 bg-slate-200 p-4 md:p-8 overflow-y-auto flex flex-col items-center scrollbar-thin select-text">
            
            {/* Live Context Alert bar */}
            <div className="w-full max-w-[210mm] bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 text-[11px] text-amber-900 mb-4 no-print-interface shadow-xs shrink-0">
              <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aperçu interactif haute fidélité (Format A4)</p>
                <p className="text-amber-950/80 leading-normal mt-0.5">
                  Toutes les modifications apportées à gauche (couleurs, périodes, remarques) sont immédiatement répercutées ci-dessous. Le téléchargement PDF utilisera exactement ces mêmes configurations.
                </p>
              </div>
            </div>

            {/* THE VISUAL CRISP PREVIEW CONTAINER */}
            <div 
              id="print-section"
              className="w-[210mm] min-h-[297mm] bg-white border border-slate-350 p-[15mm] relative text-slate-800 shadow-2xl font-sans rounded-xs flex flex-col justify-between print-border select-text shrink-0"
            >
              
              <div className="space-y-6">
                
                {/* Official Country Header (Republic of Cameroon Moto align) */}
                <div className="border-b-2 border-slate-850 pb-4">
                  <div className="flex justify-between items-start text-center">
                    <div className="text-left space-y-0.5">
                      <p className="text-[9px] font-black tracking-wider text-slate-750">RÉPUBLIQUE DU CAMEROUN</p>
                      <p className="text-[7.5px] italic text-slate-400">Paix - Travail - Patrie</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-slate-100 border border-slate-250 p-1.5 rounded-lg text-center inline-block max-w-[240px]">
                        <GraduationCap className="h-4.5 w-4.5 mx-auto text-indigo-600 mb-0.5" />
                        <span className="text-[7.5px] font-black uppercase text-slate-800 block truncate" title={schoolExtracted}>{schoolExtracted}</span>
                        <span className="text-[5.5px] font-bold text-slate-400 block uppercase tracking-wider">{isEn ? "School Establishment" : "Établissement Scolaire"}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[9px] font-black tracking-wider text-slate-750">REPUBLIC OF CAMEROON</p>
                      <p className="text-[7.5px] italic text-slate-400">Peace - Work - Fatherland</p>
                      <p className="text-[8px] font-bold text-slate-700 pt-0.5">Année Académique: {settings?.schoolYear || "2025/2026"}</p>
                    </div>
                  </div>
                </div>

                {/* Elegant Custom Theme Colored Title Card */}
                <div className="flex gap-4 items-center">
                  <div className={`w-1.5 h-16 rounded-sm shrink-0 bg-${pdfTheme}-600`} style={{ backgroundColor: activeTheme.primaryHex }} />
                  <div className="space-y-0.5">
                    <span className={`text-[9px] font-black tracking-widest uppercase ${activeTheme.textPrimary}`}>
                      {selectedTerm === 'all' ? "BULLETIN ANNUEL GLOBAL" : selectedTerm === 't1' ? "BULLETIN TRIMESTRIEL - TRIMESTRE 1" : selectedTerm === 't2' ? "BULLETIN TRIMESTRIEL - TRIMESTRE 2" : "BULLETIN TRIMESTRIEL - TRIMESTRE 3"}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                      Bilan d'Évaluation de l'Élève
                    </h2>
                    <p className="text-[9.5px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      Généré interactif le {new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>

                {/* Patient Profile Metadata Row */}
                <div className="grid grid-cols-12 gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl print-border text-[11px] leading-relaxed">
                  
                  {/* Student Photo and Core Info */}
                  <div className="col-span-7 flex gap-4 items-center">
                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                      {isImageAvatar(student.avatar) ? (
                        <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-4xl" role="img" aria-label="student avatar">
                          {student.avatar}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-slate-900 uppercase">{student.name}</h3>
                      <p className="text-slate-600">Né(e) le : <strong className="text-slate-800">{new Date(student.dob).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</strong></p>
                      <p className="text-slate-600">Classe / Section : <strong className="text-slate-800">{student.grade} • {student.classRoom}</strong></p>
                      <div className="pt-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[8.5px] font-bold ${activeTheme.badge}`}>
                          ÉLÈVE ACTIF ET INSCRIT
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Vertical Separator */}
                  <div className="col-span-1 border-r border-slate-200 h-14 my-auto self-center justify-self-center" />

                  {/* Supervisor details */}
                  <div className="col-span-4 space-y-1 my-auto">
                    <span className="text-[8px] font-black text-slate-400 tracking-wider uppercase block">Superviseur Pédagogique</span>
                    <p className="font-bold text-slate-800">{teacherName}</p>
                    {teacherPhone && <p className="text-[10px] text-slate-500 font-medium">Tél: <span className="font-mono">{teacherPhone}</span></p>}
                    {teacherEmail && <p className="text-[10px] text-slate-500 font-medium truncate" title={teacherEmail}>Email: <span className="font-mono text-slate-600">{teacherEmail}</span></p>}
                  </div>

                </div>

                {/* Scorecards Row */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Academic Performance KPI Card */}
                  <div className={`border rounded-xl p-4 flex flex-col justify-between ${activeTheme.bgLight} ${activeTheme.borderAccent}`}>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                      <span className="flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-amber-500" /> RENDEMENT ACADÉMIQUE
                      </span>
                      <span className="font-mono">{totalTests} éval.</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 pt-2">
                      <span className="text-2xl font-black text-slate-950 font-mono">
                        {totalTests > 0 ? averageBase20.toFixed(2) : '--'}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">/ 20</span>
                      {totalTests > 0 && (
                        <span className={`text-[10px] font-bold ${activeTheme.textPrimary}`}>
                          ({averagePercentage.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    {totalTests > 0 && (
                      <div className={`mt-2 border rounded-lg px-2 py-0.5 text-[9.5px] font-extrabold flex justify-between items-center ${apprec.color}`}>
                        <span>Appréciation :</span>
                        <span>{apprec.text}</span>
                      </div>
                    )}
                  </div>

                  {/* Attendance Performance KPI Card */}
                  <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                      <span className="flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4 text-emerald-600" /> TAUX D'ASSIDUITÉ
                      </span>
                      <span className="font-mono">{totalLogs} cont.</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 pt-2">
                      <span className={`text-2xl font-black font-mono ${Number(presenceRate) < 90 ? 'text-red-600' : 'text-slate-950'}`}>
                        {presenceRate}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">Présence effective</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center font-mono mt-2 pt-1.5 border-t border-emerald-100 text-[9px] text-slate-500 font-semibold leading-none">
                      <div>
                        <p className="text-slate-900 text-[10px] font-bold">{presentCount}</p>
                        <p className="text-[7.5px] text-slate-400 mt-0.5">Prés.</p>
                      </div>
                      <div>
                        <p className="text-amber-600 text-[10px] font-bold">{lateCount}</p>
                        <p className="text-[7.5px] text-slate-400 mt-0.5">Ret.</p>
                      </div>
                      <div>
                        <p className="text-red-600 text-[10px] font-bold">{absentCount}</p>
                        <p className="text-[7.5px] text-slate-400 mt-0.5">Abs.</p>
                      </div>
                      <div>
                        <p className="text-indigo-600 text-[10px] font-bold">{excusedCount}</p>
                        <p className="text-[7.5px] text-slate-400 mt-0.5">Exc.</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Analytical Bar Chart (visible on A4 sheet screen only if checked) */}
                {showChart && subjectChartData.length > 0 && (
                  <div className="bg-slate-50 border border-slate-250 rounded-xl p-4 space-y-2 print-border">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-slate-750 uppercase flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" style={{ color: activeTheme.primaryHex }} /> Bilan Analytique : Moyennes Scolaires par Discipline (sur 20)
                      </span>
                      <span className="text-[8px] text-slate-400 font-mono tracking-widest uppercase">PASMA ANALYTICS</span>
                    </div>
                    <div className="h-32 w-full text-[9px]">
                      {isMounted ? (
                        <ResponsiveContainer width="100%" height={128} minWidth={0}>
                          <BarChart data={subjectChartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="subject" tick={{ fontSize: 8, fill: '#475569', fontWeight: 600 }} tickLine={false} />
                            <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} />
                            <Tooltip 
                              formatter={(value) => [`${value} / 20`, 'Moyenne']}
                              contentStyle={{ fontSize: 9, borderRadius: 6, borderColor: '#cbd5e1' }}
                            />
                            <Bar dataKey="Moyenne" fill={activeTheme.primaryHex} radius={[3, 3, 0, 0]} maxBarSize={24}>
                              {subjectChartData.map((entry, index) => {
                                const isBelowMoyenne = entry.Moyenne < 10;
                                return <Cell key={`cell-${index}`} fill={isBelowMoyenne ? '#ef4444' : activeTheme.primaryHex} />;
                              })}
                            </Bar>
                            <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Seuil (10)', fill: '#ef4444', fontSize: 7.5, position: 'top', fontWeight: 'bold' }} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full w-full bg-slate-100 rounded flex items-center justify-center">Chargement graphique...</div>
                      )}
                    </div>
                  </div>
                )}

              {/* Core Subsection A: Academic evaluation (Grades) */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-1">
                  <NotebookPen className="h-3.5 w-3.5" style={{ color: activeTheme.primaryHex }} />
                  Détail des Évaluations & Notes de Contrôles
                </h4>
                {filteredGrades.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg">Aucune note de contrôle enregistrée pour la période sélectionnée.</p>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-[10px] border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="px-2.5 py-1.5">Matière / Discipline</th>
                          <th className="px-2.5 py-1.5">Intitulé de l'examen</th>
                          <th className="px-2.5 py-1.5 text-center">Date</th>
                          <th className="px-2.5 py-1.5 text-center">Note / Barème</th>
                          <th className="px-2.5 py-1.5">Observations Enseignant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {filteredGrades.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50/50">
                            <td className="px-2.5 py-1.5 font-extrabold text-slate-900">{g.subject}</td>
                            <td className="px-2.5 py-1.5 text-slate-600">{g.examName}</td>
                            <td className="px-2.5 py-1.5 text-center text-slate-500 font-mono">
                              {new Date(g.date).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                            </td>
                            <td className="px-2.5 py-1.5 text-center font-mono">
                              <span className="font-extrabold text-slate-900">{g.score}</span> / <span className="text-slate-400 font-semibold">{g.maxScore}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-500 italic max-w-[150px] truncate" title={g.teacherRemarks}>
                              {g.teacherRemarks || "Aucun commentaire"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Core Subsection B: Attendance Register (Conditional) */}
              {showAttendance && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-1">
                    <Calendar className="h-3.5 w-3.5" style={{ color: activeTheme.primaryHex }} />
                    Rapport d'Assiduité & Registre de Présence
                  </h4>
                  {filteredAttendance.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg">Aucune absence ou retard enregistré pour la période sélectionnée.</p>
                  ) : (
                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-[10px] border-collapse font-sans">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                            <th className="px-2.5 py-1.5">Date du contrôle</th>
                            <th className="px-2.5 py-1.5 text-center">Statut d'assiduité</th>
                            <th className="px-2.5 py-1.5">Motifs & Justifications Vie Scolaire</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                          {filteredAttendance.map((att) => {
                            let badgeStyle = 'bg-slate-100 text-slate-700';
                            if (att.status === 'Present') badgeStyle = 'bg-emerald-50 text-emerald-700 font-bold';
                            if (att.status === 'Absent') badgeStyle = 'bg-red-50 text-red-700 font-bold';
                            if (att.status === 'Late') badgeStyle = 'bg-amber-100 text-amber-700 font-bold';
                            if (att.status === 'Excused') badgeStyle = 'bg-indigo-50 text-indigo-700 font-bold';
                            
                            return (
                              <tr key={att.id} className="hover:bg-slate-50/50">
                                <td className="px-2.5 py-1.5 text-slate-900 font-mono">
                                  {new Date(att.date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                                </td>
                                <td className="px-2.5 py-1.5 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] ${badgeStyle}`}>
                                    {att.status === 'Present' && 'Présent'}
                                    {att.status === 'Absent' && 'Absent'}
                                    {att.status === 'Late' && 'En Retard'}
                                    {att.status === 'Excused' && 'Justifié'}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1.5 text-slate-500 italic max-w-xs truncate" title={att.remarks}>
                                  {att.remarks || (att.status === 'Present' ? 'Élève ponctuel et assidu' : 'Aucun motif renseigné')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Parent Custom Remarks section in Preview sheet */}
              {parentCustomNotes.trim() && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-1">
                    <User className="h-3.5 w-3.5" style={{ color: activeTheme.primaryHex }} />
                    Observations et Signatures des Parents d'Élèves
                  </h4>
                  <div className={`p-3 border rounded-lg italic text-[9.5px] leading-relaxed text-slate-700 bg-slate-50 border-${pdfTheme}-200`} style={{ borderColor: activeTheme.primaryHex }}>
                    <p>{parentCustomNotes}</p>
                  </div>
                </div>
              )}

              {/* Signatures box (only if enabled) */}
              {showSignatures && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-[10px] leading-relaxed text-center">
                  <div>
                    <p className="font-bold text-slate-900">Enseignant Principal</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">{teacherName}</p>
                    <div className="h-10" />
                    <div className="border-t border-slate-200 mx-auto w-24 pt-0.5 text-[8px] text-slate-400">Signature</div>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Directeur d'Établissement</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">{settings?.directorName || 'Jacques Bene Mbama'}</p>
                    <div className="h-10" />
                    <div className="border-t border-slate-200 mx-auto w-24 pt-0.5 text-[8px] text-slate-400">Cachet officiel</div>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Signature des Parents</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">M. / Mme</p>
                    <div className="h-10" />
                    <div className="border-t border-slate-200 mx-auto w-24 pt-0.5 text-[8px] text-slate-400">Lu et Approuvé</div>
                  </div>
                </div>
              )}

              {/* Notice footnote */}
              <p className="text-[8.5px] text-slate-400 text-center pt-6 border-t border-slate-150 leading-normal font-sans">
                Ce relevé numérique de situation scolaire fait foi sous réserve de vérification physique auprès du secrétariat du Directeur d'École. <br />
                Portail Pasma-sys ENT administré par Jacques Bene Mbama (+237 656 454 053). All rights reserved 2026.
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* Modal Action Footer (Non printable) */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center gap-3 shrink-0 no-print-interface">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs text-slate-750 rounded-xl cursor-pointer transition shadow-xs"
          >
            Retour au Portail
          </button>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 active:scale-97"
              title="Exporter le relevé de notes et registre d'assiduité sous format CSV"
            >
              <Download className="h-4 w-4" />
              <span>Exporter en CSV</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 active:scale-97"
              title="Télécharger le bulletin trimestriel de l'élève au format PDF"
            >
              <Download className="h-4 w-4" />
              <span>Télécharger PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 active:scale-97"
              style={{ backgroundColor: activeTheme.primaryHex }}
              title="Lancer l'impression directe du rapport"
            >
              <Printer className="h-4 w-4" />
              <span>Lancer l'Impression</span>
            </button>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {showPrintToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-[3000] bg-slate-900 border border-slate-700/50 text-white rounded-2xl p-4 shadow-xl flex items-center gap-3.5 max-w-sm no-print no-print-interface"
          >
            <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-emerald-400">Impression</h4>
              <p className="text-[12px] font-semibold text-slate-100 leading-normal mt-0.5">{toastMessage}</p>
            </div>
            <button
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
