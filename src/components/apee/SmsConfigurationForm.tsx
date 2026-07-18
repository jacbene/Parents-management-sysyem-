import React, { useState, useEffect } from 'react';
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
  Activity
} from 'lucide-react';
import { ApeeSettings, ApeeSmsConfig } from '../../types';
import { useLanguage } from '../../utils/TranslationContext';

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
    }
    // Set default test phone number to Director's or Fin Manager's phone if available
    if (settings.finManagerPhone) {
      setTestPhoneNumber(settings.finManagerPhone);
    } else if (settings.directorPhone) {
      setTestPhoneNumber(settings.directorPhone);
    }
  }, [settings]);

  // Handle Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    setGeneralError('');

    if (!smsEnabled) {
      setErrors({});
      return true;
    }

    if (provider === 'generic' && !smsGatewayUrl.trim()) {
      newErrors.smsGatewayUrl = language === 'en'
        ? 'Gateway URL is required for generic provider.'
        : "L'URL de la passerelle est requise pour le fournisseur générique.";
    }

    if (!smsApiKey.trim() && provider !== 'orange') {
      newErrors.smsApiKey = language === 'en'
        ? 'API Key / Auth Token is required.'
        : "La clé API ou le jeton d'authentification est requis.";
    }

    if (!smsSenderId.trim()) {
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
        ? 'Please fix the errors in the form before saving.'
        : "Veuillez corriger les erreurs dans le formulaire avant de l'enregistrer."
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
        smsPassword: smsPassword.trim()
      };

      const updatedSettings: ApeeSettings = {
        ...settings,
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
      const response = await fetch('/api/sms/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
                Identifiant d'expéditeur (Sender ID) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                value={smsSenderId}
                onChange={(e) => setSmsSenderId(e.target.value.substring(0, 11).toUpperCase())}
                placeholder="Ex: APEE"
                maxLength={11}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-xl focus:outline-indigo-500 font-mono font-bold text-slate-800 ${errors.smsSenderId ? 'border-red-400' : 'border-slate-200'}`}
              />
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
                Clé d'API / Jeton d'autorisation (Token) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  value={smsApiKey}
                  onChange={(e) => setSmsApiKey(e.target.value)}
                  placeholder="Clé d'authentification ou jeton de passerelle..."
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
              {errors.smsApiKey && <p className="text-[10px] text-red-500 font-semibold">{errors.smsApiKey}</p>}
            </div>

            {/* Account / Username (Optional) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Identifiant de compte / Nom d'utilisateur (Optionnel)
              </label>
              <input 
                type="text"
                value={smsUsername}
                onChange={(e) => setSmsUsername(e.target.value)}
                placeholder="Ex: ACxxxxxx ou login d'accès..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-indigo-500 font-mono text-slate-800"
              />
            </div>

          </div>

          {/* Password (Optional, mostly for Twilio Auth token or generic basic auth) */}
          {provider !== 'orange' && (
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

    </div>
  );
}
