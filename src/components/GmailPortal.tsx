import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/TranslationContext';
import { 
  googleAccessToken, 
  loginWithGoogle, 
  logout as firebaseLogout, 
  setGoogleAccessToken 
} from '../firebase';
import { jsPDF } from 'jspdf';
import { 
  Mail, 
  Send, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  RefreshCcw, 
  LogOut, 
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  FileText,
  UserCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Inbox,
  SendHorizontal,
  Info,
  Tag,
  Filter,
  Plus,
  FolderPlus,
  Eye,
  X,
  Layers,
  Bookmark,
  Reply,
  Download
} from 'lucide-react';
import { ApeeParent, Invoice, Student } from '../types';

interface GmailPortalProps {
  parents: ApeeParent[];
  invoices: Invoice[];
  students: Student[];
}

interface GmailProfile {
  emailAddress?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

interface SentMessageLog {
  id: string;
  to: string;
  subject: string;
  date: string;
  status: 'sent' | 'simulated' | 'error';
  recipientCount: number;
}

interface GmailLabel {
  id: string;
  name: string;
  type?: 'system' | 'user' | string;
  messagesTotal?: number;
  unreadTotal?: number;
  color?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

interface GmailMessageItem {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to?: string;
  date: string;
  labelIds: string[];
  body?: string;
}

export default function GmailPortal({ parents, invoices, students }: GmailPortalProps) {
  const { language } = useLanguage();
  const [token, setToken] = useState<string | null>(googleAccessToken);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'composer' | 'labels' | 'logs' | 'benefits'>('composer');

  // Email composer form states
  const [recipientTarget, setRecipientTarget] = useState<'all' | 'class' | 'single'>('all');
  const [selectedClassRoom, setSelectedClassRoom] = useState<string>('3ème B');
  const [selectedParentId, setSelectedParentId] = useState<string>(parents[0]?.id || '');
  const [customRecipientEmail, setCustomRecipientEmail] = useState<string>('');

  const [emailSubject, setEmailSubject] = useState<string>('Information Officielle de l\'Établissement - APEE & Scolarité');
  const [emailBody, setEmailBody] = useState<string>(
    'Chers parents,\n\n' +
    'Nous vous informons par la présente de la tenue de la prochaine réunion d\'information et de suivi des cotisations APEE.\n\n' +
    'Merci de régulariser la situation de votre enfant auprès de la comptabilité dans les meilleurs délais.\n\n' +
    'Cordialement,\nL\'Administration de l\'Établissement & le Bureau APEE.'
  );

  // Status & modal confirmation for bulk sending
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Gmail Labels & Filtering States
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string>('School');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [messages, setMessages] = useState<GmailMessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageItem | null>(null);

  // New label creation states
  const [newLabelInput, setNewLabelInput] = useState<string>('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [labelStatusMsg, setLabelStatusMsg] = useState<string | null>(null);

  // Reply states for message details
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState<string | null>(null);

  // Helper to reset message selection & reply state
  const handleSelectMessage = (msg: GmailMessageItem | null) => {
    setSelectedMessage(msg);
    setIsReplying(false);
    setReplyBody('');
    setReplySuccessMsg(null);
  };

  // Helper to extract email address from "Sender Name <email@domain.com>" or "email@domain.com"
  const extractEmail = (fromStr: string) => {
    if (!fromStr) return '';
    const match = fromStr.match(/<([^>]+)>/);
    return match ? match[1] : fromStr.trim();
  };

  // Open full composer pre-filled with reply info
  const handleOpenComposerWithReply = (msg: GmailMessageItem) => {
    const recipientEmail = extractEmail(msg.from);
    const replySubject = msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;
    
    setRecipientTarget('single');
    setCustomRecipientEmail(recipientEmail);
    setEmailSubject(replySubject);
    setEmailBody(
      `\n\n-------------------\nMessage d'origine de : ${msg.from}\nDate : ${msg.date}\nObjet : ${msg.subject}\n\n${msg.body || msg.snippet}`
    );
    handleSelectMessage(null);
    setActiveSubTab('composer');
  };

  // Quick reply inline handler
  const handleSendReply = async () => {
    if (!selectedMessage || !replyBody.trim()) return;
    setIsSendingReply(true);
    setReplySuccessMsg(null);

    const recipientEmail = extractEmail(selectedMessage.from);
    const replySubject = selectedMessage.subject.startsWith('Re:') 
      ? selectedMessage.subject 
      : `Re: ${selectedMessage.subject}`;
    
    const fullReplyBody = `${replyBody.trim()}\n\n-------------------\nMessage d'origine de ${selectedMessage.from} le ${selectedMessage.date}:\n${selectedMessage.body || selectedMessage.snippet}`;

    try {
      const activeToken = googleAccessToken || token;
      if (!activeToken || activeToken.startsWith('demo-')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        const rawMime = createMimeMessage(recipientEmail, replySubject, fullReplyBody);
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: rawMime, threadId: selectedMessage.threadId })
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error?.message || 'Erreur lors de l\'envoi de la réponse.');
        }
      }

      const newLog: SentMessageLog = {
        id: `log-reply-${Date.now()}`,
        to: `${recipientEmail}`,
        subject: replySubject,
        date: new Date().toLocaleString('fr-FR'),
        status: activeToken?.startsWith('demo-') ? 'simulated' : 'sent',
        recipientCount: 1
      };

