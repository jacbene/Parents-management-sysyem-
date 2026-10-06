import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { 
  Activity, CheckCircle, AlertCircle, Info, Copy, ShieldCheck, 
  RefreshCw, Trash2, Terminal, Settings, Key, Globe, Check, Lock, AlertTriangle,
  Search, Filter, Play, Pause, ChevronDown, ChevronRight, XCircle,
  ArrowUpRight, CheckCircle2, Stethoscope, Wifi, ShieldAlert
} from 'lucide-react';

export interface WebhookLog {
  id: string;
  reference: string;
  status: string;
  amount: string;
  phone: string;
  operator: string;
  verified: boolean;
  financialVerified: boolean;
  timestamp: string;
  payloadJson: string;
  synced?: boolean;
  diagnosticError?: string | null;
  failureReason?: string | null;
  signature?: string;
  computedSignature?: string;
  clientIp?: string;
  reconciliationType?: 'portal_fee' | 'tuition' | 'unknown';
}

interface ServerCampayStatus {
  isWebhookKeyConfigured: boolean;
  isTokenConfigured: boolean;
  isPaymentLedgerConfigured: boolean;
  environment: string;
}

interface DiagnosticReport {
  timestamp: string;
  configuration: {
    isWebhookKeyConfigured: boolean;
    isTokenConfigured: boolean;
    isPaymentLedgerConfigured: boolean;
    ledgerError: string | null;
    environment: string;
  };
  metrics: {
    totalReceived: number;
    validSignatures: number;
    reconciledPayments: number;
    failedSignatures: number;
    telcoFailed: number;
    reconciliationAnomalies: number;
  };
  recentFailures: any[];
}

