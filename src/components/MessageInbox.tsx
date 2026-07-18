import React, { useState, useRef, useEffect } from 'react';
import { Message, Student, ApeeParent, ApeeSettings } from '../types';
import { 
  Send, 
  MessageSquare, 
  User, 
  Clock, 
  AlertCircle, 
  Phone, 
  Mail, 
  Smartphone, 
  Search, 
  CheckCheck, 
  MessageCircle, 
  Share2, 
  UserCheck, 
  Bell, 
  Check, 
  Info,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useLanguage } from '../utils/TranslationContext';
import BulkAnnouncementModal from './BulkAnnouncementModal';

interface MessageInboxProps {
  messages: Message[];
  students: Student[];
  onAddMessage: (newMsg: Message) => void;
  apeeParents: ApeeParent[];
  portalUserRole?: 'manager' | 'parent' | 'teacher' | null;
  apeeSettings?: ApeeSettings;
}

export default function MessageInbox({ 
  messages, 
  students, 
  onAddMessage, 
  apeeParents,
  portalUserRole = 'parent',
  apeeSettings 
}: MessageInboxProps) {
  const { t } = useLanguage();
  const isAdmin = portalUserRole === 'manager' || portalUserRole === 'teacher';

  const loggedInTeacher = (() => {
    try {
      const t = localStorage.getItem('portal_teacher_details');
      return t ? JSON.parse(t) : null;
    } catch (e) {
      return null;
    }
  })();

  // Determine classroom list from students or settings
  const classrooms = Array.from(new Set(students.map(s => s.classRoom))).filter(Boolean);

  // Search & Filter state (for school managers)
  const [adminSearch, setAdminSearch] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Selected thread identification
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Mobile responsive layout view toggle (list vs chat)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Local message inputs
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  
  // Custom sender identity selection for Administration
  const [adminSenderAlias, setAdminSenderAlias] = useState<'Director' | 'PedManager' | 'ClassTeacher'>('PedManager');
  const [customSenderName, setCustomSenderName] = useState('');

  // Custom recipient role selection for Parents
  const [parentRecipientRole, setParentRecipientRole] = useState<'Teacher' | 'Censor' | 'Director'>('Teacher');

  // Phone action simulation overlay states
  const [simulatedMobileSms, setSimulatedMobileSms] = useState<{
    isOpen: boolean;
    sender: string;
    body: string;
    parentName: string;
    parentPhone: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-init selected student
  useEffect(() => {
    const isValidId = students.some(s => s.id === selectedStudentId);
    if ((!selectedStudentId || !isValidId) && students.length > 0) {
      if (isAdmin) {
        // For admin, select the student with most recent conversation or first active student
        const recentMsg = [...messages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        const initialId = (recentMsg && students.some(s => s.id === recentMsg.studentId)) ? recentMsg.studentId : (students[0]?.id || '');
        setSelectedStudentId(initialId);
      } else {
        setSelectedStudentId(students[0]?.id || '');
      }
    }
  }, [students, isAdmin, messages, selectedStudentId]);

  const currentStudent = students.find(s => s.id === selectedStudentId);

  // Find matching parent/guardian of specific student helper
  const getMatchingParent = (student: Student | undefined): ApeeParent | undefined => {
    if (!student) return undefined;
    
    // Attempt 1: From child ID convention (stu_[parent_id]_[idx])
    if (student.id.startsWith('stu_')) {
      const parts = student.id.split('_');
      if (parts.length >= 3 && parts[0] === 'stu') {
        const parentId = parts.slice(1, -1).join('_');
        const found = apeeParents.find(p => p.id === parentId);
        if (found) return found;
      }
    }

    // Attempt 2: By exact student name matching in any parent's student links
    const foundByName = apeeParents.find(p =>
      p.students?.some(stu => stu.name.trim().toLowerCase() === student.name.trim().toLowerCase())
    );
    if (foundByName) return foundByName;

    return undefined;
  };

  const matchingParent = getMatchingParent(currentStudent);

  // Find class teacher info for a student
  const getStudentTeacherInfo = (student: Student | undefined) => {
    if (!student) return { name: '', email: '', phone: '' };
    const foundTeacher = apeeSettings?.classTeachers?.find(t => 
      t.classRoom.toLowerCase() === student.classRoom.toLowerCase() ||
      student.classRoom.toLowerCase().includes(t.classRoom.toLowerCase())
    );

    return {
      name: foundTeacher?.teacherName || student.teacherName || 'Professeur Principal',
      email: foundTeacher?.teacherEmail || student.teacherEmail || 'sophie.laurent@pasma.sys',
      phone: foundTeacher?.teacherPhone || '654 053 000'
    };
  };

  const currentTeacherInfo = getStudentTeacherInfo(currentStudent);

  const directorInfo = {
    name: apeeSettings?.directorName || 'Directeur / Proviseur d\'Établissement',
    phone: apeeSettings?.directorPhone || '677 000 001',
    email: apeeSettings?.directorEmail || 'direction@pasma.sys'
  };

  const censorInfo = {
    name: apeeSettings?.pedManagerName || apeeSettings?.censeurName || apeeSettings?.surveillantName || 'Censeur & Surveillant Général',
    phone: apeeSettings?.pedManagerPhone || apeeSettings?.censeurPhone || apeeSettings?.surveillantPhone || '655 000 002',
  };

  // Filter messages by selected student conversation thread
  const threadMessages = messages
    .filter(m => m.studentId === selectedStudentId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Filter students list for Selection in Admin panel
  const getFilteredAdminStudents = () => {
    return students.filter(student => {
      // 1. Classroom filter
      if (selectedClassroom !== 'all' && student.classRoom !== selectedClassroom) {
        return false;
      }

      // 2. Active discussion only (has messages)
      if (filterActiveOnly) {
        const hasMsgs = messages.some(m => m.studentId === student.id);
        if (!hasMsgs) return false;
      }

      // 3. Search text matching (student name, class, or parent name/phone)
      if (adminSearch.trim()) {
        const queryNorm = adminSearch.toLowerCase().trim();
        const parent = getMatchingParent(student);
        const nameMatches = student.name.toLowerCase().includes(queryNorm);
        const classMatches = student.classRoom.toLowerCase().includes(queryNorm);
        const parentNameMatches = parent ? parent.name.toLowerCase().includes(queryNorm) : false;
        const parentPhoneMatches = parent ? parent.phone.includes(queryNorm) : false;

        return nameMatches || classMatches || parentNameMatches || parentPhoneMatches;
      }

      return true;
    });
  };

  const adminStudentsList = getFilteredAdminStudents();

  // Highlight snippet of last message in threads list
  const getThreadLastMessage = (studentId: string) => {
    const sMsgs = messages.filter(m => m.studentId === studentId);
    if (sMsgs.length === 0) return null;
    return sMsgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !selectedStudentId || !currentStudent) return;

    setSending(true);
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Resolve sender details based on context roles
    const senderTypeToUse = isAdmin ? 'Teacher' : 'Parent';
    
    // Resolve teacher/administrator display name
    let senderName = currentTeacherInfo.name;
    if (isAdmin) {
      if (portalUserRole === 'teacher' && loggedInTeacher) {
        senderName = loggedInTeacher.name;
      } else if (adminSenderAlias === 'PedManager') {
        senderName = censorInfo.name;
      } else if (adminSenderAlias === 'Director') {
        senderName = directorInfo.name;
      } else if (customSenderName.trim()) {
        senderName = customSenderName.trim();
      }
    }

    let recipientName = '';
    let recipientRole = '';
    if (!isAdmin) {
      if (parentRecipientRole === 'Teacher') {
        recipientName = currentTeacherInfo.name;
        recipientRole = 'Professeur Principal';
      } else if (parentRecipientRole === 'Censor') {
        recipientName = censorInfo.name;
        recipientRole = 'Censeur / Surveillant Général';
      } else if (parentRecipientRole === 'Director') {
        recipientName = directorInfo.name;
        recipientRole = 'Directeur / Proviseur';
      }
    }

    const newMsg: Message = {
      id,
      studentId: selectedStudentId,
      parentId: currentStudent.parentId || matchingParent?.id || 'unknown_parent',
      senderType: senderTypeToUse,
      content: textInput,
      timestamp: new Date().toISOString(),
      teacherName: isAdmin ? senderName : undefined,
      // Extra properties using bracket index signatures or cast to avoid TS compilation noise
      ...({
        recipientName: !isAdmin ? recipientName : undefined,
        recipientRole: !isAdmin ? recipientRole : undefined,
        senderRole: isAdmin ? (portalUserRole === 'teacher' ? 'Enseignant Titulaire' : adminSenderAlias === 'PedManager' ? 'Censeur / Surveillant' : adminSenderAlias === 'Director' ? 'Directeur / Proviseur' : 'Professeur principal') : undefined
      } as any)
    };

    try {
      await setDoc(doc(db, 'messages', id), newMsg);
      onAddMessage(newMsg);
      setTextInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `messages/${id}`);
    } finally {
      setSending(false);
    }
  };

  // Phone integration utilities
  const formatSmsUri = (phone: string, text: string) => {
    return `sms:${phone.replace(/\s+/g, '')}?body=${encodeURIComponent(text)}`;
  };

  const formatWhatsAppUri = (phone: string, text: string) => {
    // Standardize to Cameroonian international code +237 if starting with 6 and length is 9 digits
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 9 && cleanPhone.startsWith('6')) {
      cleanPhone = `237${cleanPhone}`;
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const triggerPhoneSimulation = (type: 'sms' | 'whatsapp', customBody?: string) => {
    if (!currentStudent || !matchingParent) return;

    const bodyText = customBody || `Bonjour ${matchingParent.name}, l'administration de l'établissement pasma.sys vous a envoyé un message important sur votre espace ENT concernant l'élève ${currentStudent.name}. Veuillez vous connecter.`;
    const senderLabel = adminSenderAlias === 'PedManager' 
      ? (apeeSettings?.pedManagerName || 'Resp. Pédagogique') 
      : adminSenderAlias === 'Director' 
        ? (apeeSettings?.directorName || 'Proviseur') 
        : currentTeacherInfo.name;

    setSimulatedMobileSms({
      isOpen: true,
      sender: type === 'sms' ? `SMS : PASMA-SYS` : `WhatsApp : ${senderLabel}`,
      body: bodyText,
      parentName: matchingParent.name,
      parentPhone: matchingParent.phone
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4 border-gray-100 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black font-sans text-slate-900 tracking-tight flex items-center gap-2.5">
            {isAdmin ? (
              <>
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Smartphone className="h-5 w-5" />
                </div>
                <span>{t('tab.messages')}</span>
              </>
            ) : (
              <>
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <span>{t('tab.messages')}</span>
              </>
            )}
          </h2>
          <p className="text-sm text-slate-550 pt-1">
            {isAdmin 
              ? t('msg.console_admin')
              : t('msg.console_parent')}
          </p>
        </div>

        {/* Legend block display role & Bulk messaging action */}
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-1.5"
              id="btn-open-bulk-announcement"
            >
              <span>📢 Diffusion Groupée</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('msg.active_session')}</span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isAdmin 
                ? 'bg-amber-120 text-amber-900 border border-amber-200 shadow-3xs' 
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
            }`}>
              {isAdmin ? t('msg.role_admin') : t('msg.role_parent')}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Grid Layout */}
      {students.length === 0 ? (
        <div className="text-center p-14 bg-slate-50 rounded-2xl border border-slate-150">
          <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">Aucun élève identifié</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Le système n'a trouvé aucun élève dans la base de données de cet établissement pour initier des conversations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 border border-slate-150 rounded-3xl overflow-hidden bg-slate-50 min-h-[580px] h-[650px] lg:h-[700px]">
          
          {/* LEFT COLUMN: CONVERSATION LIST FOR TEACHERS / OR CHILD SWITCHER FOR PARENTS */}
          <div className={`bg-white border-r border-slate-150 flex flex-col justify-between overflow-hidden h-full ${
            mobileView === 'chat' ? 'hidden lg:flex' : 'flex h-full'
          }`}>
            
            {/* ADMIN ONLY SEARCHBARS & FILTERS */}
            {isAdmin ? (
              <div className="p-4 bg-slate-50/50 border-b border-slate-150 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t('msg.search_placeholder')}
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-xl text-[11px] font-bold bg-white"
                  >
                    <option value="all">{t('msg.all_classes', { count: classrooms.length })}</option>
                    {classrooms.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setFilterActiveOnly(!filterActiveOnly)}
                    className={`px-2.5 py-1 px-3 border rounded-xl text-[11px] font-bold cursor-pointer transition ${
                      filterActiveOnly 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                    }`}
                  >
                    {t('msg.filter_active')}
                  </button>
                </div>
              </div>
            ) : (
              // PARENT THREAD SELECTOR
              <div className="p-4 border-b border-slate-150 bg-slate-50/20">
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-2">Sélectionner la fiche de l'élève :</span>
                <div className="space-y-1.5">
                  {students.map(s => {
                    const isSelected = s.id === selectedStudentId;
                    const lastMsg = getThreadLastMessage(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(s.id);
                          setMobileView('chat');
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {s.avatar && (s.avatar.startsWith('data:image') || s.avatar.startsWith('http') || s.avatar.startsWith('/')) ? (
                          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                            <img 
                              src={s.avatar} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer" 
                            />
                          </div>
                        ) : (
                          <span className="text-xl shrink-0">{s.avatar || '🎓'}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold leading-none truncate">{s.name}</h4>
                          <span className={`text-[9px] font-mono leading-none ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            Classe : {s.classRoom}
                          </span>
                        </div>
                        {lastMsg && (
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-150' : 'bg-slate-100 text-slate-500'}`}>
                            Actif
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* THREAD LIST SCROLL AREA (ADMIN MODE) */}
            {isAdmin ? (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {adminStudentsList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <User className="h-6 w-6 mx-auto text-slate-300" />
                    <p className="text-[11px]">Aucune conversation ne correspond à ces filtres.</p>
                  </div>
                ) : (
                  adminStudentsList.map(s => {
                    const isSelected = s.id === selectedStudentId;
                    const lastMsg = getThreadLastMessage(s.id);
                    const parent = getMatchingParent(s);

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(s.id);
                          setMobileView('chat');
                        }}
                        className={`w-full p-3.5 text-left flex gap-3 transition cursor-pointer border-l-3 ${
                          isSelected 
                            ? 'bg-indigo-50/50 border-l-indigo-600 text-indigo-955 shadow-2xs' 
                            : 'border-l-transparent text-slate-700 hover:bg-slate-50/60'
                        }`}
                      >
                        {s.avatar && (s.avatar.startsWith('data:image') || s.avatar.startsWith('http') || s.avatar.startsWith('/')) ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200 mt-0.5">
                            <img 
                              src={s.avatar} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer" 
                            />
                          </div>
                        ) : (
                          <span className="text-2xl pt-1 shrink-0">{s.avatar || '👦'}</span>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-black truncate">{s.name}</h4>
                            <span className="text-[9px] font-mono bg-slate-150 text-slate-700 px-1 py-0.2 rounded-md shrink-0">
                              {s.classRoom}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 font-medium truncate">
                            Parent : {parent ? parent.name : 'Non répertorié'}
                          </p>

                          {lastMsg ? (
                            <div className="flex items-center gap-1.5 mt-1 border-t border-slate-100/50 pt-1 text-[10px] text-slate-400 truncate">
                              <span className="font-bold uppercase text-[8px] select-none text-indigo-500">
                                {lastMsg.senderType === 'Parent' ? 'Parent' : 'Eco'} :
                              </span>
                              <span className="truncate italic">{lastMsg.content}</span>
                            </div>
                          ) : (
                            <p className="text-[9px] text-amber-600 italic mt-1">Aucun échange. Lancer un mot ?</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              // PARENT SIDEBAR INFO BLOCK
              <div className="p-4 bg-slate-50/50 space-y-3 flex-1 overflow-y-auto">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsables Référents</h3>
                
                {/* 1. Classroom Main Teacher */}
                <div className="p-3 bg-white rounded-2xl border border-slate-150 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧑‍🏫</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 truncate">{currentTeacherInfo.name}</h4>
                      <p className="text-[9px] text-slate-400 font-medium">Professeur principal de {currentStudent?.name}</p>
                    </div>
                  </div>
                  
                  {/* Phone Relations for Parents to dial teacher */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[10px] font-mono select-none">
                    <a
                      href={`tel:${currentTeacherInfo.phone}`}
                      className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg flex items-center gap-1 cursor-pointer transition font-bold"
                      title="Appeler l'enseignant"
                    >
                      <Phone className="h-3 w-3" /> Appeler
                    </a>
                    
                    <a
                      href={formatWhatsAppUri(currentTeacherInfo.phone, `Bonjour, je suis le parent de l'élève ${currentStudent?.name || ''}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg flex items-center gap-1 cursor-pointer transition font-bold"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                </div>

                {/* 2. Educational Superintendent Details (Censeur & Surveillant) */}
                <div className="p-3 bg-white rounded-2xl border border-slate-150 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🗣️</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 truncate">{censorInfo.name}</h4>
                      <p className="text-[9px] text-slate-400 font-medium">Censeur / Surveillant Général</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[10px] font-mono select-none">
                    <a
                      href={`tel:${censorInfo.phone}`}
                      className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg flex items-center gap-1 cursor-pointer transition font-bold"
                      title="Appeler le censeur ou surveillant"
                    >
                      <Phone className="h-3 w-3" /> Appeler
                    </a>
                    
                    <a
                      href={formatWhatsAppUri(censorInfo.phone, `Bonjour, je suis le parent de l'élève ${currentStudent?.name || ''}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg flex items-center gap-1 cursor-pointer transition font-bold"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                </div>

                {/* 3. Directeur / Proviseur */}
                <div className="p-3 bg-white rounded-2xl border border-slate-150 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏛️</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 truncate">{directorInfo.name}</h4>
                      <p className="text-[9px] text-slate-400 font-medium">Directeur / Proviseur</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[10px] font-mono select-none">
                    <a
                      href={`tel:${directorInfo.phone}`}
                      className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg flex items-center gap-1 cursor-pointer transition font-bold"
                      title="Appeler le Directeur ou Proviseur"
                    >
                      <Phone className="h-3 w-3" /> Appeler
                    </a>
                    
                    <a
                      href={formatWhatsAppUri(directorInfo.phone, `Bonjour, je suis le parent de l'élève ${currentStudent?.name || ''}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg flex items-center gap-1 cursor-pointer transition font-bold"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Sidebar bottom action info notice */}
            <div className="p-3 bg-slate-100 text-[10px] text-slate-500 border-t border-slate-150 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span>Double-canal synchronisé : ENT + Téléphonie directe.</span>
            </div>
          </div>

          {/* MAIN COLUMN & RIGHT SIDE COLUMN DETAILS (COMPOUND) */}
          <div className={`lg:col-span-2 flex flex-col justify-between bg-slate-50 relative overflow-hidden h-full ${
            mobileView === 'list' ? 'hidden lg:flex' : 'flex h-full'
          }`}>
            
            {/* THREAD HEADER */}
            <div className="p-4 bg-white border-b border-slate-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile Back Button to list of discussions */}
                {mobileView === 'chat' && (
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="lg:hidden p-1.5 -ml-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center gap-1 font-black text-xs"
                    title={t('msg.back')}
                  >
                    <ArrowLeft className="h-4.5 w-4.5" />
                    <span>{t('msg.back')}</span>
                  </button>
                )}

                {currentStudent?.avatar && (currentStudent.avatar.startsWith('data:image') || currentStudent.avatar.startsWith('http') || currentStudent.avatar.startsWith('/')) ? (
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl overflow-hidden block shrink-0 border border-slate-200">
                    <img 
                      src={currentStudent.avatar} 
                      alt="" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                ) : (
                  <span className="text-3xl bg-slate-100 p-1.5 rounded-2xl block shrink-0">
                    {currentStudent?.avatar || '👦'}
                  </span>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-sm text-slate-900 leading-tight">
                      {currentStudent ? currentStudent.name : 'Sélectionnez un élève'}
                    </h3>
                    {currentStudent && (
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-md border border-indigo-100">
                        {currentStudent.classRoom}
                      </span>
                    )}
                  </div>
                  {matchingParent ? (
                    <p className="text-xs text-slate-500 font-medium">
                      Famille : <strong className="text-slate-700">{matchingParent.name}</strong> 
                      {matchingParent.phone && <span className="text-slate-400 font-mono text-[11px]"> ({matchingParent.phone})</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Aucun parent APEE rattaché à cet élève</p>
                  )}
                </div>
              </div>

              {/* PHONE DISPATCHER BOX (DEEP TELEPHONY INTERACTION CARD) */}
              {matchingParent && (
                <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden xl:inline">{t('msg.contact_direct')}</span>
                  
                  {/* Real Phone dialing */}
                  <a
                    href={`tel:${matchingParent.phone}`}
                    className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="Déclencher un appel vocal direct"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{t('msg.call')}</span>
                  </a>

                  {/* SMS dispatch */}
                  <button
                    type="button"
                    onClick={() => triggerPhoneSimulation('sms')}
                    className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="Envoyer une notification ou un SMS"
                  >
                    <Mail className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Notifier SMS</span>
                  </button>

                  {/* WhatsApp contact */}
                  <a
                    href={formatWhatsAppUri(matchingParent.phone, `Bonjour, c'est l'établissement scolaire pasma.sys. Nous vous invitons à lire notre message sur l'ENT.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="Lancer WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              )}
            </div>

            {/* CONVERSATION SCROLLABLE AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {threadMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <MessageSquare className="h-12 w-12 text-slate-300 stroke-1 mb-2 animate-pulse" />
                  <p className="text-xs font-bold text-slate-700">{t('msg.no_messages')}</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">
                    {isAdmin 
                      ? "Vous pouvez envoyer un premier mot d'information au parent d'élève ci-dessous."
                      : "Écrivez un message ci-dessous à l'enseignant de votre enfant."}
                  </p>
                </div>
              ) : (
                <>
                  {threadMessages.map((msg, idx) => {
                    const isParentMsg = msg.senderType === 'Parent';
                    
                    // Whether this message belongs to the current user type (for alignment)
                    const isMyOwn = isAdmin ? !isParentMsg : isParentMsg;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className={`flex ${isMyOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm shadow-2xs leading-relaxed ${
                          isMyOwn
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-150 rounded-tl-none'
                        }`}>
                          <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 flex items-center justify-between gap-4 opacity-90 ${
                            isMyOwn ? 'text-indigo-100' : 'text-slate-550'
                          }`}>
                            <span className="flex items-center gap-1 flex-wrap">
                              {isParentMsg ? (
                                <>
                                  <span className="text-amber-500">👤</span>
                                  <span>Tuteur</span>
                                  {(msg as any).recipientRole && (
                                    <span className={`text-[8px] font-black uppercase tracking-widest rounded-md px-1.5 py-0.5 ${
                                      isMyOwn ? 'bg-indigo-700 text-indigo-200 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-100/50'
                                    }`}>
                                      ➔ {(msg as any).recipientRole}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-indigo-500">🏫</span>
                                  <span>{(msg as any).senderRole || 'Prof. principal'}</span>
                                  {msg.teacherName && (
                                    <span className="font-sans text-[8px] font-semibold lowercase opacity-75">
                                      ({msg.teacherName})
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                            <span className="font-mono font-normal">
                              {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <p>{msg.content}</p>

                          <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/10 text-[8px] font-mono opacity-60">
                            <span>{new Date(msg.timestamp).toLocaleDateString('fr-FR')}</span>
                            <span className="flex items-center gap-0.5">
                              Distribué <CheckCheck className="h-3 w-3 inline" />
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={scrollRef} />
                </>
              )}
            </div>

            {/* MESSAGE INPUT CONSOLE PANEL */}
            <div className="bg-white border-t border-slate-150 p-3.5 shrink-0">
              
              {/* ADMIN SENDER SWITCH PANEL (AS SPECIFIED BY THE USER) */}
              {isAdmin && currentStudent && (
                <div className="mb-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-150 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Émettre en tant que :
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setAdminSenderAlias('PedManager')}
                      className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
                        adminSenderAlias === 'PedManager'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      🗣️ Resp. Pédagogique ({censorInfo.name})
                    </button>
 
                    <button
                      type="button"
                      onClick={() => setAdminSenderAlias('ClassTeacher')}
                      className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
                        adminSenderAlias === 'ClassTeacher'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                      title={currentTeacherInfo.name}
                    >
                      🧑‍🏫 Prof. principal ({currentTeacherInfo.name})
                    </button>
 
                    <button
                      type="button"
                      onClick={() => setAdminSenderAlias('Director')}
                      className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
                        adminSenderAlias === 'Director'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      🏛️ Direction / Censeur ({directorInfo.name})
                    </button>
                  </div>
                </div>
              )}

              {/* PARENT RECIPIENT SWITCH PANEL */}
              {!isAdmin && currentStudent && (
                <div className="mb-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-150 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Contacter l'officiel :
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setParentRecipientRole('Teacher')}
                      className={`px-2 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        parentRecipientRole === 'Teacher'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      🧑‍🏫 Prof. principal ({currentTeacherInfo.name})
                    </button>

                    <button
                      type="button"
                      onClick={() => setParentRecipientRole('Censor')}
                      className={`px-2 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        parentRecipientRole === 'Censor'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      🗣️ Censeur / Surveillant ({censorInfo.name})
                    </button>

                    <button
                      type="button"
                      onClick={() => setParentRecipientRole('Director')}
                      className={`px-2 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        parentRecipientRole === 'Director'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      🏛️ Directeur / Proviseur ({directorInfo.name})
                    </button>
                  </div>
                </div>
              )}

              {/* MESSAGE TEXT FORM */}
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    isAdmin 
                      ? t('msg.write_to_parent', { name: currentStudent?.name || (t('header.role.parent') === 'Parent Area' ? 'pupil' : "l'élève") })
                      : parentRecipientRole === 'Teacher' 
                        ? t('msg.write_to_teacher', { name: currentStudent?.name || (t('header.role.parent') === 'Parent Area' ? 'pupil' : "l'élève"), teacher: currentTeacherInfo.name })
                        : parentRecipientRole === 'Censor'
                          ? t('msg.write_to_censor', { censor: censorInfo.name })
                          : t('msg.write_to_director', { director: directorInfo.name })
                  }
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 bg-slate-50 focus:bg-white text-slate-800"
                />
                
                <button
                  type="submit"
                  disabled={sending || !textInput.trim() || !selectedStudentId}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl disabled:opacity-40 cursor-pointer transition shrink-0 shadow-xs"
                >
                  {sending ? (
                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                  ) : (
                    <Send className="h-4.5 w-4.5" />
                  )}
                </button>
              </form>

              {/* MOBILITY SHORTCUT BAR */}
              {isAdmin && matchingParent && (
                <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-2 select-none">
                  <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-lg">
                    <Smartphone className="h-3 w-3 text-slate-500" />
                    <span>Relation Parent-Mobile active</span>
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => triggerPhoneSimulation('sms', `NOTIFICATION : Bonjour Mme/M. ${matchingParent.name}, un message ou une question importante concernant l'élève ${currentStudent?.name} vient d'être publié sur le portail d'ENT de l'établissement.`)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      💬 Alerter SMS d'arrivée
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerPhoneSimulation('whatsapp', `Fiche Établissement : Bonjour ${matchingParent.name}, le corps professoral de pasma.sys souhaite échanger au sujet de votre enfant ${currentStudent?.name}. Merci de répondre.`)}
                      className="text-emerald-600 hover:text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      🟢 Alerter WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE DEVICE POPUP SIMULATOR (REPRESENTS THE RELATION BETWEEN SYSTEM AND PHONES IN AN ACCESSIBLE DESIGN) */}
      <AnimatePresence>
        {simulatedMobileSms && simulatedMobileSms.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-55 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-slate-950 text-white rounded-[40px] border-8 border-slate-800 p-5 w-full max-w-[340px] shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-slate-800 rounded-b-xl z-2 flex items-center justify-center">
                <div className="w-12 h-1 bg-black rounded-full" />
              </div>

              {/* Telephone mockup inner display */}
              <div className="space-y-4 pt-4 pb-2 text-slate-100">
                <div className="flex justify-between text-[9px] font-mono opacity-80 px-2 mt-1">
                  <span>10:28 📱</span>
                  <span className="text-emerald-400">4G LTE █ 98%</span>
                </div>

                <div className="text-center pt-2">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-1.5 font-bold text-sm shadow-md">
                    ENT
                  </div>
                  <h4 className="text-[12px] font-black">{simulatedMobileSms.sender}</h4>
                  <p className="text-[9px] text-slate-400">Destinataire : {simulatedMobileSms.parentName} ({simulatedMobileSms.parentPhone})</p>
                </div>

                {/* Simulated Bubble */}
                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-850 shadow-inner space-y-2">
                  <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Bell className="h-2.5 w-2.5 text-amber-500" /> ALERTE SMS SYNCHRO
                    </span>
                    <span>A l'instant</span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-sans text-slate-100">
                    {simulatedMobileSms.body}
                  </p>
                </div>

                {/* Actions inside mobile view */}
                <div className="space-y-2 pt-1">
                  <a
                    href={formatSmsUri(simulatedMobileSms.parentPhone, simulatedMobileSms.body)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition text-center flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Transférer sur mon vrai Mobile</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setSimulatedMobileSms(null)}
                    className="w-full py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-[11px] font-medium transition cursor-pointer"
                  >
                    Fermer la simulation
                  </button>
                </div>

                <p className="text-[9px] text-slate-500 text-center leading-tight">
                  Cette simulation montre comment le système et la passerelle SMS notifient le téléphone portable du parent.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isAdmin && (
        <BulkAnnouncementModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          students={students}
          apeeParents={apeeParents}
          onAddMessage={onAddMessage}
          apeeSettings={apeeSettings}
          portalUserRole={portalUserRole}
        />
      )}
    </div>
  );
}
