import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  Info, 
  Lock, 
  ArrowLeft, 
  Copy, 
  Printer, 
  Loader2, 
  AlertCircle, 
  Check, 
  Coins 
} from 'lucide-react';
import { Invoice } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { useLanguage } from '../utils/TranslationContext';

interface PaymentModuleProps {
  invoice: Invoice;
  settings?: any;
  onPaymentSuccess?: (invoice: Invoice) => void;
  onCancel?: () => void;
}

export default function PaymentModule({
  invoice,
  settings,
  onPaymentSuccess,
  onCancel
}: PaymentModuleProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  // Read config from settings, defaulting to enabled if settings aren't provided
  const cardEnabled = settings?.paymentConfig ? settings.paymentConfig.cardEnabled !== false : true;
  const mtnEnabled = settings?.paymentConfig ? settings.paymentConfig.mtnEnabled !== false : true;
  const orangeEnabled = settings?.paymentConfig ? settings.paymentConfig.orangeEnabled !== false : true;
  const waveEnabled = settings?.paymentConfig ? settings.paymentConfig.waveEnabled === true : false;
  const campayEnabled = settings?.paymentConfig ? settings.paymentConfig.campayEnabled !== false : true;

  // Selected method states
  const [method, setMethod] = useState<'momo' | 'card'>('momo');
  const [provider, setProvider] = useState<'mtn' | 'orange' | 'wave'>('mtn');

  // Input states
  const [phone, setPhone] = useState(invoice.phone || '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  // UI Flow states
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generated receipt states
  const [receiptDetails, setReceiptDetails] = useState<{
    txnId: string;
    date: string;
    amount: number;
    methodLabel: string;
    accountLabel: string;
    schoolName: string;
  } | null>(null);

  // Auto-adjust default selections if any are disabled
  useEffect(() => {
    if (!cardEnabled && method === 'card') {
      setMethod('momo');
    }
    if (provider === 'mtn' && !mtnEnabled) {
      if (orangeEnabled) setProvider('orange');
      else if (waveEnabled) setProvider('wave');
    } else if (provider === 'orange' && !orangeEnabled) {
      if (mtnEnabled) setProvider('mtn');
      else if (waveEnabled) setProvider('wave');
    } else if (provider === 'wave' && !waveEnabled) {
      if (mtnEnabled) setProvider('mtn');
      else if (orangeEnabled) setProvider('orange');
    }
  }, [settings, cardEnabled, mtnEnabled, orangeEnabled, waveEnabled]);

  const validateForm = () => {
    setError(null);
    if (method === 'momo') {
      const cleanPhone = phone.trim();
      if (!cleanPhone) {
        setError(isEn ? 'Please enter a mobile phone number.' : 'Veuillez saisir un numéro de téléphone mobile.');
        return false;
      }
      if (cleanPhone.length < 8) {
        setError(isEn ? 'Please enter a valid mobile number.' : 'Veuillez saisir un numéro de téléphone mobile valide.');
        return false;
      }
    } else {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 15 || cleanCard.length > 19) {
        setError(isEn ? 'Invalid Credit Card number.' : 'Numéro de carte de crédit invalide.');
        return false;
      }
      if (!expiry || !expiry.includes('/')) {
        setError(isEn ? 'Please specify Expiry date (MM/YY).' : 'Veuillez spécifier la date d\'expiration (MM/AA).');
        return false;
      }
      if (cvv.trim().length < 3) {
        setError(isEn ? 'Invalid CVV.' : 'Code de sécurité CVV invalide.');
        return false;
      }
      if (!cardholderName.trim()) {
        setError(isEn ? 'Cardholder name is required.' : 'Le nom du titulaire de la carte est obligatoire.');
        return false;
      }
    }
    return true;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const chunks = raw.match(/.{1,4}/g);
    setCardNumber(chunks ? chunks.slice(0, 4).join(' ') : raw);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 2) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2, 4);
    }
    setExpiry(raw.slice(0, 5));
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setStep('processing');
    setError(null);

    // Simulate standard security handshakes and API processes
    const steps = isEn ? [
      'Contacting payment processor gateway...',
      'Initiating double-handshake authentication challenge...',
      'Validating payment method coverage...',
      'Authorizing funds transfer and registering transaction...'
    ] : [
      'Contact de la passerelle de paiement...',
      'Initiation de la validation double-facteur...',
      'Vérification de la couverture du solde...',
      'Autorisation de transfert et enregistrement de la transaction...'
    ];

    for (let i = 0; i < steps.length; i++) {
      setStatusMessage(steps[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      const provLabel = method === 'card' ? 'Visa/Mastercard' : (provider === 'mtn' ? 'MTN Mobile Money' : provider === 'orange' ? 'Orange Money' : 'Wave');
      const suffix = method === 'card' ? `*${cardNumber.slice(-4)}` : phone;
      const randHex = Math.floor(100000 + Math.random() * 900000).toString(16).toUpperCase();
      const randomId = Math.floor(100000 + Math.random() * 900000);
      const generatedTxnId = `TXN-${method.toUpperCase()}-${provider.toUpperCase()}-${randHex}-${randomId}`;
      const paidDateStr = new Date().toLocaleString(isEn ? 'en-US' : 'fr-FR');
      const dateIso = new Date().toISOString().split('T')[0];

      // Format receipt text
      const receiptText = `
=============================================
             REÇU DE PAIEMENT ÉLECTRONIQUE
=============================================
ID Transaction  : ${generatedTxnId}
Date            : ${paidDateStr}
Montant         : ${invoice.amount.toLocaleString()} ${settings?.currency || 'FCFA'}
Méthode         : ${provLabel}
Compte/Source   : ${suffix}
Établissement   : ${invoice.title || 'APEE'}
Statut          : SUCCÈS (Simulé)
Merci pour votre confiance.
=============================================
`.trim();

      const newNote = invoice.note ? `${invoice.note}\n\n${receiptText}` : receiptText;

      // Update Firestore document
      const invRef = doc(db, 'invoices', invoice.id);
      await updateDoc(invRef, {
        status: 'Paid',
        paymentDate: dateIso,
        transactionId: generatedTxnId,
        provider: method === 'card' ? 'card' : provider,
        note: newNote
      });

      const receipt = {
        txnId: generatedTxnId,
        date: paidDateStr,
        amount: invoice.amount,
        methodLabel: provLabel,
        accountLabel: suffix,
        schoolName: invoice.title || 'APEE'
      };

      setReceiptDetails(receipt);
      setStep('success');

      if (onPaymentSuccess) {
        onPaymentSuccess({
          ...invoice,
          status: 'Paid',
          paymentDate: dateIso,
          transactionId: generatedTxnId,
          provider: method === 'card' ? 'card' : provider,
          note: newNote
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(isEn ? 'Payment failed due to a database write issue.' : 'Échec du paiement suite à une erreur d\'écriture.');
      setStep('form');
      handleFirestoreError(err, 'write' as any, `invoices/${invoice.id}`);
    }
  };

  const copyReceipt = () => {
    if (!receiptDetails) return;
    const provLabel = receiptDetails.methodLabel;
    const textToCopy = `
REÇU DE PAIEMENT ÉLECTRONIQUE
------------------------------------
Transaction ID: ${receiptDetails.txnId}
Date: ${receiptDetails.date}
Montant: ${receiptDetails.amount.toLocaleString()} ${settings?.currency || 'FCFA'}
Méthode: ${provLabel}
Source: ${receiptDetails.accountLabel}
Établissement: ${receiptDetails.schoolName}
Statut: VALIDÉ
------------------------------------
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printReceipt = () => {
    window.print();
  };

  if (step === 'processing') {
    return (
      <div id="payment_module_processing" className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl shadow-xs border border-slate-100 text-center space-y-6">
        <Loader2 className="h-12 w-12 text-slate-800 animate-spin" />
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-800 font-sans">
            {isEn ? 'Processing Payment' : 'Paiement en cours...'}
          </h3>
          <p className="text-xs text-slate-550 max-w-sm font-mono bg-slate-50 p-3 rounded-lg border border-slate-100 animate-pulse">
            {statusMessage}
          </p>
        </div>
        <p className="text-xxs text-slate-400">
          {isEn ? 'Please do not close this window or refresh.' : 'Veuillez ne pas fermer cette fenêtre ni rafraîchir.'}
        </p>
      </div>
    );
  }

  if (step === 'success' && receiptDetails) {
    return (
      <div id="payment_module_success" className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden font-sans">
        <div className="p-6 bg-slate-900 text-white text-center space-y-3">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-6 w-6 animate-bounce" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {isEn ? 'Payment Confirmed!' : 'Paiement Confirmé !'}
            </h3>
            <p className="text-xs text-slate-300">
              {isEn ? 'Receipt has been compiled into the invoice note.' : 'Le reçu a été consigné dans les notes de la facture.'}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200 font-mono text-xs text-slate-700 space-y-2 relative">
            <div className="absolute top-2 right-2 text-xxs bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
              SUCCESS
            </div>
            <div className="border-b border-slate-100 pb-2 mb-2 font-bold text-center uppercase tracking-wider text-slate-900">
              {isEn ? 'Simulated Digital Receipt' : 'Reçu Électronique Simulé'}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Transaction ID:</span>
              <span className="font-semibold text-slate-950 text-right break-all">{receiptDetails.txnId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date:</span>
              <span className="text-slate-950">{receiptDetails.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Montant:</span>
              <span className="font-bold text-slate-950">{receiptDetails.amount.toLocaleString()} {settings?.currency || 'FCFA'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mode:</span>
              <span className="text-slate-950">{receiptDetails.methodLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Compte:</span>
              <span className="text-slate-950 font-semibold">{receiptDetails.accountLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Établissement:</span>
              <span className="text-slate-950 text-right">{receiptDetails.schoolName}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={copyReceipt}
              className="flex-1 min-w-[120px] py-2 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 animate-scale" />
                  {isEn ? 'Copied' : 'Copié'}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-slate-500" />
                  {isEn ? 'Copy Text' : 'Copier le texte'}
                </>
              )}
            </button>

            <button
              onClick={printReceipt}
              className="flex-1 min-w-[120px] py-2 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              {isEn ? 'Print' : 'Imprimer'}
            </button>

            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center"
              >
                {isEn ? 'Done & Return' : 'Terminer & Retourner'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="payment_module_form" className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden font-sans">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-slate-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isEn ? 'Simulated Secure Payment' : 'Paiement Sécurisé Simulé'}
            </h3>
            <p className="text-xxs text-slate-500">
              {isEn ? 'Complete electronic collection' : 'Finaliser le règlement de cotisation'}
            </p>
          </div>
        </div>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Invoice Summary Card */}
        <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xxs text-indigo-700 font-bold uppercase tracking-wider mb-0.5">
              {isEn ? 'Invoice Balance' : 'Solde de la Facture'}
            </p>
            <h4 className="text-xs font-bold text-slate-850 break-words max-w-[200px]">
              {invoice.title}
            </h4>
            <p className="text-[9px] text-indigo-600 font-medium mt-1">
              ✨ {isEn ? '1% transaction fee included:' : 'Frais de service 1% inclus :'} <span className="font-bold">{(invoice.amount * 0.01).toLocaleString()} {settings?.currency || 'FCFA'}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-indigo-950 block">
              {invoice.amount.toLocaleString()} {settings?.currency || 'FCFA'}
            </span>
            <span className="text-[9px] font-mono text-slate-400 block mt-0.5">{isEn ? 'Net to school:' : 'Net école :'} {Math.round(invoice.amount * 0.99).toLocaleString()} {settings?.currency || 'FCFA'}</span>
          </div>
        </div>

        {/* Payment Method Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setMethod('momo')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              method === 'momo' 
                ? 'bg-white text-slate-950 shadow-xs' 
                : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            {isEn ? 'Mobile Money' : 'Mobile Money'}
          </button>

          <button
            type="button"
            disabled={!cardEnabled}
            onClick={() => setMethod('card')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              !cardEnabled ? 'opacity-40 cursor-not-allowed' : ''
            } ${
              method === 'card' 
                ? 'bg-white text-slate-950 shadow-xs' 
                : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            {isEn ? 'Credit Card' : 'Carte Bancaire'}
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-150 p-3 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-scale">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handlePay} className="space-y-4">
          {method === 'momo' ? (
            <div className="space-y-4">
              {/* MoMo operator selectors */}
              <div className="space-y-1.5">
                <label className="text-xxs font-bold uppercase text-slate-450">
                  {isEn ? 'Select Mobile Provider' : 'Sélectionner l\'opérateur'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!mtnEnabled}
                    onClick={() => setProvider('mtn')}
                    className={`py-2 px-2 rounded-xl border text-xxs font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      !mtnEnabled ? 'opacity-35 cursor-not-allowed' : ''
                    } ${
                      provider === 'mtn'
                        ? 'border-yellow-400 bg-yellow-50/40 text-yellow-800'
                        : 'border-slate-200 hover:border-slate-350 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    MTN MoMo
                  </button>

                  <button
                    type="button"
                    disabled={!orangeEnabled}
                    onClick={() => setProvider('orange')}
                    className={`py-2 px-2 rounded-xl border text-xxs font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      !orangeEnabled ? 'opacity-35 cursor-not-allowed' : ''
                    } ${
                      provider === 'orange'
                        ? 'border-orange-400 bg-orange-50/40 text-orange-800'
                        : 'border-slate-200 hover:border-slate-350 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    Orange
                  </button>

                  <button
                    type="button"
                    disabled={!waveEnabled}
                    onClick={() => setProvider('wave')}
                    className={`py-2 px-2 rounded-xl border text-xxs font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      !waveEnabled ? 'opacity-35 cursor-not-allowed' : ''
                    } ${
                      provider === 'wave'
                        ? 'border-sky-400 bg-sky-50/40 text-sky-800'
                        : 'border-slate-200 hover:border-slate-350 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                    Wave
                  </button>
                </div>
              </div>

              {/* MoMo phone input */}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-450 block">
                  {isEn ? 'Mobile Money Phone Number' : 'Numéro de Téléphone Mobile Money'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-semibold select-none">
                    +237
                  </span>
                  <input
                    type="tel"
                    value={phone.startsWith('+237') ? phone.slice(4) : phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setPhone(digits ? `+237${digits}` : '');
                    }}
                    placeholder="6XXXXXXXX"
                    className="w-full pl-14 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none text-xs font-mono font-medium transition placeholder:text-slate-350 bg-slate-50/50"
                  />
                </div>
                <p className="text-[10px] text-slate-450">
                  {isEn 
                    ? 'Enter the number to authorize the simulated payment request.' 
                    : 'Entrez le numéro pour valider la demande de prélèvement simulé.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Card inputs */}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-450 block">
                  {isEn ? 'Cardholder Full Name' : 'Nom du Titulaire'}
                </label>
                <input
                  type="text"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="JEAN DUPONT"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none text-xs font-semibold uppercase tracking-wider transition placeholder:text-slate-350 bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase text-slate-450 block">
                  {isEn ? 'Credit Card Number' : 'Numéro de Carte de Crédit'}
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="4000 1234 5678 9010"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none text-xs font-mono font-semibold transition placeholder:text-slate-350 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-450 block">
                    {isEn ? 'Expiration Date' : 'Date d\'Expiration'}
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={handleExpiryChange}
                    placeholder="MM/YY"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none text-xs font-mono font-semibold text-center transition placeholder:text-slate-350 bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase text-slate-450 block">
                    {isEn ? 'Security Code (CVV)' : 'Code de Sécurité (CVV)'}
                  </label>
                  <input
                    type="password"
                    value={cvv}
                    onChange={handleCvvChange}
                    placeholder="•••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none text-xs font-mono font-semibold text-center transition placeholder:text-slate-350 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Campay Secure Gateway trust indicator */}
          {campayEnabled && (
            <div className="bg-amber-500/10 border border-amber-500/15 p-3 rounded-xl flex items-center justify-between animate-scale">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">Passerelle Campay Active</p>
                  <p className="text-[9px] text-amber-700 font-medium">
                    {isEn ? 'Processed securely via establishment merchant account.' : 'Traité via les identifiants marchands Campay de l\'école.'}
                  </p>
                </div>
              </div>
              <span className="bg-amber-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider">Campay Sec</span>
            </div>
          )}

          {/* Secure SSL notice banner */}
          <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-slate-500 shrink-0" />
            <p className="text-[10px] text-slate-550 leading-relaxed">
              {isEn 
                ? 'This payment window simulates the exact technical behavior of secure real-world API handshakes. No genuine currency is withdrawn.' 
                : 'Cette fenêtre simule le comportement exact des passerelles sécurisées SSL. Aucun prélèvement réel n\'est effectué.'}
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-850 text-white font-extrabold rounded-xl text-xs transition cursor-pointer text-center shadow-md hover:shadow-lg transform active:scale-98 flex items-center justify-center gap-2"
          >
            {isEn ? `Pay ${invoice.amount.toLocaleString()} ${settings?.currency || 'FCFA'}` : `Payer ${invoice.amount.toLocaleString()} ${settings?.currency || 'FCFA'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