export default function PaymentWebhookHandler() {
  const [copied, setCopied] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [inMemoryLogs, setInMemoryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerCampayStatus | null>(null);
  
  // Real-time polling toggle
  const [autoRefresh, setAutoRefresh] = useState(true);
  const autoRefreshTimerRef = useRef<any>(null);

  // Filters & search
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESSFUL' | 'SIGNATURE_ERROR' | 'RECONCILIATION_ERROR' | 'TELCO_FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Diagnostic Report modal
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  // Expanded payloads map
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  const webhookBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://pasma-sys-backend.onrender.com' : window.location.origin)).replace(/\/+$/, '');
  const webhookUrl = `${webhookBaseUrl}/api/campay-webhook`;

  // Fetch logs & server security status on mount
  useEffect(() => {
    fetchLogs();
    fetchServerStatus();
  }, []);

  // Set up auto-refresh interval
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchLogs(true);
      }, 4000);
    } else if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [autoRefresh]);

  const fetchServerStatus = async () => {
    try {
      const res = await fetch(`${webhookBaseUrl}/api/campay/status`);
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch (err) {
      console.warn("Impossible de joindre le statut serveur Campay:", err);
    }
  };

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    let freshInMemory: any[] = [];
    try {
      const idToken = await auth.currentUser?.getIdToken();
      // 1. Fetch verified in-memory logs from the backend
      const memResponse = idToken
        ? await fetch(`${webhookBaseUrl}/api/campay/webhooks`, {
            headers: { "Authorization": `Bearer ${idToken}` }
          }).catch(() => null)
        : null;
      if (memResponse && memResponse.ok) {
        const data = await memResponse.json();
        if (data.success) {
          freshInMemory = data.webhooks || [];
          setInMemoryLogs(freshInMemory);
        }
      }

      // 2. Fetch persisted logs from Firestore invoices collection (id starting with log_webhook_)
      try {
        const qInvoices = query(collection(db, 'invoices'));
        const snapshot = await getDocs(qInvoices);
        const fetchedPersisted: WebhookLog[] = [];
        
        snapshot.forEach((d) => {
          const id = d.id;
          if (id.startsWith('log_webhook_')) {
            const data = d.data();
            fetchedPersisted.push({
              id,
              reference: data.reference || id.replace('log_webhook_', ''),
              status: data.status || 'PENDING',
              amount: data.amount || '0',
              phone: data.phone || '',
              operator: data.operator || '',
              verified: data.verified === true,
              financialVerified: data.financialVerified === true,
              timestamp: data.timestamp || new Date().toISOString(),
              payloadJson: data.payloadJson || '{}',
              synced: data.synced === true,
              diagnosticError: data.diagnosticError || null,
              failureReason: data.failureReason || null,
              signature: data.signature,
              computedSignature: data.computedSignature,
              clientIp: data.clientIp,
              reconciliationType: data.reconciliationType
            });
          }
        });

        // Merge in-memory events that might not be in Firestore yet
        freshInMemory.forEach((m: any) => {
          const exists = fetchedPersisted.some(p => p.reference === m.reference);
          if (!exists) {
            fetchedPersisted.unshift({
              id: `in_mem_${m.reference}_${m.timestamp}`,
              reference: m.reference,
              status: m.status,
              amount: m.body?.amount ?? m.body?.data?.amount ?? '0',
              phone: m.body?.phone ?? m.body?.data?.phone ?? m.body?.from ?? '',
              operator: m.body?.operator ?? m.body?.data?.operator ?? '',
              verified: m.isValid === true,
              financialVerified: m.financialVerified === true,
              timestamp: m.timestamp || new Date().toISOString(),
              payloadJson: typeof m.body === 'string' ? m.body : JSON.stringify(m.body || {}),
              synced: m.synced === true,
              diagnosticError: m.diagnosticError || null,
              failureReason: m.failureReason || null,
              signature: m.signature,
              computedSignature: m.computedSignature,
              clientIp: m.clientIp,
              reconciliationType: m.reconciliationType
            });
          }
        });

        // Sort by timestamp descending
        fetchedPersisted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setWebhookLogs(fetchedPersisted);
      } catch (firestoreErr: any) {
        console.info("Firestore Webhook logs query restriction:", firestoreErr.message || firestoreErr);
        
        const fallbackLogs: WebhookLog[] = (freshInMemory.length > 0 ? freshInMemory : inMemoryLogs).map((m: any) => ({
          id: `log_webhook_${m.reference}`,
          reference: m.reference,
          status: m.status,
          amount: m.body?.amount ?? m.body?.data?.amount ?? '0',
          phone: m.body?.phone ?? m.body?.data?.phone ?? m.body?.from ?? '',
          operator: m.body?.operator ?? m.body?.data?.operator ?? '',
          verified: m.isValid === true,
          financialVerified: m.financialVerified === true,
          timestamp: m.timestamp || new Date().toISOString(),
          payloadJson: typeof m.body === 'string' ? m.body : JSON.stringify(m.body || {}),
          synced: m.synced === true,
          diagnosticError: m.diagnosticError || null,
          failureReason: m.failureReason || null,
          signature: m.signature,
          computedSignature: m.computedSignature,
          clientIp: m.clientIp,
          reconciliationType: m.reconciliationType
        }));
        setWebhookLogs(fallbackLogs);
      }
    } catch (err: any) {
      console.error("Failed to load logs:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearInMemory = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentification requise.");
      const response = await fetch(`${webhookBaseUrl}/api/campay/webhooks/clear`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error(`Échec de l'effacement du journal (${response.status}).`);
      setInMemoryLogs([]);
      fetchLogs();
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  const handleRunDiagnostic = async () => {
    setDiagnosticLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`${webhookBaseUrl}/api/campay/diagnose`, {
        headers: {
          ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDiagnosticReport(data);
        setShowDiagnosticModal(true);
      } else {
        // Fallback to /status if diagnose requires superadmin and wasn't accessible
        await fetchServerStatus();
        setDiagnosticReport({
          timestamp: new Date().toISOString(),
          configuration: {
            isWebhookKeyConfigured: Boolean(serverStatus?.isWebhookKeyConfigured),
            isTokenConfigured: Boolean(serverStatus?.isTokenConfigured),
            isPaymentLedgerConfigured: Boolean(serverStatus?.isPaymentLedgerConfigured),
            ledgerError: null,
            environment: serverStatus?.environment || "production"
          },
          metrics: {
            totalReceived: webhookLogs.length,
            validSignatures: webhookLogs.filter(w => w.verified).length,
            reconciledPayments: webhookLogs.filter(w => w.financialVerified && w.synced).length,
            failedSignatures: webhookLogs.filter(w => !w.verified).length,
            telcoFailed: webhookLogs.filter(w => w.status === 'FAILED').length,
            reconciliationAnomalies: webhookLogs.filter(w => w.verified && !w.financialVerified).length
          },
          recentFailures: webhookLogs.filter(w => !w.verified || !w.financialVerified || w.status === 'FAILED').slice(0, 10)
        });
        setShowDiagnosticModal(true);
      }
    } catch (err: any) {
      console.error("Diagnostic probe failed:", err);
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleSynchronizeDb = async () => {
    setSyncing(true);
    setSyncStatus("Actualisation des événements Campay en temps réel...");
    await Promise.all([fetchLogs(), fetchServerStatus()]);
    setSyncStatus("Les règlements portail et scolarité sont rapprochés et imputés sur le serveur selon l'empreinte cryptographique.");
    setSyncing(false);
  };

  const togglePayloadExpand = (id: string) => {
    setExpandedPayloads(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // KPI Calculations
  const totalCount = webhookLogs.length;
  const verifiedCount = webhookLogs.filter(l => l.verified).length;
  const financialSuccessCount = webhookLogs.filter(l => l.verified && l.financialVerified && l.synced).length;
  const signatureErrorsCount = webhookLogs.filter(l => !l.verified).length;
  const reconciliationErrorsCount = webhookLogs.filter(l => l.verified && !l.financialVerified).length;
  const telcoFailedCount = webhookLogs.filter(l => l.status === 'FAILED' || l.failureReason === 'TELCO_REJECTED').length;
  const totalAnomalies = signatureErrorsCount + reconciliationErrorsCount + telcoFailedCount;

  // Filtered logs
  const filteredLogs = webhookLogs.filter(log => {
    // 1. Status Filter
    if (statusFilter === 'SUCCESSFUL' && (!log.verified || !log.financialVerified || log.status !== 'SUCCESSFUL')) return false;
    if (statusFilter === 'SIGNATURE_ERROR' && log.verified) return false;
    if (statusFilter === 'RECONCILIATION_ERROR' && (!log.verified || log.financialVerified)) return false;
    if (statusFilter === 'TELCO_FAILED' && log.status !== 'FAILED' && log.failureReason !== 'TELCO_REJECTED') return false;

    // 2. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const refMatch = (log.reference || '').toLowerCase().includes(q);
      const phoneMatch = (log.phone || '').toLowerCase().includes(q);
      const operatorMatch = (log.operator || '').toLowerCase().includes(q);
      const errorMatch = (log.diagnosticError || '').toLowerCase().includes(q);
      return refMatch || phoneMatch || operatorMatch || errorMatch;
    }

    return true;
  });

  return (
    <div className="space-y-6" id="campay-webhook-monitoring-root">
      {/* Top Banner & Telemetry Header */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                <Activity className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-black tracking-tight text-white">Monitoring Webhooks Campay & Diagnostic Temps Réel</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> HMAC-SHA256 Actif
              </span>
              {autoRefresh && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Écoute en direct (4s)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Surveillance cryptographique et comptable des notifications de paiement Campay (frais de portail pour les directeurs & frais de scolarité pour les parents). Seules les transactions certifiées et rapprochées sont imputées.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                autoRefresh 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800 hover:bg-emerald-900' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title={autoRefresh ? "Désactiver l'actualisation automatique" : "Activer l'écoute automatique"}
            >
              {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRefresh ? "Pause" : "Direct"}
            </button>

            <button
              onClick={handleRunDiagnostic}
              disabled={diagnosticLoading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Tester la santé de la passerelle et des clés de sécurité"
            >
              <Stethoscope className={`h-3.5 w-3.5 ${diagnosticLoading ? 'animate-spin' : ''}`} />
              Test Passerelle
            </button>

            <button
              onClick={() => { fetchLogs(); fetchServerStatus(); }}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Callback URL & Gateway Security credentials summary */}
        <div className="mt-6 border-t border-slate-800/80 pt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Globe className="h-3 w-3 text-indigo-400" /> URL de Webhook Campay (Serveur)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-300 select-all focus:outline-hidden"
              />
              <button
                onClick={handleCopyUrl}
                className={`p-2.5 rounded-xl border text-xs transition cursor-pointer shrink-0 ${
                  copied 
                    ? 'bg-emerald-600 border-emerald-700 text-white' 
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                }`}
                title="Copier l'URL de notification"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              URL à inscrire dans votre tableau de bord Campay (section Webhooks / Développeurs).
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Lock className="h-3 w-3 text-emerald-400" /> Clé Secrète HMAC (CAMPAY_WEBHOOK_KEY)
            </span>
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${serverStatus?.isWebhookKeyConfigured ? 'text-emerald-400' : 'text-rose-400'}`} />
                <span className="font-mono text-[11px] font-bold text-slate-200">CAMPAY_WEBHOOK_KEY</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                serverStatus?.isWebhookKeyConfigured 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {serverStatus?.isWebhookKeyConfigured ? 'Opérationnel' : 'Non configuré'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Certifie l'authenticité de l'en-tête X-Campay-Signature en temps constant.
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Key className="h-3 w-3 text-amber-400" /> Jeton d'API Collecte (CAMPAY_TOKEN)
            </span>
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${serverStatus?.isTokenConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="font-mono text-[11px] font-bold text-slate-200">CAMPAY_TOKEN</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                serverStatus?.isTokenConfigured 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {serverStatus?.isTokenConfigured ? 'Opérationnel' : 'À configurer'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Permet l'envoi de la demande de prélèvement Mobile Money (MTN / Orange).
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards: Instant Health & Metrics overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Notifications Reçues
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">{totalCount}</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Historique
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Signatures HMAC Valides
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 font-mono">
              {totalCount > 0 ? `${Math.round((verifiedCount / totalCount) * 100)}%` : '100%'}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {verifiedCount} validées
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Rapprochements Comptabilisés
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-600 font-mono">{financialSuccessCount}</span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Imputés
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Anomalies & Échecs
          </span>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-black font-mono ${totalAnomalies > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {totalAnomalies}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              totalAnomalies > 0 
                ? 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse' 
                : 'text-slate-500 bg-slate-50 border-slate-200'
            }`}>
              {totalAnomalies === 0 ? '0 incident' : `${totalAnomalies} à diagnostiquer`}
            </span>
          </div>
        </div>
      </div>

      {/* Main split dashboard body: Left: Security Architecture & Actions, Right: Real-time logs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side: Guarantees, Actions & Verification (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Security Architecture & Protocol Panel */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-950">Garanties d'Intégrité Financière</h3>
            </div>
            
            <div className="space-y-3 text-xs leading-relaxed text-slate-600">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Vérification Cryptographique HMAC-SHA256
                </div>
                <p className="text-[11px] text-slate-500">
                  Toute notification doit fournir l'en-tête <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">X-Campay-Signature</code> vérifié avec le secret du serveur via <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">crypto.timingSafeEqual</code>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Rapprochement Idempotent par Référence
                </div>
                <p className="text-[11px] text-slate-500">
                  Le montant et la devise (XAF) sont strictement vérifiés contre l'intention de paiement originale. Une transaction ne peut jamais être imputée deux fois.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Isolation du Registre Financier
                </div>
                <p className="text-[11px] text-slate-500">
                  Aucune écriture comptable n'est exécutée depuis le navigateur. Toutes les mises à jour sont effectuées par le serveur Express sous Firebase Admin SDK.
                </p>
              </div>
            </div>
          </div>

          {/* Verification & Sync Control Panel */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
              <h4 className="text-xs font-black uppercase text-slate-950 tracking-wider">Synchroniseur de Registre</h4>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Actualise la base de données locale avec les notifications confirmées par Campay et force la réconciliation des quittances.
            </p>

            <button
              onClick={handleSynchronizeDb}
              disabled={syncing || webhookLogs.length === 0}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? "Vérification en cours..." : "Actualiser & Rapprocher"}
            </button>

            {syncStatus && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start gap-2 text-xs text-emerald-800">
                <Info className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <p className="font-semibold leading-relaxed">{syncStatus}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live Logs & Diagnostic Workspace (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-slate-700" />
                <h3 className="text-sm font-black text-slate-950">Journal des Notifications Reçues</h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                  {filteredLogs.length} affiché(s)
                </span>
              </div>

              {inMemoryLogs.length > 0 && (
                <button
                  onClick={handleClearInMemory}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition cursor-pointer self-start sm:self-auto"
                  title="Purger le cache en mémoire active"
                >
                  <Trash2 className="h-3 w-3" /> Purger la mémoire
                </button>
              )}
            </div>

            {/* Search and Filters Toolbar */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par référence, numéro de téléphone, opérateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              {/* Status Filter Badges */}
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Toutes ({webhookLogs.length})
                </button>

                <button
                  onClick={() => setStatusFilter('SUCCESSFUL')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    statusFilter === 'SUCCESSFUL'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  Succès certifiés ({financialSuccessCount})
                </button>

                <button
                  onClick={() => setStatusFilter('SIGNATURE_ERROR')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    statusFilter === 'SIGNATURE_ERROR'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50/70 text-rose-800 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  Échecs HMAC ({signatureErrorsCount})
                </button>

                <button
                  onClick={() => setStatusFilter('RECONCILIATION_ERROR')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    statusFilter === 'RECONCILIATION_ERROR'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Anomalies de rapprochement ({reconciliationErrorsCount})
                </button>

                <button
                  onClick={() => setStatusFilter('TELCO_FAILED')}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    statusFilter === 'TELCO_FAILED'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-purple-50/70 text-purple-800 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  Rejets Mobile Money ({telcoFailedCount})
                </button>
              </div>
            </div>

            {/* Logs List Container */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                <span className="text-xs font-semibold">Chargement des événements de paiement...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <Activity className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">
                  {searchQuery || statusFilter !== 'ALL' 
                    ? "Aucun événement correspondant aux critères de filtre." 
                    : "Aucun événement webhook reçu pour l'instant."}
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Dès qu'un parent ou un directeur valide un paiement sur Campay, la notification apparaîtra ici en temps réel avec son diagnostic cryptographique.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredLogs.map((log) => {
                  const isSuccess = log.status === 'SUCCESSFUL' && log.verified && log.financialVerified;
                  const isSignatureFailed = !log.verified;
                  const isReconciliationFailed = log.verified && !log.financialVerified;
                  const isTelcoFailed = log.status === 'FAILED' || log.failureReason === 'TELCO_REJECTED';
                  const isExpanded = expandedPayloads[log.id] || false;

                  return (
                    <div 
                      key={log.id} 
                      className={`p-4 rounded-2xl border transition-all text-xs space-y-2.5 ${
                        isSuccess 
                          ? 'bg-slate-50/70 border-slate-200/90 hover:border-slate-300' 
                          : isSignatureFailed
                            ? 'bg-rose-50/40 border-rose-200'
                            : isTelcoFailed
                              ? 'bg-purple-50/40 border-purple-200'
                              : 'bg-amber-50/40 border-amber-200'
                      }`}
                    >
                      {/* Top Header Row of Event */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isSuccess 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : isSignatureFailed
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : isTelcoFailed
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {log.status}
                          </span>

                          <span className="font-mono font-bold text-slate-800 select-all">
                            {log.reference}
                          </span>

                          {log.reconciliationType && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-200/80 text-slate-700">
                              {log.reconciliationType === 'portal_fee' ? '🏛️ Redevance Portail' : log.reconciliationType === 'tuition' ? '🎓 Scolarité' : 'Notification'}
                            </span>
                          )}

                          {log.synced && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              ✓ Synchronisé
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold flex items-center gap-1 ${
                            log.verified 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {log.verified ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {log.verified ? 'Signature HMAC Valide' : 'Signature Invalide'}
                          </span>

                          {log.verified && (
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider border ${
                              log.financialVerified
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {log.financialVerified ? 'Rapproché' : 'Non Rapproché'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Diagnostic Alert Box when an error or failure exists */}
                      {(log.diagnosticError || log.failureReason || !log.verified || !log.financialVerified || isTelcoFailed) && (
                        <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                          isSignatureFailed
                            ? 'bg-rose-50 text-rose-900 border-rose-200'
                            : isTelcoFailed
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold">
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Diagnostic de Traitement : {log.failureReason || (isSignatureFailed ? 'HMAC_MISMATCH' : isTelcoFailed ? 'TELCO_REJECTED' : 'RECONCILIATION_ISSUE')}
                            </span>
                          </div>
                          <p className="leading-relaxed">
                            {log.diagnosticError || (
                              isSignatureFailed 
                                ? "La signature envoyée par Campay ne correspond pas au secret d'application. Vérifiez la variable CAMPAY_WEBHOOK_KEY sur le serveur."
                                : isTelcoFailed
                                  ? "Paiement refusé sur le téléphone mobile (solde insuffisant, code PIN erroné ou délai expiré)."
                                  : "Aucune intention de paiement ne correspond à cette transaction, ou le montant notifié ne correspond pas à la facture attendue."
                            )}
                          </p>
                        </div>
                      )}

                      {/* Transaction Data Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/60">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Montant</span>
                          <span className="font-bold text-slate-800 font-mono">{Number(log.amount).toLocaleString()} FCFA</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Téléphone</span>
                          <span className="font-medium text-slate-700">{log.phone || "Non spécifié"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Opérateur</span>
                          <span className="font-medium text-slate-700">{log.operator || "Campay Direct"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Horodatage</span>
                          <span className="font-medium text-slate-700">
                            {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Toggleable Raw Payload JSON */}
                      {log.payloadJson && log.payloadJson !== '{}' && (
                        <div>
                          <button
                            onClick={() => togglePayloadExpand(log.id)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {isExpanded ? 'Masquer le payload JSON brut' : 'Inspecter le payload JSON brut'}
                          </button>

                          {isExpanded && (
                            <pre className="mt-1.5 p-3 bg-slate-900 text-slate-300 rounded-xl overflow-x-auto font-mono text-[9.5px] leading-relaxed select-all">
                              {log.payloadJson}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Diagnostic Probe Report Modal */}
      {showDiagnosticModal && diagnosticReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">Rapport de Santé de la Passerelle Campay</h3>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">CAMPAY_WEBHOOK_KEY</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    diagnosticReport.configuration.isWebhookKeyConfigured ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {diagnosticReport.configuration.isWebhookKeyConfigured ? '✓ Configuré' : '✗ Manquant'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">CAMPAY_TOKEN</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    diagnosticReport.configuration.isTokenConfigured ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {diagnosticReport.configuration.isTokenConfigured ? '✓ Configuré' : '✗ Non défini'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Firebase Ledger</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    diagnosticReport.configuration.isPaymentLedgerConfigured ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {diagnosticReport.configuration.isPaymentLedgerConfigured ? '✓ Opérationnel' : '✗ Indisponible'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Statistiques de Diagnostic
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>Total Notifications : <span className="font-bold text-white">{diagnosticReport.metrics.totalReceived}</span></div>
                  <div>Signatures Valides : <span className="font-bold text-emerald-400">{diagnosticReport.metrics.validSignatures}</span></div>
                  <div>Paiements Rapprochés : <span className="font-bold text-indigo-400">{diagnosticReport.metrics.reconciledPayments}</span></div>
                  <div>Échecs Signatures : <span className="font-bold text-rose-400">{diagnosticReport.metrics.failedSignatures}</span></div>
                  <div>Rejets Télécom : <span className="font-bold text-purple-400">{diagnosticReport.metrics.telcoFailed}</span></div>
                  <div>Anomalies Rapprochement : <span className="font-bold text-amber-400">{diagnosticReport.metrics.reconciliationAnomalies}</span></div>
                </div>
              </div>

              {diagnosticReport.recentFailures && diagnosticReport.recentFailures.length > 0 ? (
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block text-[11px]">Derniers Échecs Diagnostiqués :</span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {diagnosticReport.recentFailures.map((f: any, idx: number) => (
                      <div key={idx} className="p-2 bg-rose-50 text-rose-800 rounded-lg text-[10.5px] border border-rose-100 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <span className="font-bold">{f.reference} ({f.status}) : </span>
                          <span>{f.diagnosticError || f.failureReason || 'Échec de traitement'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-center font-bold text-xs">
                  ✓ Aucun échec récent détecté dans la passerelle Campay.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
