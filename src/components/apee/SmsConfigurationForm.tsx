import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  HelpCircle, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ExternalLink, 
  Smartphone,
  Shield,
  KeyRound,
  RefreshCw,
  Send,
  MessageSquare,
  Activity,
  FileText,
  Sparkles,
  Copy,
  Check,
  Wand2,
  Calendar,
  User,
  DollarSign,
  School,
  Users,
  X,
  RotateCcw
} from 'lucide-react';
import { ApeeSettings, ApeeSmsConfig } from '../../types';
import { useLanguage } from '../../utils/TranslationContext';
import { 
  analyzeSms, 
  optimizeToGsm7, 
  simulateSmsMessage, 
  validateSmsTemplate, 
  SMS_DYNAMIC_VARIABLES, 
  SMS_PRESET_TEMPLATES 
} from '../../utils/smsEncoding';
import { getAuthHeader } from '../../firebase';

interface SmsConfigurationFormProps {
  settings: ApeeSettings;
  onSaveSettings: (settings: ApeeSettings) => Promise<boolean> | void;
}

export default function SmsConfigurationForm({ 
  settings, 
  onSaveSettings 
}: SmsConfigurationFormProps) {
  const { t, language } = useLanguage();

  // Load existing configuration or default
  const smsConfig = settings.smsConfig || {};
  
  const [smsEnabled, setSmsEnabled] = useState(smsConfig.smsEnabled ?? false);
  const [provider, setProvider] = useState<'campay' | 'twilio' | 'orange' | 'generic'>(smsConfig.provider || 'campay');
  const [smsGatewayUrl, setSmsGatewayUrl] = useState(smsConfig.smsGatewayUrl || '');
  const [smsApiKey, setSmsApiKey] = useState(smsConfig.smsApiKey || '');
  const [smsSenderId, setSmsSenderId] = useState(smsConfig.smsSenderId || 'APEE');
  const [smsUsername, setSmsUsername] = useState(smsConfig.smsUsername || '');
  const [smsPassword, setSmsPassword] = useState(smsConfig.smsPassword || '');

  // Custom SMS template with dynamic variables and GSM-160 validation
  const [customSmsTemplate, setCustomSmsTemplate] = useState<string>(
    settings.customSmsTemplate || 
    smsConfig.customTemplate || 
    SMS_PRESET_TEMPLATES[0].template
  );
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Editable test dataset for previewing the final rendered SMS
  const defaultTestData = {
    parentName: 'M. Martin BENE',
    studentName: 'Paul',
    amountDue: `25 000 ${settings.currency || 'FCFA'}`,
    dueDate: '15/10/2026',
    paymentDate: '28/09/2026',
    schoolName: settings.shortName || settings.associationName || 'CES Ekali 1',
    studentNames: 'Paul (4e)',
    currentDate: new Date().toLocaleDateString('fr-FR'),
    schoolYear: settings.schoolYear || '2025/2026'
  };

  const [previewTestData, setPreviewTestData] = useState(defaultTestData);

  // Hide/Show secrets
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Test SMS states
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testMessage, setTestMessage] = useState("APEE CES D'EKALI 1 : Test de la passerelle de communication SMS réussi !");
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; logs: string[] } | null>(null);

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  // Sync state if settings change externally
  useEffect(() => {
    if (settings.smsConfig) {
      const cfg = settings.smsConfig;
      setSmsEnabled(cfg.smsEnabled ?? false);
      setProvider(cfg.provider || 'campay');
      setSmsGatewayUrl(cfg.smsGatewayUrl || '');
      setSmsApiKey(cfg.smsApiKey || '');
      setSmsSenderId(cfg.smsSenderId || 'APEE');
      setSmsUsername(cfg.smsUsername || '');
      setSmsPassword(cfg.smsPassword || '');
      if (cfg.customTemplate) {
        setCustomSmsTemplate(cfg.customTemplate);
      }
    }
    if (settings.customSmsTemplate) {
      setCustomSmsTemplate(settings.customSmsTemplate);
    }
    // Set default test phone number to Director's or Fin Manager's phone if available
    if (settings.finManagerPhone) {
      setTestPhoneNumber(settings.finManagerPhone);
    } else if (settings.directorPhone) {
      setTestPhoneNumber(settings.directorPhone);
    }
  }, [settings]);

  const schoolName = settings.shortName || settings.associationName || 'CES Ekali 1';

  // Live simulation of dynamic variables with standard sample data
  const simulation = simulateSmsMessage(customSmsTemplate, {
    '{ETABLISSEMENT}': schoolName,
    '{association_name}': schoolName,
    '{short_name}': schoolName,
    '{NOM_ELEVE}': 'Paul',
    '{student_name}': 'Paul',
    '{nom_eleve}': 'Paul',
    '{eleve}': 'Paul',
    '{MONTANT_DU}': `25 000 ${settings.currency || 'FCFA'}`,
    '{DATE_ECHEANCE}': '15/10/2026',
    '{due_date}': '15/10/2026',
    '{date_echeance}': '15/10/2026',
    '{DATE_PAIEMENT}': '28/09/2026',
    '{payment_date}': '28/09/2026',
    '{date_paiement}': '28/09/2026'
  });

  const templateValidation = validateSmsTemplate(customSmsTemplate, {
    '{ETABLISSEMENT}': schoolName,
    '{association_name}': schoolName,
    '{short_name}': schoolName,
    '{NOM_ELEVE}': 'Paul',
    '{student_name}': 'Paul',
    '{nom_eleve}': 'Paul',
    '{eleve}': 'Paul',
    '{MONTANT_DU}': `25 000 ${settings.currency || 'FCFA'}`,
    '{DATE_ECHEANCE}': '15/10/2026',
    '{due_date}': '15/10/2026',
    '{date_echeance}': '15/10/2026',
    '{DATE_PAIEMENT}': '28/09/2026',
    '{payment_date}': '28/09/2026',
    '{date_paiement}': '28/09/2026'
  });

  // Dedicated preview simulation using custom test data inputs
  const previewSimulation = simulateSmsMessage(customSmsTemplate, {
    '{NOM_PARENT}': previewTestData.parentName,
    '{parent_name}': previewTestData.parentName,
    '{nom_parent}': previewTestData.parentName,
    '{NOM_ELEVE}': previewTestData.studentName || 'Paul',
    '{student_name}': previewTestData.studentName || 'Paul',
    '{nom_eleve}': previewTestData.studentName || 'Paul',
    '{eleve}': previewTestData.studentName || 'Paul',
    '{MONTANT_DU}': previewTestData.amountDue,
    '{remaining_amount}': previewTestData.amountDue,
    '{montant_du}': previewTestData.amountDue,
    '{DATE_ECHEANCE}': previewTestData.dueDate,
    '{due_date}': previewTestData.dueDate,
    '{date_echeance}': previewTestData.dueDate,
    '{DATE_PAIEMENT}': previewTestData.paymentDate,
    '{payment_date}': previewTestData.paymentDate,
    '{date_paiement}': previewTestData.paymentDate,
    '{ETABLISSEMENT}': previewTestData.schoolName,
    '{association_name}': previewTestData.schoolName,
    '{short_name}': previewTestData.schoolName,
    '{etablissement}': previewTestData.schoolName,
    '{ELEVES}': previewTestData.studentNames,
    '{student_names}': previewTestData.studentNames,
    '{eleves}': previewTestData.studentNames,
    '{DATE_JOUR}': previewTestData.currentDate,
    '{current_date}': previewTestData.currentDate,
    '{date_jour}': previewTestData.currentDate,
    '{ANNEE_SCOLAIRE}': previewTestData.schoolYear,
    '{school_year}': previewTestData.schoolYear,
    '{annee_scolaire}': previewTestData.schoolYear
  });

  // Dynamic variable insertion handler (inserts at cursor position)
  const handleInsertVariable = (tag: string) => {
    const textarea = templateTextareaRef.current;
    if (!textarea) {
      setCustomSmsTemplate(prev => prev ? `${prev} ${tag}` : tag);
      return;
    }

    const start = textarea.selectionStart ?? customSmsTemplate.length;
    const end = textarea.selectionEnd ?? customSmsTemplate.length;
    const current = customSmsTemplate;
    const next = current.slice(0, start) + tag + current.slice(end);
    setCustomSmsTemplate(next);

    setTimeout(() => {
      textarea.focus();
      const cursor = start + tag.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 20);
  };

  const handleLoadPreset = (tpl: string) => {
    setCustomSmsTemplate(tpl);
  };

  const handleOptimizeGsm = () => {
    setCustomSmsTemplate(prev => optimizeToGsm7(prev));
  };

  const handleCopyPreviewText = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);
    }
  };

  const handleUseAsTestMessage = (text: string) => {
    setTestMessage(text);
    const terminalEl = document.getElementById('sms_test_terminal_card');
    if (terminalEl) {
      terminalEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    setGeneralError('');

    // Custom SMS template validation (must comply with GSM limit of 160 characters)
    if (customSmsTemplate && customSmsTemplate.trim()) {
      const val = validateSmsTemplate(customSmsTemplate, {
        '{ETABLISSEMENT}': schoolName,
        '{MONTANT_DU}': `25 000 ${settings.currency || 'FCFA'}`,
        '{DATE_ECHEANCE}': '15/10/2026',
        '{DATE_PAIEMENT}': '28/09/2026'
      });

      if (!val.isValid) {
        newErrors.customSmsTemplate = val.error || (language === 'en' 
          ? 'Template exceeds the single GSM SMS limit (160 chars).'
          : 'Le modèle dépasse la limite de 160 caractères GSM.');
      }
    }

    if (!smsEnabled) {
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    if (provider === 'generic' && !smsGatewayUrl.trim()) {
      newErrors.smsGatewayUrl = language === 'en'
        ? 'Gateway URL is required for generic provider.'
        : "L'URL de la passerelle est requise pour le fournisseur générique.";
    }

    if (!smsApiKey.trim() && provider !== 'orange' && provider !== 'twilio') {
      newErrors.smsApiKey = language === 'en'
        ? 'API Key / Auth Token is required.'
        : "La clé API ou le jeton d'authentification est requis.";
    }

    if (!smsSenderId.trim() && provider !== 'twilio') {
      newErrors.smsSenderId = language === 'en'
        ? 'Sender ID is required.'
        : "L'identifiant d'expéditeur (Sender ID) est requis.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setGeneralError(language === 'en'
        ? 'Please fix the validation errors (e.g. GSM 160 character limit) before saving.'
        : "Veuillez corriger les erreurs de validation (notamment la limite de 160 caractères GSM) avant d'enregistrer."
      );
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updatedSmsConfig: ApeeSmsConfig = {
        smsEnabled,
        provider,
        smsGatewayUrl: smsGatewayUrl.trim(),
        smsApiKey: smsApiKey.trim(),
        smsSenderId: smsSenderId.trim(),
        smsUsername: smsUsername.trim(),
        smsPassword: smsPassword.trim(),
        customTemplate: customSmsTemplate.trim()
      };

      const updatedSettings: ApeeSettings = {
        ...settings,
        customSmsTemplate: customSmsTemplate.trim(),
        smsConfig: updatedSmsConfig
      };

      const result = await onSaveSettings(updatedSettings);
      
      if (result !== false) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setGeneralError(language === 'en'
          ? 'Failed to save settings. Please try again.'
          : "Échec de l'enregistrement des paramètres. Veuillez réessayer."
        );
      }
    } catch (err: any) {
      console.error('Error saving SMS config:', err);
      setGeneralError(err.message || 'Error occurred while saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger test SMS
  const handleSendTestSms = async () => {
    if (!testPhoneNumber.trim()) {
      alert(language === 'en' ? 'Please enter a test phone number.' : 'Veuillez saisir un numéro de téléphone de test.');
      return;
    }

    setIsTestingSms(true);
    setTestResult(null);

    try {
      const authHeader = await getAuthHeader();
      const response = await fetch('/api/sms/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          phoneNumber: testPhoneNumber.trim(),
          message: testMessage.trim(),
          config: {
            smsEnabled,
            provider,
            smsGatewayUrl: smsGatewayUrl.trim(),
            smsApiKey: smsApiKey.trim(),
            smsSenderId: smsSenderId.trim(),
            smsUsername: smsUsername.trim(),
            smsPassword: smsPassword.trim()
          }
        })
      });

      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.message,
        logs: data.logs || []
      });
    } catch (err: any) {
      console.error('Error triggering test SMS:', err);
      setTestResult({
        success: false,
        message: err.message || 'Erreur réseau lors de la communication avec la passerelle.',
        logs: ['[Erreur Système] Échec de la requête vers /api/sms/send-test', err.message]
      });
    } finally {
      setIsTestingSms(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 max-w-3xl mx-auto shadow-sm" id="sms_config_form_card">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 select-none">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider">
            <Smartphone className="h-3 w-3" /> Communication & SMS
          </span>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" /> Passerelle d'Envoi SMS / WhatsApp
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
            Configurez vos identifiants d'API de messagerie pour diffuser automatiquement les alertes de paiement, reçus de transaction et relances de cotisations APEE directement sur les téléphones des parents.
          </p>
        </div>
      </div>

      {/* Toggle Integration */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-150 select-none">
        <div className="space-y-0.5 max-w-[80%]">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
            Activer les notifications SMS automatiques
          </label>
          <p className="text-[11px] text-slate-500 leading-tight">
            Si activé, le système tentera d'envoyer un SMS automatique aux parents après chaque paiement validé ou relance groupée.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={smsEnabled} 
            onChange={(e) => {
              setSmsEnabled(e.target.checked);
              if (!e.target.checked) {
                setErrors({});
                setGeneralError('');
              }
            }} 
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <AnimatePresence mode="wait">
          {generalError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              className="p-4 bg-red-50 border border-red-150 rounded-2xl text-xs text-red-800 flex items-start gap-2.5 shadow-3xs"
            >
              <AlertTriangle className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Erreur de configuration :</span>
                <p>{generalError}</p>
              </div>
            </motion.div>
          )}

          {saveSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl text-xs text-emerald-800 flex items-start gap-2.5 shadow-3xs"
            >
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Configuration de messagerie sauvegardée !</span>
                <p>Vos clés de sécurité d'envoi SMS ont été enregistrées avec succès.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`space-y-4 transition duration-250 ${smsEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none select-none'}`}>
          
          {/* Global Twilio Fallback Notice */}
          {provider === 'twilio' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-indigo-50/70 border border-indigo-150 rounded-2xl text-xs text-indigo-900 flex items-start gap-3 shadow-3xs"
            >
              <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-700 block">Service SMS Global Actif (API Twilio)</span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Le portail ENT dispose d'une **clé API Twilio globale préconfigurée** au niveau du serveur. 
                  Vous n'avez pas besoin de renseigner vos propres identifiants (Account SID, Auth Token ou numéro expéditeur) ci-dessous. Ils seront automatiquement substitués par le compte par défaut de la plateforme.
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-700">Canal Twilio global prêt et opérationnel</span>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Provider Selection */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Fournisseur de service SMS <span className="text-red-500">*</span>
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 font-bold text-slate-700"
              >
                <option value="campay">Campay SMS Gateway</option>
                <option value="twilio">Twilio SMS (API)</option>
                <option value="orange">Orange SMS Web Service</option>
                <option value="generic">Passerelle HTTP Générique (GET/POST)</option>
              </select>
            </div>
 
            {/* Sender ID */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {provider === 'twilio' 
                  ? "Numéro expéditeur Twilio (Phone Number / FROM)" 
                  : "Identifiant d'expéditeur (Sender ID)"} 
                {provider === 'twilio' ? ' (Optionnel - Twilio Global)' : <span className="text-red-500">*</span>}
              </label>
              <input 
                type="text"
                value={smsSenderId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (provider === 'twilio') {
                    setSmsSenderId(val.substring(0, 34));
                  } else {
                    setSmsSenderId(val.substring(0, 11).toUpperCase());
                  }
                }}
                placeholder={provider === 'twilio' ? "Ex: +18559091234 ou MGxxxx..." : "Ex: APEE"}
                maxLength={provider === 'twilio' ? 34 : 11}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-xl focus:outline-indigo-500 font-mono font-bold text-slate-800 ${errors.smsSenderId ? 'border-red-400' : 'border-slate-200'}`}
              />
              <p className="text-[9px] text-slate-400 leading-relaxed mt-1">
                {provider === 'twilio' 
                  ? "⚠️ Ce champ désigne le NUMÉRO DE TÉLÉPHONE d'envoi certifié de votre compte Twilio (avec l'indicatif, ex: +18559091234) ou l'ID de service de messagerie (ex: MGxxxx). Ce n'est PAS une clé d'API."
                  : "Le nom d'expéditeur qui s'affichera sur le téléphone des parents (Max. 11 caractères)."}
              </p>
              {errors.smsSenderId && <p className="text-[10px] text-red-500 font-semibold">{errors.smsSenderId}</p>}
            </div>
 
          </div>

          {/* Conditional Gateway URL (Generic only) */}
          {provider === 'generic' && (
            <div className="space-y-1 animate-fade-in">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                URL d'envoi de la Passerelle SMS <span className="text-red-500">*</span>
              </label>
              <input 
                type="url"
                value={smsGatewayUrl}
                onChange={(e) => setSmsGatewayUrl(e.target.value)}
                placeholder="https://api.sms-provider.com/v1/send?to={to}&msg={msg}"
                className={`w-full px-3 py-2 text-xs bg-white border rounded-xl focus:outline-indigo-500 font-mono text-slate-800 ${errors.smsGatewayUrl ? 'border-red-400' : 'border-slate-200'}`}
              />
              <p className="text-[9px] text-slate-400 mt-0.5">Use placeholders <code className="bg-slate-100 px-1 py-0.2 rounded font-bold font-mono">{`{to}`}</code> and <code className="bg-slate-100 px-1 py-0.2 rounded font-bold font-mono">{`{msg}`}</code> to specify URL endpoints dynamically.</p>
              {errors.smsGatewayUrl && <p className="text-[10px] text-red-500 font-semibold">{errors.smsGatewayUrl}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* API Key / Token */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {provider === 'twilio' 
                  ? "Twilio Auth Token (Token d'accès)" 
                  : "Clé d'API / Jeton d'autorisation (Token)"} 
                {provider === 'twilio' ? ' (Optionnel - Twilio Global)' : <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  value={smsApiKey}
                  onChange={(e) => setSmsApiKey(e.target.value)}
                  placeholder={provider === 'twilio' ? "Auth Token secret Twilio..." : "Clé d'authentification ou jeton de passerelle..."}
                  className={`w-full pl-3 pr-16 py-2 text-xs bg-white border rounded-xl focus:outline-indigo-500 font-mono text-slate-800 font-bold ${errors.smsApiKey ? 'border-red-400' : 'border-slate-200'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1 text-[9px] text-gray-400 hover:text-slate-800 p-1 uppercase font-bold"
                >
                  {showApiKey ? "Cacher" : "Afficher"}
                </button>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                {provider === 'twilio' 
                  ? "Le jeton d'authentification secret (Auth Token) fourni par Twilio pour signer les requêtes."
                  : "Clé secrète ou Token requis pour s'authentifier auprès de la passerelle de messagerie."}
              </p>
              {errors.smsApiKey && <p className="text-[10px] text-red-500 font-semibold">{errors.smsApiKey}</p>}
            </div>

            {/* Account / Username (Optional) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {provider === 'twilio' 
                  ? "Twilio Account SID (Identifiant AC...)" 
                  : "Identifiant de compte / Nom d'utilisateur (Optionnel)"}
              </label>
              <input 
                type="text"
                value={smsUsername}
                onChange={(e) => setSmsUsername(e.target.value)}
                placeholder={provider === 'twilio' ? "Ex: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "Ex: ACxxxxxx ou login d'accès..."}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 font-mono text-slate-800"
              />
              <p className="text-[9px] text-slate-400 mt-1">
                {provider === 'twilio' 
                  ? "L'identifiant de compte Twilio principal (Account SID) qui commence par 'AC'."
                  : "Identifiant d'accès ou login s'il est requis par le fournisseur."}
              </p>
            </div>

          </div>

          {/* Password (Optional, mostly for Twilio Auth token or generic basic auth) */}
          {provider !== 'orange' && provider !== 'twilio' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Mot de passe de compte / Token secret (Optionnel)
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={smsPassword}
                  onChange={(e) => setSmsPassword(e.target.value)}
                  placeholder="Mot de passe secret associé si requis..."
                  className="w-full pl-3 pr-16 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 font-mono text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1 text-[9px] text-gray-400 hover:text-slate-800 p-1 uppercase font-bold"
                >
                  {showPassword ? "Cacher" : "Afficher"}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* SECTION: Custom SMS Template with Dynamic Variables & GSM-160 Validation */}
        {/* ========================================================================= */}
        <div className="pt-4 border-t border-slate-200/80 space-y-4" id="custom_sms_template_card">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-150">
                  <FileText className="h-4 w-4" />
                </span>
                <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  {language === 'en' ? 'Custom SMS Message Template' : 'Modèle de Message SMS Personnalisé'}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {language === 'en'
                  ? 'Define the notification message template with dynamic variables. The message must strictly respect the 160 GSM character limit for a single standard SMS.'
                  : 'Définissez le modèle de notification SMS avec variables dynamiques. Le texte doit respecter rigoureusement la norme de 160 caractères GSM pour un SMS unique.'}
              </p>
            </div>

            {/* Preview Button & GSM Status Pill Badge */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {/* Interactive Preview Button with Test Data */}
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                title={language === 'en' ? 'Preview final rendered message with test data' : 'Prévisualiser le message final avec des données de test'}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200/90 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 text-indigo-600" />
                <span>{language === 'en' ? 'Preview with Test Data' : 'Prévisualiser le rendu'}</span>
              </button>

              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-tight border ${
                !simulation.simulatedAnalysis.isGsm7
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : simulation.simulatedAnalysis.gsmLength <= 140
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : simulation.simulatedAnalysis.gsmLength <= 160
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {!simulation.simulatedAnalysis.isGsm7 ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <span>UCS-2 Unicode (70 car. max)</span>
                  </>
                ) : simulation.simulatedAnalysis.gsmLength <= 160 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>GSM-7 (160 car. max)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 text-rose-600" />
                    <span>Dépassement ({simulation.simulatedAnalysis.segments} SMS)</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Presets Quick-Load Buttons */}
          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-150 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                {language === 'en' ? 'Pre-validated GSM-160 Presets :' : 'Modèles types pré-validés (100% conformes GSM-160) :'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Cliquez pour appliquer</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {SMS_PRESET_TEMPLATES.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleLoadPreset(preset.template)}
                  title={language === 'en' ? preset.descriptionEn : preset.descriptionFr}
                  className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 hover:text-indigo-700 transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
                >
                  <Wand2 className="h-3 w-3 text-indigo-500" />
                  <span>{language === 'en' ? preset.nameEn : preset.nameFr}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Variables Toolbar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {language === 'en' 
                  ? 'Dynamic Variables (Click tag to insert at cursor position) :' 
                  : 'Variables Dynamiques (Cliquez pour insérer au curseur) :'}
              </label>
              <span className="text-[10px] text-indigo-600 font-bold">
                {simulation.usedVariables.length} variable(s) active(s)
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SMS_DYNAMIC_VARIABLES.map(v => {
                const isUsed = customSmsTemplate.includes(v.tag);
                return (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertVariable(v.tag)}
                    title={`${language === 'en' ? v.descriptionEn : v.descriptionFr} — Exemple : "${v.sampleValue}"`}
                    className={`group px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-bold transition flex items-center gap-1 border shadow-3xs cursor-pointer ${
                      isUsed 
                        ? 'bg-indigo-600 text-white border-indigo-700' 
                        : 'bg-white hover:bg-indigo-50/80 text-indigo-700 hover:text-indigo-900 border-indigo-200/80'
                    }`}
                  >
                    <span>+</span>
                    <span>{v.tag}</span>
                    <span className={`text-[9px] font-sans font-medium px-1 rounded ${
                      isUsed ? 'bg-indigo-700/60 text-indigo-100' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100/70 group-hover:text-indigo-800'
                    }`}>
                      {language === 'en' ? v.labelEn : v.labelFr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template Textarea */}
          <div className="space-y-1">
            <div className="relative">
              <textarea
                ref={templateTextareaRef}
                rows={3}
                value={customSmsTemplate}
                onChange={(e) => setCustomSmsTemplate(e.target.value)}
                placeholder="Rappel {NOM_PARENT}: Solde APEE de {MONTANT_DU} a regler avant le {DATE_ECHEANCE}. Merci. {ETABLISSEMENT}."
                className={`w-full p-3 text-xs bg-white border rounded-2xl focus:outline-indigo-500 font-sans text-slate-800 leading-relaxed shadow-inner ${
                  !simulation.simulatedAnalysis.isGsm7 || simulation.simulatedAnalysis.gsmLength > 160
                    ? 'border-rose-300 focus:ring-rose-400'
                    : simulation.simulatedAnalysis.gsmLength > 140
                      ? 'border-amber-300 focus:ring-amber-400'
                      : 'border-slate-200 focus:ring-indigo-400'
                }`}
              />
            </div>
            {errors.customSmsTemplate && (
              <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {errors.customSmsTemplate}
              </p>
            )}
          </div>

          {/* GSM Length Metric Gauge & Progress Bar */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-500">
                  {language === 'en' ? 'Template raw length :' : 'Longueur brute modèle :'} <strong className="text-slate-800 font-mono">{customSmsTemplate.length}</strong> car.
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-medium text-slate-500">
                  {language === 'en' ? 'Estimated real SMS length :' : 'Longueur estimée après injection :'} 
                  <strong className={`font-mono font-bold ml-1 text-xs ${
                    simulation.simulatedAnalysis.gsmLength > 160 ? 'text-rose-600' : simulation.simulatedAnalysis.gsmLength > 140 ? 'text-amber-600' : 'text-emerald-700'
                  }`}>
                    {simulation.simulatedAnalysis.gsmLength} / 160 car. GSM
                  </strong>
                </span>
              </div>

              <div className="text-[10.5px] font-mono font-bold">
                {simulation.simulatedAnalysis.gsmLength <= 160 ? (
                  <span className="text-emerald-700">
                    +{160 - simulation.simulatedAnalysis.gsmLength} {language === 'en' ? 'chars remaining' : 'caractères de marge'}
                  </span>
                ) : (
                  <span className="text-rose-600">
                    +{simulation.simulatedAnalysis.gsmLength - 160} {language === 'en' ? 'chars over limit' : 'caractères en trop'}
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  !simulation.simulatedAnalysis.isGsm7 || simulation.simulatedAnalysis.gsmLength > 160
                    ? 'bg-rose-500'
                    : simulation.simulatedAnalysis.gsmLength > 140
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (simulation.simulatedAnalysis.gsmLength / 160) * 100)}%` }}
              />
            </div>

            {/* Diagnostic Message & Quick Fix */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {!simulation.simulatedAnalysis.isGsm7 ? (
                <div className="text-[11px] text-amber-800 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>
                    {language === 'en' 
                      ? `Non-GSM characters detected: ${simulation.simulatedAnalysis.nonGsmCharacters.join(', ')}. Forces UCS-2 (70 chars limit).`
                      : `Caractères hors GSM-7 : ${simulation.simulatedAnalysis.nonGsmCharacters.join(', ')}. Force UCS-2 (limite 70 car.).`}
                  </span>
                </div>
              ) : simulation.simulatedAnalysis.gsmLength > 160 ? (
                <div className="text-[11px] text-rose-800 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                  <span>
                    {language === 'en'
                      ? `Length exceeds 160 chars (${simulation.simulatedAnalysis.segments} SMS will be billed). Shorten text to maintain 1 SMS.`
                      : `Dépassement de 160 car. (${simulation.simulatedAnalysis.segments} SMS seront facturés). Raccourcissez le texte pour conserver 1 seul SMS.`}
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {language === 'en'
                      ? '100% GSM compliant. Guaranteed 1 single SMS billed per parent.'
                      : '100% conforme GSM-7. Garanti 1 seul SMS facturé par parent.'}
                  </span>
                </div>
              )}

              {/* 1-Click GSM Optimization Action Button */}
              {(!simulation.simulatedAnalysis.isGsm7 || simulation.simulatedAnalysis.gsmLength > 160) && (
                <button
                  type="button"
                  onClick={handleOptimizeGsm}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10.5px] font-bold rounded-lg transition flex items-center gap-1 self-start sm:self-auto cursor-pointer shadow-3xs shrink-0"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{language === 'en' ? 'Optimize for GSM-7 (160 chars)' : 'Optimiser pour GSM-7 (160 car.)'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Mobile SMS Simulation Box */}
          <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-2.5 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
              <span className="font-mono uppercase font-bold tracking-wider flex items-center gap-1.5 text-indigo-300">
                <Smartphone className="h-3.5 w-3.5 text-indigo-400" />
                {language === 'en' ? 'Live Mobile SMS Simulation (Parent Phone)' : 'Aperçu Réel sur le Téléphone du Parent'}
              </span>
              <span className="font-mono text-slate-400">
                De : <strong className="text-white">{smsSenderId || 'APEE'}</strong>
              </span>
            </div>

            {/* Bubble Message */}
            <div className="bg-slate-800/90 text-slate-100 p-3.5 rounded-2xl rounded-tl-xs border border-slate-700/80 max-w-lg text-xs leading-relaxed font-sans shadow-inner">
              <p className="whitespace-pre-wrap">{simulation.simulatedText || "(Message vide)"}</p>
              <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-700/50">
                <span>{language === 'en' ? 'Delivered via Gateway' : 'Délivré via Passerelle GSM'}</span>
                <span>{simulation.simulatedAnalysis.gsmLength} car. • 12:45 ✓✓</span>
              </div>
            </div>

            {/* Actions on simulated preview */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
              <div className="text-[10px] text-slate-400 font-sans">
                {language === 'en' 
                  ? 'Simulated with: NOM_PARENT = "M. Martin BENE", NOM_ELEVE = "Paul", MONTANT_DU = "25 000 FCFA", DATE_ECHEANCE = "15/10/2026"'
                  : 'Injecté avec : NOM_PARENT = "M. Martin BENE", NOM_ELEVE = "Paul", MONTANT_DU = "25 000 FCFA", DATE_ECHEANCE = "15/10/2026"'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyPreviewText(simulation.simulatedText)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedPreview ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedPreview ? (language === 'en' ? 'Copied!' : 'Copié !') : (language === 'en' ? 'Copy Text' : 'Copier')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUseAsTestMessage(simulation.simulatedText)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Send className="h-3 w-3 text-indigo-200" />
                  <span>{language === 'en' ? 'Inject into Test Terminal' : 'Tester dans le Banc d\'Essai'}</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 select-none">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-emerald-300" />
                <span>Sauvegarder les paramètres SMS</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* SECTION: Live Gateway Testing Terminal */}
      <div className="border-t border-slate-100 pt-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" /> Banc d'Essai d'Envoi SMS de Test
          </h3>
          <p className="text-xs text-slate-500">
            Envoyez un SMS immédiat vers votre propre numéro pour valider les paramètres de connexion et d'authentification auprès de la passerelle de messagerie.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-4 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Test Phone Number */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Numéro de Téléphone de Test</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input 
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="Ex: +237 677 12 34 56"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-emerald-500 font-mono text-slate-800"
                />
              </div>
            </div>

            {/* Test Message */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Message de Test</label>
              <input 
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Texte du message..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-emerald-500 text-slate-800"
              />
            </div>

          </div>

          <button
            type="button"
            disabled={isTestingSms}
            onClick={handleSendTestSms}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
          >
            {isTestingSms ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                <span>Interrogation Passerelle...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 text-emerald-400" />
                <span>Envoyer le SMS de Test</span>
              </>
            )}
          </button>

          {/* Test Terminal Logs Output */}
          <AnimatePresence>
            {testResult && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 mt-4 animate-fade-in"
              >
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-semibold ${testResult.success ? 'bg-emerald-50 border-emerald-150 text-emerald-800' : 'bg-red-50 border-red-150 text-red-800'}`}>
                  {testResult.success ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4.5 w-4.5 text-red-600 mt-0.5 shrink-0" />}
                  <div>
                    <p className="font-bold">{testResult.success ? "Envoi réussi !" : "Échec de l'envoi !"}</p>
                    <p className="text-[11px] mt-0.5 font-medium">{testResult.message}</p>
                  </div>
                </div>

                {/* Gateway Execution Logs */}
                <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 font-mono text-[10px] leading-relaxed shadow-inner space-y-1 border border-slate-800">
                  <p className="text-[9px] font-black uppercase text-slate-500 border-b border-slate-800 pb-1.5 mb-2 select-none tracking-wider">⚡ Console de Diagnostic de la Passerelle SMS</p>
                  {testResult.logs.map((log, idx) => {
                    let colorClass = 'text-slate-300';
                    if (log.startsWith('❌') || log.includes('Error') || log.includes('ERR') || log.includes('fail')) colorClass = 'text-red-400 font-bold';
                    else if (log.startsWith('✔') || log.includes('succès') || log.includes('200 OK') || log.includes('success')) colorClass = 'text-emerald-400';
                    else if (log.startsWith('ℹ') || log.startsWith('[Info]')) colorClass = 'text-sky-400';
                    
                    return (
                      <div key={idx} className={`flex gap-1.5 ${colorClass}`}>
                        <span className="text-slate-600 select-none">{`[${idx + 1}]`}</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Real-time SMS Final Render Preview with Test Data Customization   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPreviewModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
            <div 
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-scale-in my-auto max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <Eye className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm md:text-base font-bold text-slate-900">
                      {language === 'en' ? 'SMS Preview: Final Render' : 'Prévisualisation : Rendu Final du SMS'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {language === 'en'
                      ? 'Simulate the message exactly as it will be received by parents, replacing all dynamic tags with test data.'
                      : 'Simulation exacte du message tel qu\'il sera reçu par les parents après substitution des balises dynamiques.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* 1. Final Rendered Mobile SMS Bubble */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
                      {language === 'en' ? 'Final Rendered Output (Simulated Parent Device)' : 'Rendu Final (Écran du Smartphone du Parent)'}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      !previewSimulation.simulatedAnalysis.isGsm7
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : previewSimulation.simulatedAnalysis.gsmLength <= 140
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : previewSimulation.simulatedAnalysis.gsmLength <= 160
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {previewSimulation.simulatedAnalysis.gsmLength} / 160 car. GSM • {previewSimulation.simulatedAnalysis.encoding}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950 text-slate-100 rounded-2xl space-y-3 shadow-inner border border-slate-800">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                      <span className="font-mono">De : <strong className="text-white">{smsSenderId || 'APEE'}</strong></span>
                      <span className="font-mono">Destinataire : <strong className="text-white">{previewTestData.parentName}</strong></span>
                    </div>

                    <div className="bg-slate-800 text-slate-100 p-3.5 rounded-2xl rounded-tl-xs border border-slate-700/80 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {previewSimulation.simulatedText || "(Message vide)"}
                      <div className="mt-2.5 flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1.5 border-t border-slate-700/50">
                        <span>Passerelle SMS / Twilio</span>
                        <span>{previewSimulation.simulatedAnalysis.gsmLength} car. • 12:45 ✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. GSM Status Evaluation Card */}
                <div className={`p-4 rounded-2xl border space-y-2 text-xs ${
                  !previewSimulation.simulatedAnalysis.isGsm7
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : previewSimulation.simulatedAnalysis.gsmLength <= 160
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      {!previewSimulation.simulatedAnalysis.isGsm7 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : previewSimulation.simulatedAnalysis.gsmLength <= 160 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      )}
                      <span>
                        {!previewSimulation.simulatedAnalysis.isGsm7
                          ? 'Encodage UCS-2 Unicode forcé'
                          : previewSimulation.simulatedAnalysis.gsmLength <= 160
                            ? 'Parfaitement conforme GSM-160 (1 SMS facturé)'
                            : `Dépassement de quota (${previewSimulation.simulatedAnalysis.segments} SMS facturés)`}
                      </span>
                    </span>
                    <span className="font-mono text-xs">
                      {previewSimulation.simulatedAnalysis.gsmLength <= 160
                        ? `Marge restante : ${160 - previewSimulation.simulatedAnalysis.gsmLength} car.`
                        : `Excédent : ${previewSimulation.simulatedAnalysis.gsmLength - 160} car.`}
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-600">
                    {!previewSimulation.simulatedAnalysis.isGsm7
                      ? `Le message contient des caractères spéciaux (${previewSimulation.simulatedAnalysis.nonGsmCharacters.join(', ')}). La limite maximale par SMS est de 70 caractères au lieu de 160.`
                      : previewSimulation.simulatedAnalysis.gsmLength <= 160
                        ? `Ce modèle s'envoie en un seul segment GSM-7 standard sans surcoût opérateur ni risque de coupure de texte pour les parents.`
                        : `Attention : La longueur actuelle dépasse 160 caractères. Le SMS sera scindé en ${previewSimulation.simulatedAnalysis.segments} morceaux par l'opérateur mobile.`}
                  </p>
                </div>

                {/* 3. Interactive Test Data Controls (Allows manager to test varying scenarios) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      {language === 'en' ? 'Customize Test Values to simulate variations :' : 'Personnaliser les données de test de simulation :'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewTestData(defaultTestData)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>{language === 'en' ? 'Reset defaults' : 'Réinitialiser'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Parent Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 font-mono">{'{NOM_PARENT}'}</label>
                      <input
                        type="text"
                        value={previewTestData.parentName}
                        onChange={(e) => setPreviewTestData(prev => ({ ...prev, parentName: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                      />
                    </div>

                    {/* Student Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 font-mono">{'{NOM_ELEVE}'}</label>
                      <input
                        type="text"
                        value={previewTestData.studentName}
                        onChange={(e) => setPreviewTestData(prev => ({ ...prev, studentName: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                        placeholder="Ex: Paul"
                      />
                    </div>

                    {/* Amount Due */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 font-mono">{'{MONTANT_DU}'}</label>
                      <input
                        type="text"
                        value={previewTestData.amountDue}
                        onChange={(e) => setPreviewTestData(prev => ({ ...prev, amountDue: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                      />
                    </div>

                    {/* Payment Date */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 font-mono">{'{DATE_PAIEMENT}'}</label>
                      <input
                        type="text"
                        value={previewTestData.paymentDate}
                        onChange={(e) => setPreviewTestData(prev => ({ ...prev, paymentDate: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                      />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 font-mono">{'{DATE_ECHEANCE}'}</label>
                      <input
                        type="text"
                        value={previewTestData.dueDate}
                        onChange={(e) => setPreviewTestData(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                      />
                    </div>

                    {/* School Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 font-mono">{'{ETABLISSEMENT}'}</label>
                      <input
                        type="text"
                        value={previewTestData.schoolName}
                        onChange={(e) => setPreviewTestData(prev => ({ ...prev, schoolName: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                      />
                    </div>

                    {/* Student Names */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 font-mono">{'{ELEVES}'}</label>
                      <input
                        type="text"
                        value={previewTestData.studentNames}
                        onChange={(e) => setPreviewTestData(prev => ({ ...prev, studentNames: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 p-4 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyPreviewText(previewSimulation.simulatedText)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
                >
                  {copiedPreview ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedPreview ? (language === 'en' ? 'Copied!' : 'Copié !') : (language === 'en' ? 'Copy Rendered Text' : 'Copier le texte')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleUseAsTestMessage(previewSimulation.simulatedText);
                      setIsPreviewModalOpen(false);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 text-indigo-200" />
                    <span>{language === 'en' ? 'Use in Test Terminal' : 'Injecter dans le banc d\'essai'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    {language === 'en' ? 'Close' : 'Fermer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
