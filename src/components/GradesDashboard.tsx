import React, { useState } from 'react';
import { Grade, Student } from '../types';
import { Award, BookOpen, TrendingUp, TrendingDown, Sparkles, Filter, Plus, Trash2, Lock, Unlock, CheckCircle, Printer, Download, Activity, AlertCircle, BarChart2, Check, HelpCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, Cell } from 'recharts';
import { useLanguage } from '../utils/TranslationContext';

interface GradesDashboardProps {
  grades: Grade[];
  onAddGrade?: (grade: Grade) => Promise<boolean>;
  onDeleteGrade?: (id: string) => Promise<boolean>;
  isPedAuthorized?: boolean;
  onPromptUnlockPed?: () => void;
  pedManagerName?: string;
  hasPedPassword?: boolean;
  activeStudent?: Student | null;
  onUpdateStudent?: (updated: Student) => Promise<boolean>;
  onPrintReport?: () => void;
  settings?: any;
}

export default function GradesDashboard({
  grades,
  onAddGrade,
  onDeleteGrade,
  isPedAuthorized = false,
  onPromptUnlockPed,
  pedManagerName = '',
  hasPedPassword = false,
  activeStudent,
  onUpdateStudent,
  onPrintReport,
  settings,
}: GradesDashboardProps) {
  const { t, language } = useLanguage();
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [isMounted, setIsMounted] = useState(false);
  const [activeVisualTab, setActiveVisualTab] = useState<'trends' | 'subjects' | 'distribution' | 'diagnostic'>('trends');
  
  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Add Grade states
  const [showAddForm, setShowAddForm] = useState(false);
  const [subject, setSubject] = useState('Mathématiques');
  const [examName, setExamName] = useState('');
  const [score, setScore] = useState<number>(10);
  const [maxScore, setMaxScore] = useState<number>(20);
  const [remarks, setRemarks] = useState('');
  const [gradeDate, setGradeDate] = useState('');

  // Compute unique subjects
  const subjects = ['all', ...Array.from(new Set(grades.map(g => g.subject)))];

  // Filter grades
  const filteredGrades = selectedSubject === 'all'
    ? grades
    : grades.filter(g => g.subject === selectedSubject);

  // Sort grades chronologically for charts
  const sortedGradesForChart = [...filteredGrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate Average Student mark
  const totalScoreVal = filteredGrades.reduce((acc, g) => acc + (g.score / g.maxScore) * 20, 0);
  const averageMark = filteredGrades.length > 0
    ? (totalScoreVal / filteredGrades.length).toFixed(1)
    : '0';

  const chartData = sortedGradesForChart.map(g => ({
    date: new Date(g.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    score: Number(((g.score / g.maxScore) * 20).toFixed(1)),
    maxScore: 20,
    subject: g.subject,
    examName: g.examName
  }));

  // --- ADVANCED METRICS FOR PERFORMANCE DASHBOARD ---
  // 1. Subject averages (using all student grades)
  const subjectAveragesMap = new Map<string, { total: number; count: number }>();
  grades.forEach(g => {
    const score20 = (g.score / g.maxScore) * 20;
    const existing = subjectAveragesMap.get(g.subject) || { total: 0, count: 0 };
    subjectAveragesMap.set(g.subject, {
      total: existing.total + score20,
      count: existing.count + 1
    });
  });
  
  const subjectAveragesData = Array.from(subjectAveragesMap.entries()).map(([subj, data]) => ({
    subject: subj,
    average: Number((data.total / data.count).toFixed(1)),
    count: data.count
  })).sort((a, b) => b.average - a.average);

  const strongestSubject = subjectAveragesData.length > 0 ? subjectAveragesData[0] : null;
  const weakestSubject = subjectAveragesData.length > 0 ? subjectAveragesData[subjectAveragesData.length - 1] : null;

  // 2. Grade Bracket Distribution
  let bracketUnder10 = 0;
  let bracket10to12 = 0;
  let bracket12to14 = 0;
  let bracket14to16 = 0;
  let bracket16to20 = 0;

  grades.forEach(g => {
    const val = (g.score / g.maxScore) * 20;
    if (val < 10) bracketUnder10++;
    else if (val < 12) bracket10to12++;
    else if (val < 14) bracket12to14++;
    else if (val < 16) bracket14to16++;
    else bracket16to20++;
  });

  const distributionData = [
    { range: '< 10', count: bracketUnder10, label: language === 'fr' ? 'Insuffisant' : 'Weak', fill: '#ef4444' },
    { range: '10 - 12', count: bracket10to12, label: language === 'fr' ? 'Passable' : 'Fair', fill: '#f59e0b' },
    { range: '12 - 14', count: bracket12to14, label: language === 'fr' ? 'Assez Bien' : 'Good', fill: '#3b82f6' },
    { range: '14 - 16', count: bracket14to16, label: language === 'fr' ? 'Bien' : 'Very Good', fill: '#6366f1' },
    { range: '16 - 20', count: bracket16to20, label: language === 'fr' ? 'Très Bien' : 'Excellent', fill: '#10b981' },
  ];

  // 3. Volatility / Standard Deviation
  const meanVal = grades.length > 0 ? (grades.reduce((acc, g) => acc + (g.score / g.maxScore) * 20, 0) / grades.length) : 0;
  const varianceVal = grades.length > 0 ? (grades.reduce((acc, g) => {
    const score20 = (g.score / g.maxScore) * 20;
    return acc + Math.pow(score20 - meanVal, 2);
  }, 0) / grades.length) : 0;
  const stdDevVal = Math.sqrt(varianceVal);

  // 4. Semester trend direction (comparing chronological halves)
  const fullSortedGrades = [...grades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const halfLen = Math.floor(fullSortedGrades.length / 2);
  const firstHalf = fullSortedGrades.slice(0, halfLen);
  const secondHalf = fullSortedGrades.slice(halfLen);
  const firstHalfAvg = firstHalf.length > 0 ? (firstHalf.reduce((acc, g) => acc + (g.score / g.maxScore) * 20, 0) / firstHalf.length) : 0;
  const secondHalfAvg = secondHalf.length > 0 ? (secondHalf.reduce((acc, g) => acc + (g.score / g.maxScore) * 20, 0) / secondHalf.length) : 0;
  const trendDiffVal = secondHalfAvg - firstHalfAvg;

  // 5. Honors Mention Estimation
  const getHonorsMention = (avg: number) => {
    if (avg >= 16) return language === 'fr' ? 'Très Bien' : 'Highest Honors';
    if (avg >= 14) return language === 'fr' ? 'Bien' : 'High Honors';
    if (avg >= 12) return language === 'fr' ? 'Assez Bien' : 'Honors';
    if (avg >= 10) return language === 'fr' ? 'Passable' : 'Pass';
    return language === 'fr' ? 'Insuffisant' : 'Incomplete';
  };

  // Average color mapping
  const getAverageBadgeColor = (avg: number) => {
    if (avg >= 16) return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    if (avg >= 13) return 'bg-indigo-50 border-indigo-200 text-indigo-800';
    if (avg >= 10) return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-red-50 border-red-200 text-red-800';
  };

  // Helper to verify that the active user is the student's titular teacher
  const verifyTeacherIdentity = (): boolean => {
    if (!activeStudent) return false;
    
    // 1. Check if grades are officially validated first
    if (activeStudent.gradesValidated) {
      alert("🔒 Impossible de modifier : Ce bulletin de notes a été officiellement validé par le responsable pédagogique et ne peut plus subir de modification.");
      return false;
    }

    const expectedName = activeStudent.teacherName || "Enseignant principal";
    const expectedEmail = activeStudent.teacherEmail || "";
    
    // Check session cache
    const saved = sessionStorage.getItem('active_teacher_identity');
    if (saved && (
      saved.toLowerCase().trim() === expectedName.toLowerCase().trim() ||
      saved.toLowerCase().trim() === expectedEmail.toLowerCase().trim()
    )) {
      return true;
    }

    const inputName = prompt(
      `🔒 Sécurité Enseignant Titulaire\nSeul le professeur titulaire (${expectedName}) est autorisé à modifier ces notes.\n\nVeuillez saisir votre Nom d'enseignant pour confirmer votre identité :`
    );
    if (!inputName) return false;

    const queryLower = inputName.trim().toLowerCase();
    if (
      queryLower === expectedName.toLowerCase().trim() ||
      queryLower === expectedEmail.toLowerCase().trim() ||
      expectedName.toLowerCase().includes(queryLower) ||
      queryLower.includes(expectedName.toLowerCase().trim())
    ) {
      sessionStorage.setItem('active_teacher_identity', inputName.trim());
      return true;
    } else {
      alert(`Accès refusé.\nVous avez saisi : "${inputName}".\nL'enseignant titulaire enregistré pour ${activeStudent.name} est : "${expectedName}".`);
      return false;
    }
  };

  const handleOpenForm = () => {
    if (!verifyTeacherIdentity()) {
      return;
    }
    setGradeDate(new Date().toISOString().split('T')[0]);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) {
      alert('Veuillez sélectionner un élève avant de pouvoir introduire des notes.');
      return;
    }
    
    // Double check validity and lock
    if (activeStudent.gradesValidated) {
      alert("🔒 Impossible d'enregistrer : Le bulletin de notes est validé.");
      return;
    }

    if (!examName.trim()) {
      alert("Veuillez spécifier l'intitulé de l'évaluation.");
      return;
    }
    if (score < 0 || maxScore <= 0 || score > maxScore) {
      alert("La note saisie doit être entre 0 et la note maximale configurée.");
      return;
    }

    if (onAddGrade) {
      const newGrade: Grade = {
        id: 'gr_' + Date.now(),
        studentId: activeStudent.id,
        parentId: activeStudent.parentId,
        subject,
        examName: examName.trim(),
        score: Number(score),
        maxScore: Number(maxScore),
        teacherRemarks: remarks.trim() || 'Bon travail.',
        date: gradeDate
      };

      const success = await onAddGrade(newGrade);
      if (success) {
        setExamName('');
        setRemarks('');
        setShowAddForm(false);
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!verifyTeacherIdentity()) {
      return;
    }
    const confirm = window.confirm(`Voulez-vous supprimer l'évaluation "${name}" ?`);
    if (confirm && onDeleteGrade) {
      await onDeleteGrade(id);
    }
  };

  const handleToggleValidation = async () => {
    if (!activeStudent || !onUpdateStudent) return;
    const isCurrentlyValidated = !!activeStudent.gradesValidated;
    const confirmMsg = isCurrentlyValidated 
      ? `Voulez-vous invalider (déverrouiller) le bulletin de notes pour ${activeStudent.name} ? Cela permettra à nouveau les modifications par son enseignant.`
      : `Voulez-vous valider officiellement le bulletin de notes pour ${activeStudent.name} ? Une fois validé, plus aucune note ne pourra être ajoutée ou supprimée.`;
    
    if (window.confirm(confirmMsg)) {
      const updated: Student = {
        ...activeStudent,
        gradesValidated: !isCurrentlyValidated
      };
      await onUpdateStudent(updated);
    }
  };

  const handleExportGradesPDF = () => {
    if (!activeStudent) return;

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
    let pageCount = 1;
    const isEn = language === 'en';

    const drawPageHeaderFooter = (num: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, margin + contentWidth, 12);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const transcriptLabel = isEn 
        ? `Official Academic Transcript - ${activeStudent.name} • Class: ${activeStudent.grade} ${activeStudent.classRoom}`
        : `Relevé de Notes Officiel - ${activeStudent.name} • Classe : ${activeStudent.grade} ${activeStudent.classRoom}`;
      doc.text(transcriptLabel, margin, 9);
      
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      const pageLabel = isEn ? "Page" : "Page";
      doc.text(`${pageLabel} ${num}`, margin + contentWidth - 12, pageHeight - 8);
      const generatedLabel = isEn ? `Generated by PASMA-SYS Educational • Date of issue: ` : `Généré par PASMA-SYS Éducatif • Date d'édition : `;
      doc.text(`${generatedLabel}${now.toLocaleDateString(isEn ? 'en-US' : 'fr-FR')} ${now.toLocaleTimeString(isEn ? 'en-US' : 'fr-FR')}`, margin, pageHeight - 8);
    };

    drawPageHeaderFooter(pageCount);

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

    // Title Block
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const mainTitle = isEn 
      ? "INDIVIDUAL ACADEMIC TRANSCRIPT - SCHOOL REPORT CARD" 
      : "RELEVÉ DE NOTES INDIVIDUEL - BULLETIN ACADÉMIQUE";
    doc.text(mainTitle, margin + 5, y + 9);

    y += 20;

    // Student Information Block
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 32, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 32, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(activeStudent.name.toUpperCase(), margin + 6, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const dobLabel = isEn 
      ? `Date of birth: ${activeStudent.dob ? new Date(activeStudent.dob).toLocaleDateString('en-US') : 'Not specified'}` 
      : `Date de naissance : ${activeStudent.dob ? new Date(activeStudent.dob).toLocaleDateString('fr-FR') : 'Non renseignée'}`;
    doc.text(dobLabel, margin + 6, y + 14);
    
    const classLabel = isEn 
      ? `Class / Grade: ${activeStudent.grade} • ${activeStudent.classRoom}` 
      : `Classe / Niveau : ${activeStudent.grade} • ${activeStudent.classRoom}`;
    doc.text(classLabel, margin + 6, y + 19);
    
    const statusLabel = isEn 
      ? `Administrative Status: REGISTERED STUDENT IN GOOD STANDING` 
      : `Statut Administratif : ÉLÈVE INSCRIT ET EN RÈGLE`;
    doc.text(statusLabel, margin + 6, y + 24);

    // Vertical Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + 92, y + 4, margin + 92, y + 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const corpsTeacherLabel = isEn ? "TEACHING STAFF" : "CORPS ENSEIGNANT";
    doc.text(corpsTeacherLabel, margin + 97, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const principalTeacherLabel = isEn 
      ? `Main class teacher: ${activeStudent.teacherName || 'Not assigned'}` 
      : `Professeur principal : ${activeStudent.teacherName || 'Non assigné'}`;
    doc.text(principalTeacherLabel, margin + 97, y + 14);
    
    const contactEmailLabel = isEn 
      ? `Contact e-mail: ${activeStudent.teacherEmail || 'Not available'}` 
      : `Courriel de contact : ${activeStudent.teacherEmail || 'Non disponible'}`;
    doc.text(contactEmailLabel, margin + 97, y + 19);
    
    // Status Badge
    doc.setFillColor(238, 242, 255); // Indigo 50
    doc.rect(margin + 97, y + 22.5, 45, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229); // Indigo 700
    const activeLabel = isEn ? "Active enrollment" : "Scolarisation active";
    doc.text(activeLabel, margin + 100, y + 26);

    y += 37;

    // Key stats
    const totalTestsNum = grades.length;
    const avgBase20Val = totalTestsNum > 0
      ? (grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / totalTestsNum)
      : 0;

    const getApprecText = (avg: number) => {
      if (avg >= 16) return 'Très Bien (Excellent)';
      if (avg >= 14) return 'Bien';
      if (avg >= 12) return 'Assez Bien';
      if (avg >= 10) return 'Passable';
      return 'Insuffisant';
    };

    const getApprecTextEn = (avg: number) => {
      if (avg >= 16) return 'Excellent';
      if (avg >= 14) return 'Good';
      if (avg >= 12) return 'Satisfactory';
      if (avg >= 10) return 'Passing';
      return 'Insufficient';
    };

    const appText = getApprecText(avgBase20Val);

    // KPI Cards Block (Two side by side)
    const kpiWidth = (contentWidth - 6) / 2; // 87mm each

    // KPI Left: Average score
    doc.setFillColor(245, 247, 255); // Indigo light background
    doc.setDrawColor(199, 210, 254);
    doc.rect(margin, y, kpiWidth, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    const kpiLeftTitle = isEn ? "GENERAL ACADEMIC GRADE AVERAGE" : "MOYENNE ACADÉMIQUE GÉNÉRALE";
    doc.text(kpiLeftTitle, margin + 5, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    const textAvgString = totalTestsNum > 0 ? `${avgBase20Val.toFixed(2)} / 20` : "-- / 20";
    doc.text(textAvgString, margin + 5, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const globalApp = isEn 
      ? `Overall remarks: ${totalTestsNum > 0 ? getApprecTextEn(avgBase20Val) : 'Not evaluated'}` 
      : `Mention globale : ${totalTestsNum > 0 ? appText : 'Non évalué'}`;
    doc.text(globalApp, margin + 5, y + 20);

    // KPI Right: Total tests
    doc.setFillColor(240, 253, 244); // Green light background
    doc.setDrawColor(187, 247, 208);
    doc.rect(margin + kpiWidth + 6, y, kpiWidth, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(21, 128, 61);
    const kpiRightTitle = isEn ? "COMPLETED TESTS & EXAMINATIONS" : "ÉVALUATIONS ET EXAMENS TERMINÉS";
    doc.text(kpiRightTitle, margin + kpiWidth + 11, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    const completedEvalText = isEn ? `${totalTestsNum} tests` : `${totalTestsNum} éval.`;
    doc.text(completedEvalText, margin + kpiWidth + 11, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const bestGrade = totalTestsNum > 0
      ? Math.max(...grades.map(g => (g.score / g.maxScore) * 20)).toFixed(1)
      : '0.0';
    const bestPerfLabel = isEn ? `Best grade: ${bestGrade} / 20` : `Meilleure performance : ${bestGrade} / 20`;
    doc.text(bestPerfLabel, margin + kpiWidth + 11, y + 20);

    y += 30;

    // Grades Table Block
    const checkPageBreak = (heightNeeded: number) => {
      if (y + heightNeeded > pageHeight - 20) {
        doc.addPage();
        pageCount++;
        drawPageHeaderFooter(pageCount);
        y = 25; // Reset y to top margin on new page
      }
    };

    checkPageBreak(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const detailsHeaderTitle = isEn ? "DETAILED TRANSCRIPT & SUBJECT SCORES" : "DÉTAIL DES MOYENNES ET RELEVÉ DE NOTES";
    doc.text(detailsHeaderTitle, margin, y + 4);
    y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    // Header of Table
    doc.setFillColor(79, 70, 229); // Primary Indigo header
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    const colSubject = isEn ? "Discipline / Subject" : "Discipline / Matière";
    const colExam = isEn ? "Assessment / Exam" : "Nom de l'évaluation";
    const colDate = isEn ? "Date" : "Date";
    const colRaw = isEn ? "Raw Score" : "Note brute";
    const colBase20 = isEn ? "Rating (/20)" : "Météo (/20)";
    const colRemarks = isEn ? "Teacher Remarks" : "Appréciation d'enseignant";

    doc.text(colSubject, margin + 3.5, y + 5);
    doc.text(colExam, margin + 48, y + 5);
    doc.text(colDate, margin + 92, y + 5);
    doc.text(colRaw, margin + 112, y + 5);
    doc.text(colBase20, margin + 130, y + 5);
    doc.text(colRemarks, margin + 148, y + 5);

    y += 7.5;

    const truncate = (text: string, count: number) => {
      if (!text) return '';
      return text.length > count ? text.substring(0, count - 3) + "..." : text;
    };

    if (grades.length === 0) {
      checkPageBreak(10);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      const emptyTranscriptLabel = isEn ? "No grades recorded for this student yet." : "Aucun relevé de note n'a été inséré ou validé pour cet élève.";
      doc.text(emptyTranscriptLabel, margin + 4, y + 6);
      y += 10;
    } else {
      // Sort grades descending or chronological
      const sortedGrades = [...grades].sort((a, b) => b.date.localeCompare(a.date));

      sortedGrades.forEach((g, gIdx) => {
        checkPageBreak(8);

        if (gIdx % 2 === 0) {
          doc.setFillColor(248, 250, 252); // Soft zebra
          doc.rect(margin, y, contentWidth, 7, 'F');
        }

        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(margin, y + 7, margin + contentWidth, y + 7);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.text(truncate(g.subject, 18), margin + 3.5, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(truncate(g.examName, 20), margin + 48, y + 4.5);

        doc.text(new Date(g.date).toLocaleDateString(isEn ? 'en-US' : 'fr-FR'), margin + 92, y + 4.5);

        doc.setFont('helvetica', 'semibold');
        doc.text(`${g.score} / ${g.maxScore}`, margin + 112, y + 4.5);

        const relativeScore = (g.score / g.maxScore) * 20;
        if (relativeScore >= 10) {
          doc.setTextColor(16, 185, 129); // Green 500
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(239, 68, 68); // Red 500
          doc.setFont('helvetica', 'bold');
        }
        doc.text(`${relativeScore.toFixed(1)} / 20`, margin + 130, y + 4.5);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const commentLabel = truncate(g.teacherRemarks || (isEn ? 'No remarks' : 'Aucun commentaire.'), 20);
        doc.text(commentLabel, margin + 148, y + 4.5);

        y += 7;
      });
    }

    y += 10;

    // Signature Area
    checkPageBreak(35);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 8;

    const signatureColWidth = contentWidth / 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const pTeacher = isEn ? "HEAD CLASS TEACHER" : "LE PROFESSEUR PRINCIPAL";
    const dStudies = isEn ? "DIRECTOR OF STUDIES" : "LE DIRECTEUR DES ÉTUDES";
    const pSignature = isEn ? "PARENT / GUARDIAN SIGNATURE" : "SIGNATURE DES PARENTS";
    doc.text(pTeacher, margin + 5, y);
    doc.text(dStudies, margin + signatureColWidth + 5, y);
    doc.text(pSignature, margin + (signatureColWidth * 2) + 5, y);

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const stampSign = isEn ? "(Digital stamp & signed)" : "(Sceau et émargement)";
    const stampInst = isEn ? "(Official school seal)" : "(Cachet de l'institution)";
    const stampAuth = isEn ? "(Read and approved)" : "(Lu et approuvé)";
    doc.text(stampSign, margin + 5, y);
    doc.text(stampInst, margin + signatureColWidth + 5, y);
    doc.text(stampAuth, margin + (signatureColWidth * 2) + 5, y);

    // Save PDF file
    doc.save(`bulletin_${activeStudent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-600" />
            Bulletins de Notes & Évaluations
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Suivi académique détaillé, moyennes pondérées et appréciations par matière.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeStudent && (
            <button
              onClick={handleExportGradesPDF}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-97"
              title="Exporter le relevé de notes au format PDF pour l'impression"
              type="button"
            >
              <Download className="h-4 w-4 text-indigo-200" /> Exporter PDF
            </button>
          )}

          {onPrintReport && (
            <button
              onClick={onPrintReport}
              className="px-3.5 py-2 bg-white text-gray-700 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Printer className="h-4 w-4" /> Imprimer le Bulletin
            </button>
          )}

          <button
            onClick={handleOpenForm}
            disabled={!!activeStudent?.gradesValidated}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
              activeStudent?.gradesValidated
                ? 'bg-slate-100 text-slate-400 border border-slate-205 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-850 text-white'
            }`}
          >
            <Plus className="h-4 w-4" /> Introduire Note
          </button>
        </div>
      </div>

      {/* Validated Bulletin Banner locked status */}
      {activeStudent?.gradesValidated && (
        <div className="p-4 rounded-2xl border bg-amber-50/50 text-amber-950 border-amber-250 text-xs flex items-center gap-3 animate-fade-in shadow-2xs">
          <Lock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-extrabold uppercase tracking-wide text-[10px] text-amber-800 flex items-center gap-1">
              🔒 Bulletin de Notes Officiellement Validé & Scellé
            </span>
            <p className="font-medium text-amber-900">
              Le responsable pédagogique a validé le relevé de notes pour <strong>{activeStudent.name}</strong>. Plus aucune modification, ajout ou suppression de note n'est autorisée.
            </p>
          </div>
        </div>
      )}

      {/* Security Status Header */}
      {hasPedPassword && (
        <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isPedAuthorized ? 'bg-emerald-50 text-emerald-950 border-emerald-150' : 'bg-slate-50 text-slate-800 border-slate-150'
        }`}>
          <div className="flex items-center gap-2">
            {isPedAuthorized ? (
              <Unlock className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="h-4.5 w-4.5 text-slate-500 shrink-0" />
            )}
            <div>
              <span className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-slate-650">
                {isPedAuthorized ? '🔓 Mode Responsable Débloqué' : '🔒 Niveau de Sécurité Responsable Pédagogique'}
              </span>
              <p className="font-medium text-slate-600 mt-0.5">
                {isPedAuthorized 
                  ? `Qualité accréditée : ${pedManagerName || "Surveillant Général / Censeur"}`
                  : `La validation ou l'invalidation officielle du bulletin de l'élève requiert le mot de passe de direction.`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isPedAuthorized && activeStudent && (
              <button
                type="button"
                onClick={handleToggleValidation}
                className={`px-3 py-1.5 font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shrink-0 border ${
                  activeStudent.gradesValidated 
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                    : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700'
                }`}
              >
                {activeStudent.gradesValidated ? '🔓 Invalider le Bulletin' : '🔒 Valider le Bulletin'}
              </button>
            )}

            {!isPedAuthorized && onPromptUnlockPed && (
              <button
                onClick={onPromptUnlockPed}
                className="px-3 py-1.5 bg-white text-slate-800 border border-slate-250 font-bold rounded-lg text-[10px] hover:bg-slate-50 uppercase tracking-wider transition cursor-pointer shrink-0"
              >
                Saisir mot de passe
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Grade Section Form */}
      <AnimatePresence>
        {showAddForm && activeStudent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 shadow-3xs">
              <div className="flex items-center justify-between border-b border-slate-205 pb-2 select-none">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  📝 Introduire une note officielle pour {activeStudent.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold uppercase transition cursor-pointer"
                >
                  Annuler
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Matière / Discipline <span className="text-red-500">*</span></label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-850"
                  >
                    <option value="Mathématiques">Mathématiques</option>
                    <option value="Physique-Chimie">Physique-Chimie</option>
                    <option value="Sciences de la Vie">Sciences de la Vie (SVT)</option>
                    <option value="Français / Littérature">Français</option>
                    <option value="Anglais">Anglais</option>
                    <option value="Histoire-Géographie">Histoire-Géographie</option>
                    <option value="Informatique">Informatique</option>
                    <option value="Allemand / Espagnol">Langue Vivante II</option>
                    <option value="Arts / Musique">Arts / Musique</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Intitulé de l'Évaluation <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="Ex: Devoir Harmonisé / Examen Trimestre 1"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Date de l'évaluation <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={gradeDate}
                    onChange={(e) => setGradeDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Note obtenue <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    min="0"
                    max={maxScore}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Sur (/ Max possible) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-805"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Appréciation / Remarques</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Ex: Excellent trimestre, poursuivez ainsi."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-250 bg-white text-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-50 cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer text-center shadow-xs"
                >
                  <CheckCircle className="h-4 w-4" /> Enregistrer Note
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {grades.length === 0 ? (
        <div className="text-center p-12 bg-gray-50/50 rounded-2xl border border-gray-100 select-none">
          <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Aucune note enregistrée pour cet élève.</p>
        </div>
      ) : (
        <>
          {/* Key Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 rounded-2xl border flex items-center justify-between ${getAverageBadgeColor(Number(averageMark))}`}
            >
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-80">Moyenne Générale</span>
                <div className="text-3xl font-black flex items-baseline gap-1">
                  {averageMark} <span className="text-xs font-normal opacity-70">/ 20</span>
                </div>
              </div>
              <TrendingUp className="h-10 w-10 opacity-30" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-5 bg-white border border-gray-100 rounded-2xl flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">Évaluations Terminées</span>
                <div className="text-3xl font-bold text-gray-900">{filteredGrades.length}</div>
              </div>
              <BookOpen className="h-10 w-10 text-indigo-100" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-5 bg-white border border-gray-100 rounded-2xl flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">Meilleure Note</span>
                <div className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
                  {filteredGrades.length > 0
                    ? Math.max(...filteredGrades.map(g => (g.score / g.maxScore) * 20)).toFixed(1)
                    : '0'
                  }
                  <span className="text-xs font-normal text-gray-400">/ 20</span>
                </div>
              </div>
              <Sparkles className="h-10 w-10 text-emerald-100" />
            </motion.div>
          </div>

          {/* Graphic Section */}
          {chartData.length > 0 && (() => {
            const visualTabs = [
              { id: 'trends', label: language === 'fr' ? 'Tendances de notes' : 'Grade Trends', icon: TrendingUp },
              { id: 'subjects', label: language === 'fr' ? 'Matières & Comparatif' : 'Subjects Comparison', icon: BarChart2 },
              { id: 'distribution', label: language === 'fr' ? 'Répartition / Distribution' : 'Grade Distribution', icon: Activity },
              { id: 'diagnostic', label: language === 'fr' ? 'Diagnostic Académique' : 'Academic Insights', icon: Sparkles }
            ] as const;

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-white border border-gray-150 rounded-2xl space-y-4 shadow-sm"
              >
                {/* Header with Visual Tabs */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 animate-pulse">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        {language === 'fr' ? 'Tableau de Bord de Performance' : 'Student Performance Dashboard'}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {language === 'fr' 
                          ? 'Analyses visuelles de la progression et diagnostic complet.'
                          : 'Visual analysis of student performance, trends, and diagnostic key points.'}
                      </p>
                    </div>
                  </div>

                  {/* Tab Switchers */}
                  <div className="flex flex-wrap bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1 self-start xl:self-auto">
                    {visualTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeVisualTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveVisualTab(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all duration-200 ${
                            isActive
                              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100/80'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                          }`}
                        >
                          <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Contents */}
                <div className="h-76 w-full pt-2">
                  {isMounted ? (
                    <AnimatePresence mode="wait">
                      {activeVisualTab === 'trends' && (
                        <motion.div
                          key="trends"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="h-full flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 px-1 mb-2">
                            <span>
                              {language === 'fr'
                                ? 'Évolution chronologique de toutes les évaluations converties sur 20.'
                                : 'Chronological progression of evaluations normalized to 20.'}
                            </span>
                            <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                              {language === 'fr' ? 'Filtre matière : ' : 'Filter Subject: '}{selectedSubject === 'all' ? (language === 'fr' ? 'Toutes' : 'All') : selectedSubject}
                            </span>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                              <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -22, bottom: 5 }}>
                                <defs>
                                  <linearGradient id="scoreColorGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.00}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="date" 
                                  tickLine={false}
                                  axisLine={false}
                                  tickStyle={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} 
                                  dy={8}
                                />
                                <YAxis 
                                  domain={[0, 20]} 
                                  tickCount={11}
                                  tickLine={false}
                                  axisLine={false}
                                  tickStyle={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} 
                                  dx={-4}
                                />
                                <Tooltip
                                  contentStyle={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '14px',
                                    boxShadow: '0 8px 16px -2px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
                                    fontSize: '11px',
                                    padding: '10px 14px'
                                  }}
                                  formatter={(value: any, name: string, props: any) => {
                                    const payload = props.payload;
                                    const scoreColor = value >= 10 ? 'text-emerald-700 font-extrabold' : 'text-rose-600 font-extrabold';
                                    return [
                                      <div className="space-y-1" key="content">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                          <span>{language === 'fr' ? 'Matière :' : 'Subject:'}</span>
                                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-indigo-700 font-bold">{payload.subject}</span>
                                        </div>
                                        <div className="text-slate-600 font-medium">{language === 'fr' ? 'Éval :' : 'Exam:'} <span className="font-semibold text-slate-900">{payload.examName}</span></div>
                                        <div className="pt-1 text-xs border-t border-slate-100 flex items-center justify-between gap-3">
                                          <span className="text-gray-500 font-sans">{language === 'fr' ? 'Note :' : 'Grade:'}</span>
                                          <span className={scoreColor}>{value} / 20</span>
                                        </div>
                                      </div>,
                                      null
                                    ];
                                  }}
                                  labelFormatter={(label) => `📅 ${language === 'fr' ? 'Date de l\'évaluation' : 'Assessment date'} : ${label}`}
                                />
                                
                                <ReferenceLine 
                                  y={10} 
                                  stroke="#f43f5e" 
                                  strokeDasharray="4 4" 
                                  strokeWidth={1.25}
                                  label={{ 
                                    value: language === 'fr' ? 'Moyenne requise (10/20)' : 'Passing mark (10/20)', 
                                    fill: '#f43f5e', 
                                    fontSize: 8.5, 
                                    position: 'insideBottomRight', 
                                    offset: 7, 
                                    fontWeight: 'bold' 
                                  }} 
                                />

                                <Area
                                  type="monotone"
                                  dataKey="score"
                                  stroke="#4f46e5"
                                  strokeWidth={3}
                                  fillOpacity={1}
                                  fill="url(#scoreColorGrad)"
                                  dot={{ r: 4, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 1.5 }}
                                  activeDot={{ r: 6, stroke: '#4f46e5', strokeWidth: 2, fill: '#ffffff' }}
                                  name="Note"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </motion.div>
                      )}

                      {activeVisualTab === 'subjects' && (
                        <motion.div
                          key="subjects"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="h-full flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 px-1 mb-2">
                            <span>
                              {language === 'fr' 
                                ? 'Moyenne générale calculée par matière.' 
                                : 'Calculated average for each subject.'}
                            </span>
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">
                              {language === 'fr' ? `${subjectAveragesData.length} Matière(s)` : `${subjectAveragesData.length} Subject(s)`}
                            </span>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                              <BarChart data={subjectAveragesData} margin={{ top: 15, right: 15, left: -22, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="subject" 
                                  tickLine={false}
                                  axisLine={false}
                                  tickStyle={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} 
                                  dy={8}
                                />
                                <YAxis 
                                  domain={[0, 20]} 
                                  tickCount={6}
                                  tickLine={false}
                                  axisLine={false}
                                  tickStyle={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} 
                                  dx={-4}
                                />
                                <Tooltip
                                  contentStyle={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    fontSize: '11px',
                                  }}
                                  formatter={(value: any, name: string, props: any) => {
                                    const payload = props.payload;
                                    return [
                                      <div className="space-y-1" key="content">
                                        <div className="font-bold text-slate-800">{payload.subject}</div>
                                        <div className="text-indigo-600 font-bold">Moyenne : {value} / 20</div>
                                        <div className="text-[10px] text-gray-500">{payload.count} {language === 'fr' ? 'évaluation(s)' : 'evaluation(s)'}</div>
                                      </div>,
                                      null
                                    ];
                                  }}
                                />
                                <ReferenceLine 
                                  y={10} 
                                  stroke="#f43f5e" 
                                  strokeDasharray="4 4" 
                                  strokeWidth={1}
                                />
                                <Bar 
                                  dataKey="average" 
                                  radius={[8, 8, 0, 0]} 
                                  maxBarSize={45}
                                >
                                  {subjectAveragesData.map((entry, idx) => {
                                    const fillVal = entry.average >= 14 ? '#10b981' : entry.average >= 10 ? '#3b82f6' : '#ef4444';
                                    return <Cell key={`cell-${idx}`} fill={fillVal} />;
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </motion.div>
                      )}

                      {activeVisualTab === 'distribution' && (
                        <motion.div
                          key="distribution"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="h-full flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 px-1 mb-2">
                            <span>
                              {language === 'fr' 
                                ? 'Répartition des évaluations de l\'élève selon le barème officiel.' 
                                : 'Grade frequency distribution within academic brackets.'}
                            </span>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                              <BarChart data={distributionData} margin={{ top: 15, right: 15, left: -22, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="range" 
                                  tickLine={false}
                                  axisLine={false}
                                  tickStyle={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                                  dy={8}
                                />
                                <YAxis 
                                  allowDecimals={false}
                                  tickLine={false}
                                  axisLine={false}
                                  tickStyle={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} 
                                  dx={-4}
                                />
                                <Tooltip
                                  contentStyle={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                  }}
                                  formatter={(value: any, name: string, props: any) => {
                                    const payload = props.payload;
                                    return [
                                      <div className="space-y-0.5" key="content">
                                        <div className="font-bold text-slate-800">{payload.label} ({payload.range})</div>
                                        <div className="text-indigo-600 font-extrabold">{value} {language === 'fr' ? 'évaluations' : 'evaluations'}</div>
                                      </div>,
                                      null
                                    ];
                                  }}
                                />
                                <Bar 
                                  dataKey="count" 
                                  radius={[8, 8, 0, 0]} 
                                  maxBarSize={55}
                                >
                                  {distributionData.map((entry, idx) => (
                                    <Cell key={`cell-${idx}`} fill={entry.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </motion.div>
                      )}

                      {activeVisualTab === 'diagnostic' && (
                        <motion.div
                          key="diagnostic"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="h-full grid grid-cols-1 md:grid-cols-3 gap-3.5 overflow-y-auto pr-1"
                        >
                          {/* Box 1: Strengths & Weaknesses */}
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                            <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                              {language === 'fr' ? 'Points Clés' : 'Key Areas'}
                            </h4>
                            
                            <div className="space-y-1.5 pt-0.5">
                              {strongestSubject && (
                                <div className="flex items-center justify-between bg-white px-2.5 py-2 rounded-lg border border-slate-100 shadow-3xs">
                                  <div className="space-y-0.5">
                                    <div className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" /> {language === 'fr' ? 'Point fort' : 'Strength'}
                                    </div>
                                    <div className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{strongestSubject.subject}</div>
                                  </div>
                                  <div className="text-sm font-black text-emerald-600">{strongestSubject.average} <span className="text-[9px] font-medium text-slate-400">/20</span></div>
                                </div>
                              )}

                              {weakestSubject && strongestSubject?.subject !== weakestSubject.subject && (
                                <div className="flex items-center justify-between bg-white px-2.5 py-2 rounded-lg border border-slate-100 shadow-3xs">
                                  <div className="space-y-0.5">
                                    <div className="text-[9px] text-rose-600 font-bold flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> {language === 'fr' ? 'À consolider' : 'Needs Work'}
                                    </div>
                                    <div className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{weakestSubject.subject}</div>
                                  </div>
                                  <div className="text-sm font-black text-rose-500">{weakestSubject.average} <span className="text-[9px] font-medium text-slate-400">/20</span></div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Box 2: Rigour & Volatility */}
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                            <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                              {language === 'fr' ? 'Régularité du Profil' : 'Academic Consistency'}
                            </h4>
                            <div className="space-y-1.5 pt-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600">{language === 'fr' ? 'Écart-type' : 'Std Deviation'} :</span>
                                <span className="text-xs font-mono font-bold text-slate-800">{stdDevVal.toFixed(2)}</span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-slate-100 text-[10px] font-medium text-slate-500 shadow-3xs leading-relaxed">
                                {stdDevVal < 1.5 ? (
                                  <span className="text-emerald-700 font-semibold">
                                    {language === 'fr' 
                                      ? '✓ Résultats très homogènes. Le travail est régulier à chaque évaluation.'
                                      : '✓ Highly consistent results across different tests.'}
                                  </span>
                                ) : stdDevVal < 3.0 ? (
                                  <span className="text-indigo-700 font-semibold">
                                    {language === 'fr' 
                                      ? '⚠ Écart-type modéré. Des variations mineures selon les thématiques.'
                                      : '⚠ Moderate consistency. Results vary slightly between chapters.'}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-semibold">
                                    {language === 'fr' 
                                      ? '⚡ Forte volatilité. Des pics d\'excellence alternés de notes plus fragiles.'
                                      : '⚡ High grade volatility. Significant gaps between top and lower scores.'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Box 3: Dynamics & Forecast */}
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                            <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                              {language === 'fr' ? 'Tendance & Appréciation' : 'Semester Trend'}
                            </h4>
                            <div className="space-y-1.5 pt-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600">{language === 'fr' ? 'Tendance' : 'Trend'} :</span>
                                <div className="flex items-center gap-1 text-xs font-bold">
                                  {trendDiffVal > 0.5 ? (
                                    <span className="text-emerald-600 flex items-center gap-0.5">
                                      <TrendingUp className="h-3.5 w-3.5" /> +{trendDiffVal.toFixed(1)}
                                    </span>
                                  ) : trendDiffVal < -0.5 ? (
                                    <span className="text-rose-600 flex items-center gap-0.5">
                                      <TrendingDown className="h-3.5 w-3.5" /> {trendDiffVal.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">
                                      {language === 'fr' ? 'Stable' : 'Stable'} ({trendDiffVal >= 0 ? '+' : ''}{trendDiffVal.toFixed(1)})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-slate-100 text-[10px] font-medium text-slate-500 shadow-3xs leading-relaxed">
                                <span className="text-slate-700 font-medium">
                                  {language === 'fr' ? 'Mention indicative : ' : 'Indicative honor: '}
                                  <span className="font-extrabold text-indigo-700">{getHonorsMention(Number(averageMark))}</span>
                                </span>
                                <p className="mt-1 border-t border-slate-100 pt-1 text-[9px] text-slate-400">
                                  {language === 'fr' 
                                    ? 'Analyse automatisée basée sur l\'évolution relative du trimestre.'
                                    : 'Diagnostic analysis based on progress over consecutive periods.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400 font-medium font-sans">
                      {language === 'fr' ? 'Chargement du tableau de bord...' : 'Loading performance dashboard...'}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* Select and Filter Row */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Détail des Évaluations</h3>
              <div className="flex items-center gap-2 flex-wrap text-left">
                <span className="text-xs font-semibold text-gray-400">Filtrer par matière :</span>
                <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                  {subjects.map((subj) => (
                    <button
                      key={subj}
                      onClick={() => setSelectedSubject(subj)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                        selectedSubject === subj
                          ? 'bg-white text-gray-900 shadow-3xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {subj === 'all' ? 'Toutes' : subj}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredGrades.map((g, idx) => {
                  const relativeScore = (g.score / g.maxScore) * 20;
                  const isCustom = g.id.startsWith('gr_') && Number(g.id.split('_')[1]) > 10000;

                  return (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.04 }}
                      className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between gap-4 flex-wrap hover:shadow-xs group duration-200 transition-all"
                    >
                      <div className="flex-1 space-y-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md font-medium">
                            {g.subject}
                          </span>
                          <span className="text-[11px] font-mono text-gray-400">
                            {new Date(g.date).toLocaleDateString('fr-FR')}
                          </span>
                          {activeStudent?.gradesValidated ? (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Validated
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Pending
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {g.examName}
                        </h4>
                        <p className="text-xs text-gray-500 italic">
                          "{g.teacherRemarks}"
                        </p>
                      </div>

                      {/* Display score and custom delete action */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className={`text-lg font-bold px-3 py-1 rounded-xl ${
                            relativeScore >= 16 ? 'bg-emerald-50 text-emerald-700' :
                            relativeScore >= 12 ? 'bg-indigo-50 text-indigo-700' :
                            relativeScore >= 10 ? 'bg-amber-50 text-amber-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {g.score} <span className="text-xs opacity-60">/ {g.maxScore}</span>
                          </span>
                          <div className="text-[10px] text-gray-400 font-mono mt-1">
                            {relativeScore.toFixed(1)} / 20 eq.
                          </div>
                        </div>

                        {onDeleteGrade && (
                          <button
                            type="button"
                            onClick={() => handleDelete(g.id, g.examName)}
                            className={`text-red-650 hover:text-red-800 p-1.5 bg-red-100/15 hover:bg-red-200/30 border border-transparent hover:border-red-500/10 rounded-xl transition duration-200 cursor-pointer ${
                              isPedAuthorized || isCustom ? 'opacity-100' : 'opacity-45 hover:opacity-105 md:opacity-0 md:group-hover:opacity-100'
                            }`}
                            title="Supprimer cette note"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
