import React, { useState } from 'react';
import { Student, ApeeParent, Grade, Attendance, Message, ApeeSettings } from '../types';
import { 
  Users, 
  Search, 
  GraduationCap, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Award, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  MessageSquare, 
  Printer, 
  X, 
  ChevronRight, 
  Building, 
  CreditCard, 
  Receipt,
  Download,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../utils/TranslationContext';
import { jsPDF } from 'jspdf';

interface StudentsByClassProps {
  students: Student[];
  apeeParents?: ApeeParent[];
  grades?: Grade[];
  attendanceLogs?: Attendance[];
  messages?: Message[];
  settings?: ApeeSettings;
  onSelectStudent?: (studentId: string) => void;
  onUpdateStudent?: (updated: Student) => Promise<boolean>;
}

export default function StudentsByClass({
  students,
  apeeParents = [],
  grades = [],
  attendanceLogs = [],
  messages = [],
  settings,
  onSelectStudent,
  onUpdateStudent,
}: StudentsByClassProps) {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'profile' | 'grades' | 'attendance' | 'finance' | 'messages'>('profile');

  // Helper to extract unique classes
  const classes = Array.from(new Set(students.map(s => s.classRoom || 'Non spécifiée'))).sort();

  // Group students by class
  const studentsByClass: Record<string, Student[]> = {};
  students.forEach(s => {
    const cls = s.classRoom || 'Non spécifiée';
    if (!studentsByClass[cls]) {
      studentsByClass[cls] = [];
    }
    studentsByClass[cls].push(s);
  });

  // Filter students based on classroom & search query
  const filteredStudents = students.filter(s => {
    const classMatches = selectedClass === 'all' || (s.classRoom || 'Non spécifiée') === selectedClass;
    const nameMatches = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (s.classRoom || '').toLowerCase().includes(searchQuery.toLowerCase());
    return classMatches && nameMatches;
  });

  // Matching parent helper
  const getStudentParent = (student: Student): ApeeParent | undefined => {
    // 1. Try finding by matching student in parent profile linked students
    const foundByLink = apeeParents.find(p => 
      p.students?.some(s => s.name.trim().toLowerCase() === student.name.trim().toLowerCase())
    );
    if (foundByLink) return foundByLink;

    // 2. Try by student ID breakdown (stu_parentId_xxx)
    if (student.id.startsWith('stu_')) {
      const parts = student.id.split('_');
      if (parts.length >= 3 && parts[0] === 'stu') {
        const pId = parts.slice(1, -1).join('_');
        const found = apeeParents.find(p => p.id === pId);
        if (found) return found;
      }
    }

    // 3. Fallback to matching parentId directly
    return apeeParents.find(p => p.id === student.parentId);
  };

  // Moyenne générale for a specific student helper
  const getStudentGPA = (studentId: string) => {
    const studentGrades = grades.filter(g => g.studentId === studentId);
    if (studentGrades.length === 0) return null;
    const totalNormalized = studentGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0);
    return Number((totalNormalized / studentGrades.length).toFixed(2));
  };

  // Attendance rate helper
  const getStudentAttendanceRate = (studentId: string) => {
    const logs = attendanceLogs.filter(a => a.studentId === studentId);
    if (logs.length === 0) return 100;
    const absentCount = logs.filter(a => a.status === 'Absent').length;
    const presentOrLate = logs.length - absentCount;
    return Number(((presentOrLate / logs.length) * 100).toFixed(1));
  };

  // Generate beautiful PDF report card
  const exportPDFCard = (student: Student) => {
    const doc = new jsPDF();
    const parent = getStudentParent(student);
    const sGrades = grades.filter(g => g.studentId === student.id);
    const sAttendance = attendanceLogs.filter(a => a.studentId === student.id);
    const gpa = getStudentGPA(student.id);

    // Decorative Header Band
    doc.setFillColor(30, 41, 59); // dark slate grey
    doc.rect(0, 0, 210, 38, 'F');

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(settings?.associationName || "RAPPORT SCOLAIRE INDIVIDUEL", 15, 16);

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(`Parents-Schools Management System (Pasma-sys) | Document Officiel`, 15, 24);
    doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 15, 30);

    // Main section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text("FICHE NOMINATIVE & RÉSULTATS", 15, 48);

    // Split line
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.5);
    doc.line(15, 52, 195, 52);

    // Profile Grid Left
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text("ÉLÈVE :", 15, 60);
    doc.setFont('Helvetica', 'normal');
    doc.text(student.name, 45, 60);

    doc.setFont('Helvetica', 'bold');
    doc.text("CLASSE :", 15, 66);
    doc.setFont('Helvetica', 'normal');
    doc.text(student.classRoom || "N/A", 45, 66);

    doc.setFont('Helvetica', 'bold');
    doc.text("DATE NAISSANCE :", 15, 72);
    doc.setFont('Helvetica', 'normal');
    doc.text(student.dob || "N/A", 45, 72);

    doc.setFont('Helvetica', 'bold');
    doc.text("ENSEIGNANT :", 15, 78);
    doc.setFont('Helvetica', 'normal');
    doc.text(student.teacherName || "Non assigné", 45, 78);

    // Profile Grid Right (Parent)
    if (parent) {
      doc.setFont('Helvetica', 'bold');
      doc.text("PARENT / GUARDIAN :", 110, 60);
      doc.setFont('Helvetica', 'normal');
      doc.text(parent.name, 150, 60);

      doc.setFont('Helvetica', 'bold');
      doc.text("TÉLÉPHONE :", 110, 66);
      doc.setFont('Helvetica', 'normal');
      doc.text(parent.phone, 150, 66);

      doc.setFont('Helvetica', 'bold');
      doc.text("STATUT COTISATION :", 110, 72);
      doc.setFont('Helvetica', 'bold');
      if (parent.status === 'soldé') {
        doc.setTextColor(16, 124, 65); // Green
        doc.text("SOLDÉ (À jour)", 150, 72);
      } else if (parent.status === 'partiel') {
        doc.setTextColor(190, 100, 0); // Orange
        doc.text("PARTIEL", 150, 72);
      } else {
        doc.setTextColor(180, 0, 0); // Red
        doc.text("RETARD", 150, 72);
      }
      doc.setTextColor(30, 41, 59);
    }

    // Performance block
    doc.setFillColor(245, 247, 250);
    doc.rect(15, 86, 180, 20, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`MOYENNE GÉNÉRALE : ${gpa !== null ? `${gpa} / 20` : 'Aucune note'}`, 25, 98);
    const attRate = getStudentAttendanceRate(student.id);
    doc.text(`TAUX DE PRÉSENCE : ${attRate}%`, 115, 98);

    // Grades Table
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text("RELEVÉ DES NOTES", 15, 118);
    doc.line(15, 122, 195, 122);

    doc.setFontSize(9);
    doc.text("Matière", 15, 128);
    doc.text("Évaluation", 70, 128);
    doc.text("Note", 130, 128);
    doc.text("Appréciation Enseignant", 150, 128);
    doc.line(15, 131, 195, 131);

    let y = 137;
    doc.setFont('Helvetica', 'normal');
    if (sGrades.length === 0) {
      doc.text("Aucune note enregistrée pour cet élève.", 15, y);
      y += 10;
    } else {
      sGrades.forEach(g => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(g.subject, 15, y);
        doc.text(g.examName, 70, y);
        doc.setFont('Helvetica', 'bold');
        doc.text(`${g.score}/${g.maxScore}`, 130, y);
        doc.setFont('Helvetica', 'normal');
        doc.text(g.teacherRemarks || "-", 150, y, { maxWidth: 42 });
        y += 8;
      });
    }

    // Attendance Section
    y += 8;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text("ASSIDUITÉ & PRÉSENCES", 15, y);
    doc.line(15, y + 4, 195, y + 4);
    y += 11;

    doc.setFontSize(9);
    doc.text("Date", 15, y);
    doc.text("Statut", 60, y);
    doc.text("Remarques / Justificatifs", 110, y);
    doc.line(15, y + 3, 195, y + 3);
    y += 9;

    doc.setFont('Helvetica', 'normal');
    const logsToShow = sAttendance.slice(0, 10); // Show top 10 logs
    if (logsToShow.length === 0) {
      doc.text("Aucun incident d'absence ou de retard signalé.", 15, y);
      y += 10;
    } else {
      logsToShow.forEach(log => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(new Date(log.date).toLocaleDateString('fr-FR'), 15, y);
        doc.setFont('Helvetica', 'bold');
        if (log.status === 'Absent') {
          doc.setTextColor(180, 0, 0);
          doc.text("Absent(e)", 60, y);
        } else if (log.status === 'Late') {
          doc.setTextColor(190, 100, 0);
          doc.text("En retard", 60, y);
        } else if (log.status === 'Excused') {
          doc.setTextColor(0, 100, 180);
          doc.text("Absence Justifiée", 60, y);
        } else {
          doc.setTextColor(16, 124, 65);
          doc.text("Présent(e)", 60, y);
        }
        doc.setTextColor(30, 41, 59);
        doc.setFont('Helvetica', 'normal');
        doc.text(log.remarks || "-", 110, y, { maxWidth: 80 });
        y += 8;
      });
      if (sAttendance.length > 10) {
        doc.setFont('Helvetica', 'italic');
        doc.text(`... et ${sAttendance.length - 10} autres enregistrements.`, 15, y);
      }
    }

    // Signature Block at footer
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("Signature du Directeur d'École", 140, 275);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.text("Signé numériquement via Pasma-sys Cloud", 137, 280);

    doc.save(`Fiche_${student.name.replace(/\s+/g, '_')}_Class.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* Header and overview banners */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850 dark:text-slate-100">
                {isFr ? "Liste Nominative des Élèves par Classe" : "Nominal List of Students by Class"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFr ? "Visualisez rapidement les élèves, filtrez par classe, et accédez à leurs informations complètes." : "Quickly list students, filter by class, and access their complete academic, attendance, and fee details."}
              </p>
            </div>
          </div>
        </div>

        {/* Global Statistics Indicators */}
        <div className="flex flex-wrap gap-2 md:self-end">
          <div className="bg-slate-50 dark:bg-slate-950/20 px-3.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{isFr ? "Élèves" : "Pupils"}</span>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{students.length}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/20 px-3.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{isFr ? "Classes" : "Classes"}</span>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400">{classes.length}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/20 px-3.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{isFr ? "Assiduité" : "Attendance"}</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              {(attendanceLogs.length > 0 
                ? ((attendanceLogs.filter(a => a.status !== 'Absent').length / attendanceLogs.length) * 100).toFixed(1) 
                : "98.2")}%
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Main Panel: Filters + nominal cards */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: Classroom Quick Selectors */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{isFr ? "Filtre par Classe" : "Filter by Class"}</span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">{classes.length}</span>
            </div>

            <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedClass('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                  selectedClass === 'all'
                    ? 'bg-indigo-650 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                }`}
              >
                <span className="flex items-center gap-2">🏫 {isFr ? "Toutes les classes" : "All classes"}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedClass === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{students.length}</span>
              </button>

              {classes.map(cls => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                    selectedClass === cls
                      ? 'bg-indigo-650 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <span className="flex items-center gap-2">📂 {cls}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedClass === cls ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{studentsByClass[cls]?.length || 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Nominal List Grid */}
        <div className="xl:col-span-3 space-y-4">
          
          {/* Live search input bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-550" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isFr ? "Rechercher rapidement un élève par nom ou classe..." : "Search pupil by name or class..."}
              className="w-full pl-10 pr-10 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded"
              >
                ×
              </button>
            )}
          </div>

          {/* Table / Grid list of pupil names */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-950/20 text-slate-450 dark:text-slate-500 border-b border-slate-150 dark:border-slate-800/80 font-semibold">
                    <th className="p-3.5 pl-5">{isFr ? "Élève (Nom & Avatar)" : "Student Name"}</th>
                    <th className="p-3.5">{isFr ? "Classe" : "Class"}</th>
                    <th className="p-3.5">{isFr ? "Moyenne Générale" : "GPA (Average)"}</th>
                    <th className="p-3.5">{isFr ? "Assiduité" : "Attendance Rate"}</th>
                    <th className="p-3.5">{isFr ? "Parent Associé" : "Associated Parent"}</th>
                    <th className="p-3.5 pr-5 text-right">{isFr ? "Action" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(stu => {
                      const parent = getStudentParent(stu);
                      const gpa = getStudentGPA(stu.id);
                      const attendance = getStudentAttendanceRate(stu.id);

                      return (
                        <tr 
                          key={stu.id} 
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/15 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedStudent(stu);
                            setActiveDetailTab('profile');
                          }}
                        >
                          {/* Name & Avatar */}
                          <td className="p-3.5 pl-5">
                            <div className="flex items-center gap-3">
                              {stu.avatar ? (
                                <img 
                                  src={stu.avatar} 
                                  alt={stu.name} 
                                  referrerPolicy="no-referrer"
                                  className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-800"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[11px] border border-indigo-100 dark:border-indigo-900/40">
                                  {stu.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white text-xs hover:text-indigo-600 dark:hover:text-indigo-400">{stu.name}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">ID: {stu.id.replace('stu_', '')}</p>
                              </div>
                            </div>
                          </td>

                          {/* Classroom */}
                          <td className="p-3.5">
                            <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold text-[10px]">
                              {stu.classRoom || "CM2-A"}
                            </span>
                          </td>

                          {/* GPA (Moyenne) */}
                          <td className="p-3.5">
                            {gpa !== null ? (
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-black ${gpa >= 12 ? 'text-emerald-600 dark:text-emerald-400' : gpa >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {gpa.toFixed(1)} / 20
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-normal italic">Aucune note</span>
                            )}
                          </td>

                          {/* Attendance Rate */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold ${attendance >= 95 ? 'text-emerald-600 dark:text-emerald-400' : attendance >= 85 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {attendance}%
                              </span>
                            </div>
                          </td>

                          {/* Associated Parent */}
                          <td className="p-3.5 text-slate-550 dark:text-slate-400 font-normal">
                            {parent ? (
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{parent.name}</p>
                                <p className="text-[9.5px] font-mono text-slate-400">{parent.phone}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 italic">Non renseigné</span>
                            )}
                          </td>

                          {/* Quick details trigger button */}
                          <td className="p-3.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedStudent(stu);
                                setActiveDetailTab('profile');
                              }}
                              className="inline-flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-black px-2.5 py-1 rounded-xl transition cursor-pointer"
                            >
                              <span>{isFr ? "Consulter" : "View profile"}</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-550 italic">
                        {isFr ? "Aucun élève trouvé pour cette sélection." : "No pupils found matching this query."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL: Full Student Information Panel */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              
              {/* Modal header with student photo & main card */}
              <div className="relative bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 md:p-6 flex flex-col md:flex-row items-center gap-5 justify-between">
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-full transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex flex-col md:flex-row items-center gap-4.5 text-center md:text-left">
                  {selectedStudent.avatar ? (
                    <img 
                      src={selectedStudent.avatar} 
                      alt={selectedStudent.name} 
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover border-2 border-white/20 shadow-md"
                    />
                  ) : (
                    <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg border border-white/10 shadow-md">
                      {selectedStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <h3 className="text-lg font-bold text-white leading-tight">{selectedStudent.name}</h3>
                      <span className="inline-block bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider self-center border border-indigo-500/30">
                        {selectedStudent.classRoom || "CM2-A"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {isFr ? "Dossier scolaire consolidé" : "Consolidated school records"} • ID: {selectedStudent.id.replace('stu_', '')}
                    </p>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px] text-indigo-200">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {selectedStudent.dob || "Date de naissance non spécifiée"}</span>
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {selectedStudent.teacherName || "Directeur d'école"}</span>
                    </div>
                  </div>
                </div>

                {/* Print individual report card PDF trigger */}
                <div className="shrink-0 pt-3 md:pt-0">
                  <button
                    onClick={() => exportPDFCard(selectedStudent)}
                    className="flex items-center gap-1.5 text-[10.5px] bg-white/10 hover:bg-white/20 border border-white/15 text-white font-extrabold px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{isFr ? "Exporter Fiche PDF" : "Export PDF Sheet"}</span>
                  </button>
                </div>

              </div>

              {/* Detail Navigation Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 overflow-x-auto">
                <button
                  onClick={() => setActiveDetailTab('profile')}
                  className={`px-5 py-3 text-xs font-bold border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                    activeDetailTab === 'profile'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  👤 {isFr ? "Identité & Parent" : "Identity & Parent"}
                </button>
                <button
                  onClick={() => setActiveDetailTab('grades')}
                  className={`px-5 py-3 text-xs font-bold border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                    activeDetailTab === 'grades'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  📚 {isFr ? "Matières & Notes" : "Subjects & Grades"}
                </button>
                <button
                  onClick={() => setActiveDetailTab('attendance')}
                  className={`px-5 py-3 text-xs font-bold border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                    activeDetailTab === 'attendance'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  ⏱️ {isFr ? "Assiduité" : "Attendance Tracker"}
                </button>
                <button
                  onClick={() => setActiveDetailTab('finance')}
                  className={`px-5 py-3 text-xs font-bold border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                    activeDetailTab === 'finance'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  💳 {isFr ? "APEE & Cotisations" : "APEE & Fees"}
                </button>
                <button
                  onClick={() => setActiveDetailTab('messages')}
                  className={`px-5 py-3 text-xs font-bold border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                    activeDetailTab === 'messages'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  💬 {isFr ? "Messages" : "Message Logs"}
                </button>
              </div>

              {/* Modal scrollable body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-50/20 dark:bg-slate-950/5">
                
                {/* TAB 1: PROFILE / PARENT IDENTITY */}
                {activeDetailTab === 'profile' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-200">
                    
                    {/* Academic block */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b pb-1.5">{isFr ? "Cursus de l'élève" : "Student Curriculum"}</h4>
                      
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                          <span className="text-slate-450">{isFr ? "Classe d'affectation" : "Assigned Class"}</span>
                          <span className="font-bold text-slate-850 dark:text-white">{selectedStudent.classRoom || "Non assignée"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                          <span className="text-slate-450">{isFr ? "Enseignant principal" : "Form Teacher"}</span>
                          <span className="font-bold text-slate-850 dark:text-white">{selectedStudent.teacherName || "Directeur"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                          <span className="text-slate-450">{isFr ? "Email enseignant" : "Teacher Email"}</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-400">{selectedStudent.teacherEmail || "contact@pasma.sys"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                          <span className="text-slate-450">{isFr ? "Date de naissance" : "Birthdate"}</span>
                          <span className="font-bold text-slate-850 dark:text-white">{selectedStudent.dob || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-450">{isFr ? "Statut dossiers scolaires" : "Record status"}</span>
                          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/35 text-emerald-600 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded">CONFORME</span>
                        </div>
                      </div>
                    </div>

                    {/* Parent block */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b pb-1.5">{isFr ? "Filiation & Parents" : "Parent Details"}</h4>
                      
                      {getStudentParent(selectedStudent) ? (
                        (() => {
                          const parent = getStudentParent(selectedStudent)!;
                          return (
                            <div className="space-y-3.5 text-xs">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                  <User className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] text-slate-400 font-semibold">{isFr ? "Père / Tuteur principal" : "Primary Guardian"}</p>
                                  <p className="font-bold text-slate-850 dark:text-white">{parent.name}</p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                  <Phone className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] text-slate-400 font-semibold">{isFr ? "Téléphone mobile" : "Phone"}</p>
                                  <p className="font-semibold text-slate-850 dark:text-white font-mono">{parent.phone}</p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                                  <Mail className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] text-slate-400 font-semibold">{isFr ? "Courriel" : "Email"}</p>
                                  <p className="font-semibold text-slate-700 dark:text-slate-300 truncate">{parent.email || "Non spécifié"}</p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 rounded-xl">
                                  <MapPin className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] text-slate-400 font-semibold">{isFr ? "Adresse domiciliaire" : "Home Address"}</p>
                                  <p className="font-medium text-slate-650 dark:text-slate-350">{parent.address || "Non spécifiée"}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-center py-6 text-slate-400 italic">
                          {isFr ? "Aucun parent associé à cet élève dans l'annuaire de l'APEE." : "No matching parent profile associated."}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* TAB 2: GRADES & RESULTS */}
                {activeDetailTab === 'grades' && (
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">{isFr ? "Fiche de Notes (Relevé)" : "Grade Report"}</h4>
                      {getStudentGPA(selectedStudent.id) !== null && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-black text-xs px-3 py-1 rounded-xl border border-indigo-100">
                          {isFr ? "Moyenne Générale :" : "GPA:"} {getStudentGPA(selectedStudent.id)} / 20
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-950/10 text-slate-400 border-b">
                            <th className="p-2.5">{isFr ? "Matière" : "Subject"}</th>
                            <th className="p-2.5">{isFr ? "Évaluation" : "Exam Name"}</th>
                            <th className="p-2.5">{isFr ? "Date" : "Date"}</th>
                            <th className="p-2.5">{isFr ? "Note brute" : "Score"}</th>
                            <th className="p-2.5">{isFr ? "Note sur 20" : "Normalized (/20)"}</th>
                            <th className="p-2.5">{isFr ? "Remarque Enseignant" : "Teacher Remark"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                          {grades.filter(g => g.studentId === selectedStudent.id).length > 0 ? (
                            grades.filter(g => g.studentId === selectedStudent.id).map(g => {
                              const norm = (g.score / g.maxScore) * 20;
                              return (
                                <tr key={g.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 font-medium">
                                  <td className="p-2.5 font-bold text-slate-850 dark:text-white">{g.subject}</td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{g.examName}</td>
                                  <td className="p-2.5 text-slate-400">{new Date(g.date).toLocaleDateString('fr-FR')}</td>
                                  <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">{g.score} / {g.maxScore}</td>
                                  <td className="p-2.5 font-mono">
                                    <span className={`font-black ${norm >= 12 ? 'text-emerald-600 dark:text-emerald-400' : norm >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                      {norm.toFixed(1)} / 20
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-slate-500 font-normal italic">{g.teacherRemarks || "-"}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                                {isFr ? "Aucune note saisie à ce jour pour cet élève." : "No grades entries found for this student yet."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 3: ATTENDANCE */}
                {activeDetailTab === 'attendance' && (
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">{isFr ? "Registre d'Assiduité" : "Attendance Sheet"}</h4>
                      <div className="flex gap-2">
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded">
                          {isFr ? "Présences :" : "Present:"} {attendanceLogs.filter(a => a.studentId === selectedStudent.id && a.status === 'Present').length}
                        </span>
                        <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded">
                          {isFr ? "Absences :" : "Absences:"} {attendanceLogs.filter(a => a.studentId === selectedStudent.id && a.status === 'Absent').length}
                        </span>
                        <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded">
                          {isFr ? "Retards :" : "Lates:"} {attendanceLogs.filter(a => a.studentId === selectedStudent.id && a.status === 'Late').length}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-950/10 text-slate-400 border-b">
                            <th className="p-2.5">{isFr ? "Date de l'appel" : "Class Call Date"}</th>
                            <th className="p-2.5">{isFr ? "Statut de présence" : "Attendance Status"}</th>
                            <th className="p-2.5">{isFr ? "Observations / Justifications" : "Remarks / Apologies"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                          {attendanceLogs.filter(a => a.studentId === selectedStudent.id).length > 0 ? (
                            attendanceLogs.filter(a => a.studentId === selectedStudent.id).map(a => (
                              <tr key={a.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 font-medium">
                                <td className="p-2.5 font-bold text-slate-850 dark:text-white">{new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                <td className="p-2.5">
                                  {a.status === 'Present' && (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                                      {isFr ? "Présent(e)" : "Present"}
                                    </span>
                                  )}
                                  {a.status === 'Late' && (
                                    <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                                      {isFr ? "Retard" : "Late"}
                                    </span>
                                  )}
                                  {a.status === 'Absent' && (
                                    <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                                      {isFr ? "Absent(e)" : "Absent"}
                                    </span>
                                  )}
                                  {a.status === 'Excused' && (
                                    <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                                      {isFr ? "Absence Justifiée" : "Excused"}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-500 font-normal italic">{a.remarks || "-"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="text-center py-6 text-slate-400 italic">
                                {isFr ? "Aucun incident d'assiduité signalé." : "No attendance logs recorded."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 4: APEE FINANCIALS */}
                {activeDetailTab === 'finance' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    
                    {/* Financial stats */}
                    {getStudentParent(selectedStudent) ? (
                      (() => {
                        const parent = getStudentParent(selectedStudent)!;
                        const currency = settings?.currency || 'FCFA';
                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{isFr ? "Exigible total" : "Total Dues"}</span>
                                <p className="text-base font-black text-slate-800 dark:text-white mt-0.5 font-mono">{parent.totalDue.toLocaleString()} {currency}</p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{isFr ? "Déjà versé" : "Total Paid"}</span>
                                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">{parent.totalPaid.toLocaleString()} {currency}</p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{isFr ? "Reste à payer" : "Remaining Balance"}</span>
                                <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">{(parent.totalDue - parent.totalPaid).toLocaleString()} {currency}</p>
                              </div>
                            </div>

                            {/* Payment list ledger */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b pb-1.5">{isFr ? "Historique des versements encaissés" : "Transaction History"}</h4>
                              
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-950/10 text-slate-400 border-b">
                                      <th className="p-2.5">{isFr ? "Référence Reçu" : "Receipt ID"}</th>
                                      <th className="p-2.5">{isFr ? "Date versement" : "Date"}</th>
                                      <th className="p-2.5">{isFr ? "Montant" : "Amount"}</th>
                                      <th className="p-2.5">{isFr ? "Mode de paiement" : "Method"}</th>
                                      <th className="p-2.5">{isFr ? "Notes" : "Notes"}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                    {parent.payments && parent.payments.length > 0 ? (
                                      parent.payments.map(pay => (
                                        <tr key={pay.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 font-medium">
                                          <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{pay.transactionId || pay.id.substring(0, 10).toUpperCase()}</td>
                                          <td className="p-2.5 text-slate-500">{new Date(pay.date).toLocaleDateString('fr-FR')}</td>
                                          <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{pay.amount.toLocaleString()} {currency}</td>
                                          <td className="p-2.5">
                                            <span className="bg-slate-100 dark:bg-slate-800 text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase">
                                              {pay.method || "Espèces"}
                                            </span>
                                          </td>
                                          <td className="p-2.5 text-slate-450 font-normal">{pay.note || "-"}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                                          {isFr ? "Aucun versement n'a encore été enregistré pour cette famille." : "No payment entries logged."}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs text-center py-8 text-slate-400 italic">
                        {isFr ? "Aucune donnée financière disponible pour cet élève (aucun tuteur rattaché)." : "No parent financial ledger available for this student."}
                      </div>
                    )}

                  </div>
                )}

                {/* TAB 5: COMMUNICATIONS / MESSAGES */}
                {activeDetailTab === 'messages' && (
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 animate-in fade-in duration-200">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b pb-1.5">{isFr ? "Logs des notifications parents" : "Parent Communication Logs"}</h4>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {messages.filter(m => m.studentId === selectedStudent.id).length > 0 ? (
                        messages.filter(m => m.studentId === selectedStudent.id).map(msg => (
                          <div 
                            key={msg.id} 
                            className={`p-3 rounded-2xl text-xs space-y-1.5 border max-w-[85%] ${
                              msg.senderType === 'Teacher' 
                                ? 'bg-indigo-50/50 border-indigo-100 text-indigo-950 ml-auto dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-200' 
                                : 'bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-750 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 text-[9.5px] font-bold text-slate-400">
                              <span>{msg.senderType === 'Teacher' ? (msg.teacherName || "Enseignant (Vous)") : "Parent d'Élève"}</span>
                              <span className="font-mono">{new Date(msg.timestamp).toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="font-medium whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-400 italic">
                          {isFr ? "Aucun message échangé avec le parent de cet élève." : "No messages history found."}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal footer */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 border-t border-slate-200 dark:border-slate-800 text-right">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs px-5 py-2 rounded-2xl cursor-pointer transition"
                >
                  {isFr ? "Fermer le dossier" : "Close file"}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
