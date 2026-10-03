import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { 
  Activity, CheckCircle, AlertCircle, Info, Copy, ShieldCheck, 
  RefreshCw, Trash2, Terminal, Settings, Key, Globe, Check, Lock, AlertTriangle
} from 'lucide-react';

interface WebhookLog {
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
}

interface ServerCampayStatus {
  isWebhookKeyConfigured: boolean;
  isTokenConfigured: boolean;
  environment: string;
}

export default function PaymentWebhookHandler() {
  const [copied, setCopied] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [inMemoryLogs, setInMemoryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerCampayStatus | null>(null);

  const webhookBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://pasma-sys-backend.onrender.com' : window.location.origin)).replace(/\/+$/, '');
  const webhookUrl = `${webhookBaseUrl}/api/campay-webhook`;

  // Fetch logs & server security status on mount
  useEffect(() => {
    fetchLogs();
    fetchServerStatus();
  }, []);

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

  const fetchLogs = async () => {
    setLoading(true);
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
              synced: data.synced === true
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
          amount: m.body?.amount || '0',
          phone: m.body?.phone || '',
          operator: m.body?.operator || '',
          verified: m.isValid === true,
          financialVerified: m.financialVerified === true,
          timestamp: m.timestamp || new Date().toISOString(),
          payloadJson: JSON.stringify(m.body || {}),
          synced: false
        }));
        setWebhookLogs(fallbackLogs);
      }
    } catch (err: any) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
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
      if (!idToken) throw new Error("Authentification super-administrateur requise.");
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

  // Payment records are reconciled exclusively by the server after signature, reference, and amount checks.
  const handleSynchronizeDb = async () => {
    setSyncing(true);
    setSyncStatus("Actualisation des événements Campay...");
    await Promise.all([fetchLogs(), fetchServerStatus()]);
    setSyncStatus("Les règlements portail sont rapprochés et comptabilisés par le backend ; aucune écriture financière n'est effectuée depuis le navigateur.");
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Endpoint Credentials */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                <Activity className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-black tracking-tight text-white">Routeur Webhook Campay & Audit de Sécurité</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                HMAC-SHA256 Actif
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Surveillance cryptographique en temps réel des notifications de paiement Campay. Seules les requêtes avec signature valide sont certifiées et imputées aux registres comptables.
            </p>
          </div>

          <button
            onClick={() => { fetchLogs(); fetchServerStatus(); }}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-3xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Callback URL Setup detail */}
        <div className="mt-6 border-t border-slate-800/80 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Globe className="h-3 w-3 text-indigo-400" /> URL de Callback Publique (Webhook)
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
                title="Copier l'URL de callback"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Renseignez cette URL exacte dans le tableau de bord développeur Campay pour recevoir les notifications de paiement.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Lock className="h-3 w-3 text-emerald-400" /> Protection Cryptographique du Secret
            </span>
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${serverStatus?.isWebhookKeyConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="font-mono font-bold text-slate-200">CAMPAY_WEBHOOK_KEY</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                serverStatus?.isWebhookKeyConfigured 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {serverStatus?.isWebhookKeyConfigured ? 'Configuré & Sécurisé' : 'À configurer (.env)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Le secret d'application est strictement conservé sur le serveur backend. Aucune clé sensible n'est injectée dans le navigateur.
            </p>
          </div>
        </div>
      </div>

      {/* Main split dashboard body: Left: Security Architecture, Right: Live logs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Security Architecture & Protocol Panel (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-950">Garanties d'Intégrité Financière</h3>
            </div>
            
            <div className="space-y-3 text-xs leading-relaxed text-slate-600">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Vérification par Signature HMAC-SHA256
                </div>
                <p className="text-[11px] text-slate-500">
                  Chaque requête entrante doit impérativement fournir l'en-tête <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">X-Campay-Signature</code> calculé avec la clé secrète du serveur.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Protection Anti-Timing Attack
                </div>
                <p className="text-[11px] text-slate-500">
                  La comparaison de signature utilise <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">crypto.timingSafeEqual</code> en temps constant pour empêcher toute analyse temporelle par un attaquant.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Rejet Systématique des Simulations
                </div>
                <p className="text-[11px] text-slate-500">
                  Les endpoints de simulation et les en-têtes de contournement sont définitivement désactivés. Aucune quittance ne peut être générée sans versement bancaire certifié.
                </p>
              </div>
            </div>
          </div>

          {/* Database Sync Panel */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
              <h4 className="text-xs font-black uppercase text-slate-950 tracking-wider">Synchroniseur de Registre Certifié</h4>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              La signature HMAC seule ne suffit pas : le backend rapproche la référence et le montant d'une demande créée par le serveur, puis comptabilise les redevances portail une seule fois.
            </p>

            <button
              onClick={handleSynchronizeDb}
              disabled={syncing || webhookLogs.length === 0}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? "Vérification en cours..." : "Vérifier les règlements confirmés"}
            </button>

            {syncStatus && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start gap-2 text-xs text-emerald-800">
                <Info className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <p className="font-semibold">{syncStatus}</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Incoming Webhooks / Audit Log (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-slate-700" />
                <h3 className="text-sm font-black text-slate-950">Journal des Événements Webhook Reçus</h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                  {webhookLogs.length}
                </span>
              </div>

              {inMemoryLogs.length > 0 && (
                <button
                  onClick={handleClearInMemory}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition cursor-pointer"
                  title="Purger le cache en mémoire"
                >
                  <Trash2 className="h-3 w-3" /> Purger la mémoire
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                <span className="text-xs font-semibold">Chargement des événements de paiement...</span>
              </div>
            ) : webhookLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Activity className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">Aucun événement webhook reçu pour l'instant.</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Dès qu'un parent ou un établissement valide un paiement sur Campay, la notification apparaîtra ici en temps réel avec son empreinte de signature HMAC.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {webhookLogs.map((log) => {
                  const isSuccess = log.status === 'SUCCESSFUL';
                  const isFailed = log.status === 'FAILED';
                  return (
                    <div 
                      key={log.id} 
                      className={`p-4 rounded-2xl border transition-all text-xs space-y-2.5 ${
                        isSuccess 
                          ? 'bg-slate-50/60 border-slate-200/80 hover:border-slate-300' 
                          : isFailed
                            ? 'bg-rose-50/30 border-rose-200/60'
                            : 'bg-amber-50/30 border-amber-200/60'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isSuccess 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : isFailed
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {log.status}
                          </span>

                          <span className="font-mono font-bold text-slate-800">
                            {log.reference}
                          </span>

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
                            {log.verified ? 'Signature HMAC Valide' : 'Non Vérifiée'}
                          </span>
                            {log.verified && (
                              <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                log.financialVerified
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {log.financialVerified ? 'Demande rapprochée' : 'Non rapprochée'}
                              </span>
                            )}
                        </div>
                      </div>

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
                          <span className="font-medium text-slate-700">{new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </div>

                      {log.payloadJson && log.payloadJson !== '{}' && (
                        <details className="text-[10px] text-slate-500 cursor-pointer">
                          <summary className="font-bold hover:text-slate-800 transition">Voir le payload JSON brut</summary>
                          <pre className="mt-1.5 p-2 bg-slate-900 text-slate-300 rounded-xl overflow-x-auto font-mono text-[9.5px]">
                            {log.payloadJson}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
