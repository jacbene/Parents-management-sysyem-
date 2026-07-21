import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bell, 
  Mail, 
  Users, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  Info,
  ChevronRight,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, ApeeParent, Message, ApeeSettings } from '../types';

interface BulkAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  apeeParents: ApeeParent[];
  onAddMessage: (newMsg: Message) => void;
  apeeSettings?: ApeeSettings;
  portalUserRole?: 'manager' | 'parent' | 'teacher' | null;
}

export default function BulkAnnouncementModal({
  isOpen,
  onClose,
  students,
  apeeParents,
  onAddMessage,
  apeeSettings,
  portalUserRole
}: BulkAnnouncementModalProps) {
  // Config States
  const [segment, setSegment] = useState<'all' | 'class' | 'debtors'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [channel, setChannel] = useState<'email' | 'system' | 'both'>('both');
  const [category, setCategory] = useState<'general' | 'warning' | 'reminder'>('general');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  
  // Simulation/Processing state
  const [isSending, setIsSending] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [processedParents, setProcessedParents] = useState<Array<{
    parentName: string;
    email?: string;
    phone?: string;
    studentName: string;
    status: 'pending' | 'success' | 'error';
    channelUsed: string;
  }>>([]);
  const [currentRecipientIndex, setCurrentRecipientIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [serverLogs, setServerLogs] = useState<string[]>([]);

  // Available classrooms list
  const classrooms = Array.from(new Set(students.map(s => s.classRoom))).filter(Boolean);

  // Set default classroom if empty
  useEffect(() => {
    if (classrooms.length > 0 && !selectedClass) {
      setSelectedClass(classrooms[0] || '');
    }
  }, [classrooms, selectedClass]);

  // Find parent for student helper
  const getStudentParent = (student: Student): ApeeParent | undefined => {
    if (!student) return undefined;
    if (student.id.startsWith('stu_')) {
      const parts = student.id.split('_');
      if (parts.length >= 3 && parts[0] === 'stu') {
        const parentId = parts.slice(1, -1).join('_');
        const found = apeeParents.find(p => p.id === parentId);
        if (found) return found;
      }
    }
    const foundByName = apeeParents.find(p =>
      p.students?.some(stu => (stu?.name || '').trim().toLowerCase() === (student?.name || '').trim().toLowerCase())
    );
    return foundByName;
  };

  // Filter target pupils and their parents
  const getTargetRecipients = () => {
    const list: Array<{ student: Student; parent: ApeeParent }> = [];
    const seenParentIds = new Set<string>();

    students.forEach(student => {
      const parent = getStudentParent(student);
      if (!parent) return;

      let matches = false;
      if (segment === 'all') {
        matches = true;
      } else if (segment === 'class') {
        matches = student.classRoom === selectedClass;
      } else if (segment === 'debtors') {
        matches = parent.status === 'retard' || parent.status === 'partiel';
      }

      if (matches) {
        list.push({ student, parent });
      }
    });

    return list;
  };

  const recipients = getTargetRecipients();

  // Presets templates helper
  const handleApplyPreset = (type: string) => {
    const assocName = apeeSettings?.associationName || "l'Association des Parents d'Élèves";
    const shortName = apeeSettings?.shortName || "APEE";
    
    switch (type) {
      case 'meeting':
        setSubject("📢 Assemblée Générale d'A.P.E.E. de rentrée");
        setCategory('general');
        setContent(`Chers parents,

Le bureau exécutif de ${assocName} (${shortName}) a l'honneur de vous inviter à l'Assemblée Générale annuelle qui se tiendra ce samedi à 10h00 au réfectoire principal de l'établissement.

Ordre du jour :
1. Rapport financier de l'exercice précédent.
2. Élection des nouveaux membres du bureau exécutif.
3. Vote du budget et des priorités de l'année scolaire.
4. Questions diverses.

Votre présence active est décisive pour l'épanouissement scolaire de nos enfants.

Cordialement,
La Direction & Le Bureau de l'${shortName}.`);
        break;
      case 'reminder':
        setSubject("⚠️ Rappel : Cotisation obligatoire d'A.P.E.E.");
        setCategory('reminder');
        setContent(`Chers parents,

Nous vous rappelons que la cotisation annuelle d'A.P.E.E. contribue au financement des enseignants vacataires, du matériel didactique et de l'aménagement sécurisé de l'établissement.

Si vous n'avez pas encore régularisé ou complété vos versements, nous vous prions de vous rapprocher de la caisse ou de procéder à la transaction via les canaux de paiement sécurisés sur votre portail d'accueil.

Montant annuel : ${apeeSettings?.cotisationAmount?.toLocaleString() || "10 000"} FCFA par élève.

Nous vous remercions pour votre collaboration active.

Cordialement,
La Trésorerie A.P.E.E.`);
        break;
      case 'discipline':
        setSubject("🛑 Alerte : Ponctualité, Tenue & Discipline Scolaire");
        setCategory('warning');
        setContent(`Chers parents,

La direction de l'établissement rappelle l'importance capitale du respect du règlement intérieur par tous nos élèves.

1. Horaires : Les barrières ferment strictement à 07h30. Tout retard excessif sera sanctionné.
2. Uniformes : Seuls les uniformes officiels conformes et non modifiés sont acceptés au sein de l'établissement.
3. Téléphones portables : Strictement interdits pendant les heures de cours, sous peine de confiscation définitive.

Nous sollicitons votre encadrement rigoureux à la maison afin de maintenir des normes académiques d'excellence.

Cordialement,
Le Surveillant Général / Censeur.`);
        break;
      default:
        break;
    }
  };

  // Broadcast function
  const handleStartBroadcast = async () => {
    if (!subject.trim() || !content.trim()) return;
    if (recipients.length === 0) return;

    setIsSending(true);
    setProgressPercent(0);
    setCurrentRecipientIndex(0);
    setShowSummary(false);
    setServerLogs([]);

    // Initialize list to keep track of processed recipients in UI
    const recipientsList = recipients.map(r => ({
      parentName: r.parent.name,
      email: r.parent.email,
      phone: r.parent.phone,
      studentName: r.student.name,
      status: 'pending' as const,
      channelUsed: channel === 'both' ? 'E-mail + Notification' : channel === 'email' ? 'E-mail' : 'Notification'
    }));
    setProcessedParents(recipientsList);

    const loggedInTeacher = (() => {
      try {
        const t = localStorage.getItem('portal_teacher_details');
        return t ? JSON.parse(t) : null;
      } catch (e) {
        return null;
      }
    })();

    // 1. Call real backend SMTP/email endpoint
    let apiLogs: string[] = [];
    try {
      const response = await fetch('/api/apee/send-bulk-announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: recipients.map(r => ({
            parentName: r.parent.name,
            parentEmail: r.parent.email,
            email: r.parent.email,
            studentName: r.student.name
          })),
          subject: subject,
          content: content,
          channel: channel
        })
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.logs)) {
        apiLogs = data.logs;
      }
    } catch (err) {
      console.error("Failed to execute backend announcement delivery:", err);
      apiLogs = ["❌ Erreur de connexion avec le serveur de messagerie SMTP."];
    }

    setServerLogs(apiLogs);

    // 2. Write to System notifications in database
    for (let i = 0; i < recipients.length; i++) {
      setCurrentRecipientIndex(i);
      const target = recipients[i];
      const percent = Math.round(((i + 1) / recipients.length) * 100);
      setProgressPercent(percent);

      // Create internal System notification / message thread doc if system or both selected
      if (channel === 'system' || channel === 'both') {
        const msgId = `msg_bulk_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
        const newMsg: Message = {
          id: msgId,
          studentId: target.student.id,
          parentId: target.parent.id,
          senderType: 'Teacher',
          content: `[${subject.toUpperCase()}]\n\n${content}`,
          timestamp: new Date().toISOString(),
          teacherName: loggedInTeacher?.name || "Administration Scolaire",
          ...({
            senderRole: portalUserRole === 'teacher' ? 'Enseignant Titulaire' : 'Administration APEE / Gérant',
            isBulk: true
          } as any)
        };

        try {
          // Write to Firestore database directly so it persists
          await setDoc(doc(db, 'messages', msgId), newMsg);
          // Insert in memory local state
          onAddMessage(newMsg);
        } catch (dbErr) {
          console.warn(`Could not save message ${msgId} to Firestore (local state loaded):`, dbErr);
          // Fallback to memory onAddMessage
          onAddMessage(newMsg);
        }
      }

      // Small artificial delay for visual feedback of dispatching
      await new Promise(resolve => setTimeout(resolve, 80));

      // Mark this parent status as successful in list
      setProcessedParents(prev => {
        const updated = [...prev];
        if (updated[i]) {
          updated[i].status = 'success';
        }
        return updated;
      });
    }

    // Finished!
    setIsSending(false);
    setShowSummary(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-xl border border-slate-150 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          id="bulk-announcement-modal"
        >
          {/* HEADER */}
          <div className="px-6 py-4.5 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-150 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Bell className="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  📢 Diffusion d'Alerte & Annonce Groupée
                </h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  Diffusez instantanément des communiqués de l'école ou de l'APEE à de larges segments de parents.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSending}
              className="p-1.5 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* MAIN MODAL CONTENT */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {!isSending && !showSummary ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT CONSOLE FORM - 7 COLS */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* SEGMENT & TARGET */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-slate-600 tracking-widest flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-indigo-600" />
                      1. Audience / Segment de Parents :
                    </label>
                    <div className="grid grid-cols-3 gap-2.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setSegment('all')}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition cursor-pointer ${
                          segment === 'all'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50/80'
                        }`}
                      >
                        <span className="text-lg">🌍</span>
                        <div>
                          <p className="font-extrabold leading-none">Tous les Parents</p>
                          <p className={`text-[9px] mt-1 font-mono ${segment === 'all' ? 'text-indigo-200' : 'text-slate-450'}`}>
                            {students.length} Élève(s) ciblé(s)
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSegment('class')}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition cursor-pointer ${
                          segment === 'class'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50/80'
                        }`}
                      >
                        <span className="text-lg">🏫</span>
                        <div>
                          <p className="font-extrabold leading-none">Par Classe</p>
                          <p className={`text-[9px] mt-1 font-mono ${segment === 'class' ? 'text-indigo-200' : 'text-slate-450'}`}>
                            Filtre classe spécifique
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSegment('debtors')}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition cursor-pointer ${
                          segment === 'debtors'
                            ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50/40 hover:border-amber-200'
                        }`}
                      >
                        <span className="text-lg">💸</span>
                        <div>
                          <p className="font-extrabold leading-none">Impayés / Solde</p>
                          <p className={`text-[9px] mt-1 font-mono ${segment === 'debtors' ? 'text-amber-100' : 'text-amber-650'}`}>
                            Rappel de cotisation
                          </p>
                        </div>
                      </button>
                    </div>

                    {segment === 'class' && classrooms.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-150 mt-2"
                      >
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Sélectionnez la classe cible :</label>
                        <select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-1.5 border border-slate-200 rounded-xl bg-white"
                        >
                          {classrooms.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </div>

                  {/* CHANNEL & CATEGORY GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* CHANNELS */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-widest flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-500" />
                        2. Canal de Réception :
                      </label>
                      <select
                        value={channel}
                        onChange={(e: any) => setChannel(e.target.value)}
                        className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white"
                      >
                        <option value="both">📧 E-mail + 💬 Notification Système</option>
                        <option value="system">💬 Notification Système uniquement</option>
                        <option value="email">📧 E-mail uniquement (Simulation)</option>
                      </select>
                    </div>

                    {/* CATEGORY */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-widest flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                        3. Type d'Information :
                      </label>
                      <select
                        value={category}
                        onChange={(e: any) => setCategory(e.target.value)}
                        className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white"
                      >
                        <option value="general">ℹ️ Annonce Générale (Neutre)</option>
                        <option value="warning">🛑 Avertissement / Alerte d'Urgence</option>
                        <option value="reminder">💰 Rappel de versement APEE</option>
                      </select>
                    </div>

                  </div>

                  {/* PRESET QUICK CHOICES */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-black uppercase text-slate-600 tracking-widest flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Modèles de messages rapides :
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('meeting')}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100 transition cursor-pointer"
                      >
                        🗣️ Assemblée Générale
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('reminder')}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold rounded-lg border border-purple-100 transition cursor-pointer"
                      >
                        💰 Rappel de Cotisation
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('discipline')}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg border border-amber-100 transition cursor-pointer"
                      >
                        🛑 Discipline & Uniformes
                      </button>
                    </div>
                  </div>

                  {/* INPUT FIELDS */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Objet du communiqué :</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ex: Assemblée Générale d'APEE ou Retard de paiement..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Corps du message :</label>
                        <span className="text-[10px] text-slate-400 font-mono">{content.length} caractères</span>
                      </div>
                      <textarea
                        rows={6}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Rédigez le texte officiel à envoyer aux parents..."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 font-sans leading-relaxed"
                      />
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN PREVIEW & DETAILS - 5 COLS */}
                <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-0">
                  
                  {/* RECIPIENTS COUNT & SUMMARY */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-3">
                    <h4 className="text-[11px] font-black uppercase text-slate-600 tracking-widest flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-indigo-600" />
                      Résumé des destinataires
                    </h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 font-medium">Segment ciblé :</span>
                        <span className="font-extrabold text-slate-800">
                          {segment === 'all' ? "🌍 Tous les parents" : segment === 'class' ? `🏫 Classe : ${selectedClass}` : "💸 Parents débiteurs"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 font-medium">Foyers / Parents ciblés :</span>
                        <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-sm">
                          {recipients.length}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs pb-1">
                        <span className="text-slate-500 font-medium">Distribution active via :</span>
                        <span className="font-bold text-slate-700 uppercase text-[10px]">
                          {channel === 'both' ? "E-mail + Système" : channel === 'email' ? "E-mail" : "Système"}
                        </span>
                      </div>
                    </div>

                    {recipients.length === 0 ? (
                      <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-[10px] leading-relaxed border border-amber-150 font-bold flex gap-2">
                        <span>⚠️</span>
                        <span>Aucun tuteur ou élève ne correspond à ce segment actuellement. Modifiez les filtres de sélection.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-150">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aperçu de la liste ({Math.min(5, recipients.length)} / {recipients.length}) :</span>
                        <div className="max-h-24 overflow-y-auto divide-y divide-slate-100 text-[11px] font-semibold text-slate-600">
                          {recipients.slice(0, 5).map((r, idx) => (
                            <div key={idx} className="py-1 flex justify-between items-center gap-3">
                              <span className="truncate">{r.parent.name}</span>
                              <span className="text-[9px] text-slate-400 shrink-0 font-mono">({r.student.name})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* VISUAL LAYOUT LIVE PREVIEW CARD */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                    <div className="px-3 py-2 bg-slate-800 text-white flex justify-between items-center text-[10px] font-bold">
                      <span className="flex items-center gap-1">📱 APERÇU SUR MOBILE DU TUTORAT</span>
                      <span className="px-1.5 py-0.2 bg-emerald-600 rounded-sm text-[8px]">LIVE</span>
                    </div>

                    <div className="p-4 space-y-3.5 bg-slate-950 min-h-[160px] text-slate-300 font-sans">
                      
                      {/* HEADER PREVIEW */}
                      <div className="flex items-start gap-2.5 border-b border-slate-800 pb-2">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          category === 'general' ? 'bg-indigo-600' : category === 'warning' ? 'bg-rose-600' : 'bg-violet-600'
                        } text-white`}>
                          {category === 'general' ? <Bell className="h-4 w-4" /> : category === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`text-[8px] font-black uppercase tracking-widest rounded-md px-1.5 py-0.5 ${
                            category === 'general' ? 'bg-indigo-950 text-indigo-300 border border-indigo-900' : category === 'warning' ? 'bg-rose-950/80 text-rose-300 border border-rose-900' : 'bg-violet-950 text-violet-300 border border-violet-900'
                          }`}>
                            {category === 'general' ? "Annonce Officielle" : category === 'warning' ? "Urgence / Discipline" : "Frais / Rappel Financier"}
                          </span>
                          <h5 className="text-xs font-black text-white mt-1.5 truncate">{subject || "Sans objet spécifié"}</h5>
                        </div>
                      </div>

                      {/* TEXT BODY PREVIEW */}
                      <p className="text-[11px] text-slate-400 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto font-medium">
                        {content || "Rédigez ou choisissez un modèle rapide à gauche pour visualiser le message final du parent..."}
                      </p>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-[9px] text-slate-500 font-mono">
                        <span>Aujourd'hui, {new Date().toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' })}</span>
                        <span>APEE Emetteur principal</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            ) : isSending ? (
              
              /* SENDING PROGRESS SCREEN */
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin flex items-center justify-center" />
                  <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-sm text-indigo-700">
                    {progressPercent}%
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-base font-extrabold text-slate-900">Envoi en cours...</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {processedParents[currentRecipientIndex] 
                      ? `Traitement de ${processedParents[currentRecipientIndex].parentName} (${processedParents[currentRecipientIndex].studentName})`
                      : "Préparation des envois de masse..."}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-150" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
                  Destinataire {currentRecipientIndex + 1} sur {recipients.length}
                </div>
              </div>

            ) : (
              
              /* SUCCESS SUMMARY */
              <div className="py-6 space-y-6">
                
                {/* BIG CHECK SPLASH */}
                <div className="text-center space-y-2 max-w-md mx-auto">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-2xs">
                    <CheckCircle2 className="h-8 w-8 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900">Diffusion Terminée avec Succès !</h4>
                  <p className="text-xs text-slate-500">
                    L'annonce a été diffusée avec succès auprès de l'ensemble du segment de parents ciblé.
                  </p>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-3 gap-3 text-center max-w-xl mx-auto">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150">
                    <span className="block text-slate-400 text-[10px] font-black uppercase tracking-wider">Cible d'origine</span>
                    <span className="font-mono text-xl font-bold text-slate-800">{recipients.length}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-150">
                    <span className="block text-emerald-600 text-[10px] font-black uppercase tracking-wider">Succès Envoi</span>
                    <span className="font-mono text-xl font-bold text-emerald-700">
                      {processedParents.filter(p => p.status === 'success').length}
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-150">
                    <span className="block text-indigo-600 text-[10px] font-black uppercase tracking-wider">Canal Diffusé</span>
                    <span className="text-xs font-bold text-indigo-800 uppercase block mt-1.5">
                      {channel === 'both' ? "Mail & Port" : channel === 'email' ? "E-mail" : "Portail"}
                    </span>
                  </div>
                </div>

                {/* SMTP REAL TRANSMISSION LOGS */}
                {serverLogs.length > 0 && (
                  <div className="border border-indigo-150 rounded-2xl overflow-hidden bg-slate-900 max-w-2xl mx-auto shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">📧 LOGS DE TRANSMISSION SMTP RÉELS</span>
                      <span className="font-mono bg-indigo-950 text-indigo-400 px-1.5 py-0.2 rounded-sm text-[8px] border border-indigo-900">OPERATIONAL</span>
                    </div>

                    <div className="p-3 divide-y divide-slate-800 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-300 leading-relaxed space-y-1">
                      {serverLogs.map((log, idx) => {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const parts = log.split(urlRegex);
                        return (
                          <div key={idx} className="py-1">
                            {parts.map((part, pidx) => {
                              if (part.match(urlRegex)) {
                                return (
                                  <a 
                                    key={pidx} 
                                    href={part} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-indigo-400 hover:text-indigo-300 font-extrabold underline decoration-indigo-400/50 break-all"
                                  >
                                    {part}
                                  </a>
                                );
                              }
                              return <span key={pidx}>{part}</span>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DISPATCH LOG TABLE */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-w-2xl mx-auto">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-150 flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <span>Journal de diffusion des envois</span>
                    <span className="font-mono">{processedParents.length} lignes</span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {processedParents.map((p, idx) => (
                      <div key={idx} className="px-4 py-2 flex items-center justify-between text-xs font-medium text-slate-600 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-800 truncate">{p.parentName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Enfant : {p.studentName} | {p.email || p.phone || 'Pas de contact'}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded-full flex items-center gap-1 shrink-0">
                          ✓ {p.channelUsed}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* BOTTOM ACTIONS BAR */}
          <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-150 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
              {!isSending && !showSummary ? `${recipients.length} destinataires prêts` : isSending ? "Envoi de masse actif" : "Diffusion terminée"}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer transition disabled:opacity-45"
              >
                {!showSummary ? "Annuler" : "Fermer la console"}
              </button>

              {!isSending && !showSummary && (
                <button
                  type="button"
                  onClick={handleStartBroadcast}
                  disabled={recipients.length === 0 || !subject.trim() || !content.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Lancer la diffusion
                </button>
              )}
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
