import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Smartphone, 
  QrCode, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  Info, 
  HelpCircle,
  Terminal,
  Lock,
  Check,
  Send,
  Cpu,
  RefreshCw,
  Download,
  Printer,
  X
} from 'lucide-react';
import { Invoice, Student } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { useLanguage } from '../utils/TranslationContext';

interface PaymentMethodSelectorProps {
  invoice: Invoice;
  parentPhone?: string;
  students?: Student[];
  settings?: any;
  onPaymentSuccess: (invoice: Invoice) => void;
  onCancel: () => void;
  onDownloadReceipt?: (invoice: Invoice) => void;
}

interface SandboxLog {
  timestamp: string;
  type: 'info' | 'request' | 'response' | 'success' | 'error';
  message: string;
  payload?: any;
}

export default function PaymentMethodSelector({
  invoice,
  parentPhone,
  students,
  settings,
  onPaymentSuccess,
  onCancel,
  onDownloadReceipt
}: PaymentMethodSelectorProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const cardEnabled = settings?.paymentConfig ? settings.paymentConfig.cardEnabled !== false : true;
  const mtnEnabled = settings?.paymentConfig ? settings.paymentConfig.mtnEnabled !== false : true;
  const orangeEnabled = settings?.paymentConfig ? settings.paymentConfig.orangeEnabled !== false : true;
  const waveEnabled = settings?.paymentConfig ? settings.paymentConfig.waveEnabled === true : false;

  // Core selector states
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'momo' | 'qr'>('card');
  const [provider, setProvider] = useState<'mtn' | 'orange' | 'wave'>('mtn');
  const [momoPhone, setMomoPhone] = useState(parentPhone || invoice.phone || '');

  // Synchronize dynamic payment options based on admin configuration settings
  useEffect(() => {
    if (!cardEnabled && paymentMethod === 'card') {
      if (mtnEnabled || orangeEnabled || waveEnabled) {
        setPaymentMethod('momo');
      } else {
        setPaymentMethod('qr');
      }
    } else if (!(mtnEnabled || orangeEnabled || waveEnabled) && paymentMethod === 'momo') {
      if (cardEnabled) {
        setPaymentMethod('card');
      } else {
        setPaymentMethod('qr');
      }
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

  // Card Inputs state
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  // Sandbox & API Logger State
  const [sandboxLogs, setSandboxLogs] = useState<SandboxLog[]>([]);
  const [showSandboxConsole, setShowSandboxConsole] = useState(false);

  // Interactive Simulation States
  const [simulationState, setSimulationState] = useState<'idle' | 'handshake' | 'challenge' | 'validating' | 'success'>('idle');
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  
  // Interactive Verification states
  const [momoPin, setMomoPin] = useState('');
  const [cardOtp, setCardOtp] = useState('');
  const [otpSent, setOtpSent] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');

  // UI state
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Refs for auto-scroll console
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Auto-fill phone if parentPhone changes
  useEffect(() => {
    if (parentPhone) {
      setMomoPhone(parentPhone);
    }
  }, [parentPhone]);

  // Auto scroll sandbox log console
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sandboxLogs]);

  // Helper to append developer logs
  const addSandboxLog = (type: 'info' | 'request' | 'response' | 'success' | 'error', message: string, payload?: any) => {
    const time = new Date().toLocaleTimeString();
    setSandboxLogs(prev => [...prev, { timestamp: time, type, message, payload }]);
  };

  const getDynamicPaymentQRCodeUrl = (prov: 'mtn' | 'orange' | 'wave') => {
    const rawPhone = parentPhone || invoice.phone || momoPhone || '';
    const referenceId = rawPhone ? rawPhone.trim().replace(/[\s\-\(\)\+]/g, '') : 'REF_UNKNOWN';
    const providerScheme = prov === 'mtn' ? 'mtn_momo' : prov === 'orange' ? 'orange_money' : 'wave';

    const student = students?.find(s => s.id === invoice.studentId);
    const studentName = student ? student.name : "Élève de l'établissement";
    const studentClass = student ? `${student.grade} ${student.classRoom}` : "N/A";

    const paymentData = {
      service: "PasmaSysPay",
      provider: providerScheme,
      invoiceId: invoice.id,
      title: invoice.title,
      amount: invoice.amount,
      currency: "FCFA",
      reference: referenceId,
      studentId: invoice.studentId,
      studentName: studentName,
      studentClass: studentClass,
      school: "CES d'Ekali 1",
      recipient: "APEE CES d'Ekali 1 Treasury",
      timestamp: new Date().toISOString()
    };

    const payload = JSON.stringify(paymentData);
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}&color=0f172a&bgcolor=ffffff&qzone=1`;
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (paymentMethod === 'momo') {
      if (!momoPhone || momoPhone.trim().length < 8) {
        setError(isEn ? 'Please enter a valid Mobile Money phone number.' : 'Veuillez saisir un numéro de téléphone Mobile Money valide.');
        return;
      }
    } else if (paymentMethod === 'card') {
      if (!cardNumber || !expiry || !cvv || !cardholderName) {
        setError(isEn ? 'Please fill in all credit card fields.' : 'Veuillez remplir tous les champs de votre carte de crédit.');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  // Main interactive execution
  const executePaymentSimulation = async () => {
    setShowConfirmModal(false);
    setProcessing(true);
    setError(null);
    setMomoPin('');
    setCardOtp('');

    // Generate simulated OTP
    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setOtpSent(mockOtp);

    // Get Provider Details
    const providerName = paymentMethod === 'card' 
      ? (cardNumber.startsWith('4') ? 'Visa Secure' : 'Mastercard ID Check')
      : (provider === 'mtn' ? 'MTN MoMo API' : provider === 'orange' ? 'Orange Money API' : 'Wave Transfer API');

    setSimulationState('handshake');
    setSandboxLogs([]); // Clear for new run

    addSandboxLog('info', `Initialisation de la transaction pour l'échéance ${invoice.id.toUpperCase()}`);
    addSandboxLog('request', `POST /api/v1/payments/initialize`, {
      invoiceId: invoice.id,
      amount: invoice.amount,
      currency: 'FCFA',
      method: paymentMethod,
      provider: paymentMethod === 'card' ? 'CARD' : provider.toUpperCase()
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    addSandboxLog('response', `Status 200 OK - Canal sécurisé établi avec ${providerName}`);
    
    if (paymentMethod === 'momo') {
      addSandboxLog('request', `POST /api/v1/momo/push-otp`, {
        phoneNumber: momoPhone,
        amount: invoice.amount,
        callbackUrl: 'https://ais-pre-xjwa452a7g45f5oz5ftfxe.europe-west2.run.app/api/momo-webhook'
      });
      await new Promise(resolve => setTimeout(resolve, 1200));
      addSandboxLog('response', `Status 202 Accepted - Requête Push OTP transmise au téléphone.`);
      addSandboxLog('info', `Attente de l'authentification PIN de l'utilisateur sur le terminal virtuel...`);
      setSimulationState('challenge');
    } else if (paymentMethod === 'card') {
      addSandboxLog('request', `POST /api/v1/card/3ds-enrollment`, {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholder: cardholderName,
        expiry,
        cvv: '***'
      });
      await new Promise(resolve => setTimeout(resolve, 1200));
      addSandboxLog('response', `Status 200 OK - Défi 3D-Secure requis. Code temporaire envoyé.`);
      addSandboxLog('info', `Défi SMS 3D-Secure généré: Code [${mockOtp}] envoyé au porteur.`);
      setSimulationState('challenge');
    } else {
      // QR Code simulation bypasses OTP/PIN challenge
      addSandboxLog('request', `POST /api/v1/qr/validate-scan`, {
        reference: momoPhone || 'APEE_STANDARD_REF',
        provider: provider.toUpperCase()
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      addSandboxLog('response', `Status 200 Success - Code QR détecté et approuvé par la passerelle de règlement.`);
      await finishPaymentProcessing('QR Code');
    }
  };

  const submitMomoPinChallenge = async () => {
    if (momoPin.length < 4) {
      setError(isEn ? 'Please enter a 4-digit PIN.' : 'Veuillez saisir un code PIN à 4 chiffres.');
      return;
    }
    setError(null);
    setSimulationState('validating');
    addSandboxLog('request', `POST /api/v1/momo/verify-pin`, {
      phoneNumber: momoPhone,
      pinEntered: '****'
    });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    addSandboxLog('response', `Status 200 OK - Signature PIN cryptographique vérifiée par l'opérateur.`);
    
    const activeProvider = provider === 'mtn' ? 'MTN MoMo' : provider === 'orange' ? 'Orange Money' : 'Wave';
    await finishPaymentProcessing(activeProvider);
  };

  const submitCardOtpChallenge = async () => {
    if (cardOtp !== otpSent && cardOtp !== '1234') {
      setError(isEn ? 'Incorrect security code. Please try again (Hint: use the code shown in info).' : 'Code de sécurité incorrect. Veuillez réessayer (Astuce: utilisez le code affiché en haut).');
      return;
    }
    setError(null);
    setSimulationState('validating');
    addSandboxLog('request', `POST /api/v1/card/verify-3ds`, {
      otp: cardOtp,
      requestId: '3DS_' + Math.floor(Math.random() * 1000000)
    });

    await new Promise(resolve => setTimeout(resolve, 1500));
    addSandboxLog('response', `Status 200 OK - Authentification 3D-Secure réussie.`);

    const brand = cardNumber.startsWith('4') ? 'Visa' : 'Mastercard';
    await finishPaymentProcessing(`Carte ${brand}`);
  };

  const finishPaymentProcessing = async (activeProvider: string) => {
    try {
      addSandboxLog('info', `Génération du jeton de transaction financière unique et crypté...`);
      
      // Generate a highly realistic fictional token format
      const prefix = paymentMethod === 'card' ? 'CARD' : paymentMethod === 'qr' ? 'QR' : 'MOMO';
      const cleanProv = activeProvider.toUpperCase().replace(/\s+/g, '');
      const randomId = Math.floor(100000 + Math.random() * 900000);
      const token = `TXN-${prefix}-${cleanProv}-2026-${randomId}`;
      setGeneratedToken(token);

      await new Promise(resolve => setTimeout(resolve, 800));

      const paidDate = new Date().toISOString().split('T')[0];
      const newNote = `[API SIMULATED SUCCESS] Règlement par ${activeProvider}. Jeton: ${token}. Date: ${paidDate}`;

      addSandboxLog('info', `Écriture dans la base de données Firestore : note, transactionId, et statut=Paid`);

      // Perform actual Firestore updates
      const invRef = doc(db, 'invoices', invoice.id);
      await updateDoc(invRef, {
        status: 'Paid',
        paymentDate: paidDate,
        transactionId: token,
        provider: activeProvider,
        note: invoice.note ? `${invoice.note} | ${newNote}` : newNote
      });

      addSandboxLog('success', `Règlement complété avec succès ! Jeton de transaction persistant : ${token}`);

      const updatedInvoice: Invoice = {
        ...invoice,
        status: 'Paid',
        paymentDate: paidDate,
        transactionId: token,
        provider: activeProvider,
        note: invoice.note ? `${invoice.note} | ${newNote}` : newNote
      };

      setSuccessInvoice(updatedInvoice);
      setSimulationState('success');
      setSuccess(true);
      onPaymentSuccess(updatedInvoice);
    } catch (err: any) {
      console.error(err);
      addSandboxLog('error', `Erreur de traitement de base de données: ${err?.message || err}`);
      setError(err?.message || "Une erreur inattendue est survenue lors de l'authentification du paiement.");
      setSimulationState('idle');
      setProcessing(false);
    }
  };

  const resetSimulator = () => {
    setSimulationState('idle');
    setProcessing(false);
    setSuccess(false);
    setError(null);
  };

  const handleDownloadReceipt = () => {
    if (onDownloadReceipt && successInvoice) {
      onDownloadReceipt(successInvoice);
    }
  };

  return (
    <div className="space-y-5">
      {/* Upper Mode Selector Options */}
      {simulationState === 'idle' && !success && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
              {isEn ? "Select payment method" : "Sélectionnez votre moyen de règlement"}
            </label>
            <button
              type="button"
              onClick={() => setShowSandboxConsole(!showSandboxConsole)}
              className="text-[10px] font-bold text-indigo-650 hover:text-indigo-800 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Terminal className="h-3.5 w-3.5" />
              {showSandboxConsole ? (isEn ? "Hide API Sandbox" : "Masquer Sandbox") : (isEn ? "Show API Sandbox" : "Développeur API Console")}
            </button>
          </div>
          
          <div className={`grid grid-cols-1 ${[cardEnabled, (mtnEnabled || orangeEnabled || waveEnabled), true].filter(Boolean).length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5`}>
            {/* Card Button option */}
            {cardEnabled && (
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
                  <span className="text-xs font-bold block leading-tight">{isEn ? "Credit Card" : "Carte Bancaire"}</span>
                  <span className="text-[10px] text-slate-505 truncate block">Visa, Mastercard</span>
                </div>
                {paymentMethod === 'card' && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 sm:block hidden" />
                )}
              </button>
            )}

            {/* Momo SMS Push Button option */}
            {(mtnEnabled || orangeEnabled || waveEnabled) && (
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
                  <span className="text-[10px] text-slate-505 truncate block">
                    {[mtnEnabled && 'MTN', orangeEnabled && 'Orange', waveEnabled && 'Wave'].filter(Boolean).join(', ')}
                  </span>
                </div>
                {paymentMethod === 'momo' && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 sm:block hidden" />
                )}
              </button>
            )}

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
                <span className="text-xs font-bold block leading-tight">{isEn ? "Mobile QR Code" : "Code QR Mobile"}</span>
                <span className="text-[10px] text-slate-505 truncate block">{isEn ? "Scan & Validate" : "Scanner & Valider"}</span>
              </div>
              {paymentMethod === 'qr' && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 sm:block hidden" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Payment Forms & Interactive Simulator */}
      <div className="mt-4 bg-slate-50/60 rounded-2xl border border-slate-150 p-5">
        <AnimatePresence mode="wait">
          {simulationState === 'idle' ? (
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
                    <label className="text-xs font-bold text-slate-600 block">{isEn ? "Cardholder Name" : "Titulaire de la carte"}</label>
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
                    <label className="text-xs font-bold text-slate-600 block">{isEn ? "Card Number" : "Numéro de carte bancaire"}</label>
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
                      <label className="text-xs font-bold text-slate-600 block">{isEn ? "Expiration Date" : "Date d'expiration"}</label>
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
                    <label className="text-xs font-bold text-slate-600 block">{isEn ? "Select Mobile Money Operator" : "Sélectionnez votre opérateur Mobile Money"}</label>
                    <div className={`grid grid-cols-${[mtnEnabled, orangeEnabled, waveEnabled].filter(Boolean).length || 1} gap-2`}>
                      {mtnEnabled && (
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
                      )}
                      
                      {orangeEnabled && (
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
                      )}

                      {waveEnabled && (
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
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">{isEn ? "Payer Phone Number" : "Numéro de téléphone payeur"}</label>
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
                      <span>{isEn ? "A simulated API validation request will test Mobile Money integration and generate a transactional token." : "Une requête simulée de validation d'API testera l'intégration Mobile Money et générera un jeton transactionnel."}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. QR-CODE SCAN METHOD OPTION */}
              {paymentMethod === 'qr' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">{isEn ? "QR Code Operator" : "Opérateur du code QR à générer"}</label>
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
                      {isEn 
                        ? `Scan this QR code with your ${provider === 'mtn' ? 'MTN MoMo' : provider === 'orange' ? 'Orange Money' : 'Wave'} mobile transaction app to validate payment.` 
                        : `Scannez ce code QR avec l'option de règlement de votre application mobile ${provider === 'mtn' ? 'MTN MoMo' : provider === 'orange' ? 'Orange Money' : 'Wave'} pour payer.`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Secure payment confirmation button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 hover:shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  {paymentMethod === 'qr' ? (isEn ? "Simulate Validation by QR Scan" : "Simuler validation par Scan QR") : (isEn ? `Pay ${invoice.amount.toLocaleString()} FCFA via Gateway` : `Payer ${invoice.amount.toLocaleString()} FCFA via API`)}
                </button>
              </div>

              <div className="text-center font-mono text-[9px] text-slate-400 flex items-center justify-center gap-1 select-none">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Cryptage SSL 256 bits • Banque Agréée BCEAO/BEAC
              </div>
            </form>
          ) : (
            /* ACTIVE API / TRANSITION / VERIFICATION CHALLENGE SIMULATION COMPONENT */
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 py-2"
            >
              {/* STEP 1: Gateway Handshake */}
              {simulationState === 'handshake' && (
                <div className="text-center py-6 space-y-4">
                  <div className="relative inline-flex">
                    <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
                    <Cpu className="h-5 w-5 text-indigo-500 absolute top-2.5 left-2.5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                      {isEn ? "Establishing SSL API Handshake..." : "Connexion à la passerelle de paiement..."}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      {isEn ? "Securing channel with core bank processing acquirer..." : "Sécurisation de la liaison et négociation SSL avec l'opérateur financier..."}
                    </p>
                  </div>
                  <div className="text-xs text-indigo-700 font-mono font-bold bg-indigo-50 border border-indigo-100 rounded px-3 py-1.5 inline-block animate-pulse">
                    POST /api/v1/payments/initialize
                  </div>
                </div>
              )}

              {/* STEP 2: Interactive Verification OTP / PIN Challenge */}
              {simulationState === 'challenge' && (
                <div className="space-y-4">
                  {paymentMethod === 'momo' ? (
                    /* MOBILE PHONE INTERACTIVE MOCKUP FOR PIN INPUT */
                    <div className="max-w-[280px] mx-auto bg-slate-900 text-white rounded-[32px] p-4.5 shadow-2xl border-4 border-slate-700 relative overflow-hidden">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-700 rounded-b-xl z-20" />
                      
                      {/* Screen Content */}
                      <div className="bg-slate-950 rounded-[22px] p-3 pt-6 min-h-[340px] flex flex-col justify-between relative z-10 font-sans text-center">
                        <div className="space-y-2 mt-2">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center mx-auto text-white font-black text-xs ${provider === 'mtn' ? 'bg-amber-500' : provider === 'orange' ? 'bg-orange-500' : 'bg-sky-500'}`}>
                            {provider === 'mtn' ? 'M' : provider === 'orange' ? 'O' : 'W'}
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                              {provider === 'mtn' ? 'MTN Mobile Money' : provider === 'orange' ? 'Orange Money' : 'Wave Pay'}
                            </p>
                            <p className="text-xs font-bold leading-tight">
                              {isEn ? "Authorize Payment of:" : "Autoriser le versement de :"}
                            </p>
                            <p className="text-sm font-black text-emerald-400 font-mono">
                              {invoice.amount.toLocaleString()} FCFA
                            </p>
                            <p className="text-[8.5px] text-slate-500 truncate">
                              Réf: {invoice.id.toUpperCase()}
                            </p>
                          </div>
                        </div>

                        {/* PIN dot entry display */}
                        <div className="space-y-3 my-3">
                          <p className="text-[9.5px] text-slate-400 font-medium">
                            {isEn ? "Enter your 4-digit PIN Code:" : "Saisissez votre code PIN secret :"}
                          </p>
                          <div className="flex justify-center gap-3">
                            {[0, 1, 2, 3].map((idx) => (
                              <div 
                                key={idx} 
                                className={`h-3.5 w-3.5 rounded-full border-2 border-slate-500 transition-all ${
                                  momoPin.length > idx ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'
                                }`}
                              />
                            ))}
                          </div>
                          {error && <p className="text-[8.5px] text-rose-400 font-bold leading-tight animate-shake">{error}</p>}
                        </div>

                        {/* PIN keypad */}
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-3 gap-1.5 max-w-[180px] mx-auto">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => momoPin.length < 4 && setMomoPin(prev => prev + num)}
                                className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-xs font-bold active:scale-95 transition-transform flex items-center justify-center cursor-pointer select-none"
                              >
                                {num}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setMomoPin('')}
                              className="h-8 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-bold text-[9.5px] flex items-center justify-center cursor-pointer select-none"
                            >
                              {isEn ? "Clear" : "Effacer"}
                            </button>
                            <button
                              type="button"
                              onClick={() => momoPin.length < 4 && setMomoPin(prev => prev + '0')}
                              className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-xs font-bold active:scale-95 flex items-center justify-center cursor-pointer select-none"
                            >
                              0
                            </button>
                            <button
                              type="button"
                              onClick={submitMomoPinChallenge}
                              className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-tighter flex items-center justify-center cursor-pointer select-none shadow-md"
                            >
                              {isEn ? "OK" : "Valider"}
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            onClick={resetSimulator}
                            className="text-[9px] text-slate-500 hover:text-slate-300 mt-2 block mx-auto underline cursor-pointer"
                          >
                            {isEn ? "Cancel transaction" : "Annuler l'opération"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* CARD 3D-SECURE SECURE INPUT PORTAL */
                    <div className="max-w-sm mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fade-in">
                      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {cardNumber.startsWith('4') ? 'Visa Secure Auth' : 'Mastercard Identity Check'}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-slate-400">Merchant: PasmaSys</span>
                      </div>

                      <div className="p-5 space-y-4 text-center">
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">
                            {isEn ? "A transaction confirmation SMS was sent to your phone number:" : "Un SMS de confirmation a été transmis à votre numéro enregistré :"}
                          </p>
                          <p className="text-xs font-bold font-mono text-slate-800">
                            +237 ******99
                          </p>
                        </div>

                        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 max-w-xs mx-auto text-left flex items-start gap-2.5">
                          <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-indigo-950 font-extrabold uppercase">
                              {isEn ? "Simulator SMS Receiver" : "Simulateur SMS Reçu"}
                            </p>
                            <p className="text-[11px] text-indigo-900 font-medium">
                              {isEn ? `Use authorization code : ` : `Saisissez le code secret : `}
                              <strong className="font-mono bg-indigo-200 px-1 py-0.5 rounded text-indigo-950 font-black tracking-wide">
                                {otpSent}
                              </strong>
                            </p>
                          </div>
                        </div>

                        <div className="max-w-[200px] mx-auto space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide block">
                            {isEn ? "Verification Code (OTP)" : "Code de Validation Unique"}
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="••••"
                            value={cardOtp}
                            onChange={(e) => setCardOtp(e.target.value.replace(/\D/g, ''))}
                            className="w-full text-center px-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-bold tracking-widest font-mono focus:outline-hidden focus:border-indigo-500 transition-colors"
                          />
                          {error && <p className="text-[9.5px] text-rose-600 font-semibold animate-shake mt-1">{error}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto pt-2">
                          <button
                            type="button"
                            onClick={resetSimulator}
                            className="py-2 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                          >
                            {isEn ? "Cancel" : "Abandonner"}
                          </button>
                          <button
                            type="button"
                            onClick={submitCardOtpChallenge}
                            className="py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                          >
                            {isEn ? "Verify & Approve" : "Vérifier & Valider"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Cryptographic validation */}
              {simulationState === 'validating' && (
                <div className="text-center py-8 space-y-4">
                  <div className="relative inline-flex">
                    <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin" />
                    <ShieldCheck className="h-5 w-5 text-emerald-500 absolute top-2.5 left-2.5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                      {isEn ? "Authenticating security token..." : "Authentification du jeton sécurisé..."}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      {isEn ? "Validating bank signature with provider ledger..." : "Approbation de la signature cryptographique et écriture dans le livre des comptes..."}
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 4: Successful Transaction token registration output */}
              {simulationState === 'success' && (
                <div className="text-center py-6 space-y-4" id="payment_gateway_success_view">
                  <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-emerald-705">
                      {isEn ? "Payment Gateway Approved !" : "Règlement API Validé !"}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                      {isEn ? "Your transaction has been approved and saved successfully." : "Votre transaction a été approuvée et enregistrée avec succès."}
                    </p>
                  </div>

                  <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-4 max-w-xs mx-auto text-left space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-emerald-805 text-[10px] font-black uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      {isEn ? "TRANSACTION PROOF" : "RÉCÉPISSÉ NUMÉRIQUE API"}
                    </div>
                    <div className="font-mono text-slate-600 text-[10px] leading-relaxed break-all space-y-1 pt-1 border-t border-emerald-100">
                      <p><strong className="text-slate-800">Jeton:</strong> {generatedToken}</p>
                      <p><strong className="text-slate-800">Montant:</strong> {invoice.amount.toLocaleString()} FCFA</p>
                      <p><strong className="text-slate-800">Date:</strong> {new Date().toISOString().split('T')[0]}</p>
                      <p><strong className="text-slate-800">Canal:</strong> {paymentMethod.toUpperCase()}</p>
                    </div>
                  </div>

                  {/* PDF Receipt & Close buttons */}
                  <div className="flex flex-col gap-2 max-w-xs mx-auto pt-3">
                    <button
                      type="button"
                      id="download_receipt_btn"
                      onClick={handleDownloadReceipt}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-97"
                    >
                      <Download className="h-4 w-4" />
                      {isEn ? 'Download Receipt (PDF)' : 'Télécharger le Reçu (PDF)'}
                    </button>
                    
                    <button
                      type="button"
                      id="close_payment_modal_btn"
                      onClick={onCancel}
                      className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer text-center"
                    >
                      {isEn ? 'Close & Return' : 'Fermer & Retourner'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* API SANDBOX CONSOLE LOGGER (VISIBLE ON TOGGLE) */}
      <AnimatePresence>
        {showSandboxConsole && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl overflow-hidden shadow-xl font-mono text-[10.5px]">
              {/* Header */}
              <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="font-bold text-slate-300">Sandbox API Monitor & Logs (MTN / Orange / Card)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-extrabold uppercase text-emerald-400 tracking-wider">Gateway: Mock Active</span>
                </div>
              </div>

              {/* Logs Content area */}
              <div className="p-4 space-y-3 max-h-[190px] overflow-y-auto min-h-[100px] bg-slate-925 scrollbar-thin">
                {sandboxLogs.length === 0 ? (
                  <p className="text-slate-500 italic text-center py-6">
                    [Console vide. Lancez un paiement pour afficher les logs d'appels API Mobile Money et Carte Bancaire en temps réel]
                  </p>
                ) : (
                  sandboxLogs.map((log, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-500 text-[9.5px] select-none shrink-0">[{log.timestamp}]</span>
                        <span className={`text-[9.5px] font-black uppercase shrink-0 px-1 rounded ${
                          log.type === 'request' ? 'bg-indigo-950 text-indigo-400 border border-indigo-900' :
                          log.type === 'response' ? 'bg-slate-950 text-slate-350 border border-slate-800' :
                          log.type === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                          log.type === 'error' ? 'bg-rose-950 text-rose-400 border border-rose-900' :
                          'bg-slate-900 text-indigo-300'
                        }`}>
                          {log.type}
                        </span>
                        <p className={`font-medium ${log.type === 'error' ? 'text-rose-300' : log.type === 'success' ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {log.message}
                        </p>
                      </div>
                      
                      {log.payload && (
                        <pre className="ml-14 bg-slate-950/80 p-2.5 rounded-lg border border-slate-850/60 text-[10px] text-indigo-300 overflow-x-auto max-w-[90%]">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
                <div ref={consoleBottomRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  {isEn ? "Confirm Payment" : "Confirmer le règlement"}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isEn ? "Are you sure you want to process payment of " : "Êtes-vous sûr de vouloir marquer cette facture d'un montant de "}
                  <strong className="text-indigo-700 font-mono font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded">
                    {invoice.amount.toLocaleString()} FCFA
                  </strong>{" "}
                  {isEn ? "and mark it as Paid?" : "comme PAYÉE ?"}
                </p>
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-left space-y-1 text-[11px] text-slate-600">
                  <p className="font-extrabold text-slate-800 truncate"> {isEn ? "Title :" : "Libellé :"} {invoice.title}</p>
                  <p className="font-mono text-slate-400 text-[10px]">Réf : {invoice.id.toUpperCase()}</p>
                  <p className="text-slate-500 font-semibold">
                    Mode : {paymentMethod === 'card' ? '💳 Carte Bancaire' : paymentMethod === 'momo' ? '📱 Mobile Money' : '📶 Code QR Mobile'}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 font-medium font-sans">
                  {isEn ? "This will trigger the simulated integration flow and generate a persistent transactional token." : "Cette action lancera le flux d'intégration simulé et générera un jeton transactionnel persistant."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="py-2.5 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  {isEn ? "Cancel" : "Annuler"}
                </button>
                <button
                  type="button"
                  onClick={executePaymentSimulation}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4 text-white" />
                  {isEn ? "Yes, Confirm" : "Oui, Confirmer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
