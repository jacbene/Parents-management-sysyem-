import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Eye, 
  EyeOff, 
  Lock, 
  Smartphone, 
  CreditCard, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { ApeeSettings } from '../types';
import { useLanguage } from '../utils/TranslationContext';

interface PaymentConfigurationFormProps {
  settings: ApeeSettings;
  onSaveSettings: (settings: ApeeSettings) => Promise<boolean> | void;
}

export default function PaymentConfigurationForm({
  settings,
  onSaveSettings
}: PaymentConfigurationFormProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  // Toggle statuses
  const [cardEnabled, setCardEnabled] = useState(settings.paymentConfig?.cardEnabled ?? false);
  const [mtnEnabled, setMtnEnabled] = useState(settings.paymentConfig?.mtnEnabled ?? false);
  const [orangeEnabled, setOrangeEnabled] = useState(settings.paymentConfig?.orangeEnabled ?? false);
  const [waveEnabled, setWaveEnabled] = useState(settings.paymentConfig?.waveEnabled ?? false);
  const [campayEnabled, setCampayEnabled] = useState(settings.paymentConfig?.campayEnabled ?? true);

  // Stripe credentials
  const [stripePublicKey, setStripePublicKey] = useState(settings.paymentConfig?.stripePublicKey || '');
  const [stripeSecretKey, setStripeSecretKey] = useState(settings.paymentConfig?.stripeSecretKey || '');

  // MTN credentials
  const [mtnPhoneNumber, setMtnPhoneNumber] = useState(settings.paymentConfig?.mtnPhoneNumber || '');
  const [mtnMerchantName, setMtnMerchantName] = useState(settings.paymentConfig?.mtnMerchantName || '');
  const [mtnClientId, setMtnClientId] = useState(settings.paymentConfig?.mtnClientId || '');
  const [mtnClientSecret, setMtnClientSecret] = useState(settings.paymentConfig?.mtnClientSecret || '');

  // Orange credentials
  const [orangePhoneNumber, setOrangePhoneNumber] = useState(settings.paymentConfig?.orangePhoneNumber || '');
  const [orangeMerchantName, setOrangeMerchantName] = useState(settings.paymentConfig?.orangeMerchantName || '');
  const [orangeMerchantKey, setOrangeMerchantKey] = useState(settings.paymentConfig?.orangeMerchantKey || '');
  const [orangeClientId, setOrangeClientId] = useState(settings.paymentConfig?.orangeClientId || '');
  const [orangeClientSecret, setOrangeClientSecret] = useState(settings.paymentConfig?.orangeClientSecret || '');

  // Wave credentials
  const [wavePhoneNumber, setWavePhoneNumber] = useState(settings.paymentConfig?.wavePhoneNumber || '');
  const [waveMerchantName, setWaveMerchantName] = useState(settings.paymentConfig?.waveMerchantName || '');
  const [waveApiKey, setWaveApiKey] = useState(settings.paymentConfig?.waveApiKey || '');

  // Campay credentials (with provided values as default fallbacks)
  const [campayAppId, setCampayAppId] = useState(settings.paymentConfig?.campayAppId || 'UirmJUAg75JHLjtXjp4J-Xi7jG8jQpMSldrgxuZKTbno0ehaU3lRayZmw05YlPxnB_VShTZHWj56-ImpaWdxuw');
  const [campayAppUsername, setCampayAppUsername] = useState(settings.paymentConfig?.campayAppUsername || 'Uahox6805UvasolxjrndxKMC6EoWPxWwzJRQtH-aDLRXmj17zyAdHbLqyX2wy9GkxC3ZtvHpZ4s945hfHfeU-w');
  const [campayAppPassword, setCampayAppPassword] = useState(settings.paymentConfig?.campayAppPassword || 'jGJNkAYDVvzNEutZ-LUrPKdnRJj7QlzPyFabJ_VefmS8FiafzGsAhy7rFUV5g1q0rRkgTift_XFJd_V85UiYEw');
  const [campayToken, setCampayToken] = useState(settings.paymentConfig?.campayToken || 'ee362ee2adb13fac3e434e0579241626670c9a2e');
  const [campayWebhookKey, setCampayWebhookKey] = useState(settings.paymentConfig?.campayWebhookKey || 'LpEvD_J1lf67b6QOJajBKmZHbeXL42GP0g2ItxEZBONyOnM8DCz6h3ktROPSM75sio2znlrRBEeoPu4JwtObpw');

  // Visibility toggles
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showMtnSecret, setShowMtnSecret] = useState(false);
  const [showOrangeSecret, setShowOrangeSecret] = useState(false);
  const [showWaveSecret, setShowWaveSecret] = useState(false);
  const [showCampayPassword, setShowCampayPassword] = useState(false);
  const [showCampayToken, setShowCampayToken] = useState(false);
  const [showCampayWebhookKey, setShowCampayWebhookKey] = useState(false);

  // Clipboard copy success indicator
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Status indicators
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync settings when external changes happen
  useEffect(() => {
    if (settings && settings.paymentConfig) {
      const pCfg = settings.paymentConfig;
      setCardEnabled(pCfg.cardEnabled ?? false);
      setStripePublicKey(pCfg.stripePublicKey || '');
      setStripeSecretKey(pCfg.stripeSecretKey || '');
      setMtnEnabled(pCfg.mtnEnabled ?? false);
      setMtnPhoneNumber(pCfg.mtnPhoneNumber || '');
      setMtnMerchantName(pCfg.mtnMerchantName || '');
      setMtnClientId(pCfg.mtnClientId || '');
      setMtnClientSecret(pCfg.mtnClientSecret || '');
      setOrangeEnabled(pCfg.orangeEnabled ?? false);
      setOrangePhoneNumber(pCfg.orangePhoneNumber || '');
      setOrangeMerchantName(pCfg.orangeMerchantName || '');
      setOrangeMerchantKey(pCfg.orangeMerchantKey || '');
      setOrangeClientId(pCfg.orangeClientId || '');
      setOrangeClientSecret(pCfg.orangeClientSecret || '');
      setWaveEnabled(pCfg.waveEnabled ?? false);
      setWavePhoneNumber(pCfg.wavePhoneNumber || '');
      setWaveMerchantName(pCfg.waveMerchantName || '');
      setWaveApiKey(pCfg.waveApiKey || '');
      
      setCampayEnabled(pCfg.campayEnabled ?? true);
      setCampayAppId(pCfg.campayAppId || 'UirmJUAg75JHLjtXjp4J-Xi7jG8jQpMSldrgxuZKTbno0ehaU3lRayZmw05YlPxnB_VShTZHWj56-ImpaWdxuw');
      setCampayAppUsername(pCfg.campayAppUsername || 'Uahox6805UvasolxjrndxKMC6EoWPxWwzJRQtH-aDLRXmj17zyAdHbLqyX2wy9GkxC3ZtvHpZ4s945hfHfeU-w');
      setCampayAppPassword(pCfg.campayAppPassword || 'jGJNkAYDVvzNEutZ-LUrPKdnRJj7QlzPyFabJ_VefmS8FiafzGsAhy7rFUV5g1q0rRkgTift_XFJd_V85UiYEw');
      setCampayToken(pCfg.campayToken || 'ee362ee2adb13fac3e434e0579241626670c9a2e');
      setCampayWebhookKey(pCfg.campayWebhookKey || 'LpEvD_J1lf67b6QOJajBKmZHbeXL42GP0g2ItxEZBONyOnM8DCz6h3ktROPSM75sio2znlrRBEeoPu4JwtObpw');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setShowSuccess(false);

    try {
      const updatedSettings: ApeeSettings = {
        ...settings,
        paymentConfig: {
          cardEnabled,
          stripePublicKey: stripePublicKey.trim(),
          stripeSecretKey: stripeSecretKey.trim(),
          mtnEnabled,
          mtnPhoneNumber: mtnPhoneNumber.trim(),
          mtnMerchantName: mtnMerchantName.trim(),
          mtnClientId: mtnClientId.trim(),
          mtnClientSecret: mtnClientSecret.trim(),
          orangeEnabled,
          orangePhoneNumber: orangePhoneNumber.trim(),
          orangeMerchantName: orangeMerchantName.trim(),
          orangeMerchantKey: orangeMerchantKey.trim(),
          orangeClientId: orangeClientId.trim(),
          orangeClientSecret: orangeClientSecret.trim(),
          waveEnabled,
          wavePhoneNumber: wavePhoneNumber.trim(),
          waveMerchantName: waveMerchantName.trim(),
          waveApiKey: waveApiKey.trim(),
          
          campayEnabled,
          campayAppId: campayAppId.trim(),
          campayAppUsername: campayAppUsername.trim(),
          campayAppPassword: campayAppPassword.trim(),
          campayToken: campayToken.trim(),
          campayWebhookKey: campayWebhookKey.trim()
        }
      };

      const result = await onSaveSettings(updatedSettings);
      if (result !== false) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 4000);
      } else {
        setError(isEn ? 'Failed to save settings. Please verify administrator permissions.' : 'Échec de l\'enregistrement des paramètres. Veuillez vérifier vos privilèges.');
      }
    } catch (err: any) {
      console.error(err);
      setError(isEn ? 'An unexpected error occurred while saving.' : 'Une erreur inattendue est survenue.');
    } finally {
      setSaving(false);
    }
  };

  const getWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-xjwa452a7g45f5oz5ftfxe-118121873529.europe-west2.run.app';
    return `${origin}/api/campay-webhook`;
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div id="payment_config_form_container" className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden font-sans">
      <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-900 text-white flex items-center justify-center rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {isEn ? 'Electronic Payment Gateways API' : 'Passerelles de Paiement Électronique'}
            </h2>
            <p className="text-xs text-slate-550">
              {isEn ? 'Configure secure Stripe, MoMo, Orange & Wave credentials' : 'Configurez les clés API de Stripe, MoMo, Orange et Wave'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        {showSuccess && (
          <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl flex items-start gap-3 text-xs text-emerald-800 animate-scale">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-bold">{isEn ? 'Success!' : 'Succès !'}</p>
              <p className="text-xxs text-emerald-700/90 mt-0.5">
                {isEn ? 'Electronic payment API gateway configuration saved successfully.' : 'Configuration des passerelles de paiement électronique sauvegardée.'}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-150 p-4 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-scale">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{isEn ? 'Error Saving' : 'Erreur d\'enregistrement'}</p>
              <p className="text-xxs text-rose-700/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Section Campay */}
        <div className="border border-slate-150 rounded-2xl p-5 space-y-4 bg-slate-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe className="h-5 w-5 text-indigo-700" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">Campay Gateway</h3>
                <p className="text-xxs text-slate-450">
                  {isEn ? 'MTN MoMo, Orange Money & Card payment aggregator' : 'Agrégateur de paiement MTN, Orange & Cartes (Cameroun)'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={campayEnabled} 
                onChange={(e) => setCampayEnabled(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>

          {campayEnabled && (
            <div className="space-y-4 pt-2 animate-scale">
              {/* Info Banner */}
              <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-xl flex items-start gap-3 text-xxs text-slate-700">
                <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">
                    {isEn ? 'Campay Real-time Webhook Configuration' : 'Configuration du Webhook Temps Réel Campay'}
                  </p>
                  <p className="leading-relaxed">
                    {isEn 
                      ? 'To automatically update school invoices when a parent completes their payment, configure the following webhook URL in your Campay Dev Console:' 
                      : 'Pour mettre à jour automatiquement les factures lorsque les parents effectuent un paiement, renseignez cette URL de notification (webhook) sur votre console Campay :'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 bg-white border border-slate-200 rounded-lg p-1.5 pl-3 font-mono text-slate-800 text-xxs select-all break-all shadow-2xs">
                    <span className="flex-1 truncate">{getWebhookUrl()}</span>
                    <button
                      type="button"
                      onClick={handleCopyWebhookUrl}
                      className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xxxs font-bold font-sans hover:bg-slate-850 active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* API IDs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">
                    {isEn ? 'Campay App ID' : 'App ID Campay'}
                  </label>
                  <input
                    type="text"
                    value={campayAppId}
                    onChange={(e) => setCampayAppId(e.target.value)}
                    placeholder="UirmJUAg..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">
                    {isEn ? 'Campay App Username' : 'Username de l\'application'}
                  </label>
                  <input
                    type="text"
                    value={campayAppUsername}
                    onChange={(e) => setCampayAppUsername(e.target.value)}
                    placeholder="Uahox..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>
              </div>

              {/* Password and Webhook Key */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">
                    {isEn ? 'Campay App Password' : 'Mot de passe Campay'}
                  </label>
                  <div className="relative">
                    <input
                      type={showCampayPassword ? 'text' : 'password'}
                      value={campayAppPassword}
                      onChange={(e) => setCampayAppPassword(e.target.value)}
                      placeholder="jGJNkAYD..."
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCampayPassword(!showCampayPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showCampayPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">
                    {isEn ? 'Webhook HMAC Secret Key' : 'Clé Secrète de Signature Webhook'}
                  </label>
                  <div className="relative">
                    <input
                      type={showCampayWebhookKey ? 'text' : 'password'}
                      value={campayWebhookKey}
                      onChange={(e) => setCampayWebhookKey(e.target.value)}
                      placeholder="LpEvD_J1..."
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCampayWebhookKey(!showCampayWebhookKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showCampayWebhookKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Permanent Token */}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-500">
                  {isEn ? 'Permanent JWT Access Token' : 'Jeton d\'accès permanent JWT'}
                </label>
                <div className="relative">
                  <input
                    type={showCampayToken ? 'text' : 'password'}
                    value={campayToken}
                    onChange={(e) => setCampayToken(e.target.value)}
                    placeholder="ee362ee2..."
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCampayToken(!showCampayToken)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCampayToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Stripe */}
        <div className="border border-slate-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">Stripe (Visa/Mastercard)</h3>
                <p className="text-xxs text-slate-450">{isEn ? 'Credit & Debit card payment processor' : 'Règlement par carte bancaire internationale'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={cardEnabled} 
                onChange={(e) => setCardEnabled(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>

          {cardEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-scale">
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Stripe Public Key' : 'Clé Publique Stripe (Publishable Key)'}</label>
                <input
                  type="text"
                  value={stripePublicKey}
                  onChange={(e) => setStripePublicKey(e.target.value)}
                  placeholder="pk_test_..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Stripe Secret Key' : 'Clé Secrète Stripe (Secret Key)'}</label>
                <div className="relative">
                  <input
                    type={showStripeSecret ? 'text' : 'password'}
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    placeholder="sk_test_..."
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStripeSecret(!showStripeSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 rounded-md"
                  >
                    {showStripeSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section MTN MoMo */}
        <div className="border border-slate-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">MTN MoMo</h3>
                <p className="text-xxs text-slate-450">{isEn ? 'Mobile Money integration' : 'Intégration MTN Mobile Money API'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={mtnEnabled} 
                onChange={(e) => setMtnEnabled(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>

          {mtnEnabled && (
            <div className="space-y-4 pt-2 animate-scale">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Merchant Phone Number' : 'Numéro de Téléphone Marchand'}</label>
                  <input
                    type="text"
                    value={mtnPhoneNumber}
                    onChange={(e) => setMtnPhoneNumber(e.target.value)}
                    placeholder="+237 6XX XX XX XX"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Merchant Registered Name' : 'Raison Sociale du Marchand'}</label>
                  <input
                    type="text"
                    value={mtnMerchantName}
                    onChange={(e) => setMtnMerchantName(e.target.value)}
                    placeholder="ECOLE SECONDAIRE DE VOGT"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">Client ID</label>
                  <input
                    type="text"
                    value={mtnClientId}
                    onChange={(e) => setMtnClientId(e.target.value)}
                    placeholder="mtn-momo-client-id-..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">Client Secret</label>
                  <div className="relative">
                    <input
                      type={showMtnSecret ? 'text' : 'password'}
                      value={mtnClientSecret}
                      onChange={(e) => setMtnClientSecret(e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMtnSecret(!showMtnSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 rounded-md"
                    >
                      {showMtnSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Orange Money */}
        <div className="border border-slate-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-5 w-5 text-orange-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">Orange Money</h3>
                <p className="text-xxs text-slate-450">{isEn ? 'Orange Money API integration' : 'Intégration de la clé Orange Money Web Payment'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={orangeEnabled} 
                onChange={(e) => setOrangeEnabled(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>

          {orangeEnabled && (
            <div className="space-y-4 pt-2 animate-scale">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Merchant Phone Number' : 'Numéro Marchand Orange'}</label>
                  <input
                    type="text"
                    value={orangePhoneNumber}
                    onChange={(e) => setOrangePhoneNumber(e.target.value)}
                    placeholder="+237 6XX XX XX XX"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Merchant Registered Name' : 'Nom d\'Enregistrement Orange'}</label>
                  <input
                    type="text"
                    value={orangeMerchantName}
                    onChange={(e) => setOrangeMerchantName(e.target.value)}
                    placeholder="ECOLE DE LA TRINITE"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Merchant Key' : 'Clé Marchand (Merchant Key)'}</label>
                  <input
                    type="text"
                    value={orangeMerchantKey}
                    onChange={(e) => setOrangeMerchantKey(e.target.value)}
                    placeholder="om-merchant-key-..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1 md:col-span-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">Client ID</label>
                  <input
                    type="text"
                    value={orangeClientId}
                    onChange={(e) => setOrangeClientId(e.target.value)}
                    placeholder="orange-momo-client-id-..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1 md:col-span-1">
                  <label className="text-xxs font-bold uppercase text-slate-500">Client Secret</label>
                  <div className="relative">
                    <input
                      type={showOrangeSecret ? 'text' : 'password'}
                      value={orangeClientSecret}
                      onChange={(e) => setOrangeClientSecret(e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOrangeSecret(!showOrangeSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 rounded-md"
                    >
                      {showOrangeSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Wave */}
        <div className="border border-slate-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">Wave</h3>
                <p className="text-xxs text-slate-450">{isEn ? 'Wave Money API credentials' : 'Clés de prélèvement d\'API Wave Mobile'}</p>
              </div>
            </div>
            <label className="relative inline-flex inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={waveEnabled} 
                onChange={(e) => setWaveEnabled(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>

          {waveEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 animate-scale">
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Registered Phone' : 'Téléphone d\'Enregistrement'}</label>
                <input
                  type="text"
                  value={wavePhoneNumber}
                  onChange={(e) => setWavePhoneNumber(e.target.value)}
                  placeholder="+237 6XX XX XX XX"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-500">{isEn ? 'Merchant Legal Name' : 'Nom Légal du Marchand'}</label>
                <input
                  type="text"
                  value={waveMerchantName}
                  onChange={(e) => setWaveMerchantName(e.target.value)}
                  placeholder="ECOLE DE L'EXCELLENCE"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-500">Wave API Key</label>
                <div className="relative">
                  <input
                    type={showWaveSecret ? 'text' : 'password'}
                    value={waveApiKey}
                    onChange={(e) => setWaveApiKey(e.target.value)}
                    placeholder="wave_secret_api_..."
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none bg-slate-50/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaveSecret(!showWaveSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 rounded-md"
                  >
                    {showWaveSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security / SSL Certification Badge */}
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center gap-3">
          <Lock className="h-4.5 w-4.5 text-slate-600 shrink-0" />
          <p className="text-[10px] text-slate-550 leading-relaxed">
            {isEn 
              ? 'These API credentials are stored securely inside your private cloud. They are used exclusively to process secure digital invoicing transactions.' 
              : 'Ces informations d\'API sont stockées de manière hautement sécurisée. Elles sont exclusivement utilisées pour la validation et l\'autorisation des règlements.'}
          </p>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-850 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEn ? 'Saving...' : 'Sauvegarde...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEn ? 'Save Gateway Configurations' : 'Sauvegarder les configurations d\'API'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
