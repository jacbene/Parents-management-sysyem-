import React, { useState, useEffect } from 'react';
import { Student, ApeeSettings, ApeeParent, Grade, Attendance, Message } from '../types';
import { Mail, GraduationCap, Calendar, User, UserCheck, Camera, Printer, Phone, TrendingUp, TrendingDown, Clock, MessageSquare, Send, X, Check, AlertCircle, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StudentCameraModal from './StudentCameraModal';
import StudentIDCardModal from './StudentIDCardModal';
import { useLanguage } from '../utils/TranslationContext';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface StudentCardProps {
  key?: string;
  student: Student;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateStudent?: (updated: Student) => void;
  onPrint?: () => void;
  settings?: ApeeSettings;
  apeeParents?: ApeeParent[];
  grades?: Grade[];
  attendanceLogs?: Attendance[];
  portalUserRole?: 'manager' | 'parent' | null;
  onAddMessage?: (newMsg: Message) => void;
}

const isImageAvatar = (avatar: string) => {
  return avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/');
};

export default function StudentCard({ 
  student, 
  isSelected, 
  onSelect, 
  onUpdateStudent, 
  onPrint, 
  settings, 
  apeeParents, 
  grades, 
  attendanceLogs,
  portalUserRole,
  onAddMessage
}: StudentCardProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [showIDCard, setShowIDCard] = useState(false);
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('absence');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const { language } = useLanguage();
  const isFr = language === 'fr';

  useEffect(() => {
    if (showQuickContact) {
      const defaultText = isFr 
        ? `Bonjour, je vous informe que ${student.name} sera absent(e) aujourd'hui pour des raisons de santé. Merci pour votre compréhension.`
        : `Hello, I am writing to inform you that ${student.name} will be absent today due to health reasons. Thank you for your understanding.`;
      setMessageText(defaultText);
      setSelectedTemplateId('absence');
      setSentSuccess(false);
    }
  }, [showQuickContact, language]);

  // Find titular teacher for classroom in settings
  const foundTeacher = settings?.classTeachers?.find(t => {
    const classRoomName = student.classRoom || '';
    return t.classRoom.toLowerCase() === classRoomName.toLowerCase() || 
           classRoomName.toLowerCase().includes(t.classRoom.toLowerCase()) ||
           t.classRoom.toLowerCase().includes(classRoomName.toLowerCase());
  });

  const teacherName = foundTeacher?.teacherName || student.teacherName || 'Enseignant principal';
  const teacherEmail = foundTeacher?.teacherEmail || student.teacherEmail || '';

  // Find matching parent/guardian details
  const getMatchingParent = (): ApeeParent | undefined => {
    if (!apeeParents) return undefined;
    if (student.id.startsWith('stu_')) {
      const parts = student.id.split('_');
      if (parts.length >= 3 && parts[0] === 'stu') {
        const parentId = parts.slice(1, -1).join('_');
        const found = apeeParents.find(p => p.id === parentId);
        if (found) return found;
      }
    }
    const foundByName = apeeParents.find(p =>
      p.students?.some(stu => stu.name.trim().toLowerCase() === student.name.trim().toLowerCase())
    );
    if (foundByName) return foundByName;
    return undefined;
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setSendingMessage(true);

    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const matchingParent = getMatchingParent();
    const newMsg: Message = {
      id,
      studentId: student.id,
      parentId: student.parentId || matchingParent?.id || 'unknown_parent',
      senderType: 'Parent',
      content: messageText.trim(),
      timestamp: new Date().toISOString(),
      ...({
        recipientName: teacherName,
        recipientRole: isFr ? 'Professeur Principal' : 'Class Teacher'
      } as any)
    };

    try {
      await setDoc(doc(db, 'messages', id), newMsg);
      if (onAddMessage) {
        onAddMessage(newMsg);
      }
      setSentSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `messages/${id}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const matchingParent = getMatchingParent();

  // Calculate best and worst subjects
  const studentGrades = (grades || []).filter(g => g.studentId === student.id);
  const subjectAveragesMap: { [subj: string]: { sumBase20: number; count: number } } = {};
  studentGrades.forEach(g => {
    const scoreOn20 = (g.score / g.maxScore) * 20;
    if (!subjectAveragesMap[g.subject]) {
      subjectAveragesMap[g.subject] = { sumBase20: 0, count: 0 };
    }
    subjectAveragesMap[g.subject].sumBase20 += scoreOn20;
    subjectAveragesMap[g.subject].count += 1;
  });

  const subjectAverages = Object.keys(subjectAveragesMap).map(subj => {
    const stats = subjectAveragesMap[subj];
    return {
      subject: subj,
      avg: stats.sumBase20 / stats.count
    };
  });

  let bestSubject = null;
  let worstSubject = null;

  if (subjectAverages.length > 0) {
    const sorted = [...subjectAverages].sort((a, b) => b.avg - a.avg);
    bestSubject = sorted[0];
    worstSubject = sorted[sorted.length - 1];
  }

  // Calculate attendance rate
  const studentAttendance = (attendanceLogs || []).filter(a => a.studentId === student.id);
  const totalLogs = studentAttendance.length;
  const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
  const excusedCount = studentAttendance.filter(a => a.status === 'Excused').length;
  const presenceRate = totalLogs > 0
    ? (((presentCount + excusedCount) / totalLogs) * 100).toFixed(1)
    : '100.0';

  return (
    <>
      <motion.div
        onClick={onSelect}
        className={`StudentCard relative p-5 rounded-2xl border transition-all cursor-pointer duration-300 ${
          isSelected
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
            : 'bg-white border-gray-100 text-gray-900 dark:text-slate-100 hover:border-gray-200 hover:shadow-sm dark:bg-slate-900 dark:border-slate-800/80 dark:hover:border-slate-700'
        }`}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex gap-4 items-start">
          <div className="relative shrink-0">
            {/* Avatar display frame with interactive hover overlay */}
            <div 
              onClick={(e) => {
                e.stopPropagation(); // prevent selecting the card
                setShowCamera(true);
              }}
              className={`group w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center relative border cursor-pointer transition-all duration-300 ${
                isSelected 
                  ? 'border-indigo-400 bg-white/10 hover:bg-white/20' 
                  : 'border-gray-150 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/25 dark:border-slate-700 dark:bg-slate-800/85'
              }`}
              title="Cliquer pour changer la photo"
            >
              {isImageAvatar(student.avatar) ? (
                <img 
                  src={student.avatar} 
                  alt={student.name} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <span className="text-3xl font-sans transition-transform duration-300 group-hover:scale-110" role="img" aria-label="student avatar">
                  {student.avatar}
                </span>
              )}
              {/* Sleek cover overlay for photo customization */}
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white">
                <Camera className="h-4.5 w-4.5" />
                <span className="text-[7.5px] font-sans font-black uppercase tracking-wider mt-0.5">Éditer</span>
              </div>
            </div>

            {/* Quick Camera Badge Trigger */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // prevent selecting the card
                setShowCamera(true);
              }}
              className={`absolute -bottom-1 -right-1 p-1 rounded-full border shadow-xs hover:scale-110 active:scale-95 transition-all text-xs cursor-pointer ${
                isSelected 
                  ? 'bg-amber-500 border-amber-400 text-white hover:bg-amber-600' 
                  : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
              }`}
              title="Prendre une photo de l'élève"
            >
              <Camera className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3 className={`font-bold font-sans text-base truncate ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                {student.name}
              </h3>
              {isSelected && <span className="bg-white/20 text-white text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"><UserCheck className="h-2.5 w-2.5" /> Actif</span>}
            </div>
            <p className={`text-xs ${isSelected ? 'text-indigo-100' : 'text-gray-500 dark:text-slate-400'} font-medium`}>
              {student.grade} • {student.classRoom}
            </p>
            <div className="pt-2 border-t border-dashed mt-2 border-white/10 space-y-1 text-[11px] sm:text-xs">
              <div className={`flex items-center justify-between gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500 dark:text-slate-400'}`}>
                <div className="flex items-center gap-1.5 truncate">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">Enseignant : <strong className={isSelected ? 'text-white' : 'text-gray-700 dark:text-slate-300'}>{teacherName}</strong></span>
                </div>
                {portalUserRole === 'parent' && onAddMessage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickContact(true);
                    }}
                    className={`p-1 rounded-md border transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                        : 'bg-indigo-50 dark:bg-slate-800 border-indigo-100 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700'
                    }`}
                    title={isFr ? "Contacter rapidement l'enseignant" : "Quick contact teacher"}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">Tuteur : <strong className={isSelected ? 'text-white' : 'text-gray-700'}>{matchingParent?.name || 'Non renseigné'}</strong></span>
              </div>
              {matchingParent?.phone && (
                <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">Tél Parent : <strong className={isSelected ? 'text-white font-mono' : 'text-gray-700 font-mono'}>{matchingParent.phone}</strong></span>
                </div>
              )}
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <TrendingUp className={`h-3 w-3 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-emerald-600'}`} />
                <span className="truncate">Best : <strong className={isSelected ? 'text-white' : 'text-emerald-700 font-bold'}>{bestSubject ? `${bestSubject.subject} (${bestSubject.avg.toFixed(1)}/20)` : 'N/A'}</strong></span>
              </div>
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <TrendingDown className={`h-3 w-3 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-rose-600'}`} />
                <span className="truncate">Pire : <strong className={isSelected ? 'text-white' : 'text-rose-700 font-bold'}>{worstSubject ? `${worstSubject.subject} (${worstSubject.avg.toFixed(1)}/20)` : 'N/A'}</strong></span>
              </div>
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">Assiduité : <strong className={isSelected ? 'text-white font-mono' : 'text-gray-700 font-mono'}>{presenceRate}%</strong></span>
              </div>
            </div>

            {/* Action Buttons */}
            {isSelected && (
              <div className="pt-3 mt-3 border-t border-white/20 flex flex-col sm:flex-row gap-2">
                {onPrint && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrint();
                    }}
                    className="bg-white hover:bg-slate-50 text-indigo-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all flex-1 active:scale-97"
                    title="Générer un dossier d'élève imprimable"
                  >
                    <Printer className="h-3.5 w-3.5 shrink-0" />
                    <span>Imprimer fiche</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowIDCard(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-xl border border-indigo-500 shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all flex-1 active:scale-97"
                  title="Afficher la carte scolaire officielle avec QR code"
                >
                  <QrCode className="h-3.5 w-3.5 shrink-0" />
                  <span>Carte ID (QR)</span>
                </button>

                {portalUserRole === 'parent' && onAddMessage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickContact(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-xl shadow-xs border border-amber-400 cursor-pointer flex items-center justify-center gap-1.5 transition-all flex-1 active:scale-97"
                    title="Contacter rapidement l'enseignant"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>Contact rapide</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modal interface rendered dynamically */}
      {showCamera && onUpdateStudent && (
        <StudentCameraModal
          student={student}
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onUpdate={onUpdateStudent}
        />
      )}

      {showIDCard && (
        <StudentIDCardModal
          student={student}
          isOpen={showIDCard}
          onClose={() => setShowIDCard(false)}
          settings={settings}
        />
      )}

      {/* Quick Contact Modal */}
      {showQuickContact && onAddMessage && (
        <AnimatePresence>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setShowQuickContact(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md border border-gray-150 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2 font-sans">
                    <MessageSquare className="h-5 w-5" />
                    <span>{isFr ? "Contact Rapide" : "Quick Contact"}</span>
                  </h3>
                  <p className="text-xs text-indigo-100 font-sans mt-0.5 font-medium">
                    {isFr ? `Élève : ${student.name} • Classe : ${student.classRoom}` : `Student: ${student.name} • Class: ${student.classRoom}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickContact(false)}
                  className="p-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-slate-800">
                {sentSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center text-center py-6 space-y-3"
                  >
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                      <Check className="h-10 w-10 animate-bounce" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 font-sans">
                      {isFr ? "Message envoyé !" : "Message Sent!"}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {isFr 
                        ? `Votre message de contact rapide a été transmis avec succès à l'enseignant ${teacherName} dans la messagerie.` 
                        : `Your quick contact message has been successfully transmitted to classroom teacher ${teacherName} in the messaging board.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowQuickContact(false)}
                      className="w-full mt-4 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold rounded-xl transition text-xs cursor-pointer"
                    >
                      {isFr ? "Fermer" : "Close"}
                    </button>
                  </motion.div>
                ) : (
                  <>
                    {/* Recipient banner */}
                    <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {isFr ? "REPRÉSENTANT ENSEIGNANT DE LA CLASSE" : "CLASSROOM FACULTY DELEGATE"}
                        </span>
                        <h4 className="font-sans font-black text-slate-800 text-sm truncate">{teacherName}</h4>
                        {teacherEmail && <p className="text-[10.5px] text-slate-500 truncate">{teacherEmail}</p>}
                      </div>
                    </div>

                    {/* Pre-formatted choice selectors */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                        {isFr ? "Sélectionner un motif de message :" : "Select a message reason:"}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            id: 'absence',
                            label: isFr ? 'Absence' : 'Absence',
                            emoji: '🤒',
                            text: isFr 
                              ? `Bonjour, je vous informe que ${student.name} sera absent(e) aujourd'hui pour des raisons de santé. Merci pour votre compréhension.`
                              : `Hello, I am writing to inform you that ${student.name} will be absent today due to health reasons. Thank you for your understanding.`
                          },
                          {
                            id: 'late',
                            label: isFr ? 'Retard' : 'Late',
                            emoji: '⏰',
                            text: isFr
                              ? `Bonjour, je vous informe que ${student.name} aura un léger retard ce matin en raison d'un contretemps de transport. Merci pour votre compréhension.`
                              : `Hello, I wanted to let you know that ${student.name} will be slightly late this morning due to transportation delays. Thank you for your understanding.`
                          },
                          {
                            id: 'appointment',
                            label: isFr ? 'Rendez-vous' : 'Meeting',
                            emoji: '📅',
                            text: isFr
                              ? `Bonjour, je souhaiterais prendre rendez-vous avec vous à votre convenance pour échanger sur le suivi scolaire et les progrès de ${student.name}. Merci d'avance.`
                              : `Hello, I would like to request a parent-teacher meeting at your earliest convenience to discuss the academic progress of ${student.name}. Thank you.`
                          },
                          {
                            id: 'homework',
                            label: isFr ? 'Devoirs' : 'Homework',
                            emoji: '📚',
                            text: isFr
                              ? `Bonjour, ${student.name} rencontre des difficultés sur les devoirs demandés aujourd'hui. Pourriez-vous nous guider ou réexpliquer le point de blocage ? Cordialement.`
                              : `Hello, ${student.name} is struggling with the homework assigned today. Could you please provide some guidance or clarify the requirements? Best regards.`
                          },
                          {
                            id: 'progress',
                            label: isFr ? 'Bilan Progrès' : 'Progress check',
                            emoji: '📈',
                            text: isFr
                              ? `Bonjour, j'aimerais avoir un retour rapide sur le comportement et le travail général de ${student.name} ces derniers temps. Merci pour votre dévouement.`
                              : `Hello, I would love to get a quick update on ${student.name}'s behavior and academic participation lately. Thank you for your dedication.`
                          }
                        ].map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplateId(tpl.id);
                              setMessageText(tpl.text);
                            }}
                            className={`flex items-center gap-1.5 p-2 rounded-xl border text-left transition cursor-pointer text-xs ${
                              selectedTemplateId === tpl.id
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50/50'
                            }`}
                          >
                            <span role="img" aria-label={tpl.id}>{tpl.emoji}</span>
                            <span className="truncate">{tpl.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview Area / Text Area */}
                    <div className="space-y-1.5 pt-1 text-left">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                        {isFr ? "Aperçu et personnalisation du message :" : "Preview and customize direct message:"}
                      </label>
                      <textarea
                        rows={4}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-sans text-slate-800 leading-relaxed bg-slate-50/25 resize-none"
                        placeholder={isFr ? "Écrivez votre message..." : "Type custom message..."}
                        required
                      />
                    </div>

                    {/* Modal Actions */}
                    <div className="flex gap-2.5 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowQuickContact(false)}
                        className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                      >
                        {isFr ? "Annuler" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={sendingMessage || !messageText.trim()}
                        onClick={handleSendMessage}
                        className="flex-1 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        {sendingMessage ? (
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            <span>{isFr ? "Envoyer" : "Send message"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </>
  );
}
