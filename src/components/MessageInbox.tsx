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
  CheckCircle2,
  Info,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  ArrowLeft,
  Paperclip,
  Mic,
  MicOff,
  Play,
  Pause,
  Printer,
  Tag,
  Smile,
  X,
  Zap,
  RotateCcw,
  Volume2,
  FileText,
  ShieldAlert,
  Calendar
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
  const { t, language } = useLanguage();
  const isFr = language === 'fr';
  const isAdmin = portalUserRole === 'manager' || portalUserRole === 'teacher';

  const loggedInTeacher = (() => {
    try {
      const tStr = localStorage.getItem('portal_teacher_details');
      return tStr ? JSON.parse(tStr) : null;
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

  // In-thread search & category filter
  const [threadSearchKeyword, setThreadSearchKeyword] = useState('');
  const [threadCategoryFilter, setThreadCategoryFilter] = useState<string>('all');

  // Broadcast / Multi-select mode state for teachers
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMultiStudentIds, setSelectedMultiStudentIds] = useState<string[]>([]);
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Local message inputs & extras
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [msgCategory, setMsgCategory] = useState<NonNullable<Message['category']>>('General');

  // Quick Templates Drawer State
  const [showQuickTemplates, setShowQuickTemplates] = useState(false);

  // AI Assistant Drawer State
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiRawDraft, setAiRawDraft] = useState('');
  const [aiTone, setAiTone] = useState<'courteous' | 'firm' | 'encouraging'>('courteous');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Voice Recording Simulator State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceTimer, setVoiceTimer] = useState(0);
  const voiceIntervalRef = useRef<any>(null);

  // File Attachment Simulator State
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: 'pdf' | 'image' | 'doc';
    url: string;
  } | null>(null);

  // Playing Voice Note state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Read message tracking
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());

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
        const recentMsg = [...messages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        const initialId = (recentMsg && students.some(s => s.id === recentMsg.studentId)) ? recentMsg.studentId : (students[0]?.id || '');
        setSelectedStudentId(initialId);
      } else {
        setSelectedStudentId(students[0]?.id || '');
      }
    }
  }, [students, isAdmin, messages, selectedStudentId]);

  // Mark current thread messages as read
  useEffect(() => {
    if (selectedStudentId) {
      const threadMsgs = messages.filter(m => m.studentId === selectedStudentId);
      const unread = threadMsgs.filter(m => {
        const isFromOther = isAdmin ? m.senderType === 'Parent' : m.senderType === 'Teacher';
        return isFromOther && !readMessageIds.has(m.id);
      });
      if (unread.length > 0) {
        setReadMessageIds(prev => {
          const next = new Set(prev);
          unread.forEach(m => next.add(m.id));
          return next;
        });
      }
    }
  }, [selectedStudentId, messages, isAdmin, readMessageIds]);

  // Voice recording timer hook
  useEffect(() => {
    if (isRecordingVoice) {
      setVoiceTimer(0);
      voiceIntervalRef.current = setInterval(() => {
        setVoiceTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (voiceIntervalRef.current) clearInterval(voiceIntervalRef.current);
    }
    return () => {
      if (voiceIntervalRef.current) clearInterval(voiceIntervalRef.current);
    };
  }, [isRecordingVoice]);

  useEffect(() => {
    const handleQuickAction = (e: any) => {
      if (e.detail?.actionKey === 'compose_message') {
        setMobileView('chat');
        setTimeout(() => {
          const inputEl = document.querySelector('textarea, input[placeholder*="message"]') as HTMLElement;
          inputEl?.focus();
        }, 150);
      }
    };
    window.addEventListener('pasma_trigger_quick_action', handleQuickAction);
    return () => window.removeEventListener('pasma_trigger_quick_action', handleQuickAction);
  }, []);

  const currentStudent = students.find(s => s.id === selectedStudentId);

  // Matching Parent/Guardian helper
  const getMatchingParent = (student: Student | undefined): ApeeParent | undefined => {
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
      p.students?.some(stu => (stu.name || '').trim().toLowerCase() === (student.name || '').trim().toLowerCase())
    );
    if (foundByName) return foundByName;

    return undefined;
  };

  const matchingParent = getMatchingParent(currentStudent);

  // Student Teacher Info Helper
  const getStudentTeacherInfo = (student: Student | undefined) => {
    if (!student) return { name: '', email: '', phone: '' };
    const foundTeacher = apeeSettings?.classTeachers?.find(t => {
      const studentClass = (student.classRoom || '').toLowerCase();
      const teacherClass = (t.classRoom || '').toLowerCase();
      return teacherClass === studentClass || studentClass.includes(teacherClass);
    });

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

  // Filter messages by selected student conversation thread + search & category filters
  const threadMessages = messages
    .filter(m => m.studentId === selectedStudentId)
    .filter(m => {
      if (threadCategoryFilter !== 'all' && m.category !== threadCategoryFilter) return false;
      if (threadSearchKeyword.trim()) {
        const kw = threadSearchKeyword.toLowerCase();
        return (m.content || '').toLowerCase().includes(kw) || (m.teacherName || '').toLowerCase().includes(kw);
      }
      return true;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Compute unread badge counts for student threads
  const getUnreadCount = (studentId: string) => {
    const sMsgs = messages.filter(m => m.studentId === studentId);
    return sMsgs.filter(m => {
      const isIncoming = isAdmin ? m.senderType === 'Parent' : m.senderType === 'Teacher';
      return isIncoming && !readMessageIds.has(m.id);
    }).length;
  };

  // Filter students list for Selection in Admin panel
  const getFilteredAdminStudents = () => {
    return students.filter(student => {
      if (selectedClassroom !== 'all' && student.classRoom !== selectedClassroom) return false;

      if (filterActiveOnly) {
        const hasMsgs = messages.some(m => m.studentId === student.id);
        if (!hasMsgs) return false;
      }

      if (adminSearch.trim()) {
        const queryNorm = adminSearch.toLowerCase().trim();
        const parent = getMatchingParent(student);
        const nameMatches = (student.name || '').toLowerCase().includes(queryNorm);
        const classMatches = (student.classRoom || '').toLowerCase().includes(queryNorm);
        const parentNameMatches = parent ? (parent.name || '').toLowerCase().includes(queryNorm) : false;
        const parentPhoneMatches = parent ? (parent.phone || '').includes(queryNorm) : false;

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

  // Toggle selection for a student ID in multi-select mode
  const toggleSelectStudentForBroadcast = (studentId: string) => {
    setSelectedMultiStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId) 
        : [...prev, studentId]
    );
  };

  // Broadcast send handler
  const handleSendBroadcastMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || selectedMultiStudentIds.length === 0) return;

    setSendingBroadcast(true);
    setBroadcastNotice(null);

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

    const senderRoleToUse = portalUserRole === 'teacher' 
      ? 'Enseignant Titulaire' 
      : adminSenderAlias === 'PedManager' 
        ? 'Censeur / Surveillant' 
        : adminSenderAlias === 'Director' 
          ? 'Directeur / Proviseur' 
          : 'Professeur principal';

    let successCount = 0;

    for (const studentId of selectedMultiStudentIds) {
      const student = students.find(s => s.id === studentId);
      if (!student) continue;

      const parent = getMatchingParent(student);
      const parentId = student.parentId || parent?.id || 'unknown_parent';
      const msgId = `msg_multi_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const newMsg: Message = {
        id: msgId,
        studentId: student.id,
        parentId: parentId,
        senderType: 'Teacher',
        content: textInput,
        timestamp: new Date().toISOString(),
        teacherName: senderName,
        senderRole: senderRoleToUse,
        isBulk: true,
        category: msgCategory
      };

      try {
        await setDoc(doc(db, 'messages', msgId), newMsg);
        onAddMessage(newMsg);
        successCount++;
      } catch (err) {
        console.warn(`Notice sending broadcast message to ${studentId}:`, err);
        onAddMessage(newMsg);
        successCount++;
      }
    }

    setSendingBroadcast(false);
    setTextInput('');
    setBroadcastNotice(`✅ Message de diffusion transmis à ${successCount} parent(s) avec succès !`);
    setTimeout(() => setBroadcastNotice(null), 6000);
  };

  // Primary Message Send Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!textInput.trim() && !attachedFile) || !selectedStudentId || !currentStudent) return;

    setSending(true);
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const senderTypeToUse = isAdmin ? 'Teacher' : 'Parent';
    
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
      content: textInput.trim() || (attachedFile ? `[Document joint : ${attachedFile.name}]` : ''),
      timestamp: new Date().toISOString(),
      teacherName: isAdmin ? senderName : undefined,
      recipientName: !isAdmin ? recipientName : undefined,
      recipientRole: !isAdmin ? recipientRole : undefined,
      senderRole: isAdmin ? (portalUserRole === 'teacher' ? 'Enseignant Titulaire' : adminSenderAlias === 'PedManager' ? 'Censeur / Surveillant' : adminSenderAlias === 'Director' ? 'Directeur / Proviseur' : 'Professeur principal') : undefined,
      category: msgCategory,
      attachmentUrl: attachedFile?.url,
      attachmentName: attachedFile?.name,
      attachmentType: attachedFile?.type
    };

    try {
      await setDoc(doc(db, 'messages', id), newMsg);
      onAddMessage(newMsg);
      setTextInput('');
      setAttachedFile(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `messages/${id}`);
    } finally {
      setSending(false);
    }
  };

  // Send Voice Message Simulator Handler
  const handleStopAndSendVoice = async () => {
    setIsRecordingVoice(false);
    if (voiceTimer < 1 || !selectedStudentId || !currentStudent) return;

    setSending(true);
    const id = `msg_voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const senderTypeToUse = isAdmin ? 'Teacher' : 'Parent';

    let senderName = currentTeacherInfo.name;
    if (isAdmin && loggedInTeacher) senderName = loggedInTeacher.name;

    const newMsg: Message = {
      id,
      studentId: selectedStudentId,
      parentId: currentStudent.parentId || matchingParent?.id || 'unknown_parent',
      senderType: senderTypeToUse,
      content: `🎙️ Message vocal (${voiceTimer}s)`,
      timestamp: new Date().toISOString(),
      teacherName: isAdmin ? senderName : undefined,
      senderRole: isAdmin ? (portalUserRole === 'teacher' ? 'Enseignant Titulaire' : 'Administration') : undefined,
      voiceUrl: 'simulated_audio.mp3',
      voiceDuration: voiceTimer,
      category: 'General'
    };

    try {
      await setDoc(doc(db, 'messages', id), newMsg);
      onAddMessage(newMsg);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `messages/${id}`);
    } finally {
      setSending(false);
      setVoiceTimer(0);
    }
  };

  // Generate AI Draft Helper
  const handleGenerateAiMessage = () => {
    if (!aiRawDraft.trim()) return;
    setIsAiGenerating(true);

    setTimeout(() => {
      const studentName = currentStudent?.name || "l'élève";
      let formatted = '';

      if (isAdmin) {
        if (aiTone === 'courteous') {
          formatted = `Bonjour Chers Parents de ${studentName},\n\nNous vous contactons concernant la scolarité de votre enfant. ${aiRawDraft.trim()}.\n\nRestant à votre disposition pour tout échange complémentaire.\n\nBien cordialement,\nL'Équipe Pédagogique - PASMA-SYS`;
        } else if (aiTone === 'firm') {
          formatted = `Avis Officiel à la Famille de ${studentName} :\n\nNous vous informons du point suivant : ${aiRawDraft.trim()}.\n\nNous comptons sur votre prompte diligence et votre collaboration.\n\nLa Direction de l'Établissement`;
        } else {
          formatted = `Chers Parents de ${studentName},\n\nNous tenions à vous faire part de ce retour très positif : ${aiRawDraft.trim()} !\n\nBravo pour son travail et ses efforts continus.\n\nCordialement,\nL'Enseignant`;
        }
      } else {
        if (aiTone === 'courteous') {
          formatted = `Bonjour M. / Mme le Professeur,\n\nEn tant que parent de ${studentName}, je me permets de vous adresser ce message concernant le sujet suivant : ${aiRawDraft.trim()}.\n\nJe vous remercie par avance pour votre attention et votre retour.\n\nRespectueusement,\nLe Parent d'Élève`;
        } else if (aiTone === 'firm') {
          formatted = `Bonjour,\n\nJe sollicite un retour officiel au sujet de ${studentName} concernant : ${aiRawDraft.trim()}.\n\nMerci de bien vouloir m'indiquer la démarche à suivre.\n\nCordialement`;
        } else {
          formatted = `Bonjour,\n\nJe vous remercie pour le suivi de ${studentName}. Concernant ${aiRawDraft.trim()}, nous saluons l'accompagnement de l'établissement.\n\nBonne journée à vous.`;
        }
      }

      setTextInput(formatted);
      setIsAiGenerating(false);
      setShowAiAssistant(false);
      setAiRawDraft('');
    }, 600);
  };

  // Quick Templates List
  const quickTemplates = isAdmin ? [
    { label: "🚨 Absence en cours", category: "Absence", text: `Bonjour, nous constatons l'absence de ${currentStudent?.name || "l'élève"} en cours ce jour. Merci de régulariser la justification auprès de la vie scolaire.` },
    { label: "📝 Convocation Rendez-vous", category: "Appointment", text: `Bonjour, l'équipe pédagogique sollicite une rencontre au sujet de la scolarité de ${currentStudent?.name || "l'élève"}. Merci de nous indiquer vos disponibilités.` },
    { label: "👏 Félicitations Bulletin", category: "Grade", text: `Félicitations ! Nous tenons à saluer les excellents résultats et l'attitude exemplaire de ${currentStudent?.name || "l'élève"} ce trimestre.` },
    { label: "⚠️ Rappel Discipline", category: "Discipline", text: `Bonjour, un rappel concernant le respect du règlement intérieur et la ponctualité a été adressé à ${currentStudent?.name || "l'élève"}. Merci de faire le point à la maison.` },
    { label: "💳 Rappel Frais Scolaires / APEE", category: "General", text: `Bonjour, sauf erreur de notre part, les frais scolaires / APEE de ${currentStudent?.name || "l'élève"} présentent un solde en attente. Merci de régulariser la situation.` }
  ] : [
    { label: "🤒 Signalement Maladie", category: "Absence", text: `Bonjour, je vous informe que ${currentStudent?.name || "mon enfant"} est souffrant(e) ce jour et ne pourra pas assister aux cours. Un certificat médical sera présenté.` },
    { label: "📅 Demande de Rendez-vous", category: "Appointment", text: `Bonjour, je souhaiterais prendre un court rendez-vous avec vous pour échanger sur le suivi scolaire de ${currentStudent?.name || "mon enfant"}.` },
    { label: "🚗 Retard Exceptionnel", category: "Absence", text: `Bonjour, ${currentStudent?.name || "mon enfant"} aura un léger retard ce matin en raison d'un impératif familial. Merci pour votre compréhension.` },
    { label: "📖 Question sur les Devoirs", category: "General", text: `Bonjour, ${currentStudent?.name || "mon enfant"} sollicite une précision concernant le devoir à effectuer. Merci d'avance pour votre éclairage.` }
  ];

  // Phone integration utilities
  const formatSmsUri = (phone: string, text: string) => {
    return `sms:${phone.replace(/\s+/g, '')}?body=${encodeURIComponent(text)}`;
  };

  const formatWhatsAppUri = (phone: string, text: string) => {
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

  // Export / Print Conversation
  const handlePrintThread = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relevé des Échanges PASMA-SYS - ${currentStudent?.name || 'Élève'}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #1e293b; }
            .header { border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 18px; font-weight: bold; color: #4338ca; }
            .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
            .msg { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
            .msg-teacher { background-color: #f8fafc; border-left: 4px solid #4338ca; }
            .msg-parent { background-color: #fff; border-left: 4px solid #f59e0b; }
            .sender { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
            .content { font-size: 13px; line-height: 1.5; }
            .time { font-size: 10px; color: #94a3b8; text-align: right; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">ÉTABLISSEMENT PASMA-SYS - RELEVÉ OFFICIEL DES COMMUNICATIONS ENT</div>
            <div class="meta">
              Élève : <strong>${currentStudent?.name}</strong> (${currentStudent?.classRoom}) | 
              Parent : <strong>${matchingParent?.name || 'Inconnu'}</strong> | 
              Édité le : ${new Date().toLocaleDateString('fr-FR')}
            </div>
          </div>
          ${threadMessages.map(m => `
            <div class="msg ${m.senderType === 'Teacher' ? 'msg-teacher' : 'msg-parent'}">
              <div class="sender">${m.senderType === 'Teacher' ? (m.senderRole || 'Enseignant/Administration') : 'Tuteur / Parent'}</div>
              <div class="content">${m.content}</div>
              <div class="time">${new Date(m.timestamp).toLocaleString('fr-FR')}</div>
            </div>
          `).join('')}
        </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black font-sans text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span>Messagerie Instantanée ENT</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-1 font-medium">
            {isAdmin 
              ? "Console d'échange direct, de diffusion et de suivi relationnel Parents-Enseignants"
              : "Canal direct et sécurisé avec les enseignants et l'administration de l'établissement"}
          </p>
        </div>

        {/* Action Controls & User Role Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition flex items-center gap-1.5 active:scale-97"
              id="btn-open-bulk-announcement"
            >
              <Zap className="h-4 w-4" />
              <span>📢 Diffusion Groupée</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('msg.active_session')}</span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isAdmin 
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800' 
                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800'
            }`}>
              {isAdmin ? t('msg.role_admin') : t('msg.role_parent')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Container Layout */}
      {students.length === 0 ? (
        <div className="text-center p-14 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
          <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Aucun élève identifié</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Le système n'a trouvé aucun élève dans la base de données de cet établissement pour initier des conversations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-950 min-h-[580px] h-[680px] lg:h-[720px] shadow-sm">
          
          {/* LEFT COLUMN: CONVERSATIONS LIST */}
          <div className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden h-full ${
            mobileView === 'chat' ? 'hidden lg:flex' : 'flex h-full'
          }`}>
            
            {/* SEARCHBARS & FILTERS */}
            {isAdmin ? (
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t('msg.search_placeholder')}
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !isMultiSelectMode;
                      setIsMultiSelectMode(next);
                      if (next && selectedMultiStudentIds.length === 0 && selectedStudentId) {
                        setSelectedMultiStudentIds([selectedStudentId]);
                      }
                    }}
                    className={`px-2.5 py-1.5 border rounded-xl text-[11px] font-bold cursor-pointer transition flex items-center gap-1.5 shrink-0 ${
                      isMultiSelectMode
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    title="Activer la sélection multiple de plusieurs parents"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{isMultiSelectMode ? 'Quitter Multi' : 'Multi-Parents'}</span>
                    <span className="sm:hidden">{isMultiSelectMode ? 'Single' : 'Multi'}</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">{t('msg.all_classes', { count: classrooms.length })}</option>
                    {classrooms.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setFilterActiveOnly(!filterActiveOnly)}
                    className={`px-2.5 py-1.5 border rounded-xl text-[11px] font-bold cursor-pointer transition shrink-0 ${
                      filterActiveOnly 
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {t('msg.filter_active')}
                  </button>
                </div>

                {isMultiSelectMode && (
                  <div className="p-2.5 bg-indigo-50/90 dark:bg-indigo-950/80 rounded-xl border border-indigo-150 dark:border-indigo-800 flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    <span className="flex items-center gap-1 text-[11px]">
                      <span>📢</span>
                      <span>{selectedMultiStudentIds.length} parent(s) ciblé(s)</span>
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSelectedMultiStudentIds(adminStudentsList.map(s => s.id))}
                        className="text-indigo-700 dark:text-indigo-300 hover:underline font-extrabold cursor-pointer"
                      >
                        Tout ({adminStudentsList.length})
                      </button>
                      <span className="text-indigo-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMultiStudentIds([])}
                        className="text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                      >
                        Vider
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* PARENT THREAD SELECTOR */
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Sélectionner la fiche de l'élève :</span>
                <div className="space-y-1.5">
                  {students.map(s => {
                    const isSelected = s.id === selectedStudentId;
                    const lastMsg = getThreadLastMessage(s.id);
                    const unread = getUnreadCount(s.id);
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
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        {s.avatar && (s.avatar.startsWith('data:image') || s.avatar.startsWith('http') || s.avatar.startsWith('/')) ? (
                          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
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
                        {unread > 0 && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white shadow-3xs animate-bounce">
                            {unread}
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
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {adminStudentsList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <User className="h-6 w-6 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-[11px]">Aucune conversation ne correspond à ces filtres.</p>
                  </div>
                ) : (
                  adminStudentsList.map(s => {
                    const isSelected = s.id === selectedStudentId;
                    const isMultiChecked = selectedMultiStudentIds.includes(s.id);
                    const lastMsg = getThreadLastMessage(s.id);
                    const parent = getMatchingParent(s);
                    const unread = getUnreadCount(s.id);

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          if (isMultiSelectMode) {
                            toggleSelectStudentForBroadcast(s.id);
                          } else {
                            setSelectedStudentId(s.id);
                            setMobileView('chat');
                          }
                        }}
                        className={`w-full p-3 text-left flex gap-2.5 transition cursor-pointer border-l-3 ${
                          isMultiSelectMode
                            ? isMultiChecked
                              ? 'bg-indigo-50/90 dark:bg-indigo-950/80 border-l-indigo-600 text-indigo-950 dark:text-indigo-100 shadow-2xs font-bold'
                              : 'border-l-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                            : isSelected 
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/60 border-l-indigo-600 text-indigo-950 dark:text-indigo-100 shadow-2xs' 
                              : 'border-l-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {isMultiSelectMode && (
                          <input
                            type="checkbox"
                            checked={isMultiChecked}
                            onChange={() => {}}
                            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer my-auto"
                          />
                        )}
                        {s.avatar && (s.avatar.startsWith('data:image') || s.avatar.startsWith('http') || s.avatar.startsWith('/')) ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 mt-0.5">
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
                            <h4 className="text-xs font-black truncate text-slate-900 dark:text-slate-100">{s.name}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              {unread > 0 && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                                  {unread}
                                </span>
                              )}
                              <span className="text-[9px] font-mono bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 py-0.2 rounded-md">
                                {s.classRoom}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                            Parent : {parent ? parent.name : 'Non répertorié'}
                          </p>

                          {lastMsg ? (
                            <div className="flex items-center gap-1.5 mt-1 border-t border-slate-100/50 dark:border-slate-800/50 pt-1 text-[10px] text-slate-400 dark:text-slate-500 truncate">
                              <span className="font-bold uppercase text-[8px] select-none text-indigo-500">
                                {lastMsg.senderType === 'Parent' ? 'Parent' : 'École'} :
                              </span>
                              <span className="truncate italic">{lastMsg.content}</span>
                            </div>
                          ) : (
                            <p className="text-[9px] text-amber-600 dark:text-amber-400 italic mt-1">Aucun échange. Lancer un mot ?</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              /* PARENT SIDEBAR REFERENTS */
              <div className="p-3.5 bg-slate-50/50 dark:bg-slate-900/50 space-y-3 flex-1 overflow-y-auto">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsables Référents</h3>
                
                {/* Teacher */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧑‍🏫</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{currentTeacherInfo.name}</h4>
                      <p className="text-[9px] text-slate-400 font-medium">Prof. principal de {currentStudent?.name}</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 text-[10px] font-mono select-none">
                    <a
                      href={`tel:${currentTeacherInfo.phone}`}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Phone className="h-3 w-3" /> Appeler
                    </a>
                    <a
                      href={formatWhatsAppUri(currentTeacherInfo.phone, `Bonjour, je suis le parent de l'élève ${currentStudent?.name || ''}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                </div>

                {/* Censor */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🗣️</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{censorInfo.name}</h4>
                      <p className="text-[9px] text-slate-400 font-medium">Censeur / Surveillant Général</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 text-[10px] font-mono select-none">
                    <a
                      href={`tel:${censorInfo.phone}`}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Phone className="h-3 w-3" /> Appeler
                    </a>
                    <a
                      href={formatWhatsAppUri(censorInfo.phone, `Bonjour, je suis le parent de l'élève ${currentStudent?.name || ''}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                </div>

                {/* Director */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏛️</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{directorInfo.name}</h4>
                      <p className="text-[9px] text-slate-400 font-medium">Directeur / Proviseur</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 text-[10px] font-mono select-none">
                    <a
                      href={`tel:${directorInfo.phone}`}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Phone className="h-3 w-3" /> Appeler
                    </a>
                    <a
                      href={formatWhatsAppUri(directorInfo.phone, `Bonjour, je suis le parent de l'élève ${currentStudent?.name || ''}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-100 dark:bg-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span>Canal synchronisé ENT + Téléphonie directe.</span>
            </div>
          </div>

          {/* MAIN COLUMN: ACTIVE CHAT CONSOLE */}
          <div className={`lg:col-span-2 flex flex-col justify-between bg-slate-50 dark:bg-slate-950 relative overflow-hidden h-full ${
            mobileView === 'list' ? 'hidden lg:flex' : 'flex h-full'
          }`}>
            
            {isMultiSelectMode ? (
              /* BROADCAST CONSOLE */
              <div className="flex flex-col justify-between h-full bg-slate-50 dark:bg-slate-950 p-4 overflow-y-auto space-y-4">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-2xl text-2xl">
                        📢
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 leading-tight">
                          Diffusion Groupée à Plusieurs Parents
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {selectedMultiStudentIds.length} parent(s) sélectionné(s) pour la communication directe
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsBulkModalOpen(true)}
                      className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Campagne SMS + E-mail</span>
                    </button>
                  </div>

                  {/* Selected Parent Badges */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                      Liste des destinataires sélectionnés ({selectedMultiStudentIds.length}) :
                    </span>

                    {selectedMultiStudentIds.length === 0 ? (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
                        ⚠️ Aucun parent n'est coché. Cochez des élèves dans la liste de gauche pour ajouter des destinataires.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {selectedMultiStudentIds.map(studentId => {
                          const student = students.find(s => s.id === studentId);
                          if (!student) return null;
                          const parent = getMatchingParent(student);
                          return (
                            <span
                              key={studentId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 rounded-xl text-xs font-bold"
                            >
                              <span>{student.name}</span>
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">({student.classRoom})</span>
                              <span className="text-[10px] text-slate-500 font-medium">| {parent ? parent.name : 'Parent'}</span>
                              <button
                                type="button"
                                onClick={() => toggleSelectStudentForBroadcast(studentId)}
                                className="ml-1 text-slate-400 hover:text-red-600 text-xs font-black cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {broadcastNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 shadow-2xs"
                  >
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                    <span>{broadcastNotice}</span>
                  </motion.div>
                )}

                {/* Broadcast Composer Form */}
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-indigo-600" />
                      Rédiger le message de diffusion :
                    </label>

                    {isAdmin && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Émetteur du message :</span>
                        <div className="flex gap-1.5 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setAdminSenderAlias('PedManager')}
                            className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
                              adminSenderAlias === 'PedManager'
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            🗣️ Censeur ({censorInfo.name})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminSenderAlias('ClassTeacher')}
                            className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
                              adminSenderAlias === 'ClassTeacher'
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            🧑‍🏫 Prof. principal ({currentTeacherInfo.name})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminSenderAlias('Director')}
                            className={`px-2 py-1 rounded-lg border transition cursor-pointer ${
                              adminSenderAlias === 'Director'
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            🏛️ Direction ({directorInfo.name})
                          </button>
                        </div>
                      </div>
                    )}

                    <textarea
                      rows={5}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Chers parents, nous vous informons que..."
                      className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Le message sera enregistré individuellement dans le fil de chaque parent sélectionné.
                    </span>

                    <button
                      type="button"
                      onClick={handleSendBroadcastMessage}
                      disabled={sendingBroadcast || !textInput.trim() || selectedMultiStudentIds.length === 0}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition disabled:opacity-40 cursor-pointer flex items-center gap-2 shadow-xs shrink-0"
                    >
                      {sendingBroadcast ? (
                        <>
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                          <span>Envoi en cours...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Envoyer la diffusion ({selectedMultiStudentIds.length} parents)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* SINGLE THREAD CHAT VIEW */
              <>
                {/* THREAD HEADER */}
                <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    {mobileView === 'chat' && (
                      <button
                        type="button"
                        onClick={() => setMobileView('list')}
                        className="lg:hidden p-1.5 -ml-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center gap-1 font-black text-xs"
                        title={t('msg.back')}
                      >
                        <ArrowLeft className="h-4.5 w-4.5" />
                        <span>{t('msg.back')}</span>
                      </button>
                    )}

                    {currentStudent?.avatar && (currentStudent.avatar.startsWith('data:image') || currentStudent.avatar.startsWith('http') || currentStudent.avatar.startsWith('/')) ? (
                      <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden block shrink-0 border border-slate-200 dark:border-slate-700">
                        <img 
                          src={currentStudent.avatar} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    ) : (
                      <span className="text-2xl bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl block shrink-0">
                        {currentStudent?.avatar || '👦'}
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 leading-tight">
                          {currentStudent ? currentStudent.name : 'Sélectionnez un élève'}
                        </h3>
                        {currentStudent && (
                          <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded-md border border-indigo-100 dark:border-indigo-800">
                            {currentStudent.classRoom}
                          </span>
                        )}
                      </div>
                      {matchingParent ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Famille : <strong className="text-slate-700 dark:text-slate-200">{matchingParent.name}</strong> 
                          {matchingParent.phone && <span className="text-slate-400 font-mono text-[11px]"> ({matchingParent.phone})</span>}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Aucun parent APEE rattaché à cet élève</p>
                      )}
                    </div>
                  </div>

                  {/* HEADER ACTION CONTROLS */}
                  <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handlePrintThread}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      title="Imprimer / Exporter l'historique de conversation"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Exporter PDF</span>
                    </button>

                    {matchingParent && (
                      <>
                        <a
                          href={`tel:${matchingParent.phone}`}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 hover:text-emerald-700 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="Déclencher un appel vocal direct"
                        >
                          <Phone className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Appeler</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => triggerPhoneSimulation('sms')}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-200 hover:text-indigo-700 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="Envoyer une notification SMS"
                        >
                          <Mail className="h-3.5 w-3.5 text-indigo-500" />
                          <span>SMS</span>
                        </button>

                        <a
                          href={formatWhatsAppUri(matchingParent.phone, `Bonjour, c'est l'établissement scolaire pasma.sys.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-green-50 dark:bg-green-950/60 hover:bg-green-100 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="Lancer WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* IN-THREAD SEARCH & FILTER BAR */}
                <div className="px-3.5 py-2 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Filtrer dans la discussion..."
                      value={threadSearchKeyword}
                      onChange={(e) => setThreadSearchKeyword(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden placeholder:text-slate-400"
                    />
                    {threadSearchKeyword && (
                      <button
                        type="button"
                        onClick={() => setThreadSearchKeyword('')}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-bold no-scrollbar">
                    {['all', 'Absence', 'Grade', 'Discipline', 'Appointment', 'General'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setThreadCategoryFilter(cat)}
                        className={`px-2 py-0.5 rounded-lg transition cursor-pointer shrink-0 ${
                          threadCategoryFilter === cat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {cat === 'all' ? 'Tout' : cat === 'Absence' ? '🚨 Absence' : cat === 'Grade' ? '📊 Bulletin' : cat === 'Discipline' ? '⚠️ Discipline' : cat === 'Appointment' ? '📅 RDV' : '💬 Général'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CONVERSATION MESSAGES DISPLAY */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {threadMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <MessageSquare className="h-12 w-12 text-slate-300 dark:text-slate-600 stroke-1 mb-2 animate-pulse" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {threadSearchKeyword || threadCategoryFilter !== 'all' ? "Aucun message ne correspond aux filtres appliqués." : t('msg.no_messages')}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                        {isAdmin 
                          ? "Vous pouvez envoyer un premier mot d'information au parent d'élève ci-dessous."
                          : "Écrivez un message ci-dessous à l'enseignant de votre enfant."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {threadMessages.map((msg, idx) => {
                        const isParentMsg = msg.senderType === 'Parent';
                        const isMyOwn = isAdmin ? !isParentMsg : isParentMsg;
                        const isVoice = !!msg.voiceUrl;
                        const isPlaying = playingVoiceId === msg.id;

                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: idx * 0.02 }}
                            className={`flex ${isMyOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[78%] rounded-2xl p-3.5 text-xs sm:text-sm shadow-2xs leading-relaxed space-y-2 ${
                              isMyOwn
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-tl-none'
                            }`}>
                              {/* Header info */}
                              <div className={`text-[9px] font-bold uppercase tracking-wider flex items-center justify-between gap-4 opacity-90 ${
                                isMyOwn ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                <span className="flex items-center gap-1 flex-wrap">
                                  {isParentMsg ? (
                                    <>
                                      <span className="text-amber-500">👤</span>
                                      <span>Tuteur</span>
                                      {msg.recipientRole && (
                                        <span className={`text-[8px] font-black uppercase tracking-widest rounded-md px-1.5 py-0.5 ${
                                          isMyOwn ? 'bg-indigo-700 text-indigo-200 border border-indigo-500/30' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                        }`}>
                                          ➔ {msg.recipientRole}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-indigo-400">🏫</span>
                                      <span>{msg.senderRole || 'Prof. principal'}</span>
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

                              {/* Voice Message Display */}
                              {isVoice ? (
                                <div className={`p-2.5 rounded-xl flex items-center gap-3 border ${
                                  isMyOwn 
                                    ? 'bg-indigo-700/80 border-indigo-500/40 text-white' 
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                                }`}>
                                  <button
                                    type="button"
                                    onClick={() => setPlayingVoiceId(isPlaying ? null : msg.id)}
                                    className={`p-2 rounded-full transition cursor-pointer ${
                                      isMyOwn ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                                    }`}
                                  >
                                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                                  </button>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-1 h-4">
                                      {[40, 70, 30, 90, 50, 100, 60, 40, 80, 20, 60, 90, 30, 50].map((h, i) => (
                                        <div
                                          key={i}
                                          className={`flex-1 rounded-full transition-all ${
                                            isPlaying ? 'bg-emerald-400 animate-pulse' : (isMyOwn ? 'bg-indigo-200/60' : 'bg-slate-300 dark:bg-slate-600')
                                          }`}
                                          style={{ height: `${h}%` }}
                                        />
                                      ))}
                                    </div>
                                    <div className="flex justify-between text-[9px] font-mono opacity-80">
                                      <span>{isPlaying ? 'Lecture...' : 'Note Vocale'}</span>
                                      <span>{msg.voiceDuration || 5}s</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              )}

                              {/* Attachment Card Display */}
                              {msg.attachmentName && (
                                <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold ${
                                  isMyOwn
                                    ? 'bg-indigo-700/60 border-indigo-500/40 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                }`}>
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText className="h-4 w-4 shrink-0 text-amber-400" />
                                    <span className="truncate">{msg.attachmentName}</span>
                                  </div>
                                  <a
                                    href={msg.attachmentUrl || '#'}
                                    download
                                    className="p-1 hover:bg-white/20 rounded-lg transition text-[10px] font-mono shrink-0"
                                  >
                                    Télécharger
                                  </a>
                                </div>
                              )}

                              {/* Footer timestamp & read status */}
                              <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/10 text-[8px] font-mono opacity-70">
                                <span className="flex items-center gap-1">
                                  {msg.category && (
                                    <span className="bg-white/10 px-1 py-0.2 rounded-md font-bold uppercase">
                                      {msg.category}
                                    </span>
                                  )}
                                  <span>{new Date(msg.timestamp).toLocaleDateString('fr-FR')}</span>
                                </span>
                                <span className="flex items-center gap-0.5">
                                  Distribué <CheckCheck className="h-3 w-3 inline text-emerald-300" />
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

                {/* ATTACHMENT / QUICK TEMPLATE & AI PREVIEWS */}
                <AnimatePresence>
                  {showQuickTemplates && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          Modèles de Réponses Rapides en 1-Clic :
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowQuickTemplates(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          Fermer ×
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {quickTemplates.map((tpl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setTextInput(tpl.text);
                              if (tpl.category) setMsgCategory(tpl.category as any);
                              setShowQuickTemplates(false);
                            }}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold transition text-left cursor-pointer shadow-3xs"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* AI DRAFTER MODAL / DRAWER */}
                <AnimatePresence>
                  {showAiAssistant && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="bg-indigo-900 text-white border-t border-indigo-700 p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-black text-sm">
                          <Sparkles className="h-4 w-4 text-amber-300 animate-spin" />
                          <span>Assistant IA de Rédaction & Structure PASMA-SYS</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAiAssistant(false)}
                          className="text-indigo-300 hover:text-white text-xs font-bold cursor-pointer"
                        >
                          Fermer ×
                        </button>
                      </div>

                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={aiRawDraft}
                          onChange={(e) => setAiRawDraft(e.target.value)}
                          placeholder="Tapez vos idées brutes (ex: mon fils sera absent demain fievre)"
                          className="w-full p-2.5 rounded-xl bg-indigo-950 border border-indigo-700 text-white text-xs focus:outline-hidden"
                        />

                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex gap-1 text-[10px] font-bold">
                            <span className="text-indigo-300 my-auto">Style :</span>
                            {(['courteous', 'firm', 'encouraging'] as const).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setAiTone(t)}
                                className={`px-2 py-0.5 rounded-md border cursor-pointer ${
                                  aiTone === t ? 'bg-amber-400 text-indigo-950 font-black border-amber-400' : 'bg-indigo-800 text-indigo-200 border-indigo-700'
                                }`}
                              >
                                {t === 'courteous' ? 'Courtois' : t === 'firm' ? 'Ferme/Officiel' : 'Encourageant'}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleGenerateAiMessage}
                            disabled={isAiGenerating || !aiRawDraft.trim()}
                            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-indigo-950 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>{isAiGenerating ? 'Reformulation...' : 'Reformuler par IA'}</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ATTACHED FILE BADGE PREVIEW */}
                {attachedFile && (
                  <div className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/80 border-t border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-indigo-600" />
                      <span>Document prêt à être joint : <strong>{attachedFile.name}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-rose-600 hover:text-rose-800 text-xs font-black cursor-pointer"
                    >
                      Supprimer ×
                    </button>
                  </div>
                )}

                {/* VOICE RECORDING SIMULATOR BAR */}
                {isRecordingVoice ? (
                  <div className="bg-rose-600 text-white p-3 border-t border-rose-700 flex items-center justify-between gap-3 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-white animate-ping" />
                      <span>Enregistrement vocal en cours... <strong>0:0{voiceTimer}s</strong></span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRecordingVoice(false)}
                        className="px-3 py-1 bg-rose-800 hover:bg-rose-900 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleStopAndSendVoice}
                        className="px-4 py-1 bg-white text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Envoyer la note vocale</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* INPUT CONSOLE BAR */
                  <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3.5 shrink-0 space-y-2">
                    
                    {/* SENDER / RECIPIENT TOGGLES */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      {isAdmin ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Émettre en tant que :
                          </span>
                          <div className="flex gap-1 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => setAdminSenderAlias('PedManager')}
                              className={`px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                adminSenderAlias === 'PedManager'
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              🗣️ Censeur
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminSenderAlias('ClassTeacher')}
                              className={`px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                adminSenderAlias === 'ClassTeacher'
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              🧑‍🏫 Prof. principal
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminSenderAlias('Director')}
                              className={`px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                adminSenderAlias === 'Director'
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              🏛️ Direction
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Contacter :
                          </span>
                          <div className="flex gap-1 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => setParentRecipientRole('Teacher')}
                              className={`px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                parentRecipientRole === 'Teacher'
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              🧑‍🏫 Prof. principal
                            </button>
                            <button
                              type="button"
                              onClick={() => setParentRecipientRole('Censor')}
                              className={`px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                parentRecipientRole === 'Censor'
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              🗣️ Censeur
                            </button>
                            <button
                              type="button"
                              onClick={() => setParentRecipientRole('Director')}
                              className={`px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                parentRecipientRole === 'Director'
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              🏛️ Directeur
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Quick Assistants Buttons */}
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setShowQuickTemplates(!showQuickTemplates)}
                          className="px-2 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg transition hover:bg-amber-100 cursor-pointer flex items-center gap-1"
                        >
                          <Zap className="h-3 w-3" />
                          <span>Modèles</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowAiAssistant(!showAiAssistant)}
                          className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg transition hover:bg-indigo-100 cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="h-3 w-3 text-indigo-600" />
                          <span>Assistant IA</span>
                        </button>
                      </div>
                    </div>

                    {/* MAIN TEXT FORM */}
                    <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => setShowAttachmentModal(true)}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-2xl transition cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
                        title="Joindre un justificatif ou document"
                      >
                        <Paperclip className="h-4.5 w-4.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsRecordingVoice(true)}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-600 dark:text-slate-300 rounded-2xl transition cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
                        title="Enregistrer une note vocale"
                      >
                        <Mic className="h-4.5 w-4.5" />
                      </button>

                      <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder={
                          isAdmin 
                            ? t('msg.write_to_parent', { name: currentStudent?.name || "l'élève" })
                            : parentRecipientRole === 'Teacher' 
                              ? t('msg.write_to_teacher', { name: currentStudent?.name || "l'élève", teacher: currentTeacherInfo.name })
                              : parentRecipientRole === 'Censor'
                                ? t('msg.write_to_censor', { censor: censorInfo.name })
                                : t('msg.write_to_director', { director: directorInfo.name })
                        }
                        className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                      />
                      
                      <button
                        type="submit"
                        disabled={sending || (!textInput.trim() && !attachedFile) || !selectedStudentId}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl disabled:opacity-40 cursor-pointer transition shrink-0 shadow-xs active:scale-97"
                      >
                        {sending ? (
                          <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                        ) : (
                          <Send className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* DOCUMENT ATTACHMENT MODAL */}
      <AnimatePresence>
        {showAttachmentModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-indigo-600" />
                  <span>Joindre un document justificatif</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAttachmentModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ×
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Sélectionnez le type de document justificatif à joindre à votre message ENT :
              </p>

              <div className="space-y-2">
                {[
                  { name: "Certificat_Medical_Absence.pdf", type: 'pdf' as const, label: "📄 Certificat Médical (PDF)" },
                  { name: "Justificatif_Absence_Parentale.pdf", type: 'pdf' as const, label: "📄 Justificatif d'Absence (PDF)" },
                  { name: "Reçu_Paiement_Scolarite.png", type: 'image' as const, label: "🖼️ Reçu de Paiement (Image)" },
                  { name: "Demande_Autorisation_Sortie.doc", type: 'doc' as const, label: "📝 Demande de Sortie (Word)" }
                ].map((docItem, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAttachedFile({
                        name: docItem.name,
                        type: docItem.type,
                        url: '#'
                      });
                      setShowAttachmentModal(false);
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition text-left cursor-pointer flex items-center justify-between"
                  >
                    <span>{docItem.label}</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">Joindre</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAttachmentModal(false)}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOBILE DEVICE POPUP SIMULATOR */}
      <AnimatePresence>
        {simulatedMobileSms && simulatedMobileSms.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-55 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-slate-950 text-white rounded-[40px] border-8 border-slate-800 p-5 w-full max-w-[340px] shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-slate-800 rounded-b-xl z-2 flex items-center justify-center">
                <div className="w-12 h-1 bg-black rounded-full" />
              </div>

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

                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 shadow-inner space-y-2">
                  <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Bell className="h-2.5 w-2.5 text-amber-500" /> ALERTE SMS SYNCHRO
                    </span>
                    <span>À l'instant</span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-sans text-slate-100">
                    {simulatedMobileSms.body}
                  </p>
                </div>

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
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[11px] font-medium transition cursor-pointer"
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
          initialSelectedStudentIds={selectedMultiStudentIds}
        />
      )}
    </div>
  );
}
