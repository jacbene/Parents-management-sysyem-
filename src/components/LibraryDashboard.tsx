import { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  BookMarked, 
  Search, 
  CheckSquare, 
  TrendingUp, 
  Heart, 
  Info, 
  HelpCircle, 
  Trophy, 
  GraduationCap, 
  Calendar, 
  ChevronRight, 
  Loader2,
  Trash2,
  Plus,
  BookOpenCheck,
  Award
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Student } from '../types';

interface Book {
  title: string;
  author: string;
  description: string;
  whyPerfect: string;
  readingDurationWeeks: number;
  genre: string;
}

interface ReadingLog {
  id?: string;
  studentId: string;
  studentName: string;
  bookTitle: string;
  bookAuthor: string;
  genre: string;
  status: 'to_read' | 'reading' | 'completed';
  progressPercent: number;
  parentNotes: string;
  rating: number;
  addedAt: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface StudyStep {
  stepNumber: number;
  objective: string;
  tips: string;
  activity: string;
}

interface LibraryDashboardProps {
  activeStudent: Student | null;
  filteredStudents: Student[];
}

export default function LibraryDashboard({ activeStudent, filteredStudents }: LibraryDashboardProps) {
  // Navigation & Sub-states
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(activeStudent);
  const [selectedGoal, setSelectedGoal] = useState<string>('vocabulaire');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);
  const [aiBooks, setAiBooks] = useState<Book[]>([]);
  const [sourceType, setSourceType] = useState<'gemini' | 'local-heuristic' | null>(null);

