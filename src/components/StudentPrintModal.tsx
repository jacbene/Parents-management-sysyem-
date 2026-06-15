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
  const [showChart, setShowChart] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [showPrintToast, setShowPrintToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Find titular teacher for student's classroom in global ApeeSettings
  const foundTeacher = settings?.classTeachers?.find(t => {
    const classRoomName = student.classRoom || '';
    return t.classRoom.toLowerCase() === classRoomName.toLowerCase() || 
           classRoomName.toLowerCase().includes(t.classRoom.toLowerCase()) ||
           t.classRoom.toLowerCase().includes(classRoomName.toLowerCase());
  });

  const teacherName = foundTeacher?.teacherName || student.teacherName || 'Enseignant principal';
  const teacherEmail = foundTeacher?.teacherEmail || student.teacherEmail || '';
  const teacherPhone = foundTeacher?.teacherPhone || '';

  useEffect(() => {
    // Disable main window scroll when open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Grade stats computations
  const totalTests = grades.length;
  const averagePercentage = totalTests > 0
    ? (grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 100, 0) / totalTests)
    : 0;

  const averageBase20 = totalTests > 0
    ? (grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / totalTests)
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

  // 2. Attendance Stats computations
  const totalLogs = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'Present').length;
  const absentCount = attendance.filter(a => a.status === 'Absent').length;
  const lateCount = attendance.filter(a => a.status === 'Late').length;
  const excusedCount = attendance.filter(a => a.status === 'Excused').length;

  const presenceRate = totalLogs > 0
    ? (((presentCount + excusedCount) / totalLogs) * 100).toFixed(1)
    : '100.0';

  // Group grades by subject to show a consolidated performance per subject inside the report
  const subjectAveragesMap: { [subj: string]: { sumBase20: number; count: number } } = {};
  grades.forEach(g => {
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
    
    if (grades.length === 0) {
      rows.push('"Aucune note disponible"');
    } else {
      grades.forEach(g => {
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
    rows.push('"REGISTRE DE PRESENCE ET ASSIDUITE"');
    rows.push('"Date","Statut de presence","Remarques & Justifications"');
    
    if (attendance.length === 0) {
      rows.push('"Aucune donnee de presence"');
    } else {
      attendance.forEach(att => {
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

    // Convert rows and create Download Link
    const csvContent = "\uFEFF" + rows.join('\r\n'); // Add BOM for Excel French accents support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Clean filename
    const safeStudentName = student.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `bulletin_${safeStudentName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
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

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`${yearLabel} : ${printedSchoolYear}`, margin + contentWidth, y + 4, { align: 'right' });
      
      y += 12;
    }

    // Elegant accent: Deep indigo header bar
    doc.setFillColor(79, 70, 229); // Primary Indigo
    doc.rect(margin, y, 4, 18, 'F');

    // Title text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(79, 70, 229);
    doc.text(isEn ? "PASMA-SYS PORTAL • STUDENT PERFORMANCE REPORT CARD" : "PORTAIL SCOLAIRE PASMA-SYS • BULLETIN SCOLAIRE", margin + 6, y + 4);

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
    doc.setTextColor(79, 70, 229); // Indigo 700
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
    doc.setTextColor(79, 70, 229); // Indigo 700
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
    if (subjectChartData.length > 0) {
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
          doc.setTextColor(79, 70, 229); // Indigo-600
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
    doc.setFillColor(79, 70, 229); // Primary Indigo header
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

    if (grades.length === 0) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("Aucune note de contrôle enregistrée pour cet élève.", margin + 4, y + 5);
      y += 8;
    } else {
      grades.forEach((g, gIdx) => {
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

    if (attendance.length === 0) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("Aucun retard ou absence répertorié au dossier de présence.", margin + 4, y + 5);
      y += 8;
    } else {
      attendance.forEach((att, attIdx) => {
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

    // Administrative signatures block
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

    const safePdfFileName = student.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`bulletin_${safePdfFileName}.pdf`);
  };

  const isImageAvatar = (avatar: string) => {
    return avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/');
  };

  return (
    <div className="StudentPrintModal fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1000] no-print">
      
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
          .print-break-after {
            page-break-after: always !important;
          }
          .print-border {
            border: 1px solid #e2e8f0 !important;
          }
          .no-print-interface {
            display: none !important;
          }
        }
      `}} />

      {/* Main Preview Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Modal Top Header (Non printable) */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0 no-print-interface">
          <div className="flex items-center gap-2.5">
            <Printer className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-sm">Aperçu avant Impression du Profil</h3>
              <p className="text-[11px] text-slate-300">Générez un dossier scolaire imprimable pour {student.name}</p>
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

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50 select-text">
          
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* Context Notice for Digital User */}
            <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-4 flex gap-3 text-xs text-indigo-900 no-print-interface">
              <ShieldCheck className="h-4.5 w-4.5 text-indigo-650 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Module d'Impression Certifié</span>
                <p className="text-indigo-950 font-medium leading-relaxed">
                  Ce document rassemble les relevés officiels collectés dans l'ENT Pasma-sys. Cliquez sur "Lancer l'impression" au bas de l'écran ou appuyez sur <kbd className="bg-indigo-100 px-1 py-0.5 rounded-sm border border-indigo-200 font-mono text-[10px]">Ctrl+P</kbd> pour générer le PDF officiel. Les sections d'interface grises seront automatiquement masquées.
                </p>
              </div>
            </div>

            {/* PRINT TARGET SECTION CONTAINER */}
            <div 
              id="print-section"
              className="bg-white border border-slate-150 rounded-2xl p-8 shadow-sm space-y-6 font-sans print-border"
            >
              {/* Report Header */}
              <div className="border-b-2 border-indigo-950 pb-5 flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-indigo-650 uppercase font-sans">
                    PASMA-SYS EDUCATION ENT • DOSSIER SCOLAIRE
                  </span>
                  <h2 className="text-xl font-black text-slate-900 uppercase">
                    Bilan Scolaire de l'Élève
                  </h2>
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Édité le {new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                </div>
                
                {/* Visual Accent Logo */}
                <div className="bg-indigo-50 text-indigo-800 border border-indigo-150 p-2.5 rounded-xl text-center shrink-0">
                  <GraduationCap className="h-6 w-6 mx-auto text-indigo-700" />
                  <span className="text-[8px] font-black uppercase tracking-wider block mt-1">PASMA-ENT</span>
                </div>
              </div>

              {/* Patient Profile Metadata Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start bg-slate-50 p-4 rounded-xl print-border">
                {/* Photo frame */}
                <div className="md:col-span-2 flex justify-center">
                  <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                    {isImageAvatar(student.avatar) ? (
                      <img src={student.avatar} alt={student.name} className="w-full h-full object-cover animate-pulse-once" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-5xl font-sans" role="img" aria-label="student avatar">
                        {student.avatar}
                      </span>
                    )}
                  </div>
                </div>

                {/* Core info metadata */}
                <div className="md:col-span-5 space-y-1 text-xs">
                  <h3 className="text-base font-extrabold text-slate-900 uppercase">{student.name}</h3>
                  <div className="text-slate-700 font-medium space-y-1">
                    <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" /> Né(e) le : <strong>{new Date(student.dob).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</strong></p>
                    <p className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-gray-400" /> Niveau : <strong>{student.grade} • {student.classRoom}</strong></p>
                  </div>
                </div>

                {/* Supervisor metadata */}
                <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-5 space-y-1 text-xs text-slate-700">
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Superviseur Pédagogique</span>
                  <div className="font-medium space-y-1 text-[11px]">
                    <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-gray-400" /> Enseignant principal : <strong>{teacherName}</strong></p>
                    {teacherPhone && (
                      <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gray-400" /> Téléphone : <strong className="font-mono text-slate-600">{teacherPhone}</strong></p>
                    )}
                    {teacherEmail && (
                      <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-gray-400" /> Email direct : <strong className="font-mono text-slate-600">{teacherEmail}</strong></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Synthetic metrics widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* GP/Average metric scorecard */}
                <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-1.5 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Award className="h-4 w-4 text-amber-500" /> Rendement Cognitif
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{totalTests} évaluation(s)</span>
                  </div>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-3xl font-black font-sans text-indigo-950">
                      {totalTests > 0 ? averageBase20.toFixed(2) : '--'}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">/ 20</span>
                    {totalTests > 0 && <span className="text-xs text-indigo-600 font-medium">({averagePercentage.toFixed(1)}%)</span>}
                  </div>
                  {totalTests > 0 && (
                    <div className={`mt-2 border rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold flex justify-between items-center ${apprec.color}`}>
                      <span>Appréciation :</span>
                      <span>{apprec.text}</span>
                    </div>
                  )}
                </div>

                {/* Absences metric scorecard */}
                <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-1.5 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <ListChecks className="h-4 w-4 text-indigo-500" /> Taux d'Assiduité
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{totalLogs} contrôle(s)</span>
                  </div>
                  <div className="flex items-baseline gap-1 pt-1">
                    <span className={`text-3xl font-black font-sans ${Number(presenceRate) < 90 ? 'text-red-650' : 'text-slate-900'}`}>
                      {presenceRate}%
                    </span>
                    <span className="text-xs text-slate-400 font-bold">Présence effective</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center font-mono mt-2 pt-2 border-t border-slate-100 text-[10px] leading-tight text-slate-500 font-semibold">
                    <div>
                      <p className="text-slate-900 text-[11px] font-bold">{presentCount}</p>
                      <p className="text-[8px] font-sans text-slate-400">Prés.</p>
                    </div>
                    <div>
                      <p className="text-amber-600 text-[11px] font-bold">{lateCount}</p>
                      <p className="text-[8px] font-sans text-slate-400">Ret.</p>
                    </div>
                    <div>
                      <p className="text-red-650 text-[11px] font-bold">{absentCount}</p>
                      <p className="text-[8px] font-sans text-slate-400">Abs.</p>
                    </div>
                    <div>
                      <p className="text-indigo-600 text-[11px] font-bold">{excusedCount}</p>
                      <p className="text-[8px] font-sans text-slate-400">Exc.</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Summary Performance Chart */}
              {showChart && subjectChartData.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3 print-border">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-750 uppercase flex items-center gap-1.5 font-semibold">
                      <TrendingUp className="h-4 w-4 text-indigo-650" /> Bilan Graphique : Moyennes Standardisées par Discipline (sur 20)
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">PASMA-ENT ANALYTICS</span>
                  </div>
                  <div className="h-48 w-full text-[10px]">
                    {isMounted ? (
                      <ResponsiveContainer width="100%" height={192} minWidth={0}>
                        <BarChart data={subjectChartData} margin={{ top: 15, right: 10, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="subject" tick={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} tickLine={false} />
                          <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} />
                          <Tooltip 
                            formatter={(value) => [`${value} / 20`, 'Moyenne scolaire']}
                            contentStyle={{ fontSize: 10, borderRadius: 8, borderColor: '#cbd5e1' }}
                          />
                          <Bar dataKey="Moyenne" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={32}>
                            {subjectChartData.map((entry, index) => {
                              const isBelowMoyenne = entry.Moyenne < 10;
                              return <Cell key={`cell-${index}`} fill={isBelowMoyenne ? '#ef4444' : '#4f46e5'} />;
                            })}
                          </Bar>
                          <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Seuil de Réussite (10/20)', fill: '#ef4444', fontSize: 8, position: 'top', fontWeight: 'bold' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full bg-slate-50 rounded-xl animate-pulse flex items-center justify-center text-xs text-slate-405 font-medium font-sans">Chargement...</div>
                    )}
                  </div>
                </div>
              )}

              {/* Core Subsection A: Academic evaluation (Grades) */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-150 pb-1.5">
                  <NotebookPen className="h-4 w-4 text-indigo-650 shrink-0" />
                  Tableau des Évaluations de Notes
                </h4>
                {grades.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">Aucune note de contrôle enregistrée pour cet élève.</p>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-[11px] border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="px-3 py-2">Matière / Discipline</th>
                          <th className="px-3 py-2">Intitulé de l'examen</th>
                          <th className="px-3 py-2 text-center">Date d'évaluation</th>
                          <th className="px-3 py-2 text-center">Note obtenue</th>
                          <th className="px-3 py-2">Appréciation Enseignant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {grades.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-bold text-slate-900">{g.subject}</td>
                            <td className="px-3 py-2 text-slate-600">{g.examName}</td>
                            <td className="px-3 py-2 text-center text-slate-500 font-mono">
                              {new Date(g.date).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                            </td>
                            <td className="px-3 py-2 text-center font-mono">
                              <span className="font-bold text-indigo-950 text-xs">{g.score}</span> / <span className="text-slate-400 font-semibold">{g.maxScore}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 italic max-w-[180px] truncate" title={g.teacherRemarks}>
                              {g.teacherRemarks || "Aucun commentaire"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Core Subsection B: Attendance History */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-150 pb-1.5">
                  <Calendar className="h-4 w-4 text-indigo-650 shrink-0" />
                  Rapport du Registre de Présence
                </h4>
                {attendance.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">Aucune absence ou retard répertorié au dossier.</p>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-[11px] border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="px-3 py-2">Date du contrôle</th>
                          <th className="px-3 py-2 text-center">Statut d'absence</th>
                          <th className="px-3 py-2">Motifs justificatifs & Remarques</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                        {attendance.map((att) => {
                          let badgeStyle = 'bg-slate-100 text-slate-700';
                          if (att.status === 'Present') badgeStyle = 'bg-emerald-50 text-emerald-700 font-bold';
                          if (att.status === 'Absent') badgeStyle = 'bg-red-55 text-red-700 font-bold';
                          if (att.status === 'Late') badgeStyle = 'bg-amber-100 text-amber-700 font-bold';
                          if (att.status === 'Excused') badgeStyle = 'bg-indigo-50 text-indigo-700 font-bold';
                          
                          return (
                            <tr key={att.id} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-900 font-mono">
                                {new Date(att.date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9.5px] ${badgeStyle}`}>
                                  {att.status === 'Present' && 'Présent'}
                                  {att.status === 'Absent' && 'Absent'}
                                  {att.status === 'Late' && 'En Retard'}
                                  {att.status === 'Excused' && 'Justifié'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-500 italic max-w-xs truncate" title={att.remarks}>
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

              {/* Administrative signatures spaces for print output only */}
              <div className="grid grid-cols-3 gap-6 pt-12 items-start text-center text-xs font-sans">
                <div className="space-y-16">
                  <div>
                    <p className="font-bold text-slate-800">Enseignant Principal</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">{teacherName}</p>
                  </div>
                  <div className="border-t border-slate-300 mx-auto w-36 pt-1 text-[10px] text-gray-400">Signature & Date</div>
                </div>
                <div className="space-y-16">
                  <div>
                    <p className="font-bold text-slate-800">Le Directeur d'Établissement</p>
                    {settings?.directorName && <p className="text-[10px] text-slate-500 mt-1 font-medium">{settings.directorName}</p>}
                  </div>
                  <div className="border-t border-slate-300 mx-auto w-36 pt-1 text-[10px] text-gray-400">Cachet officiel</div>
                </div>
                <div className="space-y-16">
                  <p className="font-bold text-slate-800">Signature du Parent</p>
                  <div className="border-t border-slate-300 mx-auto w-36 pt-1 text-[10px] text-gray-400">Mention "lu et approuvé"</div>
                </div>
              </div>

              {/* Notice footnote */}
              <p className="text-[9px] text-slate-400 text-center pt-8 border-t border-slate-100 leading-normal font-sans">
                Ce relevé numérique de situation scolaire fait foi sous réserve de vérification physique auprès du secrétariat du Directeur d'École. <br />
                Portail Pasma-sys ENT administré par Jacques Bene Mbama (+237 656 454 053). All rights reserved 2026.
              </p>

            </div>

          </div>

        </div>

        {/* Modal Action Footer (Non printable) */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center gap-3 shrink-0 no-print-interface">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 rounded-xl cursor-pointer transition shadow-xs"
          >
            Retour au Portail
          </button>
          
          <div className="flex gap-2">
            {subjectChartData.length > 0 && (
              <button
                type="button"
                onClick={() => setShowChart(prev => !prev)}
                className={`font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 active:scale-97 ${
                  showChart 
                    ? 'bg-blue-55 border border-blue-200 text-blue-700 hover:bg-blue-100'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                title={showChart ? "Masquer le graphique d'analyse des moyennes" : "Afficher le graphique analytique"}
              >
                <BarChart2 className="h-4 w-4" />
                <span>{showChart ? "Masquer le Graphique" : "Afficher le Graphique"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 active:scale-97"
              title="Télécharger le relevé de notes et registre d'assiduité sous format CSV"
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 active:scale-97"
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
