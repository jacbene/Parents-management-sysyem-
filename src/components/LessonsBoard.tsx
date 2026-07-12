import React, { useState, useRef } from 'react';
import { Student, Lesson, Homework, HomeworkStatus } from '../types';
import { 
  BookOpen, Plus, Trash2, Sparkles, Download, Calendar, 
  ChevronDown, ChevronUp, GraduationCap, CheckCircle2, 
  Loader2, ArrowRight, FileText, CheckSquare, Info,
  FileUp, Eye, EyeOff, File
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { jsPDF } from 'jspdf';

interface LessonsBoardProps {
  lessons: Lesson[];
  onAddLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  portalUserRole: 'parent' | 'manager' | 'teacher' | null;
  portalTeacherDetails?: { name: string; classRoom: string; email: string; phone: string } | null;
  activeStudent?: Student | null;
  onAddHomework?: (homework: Homework) => Promise<boolean>;
  language?: 'fr' | 'en';
}

interface GeneratedHomework {
  title: string;
  objectives: string[];
  exercises: Array<{
    title: string;
    instruction: string;
    questions: string[];
    solutions: string[];
  }>;
  parentTips: string;
}

export default function LessonsBoard({
  lessons,
  onAddLesson,
  onDeleteLesson,
  portalUserRole,
  portalTeacherDetails,
  activeStudent,
  onAddHomework,
  language = 'fr'
}: LessonsBoardProps) {
  const isTeacher = portalUserRole === 'teacher';
  const isParent = portalUserRole === 'parent';

  // State management
  const [showAddForm, setShowAddForm] = useState(false);
  const [subject, setSubject] = useState('Mathématiques');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  // AI Homework states
  const [generatingHomeworkId, setGeneratingHomeworkId] = useState<string | null>(null);
  const [generatedHomework, setGeneratedHomework] = useState<GeneratedHomework | null>(null);
  const [selectedHomeworkType, setSelectedHomeworkType] = useState<'app' | 'quiz' | 'deep'>('app');
  const [currentHomeworkLesson, setCurrentHomeworkLesson] = useState<Lesson | null>(null);
  const [addingToBoardId, setAddingToBoardId] = useState(false);
  const [addedSuccessfully, setAddedSuccessfully] = useState(false);

  // Filter lessons based on classroom
  const activeClassRoom = isTeacher 
    ? (portalTeacherDetails?.classRoom || 'CE2') 
    : (activeStudent?.classRoom || 'CE2');

  const filteredLessons = lessons.filter(lesson => {
    const lessonClass = (lesson.classRoom || '').toLowerCase().trim();
    const targetClass = activeClassRoom.toLowerCase().trim();
    return lessonClass === targetClass || lessonClass.includes(targetClass) || targetClass.includes(lessonClass);
  });

  const subjects = [
    'Mathématiques',
    'Français',
    'Sciences & Technologie',
    'Histoire & Géographie',
    'Éducation Civique & Morale',
    'Anglais',
    'Arts Plastiques'
  ];

  const handlePublishLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert(language === 'fr' ? 'Veuillez remplir le titre et le contenu du cours.' : 'Please fill in both the title and lesson content.');
      return;
    }

    setIsSubmitting(true);
    try {
      const lessonData = {
        parentId: localStorage.getItem('portal_selected_school_id') || 'default_school',
        classRoom: activeClassRoom,
        subject,
        title: title.trim(),
        content: content.trim(),
        teacherName: portalTeacherDetails?.name || 'Mme Sophie Laurent',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'lessons'), lessonData);
      
      const newLesson: Lesson = {
        id: docRef.id,
        ...lessonData
      };

      onAddLesson(newLesson);
      setTitle('');
      setContent('');
      setShowAddForm(false);
    } catch (err) {
      console.error("Error creating lesson in Firestore:", err);
      alert(language === 'fr' ? 'Erreur lors de la publication du cours.' : 'Error publishing the lesson.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    const confirm = window.confirm(
      language === 'fr' 
        ? 'Voulez-vous vraiment supprimer ce cours ? Vos élèves ne pourront plus y accéder.' 
        : 'Are you sure you want to delete this course? Your students will no longer be able to access it.'
    );
    if (!confirm) return;

    try {
      await deleteDoc(doc(db, 'lessons', id));
      onDeleteLesson(id);
    } catch (err) {
      console.error("Error deleting lesson from Firestore:", err);
    }
  };

  // Generate Homework with Gemini API
  const handleGenerateHomework = async (lesson: Lesson) => {
    setGeneratingHomeworkId(lesson.id);
    setGeneratedHomework(null);
    setAddedSuccessfully(false);
    setCurrentHomeworkLesson(lesson);

    try {
      const response = await fetch('/api/gemini/generate-homework-from-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: lesson.title,
          lessonContent: lesson.content,
          subject: lesson.subject,
          studentName: activeStudent?.name || "l'élève",
          grade: activeClassRoom,
          homeworkType: selectedHomeworkType
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setGeneratedHomework(resData.data);
      } else {
        throw new Error(resData.message || 'Unknown generation error');
      }
    } catch (error) {
      console.error("Error generating homework:", error);
      alert(language === 'fr' ? 'Erreur lors de la génération du devoir par l\'IA.' : 'Error generating the homework using AI.');
    } finally {
      setGeneratingHomeworkId(null);
    }
  };

  // Add generated homework to the student's text-book (homework collection)
  const handleAddHomeworkToBoard = async () => {
    if (!generatedHomework || !activeStudent || !currentHomeworkLesson || !onAddHomework) return;

    setAddingToBoardId(true);
    try {
      const formattedDescription = `### ${generatedHomework.title}\n\n**Objectifs :**\n${generatedHomework.objectives.map(o => `- ${o}`).join('\n')}\n\n${generatedHomework.exercises.map((ex, idx) => `**Exercice ${idx + 1} : ${ex.title}**\n*Consigne :* ${ex.instruction}\n\nQuestions :\n${ex.questions.map((q, qidx) => `${qidx + 1}. ${q}`).join('\n')}`).join('\n\n')}\n\n**Conseils pour les parents :**\n${generatedHomework.parentTips}`;

      const newHw: Homework = {
        id: 'hw_' + Date.now(),
        studentId: activeStudent.id,
        parentId: activeStudent.parentId,
        subject: currentHomeworkLesson.subject,
        title: `IA: ${generatedHomework.title}`,
        description: formattedDescription,
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days limit
        status: 'Pending'
      };

      const success = await onAddHomework(newHw);
      if (success) {
        setAddedSuccessfully(true);
      }
    } catch (err) {
      console.error("Error adding homework to board:", err);
    } finally {
      setAddingToBoardId(false);
    }
  };

  // Export generated homework as a clean, structured PDF
  const handleExportPDF = () => {
    if (!generatedHomework) return;

    const doc = new jsPDF();
    let y = 15;

    // Header
    doc.setFillColor(30, 41, 59); // Slate-900 background for top banner
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("PASMA-SYS - DEVOIR DE MAISON IA", 15, 18);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Niveau : ${activeClassRoom} | Élève : ${activeStudent?.name || "Élève"}`, 15, 25);
    doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 15, 30);

    y = 50;

    // Content Style
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(generatedHomework.title, 15, y);
    y += 10;

    // Objectives block
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(15, y, 180, 22, 'F');
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Objectifs d'apprentissage :", 20, y + 6);
    doc.setFont("helvetica", "normal");
    
    let objY = y + 12;
    generatedHomework.objectives.forEach(obj => {
      doc.text(`- ${obj}`, 22, objY);
      objY += 5;
    });
    y += 28;

    // Exercises
    generatedHomework.exercises.forEach((ex, exIdx) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`Exercice ${exIdx + 1} : ${ex.title}`, 15, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(71, 85, 105); // slate-600
      
      const splitInstruction = doc.splitTextToSize(ex.instruction, 180);
      doc.text(splitInstruction, 15, y);
      y += (splitInstruction.length * 5) + 3;

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      
      ex.questions.forEach((q, qIdx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        const splitQ = doc.splitTextToSize(`${qIdx + 1}. ${q}`, 175);
        doc.text(splitQ, 18, y);
        y += (splitQ.length * 5) + 2;
      });

      y += 8;
    });

    // Solutions Page (separately for parents)
    doc.addPage();
    y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text("CORRIGÉ DEVOIR (Destiné aux Parents)", 15, y);
    y += 12;

    doc.setTextColor(15, 23, 42);

    generatedHomework.exercises.forEach((ex, exIdx) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Corrigé - Exercice ${exIdx + 1} : ${ex.title}`, 15, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      ex.solutions.forEach((sol, solIdx) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        const splitSol = doc.splitTextToSize(`R${solIdx + 1} : ${sol}`, 180);
        doc.text(splitSol, 15, y);
        y += (splitSol.length * 5) + 3;
      });

      y += 6;
    });

    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    // Parent tips block
    y += 5;
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.rect(15, y, 180, 25, 'F');
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text("Conseils d'accompagnement pour le parent :", 20, y + 7);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const splitTips = doc.splitTextToSize(generatedHomework.parentTips, 170);
    doc.text(splitTips, 20, y + 13);

    doc.save(`Devoir_IA_${activeStudent?.name || "Eleve"}_${currentHomeworkLesson?.subject || "Cours"}.pdf`);
  };

  return (
    <div className="space-y-6" id="lessons-board-container">
      {/* Header Panel */}
      <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            {language === 'fr' ? 'Espace Cours & Leçons' : 'Class Lessons & Lectures'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isTeacher 
              ? `Publiez des leçons structurées pour votre classe de ${activeClassRoom} afin de guider le travail à la maison.` 
              : `Consultez les cours publiés par l'enseignant titulaire et générez des devoirs IA personnalisés pour ${activeStudent?.name || "l'élève"}.`
            }
          </p>
        </div>

        {isTeacher && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              type="button"
            >
              <Plus className="h-4 w-4" /> 
              {language === 'fr' ? 'Publier un Cours' : 'Publish a Course'}
            </button>
          </div>
        )}
      </div>

      {/* Teacher Form to Publish Course */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                {language === 'fr' ? 'Nouveau Cours pour la Classe' : 'New Class Lesson'} : <span className="text-indigo-600 font-extrabold">{activeClassRoom}</span>
              </h3>
            </div>

            <form onSubmit={handlePublishLesson} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Matière</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full text-xs font-medium rounded-xl border border-gray-200 bg-slate-50 p-2.5 focus:border-indigo-500 focus:outline-none"
                  >
                    {subjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Titre du Cours</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Les fractions décimales - Introduction"
                    className="w-full text-xs font-medium rounded-xl border border-gray-200 bg-slate-50 p-2.5 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Contenu / Résumé du Cours</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  placeholder="Rédigez le résumé ou les notions clés du cours ici. Vous pouvez utiliser du texte libre de manière structurée..."
                  className="w-full text-xs font-medium rounded-xl border border-gray-200 bg-slate-50 p-2.5 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-150 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Publication...</span>
                    </>
                  ) : (
                    <span>Publier</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column: Courses List & Expander */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
            📚 {language === 'fr' ? `Cours disponibles en ${activeClassRoom}` : `Lessons available in ${activeClassRoom}`}
          </h3>

          {filteredLessons.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-gray-200 p-8 rounded-2xl text-center space-y-2">
              <BookOpen className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="text-xs font-bold text-gray-500">
                {language === 'fr' ? 'Aucun cours publié pour le moment dans cette classe.' : 'No courses published yet for this class.'}
              </p>
              {isTeacher && (
                <p className="text-[11px] text-gray-400">
                  Cliquez sur "Publier un Cours" en haut à droite pour ajouter votre première leçon !
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLessons.map((lesson) => {
                const isExpanded = expandedLessonId === lesson.id;
                return (
                  <motion.div 
                    layout
                    key={lesson.id} 
                    className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs hover:border-indigo-150 transition"
                  >
                    {/* Lesson Header Row */}
                    <div 
                      onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                      className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition select-none"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-md">
                            {lesson.subject}
                          </span>
                          {lesson.pdfUrl && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-md flex items-center gap-1">
                              <File className="h-3 w-3 text-rose-500" />
                              PDF
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {lesson.date}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-gray-900 tracking-tight">
                          {lesson.title}
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          🧑‍🏫 Enseignant : <span className="font-semibold text-gray-600">{lesson.teacherName}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-center">
                        {isTeacher && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLesson(lesson.id);
                            }}
                            className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition"
                            title="Supprimer ce cours"
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lesson Content Expander */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gray-100 bg-slate-50/30 overflow-hidden"
                        >
                          <div className="p-4 space-y-4">
                            {/* Course text body */}
                            <div className="bg-white p-4 rounded-xl border border-gray-150 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                              {lesson.content}
                            </div>

                            {/* Parent Actions */}
                            {isParent && (
                              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl space-y-3">
                                <div className="flex items-start gap-2.5">
                                  <Sparkles className="h-4 w-4 text-indigo-600 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <h5 className="text-xs font-bold text-indigo-950">
                                      {language === 'fr' ? "🪄 Générateur de Devoir par l'IA" : "🪄 AI Homework Generator"}
                                    </h5>
                                    <p className="text-[10px] text-indigo-800 leading-relaxed">
                                      Générez instantanément des exercices d'application personnalisés basés sur cette leçon pour stimuler votre enfant et mesurer sa compréhension de manière ludique !
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 pt-1">
                                  <div className="flex items-center gap-1.5 bg-white border border-gray-250 p-1.5 rounded-lg text-[10px] font-bold">
                                    <label className="text-gray-500">Type :</label>
                                    <select
                                      value={selectedHomeworkType}
                                      onChange={(e) => setSelectedHomeworkType(e.target.value as any)}
                                      className="focus:outline-none bg-transparent cursor-pointer font-bold text-indigo-750"
                                    >
                                      <option value="app">Application Directe</option>
                                      <option value="quiz">Quiz de Révision</option>
                                      <option value="deep">Approfondissement</option>
                                    </select>
                                  </div>

                                  <button
                                    onClick={() => handleGenerateHomework(lesson)}
                                    disabled={!!generatingHomeworkId}
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                    type="button"
                                  >
                                    {generatingHomeworkId === lesson.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>Génération en cours...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3 w-3" />
                                        <span>Générer Devoir</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: AI Generated Homework Visualizer */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
            ✨ {language === 'fr' ? 'Devoir Généré par IA' : 'AI Generated Homework'}
          </h3>

          {!generatedHomework ? (
            <div className="bg-white border border-gray-150 p-6 rounded-2xl text-center space-y-3 shadow-xs">
              <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto">
                <Sparkles className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-800">Aucun devoir généré</h4>
                <p className="text-[10px] text-gray-400 leading-normal">
                  Sélectionnez un cours à gauche, configurez le type de devoir souhaité, puis cliquez sur "Générer Devoir".
                </p>
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between border-b border-gray-100 pb-3 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded">
                      Fait maison
                    </span>
                    <span className="text-[9px] text-gray-405 font-medium">
                      Cours : {currentHomeworkLesson?.title}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-gray-900 leading-tight">
                    {generatedHomework.title}
                  </h4>
                </div>
                
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={handleExportPDF}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-gray-700 rounded-lg transition"
                    title="Télécharger le devoir au format PDF"
                    type="button"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Objectives List */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200 text-[10px] space-y-1">
                <p className="font-extrabold text-gray-700">Objectifs visés :</p>
                <ul className="list-disc pl-4 space-y-0.5 text-gray-500 font-medium">
                  {generatedHomework.objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>

              {/* Exercises Stack */}
              <div className="space-y-3">
                {generatedHomework.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="bg-slate-50/50 border border-gray-150 rounded-xl p-3 space-y-2">
                    <h5 className="text-[11px] font-black text-slate-850 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      {ex.title}
                    </h5>
                    <p className="text-[10px] text-gray-500 font-semibold italic">
                      Consigne : {ex.instruction}
                    </p>
                    <ul className="list-decimal pl-4 space-y-1 text-[10px] text-gray-600 font-medium">
                      {ex.questions.map((q, qIdx) => (
                        <li key={qIdx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Parent Tips Block */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1 text-[10px]">
                <p className="font-extrabold text-emerald-950 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-emerald-600" />
                  Conseils aux parents :
                </p>
                <p className="text-emerald-800 leading-normal">
                  {generatedHomework.parentTips}
                </p>
              </div>

              {/* Action buttons to assign */}
              {onAddHomework && (
                <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                  {addedSuccessfully ? (
                    <div className="p-2 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-xl flex items-center gap-1 justify-center">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Ajouté avec succès au Cahier de Textes !</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleAddHomeworkToBoard}
                      disabled={addingToBoardId}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                      type="button"
                    >
                      {addingToBoardId ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Enregistrement...</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare className="h-3.5 w-3.5" />
                          <span>Inscrire au Cahier de Textes</span>
                        </>
                      )}
                    </button>
                  )}
                  <p className="text-[9px] text-gray-400 text-center leading-tight">
                    Ajoutez le devoir au cahier de textes de votre enfant pour qu'il puisse cocher sa réalisation une fois terminé.
                  </p>
                </div>
              )}

            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}