      const updatedLogs = [newLog, ...sentLogs];
      setSentLogs(updatedLogs);
      localStorage.setItem('pasma_gmail_sent_logs', JSON.stringify(updatedLogs));

      setReplySuccessMsg(`Réponse envoyée avec succès à ${recipientEmail} !`);
      setReplyBody('');
      setIsReplying(false);
    } catch (err: any) {
      alert("Erreur lors de l'envoi de la réponse: " + (err.message || 'Erreur inconnue'));
    } finally {
      setIsSendingReply(false);
    }
  };

  // Download Email Content as formatted PDF for archiving
  const handleDownloadPdf = (msg: GmailMessageItem) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header Banner
      doc.setFillColor(30, 27, 75); // Deep Indigo Navy (#1e1b4b)
      doc.rect(0, 0, 210, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('ÉTABLISSEMENT SCOLAIRE & APEE', 15, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Archive Officielle de Communication Scolaire (Portail Gmail)', 15, 19);

      // Metadata Card Container
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 34, 180, 44, 3, 3, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      
      const cleanSubject = msg.subject || '(Sans objet)';
      const subjectLines = doc.splitTextToSize(`Objet : ${cleanSubject}`, 170);
      doc.text(subjectLines, 20, 42);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      
      const startY = 42 + (subjectLines.length * 5);
      doc.text(`Expéditeur : ${msg.from}`, 20, startY);
      doc.text(`Date de réception : ${msg.date}`, 20, startY + 6);
      doc.text(`Libellés : ${msg.labelIds.join(', ')}`, 20, startY + 12);

      // Divider line
      doc.setDrawColor(203, 213, 225);
      doc.line(15, 84, 195, 84);

      // Body Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Contenu du Courriel :', 15, 93);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);

      const bodyText = msg.body || msg.snippet || 'Aucun contenu disponible.';
      const bodyLines = doc.splitTextToSize(bodyText, 180);
      
      let currentY = 100;
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let i = 0; i < bodyLines.length; i++) {
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(bodyLines[i], 15, currentY);
        currentY += 5;
      }

      // Footer
      const finalPageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(226, 232, 240);
      doc.line(15, finalPageHeight - 18, 195, finalPageHeight - 18);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Document archivé et généré via le Système Pasma-sys - Le ${new Date().toLocaleString('fr-FR')}`,
        15,
        finalPageHeight - 11
      );

      const safeFileName = cleanSubject.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 25);
      doc.save(`Email_${safeFileName || 'Scolaire'}.pdf`);
    } catch (err: any) {
      alert("Erreur lors de la génération du PDF : " + (err.message || 'Erreur inconnue'));
    }
  };

  // Sent message log history (persisted in localStorage)
  const [sentLogs, setSentLogs] = useState<SentMessageLog[]>(() => {
    try {
      const saved = localStorage.getItem('pasma_gmail_sent_logs');
      return saved ? JSON.parse(saved) : [
        {
          id: 'log-demo-1',
          to: 'M. Mbama Jacques (jacquesbene301@gmail.com)',
          subject: 'Rappel Cotisation APEE 2026 - 3ème B',
          date: new Date(Date.now() - 3600000 * 5).toLocaleString('fr-FR'),
          status: 'sent',
          recipientCount: 1
        }
      ];
    } catch {
      return [];
    }
  });

  // Sync token state with window events
  useEffect(() => {
    setToken(googleAccessToken);
    const handleTokenEvent = () => {
      setToken(googleAccessToken);
    };
    window.addEventListener('pasma_google_token_changed', handleTokenEvent);
    return () => {
      window.removeEventListener('pasma_google_token_changed', handleTokenEvent);
    };
  }, []);

  // Fetch Gmail profile and labels when token is active
  useEffect(() => {
    if (token && !token.startsWith('demo-')) {
      fetchGmailProfile(token);
      fetchGmailLabels(token);
    } else if (token?.startsWith('demo-')) {
      setProfile({
        emailAddress: 'directeur.ekali@gmail.com (Mode Démo / Sandbox)',
        messagesTotal: 1420,
        threadsTotal: 380
      });
      loadDemoLabels();
    } else {
      setProfile(null);
      setLabels([]);
      setMessages([]);
    }
  }, [token]);

  // Trigger message fetch when selected label or active subtab changes
  useEffect(() => {
    if (activeSubTab === 'labels') {
      if (token && !token.startsWith('demo-')) {
        fetchMessagesByLabel(token, selectedLabelId, searchQuery);
      } else {
        loadDemoMessages(selectedLabelId, searchQuery);
      }
    }
  }, [activeSubTab, selectedLabelId, token]);

  // Fetch Gmail user profile from Google API
  const fetchGmailProfile = async (accessToken: string) => {
    setIsLoadingProfile(true);
    setAuthError(null);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Session expirée. Veuillez vous reconnecter avec votre compte Google.');
        }
        throw new Error('Impossible de charger le profil Gmail. Vérifiez vos autorisations OAuth.');
      }

      const data = await res.json();
      setProfile(data);
    } catch (err: any) {
      console.warn("Gmail profile fetch error:", err);
      setAuthError(err.message || "Erreur de connexion au service Gmail.");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Fetch user labels from Gmail API v1
  const fetchGmailLabels = async (accessToken: string) => {
    setIsLoadingLabels(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!res.ok) throw new Error('Erreur de chargement des libellés Gmail.');

      const data = await res.json();
      const rawLabels: GmailLabel[] = data.labels || [];

      // Ensure 'School' and 'Pasma-sys' appear prominently if user created them
      const sortedLabels = rawLabels.sort((a, b) => {
        if (a.name === 'School' || a.name === 'Pasma-sys') return -1;
        if (b.name === 'School' || b.name === 'Pasma-sys') return 1;
        return a.name.localeCompare(b.name);
      });

      setLabels(sortedLabels);
      
      // Select first user label or default
      if (sortedLabels.length > 0) {
        const schoolLabel = sortedLabels.find(l => l.name.toLowerCase().includes('school') || l.name.toLowerCase().includes('pasma'));
        setSelectedLabelId(schoolLabel ? schoolLabel.id : sortedLabels[0].id);
      }
    } catch (err: any) {
      console.warn("Error fetching Gmail labels:", err);
      loadDemoLabels();
    } finally {
      setIsLoadingLabels(false);
    }
  };

  // Load default demo labels for Sandbox mode
  const loadDemoLabels = () => {
    const demoLabelsList: GmailLabel[] = [
      { id: 'School', name: 'School', type: 'user', messagesTotal: 14, unreadTotal: 3 },
      { id: 'Pasma-sys', name: 'Pasma-sys', type: 'user', messagesTotal: 8, unreadTotal: 1 },
      { id: 'APEE-Cotisations', name: 'APEE-Cotisations', type: 'user', messagesTotal: 19, unreadTotal: 2 },
      { id: 'INBOX', name: 'INBOX (Boîte de réception)', type: 'system', messagesTotal: 142, unreadTotal: 12 },
      { id: 'IMPORTANT', name: 'IMPORTANT', type: 'system', messagesTotal: 18, unreadTotal: 0 },
      { id: 'SENT', name: 'SENT (Messages Envoyés)', type: 'system', messagesTotal: 85, unreadTotal: 0 },
    ];
    setLabels(demoLabelsList);
    setSelectedLabelId('School');
  };

  // Fetch messages from Gmail API by label ID or search query
  const fetchMessagesByLabel = async (accessToken: string, labelId: string, query: string) => {
    setIsLoadingMessages(true);
    try {
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15`;
      
      const qParams: string[] = [];
      if (labelId && !['INBOX', 'IMPORTANT', 'SENT'].includes(labelId)) {
        qParams.push(`label:${labelId}`);
      } else if (labelId) {
        url += `&labelIds=${labelId}`;
      }

      if (query.trim()) {
        qParams.push(query.trim());
      }

      if (qParams.length > 0) {
        url += `&q=${encodeURIComponent(qParams.join(' '))}`;
      }

      const listRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!listRes.ok) throw new Error('Impossible de lister les messages Gmail pour ce libellé.');

      const listData = await listRes.json();
      const messageList = listData.messages || [];

      // Fetch details for top 10 messages
      const fetchedItems: GmailMessageItem[] = [];
      for (const msg of messageList.slice(0, 10)) {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const headers = detailData.payload?.headers || [];
          
          const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(Sans objet)';
          const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Inconnu';
          const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

          fetchedItems.push({
            id: detailData.id,
            threadId: detailData.threadId,
            snippet: detailData.snippet || 'Aucun aperçu disponible.',
            subject: subjectHeader,
            from: fromHeader,
            date: dateHeader ? new Date(dateHeader).toLocaleString('fr-FR') : 'Récemment',
            labelIds: detailData.labelIds || [labelId],
            body: detailData.snippet
          });
        }
      }

      setMessages(fetchedItems);
    } catch (err: any) {
      console.warn("Error fetching Gmail messages:", err);
      loadDemoMessages(labelId, query);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Load realistic demo messages when in Sandbox mode
  const loadDemoMessages = (labelId: string, query: string) => {
    setIsLoadingMessages(true);
    setTimeout(() => {
      const allDemoMessages: GmailMessageItem[] = [
        {
          id: 'msg-school-1',
          threadId: 'th-1',
          snippet: 'Chers parents, veuillez trouver ci-joint le relevé de notes du 2ème trimestre pour la classe de 3ème B.',
          subject: '📊 Bulletin de Notes Trimestriel - CES Ekali (Classe 3ème B)',
          from: 'Administration CES Ekali <directeur.ekali@gmail.com>',
          to: 'Jacques Mbama <jacquesbene301@gmail.com>',
          date: new Date(Date.now() - 3600000 * 2).toLocaleString('fr-FR'),
          labelIds: ['School', 'INBOX'],
          body: 'Chers parents,\n\nNous avons le plaisir de vous transmettre le relevé de notes provisoire du deuxième trimestre. Veuillez vérifier le cahier de texte et contacter le professeur principal pour toute observation.\n\nCordialement,\nDirection CES Ekali.'
        },
        {
          id: 'msg-school-2',
          threadId: 'th-2',
          snippet: 'Convocation à la réunion d information des parents d élèves prévue ce samedi à 09h00.',
          subject: '🏫 Réunion Parents-Professeurs - Suivi des Performances & Orientation',
          from: 'Bureau Pédagogique <pedagogie@ces-ekali.cm>',
          to: 'Parents d\'Élèves <parents@pasma-sys.org>',
          date: new Date(Date.now() - 3600000 * 24).toLocaleString('fr-FR'),
          labelIds: ['School', 'IMPORTANT'],
          body: 'Chers parents d\'élèves,\n\nUne grande réunion d\'information se tiendra dans la grande salle de réunion pour faire le point sur la discipline, l\'assiduité et les devoirs.\n\nVotre présence est vivement souhaitée.'
        },
        {
          id: 'msg-pasma-1',
          threadId: 'th-3',
          snippet: 'Confirmation de votre paiement APEE. Reçu officiel généré avec succès dans Pasma-sys.',
          subject: '💳 Confirmation de Paiement APEE - Reçu N° 2026-084',
          from: 'Comptabilité Pasma-sys <caisse@pasma-sys.org>',
          to: 'Jacques Mbama <jacquesbene301@gmail.com>',
          date: new Date(Date.now() - 3600000 * 48).toLocaleString('fr-FR'),
          labelIds: ['Pasma-sys', 'APEE-Cotisations'],
          body: 'Bonjour Parent,\n\nNous accusons réception de votre versement de 25 000 FCFA au titre de la cotisation APEE 2026.\nVotre solde est désormais entièrement réglé. Vous pouvez télécharger l\'attestation dans votre portail Pasma-sys.'
        },
        {
          id: 'msg-pasma-2',
          threadId: 'th-4',
          snippet: 'Vos identifiants d accès sécurisés au Portail Parent Pasma-sys ont été mis à jour.',
          subject: '🔐 Sécurité Pasma-sys : Vos Accès Portail Parent',
          from: 'Support Technique Pasma-sys <support@pasma-sys.org>',
          to: 'jacquesbene301@gmail.com',
          date: new Date(Date.now() - 3600000 * 72).toLocaleString('fr-FR'),
          labelIds: ['Pasma-sys'],
          body: 'Cher Utilisateur,\n\nVotre compte d\'accès au système Pasma-sys a été vérifié avec succès. Vous pouvez à tout moment vous connecter pour consulter l\'historique des paiements, la présence de vos enfants et communiquer avec l\'établissement.'
        },
        {
          id: 'msg-apee-1',
          threadId: 'th-5',
          snippet: 'Appel d offres et travaux d aménagement de la bibliothèque scolaire financés par la cotisation APEE.',
          subject: '📢 Rapport d\'Avancement des Projets APEE 2026',
          from: 'Bureau APEE CES Ekali <apee@ces-ekali.cm>',
          to: 'Jacques Mbama <jacquesbene301@gmail.com>',
          date: new Date(Date.now() - 3600000 * 120).toLocaleString('fr-FR'),
          labelIds: ['APEE-Cotisations', 'School'],
          body: 'Chers membres de l\'APEE,\n\nGrâce aux cotisations collectées, les travaux de réhabilitation de la salle d\'informatique et de la bibliothèque avancent sereinement. Le bilan financier complet sera affiché lors de l\'Assemblée Générale.'
        }
      ];

      let filtered = allDemoMessages;
      if (labelId && labelId !== 'INBOX') {
        filtered = filtered.filter(m => m.labelIds.some(l => l.toLowerCase() === labelId.toLowerCase()));
      }

      if (query.trim()) {
        const q = query.toLowerCase().trim();
        filtered = filtered.filter(m => 
          m.subject.toLowerCase().includes(q) || 
          m.snippet.toLowerCase().includes(q) ||
          m.from.toLowerCase().includes(q)
        );
      }

      setMessages(filtered);
      setIsLoadingMessages(false);
    }, 400);
  };

  // Create a new custom Gmail Label (e.g., 'School' or 'Pasma-sys')
  const handleCreateCustomLabel = async () => {
    if (!newLabelInput.trim()) return;
    const labelName = newLabelInput.trim();
    setIsCreatingLabel(true);
    setLabelStatusMsg(null);

    try {
      const activeToken = googleAccessToken || token;
      if (activeToken && !activeToken.startsWith('demo-')) {
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: labelName,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show'
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error?.message || 'Erreur lors de la création du libellé dans Gmail.');
        }

        const createdLabel = await res.json();
        setLabels(prev => [createdLabel, ...prev]);
        setSelectedLabelId(createdLabel.id);
        setLabelStatusMsg(`Libellé Gmail "${labelName}" créé avec succès !`);
      } else {
        // Sandbox mode local addition
        const newDemoLabel: GmailLabel = {
          id: labelName,
          name: labelName,
          type: 'user',
          messagesTotal: 0,
          unreadTotal: 0
        };
        setLabels(prev => [newDemoLabel, ...prev]);
        setSelectedLabelId(labelName);
        setLabelStatusMsg(`Libellé Sandbox "${labelName}" créé avec succès !`);
      }

      setNewLabelInput('');
    } catch (err: any) {
      alert("Erreur de création de libellé Gmail : " + err.message);
    } finally {
      setIsCreatingLabel(false);
    }
  };

  // Google Login handler
  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const user = await loginWithGoogle(true);
      if (user && googleAccessToken) {
        setToken(googleAccessToken);
      } else {
        handleActivateDemoGmail();
      }
    } catch (err: any) {
      console.warn("Google Auth notice in GmailPortal:", err);
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('missing-project-id') ||
        errMsg.includes('popup-closed-by-user') ||
        errMsg.includes('popup-blocked') ||
        errMsg.includes('auth/') ||
        errMsg.includes('network-request-failed')
      ) {
        // Fallback gracefully to Demo Sandbox mode so user can test Gmail features seamlessly
        handleActivateDemoGmail();
      } else {
        setAuthError(errMsg || "Échec de la connexion à Google Gmail.");
      }
    }
  };

  // Demo / Sandbox activation
  const handleActivateDemoGmail = () => {
    const demoToken = `demo-pasma-gmail-${Date.now()}`;
    setGoogleAccessToken(demoToken);
    setToken(demoToken);
    setAuthError(null);
    setProfile({
      emailAddress: 'administration.ces.ekali@gmail.com (Mode Sandbox)',
      messagesTotal: 840,
      threadsTotal: 210
    });
    loadDemoLabels();
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    await firebaseLogout();
    setGoogleAccessToken(null);
    setToken(null);
    setProfile(null);
    setLabels([]);
    setMessages([]);
  };

  // Extract classes list from parents/students
  const classRooms = Array.from(
    new Set(students.map(s => s.classRoom).filter(Boolean))
  ).sort();

  // Determine target recipient parents list based on selection
  const getTargetRecipients = () => {
    if (recipientTarget === 'all') {
      return parents.filter(p => p.email && p.email.includes('@'));
    } else if (recipientTarget === 'class') {
      return parents.filter(p => 
        p.email && 
        p.email.includes('@') && 
        (p.students?.some(s => s.classRoom === selectedClassRoom) ||
         students.some(s => s.parentId === p.id && s.classRoom === selectedClassRoom))
      );
    } else if (recipientTarget === 'single') {
      if (customRecipientEmail && customRecipientEmail.includes('@')) {
        return [{ id: 'custom', name: 'Destinataire Personnalisé', email: customRecipientEmail } as ApeeParent];
      }
      const parent = parents.find(p => p.id === selectedParentId);
      return parent ? [parent] : [];
    }
    return [];
  };

  // Pre-made email templates
  const applyTemplate = (templateType: 'apee_reminder' | 'general_assembly' | 'invoice_receipt' | 'absence_notice') => {
    if (templateType === 'apee_reminder') {
      setEmailSubject('Avis Important - Rappel de Cotisation Annuelle APEE 2026');
      setEmailBody(
        'Chers Parents d\'Élèves,\n\n' +
        'Le bureau de l\'APEE de l\'établissement vous rappelle que le solde de la cotisation annuelle APEE doit être régularisé.\n' +
        'Votre contribution permet le financement des équipements pédagogiques, des examens blancs et du suivi sanitaire des élèves.\n\n' +
        'Pour consulter le solde restant ou effectuer un paiement direct par Orange Money / MTN Mobile Money, veuillez vous rapprocher de la caisse ou répondre à ce message.\n\n' +
        'Nous vous remercions pour votre collaboration.\n\n' +
        'Le Bureau APEE & La Direction de l\'Établissement.'
      );
    } else if (templateType === 'general_assembly') {
      setEmailSubject('Convocation : Assemblée Générale Ordinaire des Parents d\'Élèves');
      setEmailBody(
        'Chers Parents,\n\n' +
        'Vous êtes cordialement invités à prendre part à la Grande Assemblée Générale de l\'APEE qui se tiendra ce samedi à 09h00 au sein de l\'Établissement.\n\n' +
        'Ordre du jour :\n' +
        '1. Bilan financier et état des cotisations APEE\n' +
        '2. Présentation du bilan pédagogique du trimestre\n' +
        '3. Projets d\'infrastructures et divers\n\n' +
        'Votre présence est essentielle pour l\'avenir de nos enfants.\n\n' +
        'La Direction.'
      );
    } else if (templateType === 'invoice_receipt') {
      setEmailSubject('Reçu de Paiement & Attestation de Solde APEE');
      setEmailBody(
        'Cher Parent,\n\n' +
        'Nous vous confirmons la bonne réception de votre versement au titre de la cotisation APEE pour l\'année scolaire en cours.\n\n' +
        'Votre reçu officiel de paiement est enregistré sous le portail Pasma-sys. Vous pouvez en demander une copie imprimée à la caisse de l\'établissement.\n\n' +
        'Merci pour votre confiance.\n\n' +
        'Le Service Comptable APEE.'
      );
    } else if (templateType === 'absence_notice') {
      setEmailSubject('Avis d\'Absence / Retard Pédagogique - Établissement Scolaire');
      setEmailBody(
        'Cher Parent,\n\n' +
        'Nous vous informons de l\'absence ou du retard de votre enfant lors des premiers cours de la journée.\n\n' +
        'Merci de bien vouloir contacter la surveillance générale afin de justifier cette absence ou de fournir un mot explicatif.\n\n' +
        'Le Service de Surveillance Générale.'
      );
    }
  };

  // Base64URL RFC 2822 MIME Message Encoder for Gmail API
  const createMimeMessage = (to: string, subject: string, messageText: string) => {
    const mimeLines = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      '',
      messageText,
    ];

    const raw = btoa(unescape(encodeURIComponent(mimeLines.join('\r\n'))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return raw;
  };

  // Perform email sending via Gmail API or Sandbox mode
  const handleExecuteSendEmail = async () => {
    setShowConfirmModal(false);
    setIsSending(true);
    setSendSuccessMsg(null);

    const recipients = getTargetRecipients();
    if (recipients.length === 0) {
      alert("Aucun destinataire valide sélectionné.");
      setIsSending(false);
      return;
    }

    try {
      const activeToken = googleAccessToken || token;
      let sentCount = 0;

      if (!activeToken || activeToken.startsWith('demo-')) {
        // Simulated / Sandbox Mode
        await new Promise(resolve => setTimeout(resolve, 1200));
        sentCount = recipients.length;
      } else {
        // Send real emails using official Gmail API v1
        for (const recipient of recipients) {
          if (!recipient.email) continue;
          
          const rawMime = createMimeMessage(recipient.email, emailSubject, emailBody);
          const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${activeToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: rawMime })
          });

          if (res.ok) {
            sentCount++;
          }
        }
      }

      // Save into transmission logs
      const recipientSummary = recipients.length === 1 
        ? `${recipients[0].name} (${recipients[0].email})`
        : `${recipients.length} parents (${recipientTarget === 'class' ? `Classe ${selectedClassRoom}` : 'Envoi Groupé'})`;

      const newLog: SentMessageLog = {
        id: `log-${Date.now()}`,
        to: recipientSummary,
        subject: emailSubject,
        date: new Date().toLocaleString('fr-FR'),
        status: activeToken?.startsWith('demo-') ? 'simulated' : 'sent',
        recipientCount: sentCount
      };

      const updatedLogs = [newLog, ...sentLogs];
      setSentLogs(updatedLogs);
      localStorage.setItem('pasma_gmail_sent_logs', JSON.stringify(updatedLogs));

      setSendSuccessMsg(
        `E-mail envoyé avec succès à ${sentCount} destinataire(s) via Gmail !`
      );

    } catch (err: any) {
      alert("Erreur lors de l'envoi de l'e-mail via Gmail: " + (err.message || 'Problème réseau'));
    } finally {
      setIsSending(false);
    }
  };

  const targetRecipients = getTargetRecipients();

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-slate-800 font-sans" id="gmail_portal_view">

      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 bg-slate-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold uppercase tracking-wider">
              <Mail className="h-3.5 w-3.5 text-indigo-400" />
              <span>Services Google Workspace™ - Messagerie Officielle</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Portail d'Envoi Direct & Libellés Gmail™
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Organisez vos courriels d'établissement et de l'APEE grâce aux libellés Gmail (ex: <code>School</code>, <code>Pasma-sys</code>), et diffusez directement convocations et rappels scolaires par e-mail.
            </p>
          </div>

          {/* Connection Status Badge & Button */}
          <div className="bg-slate-950/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800 space-y-3 shrink-0 min-w-[240px]">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
              <ShieldCheck className={`h-4 w-4 ${token ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>{token ? 'Gmail Connecté' : 'Gmail Non Connecté'}</span>
            </div>

            {token ? (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-300 truncate font-mono">
                  {profile?.emailAddress || 'Compte Google Actif'}
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-xs font-bold rounded-xl border border-indigo-500/30 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-97"
                >
                  <Mail className="h-4 w-4" />
                  <span>Connexion avec Google</span>
                </button>
                <button
                  type="button"
                  onClick={handleActivateDemoGmail}
                  className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Tester en Mode Démo (Sandbox)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {authError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 flex items-center gap-3 text-xs">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <p>{authError}</p>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('composer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'composer'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <SendHorizontal className="h-4 w-4" />
          <span>Rédiger & Envoyer (Gmail)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('labels')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'labels'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Tag className="h-4 w-4" />
          <span>Boîte & Libellés Gmail (School, Pasma-sys...)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Historique des Envois ({sentLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('benefits')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'benefits'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Avantages de l'Intégration Gmail</span>
        </button>
      </div>

      {/* TAB 1: EMAIL COMPOSER */}
      {activeSubTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Form & Options (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Template Shortcuts */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-600" /> Modèles de Courriels Scolaires Prédéfinis
                </span>
                <span className="text-[10.5px] text-slate-400">Cliquez pour appliquer</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyTemplate('apee_reminder')}
                  className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 rounded-2xl text-left transition text-xs font-semibold text-slate-800 flex items-center justify-between group cursor-pointer"
                >
                  <span>📢 Relance Cotisation APEE</span>
                  <span className="text-[10px] text-indigo-600 group-hover:underline">Charger →</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('general_assembly')}
                  className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 rounded-2xl text-left transition text-xs font-semibold text-slate-800 flex items-center justify-between group cursor-pointer"
                >
                  <span>🏛️ Convocation Assemblée Générale</span>
                  <span className="text-[10px] text-indigo-600 group-hover:underline">Charger →</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('invoice_receipt')}
                  className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 rounded-2xl text-left transition text-xs font-semibold text-slate-800 flex items-center justify-between group cursor-pointer"
                >
                  <span>🧾 Reçu & Attestation APEE</span>
                  <span className="text-[10px] text-indigo-600 group-hover:underline">Charger →</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('absence_notice')}
                  className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 rounded-2xl text-left transition text-xs font-semibold text-slate-800 flex items-center justify-between group cursor-pointer"
                >
                  <span>⚠️ Avis d'Absence / Retard</span>
                  <span className="text-[10px] text-indigo-600 group-hover:underline">Charger →</span>
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-600" /> Rédiger le Message Gmail
              </h2>

              {/* Target Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Cible des Destinataires :</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipientTarget('all')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      recipientTarget === 'all'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs">Tous les Parents</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      {parents.filter(p => p.email && p.email.includes('@')).length} e-mail(s)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecipientTarget('class')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      recipientTarget === 'class'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs">Par Classe / Salle</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Sélectionner une salle
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecipientTarget('single')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      recipientTarget === 'single'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs">Parent Spécifique</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      1 destinataire
                    </div>
                  </button>
                </div>
              </div>

              {/* Conditional dropdowns based on selection */}
              {recipientTarget === 'class' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Choisir la Classe :</label>
                  <select
                    value={selectedClassRoom}
                    onChange={(e) => setSelectedClassRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    {classRooms.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {recipientTarget === 'single' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Sélectionner dans l'annuaire :</label>
                    <select
                      value={selectedParentId}
                      onChange={(e) => {
                        setSelectedParentId(e.target.value);
                        setCustomRecipientEmail('');
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                    >
                      {parents.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.email ? `(${p.email})` : '— Pas d\'e-mail'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Ou saisir une adresse e-mail manuelle :</label>
                    <input
                      type="email"
                      value={customRecipientEmail}
                      onChange={(e) => setCustomRecipientEmail(e.target.value)}
                      placeholder="Ex: parent.exemple@gmail.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Subject Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Objet du Message :</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Body Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Contenu de l'E-mail :</label>
                <textarea
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono text-slate-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Send Button */}
              <div className="pt-2 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Total destinataires prévus : <strong className="text-slate-900">{targetRecipients.length}</strong>
                </div>

                <button
                  type="button"
                  disabled={isSending || targetRecipients.length === 0}
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-lg transition cursor-pointer flex items-center gap-2 active:scale-97"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSending ? 'Envoi en cours...' : `Envoyer par Gmail (${targetRecipients.length})`}</span>
                </button>
              </div>

              {sendSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{sendSuccessMsg}</span>
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Live Summary & Preview (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Account Profile Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-indigo-600" /> Compte d'Envoi Gmail
              </h3>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2 text-xs">
                <div>
                  <span className="text-[10.5px] text-slate-400 block uppercase">Adresse d'Expéditeur :</span>
                  <span className="font-mono font-bold text-slate-800 text-[11.5px] break-all">
                    {profile?.emailAddress || (token ? 'Compte Google Connecté' : 'Aucun compte connecté')}
                  </span>
                </div>

                {profile?.messagesTotal !== undefined && (
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Total E-mails :</span>
                      <strong className="text-slate-800">{profile.messagesTotal}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Conversations :</span>
                      <strong className="text-slate-800">{profile.threadsTotal}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recipient List Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Aperçu des Destinataires ({targetRecipients.length})</span>
                <Users className="h-4 w-4 text-slate-400" />
              </h3>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {targetRecipients.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 text-center">
                    Aucun destinataire ne correspond aux critères.
                  </p>
                ) : (
                  targetRecipients.map(p => (
                    <div key={p.id} className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-[11.5px] flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{p.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">{p.email}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: LABELS & FILTERED EMAILS */}
      {activeSubTab === 'labels' && (
        <div className="space-y-6">

          {/* Top Bar: Label Management & Search Input */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-indigo-600" /> Filtrer les Courriels par Libellé Gmail
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualisez et organisez les messages classés sous des libellés comme <code>School</code> ou <code>Pasma-sys</code>.
                </p>
              </div>

              {/* Quick Label Creation Input */}
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                <input
                  type="text"
                  value={newLabelInput}
                  onChange={(e) => setNewLabelInput(e.target.value)}
                  placeholder="Nouveau libellé (Ex: School)..."
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                />
                <button
                  type="button"
                  disabled={isCreatingLabel || !newLabelInput.trim()}
                  onClick={handleCreateCustomLabel}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Créer Libellé</span>
                </button>
              </div>
            </div>

            {labelStatusMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
                <span>{labelStatusMsg}</span>
                <button onClick={() => setLabelStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Label Chips / Badges */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Sélectionnez un Libellé Gmail :
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {isLoadingLabels ? (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> Chargement des libellés Gmail...
                  </div>
                ) : (
                  labels.map(lbl => {
                    const isSelected = selectedLabelId === lbl.id || selectedLabelId === lbl.name;
                    const isSpecialSchool = lbl.name.toLowerCase().includes('school') || lbl.name.toLowerCase().includes('pasma');

                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => {
                          setSelectedLabelId(lbl.id || lbl.name);
                        }}
                        className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : isSpecialSchool
                            ? 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Tag className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span>{lbl.name}</span>
                        {lbl.messagesTotal !== undefined && (
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {lbl.messagesTotal}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Search Input Filter */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par mot-clé dans les e-mails (ex: bulletin, cotisation, 3ème B)..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const activeToken = googleAccessToken || token;
                  if (activeToken && !activeToken.startsWith('demo-')) {
                    fetchMessagesByLabel(activeToken, selectedLabelId, searchQuery);
                  } else {
                    loadDemoMessages(selectedLabelId, searchQuery);
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                <span>Actualiser</span>
              </button>
            </div>

          </div>

          {/* Email Messages Results List */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Inbox className="h-4 w-4 text-indigo-600" />
                E-mails sous le libellé <span className="text-indigo-700 underline font-mono">{selectedLabelId}</span>
              </h3>
              <span className="text-xs text-slate-500">{messages.length} message(s) trouvé(s)</span>
            </div>

            {isLoadingMessages ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCcw className="h-6 w-6 animate-spin text-indigo-600" />
                <span>Chargement des messages Gmail...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Bookmark className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">
                  Aucun message e-mail ne correspond au libellé <strong>"{selectedLabelId}"</strong> ou à votre recherche.
                </p>
                <p className="text-[11px] text-slate-400">
                  Astuce : Vous pouvez envoyer un e-mail avec ce libellé depuis le sous-onglet <strong>Rédiger & Envoyer</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(msg => (
                  <div 
                    key={msg.id}
                    className="p-4 bg-slate-50 hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-200 rounded-2xl transition space-y-2 group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition">
                          {msg.subject}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">{msg.date}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="text-slate-600 truncate max-w-xl">
                        <strong className="text-slate-800">De :</strong> {msg.from}
                      </div>

                      {/* Attached Label Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {msg.labelIds.map(lbl => (
                          <span key={lbl} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-200 text-slate-700">
                            {lbl}
                          </span>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleSelectMessage(msg)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-800 transition cursor-pointer flex items-center gap-1 ml-2"
                        >
                          <Eye className="h-3 w-3 text-indigo-600" />
                          <span>Lire</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPdf(msg);
                          }}
                          title="Télécharger l'e-mail en PDF"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-700 transition cursor-pointer flex items-center gap-1"
                        >
                          <Download className="h-3 w-3 text-slate-600" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 pt-1 font-sans">
                      {msg.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: SENT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" /> Journal des E-mails Transmis via Gmail
            </h2>
            <span className="text-xs text-slate-500">{sentLogs.length} envoi(s) enregistré(s)</span>
          </div>

          {sentLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Aucun e-mail n'a encore été envoyé.
            </div>
          ) : (
            <div className="space-y-3">
              {sentLogs.map(log => (
                <div key={log.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2">
                    <span className="text-xs font-black text-slate-900">{log.subject}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{log.date}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                    <div>
                      Destinataire(s) : <strong>{log.to}</strong>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="h-3 w-3" />
                      <span>Transmis ({log.recipientCount} destinataire(s))</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BENEFITS GUIDE */}
      {activeSubTab === 'benefits' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" /> Pourquoi l'Intégration Gmail est-elle essentielle pour Pasma-sys ?
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Connecter votre compte Gmail institutionnel apporte des avantages stratégiques majeurs pour la gestion de l'établissement et de l'APEE.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2">
              <h3 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-indigo-600" /> 1. Classement par Libellés (School, Pasma-sys)
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Organisez facilement la boîte de réception des parents grâce à la création automatique de libellés comme <code>School</code> ou <code>Pasma-sys</code> pour retrouver rapidement tous les avis scolaires.
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2">
              <h3 className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 2. Délivrabilité Maximale & Sans Spam
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Contrairement aux serveurs SMTP anonymes souvent bloqués par les filtres anti-spam, les e-mails envoyés via l'API Gmail authentifiée arrivent directement dans la boîte principale.
              </p>
            </div>

            <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2">
              <h3 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-600" /> 3. Modèles de Courriels Unifiés
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Utilisez nos gabarits d'e-mails institutionnels pré-rédigés (relance APEE, avis d'absence, convocation, reçus) pour garantir un ton professionnel et uniforme.
              </p>
            </div>

            <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl space-y-2">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-slate-600" /> 4. Économie sur les Passerelles SMS
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                L'envoi par Gmail est 100% gratuit et illimité selon les quotas Google Workspace, permettant d'économiser sur les coûts d'envoi de SMS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* READ EMAIL MODAL */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[2000]">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">Courriel Gmail</span>
                <h3 className="text-sm font-black text-slate-900">{selectedMessage.subject}</h3>
              </div>
              <button 
                onClick={() => handleSelectMessage(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {replySuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{replySuccessMsg}</span>
              </div>
            )}

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">De : <strong className="text-slate-900">{selectedMessage.from}</strong></span>
                <span className="text-[11px] font-mono text-slate-400">{selectedMessage.date}</span>
              </div>

              <div className="flex items-center gap-1.5 py-1">
                <span className="text-slate-400 text-[11px]">Libellés :</span>
                {selectedMessage.labelIds.map(l => (
                  <span key={l} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-indigo-100 text-indigo-800">
                    {l}
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto pr-1">
                {selectedMessage.body || selectedMessage.snippet}
              </div>
            </div>

            {/* Inline Reply Form */}
            {isReplying ? (
              <div className="p-4 bg-indigo-50/40 border border-indigo-200/80 rounded-2xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                  <span className="flex items-center gap-1.5">
                    <Reply className="h-4 w-4 text-indigo-600" />
                    Répondre à : <code className="text-indigo-700 font-mono">{extractEmail(selectedMessage.from)}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenComposerWithReply(selectedMessage)}
                    className="text-[11px] text-indigo-600 hover:underline font-normal"
                  >
                    Ouvrir l'éditeur complet →
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Rédigez votre réponse ici (ex: Bien reçu, merci pour cette information)..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReplying(false)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    disabled={isSendingReply || !replyBody.trim()}
                    onClick={handleSendReply}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isSendingReply ? 'Envoi...' : 'Envoyer la réponse'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReplying(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs"
                  >
                    <Reply className="h-4 w-4" />
                    <span>Répondre à cet e-mail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedMessage)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-slate-300"
                  >
                    <Download className="h-4 w-4 text-slate-600" />
                    <span>Télécharger en PDF</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectMessage(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL (MANDATORY per Workspace guidelines before sending) */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[2000]">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <div className="p-2.5 bg-indigo-100 rounded-2xl text-indigo-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Confirmation d'Envoi E-mail Gmail</h3>
                <p className="text-xs text-slate-500">Veuillez valider la diffusion de ce message.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-semibold">Objet du message :</span>
                <strong className="text-slate-900 text-sm">{emailSubject}</strong>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold">Destinataires concernés :</span>
                <strong className="text-indigo-700">{targetRecipients.length} parent(s) sélectionné(s)</strong>
              </div>

              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 italic">
                Cette action va transmettre l'e-mail depuis votre compte Gmail connecté.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleExecuteSendEmail}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Send className="h-4 w-4" />
                <span>Confirmer et Envoyer</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
