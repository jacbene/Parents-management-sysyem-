import React, { useState } from 'react';
import { 
  Smartphone, 
  Mail, 
  Send, 
  Copy, 
  Check, 
  Users, 
  Search, 
  CheckCircle, 
  ExternalLink, 
  MessageSquare, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  MessageCircle,
  HelpCircle,
  Clock,
  Settings,
  X
} from 'lucide-react';
import { ApeeParent, ApeeSettings } from '../../types';
import { getApeeShortName, generateApeeReminderMessage } from '../../utils/apeeDb';

interface ApeeRemindersProps {
  parents: ApeeParent[];
  settings: ApeeSettings;
  onSaveParent: (parent: ApeeParent) => Promise<boolean>;
}

export default function ApeeReminders({ parents, settings, onSaveParent }: ApeeRemindersProps) {
  // Overdue parents are those with state 'partiel' or 'retard'
  const overdueParents = parents.filter(p => p.status === 'partiel' || p.status === 'retard');

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'partiel' | 'retard'>('all');
  
  // Custom templates
  const [smsTemplate, setSmsTemplate] = useState<string>(
    "Chers parents. Rappel {short_name} {school_year} de {association_name} pour votre pupille ({student_names}). Le solde restant dû est de {remaining_amount} FCFA. Veuillez régulariser au plus vite par versement ou virement. Merci pour votre collaboration."
  );
  
  const [emailSubject, setEmailSubject] = useState<string>(
    "Rappel de Paiement Cotisation {short_name} - {association_name}"
  );
  
  const [emailTemplate, setEmailTemplate] = useState<string>(
    "Bonjour {parent_name},\n\nNous vous contactons au sujet de la cotisation {short_name} ({school_year}) pour l'établissement {association_name} quant à la scolarisation de votre/vos enfant(s) : {student_names}.\n\nÀ ce jour, votre compte présente un solde restant de {remaining_amount} FCFA (sur un montant exigible de {total_due_amount} FCFA).\n\nNous vous prions de bien vouloir régulariser cette situation auprès de l'intendante.\n\nSi vous avez déjà procédé au versement, veuillez ignorer ce message.\n\nCordialement,\nLe Bureau de la régie de {short_name}\n{association_name}"
  );

  // AI Template Generator states
  const [aiTargetStatus, setAiTargetStatus] = useState<'partiel' | 'retard' | 'both'>('both');
  const [aiTone, setAiTone] = useState<'courtois' | 'ferme' | 'urgent' | 'standard'>('standard');
  const [aiLanguage, setAiLanguage] = useState<'fr' | 'en' | 'bilingual'>('fr');
  const [aiCustomContext, setAiCustomContext] = useState('');
  const [generatingWithAi, setGeneratingWithAi] = useState(false);

  const handleGenerateAiTemplates = async () => {
    setGeneratingWithAi(true);
    try {
      const response = await fetch('/api/apee/generate-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetStatus: aiTargetStatus,
          tone: aiTone,
          language: aiLanguage,
          customContext: aiCustomContext.trim() || undefined,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const { smsTemplate: generatedSms, emailSubject: generatedSubject, emailTemplate: generatedEmail } = resData.data;
        if (generatedSms) setSmsTemplate(generatedSms);
        if (generatedSubject) setEmailSubject(generatedSubject);
        if (generatedEmail) setEmailTemplate(generatedEmail);
        
        triggerToast('success', 'Nouveaux modèles de messages générés avec succès !');
      } else {
        triggerToast('info', 'Une erreur est survenue lors de la génération avec l\'IA.');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('info', 'Erreur réseau : impossible de joindre le service de génération d\'IA.');
    } finally {
      setGeneratingWithAi(false);
    }
  };

  // Focus parent state
  const [selectedParentId, setSelectedParentId] = useState<string>(
    overdueParents.length > 0 ? overdueParents[0].id : ''
  );
  const [previewChannel, setPreviewChannel] = useState<'sms' | 'email'>('sms');

  // Multi selection for bulk actions
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  
  // Mailto sequential wizard states
  const [mailtoWizardActive, setMailtoWizardActive] = useState(false);
  const [mailtoCurrentIndex, setMailtoCurrentIndex] = useState(0);
  const [mailtoWizardParents, setMailtoWizardParents] = useState<ApeeParent[]>([]);
  
  // Simulating states
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkChannel, setBulkChannel] = useState<'sms' | 'email' | null>(null);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkLog, setBulkLog] = useState<string[]>([]);
  const [singleLoadingId, setSingleLoadingId] = useState<string | null>(null);

  // Copied animation trigger
  const [copiedText, setCopiedText] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Select all or helper functions
  const activeFocusParent = overdueParents.find(p => p.id === selectedParentId) || overdueParents[0];

  const filteredParents = overdueParents.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.phone.includes(searchTerm) || 
                          p.students.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = selectedStatus === 'all' ? true : p.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Bulk checkboxes
  const handleToggleSelectParent = (id: string) => {
    if (selectedParentIds.includes(id)) {
      setSelectedParentIds(selectedParentIds.filter(pid => pid !== id));
    } else {
      setSelectedParentIds([...selectedParentIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedParentIds.length === filteredParents.length) {
      setSelectedParentIds([]);
    } else {
      setSelectedParentIds(filteredParents.map(p => p.id));
    }
  };

  // Helper replacing tags using our global utility helper
  const formatText = (text: string, parent?: ApeeParent) => {
    if (!parent) return text;
    const generated = generateApeeReminderMessage(parent, settings, 'sms', { smsTemplate: text });
    if (generated) {
      return generated.message;
    }

    // Fallback if balance is not > 0 but we still want to display preview
    const remaining = Math.max(0, parent.totalDue - parent.totalPaid);
    const kidsList = parent.students.map(s => `${s.name} (${s.classRoom})`).join(', ');
    
    return text
      .replace(/{parent_name}/g, parent.name)
      .replace(/{association_name}/g, settings?.associationName || "Établissement")
      .replace(/{short_name}/g, getApeeShortName(settings))
      .replace(/{school_year}/g, settings?.schoolYear || "")
      .replace(/{student_names}/g, kidsList)
      .replace(/{remaining_amount}/g, remaining.toLocaleString())
      .replace(/{total_due_amount}/g, parent.totalDue.toLocaleString());
  };

  // Trigger copy
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
    triggerToast('success', 'Texte généré copié dans le presse-papiers.');
  };

  const triggerToast = (type: 'success' | 'info', text: string) => {
    setNotificationMsg({ type, text });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // WhatsApp click handler
  const cleanPhoneForWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('237') && cleaned.length === 9) {
      return '237' + cleaned;
    }
    return cleaned;
  };

  const handleWhatsAppTrigger = (parent: ApeeParent, customMsg?: string) => {
    const textToSend = customMsg || formatText(smsTemplate, parent);
    const formattedPhone = cleanPhoneForWhatsApp(parent.phone);
    if (!formattedPhone) {
      alert("Numéro de téléphone invalide.");
      return;
    }
    
    // Log simulated delivery and update database
    updateLastReminded(parent, 'WhatsApp');
    
    // Open in new window
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textToSend)}`;
    window.open(waUrl, '_blank');
    triggerToast('success', `Lien WhatsApp ouvert pour ${parent.name}.`);
  };

  const handleEmailTrigger = (parent: ApeeParent) => {
    if (!parent.email) {
      alert(`Veuillez renseigner une adresse email pour M./Mme ${parent.name} via la fiche parent.`);
      return;
    }
    
    const subject = formatText(emailSubject, parent);
    const body = formatText(emailTemplate, parent);
    
    updateLastReminded(parent, 'Email');
    
    const mailtoUrl = `mailto:${parent.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    triggerToast('success', `Client mail configuré pour envoyer à ${parent.email}.`);
  };

  const updateLastReminded = async (parent: ApeeParent, channel: string) => {
    const timestamp = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} (${channel})`;
    const updatedParent: ApeeParent = {
      ...parent,
      lastReminded: timestamp,
      updatedAt: new Date().toISOString()
    };
    await onSaveParent(updatedParent);
  };

  // Simulated Single direct SMS/Network sending
  const handleSimulateSingleSend = async (parent: ApeeParent, channel: 'sms' | 'email') => {
    setSingleLoadingId(parent.id);
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await updateLastReminded(parent, channel === 'sms' ? 'SMS Direct' : 'Email Direct');
    setSingleLoadingId(null);
    triggerToast('success', `Rappel ${channel.toUpperCase()} simulé et délivré à ${parent.name}.`);
  };

  // Real Backend Bulk Reminder run
  const handleBackendBulkReminderRun = async (channel: 'sms' | 'email') => {
    const idsToProcess = selectedParentIds.length > 0 ? selectedParentIds : filteredParents.map(p => p.id);
    if (idsToProcess.length === 0) {
      alert("Aucun parent sélectionné pour la relance.");
      return;
    }

    if (!confirm(`Voulez-vous lancer la relance groupée (${channel.toUpperCase()}) pour les ${idsToProcess.length} parents sélectionnés sur le serveur de messagerie?`)) {
      return;
    }

    setBulkProcessing(true);
    setBulkChannel(channel);
    setBulkProgress(0);
    setBulkLog([`[Backend API] Transmission de la requête au serveur d'intendance de l'établissement...`]);

    try {
      // Show progress increments
      const interval = setInterval(() => {
        setBulkProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/apee/send-bulk-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentIds: idsToProcess,
          parents: parents,
          emailSubject,
          emailTemplate,
          smsTemplate,
          settings,
          channel
        })
      });

      clearInterval(interval);
      const resData = await response.json();
      
      if (resData.success) {
        setBulkProgress(100);
        setBulkLog(resData.logs || []);
        
        // Save the updated parents in React context
        if (Array.isArray(resData.updatedParents)) {
          for (const updatedParent of resData.updatedParents) {
            await onSaveParent(updatedParent);
          }
        }
        
        setSelectedParentIds([]);
        triggerToast('success', `Relance collective terminée : ${resData.processedCount} messages acheminés avec succès.`);
      } else {
        setBulkLog(prev => [...prev, `❌ [Erreur Serveur] : ${resData.error || 'Erreur indéfinie'}`]);
        triggerToast('info', `Une erreur est survenue sur le serveur d'envois.`);
      }
    } catch (err: any) {
      console.error(err);
      setBulkLog(prev => [...prev, `❌ [Erreur Réseau] : Impossible de se connecter au serveur de messagerie.`]);
      triggerToast('info', `Erreur de connexion avec l'API.`);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Launch sequential Mailto Wizard
  const handleLaunchMailtoWizard = () => {
    const targets = selectedParentIds.length > 0 
      ? parents.filter(p => selectedParentIds.includes(p.id) && (p.status === 'partiel' || p.status === 'retard'))
      : filteredParents;
    
    // Only parents with emails
    const targetParentsWithEmail = targets.filter(p => !!p.email);
    if (targetParentsWithEmail.length === 0) {
      alert("Aucun des parents sélectionnés ne dispose d'une adresse email valide.");
      return;
    }
    
    setMailtoWizardParents(targetParentsWithEmail);
    setMailtoCurrentIndex(0);
    setMailtoWizardActive(true);
    triggerToast('success', `Assistant Mailto démarré pour ${targetParentsWithEmail.length} parents.`);
  };

  // Bulk Reminder Run Simulation
  const handleBulkReminderRun = async (channel: 'sms' | 'email') => {
    const idsToProcess = selectedParentIds.length > 0 ? selectedParentIds : filteredParents.map(p => p.id);
    if (idsToProcess.length === 0) {
      alert("Aucun parent sélectionné pour la relance.");
      return;
    }

    if (!confirm(`Voulez-vous lancer la relance groupée (${channel.toUpperCase()}) pour les ${idsToProcess.length} parents sélectionnés?`)) {
      return;
    }

    setBulkProcessing(true);
    setBulkChannel(channel);
    setBulkProgress(0);
    setBulkLog([`[Démarrage] Initialisation de la file d'envois groupés... (${channel.toUpperCase()})`]);

    let successCount = 0;
    for (let i = 0; i < idsToProcess.length; i++) {
      const pid = idsToProcess[i];
      const p = overdueParents.find(parent => parent.id === pid);
      if (!p) continue;

      setBulkLog(prev => [...prev, `[Relance ${i + 1}/${idsToProcess.length}] Traitement de M./Mme ${p.name}...`]);
      setBulkProgress(Math.round(((i + 1) / idsToProcess.length) * 100));
      
      // Simulate network sending
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 1200 : 800));

      // Check if details are valid
      if (channel === 'email' && !p.email) {
        setBulkLog(prev => [...prev, `⚠️ [Échec] Aucun e-mail renseigné pour ${p.name}. Ignoré.`]);
      } else if (channel === 'sms' && !p.phone) {
        setBulkLog(prev => [...prev, `⚠️ [Échec] Aucun numéro de téléphone disponible pour ${p.name}. Ignoré.`]);
      } else {
        await updateLastReminded(p, channel === 'sms' ? 'Auto SMS' : 'Auto Email');
        successCount++;
        setBulkLog(prev => [...prev, `✅ [Succès] Message envoyé avec succès à ${p.name} (${channel === 'sms' ? p.phone : p.email}).`]);
      }
    }

    setBulkLog(prev => [...prev, `\n🏁 [Terminé] Processus achevé. ${successCount}/${idsToProcess.length} messages délivrés.`]);
    setBulkProcessing(false);
    setSelectedParentIds([]);
    triggerToast('success', `Relance collective achevée: ${successCount} messages simulés.`);
  };

  // Financial statistics
  const totalDueRecoverable = overdueParents.reduce((sum, p) => sum + (p.totalDue - p.totalPaid), 0);

  return (
    <div id="content_apee_reminders" className="space-y-6">
      
      {/* Dynamic Toast Feed */}
      {notificationMsg && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`p-4 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-semibold ${
            notificationMsg.type === 'success' 
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
              : 'bg-indigo-950 text-indigo-300 border-indigo-800'
          }`}>
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{notificationMsg.text}</span>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-150 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            🔔 Rappels Automatiques & Relances
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Générez et distribuez des SMS de relance et de courriels d'urgence vers les parents insolvables ou en retard.
          </p>
        </div>
        <div className="mt-2 md:mt-0 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleBackendBulkReminderRun('email')}
            title="Relancer tous les parents sélectionnés automatiquement en arrière-plan"
            className="text-xs px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <Mail className="h-3.5 w-3.5" /> Envoi Auto Email (Backend)
          </button>
          <button
            type="button"
            onClick={handleLaunchMailtoWizard}
            title="Relancer les parents un à un grâce à votre propre client mail (sans configuration)"
            className="text-xs px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Assistant Mailto Séquentiel
          </button>
          <button
            type="button"
            onClick={() => handleBackendBulkReminderRun('sms')}
            title="Envoyer des notifications de rappel par SMS automatique"
            className="text-xs px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <Smartphone className="h-3.5 w-3.5" /> SMS Collectif (Serveur)
          </button>
        </div>
      </div>

      {/* Overview Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-xl text-red-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parents Non Solvables</h4>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-red-950">{overdueParents.length}</span>
              <span className="text-xs text-red-750 font-medium font-sans">
                ({parents.length > 0 ? ((overdueParents.length / parents.length) * 100).toFixed(0) : 0}% du total)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 border border-amber-200/50 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant à Recouvrer</h4>
            <p className="text-2xl font-bold text-slate-900 font-mono">{totalDueRecoverable.toLocaleString()} <span className="text-xs font-sans font-extrabold">FCFA</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 border border-indigo-200/50 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canaux Intégrés</h4>
            <p className="text-sm font-bold text-slate-800 mt-1">SMS, WhatsApp Web & Mailto Client Link</p>
          </div>
        </div>
      </div>

      {/* Assistant Mailto Séquentiel UI */}
      {mailtoWizardActive && mailtoWizardParents.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-indigo-500/30 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-indigo-500/20 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-indigo-600/85 text-white font-mono text-[9px] font-black tracking-wider">ASSISTANT LOCAL MAILTO</span>
              <h3 className="font-bold text-sm text-indigo-100 flex items-center gap-1.5">
                📥 Envoi Individuel via Client de Messagerie
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setMailtoWizardActive(false)}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-300">
            <span>Parent cible : <strong className="text-white hover:underline cursor-pointer">{mailtoWizardParents[mailtoCurrentIndex].name}</strong></span>
            <span className="font-mono text-indigo-300 font-bold bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-500/15">Parent {mailtoCurrentIndex + 1} sur {mailtoWizardParents.length}</span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-400 h-full transition-all duration-300"
              style={{ width: `${((mailtoCurrentIndex + 1) / mailtoWizardParents.length) * 100}%` }}
            />
          </div>

          {/* Mail info preview box */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <div className="flex gap-2">
              <span className="text-slate-500 font-semibold w-16 text-right">À :</span>
              <span className="text-indigo-300 w-full break-all font-mono font-bold">{mailtoWizardParents[mailtoCurrentIndex].email}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500 font-semibold w-16 text-right">Objet :</span>
              <span className="text-slate-250 w-full font-bold">{formatText(emailSubject, mailtoWizardParents[mailtoCurrentIndex])}</span>
            </div>
            <div className="border-t border-slate-900 pt-2 mt-1">
              <p className="text-slate-500 font-semibold mb-1 text-[10px] uppercase tracking-widest">Message prévisualisé :</p>
              <div className="bg-black/35 border border-slate-900 p-2.5 rounded-lg text-[10.5px] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-line text-slate-300 font-sans">
                {formatText(emailTemplate, mailtoWizardParents[mailtoCurrentIndex])}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1">
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                disabled={mailtoCurrentIndex === 0}
                onClick={() => setMailtoCurrentIndex(prev => Math.max(0, prev - 1))}
                className="px-2.5 py-1.5 border border-slate-700/80 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition font-medium"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={mailtoCurrentIndex === mailtoWizardParents.length - 1}
                onClick={() => setMailtoCurrentIndex(prev => Math.min(mailtoWizardParents.length - 1, prev + 1))}
                className="px-2.5 py-1.5 border border-slate-700/80 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition font-medium"
              >
                Suivant
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleEmailTrigger(mailtoWizardParents[mailtoCurrentIndex])}
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-505 text-white font-extrabold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
              >
                <Mail className="h-4 w-4 shrink-0" /> 1. Ouvrir Client Messagerie
              </button>
              <button
                type="button"
                onClick={async () => {
                  await updateLastReminded(mailtoWizardParents[mailtoCurrentIndex], 'Mailto Assisté');
                  if (mailtoCurrentIndex < mailtoWizardParents.length - 1) {
                    setMailtoCurrentIndex(prev => prev + 1);
                  } else {
                    setMailtoWizardActive(false);
                    triggerToast('success', 'Félicitations, toutes les fiches de relance mailto sélectionnées ont été traitées !');
                  }
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-555 text-white font-extrabold rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-md transition animate-pulse"
              >
                2. Suivant ➡️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Progress Panel */}
      {bulkProcessing && (
        <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl border border-slate-800 space-y-3 font-mono">
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-2 animate-pulse text-indigo-400 font-bold">
              <RefreshCw className="h-4 w-4 animate-spin" /> RELANCE COLLECTIVE EN COURS...
            </span>
            <span className="text-emerald-400 font-bold">{bulkProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${bulkProgress}%` }}
            />
          </div>
          <div className="bg-black/40 border border-slate-800 p-3 rounded-lg text-[10px] h-32 overflow-y-auto space-y-1">
            {bulkLog.map((log, idx) => {
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const parts = log.split(urlRegex);
              return (
                <div key={idx} className="font-mono leading-relaxed">
                  {parts.map((part, pidx) => {
                    if (part.match(urlRegex)) {
                      return (
                        <a 
                          key={pidx} 
                          href={part} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-indigo-400 hover:text-indigo-300 font-bold underline break-all"
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

      {/* Main split work layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Side: Overdue list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-150 rounded-2xl p-4 space-y-4.5 shadow-2xs">
            
            {/* Search Filter Head */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Chercher parent, élève ou n°..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500"
                />
              </div>

              <div className="flex gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedStatus('all')}
                  className={`px-3 py-1 rounded-lg font-bold border transition ${
                    selectedStatus === 'all' 
                      ? 'bg-slate-100 text-slate-805 border-slate-300' 
                      : 'text-gray-500 border-transparent hover:bg-slate-50'
                  }`}
                >
                  Tous ({overdueParents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('partiel')}
                  className={`px-3 py-1 rounded-lg font-bold border transition ${
                    selectedStatus === 'partiel' 
                      ? 'bg-amber-100 text-amber-805 border-amber-300' 
                      : 'text-gray-500 border-transparent hover:bg-slate-50'
                  }`}
                >
                  Versement Partiel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('retard')}
                  className={`px-3 py-1 rounded-lg font-bold border transition ${
                    selectedStatus === 'retard' 
                      ? 'bg-red-100 text-red-805 border-red-300' 
                      : 'text-gray-500 border-transparent hover:bg-slate-50'
                  }`}
                >
                  Retard Total
                </button>
              </div>
            </div>

            {/* List with selection */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[10px] font-bold text-gray-400">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredParents.length > 0 && selectedParentIds.length === filteredParents.length}
                    onChange={handleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Sélectionner ({selectedParentIds.length})</span>
                </div>
                <span>Reste Dû</span>
              </div>

              {filteredParents.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  Aucun parent en retard correspondant.
                </div>
              ) : (
                filteredParents.map((parent) => {
                  const isFocused = parent.id === selectedParentId;
                  const isChecked = selectedParentIds.includes(parent.id);
                  const remaining = parent.totalDue - parent.totalPaid;
                  
                  return (
                    <div 
                      key={parent.id}
                      onClick={() => setSelectedParentId(parent.id)}
                      className={`p-3 rounded-xl border transition duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                        isFocused 
                          ? 'bg-indigo-50/55 border-indigo-200' 
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectParent(parent.id);
                          }}
                          className="p-1 hover:bg-slate-100 rounded-lg shrink-0"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Swallowed, handled by div click
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{parent.name}</p>
                          <p className="text-[10px] text-gray-500 flex items-center gap-1 font-mono truncate">
                            <span>{parent.phone}</span>
                            {parent.email && <span className="text-indigo-400">• {parent.email}</span>}
                          </p>
                          {parent.lastReminded ? (
                            <p className="text-[9px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5" /> Relancé le: {parent.lastReminded}
                            </p>
                          ) : (
                            <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                              Pas encore relancé
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-red-650 font-mono">
                          {remaining.toLocaleString()}
                        </span>
                        <p className={`text-[8px] font-black uppercase mt-0.5 px-1 py-0.5 rounded text-center ${
                          parent.status === 'soldé' 
                            ? 'bg-emerald-500 text-white' 
                            : (parent.status === 'partiel' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white')
                        }`}>
                          {parent.status}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom tools selection */}
            {selectedParentIds.length > 0 && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex items-center justify-between gap-2.5">
                <span className="text-[10px] font-bold text-slate-700">{selectedParentIds.length} parents sélectionnés</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleBackendBulkReminderRun('email')}
                    title="Envoi automatique collectif par email via APIs du serveur"
                    className="text-[9px] px-2 py-1 bg-slate-800 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-slate-900 transition"
                  >
                    🚀 Email Auto
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchMailtoWizard}
                    title="Lancer l'assistant pour composer les emails dans votre application de messagerie locale"
                    className="text-[9px] px-2 py-1 bg-indigo-600 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-indigo-700 transition"
                  >
                    📥 Client Mailto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBackendBulkReminderRun('sms')}
                    title="Relancer collectivement par SMS via APIs du serveur"
                    className="text-[9px] px-2 py-1 bg-white text-slate-800 border border-slate-300 font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-slate-100 transition"
                  >
                    📱 SMS (Serveur)
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Side: Preview & Template Settings */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Templates Configurator Accordion */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Settings className="h-4 w-4 text-indigo-500" /> Modèles de Relances Universels
            </h3>

            {/* AI Generator Panel */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-4 space-y-3 shadow-3xs text-left">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <span className="p-1 bg-indigo-200 text-indigo-700 rounded-lg">✨</span>
                  <span>Générateur de Modèles de Rappels IA (Gemini 3.5)</span>
                </h4>
                <span className="text-[9px] bg-indigo-200/50 text-indigo-800 px-2 py-0.5 rounded-full font-bold">Actif</span>
              </div>
              <p className="text-[10px] text-indigo-900/80 leading-relaxed font-medium">
                Générez de nouveaux modèles de rappels (SMS & Email) adaptés aux parents en retard. L'IA injectera automatiquement les bons jetons variables pour un publipostage sans faute.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Statut Ciblé</label>
                  <select
                    value={aiTargetStatus}
                    onChange={(e: any) => setAiTargetStatus(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 font-bold text-slate-700 focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="both">Tous (« retard » et « partiel »)</option>
                    <option value="partiel">Versement Partiel (partiel)</option>
                    <option value="retard">Retard Total (retard)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Ton du Message</label>
                  <select
                    value={aiTone}
                    onChange={(e: any) => setAiTone(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 font-bold text-slate-700 focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="standard">Standard d'Intendance</option>
                    <option value="courtois">Courtois & Chaleureux</option>
                    <option value="ferme">Diplomatique & Ferme</option>
                    <option value="urgent">Impératif & Urgent (Mise en demeure)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Langue</label>
                  <select
                    value={aiLanguage}
                    onChange={(e: any) => setAiLanguage(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 font-bold text-slate-700 focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="fr">Français</option>
                    <option value="en">Anglais (English)</option>
                    <option value="bilingual">Bilingue (Français/Anglais)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Consignes complémentaires de l'IA (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex : insister sur l'approche des examens de fin d'année, proposer des paiements par tranche..."
                  value={aiCustomContext}
                  onChange={(e) => setAiCustomContext(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:outline-indigo-500 bg-white"
                />
              </div>

              <button
                type="button"
                disabled={generatingWithAi}
                onClick={handleGenerateAiTemplates}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {generatingWithAi ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin text-white" />
                    <span>Création du modèle via l'IA...</span>
                  </>
                ) : (
                  <>
                    <span>✨ Écrire ces modèles avec l'IA</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Template SMS / WhatsApp
                  </label>
                  <span className="text-[9px] text-indigo-500 font-semibold">160 car./SMS</span>
                </div>
                <textarea
                  rows={4}
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  className="w-full text-xs font-sans p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                  placeholder="Texte du SMS de relance..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Objet Email
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-xl focus:outline-indigo-500"
                />

                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 block mt-2">
                  <Mail className="h-3 w-3" /> Corps du Message de l'Email
                </label>
                <textarea
                  rows={3}
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  className="w-full text-xs font-sans p-2 border border-slate-200 rounded-xl focus:outline-indigo-500"
                  placeholder="Texte de l'Email de relance..."
                />
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-[10px] text-amber-900 leading-relaxed font-sans">
              <strong>Variables dynamiques supportées :</strong> Use the tags 
              <span className="bg-white border border-amber-200 px-1 py-0.2 mx-1 font-mono">{`{parent_name}`}</span>, 
              <span className="bg-white border border-amber-200 px-1 py-0.2 mx-1 font-mono">{`{student_names}`}</span>, 
              <span className="bg-white border border-amber-200 px-1 py-0.2 mx-1 font-mono">{`{remaining_amount}`}</span>, 
              <span className="bg-white border border-amber-200 px-1 py-0.2 mx-1 font-mono">{`{total_due_amount}`}</span>, 
              <span className="bg-white border border-amber-200 px-1 py-0.2 mx-1 font-mono">{`{school_year}`}</span>, or 
              <span className="bg-white border border-amber-200 px-1 py-0.2 mx-1 font-mono">{`{association_name}`}</span> to inject automated parent data cleanly.
            </div>
          </div>

          {/* Selected Parent Interactive simulation card */}
          {activeFocusParent ? (
            <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
              
              <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase">
                  📡 Simulation d'Envoi Direct : {activeFocusParent.name}
                </h3>
                <span className="text-[10px] text-gray-500 font-mono font-bold">Reste: {(activeFocusParent.totalDue - activeFocusParent.totalPaid).toLocaleString()} FCFA</span>
              </div>

              {/* Channel Selector inside card */}
              <div className="flex border border-slate-200 rounded-xl p-0.5 max-w-xs overflow-hidden bg-slate-50 shadow-3xs">
                <button
                  onClick={() => setPreviewChannel('sms')}
                  className={`flex-1 text-xs py-1.5 px-3 rounded-lg font-bold flex justify-center items-center gap-1 transition ${
                    previewChannel === 'sms' ? 'bg-white shadow-2xs text-indigo-600' : 'text-slate-650'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" /> SMS / WhatsApp
                </button>
                <button
                  onClick={() => setPreviewChannel('email')}
                  className={`flex-1 text-xs py-1.5 px-3 rounded-lg font-bold flex justify-center items-center gap-1 transition ${
                    previewChannel === 'email' ? 'bg-white shadow-2xs text-indigo-600' : 'text-slate-650'
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" /> Email Rappel
                </button>
              </div>

              {/* Render dynamic mockup depending on channel choice */}
              {previewChannel === 'sms' ? (
                /* SMS simulator preview block */
                <div className="relative mx-auto max-w-sm rounded-[32px] border-8 border-slate-800 bg-slate-900 p-3 shadow-lg aspect-video h-[230px] flex flex-col justify-between overflow-hidden text-white font-sans select-none">
                  {/* Smartphone top notches */}
                  <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono px-1">
                    <span>12:00 PM</span>
                    <div className="w-12 h-2.5 bg-black rounded-b-md mx-auto" />
                    <span className="flex items-center gap-0.5">LTE 🔋</span>
                  </div>

                  {/* Header profile contact */}
                  <div className="bg-slate-850/80 p-1.5 rounded-lg border-b border-slate-800 flex items-center justify-center gap-1 md:gap-2 mt-1">
                    <div className="h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center text-[7px] font-bold text-white uppercase">
                      {activeFocusParent.name.slice(0, 1)}
                    </div>
                    <span className="text-[9px] font-bold truncate text-slate-200 max-w-[130px]">{activeFocusParent.name}</span>
                  </div>

                  {/* The interactive message bubble */}
                  <div className="flex-1 overflow-y-auto py-2 space-y-1 pr-1 custom-scrollbar">
                    <div className="bg-slate-800 text-[10px] px-2.5 py-1.5 rounded-2xl rounded-tl-sm max-w-[85%] self-start border border-slate-700/60 leading-tight">
                      <p className="text-white whitespace-pre-line break-words text-[9.5px]">
                        {formatText(smsTemplate, activeFocusParent)}
                      </p>
                    </div>
                  </div>

                  <div className="text-[7px] text-center text-slate-400 border-t border-slate-850 pt-1.5 font-mono">
                    Simulation SMS CES Ekali 1 / Applet Integration
                  </div>
                </div>
              ) : (
                /* Email Card simulation */
                <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 space-y-3 font-sans relative overflow-hidden select-none">
                  <div className="border-b border-slate-200 pb-2 space-y-1">
                    <div className="text-[10px] flex items-center gap-1.5">
                      <span className="font-bold text-slate-500">De:</span>
                      <span className="text-slate-850">APEE CES d'Ekali 1 Mfou (reminders@ces-ekali.edu.cm)</span>
                    </div>
                    <div className="text-[10px] flex items-center gap-1.5">
                      <span className="font-bold text-slate-500">Pour:</span>
                      <span className="text-indigo-650 font-semibold">{activeFocusParent.email || '(Aucun email enregistré pour ce parent)'}</span>
                    </div>
                    <div className="text-[10px] flex items-center gap-1.5 mt-1">
                      <span className="font-bold text-slate-500">Objet:</span>
                      <span className="text-slate-800 font-bold">{formatText(emailSubject, activeFocusParent)}</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-100 text-[10.5px] text-slate-800 whitespace-pre-line leading-relaxed max-h-[160px] overflow-y-auto">
                    {formatText(emailTemplate, activeFocusParent)}
                  </div>
                </div>
              )}

              {/* Actions launcher */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => handleCopyText(formatText(previewChannel === 'sms' ? smsTemplate : emailTemplate, activeFocusParent))}
                  className="text-xs px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer transition shadow-3xs"
                >
                  {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-505" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedText ? 'Copié !' : 'Copier'}
                </button>

                {previewChannel === 'sms' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleWhatsAppTrigger(activeFocusParent)}
                      className="text-xs px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-3xs transition"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      Relance WhatsApp Web
                    </button>
                    <button
                      type="button"
                      disabled={singleLoadingId === activeFocusParent.id}
                      onClick={() => handleSimulateSingleSend(activeFocusParent, 'sms')}
                      className="text-xs px-3.5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-3xs transition disabled:opacity-50"
                    >
                      {singleLoadingId === activeFocusParent.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Délivrer SMS Réseau (Simulé)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!activeFocusParent.email}
                      onClick={() => handleEmailTrigger(activeFocusParent)}
                      className="text-xs px-3.5 py-2 bg-slate-800 hover:bg-slate-905 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-3xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ouvrir Client Mail (Outlook/Gmail)
                    </button>
                    <button
                      type="button"
                      disabled={!activeFocusParent.email || singleLoadingId === activeFocusParent.id}
                      onClick={() => handleSimulateSingleSend(activeFocusParent, 'email')}
                      className="text-xs px-3.5 py-2 bg-indigo-600 hover:bg-indigo-755 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-3xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {singleLoadingId === activeFocusParent.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Délivrer E-mail (Simulé)
                    </button>
                  </>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 font-sans">
              Tous les parents ont réglé leur cotisation {getApeeShortName(settings)} ! Aucune relance n'est nécessaire pour le moment.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
