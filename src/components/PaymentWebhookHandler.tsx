import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Activity, CheckCircle, AlertCircle, Info, Copy, Cpu, 
  RefreshCw, Play, Trash2, Terminal, Settings, Key, Globe, Check, Eye, EyeOff
} from 'lucide-react';

interface WebhookLog {
  id: string;
  reference: string;
  status: string;
  amount: string;
  phone: string;
  operator: string;
  verified: boolean;
  timestamp: string;
  payloadJson: string;
  synced?: boolean;
}

export default function PaymentWebhookHandler() {
  const [copied, setCopied] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [inMemoryLogs, setInMemoryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  
  // Mask/unmask webhook secret
  const [showWebhookKey, setShowWebhookKey] = useState(false);

  // Simulator Form State
  const [simReference, setSimReference] = useState(`PRTL_demo_school_ekali_${Math.floor(100000 + Math.random() * 900000)}`);
  const [simStatus, setSimStatus] = useState('SUCCESSFUL');
  const [simAmount, setSimAmount] = useState('50000');
  const [simPhone, setSimPhone] = useState('677123456');
  const [simOperator, setSimOperator] = useState('MTN');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    success: boolean;
    message: string;
    signatureVerified?: boolean;
    sentPayload?: any;
    receivedResponse?: any;
  } | null>(null);

  const webhookUrl = `${window.location.origin}/api/campay-webhook`;
  const defaultWebhookKey = "LpEvD_J1lf67b6QOJajBKmZHbeXL42GP0g2ItxEZBONyOnM8DCz6h3ktROPSM75sio2znlrRBEeoPu4JwtObpw";

  // Fetch logs on mount & refresh
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch in-memory logs from the backend
      const memResponse = await fetch('/api/campay/webhooks').catch(() => null);
      if (memResponse && memResponse.ok) {
        const data = await memResponse.json();
        if (data.success) {
          setInMemoryLogs(data.webhooks || []);
        }
      }

      // 2. Fetch persisted logs from Firestore invoices collection (id starting with log_webhook_)
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
            timestamp: data.timestamp || new Date().toISOString(),
            payloadJson: data.payloadJson || '{}',
            synced: data.synced === true
          });
        }
      });

      // Sort by timestamp descending
      fetchedPersisted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setWebhookLogs(fetchedPersisted);
    } catch (err) {
      console.error("Error fetching webhook logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Run self-trigger simulation post on backend
  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimulationResult(null);

    try {
      const response = await fetch('/api/campay/simulate-webhook-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reference: simReference,
          status: simStatus,
          amount: simAmount,
          phone: simPhone,
          operator: simOperator
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const data = await response.json();
      setSimulationResult({
        success: data.success,
        message: data.message,
        signatureVerified: data.signatureVerified,
        sentPayload: data.sentPayload,
        receivedResponse: data.receivedResponse
      });

      // Refresh logs
      fetchLogs();
      
      // Regenerate reference for next simulation
      const prefix = simReference.split('_')[0] === 'PRTL' ? 'PRTL' : 'INV';
      const detail = simReference.split('_')[1] || 'demo_school_ekali';
      setSimReference(`${prefix}_${detail}_${Math.floor(100000 + Math.random() * 900000)}`);
    } catch (err: any) {
      setSimulationResult({
        success: false,
        message: `Erreur de simulation: ${err.message}`
      });
    } finally {
      setSimulating(false);
    }
  };

  // Synchronise simulated/real webhook payments into schools' portal fees or parent invoices
  const handleSynchronizeDb = async () => {
    setSyncing(true);
    setSyncStatus("Démarrage de la synchronisation...");
    let syncedCount = 0;

    try {
      const successfulLogs = webhookLogs.filter(log => log.status === 'SUCCESSFUL' && log.verified && !log.synced);
      
      if (successfulLogs.length === 0) {
        setSyncStatus("Tout est déjà à jour. Aucun nouveau versement vérifié à synchroniser.");
        setSyncing(false);
        return;
      }

      for (const log of successfulLogs) {
        setSyncStatus(`Traitement de la référence ${log.reference}...`);

        if (log.reference.startsWith('PRTL_')) {
          // It's a portal fee payment
          // Reference format: PRTL_schoolId_timestamp
          const parts = log.reference.split('_');
          // SchoolId could have multiple underscores, so reconstruct it
          // PRTL_demo_school_ekali_123456 -> parts are ["PRTL", "demo", "school", "ekali", "123456"]
          // Reconstruct middle elements as school ID
          const schoolId = parts.slice(1, -1).join('_') || parts[1];
          const amountNum = Number(log.amount) || 0;

          if (schoolId) {
            const schoolRef = doc(db, 'establishments', schoolId);
            const schoolSnap = await getDoc(schoolRef);

            if (schoolSnap.exists()) {
              const currentPaid = schoolSnap.data().portalFeesPaid || 0;
              await updateDoc(schoolRef, {
                portalFeesPaid: currentPaid + amountNum
              });

              // Mark webhook log as synced in Firestore
              const logDocRef = doc(db, 'invoices', log.id);
              await updateDoc(logDocRef, { synced: true });
              syncedCount++;
            } else {
              console.warn(`School ${schoolId} not found for webhook sync`);
            }
          }
        } else if (log.reference.startsWith('INV_')) {
          // It's a student invoice payment
          // Reference format: INV_invoiceId_timestamp
          const parts = log.reference.split('_');
          const invoiceId = parts.slice(1, -1).join('_') || parts[1];
          const amountNum = Number(log.amount) || 0;

          if (invoiceId) {
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceSnap = await getDoc(invoiceRef);

            if (invoiceSnap.exists()) {
              await updateDoc(invoiceRef, {
                status: 'Paid',
                amountPaid: amountNum,
                paymentMethod: 'momo_campay',
                paidAt: new Date().toISOString()
              });

              // Mark webhook log as synced in Firestore
              const logDocRef = doc(db, 'invoices', log.id);
              await updateDoc(logDocRef, { synced: true });
              syncedCount++;
            } else {
              console.warn(`Invoice ${invoiceId} not found for webhook sync`);
            }
          }
        }
      }

      setSyncStatus(`Succès ! ${syncedCount} transaction(s) ont été synchronisées dans la base de données.`);
      fetchLogs();
    } catch (err: any) {
      console.error("Sync error:", err);
      setSyncStatus(`Erreur lors de la synchronisation : ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Clear in-memory server logs
  const handleClearServerLogs = async () => {
    if (!confirm("Voulez-vous vraiment vider les logs de webhook en mémoire sur le serveur ?")) return;
    try {
      await fetch('/api/campay/webhooks/clear', { method: 'POST' });
      fetchLogs();
    } catch (err) {}
  };

  return (
    <div className="space-y-6 text-slate-800 font-sans">
      
      {/* Configuration Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-300 relative overflow-hidden shadow-md">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        
        <div className="relative flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
              Synchronisation Active
            </div>
            <h2 className="text-xl font-black text-white">Console d'Intégration Campay & Webhook</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configurez le traitement asynchrone des redevances d'exploitation (1% de frais de portail) et des cotisations APEE parentales collectées en temps réel par Campay.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 transition flex items-center gap-2 cursor-pointer disabled:opacity-55"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Callback URL Setup detail */}
        <div className="mt-6 border-t border-slate-800/80 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Globe className="h-3 w-3 text-indigo-400" /> Pasma-sys Callback URL (Webhook)
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
              Fournissez cette URL à Campay dans vos configurations d'application pour recevoir les statuts de paiement en temps réel.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Key className="h-3 w-3 text-amber-400" /> App Webhook Key (Secret)
            </span>
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <input
                  type={showWebhookKey ? "text" : "password"}
                  readOnly
                  value={defaultWebhookKey}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-3 pr-10 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookKey(!showWebhookKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showWebhookKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Ce secret d'application configuré dans le fichier <strong className="text-slate-400">.env</strong> est utilisé pour valider la signature cryptographique <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300 font-bold">X-Campay-Signature</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Main split dashboard body: Left: Simulator, Right: Live logs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Webhook Simulator (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Cpu className="h-4.5 w-4.5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-950">Simulateur Haute-Fidélité</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Générez et envoyez de fausses requêtes webhook signées avec votre clé secrète réelle pour tester instantanément les routines de vérification cryptographiques et de mise à jour de la base de données.
            </p>

            <form onSubmit={handleRunSimulation} className="space-y-4 text-xs font-medium">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Référence de Transaction</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    value={simReference}
                    onChange={(e) => setSimReference(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/15"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.floor(100000 + Math.random() * 900000);
                      const isPortal = Math.random() > 0.4;
                      setSimReference(isPortal ? `PRTL_demo_school_ekali_${rand}` : `INV_apee_par_bene_jacques_${rand}`);
                    }}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-250 font-bold"
                    title="Aléatoire"
                  >
                    🎲
                  </button>
                </div>
                <p className="text-[9px] text-slate-450">
                  Utilisez le préfixe <code className="bg-slate-100 px-1 py-0.5 rounded font-black text-indigo-700">PRTL_&lt;schoolId&gt;_</code> pour les frais de portail ou <code className="bg-slate-100 px-1 py-0.5 rounded font-black text-indigo-700">INV_&lt;invoiceId&gt;_</code> pour une cotisation parentale.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Statut du Paiement</label>
                  <select
                    value={simStatus}
                    onChange={(e) => setSimStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/15"
                  >
                    <option value="SUCCESSFUL">✅ SUCCESSFUL</option>
                    <option value="FAILED">❌ FAILED</option>
                    <option value="PENDING">⏳ PENDING</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Montant (FCFA)</label>
                  <input
                    type="number"
                    required
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Numéro Téléphone</label>
                  <input
                    type="text"
                    required
                    value={simPhone}
                    onChange={(e) => setSimPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Opérateur</label>
                  <select
                    value={simOperator}
                    onChange={(e) => setSimOperator(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/15"
                  >
                    <option value="MTN">MTN MoMo</option>
                    <option value="ORANGE">Orange Money</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {simulating ? "Envoi de la requête..." : "Déclencher la simulation Webhook"}
              </button>
            </form>

            {/* Simulation Response Output Terminal */}
            {simulationResult && (
              <div className="mt-4 border border-slate-150 rounded-2xl overflow-hidden bg-slate-950 text-[10.5px] font-mono text-slate-300">
                <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-bold flex items-center gap-1">
                    <Terminal className="h-3 w-3 text-indigo-400" /> Sortie Terminal Simulation
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase ${
                    simulationResult.success ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                  }`}>
                    {simulationResult.success ? 'SUCCÈS' : 'ÉCHEC'}
                  </span>
                </div>
                <div className="p-3 space-y-2 leading-relaxed overflow-x-auto max-h-56">
                  <p className="text-indigo-400 font-bold">&gt; {simulationResult.message}</p>
                  
                  {simulationResult.signatureVerified !== undefined && (
                    <p className={simulationResult.signatureVerified ? 'text-emerald-400' : 'text-rose-400'}>
                      🛡️ Signature Cryptographique : {simulationResult.signatureVerified ? 'VALIDE (HMAC SHA256 MATCH)' : 'INVALIDE (MISMATCH)'}
                    </p>
                  )}

                  {simulationResult.sentPayload && (
                    <div className="space-y-1">
                      <p className="text-amber-400">// Payload JSON envoyé :</p>
                      <pre className="text-slate-400 font-bold">{JSON.stringify(simulationResult.sentPayload, null, 2)}</pre>
                    </div>
                  )}

                  {simulationResult.receivedResponse && (
                    <div className="space-y-1">
                      <p className="text-blue-400">// Réponse du routeur Webhook :</p>
                      <pre className="text-slate-400 font-bold">{JSON.stringify(simulationResult.receivedResponse, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Database Sync Panel */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
              <h4 className="text-xs font-black uppercase text-slate-950 tracking-wider">Synchroniseur de Registre Global</h4>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Appliquez les transactions réussies et vérifiées de la passerelle Campay aux écoles correspondantes (frais de redevance d'exploitation) et aux parents d'élèves (statut payé de la cotisation).
            </p>

            <button
              onClick={handleSynchronizeDb}
              disabled={syncing || webhookLogs.length === 0}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? "Synchronisation en cours..." : "Lancer la synchronisation en Base de Données"}
            </button>

            {syncStatus && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start gap-2 text-xs text-emerald-800">
                <Info className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <p className="font-semibold">{syncStatus}</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Logs List (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Persisted Logs in Firestore */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-3xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-indigo-600 animate-pulse" />
                <h3 className="text-sm font-black text-slate-950">Logs Persistés en Base (Invoices)</h3>
              </div>
              <span className="bg-slate-100 border border-slate-150 text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold">
                {webhookLogs.length} logs persistés
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                Chargement des logs Firestore...
              </div>
            ) : webhookLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-450 space-y-2">
                <div className="text-2xl">⏳</div>
                <p className="font-bold text-xs text-slate-700">Aucun log de webhook persisté</p>
                <p className="text-[10px] text-slate-400 leading-normal max-w-xs mx-auto">
                  Déclenchez une simulation à gauche pour créer et persister une transaction Webhook signée.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {webhookLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleString();
                  const isPortal = log.reference.startsWith('PRTL_');

                  return (
                    <div key={log.id} className="p-4 hover:bg-slate-50/50 transition text-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                            log.status === 'SUCCESSFUL' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : log.status === 'FAILED' 
                                ? 'bg-rose-100 text-rose-800' 
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {log.status}
                          </span>
                          <span className="font-mono font-bold text-slate-800 truncate max-w-xs sm:max-w-sm">
                            {log.reference}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-semibold">
                          {dateStr}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-150/50 font-mono text-[10.5px]">
                        <div>
                          <span className="text-[8.5px] text-slate-400 uppercase font-black block">Montant</span>
                          <strong className="text-slate-800 text-[11px]">{Number(log.amount).toLocaleString()} XAF</strong>
                        </div>
                        <div>
                          <span className="text-[8.5px] text-slate-400 uppercase font-black block">Source</span>
                          <strong className="text-slate-800">{log.phone || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-[8.5px] text-slate-400 uppercase font-black block">Opérateur</span>
                          <strong className="text-slate-800">{log.operator || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-[8.5px] text-slate-400 uppercase font-black block">Signature</span>
                          <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${
                            log.verified ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {log.verified ? '✓ Valide' : '✗ Invalide'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-400 flex items-center gap-1">
                          📁 Type: <strong className="text-slate-600 uppercase">{isPortal ? 'Frais de Portail' : 'Cotisation APEE'}</strong>
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {log.status === 'SUCCESSFUL' && log.verified && (
                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wide ${
                              log.synced 
                                ? 'bg-indigo-50 text-indigo-700' 
                                : 'bg-amber-50 text-amber-700 animate-pulse'
                            }`}>
                              {log.synced ? 'Synced in DB' : 'Pending Db Sync'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* In-Memory server log events */}
          <div className="bg-slate-950 border border-slate-900 rounded-3xl p-5 shadow-sm space-y-3 font-mono text-slate-300">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span className="font-black text-slate-300">Moniteur Server Node.js (Mémoire)</span>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={fetchLogs}
                  className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="Rafraîchir"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleClearServerLogs}
                  disabled={inMemoryLogs.length === 0}
                  className="p-1 hover:bg-rose-950/40 rounded text-slate-500 hover:text-rose-400 cursor-pointer disabled:opacity-30"
                  title="Effacer les logs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {inMemoryLogs.length === 0 ? (
              <p className="text-[10px] text-slate-600 text-center py-6 leading-relaxed">
                Aucun événement webhook Campay reçu en mémoire vive sur le serveur Node pour cette session.
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto text-[10px] pr-1">
                {inMemoryLogs.map((log: any, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-850 space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Ref: {log.reference}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`font-bold ${
                        log.status === 'SUCCESSFUL' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {log.status} - {log.body?.amount} XAF
                      </span>
                      <span className={log.isValid ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                        {log.isValid ? '[SIGNATURE OK]' : '[SIGNATURE FAIL]'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
