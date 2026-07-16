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
  CreditCard,
  Shield,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { ApeeSettings, ApeePaymentConfig } from '../types';
import { useLanguage } from '../utils/TranslationContext';

interface PaymentConfigurationFormProps {
  settings: ApeeSettings;
  onSaveSettings: (settings: ApeeSettings) => Promise<boolean> | void;
}

export default function PaymentConfigurationForm({ 
  settings, 
  onSaveSettings 
}: PaymentConfigurationFormProps) {
  const { t, language } = useLanguage();

  // Load existing credentials or default
  const paymentConfig = settings.paymentConfig || {};
  
  const [campayEnabled, setCampayEnabled] = useState(paymentConfig.campayEnabled ?? false);
  const [campayAppId, setCampayAppId] = useState(paymentConfig.campayAppId || '');
  const [campayAppUsername, setCampayAppUsername] = useState(paymentConfig.campayAppUsername || '');
  const [campayAppPassword, setCampayAppPassword] = useState(paymentConfig.campayAppPassword || '');
  const [campayToken, setCampayToken] = useState(paymentConfig.campayToken || '');
  const [campayWebhookKey, setCampayWebhookKey] = useState(paymentConfig.campayWebhookKey || '');

  // Hide/Show secrets
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showWebhookKey, setShowWebhookKey] = useState(false);

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  // Sync state if settings change externally
  useEffect(() => {
    if (settings.paymentConfig) {
      const cfg = settings.paymentConfig;
      setCampayEnabled(cfg.campayEnabled ?? false);
      setCampayAppId(cfg.campayAppId || '');
      setCampayAppUsername(cfg.campayAppUsername || '');
      setCampayAppPassword(cfg.campayAppPassword || '');
      setCampayToken(cfg.campayToken || '');
      setCampayWebhookKey(cfg.campayWebhookKey || '');
    }
  }, [settings]);

  // Handle Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    setGeneralError('');

    // If Campay is disabled, we allow saving empty or partial fields
    if (!campayEnabled) {
      setErrors({});
      return true;
    }

    // 1. App ID validation
    if (!campayAppId.trim()) {
      newErrors.campayAppId = language === 'en' 
        ? 'Campay App ID is required when integration is enabled.' 
        : "L'identifiant d'application (App ID) Campay est requis lorsque l'intégration est activée.";
    } else if (campayAppId.trim().length < 3) {
      newErrors.campayAppId = language === 'en'
        ? 'App ID must be at least 3 characters long.'
        : "L'identifiant d'application doit comporter au moins 3 caractères.";
    }

    // 2. App Username validation
    if (!campayAppUsername.trim()) {
      newErrors.campayAppUsername = language === 'en'
        ? 'Campay App Username is required.'
        : "Le nom d'utilisateur de l'application (App Username) Campay est requis.";
    } else if (/\s/.test(campayAppUsername)) {
      newErrors.campayAppUsername = language === 'en'
        ? 'App Username cannot contain spaces.'
        : "Le nom d'utilisateur ne doit pas contenir d'espaces.";
    }

    // 3. App Password validation
    if (!campayAppPassword.trim()) {
      newErrors.campayAppPassword = language === 'en'
        ? 'Campay App Password is required.'
        : "Le mot de passe de l'application (App Password) Campay est requis.";
    } else if (campayAppPassword.trim().length < 6) {
      newErrors.campayAppPassword = language === 'en'
        ? 'Password must be at least 6 characters long.'
        : 'Le mot de passe doit contenir au moins 6 caractères.';
    } else if (/\s/.test(campayAppPassword)) {
      newErrors.campayAppPassword = language === 'en'
        ? 'Password cannot contain spaces.'
        : "Le mot de passe ne doit pas contenir d'espaces.";
    }

    // 4. Token validation
    if (!campayToken.trim()) {
      newErrors.campayToken = language === 'en'
        ? 'API Authorization Token is required.'
        : "Le jeton d'autorisation de l'API (Token) est requis.";
    } else if (campayToken.trim().length < 15) {
      newErrors.campayToken = language === 'en'
        ? 'Token must be at least 15 characters long.'
        : "Le jeton d'autorisation API (Token) est trop court (min. 15 caractères).";
    } else if (/\s/.test(campayToken)) {
      newErrors.campayToken = language === 'en'
        ? 'API Token cannot contain spaces.'
        : "Le jeton API ne doit pas contenir d'espaces.";
    }

    // 5. Webhook Key validation
    if (!campayWebhookKey.trim()) {
      newErrors.campayWebhookKey = language === 'en'
        ? 'Campay Webhook Signature Key is required.'
        : "La clé de signature de webhook Campay (Webhook Key) est requise.";
    } else if (campayWebhookKey.trim().length < 8) {
      newErrors.campayWebhookKey = language === 'en'
        ? 'Webhook key must be at least 8 characters long.'
        : 'La clé de webhook doit contenir au moins 8 caractères.';
    } else if (/\s/.test(campayWebhookKey)) {
      newErrors.campayWebhookKey = language === 'en'
        ? 'Webhook key cannot contain spaces.'
        : "La clé de webhook ne doit pas contenir d'espaces.";
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
      // Merge into existing paymentConfig to prevent losing Stripe, MTN, etc.
      const updatedPaymentConfig: ApeePaymentConfig = {
        ...(settings.paymentConfig || {}),
        campayEnabled,
        campayAppId: campayAppId.trim(),
        campayAppUsername: campayAppUsername.trim(),
        campayAppPassword: campayAppPassword.trim(),
        campayToken: campayToken.trim(),
        campayWebhookKey: campayWebhookKey.trim(),
      };

      const updatedSettings: ApeeSettings = {
        ...settings,
        paymentConfig: updatedPaymentConfig
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
      console.error('Error saving Campay credentials:', err);
      setGeneralError(err.message || 'Error occurred while saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 max-w-3xl mx-auto shadow-sm" id="campay_payment_config_form">
      {/* Form Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 select-none">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider">
            <Shield className="h-3 w-3" /> Sécurité des Paiements
          </span>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-600" /> Intégration Campay Mobile Money
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
            Configurez vos clés d'API Campay officielles pour permettre aux parents de s'acquitter de leurs frais (cotisations APEE, tranches de scolarité) par Orange Money, MTN MoMo et Express Union.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <a
            href="https://campay.net/dashboard"
            target="_blank"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          >
            Console Campay <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Toggle Campay Access */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-150 select-none">
        <div className="space-y-0.5 max-w-[80%]">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
            Activer la passerelle Campay
          </label>
          <p className="text-[11px] text-slate-500 leading-tight">
            Si activé, Campay sera disponible comme méthode de paiement en ligne lors de la facturation des parents.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={campayEnabled} 
            onChange={(e) => {
              setCampayEnabled(e.target.checked);
              if (!e.target.checked) {
                // Clear validation errors when turning off
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
        {/* Banner/Notification Alerts */}
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
                <span className="font-bold">Configuration enregistrée avec succès !</span>
                <p>Vos paramètres d'API Campay cryptés ont été sauvegardés de manière sécurisée dans la base de données Pasma-sys.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inputs section, disabled or semi-transparent if disabled */}
        <div className={`space-y-4 transition duration-250 ${campayEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none select-none'}`}>
          <div className="p-4 bg-amber-50/40 border border-amber-150/60 rounded-2xl text-[11px] text-amber-900 leading-normal flex items-start gap-2.5">
            <Info className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold uppercase tracking-wide">🔐 Recommandation de Sécurité Importante</span>
              <p>
                Vos identifiants d'API et clés de jetons (tokens) sont cryptés côté serveur. Ne partagez jamais ces informations. Nous vous recommandons de copier les clés directement depuis le panneau d'administration Campay (Paramètres de l'application) pour éviter les fautes de frappe.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. App ID */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-extrabold text-slate-650 uppercase tracking-wide flex items-center gap-1 select-none">
                Campay App ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campayAppId}
                onChange={(e) => setCampayAppId(e.target.value)}
                placeholder="Ex: cpy_app_xxxxxxxxxx"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono transition focus:bg-white focus:outline-indigo-500 text-slate-800 ${
                  errors.campayAppId ? 'border-red-300 focus:outline-red-500 bg-red-50/10' : 'border-slate-200'
                }`}
              />
              {errors.campayAppId && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {errors.campayAppId}
                </p>
              )}
            </div>

            {/* 2. App Username */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-extrabold text-slate-650 uppercase tracking-wide flex items-center gap-1 select-none">
                Campay App Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campayAppUsername}
                onChange={(e) => setCampayAppUsername(e.target.value)}
                placeholder="Ex: mon_username_api"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono transition focus:bg-white focus:outline-indigo-500 text-slate-800 ${
                  errors.campayAppUsername ? 'border-red-300 focus:outline-red-500 bg-red-50/10' : 'border-slate-200'
                }`}
              />
              {errors.campayAppUsername && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {errors.campayAppUsername}
                </p>
              )}
            </div>
          </div>

          {/* 3. App Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold text-slate-650 uppercase tracking-wide flex items-center gap-1 select-none">
                Campay App Password <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] font-black text-indigo-650 hover:underline cursor-pointer"
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={campayAppPassword}
                onChange={(e) => setCampayAppPassword(e.target.value)}
                placeholder="Saisir le mot de passe d'application Campay"
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono transition focus:bg-white focus:outline-indigo-500 text-slate-800 font-bold ${
                  errors.campayAppPassword ? 'border-red-300 focus:outline-red-500 bg-red-50/10' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.campayAppPassword && (
              <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {errors.campayAppPassword}
              </p>
            )}
          </div>

          {/* 4. API Token */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold text-slate-650 uppercase tracking-wide flex items-center gap-1 select-none">
                Campay API Token <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[10px] font-black text-indigo-650 hover:underline cursor-pointer"
              >
                {showToken ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="h-3.5 w-3.5" />
              </div>
              <input
                type={showToken ? 'text' : 'password'}
                value={campayToken}
                onChange={(e) => setCampayToken(e.target.value)}
                placeholder="Ex: Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono transition focus:bg-white focus:outline-indigo-500 text-slate-800 font-bold ${
                  errors.campayToken ? 'border-red-300 focus:outline-red-500 bg-red-50/10' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.campayToken && (
              <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {errors.campayToken}
              </p>
            )}
            <p className="text-[9.5px] text-slate-400 leading-tight">
              Généralement généré via la console Campay sous l'onglet "Clés API" ou obtenu via l'authentification API. Doit commencer par <strong>"Token "</strong> ou correspondre au JWT brut.
            </p>
          </div>

          {/* 5. Webhook Key */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold text-slate-650 uppercase tracking-wide flex items-center gap-1 select-none">
                Campay Webhook Signature Key <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowWebhookKey(!showWebhookKey)}
                className="text-[10px] font-black text-indigo-650 hover:underline cursor-pointer"
              >
                {showWebhookKey ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <input
                type={showWebhookKey ? 'text' : 'password'}
                value={campayWebhookKey}
                onChange={(e) => setCampayWebhookKey(e.target.value)}
                placeholder="Entrez votre clé de signature de webhook Campay"
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono transition focus:bg-white focus:outline-indigo-500 text-slate-800 font-bold ${
                  errors.campayWebhookKey ? 'border-red-300 focus:outline-red-500 bg-red-50/10' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.campayWebhookKey && (
              <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {errors.campayWebhookKey}
              </p>
            )}
            <p className="text-[9.5px] text-slate-400 leading-tight">
              Cette clé secrète permet à l'application de valider que les notifications de statut de paiement reçues proviennent bien de Campay.
            </p>
          </div>
        </div>

        {/* Submit Actions Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 select-none">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Enregistrer les Identifiants
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