  // Interaction logs (Quizzes & Guides)
  const [interactiveBook, setInteractiveBook] = useState<Book | null>(null);
  const [activeInteractiveTab, setActiveInteractiveTab] = useState<'quiz' | 'guide' | null>(null);
  const [loadingInteract, setLoadingInteract] = useState<boolean>(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizQuestion[] | null>(null);
  const [generatedGuide, setGeneratedGuide] = useState<{ title: string; steps: StudyStep[] } | null>(null);
  
  // Interactive Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizScore, setQuizScore] = useState<number>(0);

  // Firestore Reading Logs
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [addingToJournalProgress, setAddingToJournalProgress] = useState<string | null>(null);

  // Editing direct log states
  const [updatingLogId, setUpdatingLogId] = useState<string | null>(null);
  const [logProgressInput, setLogProgressInput] = useState<number>(0);
  const [logNotesInput, setLogNotesInput] = useState<string>('');
  const [logStatusInput, setLogStatusInput] = useState<'to_read' | 'reading' | 'completed'>('reading');

  const availableGoals = [
    { id: 'vocabulaire', name: 'Élargir le vocabulaire', desc: 'Renforcement lexical et expression écrite.', color: 'border-blue-200 bg-blue-50/50 text-blue-700' },
    { id: 'civisme', name: 'Morale & Civisme', desc: 'Éthique citoyenne et contes éducatifs traditionnels.', color: 'border-emerald-200 bg-emerald-50/50 text-emerald-700' },
    { id: 'sciences', name: 'Éveil Scientifique', desc: 'Clés sur l\'environnement, la nature et la logique.', color: 'border-purple-200 bg-purple-50/50 text-purple-700' },
    { id: 'histoire', name: 'Patrimoine & Histoire', desc: 'Savourer l\'histoire régionale et la grande littérature d\'Afrique.', color: 'border-amber-200 bg-amber-50/50 text-amber-700' }
  ];

  // Static Library Core Book templates used for instant elegant display if no search has run
  const staticCuratedBooks: Record<string, Book[]> = {
    "cm2": [
      {
        title: "L'Enfant Noir",
        author: "Camara Laye",
        description: "Un chef-d'œuvre littéraire africain qui introduit habilement la transition de l'enfance vers l'âge adulte, la nostalgie de la terre guinéenne et la force des valeurs éducatives.",
        whyPerfect: "Excellent pour étoffer le vocabulaire et acquérir des structures grammaticales riches requises pour le niveau CM2.",
        readingDurationWeeks: 4,
        genre: "Roman d'apprentissage"
      },
      {
        title: "La Marmite de Koka-Mbala",
        author: "Guy Menga",
        description: "Cette pièce de théâtre divertissante met en scène un conflit entre des anciens d'un village et la jeune génération voulant abolir les privilèges injustes.",
        whyPerfect: "Favorise l'amour de la dialectique dramatique théâtrale et sème l'idéal de justice civique.",
        readingDurationWeeks: 3,
        genre: "Théâtre classique"
      },
      {
        title: "Les Contes d'Amadou Koumba",
        author: "Birago Diop",
        description: "Un recueil mythique de sages paroles d'Afrique de l'Ouest, racontées d'un ton farceur mais toujours rempli d'une morale d'acier salvatrice.",
        whyPerfect: "Idéal pour l'initiation aux fables traditionnelles et à la compréhension de l'oralité.",
        readingDurationWeeks: 3,
        genre: "Contes & Sagesse"
      }
    ],
    "default": [
      {
        title: "Le Petit Prince",
        author: "Antoine de Saint-Exupéry",
        description: "L'émerveillement philosophique d'un petit visiteur tombé du ciel, qui pose d'immenses questions pleines de sagesse aux adultes.",
        whyPerfect: "Éveille la curiosité, l'indépendance de pensée et pose de magnifiques valeurs d'amitié réciproque.",
        readingDurationWeeks: 2,
        genre: "Contes universels"
      },
      {
        title: "Les Aventures de Leuk-le-Lièvre",
        author: "Léopold Sédar Senghor",
        description: "Leuk est malin, Leuk s'en sort toujours ! À travers ses facéties contre l'oncle Bouki, l'élève apprend comment l'esprit et l'ingéniosité battent la force brute brute.",
        whyPerfect: "Un classique scolaire amusant d'introduction de contes didactiques adaptés aux classes moyennes.",
        readingDurationWeeks: 2,
        genre: "Conte didactique"
      },
      {
        title: "Kamdem le petit forestier",
        author: "Auteur du Cameroun",
        description: "Une aventure émouvante d'un jeune garçon de l'Ouest-Cameroun qui apprend à préserver l'équilibre fragile de son riche patrimoine environnemental naturel.",
        whyPerfect: "Très utile pour stimuler le respect écologique local et le civisme éco-citoyen.",
        readingDurationWeeks: 2,
        genre: "Aventure écolo"
      }
    ]
  };

  // Sync selected student state with active student changes
  useEffect(() => {
    if (activeStudent) {
      setSelectedStudent(activeStudent);
    }
  }, [activeStudent]);

  // Load recommendations based on the child profile on initial load
  useEffect(() => {
    if (selectedStudent) {
      handleQueryRecommendations(true);
    } else if (filteredStudents.length > 0) {
      setSelectedStudent(filteredStudents[0]);
    } else {
      // If absolutely no students are bound, show standard suggestions
      setAiBooks(staticCuratedBooks.default);
    }
  }, [selectedStudent]);

  // Fetch Firestore saved reading logs using standard, highly stable one-time requests
  const fetchReadingLogs = useCallback(async (sId: string, showLoader = false) => {
    if (showLoader) setLoadingLogs(true);
    try {
      const q = query(
        collection(db, "reading_logs"),
        where("studentId", "==", sId)
      );
      const snapshot = await getDocs(q);
      const logs: ReadingLog[] = [];
      snapshot.forEach((docSnap) => {
        logs.push({
          id: docSnap.id,
          ...docSnap.data() as Omit<ReadingLog, 'id'>
        });
      });
      // Sort: completed pushed to down, to_read / reading up
      logs.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      setReadingLogs(logs);
    } catch (error) {
      console.error("Error fetching reading logs:", error);
    } finally {
      if (showLoader) setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    
    fetchReadingLogs(selectedStudent.id, true);

    // Dynamic background poll to smoothly update logs without Websockets
    const intervalId = setInterval(() => {
      fetchReadingLogs(selectedStudent.id, false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [selectedStudent, fetchReadingLogs]);

  const handleQueryRecommendations = async (useInitialQuick = false) => {
    if (!selectedStudent) return;
    setLoadingRecommendations(true);
    setInteractiveBook(null);
    setActiveInteractiveTab(null);
    setGeneratedQuiz(null);
    setGeneratedGuide(null);

    const gradeLevel = selectedStudent.grade || "Primaire";
    
    // In quick initial load mode, set instant localized curated book catalogs, then silently or responsively back it up
    if (useInitialQuick) {
      const fallbackTarget = gradeLevel.toLowerCase().includes("cm") ? staticCuratedBooks.cm2 : staticCuratedBooks.default;
      setAiBooks(fallbackTarget);
      setSourceType("local-heuristic");
      setLoadingRecommendations(false);
      return;
    }

    try {
      const response = await fetch('/api/library/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.name,
          grade: gradeLevel,
          classRoom: selectedStudent.classRoom || 'Aucune',
          customTopic: customTopic.trim() || undefined,
          selectedGoal: availableGoals.find(g => g.id === selectedGoal)?.name || 'Élargir le vocabulaire'
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data && resData.data.length > 0) {
        setAiBooks(resData.data);
        setSourceType(resData.source);
      } else {
        throw new Error("Format de réponse invalide");
      }
    } catch (err) {
      console.warn("Échec requête Recommandations IA, basculement en local...", err);
      const fallbackTarget = gradeLevel.toLowerCase().includes("cm") ? staticCuratedBooks.cm2 : staticCuratedBooks.default;
      setAiBooks(fallbackTarget);
      setSourceType("local-heuristic");
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Add a book from recommendations directly to the student's Firestore reading journal
  const handleAddToJournal = async (book: Book) => {
    if (!selectedStudent) return;
    
    // Check if the book already exists in readingLogs
    const alreadySaved = readingLogs.some(
      l => l.bookTitle.toLowerCase().trim() === book.title.toLowerCase().trim()
    );
    if (alreadySaved) {
      alert(`⚠️ "${book.title}" est déjà présent dans le carnet de lecture de ${selectedStudent.name}.`);
      return;
    }

    setAddingToJournalProgress(book.title);

    try {
      const newLog: Omit<ReadingLog, 'id'> = {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        bookTitle: book.title,
        bookAuthor: book.author,
        genre: book.genre || 'Littérature',
        status: 'to_read',
        progressPercent: 0,
        parentNotes: `Recommandé par l'IA pour le profil de ${selectedStudent.name}. Objectif: ${book.whyPerfect}`,
        rating: 0,
        addedAt: new Date().toISOString()
      };

      await addDoc(collection(db, "reading_logs"), newLog);
      fetchReadingLogs(selectedStudent.id, false);
    } catch (err) {
      console.error("Error adding to reading logs journal:", err);
      alert("Erreur technique lors de l'enregistrement dans le carnet de lecture.");
    } finally {
      setAddingToJournalProgress(null);
    }
  };

  // Delete log from journal
  const handleDeleteLog = async (logId: string, title: string) => {
    if (!confirm(`Souhaitez-vous retirer "${title}" du journal de lecture ?`)) return;
    try {
      await deleteDoc(doc(db, "reading_logs", logId));
      if (selectedStudent) {
        fetchReadingLogs(selectedStudent.id, false);
      }
    } catch (err) {
      console.error("Error deleting reading log:", err);
    }
  };

  // Interactive Book actions (Quiz & Study guide)
  const handleFetchInteract = async (book: Book, actionType: 'quiz' | 'guide') => {
    if (!selectedStudent) return;
    setInteractiveBook(book);
    setActiveInteractiveTab(actionType);
    setLoadingInteract(true);
    setGeneratedQuiz(null);
    setGeneratedGuide(null);
    setQuizAnswers({});
    setQuizSubmitted(false);

    try {
      const response = await fetch('/api/library/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          bookTitle: book.title,
          bookAuthor: book.author,
          studentName: selectedStudent.name,
          grade: selectedStudent.grade || "Primaire"
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        if (actionType === 'quiz') {
          setGeneratedQuiz(resData.data.questions);
        } else {
          setGeneratedGuide(resData.data);
        }
      } else {
        throw new Error("No data returned");
      }
    } catch (err) {
      console.error("Failed interaction call:", err);
      alert("L'outil d'intégration IA est temporairement indisponible. Veuillez réessayer.");
    } finally {
      setLoadingInteract(false);
    }
  };

  // Submit interactive MCQ Quiz
  const handleSubmitQuiz = () => {
    if (!generatedQuiz) return;
    let score = 0;
    generatedQuiz.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) {
        score++;
      }
    });
    setQuizScore(score);
    setQuizSubmitted(true);
  };

  // Open Direct Log Editing panel inline
  const handleOpenLogEditor = (log: ReadingLog) => {
    setUpdatingLogId(log.id || null);
    setLogProgressInput(log.progressPercent);
    setLogNotesInput(log.parentNotes);
    setLogStatusInput(log.status);
  };

  // Save changes to reading progress
  const handleSaveLogUpdates = async (logId: string) => {
    try {
      const logRef = doc(db, "reading_logs", logId);
      let calculatedStatus = logStatusInput;
      if (logProgressInput === 100) {
        calculatedStatus = 'completed';
      } else if (logProgressInput > 0 && calculatedStatus === 'to_read') {
        calculatedStatus = 'reading';
      }

      await updateDoc(logRef, {
        progressPercent: Number(logProgressInput),
        parentNotes: logNotesInput,
        status: calculatedStatus
      });
      setUpdatingLogId(null);
      if (selectedStudent) {
        fetchReadingLogs(selectedStudent.id, false);
      }
    } catch (err) {
      console.error("Error updating log track:", err);
      alert("Erreur technique lors de la mise à jour.");
    }
  };

  // Random placeholder avatar background styling for book covers
  const getBookStyle = (genre: string) => {
    const g = genre.toLowerCase();
    if (g.includes('conte') || g.includes('sagesse')) {
      return 'from-amber-500 to-amber-700 text-amber-50 border-amber-600';
    }
    if (g.includes('theatre') || g.includes('poe')) {
      return 'from-purple-600 to-indigo-800 text-indigo-50 border-indigo-700';
    }
    if (g.includes('science') || g.includes('ecolo')) {
      return 'from-emerald-600 to-teal-800 text-teal-50 border-teal-700';
    }
    if (g.includes('hist') || g.includes('roman')) {
      return 'from-rose-600 to-rose-800 text-rose-50 border-rose-700';
    }
    return 'from-slate-700 to-slate-900 text-slate-100 border-slate-800';
  };

  return (
    <div id="library-advisor-pane" className="space-y-6">
      
      {/* HEADER SECTION WITH INTEGRATIVE GRADIENT AND SPARKLES */}
      <div className="p-8 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl shadow-lg border border-indigo-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 overflow-hidden relative">
        <div className="absolute right-0 top-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 relative max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/20 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3 w-3 animate-pulse text-indigo-300" /> Compagnon Littéraire Intellectuel
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-sans tracking-tight">Bibliothèque IA & Carnet de Lecture</h2>
          <p className="text-indigo-200 text-xs md:text-sm max-w-xl leading-relaxed font-medium">
            Trouvez des recommandations de lectures d&apos;apprentissage culturellement riches et instructives pour stimuler le vocabulaire, la rigueur civique, et l&apos;écurie scolaire de votre enfant.
          </p>
        </div>

        {/* Dynamic child profile focus button */}
        <div className="shrink-0 space-y-2 select-none w-full md:w-auto relative">
          <label className="text-[10px] text-indigo-300 uppercase tracking-widest font-extrabold flex items-center gap-1.5 pl-1">
            <GraduationCap className="h-3 w-3" /> Sélectionner un profil :
          </label>
          <div className="flex gap-2 flex-wrap md:flex-nowrap bg-indigo-950/50 p-1.5 rounded-2xl border border-indigo-850">
            {filteredStudents.map((student) => (
              <button 
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                type="button"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  selectedStudent?.id === student.id 
                    ? 'bg-indigo-600 border border-indigo-500 text-white shadow-md' 
                    : 'text-indigo-200/80 hover:bg-indigo-900/40 hover:text-white border border-transparent'
                }`}
              >
                <img 
                  src={student.avatar || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=150"} 
                  alt={student.name} 
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10" 
                />
                <div className="text-left">
                  <p className="leading-3 text-[11px] font-black">{student.name.split(' ')[0]}</p>
                  <p className="text-[9px] text-indigo-300 font-extrabold">{student.grade}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CORE TWO LAYER GRID FOR ADVOCATE FILTERS & CURRENT READS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: FILTERS & AI SELECTOR (4 COLS ON LARGE SCREEN) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <Search className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 font-sans">Objectif et Thème d&apos;Éducation</h3>
                <p className="text-[10px] text-gray-400">Guidez le robot pour affiner les propositions lectorales</p>
              </div>
            </div>

            {/* Pedagogy Objective Targets */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold block">
                Objectif Pédagogique Prioritaire :
              </label>
              <div className="space-y-1.5">
                {availableGoals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGoal(g.id)}
                    type="button"
                    className={`w-full text-left p-3 rounded-2xl border transition text-xs flex flex-col gap-0.5 cursor-pointer select-none ${
                      selectedGoal === g.id
                        ? `${g.color} ring-2 ring-indigo-600/5`
                        : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-bold">{g.name}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom preferences Input */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold block">
                Intérêts ou centre d&apos;intérêt personnalisé (Optionnel) :
              </label>
              <textarea
                placeholder="Ex : Il aime l'histoire du Cameroun, les voitures de sport, ou veut s'améliorer sur la grammaire française..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="w-full p-3 hover:border-gray-300 border border-slate-200 bg-white rounded-2xl text-xs placeholder:text-gray-300 focus:outline-hidden focus:border-indigo-600 transition-colors resize-none h-20"
              />
            </div>

            {/* TRIGGER BUTTON */}
            <button
              onClick={() => handleQueryRecommendations(false)}
              disabled={loadingRecommendations || !selectedStudent}
              type="button"
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-55 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer select-none active:scale-98"
            >
              {loadingRecommendations ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
                  Génération des recommandations IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Consulter le Conseiller Littéraire IA
                </>
              )}
            </button>
          </div>

          {/* DYNAMIC LOG STATS */}
          <div className="p-6 bg-gradient-to-br from-indigo-50/70 to-blue-50/20 border border-indigo-100/45 rounded-3xl shadow-xs space-y-4">
            <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
              Baromètre de Lecture • {selectedStudent?.name.split(' ')[0]}
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-white border border-slate-100 rounded-2xl text-center">
                <p className="text-lg font-black text-slate-800">{readingLogs.length}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold">Livres</p>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-2xl text-center">
                <p className="text-lg font-black text-indigo-600">
                  {readingLogs.filter(l => l.status === 'reading').length}
                </p>
                <p className="text-[9px] text-indigo-400 uppercase font-bold">En cours</p>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-2xl text-center">
                <p className="text-lg font-black text-emerald-600">
                  {readingLogs.filter(l => l.status === 'completed').length}
                </p>
                <p className="text-[9px] text-emerald-400 uppercase font-bold">Terminés</p>
              </div>
            </div>
            {readingLogs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <span className="font-semibold">Taux de complétion</span>
                  <span className="font-bold text-gray-700 font-mono">
                    {Math.round((readingLogs.filter(l => l.status === 'completed').length / readingLogs.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/65 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(readingLogs.filter(l => l.status === 'completed').length / readingLogs.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: BOOK RECOMMENDATIONS & READING JOURNAL (8 COLS) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* AI-RECOMMENDATION SHELF */}
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 font-sans">
                  Suggéré pour {selectedStudent?.name} ({selectedStudent?.grade})
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Basé sur les livres d&apos;apprentissage du programme et d&apos;œuvres recommandées adaptées.
                </p>
              </div>
              {sourceType && (
                <span className="self-start px-2 py-0.5 rounded-md border text-[9px] font-mono font-extrabold flex items-center gap-1 shrink-0 bg-slate-50 border-slate-200/80 text-gray-500">
                  {sourceType === 'gemini' ? (
                    <>
                      <Sparkles className="h-2.5 w-2.5 text-indigo-500" /> SOURCE : IA GEMINI ACTIVE
                    </>
                  ) : (
                    <>
                      <Info className="h-2.5 w-2.5 text-amber-500" /> SUGGESTION LOCALE COOP
                    </>
                  )}
                </span>
              )}
            </div>

            {loadingRecommendations ? (
              <div className="py-20 flex flex-col justify-center items-center gap-3 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-700 animate-pulse">Consultation de la bibliothèque des éditeurs...</p>
                  <p className="text-xs text-gray-400">Gemini analyse l&apos;âge et prépare les questions de morale adaptées.</p>
                </div>
              </div>
            ) : aiBooks.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center space-y-3">
                <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs text-gray-500 font-medium">Aucun livre n&apos;a été généré pour le moment. Cliquez sur le bouton de gauche pour consulter l&apos;IA.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiBooks.map((book, idx) => (
                  <div 
                    key={idx} 
                    className="p-5 border border-slate-100 hover:border-indigo-150 bg-slate-50/40 hover:bg-white rounded-2xl transition shadow-xs flex flex-col justify-between gap-4 group relative hover:shadow-md hover:shadow-slate-100 animate-fade-in"
                  >
                    <div className="space-y-3">
                      
                      {/* Stylized visual Book Cover representation */}
                      <div className="flex gap-3">
                        <div className={`w-16 h-24 rounded-lg shrink-0 border bg-gradient-to-br ${getBookStyle(book.genre)} p-2 flex flex-col justify-between shadow-xs select-none transition group-hover:-translate-y-1 duration-300 font-sans`}>
                          <div className="text-[7px] font-black tracking-widest uppercase truncate opacity-85">{book.genre}</div>
                          <div className="text-[10px] font-black leading-tight line-clamp-3 leading-3">{book.title}</div>
                          <div className="text-[7px] italic font-semibold truncate opacity-80">{book.author}</div>
                        </div>

                        <div className="space-y-1 min-w-0">
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-extrabold uppercase">
                            {book.genre || 'Littérature'}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 leading-tight truncate">{book.title}</h4>
                          <p className="text-[11px] text-gray-500 font-semibold italic truncate">de {book.author}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 font-bold pt-0.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>Durée estimée : {book.readingDurationWeeks} {book.readingDurationWeeks > 1 ? 'semaines' : 'semaine'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary and pedagogical rationale */}
                      <div className="space-y-1.5 pt-1 text-xs">
                        <p className="text-gray-600 line-clamp-3 text-[11px] leading-relaxed">{book.description}</p>
                        <div className="p-2.5 bg-indigo-50/50 border border-indigo-100/30 rounded-xl">
                          <p className="text-indigo-850 font-bold text-[10px] flex items-center gap-1">
                            <CheckSquare className="h-3 w-3 shrink-0" /> Intérêt d&apos;apprentissage :
                          </p>
                          <p className="text-[10px] text-slate-600 leading-relaxed pt-0.5">{book.whyPerfect}</p>
                        </div>
                      </div>

                    </div>

                    {/* Book interactive triggers */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100/50">
                      
                      <button
                        onClick={() => handleAddToJournal(book)}
                        disabled={addingToJournalProgress === book.title}
                        type="button"
                        className="flex-1 py-1.5 px-3 hover:border-indigo-300 hover:bg-indigo-50 bg-white border border-slate-250 text-slate-800 rounded-xl text-[10px] font-black transition cursor-pointer select-none flex items-center justify-center gap-1 shrink-0"
                      >
                        {addingToJournalProgress === book.title ? (
                          <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                        ) : (
                          <Plus className="h-3 w-3 text-indigo-600" />
                        )}
                        Carnet
                      </button>

                      <button
                        onClick={() => handleFetchInteract(book, 'guide')}
                        type="button"
                        className="py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black transition cursor-pointer select-none flex items-center gap-1 shrink-0"
                      >
                        <TrendingUp className="h-3 w-3 text-amber-300" /> Étapes
                      </button>

                      <button
                        onClick={() => handleFetchInteract(book, 'quiz')}
                        type="button"
                        className="py-1.5 px-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black transition cursor-pointer select-none flex items-center gap-1 shrink-0"
                      >
                        <HelpCircle className="h-3 w-3 text-indigo-200" /> Quiz IA
                      </button>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACTIVE PROGRESS READING JOURNAL (FIRESTORE) */}
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-base font-black text-gray-900 font-sans flex items-center gap-2">
                  <BookMarked className="h-5 w-5 text-indigo-600" /> 
                  Carnet de Lecture de {selectedStudent?.name}
                </h3>
                <p className="text-xs text-gray-400">Journal d&apos;étude partagé avec les enseignants et parents.</p>
              </div>
            </div>

            {loadingLogs ? (
              <div className="py-8 flex justify-center items-center gap-2 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <span className="text-xs text-gray-500 font-medium">Chargement des fiches de lecture...</span>
              </div>
            ) : readingLogs.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-150 bg-slate-50/50 rounded-2xl text-center space-y-2 max-w-lg mx-auto">
                <BookOpenCheck className="h-8 w-8 text-indigo-400 mx-auto" />
                <h4 className="text-xs font-black text-slate-800">Aucun livre en cours d&apos;étude</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed px-5">
                  Engagez votre enfant en choisissant l&apos;un des livres recommandés ci-dessus, puis appuyez sur <strong>&quot;+ Carnet&quot;</strong> pour débuter le suivi de progression.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {readingLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-4 border border-slate-150 rounded-2xl bg-white space-y-4 hover:border-indigo-150 transition relative"
                  >
                    
                    {/* Header line */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          log.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-850' 
                            : log.status === 'reading' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {log.status === 'completed' ? 'Lu complété' : log.status === 'reading' ? 'Lecture active' : 'À démarrer'}
                        </span>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">{log.bookTitle}</h4>
                        <p className="text-[11px] text-slate-500 font-medium">Auteur : {log.bookAuthor} • Genre : {log.genre}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteLog(log.id!, log.bookTitle)}
                        type="button"
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded-xl transition cursor-pointer self-start shrink-0"
                        title="Retirer le livre"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Progress slider bar & values */}
                    <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                        <span>Progression d&apos;assimilation</span>
                        <span className="font-bold font-mono">{log.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            log.progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${log.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Notes line */}
                    <div className="text-[11px] leading-relaxed text-slate-600 pl-1.5 border-l-2 border-indigo-200">
                      <span className="font-bold text-slate-800 block">Notes d&apos;acquisition du Parent :</span>
                      {log.parentNotes || "Aucun commentaire pour le moment."}
                    </div>

                    {/* Editor Panel toggle inline */}
                    {updatingLogId === log.id ? (
                      <div className="p-4 bg-indigo-50/40 border border-indigo-150 rounded-xl space-y-3.5 animate-fade-in text-xs">
                        <h5 className="font-black text-indigo-950">Mettre à jour la progression :</h5>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 font-bold block">Progression de lecture ({logProgressInput}%) :</label>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              step="5"
                              value={logProgressInput}
                              onChange={(e) => setLogProgressInput(Number(e.target.value))}
                              className="w-full text-indigo-600 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-400">
                              <span>0% (Pas lu)</span>
                              <span>50% (Moitié)</span>
                              <span>100% (Achevé)</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-400 font-bold block">Statut global :</label>
                            <div className="flex gap-2">
                              {['to_read', 'reading', 'completed'].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => setLogStatusInput(st as any)}
                                  type="button"
                                  className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-bold border transition ${
                                    logStatusInput === st 
                                      ? 'bg-indigo-600 text-white border-indigo-600' 
                                      : 'bg-white text-slate-700 border-slate-250 hover:bg-slate-55'
                                  }`}
                                >
                                  {st === 'to_read' ? 'À lire' : st === 'reading' ? 'En cours' : 'Fini'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-400 font-bold block">Notes d&apos;exercice, morales ou vocabulaire retenu :</label>
                          <input 
                            type="text"
                            placeholder="Ex : Tristan a retenu 5 nouveaux termes ce soir, et s'est bien concentré."
                            value={logNotesInput}
                            onChange={(e) => setLogNotesInput(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-250 bg-white rounded-lg text-xs"
                          />
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={() => setUpdatingLogId(null)}
                            type="button"
                            className="px-3 py-1.5 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-bold"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleSaveLogUpdates(log.id!)}
                            type="button"
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold"
                          >
                            Sauvegarder
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center pt-1.5">
                        <p className="text-[10px] text-slate-400 font-mono">Enregistré le {new Date(log.addedAt).toLocaleDateString()}</p>
                        <button
                          onClick={() => handleOpenLogEditor(log)}
                          type="button"
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-20 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer select-none"
                        >
                          Mettre à jour d&apos;étapes / notes
                        </button>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HISTORIQUE DE LECTURE (LIVRES TERMINÉS) */}
          <div id="reading-history-section" className="p-6 bg-white border border-slate-100 rounded-3xl shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-base font-sans font-black text-gray-900 flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600 animate-pulse" />
                  Historique de Lecture
                </h3>
                <p className="text-xs text-gray-400">Livres terminés par {selectedStudent?.name} durant l&apos;année scolaire en cours.</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-sans font-extrabold uppercase tracking-wider border border-emerald-100/60">
                Année Scolaire 2025-2026
              </span>
            </div>

            {readingLogs.filter(l => l.status === 'completed').length === 0 ? (
              <div className="py-10 border-2 border-dashed border-slate-150 bg-slate-50/50 rounded-2xl text-center space-y-3 max-w-lg mx-auto">
                <Trophy className="h-8 w-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-black text-slate-700">Aucun livre terminé pour le moment</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed px-5">
                  Une fois qu&apos;un livre atteint 100% de progression ou est mis à jour vers le statut &quot;Fini&quot;, il apparaîtra ici dans l&apos;historique de réussite de l&apos;élève.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {readingLogs.filter(l => l.status === 'completed').map((log) => (
                  <div 
                    key={log.id} 
                    className="p-4 border border-emerald-100 rounded-2xl bg-gradient-to-br from-emerald-50/10 to-white space-y-3.5 hover:shadow-xs hover:border-emerald-200 transition relative overflow-hidden"
                  >
                    {/* Tiny green decoration for reward */}
                    <div className="absolute right-0 top-0 w-8 h-8 bg-emerald-500/10 rounded-bl-3xl flex items-center justify-center pointer-events-none">
                      <Trophy className="h-3 w-3 text-emerald-600" />
                    </div>

                    <div className="flex gap-3">
                      {/* Stylized visual Book Cover representation */}
                      <div className={`w-12 h-18 rounded-lg shrink-0 border bg-gradient-to-br ${getBookStyle(log.genre)} p-1.5 flex flex-col justify-between shadow-xs select-none font-sans`}>
                        <div className="text-[5px] font-black tracking-widest uppercase truncate opacity-85">{log.genre}</div>
                        <div className="text-[7px] font-black leading-tight line-clamp-3 leading-2">{log.bookTitle}</div>
                        <div className="text-[5px] italic font-semibold truncate opacity-80">{log.bookAuthor}</div>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <span className="inline-block px-1.5 py-0.5 bg-emerald-100/70 text-emerald-850 rounded-md text-[8px] font-bold uppercase tracking-wider">
                          Acquis &amp; Validé
                        </span>
                        <h4 className="text-xs font-black text-slate-900 truncate leading-tight">{log.bookTitle}</h4>
                        <p className="text-[10px] text-slate-500 font-semibold truncate font-medium">de {log.bookAuthor}</p>
                      </div>
                    </div>

                    <div className="space-y-1 bg-white p-2.5 rounded-xl border border-emerald-100/40 text-[11px] leading-relaxed">
                      <p className="text-[10px] font-bold text-emerald-850 flex items-center gap-1">
                        <CheckSquare className="h-3 w-3 text-emerald-600" /> Notes d&apos;apprentissage :
                      </p>
                      <p className="text-slate-600 italic">
                        &ldquo;{log.parentNotes || "Ce livre a été lu avec diligence et validé par les parents."}&rdquo;
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100/40 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>Renseigné : {new Date(log.addedAt).toLocaleDateString('fr-FR')}</span>
                      <span className="flex items-center gap-1 text-emerald-700 font-bold px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md">
                        100% Assimilé
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DYNAMIC INTERACTION LAYER: QUIZZES AND READING SCHEMAS (GEMINI) */}
          {interactiveBook && (
            <div id="ai-interactive-sandbox" className="p-6 bg-slate-900 text-white rounded-3xl shadow-lg border border-slate-800 space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/25 text-[10px] font-black uppercase tracking-wider mb-1">
                    <Sparkles className="h-3 w-3" /> Atelier Pédagogique IA actif
                  </div>
                  <h3 className="text-base font-black font-sans text-slate-50 flex items-center gap-1.5">
                    <GraduationCap className="h-5 w-5 text-indigo-400" /> &quot;{interactiveBook.title}&quot; d&apos;étude
                  </h3>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleFetchInteract(interactiveBook, 'guide')}
                    type="button"
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none flex items-center gap-1.5 ${
                      activeInteractiveTab === 'guide'
                        ? 'bg-amber-600 text-white border border-amber-500'
                        : 'bg-slate-800 text-slate-350 hover:text-white border border-transparent'
                    }`}
                  >
                    <BookOpen className="h-4 w-4" /> Guide de lecture
                  </button>
                  <button
                    onClick={() => handleFetchInteract(interactiveBook, 'quiz')}
                    type="button"
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none flex items-center gap-1.5 relative ${
                      activeInteractiveTab === 'quiz'
                        ? 'bg-indigo-600 text-white border border-indigo-500'
                        : 'bg-slate-800 text-slate-350 hover:text-white border border-transparent'
                    }`}
                  >
                    <HelpCircle className="h-4 w-4" /> Quiz Intellectuel
                  </button>
                </div>
              </div>

              {loadingInteract ? (
                <div className="py-12 flex flex-col justify-center items-center gap-3.5 text-center text-slate-450">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                  <p className="text-xs">Initialisation d&apos;une session Gemini dynamique...</p>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in text-xs max-w-3xl">
                  
                  {/* DISPLAY RENDER FOR SYSTEM READING SCHEMATIC GUIDE */}
                  {activeInteractiveTab === 'guide' && generatedGuide && (
                    <div className="space-y-4">
                      <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
                        <h4 className="font-extrabold text-sm text-amber-300 font-sans tracking-tight mb-1">{generatedGuide.title}</h4>
                        <p className="text-[11px] text-slate-300">
                          Suivez ces {generatedGuide.steps.length} jalons pour valider l&apos;acquisition morale et linguistique auprès de {selectedStudent?.name}.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {generatedGuide.steps.map((st) => (
                          <div key={st.stepNumber} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex gap-3 items-start space-y-1">
                            <span className="w-6 h-6 shrink-0 rounded-lg bg-amber-550/20 text-amber-300 border border-amber-550/30 flex items-center justify-center font-mono font-black text-xs">
                              {st.stepNumber}
                            </span>
                            <div className="space-y-1.5">
                              <h5 className="font-bold text-slate-200 text-xs">{st.objective}</h5>
                              <p className="text-[11px] text-slate-400 leading-relaxed"><strong className="text-amber-250 italic">Conseils :</strong> {st.tips}</p>
                              <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl">
                                <p className="text-[10px] text-slate-400 font-bold block">Activité recommandée :</p>
                                <p className="text-[10px] text-slate-300 leading-relaxed pt-0.5">{st.activity}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DISPLAY RENDER FOR SYSTEM INTERACTIVE QUIZZES */}
                  {activeInteractiveTab === 'quiz' && generatedQuiz && (
                    <div className="space-y-4">
                      <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                        <div>
                          <h4 className="font-black text-sm text-indigo-300 font-sans tracking-tight mb-0.5">Quiz d&apos;Assimilation de Lecture</h4>
                          <p className="text-[11px] text-slate-350">Amusez-vous à tester la compréhension de l&apos;enfant.</p>
                        </div>
                        {quizSubmitted && (
                          <div className="px-3.5 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-center">
                            <p className="text-sm font-black font-mono">{quizScore} / {generatedQuiz.length}</p>
                            <p className="text-[8px] font-extrabold uppercase">SCORE</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 pt-1">
                        {generatedQuiz.map((q, qIdx) => (
                          <div key={qIdx} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                            <h5 className="font-bold text-slate-100 flex items-start gap-1 text-[12px] leading-tight">
                              <span className="text-indigo-400 shrink-0 font-mono font-black">{qIdx + 1}.</span>
                              <span>{q.question}</span>
                            </h5>

                            <div className="grid grid-cols-1 gap-2 pl-4">
                              {q.options.map((opt, oIdx) => {
                                const isSelected = quizAnswers[qIdx] === oIdx;
                                const isCorrect = q.correctIndex === oIdx;
                                return (
                                  <button
                                    key={oIdx}
                                    onClick={() => !quizSubmitted && setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }))}
                                    disabled={quizSubmitted}
                                    type="button"
                                    className={`text-left p-3 rounded-xl text-[11px] font-medium border transition cursor-pointer select-none flex items-center justify-between gap-2 ${
                                      quizSubmitted 
                                        ? isCorrect 
                                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                                          : isSelected 
                                            ? 'bg-red-950/40 border-red-500 text-red-300' 
                                            : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                                        : isSelected
                                          ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300'
                                          : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {quizSubmitted && isCorrect && <Trophy className="h-4 w-4 text-amber-400 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>

                            {quizSubmitted && (
                              <div className="pl-4 pt-1.5 text-[10px] text-slate-400 leading-relaxed border-t border-slate-900">
                                <strong className="text-indigo-300 block mb-0.5">Explication Pédagogique :</strong>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        {quizSubmitted ? (
                          <button
                            onClick={() => {
                              setQuizAnswers({});
                              setQuizSubmitted(false);
                            }}
                            type="button"
                            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition select-none"
                          >
                            Rejouer le Quiz
                          </button>
                        ) : (
                          <button
                            onClick={handleSubmitQuiz}
                            disabled={Object.keys(quizAnswers).length < generatedQuiz.length}
                            type="button"
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white rounded-xl font-bold cursor-pointer transition select-none flex items-center gap-1.5"
                          >
                            <Trophy className="h-4 w-4 text-emerald-100" /> Valider mes réponses
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
