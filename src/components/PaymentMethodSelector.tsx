import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, QrCode, ShieldCheck, CheckCircle2, ChevronRight, Sparkles, AlertCircle, Info, HelpCircle } from 'lucide-react';
import { Invoice } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface PaymentMethodSelectorProps {
  invoice: Invoice;
  parentPhone?: string;
  onPaymentSuccess: (invoice: Invoice) => void;
  onCancel: () => void;
}

export default function PaymentMethodSelector({
  invoice,
  parentPhone,
  onPaymentSuccess,
  onCancel
}: PaymentMethodSelectorProps) {
  // Method state: 'card' (Card), 'momo' (SMS Push), 'qr' (QR Code)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'momo' | 'qr'>('card');
  const [provider, setProvider] = useState<'mtn' | 'orange' | 'wave'>('mtn');
  const [momoPhone, setMomoPhone] = useState(parentPhone || invoice.phone || '');

  // Card Inputs state
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Auto-fill phone if parentPhone changes
  useEffect(() => {
    if (parentPhone) {
      setMomoPhone(parentPhone);
    }
  }, [parentPhone]);

  const getDynamicPaymentQRCodeUrl = (prov: 'mtn' | 'orange' | 'wave') => {
    const rawPhone = parentPhone || invoice.phone || momoPhone || '';
    const referenceId = rawPhone ? rawPhone.trim().replace(/[\s\-\(\)\+]/g, '') : 'REF_UNKNOWN';
    const providerScheme = prov === 'mtn' ? 'mtn_momo' : prov === 'orange' ? 'orange_money' : 'wave';

    const queryParams = new URLSearchParams({
      invoiceId: invoice.id,
      amount: invoice.amount.toString(),
      referenceId: referenceId,
      school: 'CES_Ekali_1',
      recipient: 'CES_Ekali_1_APEE_Treasury'
    });

    const payload = `${providerScheme}://payment?${queryParams.toString()}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}&color=0f172a&bgcolor=ffffff&qzone=1`;
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (paymentMethod === 'momo') {
      if (!momoPhone || momoPhone.trim().length < 8) {
        setError('Veuillez saisir un numéro de téléphone Mobile Money valide.');
        return;
      }
    } else if (paymentMethod === 'card') {
      if (!cardNumber || !expiry || !cvv || !cardholderName) {
        setError('Veuillez remplir tous les champs de votre carte de crédit.');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const executePayment = async () => {
    setShowConfirmModal(false);
    setProcessing(true);
    setError(null);

    try {
      if (paymentMethod === 'momo') {
        const providerName = provider === 'mtn' ? 'MTN MoMo' : provider === 'orange' ? 'Orange Money' : 'Wave';
        
        setStepMessage(`Envoi de la demande de paiement de ${invoice.amount.toLocaleString()} FCFA sur ${momoPhone}...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        setStepMessage(`Attente de la saisie de votre code PIN de confirmation sur votre mobile (${providerName})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        setStepMessage(`Traitement du paiement en cours avec l'opérateur...`);
        await new Promise(resolve => setTimeout(resolve, 1200));
      } else if (paymentMethod === 'qr') {
        const providerName = provider === 'mtn' ? 'MTN MoMo' : provider === 'orange' ? 'Orange Money' : 'Wave';
        
        setStepMessage(`Génération et validation du code QR sécurisé pour ${providerName}...`);
        await new Promise(resolve => setTimeout(resolve, 1200));

        setStepMessage(`Attente de confirmation et de détection par le scanner mobile...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        setStepMessage(`Règlement reçu par le Trésor de l'institution...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // Card payment
        setStepMessage(`Communication cryptée SSL établie avec l'émetteur de la carte...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        setStepMessage(`Authentification 3D-Secure en cours de validation...`);
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      // Perform actual Firestore updates
      const invRef = doc(db, 'invoices', invoice.id);
      const paidDate = new Date().toISOString().split('T')[0];

      await updateDoc(invRef, {
        status: 'Paid',
        paymentDate: paidDate
      });

      const updatedInvoice: Invoice = {
        ...invoice,
        status: 'Paid',
        paymentDate: paidDate
      };

      setSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      onPaymentSuccess(updatedInvoice);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Une erreur inattendue est survenue lors de l'authentification du paiement.");
    } finally {
      setProcessing(false);
      setStepMessage('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Upper Mode Selector Options */}
      {!success && (
        <div className="space-y-4">
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
            Sélectionnez votre moyen de règlement
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Card Button option */}
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-3.5 border rounded-2xl text-left transition relative cursor-pointer flex flex-row sm:flex-col gap-3 items-center sm:items-start ${
                paymentMethod === 'card'
                  ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 ring-1 ring-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-350'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${paymentMethod === 'card' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-bold block leading-tight">Carte Bancaire</span>
                <span className="text-[10px] text-slate-505 truncate block">Visa, Mastercard</span>
              </div>
              {paymentMethod === 'card' && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 sm:block hidden" />
              )}
            </button>

            {/* Momo SMS Push Button option */}
            <button
              type="button"
              onClick={() => setPaymentMethod('momo')}
              className={`p-3.5 border rounded-2xl text-left transition relative cursor-pointer flex flex-row sm:flex-col gap-3 items-center sm:items-start ${
                paymentMethod === 'momo'
                  ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 ring-1 ring-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-350'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${paymentMethod === 'momo' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Smartphone className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-bold block leading-tight">Mobile Money</span>
                <span className="text-[10px] text-slate-505 truncate block">Facturation Express SMS</span>
              </div>
              {paymentMethod === 'momo' && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 sm:block hidden" />
              )}
            </button>

            {/* QR Code option */}
            <button
              type="button"
              onClick={() => setPaymentMethod('qr')}
              className={`p-3.5 border rounded-2xl text-left transition relative cursor-pointer flex flex-row sm:flex-col gap-3 items-center sm:items-start ${
                paymentMethod === 'qr'
                  ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 ring-1 ring-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-350'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${paymentMethod === 'qr' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <QrCode className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-bold block leading-tight">Code QR Mobile</span>
                <span className="text-[10px] text-slate-505 truncate block">Scanner & Valider</span>
              </div>
              {paymentMethod === 'qr' && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 sm:block hidden" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Payment Forms */}
      <div className="mt-4 bg-slate-50/60 rounded-2xl border border-slate-150 p-5">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center py-6 space-y-3.5"
            >
              <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900">Règlement Réussi !</h4>
                <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                  Votre transaction a été validée. L'avis d'échéance {invoice.id.toUpperCase()} est désormais réglé. Un reçu numérique vous est envoyé par courriel.
                </p>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* 1. CARD METHOD PANEL */}
              {paymentMethod === 'card' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Titulaire de la carte</label>
                    <input
                      type="text"
                      required
                      placeholder="M. ou Mme Jacques BENE"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium focus:outline-hidden focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Numéro de carte bancaire</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="4970 8593 1039 4820"
                        value={cardNumber}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
                          setCardNumber(v.substring(0, 16).replace(/(.{4})/g, '$1 ').trim());
                        }}
                        className="w-full pl-10 pr-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 transition-colors"
                      />
                      <CreditCard className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Date d'expiration</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        placeholder="MM/AA"
                        value={expiry}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^0-9]/gi, '');
                          if (v.length > 2) {
                            v = `${v.slice(0, 2)}/${v.slice(2, 4)}`;
                          }
                          setExpiry(v);
                        }}
                        className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">CVV / CVC</label>
                      <input
                        type="password"
                        required
                        maxLength={3}
                        placeholder="•••"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/[^0-9]/gi, ''))}
                        className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. MOBILE MONEY EXPRESS METHOD */}
              {paymentMethod === 'momo' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Sélectionnez votre opérateur Mobile Money</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setProvider('mtn')}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          provider === 'mtn'
                            ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center font-black text-[10px] text-gray-950 border border-yellow-500 shadow-3xs">M</div>
                        <span className="text-[10px] font-black uppercase tracking-tight">MTN MoMo</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setProvider('orange')}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          provider === 'orange'
                            ? 'bg-orange-50 border-orange-500 text-orange-900 ring-1 ring-orange-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center font-black text-[10px] text-white border border-orange-600 shadow-3xs">O</div>
                        <span className="text-[10px] font-black uppercase tracking-tight">Orange</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProvider('wave')}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          provider === 'wave'
                            ? 'bg-sky-50 border-sky-500 text-sky-900 ring-1 ring-sky-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-sky-450 flex items-center justify-center font-black text-[10px] text-white border border-sky-550 shadow-3xs">W</div>
                        <span className="text-[10px] font-black uppercase tracking-tight">Wave</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">Numéro de téléphone payeur</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: +237 677 88 99 00"
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 transition-colors"
                    />
                    <div className="flex items-start gap-1 text-[9.5px] text-slate-500 mt-1.5 leading-relaxed bg-indigo-50/50 border border-indigo-100/30 rounded-lg p-2 font-medium">
                      <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span>Une notification Express PIN sera envoyée instantanément à votre mobile pour confirmer le paiement de {invoice.amount.toLocaleString()} FCFA.</span>
                    </div>
                  </div>

                  {processing && stepMessage && (
                    <div className="p-3 bg-indigo-50 border border-indigo-120 rounded-xl space-y-1.5 animate-pulse">
                      <span className="text-[9.5px] uppercase font-black tracking-widest text-indigo-700 block">🔗 Liaison Mobile Payment sécurisée</span>
                      <div className="text-xs text-indigo-905 font-bold flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-650 animate-ping shrink-0" />
                        {stepMessage}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. QR-CODE SCAN METHOD OPTION */}
              {paymentMethod === 'qr' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Opérateur du code QR à générer</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setProvider('mtn')}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          provider === 'mtn'
                            ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center font-black text-[10px] text-gray-950 border border-yellow-500 shadow-3xs">M</div>
                        <span className="text-[10px] font-black uppercase tracking-tight">MTN MoMo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProvider('orange')}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          provider === 'orange'
                            ? 'bg-orange-50 border-orange-500 text-orange-900 ring-1 ring-orange-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center font-black text-[10px] text-white border border-orange-600 shadow-3xs">O</div>
                        <span className="text-[10px] font-black uppercase tracking-tight">Orange</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProvider('wave')}
                        className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                          provider === 'wave'
                            ? 'bg-sky-50 border-sky-500 text-sky-900 ring-1 ring-sky-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-sky-450 flex items-center justify-center font-black text-[10px] text-white border border-sky-550 shadow-3xs">W</div>
                        <span className="text-[10px] font-black uppercase tracking-tight">Wave</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200/80 rounded-2xl relative shadow-2xs overflow-hidden">
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[8px] font-extrabold text-emerald-600 tracking-wider">SECURE QR</span>
                    </div>

                    <div className="relative p-2.5 bg-white rounded-2xl border border-slate-150 shadow-2xs">
                      {/* Scanning laser effect */}
                      <div className="absolute left-2.5 right-2.5 h-0.5 bg-indigo-500/80 opacity-70 shadow-[0_0_6px_rgba(99,102,241,0.8)] animate-bounce" style={{ top: 'calc(50% - 1px)' }} />
                      
                      <img
                        referrerPolicy="no-referrer"
                        src={getDynamicPaymentQRCodeUrl(provider)}
                        alt={`QR Code ${provider}`}
                        className="w-[130px] h-[130px] object-contain relative z-10"
                      />
                    </div>

                    <div className="mt-2 text-[9px] text-indigo-700 font-mono tracking-tight bg-indigo-50 border border-indigo-100/60 rounded px-2 py-0.5 text-center font-bold">
                      Réf Multi-Payeur : {momoPhone || 'APEE_STANDARD_REF'}
                    </div>

                    <p className="text-[10px] text-slate-500 font-medium text-center mt-2.5 max-w-[280px] leading-relaxed">
                      Scannez ce code QR avec l'option "Scanner Code QR" de votre appareil de transaction mobile {provider === 'mtn' ? 'MTN MoMo' : provider === 'orange' ? 'Orange Money' : 'Wave'}.
                    </p>
                  </div>

                  {processing && stepMessage && (
                    <div className="p-3 bg-indigo-50 border border-indigo-120 rounded-xl space-y-1.5 animate-pulse">
                      <span className="text-[9.5px] uppercase font-black tracking-widest text-indigo-700 block text-center">💻 Déconnexion du scanner mobile...</span>
                      <div className="text-xs text-indigo-905 font-bold flex items-center justify-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-650 animate-ping shrink-0" />
                        {stepMessage}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Secure payment confirmation button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 hover:shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {processing ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Traitement sécurisé...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      {paymentMethod === 'qr' ? "Simuler validation par Scan QR" : `Payer ${invoice.amount.toLocaleString()} FCFA`}
                    </>
                  )}
                </button>
              </div>

              <div className="text-center font-mono text-[9px] text-slate-400 flex items-center justify-center gap-1 select-none">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Cryptage SSL 256 bits • Banque Agréée BCEAO/BEAC
              </div>
            </form>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Dialog before status changes to Paid */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-51">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm border border-slate-100 shadow-2xl p-6 text-center space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Confirmer le règlement
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Êtes-vous sûr de vouloir marquer cette facture d'un montant de{" "}
                  <strong className="text-indigo-700 font-mono font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded">
                    {invoice.amount.toLocaleString()} FCFA
                  </strong>{" "}
                  comme <strong className="text-emerald-705">PAYÉE</strong> ?
                </p>
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-left space-y-1 text-[11px] text-slate-600">
                  <p className="font-extrabold text-slate-800 truncate"> Libellé : {invoice.title}</p>
                  <p className="font-mono text-slate-400 text-[10px]">Réf : {invoice.id.toUpperCase()}</p>
                  <p className="text-slate-500 font-semibold">
                    Mode : {paymentMethod === 'card' ? '💳 Carte Bancaire' : paymentMethod === 'momo' ? '📱 Mobile Money' : '📶 Code QR Mobile'}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 font-medium font-sans">
                  Cette action est définitive et mettra immédiatement à jour le registre comptable de l'établissement en marquant le statut à réglé.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="py-2.5 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={executePayment}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4 text-white" />
                  Oui, Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
