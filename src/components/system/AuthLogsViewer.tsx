import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  deleteDoc, 
  doc, 
  writeBatch 
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  AlertTriangle, 
  Clock, 
  User, 
  FileText, 
  Database,
  Chrome,
  Terminal,
  HelpCircle
} from 'lucide-react';

export interface AuthLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  errorCode?: string;
  errorMessage: string;
  action: string;
  component: string;
  schoolName?: string;
  schoolId?: string;
  details?: string;
  userAgent?: string;
  isLocalOnly?: boolean;
}

export default function AuthLogsViewer() {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    let firestoreLogs: AuthLog[] = [];
    
    // 1. Fetch from Firestore if online/possible
    try {
      const logsRef = collection(db, 'logs_auth');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(150));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        firestoreLogs.push({
          id: docSnap.id,
          ...docSnap.data()
        } as AuthLog);
      });
    } catch (fsErr: any) {
      console.warn("Could not fetch auth logs from Firestore:", fsErr);
      setError("Impossible de charger les logs depuis Firestore (Problème de permissions ou réseau). Affichage du cache local.");
    }

    // 2. Load and merge local-only logs from localStorage
    let localLogs: AuthLog[] = [];
    try {
      const cached = localStorage.getItem('pasma_auth_logs');
      if (cached) {
        localLogs = JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Failed to parse local auth logs:", e);
    }

    // Merge both lists, avoiding duplicates (using id)
    const mergedMap = new Map<string, AuthLog>();
    
    // Put firestore logs first
    firestoreLogs.forEach(log => mergedMap.set(log.id, log));
    
    // Merge local ones (which might have been created offline)
    localLogs.forEach(log => {
      if (!mergedMap.has(log.id)) {
        mergedMap.set(log.id, { ...log, isLocalOnly: true });
      }
    });

    // Convert back to array and sort descending by timestamp
    const mergedList = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    setLogs(mergedList);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCopy = (log: AuthLog) => {
    const textToCopy = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm("⚠️ ATTENTION !\nÊtes-vous sûr de vouloir supprimer tous les logs de sécurité (locaux et distants) ?Cette action est irréversible.")) {
      return;
    }

    setIsClearing(true);
    
    // 1. Clear local
    try {
      localStorage.removeItem('pasma_auth_logs');
    } catch (e) {
      console.error(e);
    }

    // 2. Clear remote (if permitted)
    try {
      const logsRef = collection(db, 'logs_auth');
      const q = query(logsRef, limit(100));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(doc(db, 'logs_auth', docSnap.id));
      });
      await batch.commit();
    } catch (fsErr) {
      console.warn("Could not delete logs from Firestore (insufficient permissions):", fsErr);
    }

    await fetchLogs();
    setIsClearing(false);
  };

  const filteredLogs = logs.filter(log => {
    const term = (searchQuery || '').toLowerCase();
    return (
      ((log.errorMessage || '').toLowerCase().includes(term)) ||
      (log.errorCode && (log.errorCode || '').toLowerCase().includes(term)) ||
      ((log.action || '').toLowerCase().includes(term)) ||
      ((log.component || '').toLowerCase().includes(term)) ||
      (log.userEmail && (log.userEmail || '').toLowerCase().includes(term)) ||
      (log.schoolName && (log.schoolName || '').toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            Portail de Diagnostic & Journalisation de Sécurité
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Surveillance en temps réel des rejets de permissions (Permission Denied) et anomalies d'authentification.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-55 shadow-3xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          
          {logs.length > 0 && (
            <button
              onClick={handleClearAllLogs}
              disabled={isClearing}
              className="p-2 bg-rose-50 border border-rose-150 hover:bg-rose-100 text-rose-700 rounded-xl transition font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-55 shadow-3xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Effacer les Logs
            </button>
          )}
        </div>
      </div>

      {/* Info Banner / Permission Warning */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed space-y-1">
          <p className="font-extrabold">ℹ️ Rôle et utilité de cette console :</p>
          <p>
            Lorsqu'un utilisateur non authentifié (ou dont l'email n'a pas encore fait l'objet d'un paramétrage de règles Firestore adéquat) tente de créer un établissement scolaire, Firestore lève une exception <strong>'Missing or insufficient permissions'</strong>. 
          </p>
          <p>
            Ces événements critiques sont interceptés côté client et consignés ici de manière persistante (dans Firestore et doublés dans le cache de l'appareil local) pour que vous puissiez identifier la cause exacte des refus de droits.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Rechercher par message, code, email d'utilisateur, action..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-3xs"
        />
      </div>

      {/* Error or Alert banner */}
      {error && (
        <div className="bg-slate-900 border border-slate-800 text-slate-400 p-3 rounded-xl text-[11px] font-mono flex items-center gap-2">
          <Database className="h-4 w-4 text-amber-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Log list container */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 space-y-3">
          <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-medium">Chargement des rapports de sécurité en cours...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-16 border border-dashed border-slate-200 bg-slate-50/50 rounded-3xl text-center space-y-3">
          <div className="text-4xl">🛡️</div>
          <p className="font-bold text-sm text-slate-800">Aucun log de sécurité intercepté</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Tout fonctionne à merveille ! Aucune erreur d'autorisation "Missing or insufficient permissions" ou échec de transaction d'onboarding n'a été signalé récemment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
            <span>Rapports de Sécurité ({filteredLogs.length})</span>
            <span>Trié par date décroissante</span>
          </div>

          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-3xs hover:shadow-2xs transition hover:border-slate-300"
              >
                {/* Top header row */}
                <div className="bg-slate-50/70 border-b border-slate-100 px-4.5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-extrabold rounded-md uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <ShieldAlert className="h-3 w-3" />
                      {log.errorCode || 'PERMISSION_DENIED'}
                    </span>
                    
                    <span className="text-[11px] text-slate-450 font-mono flex items-center gap-1 shrink-0">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>

                    {log.isLocalOnly && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded-sm border border-amber-100 shrink-0">
                        📱 Cache local uniquement
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(log)}
                      className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-4xs"
                      title="Copier le JSON complet"
                    >
                      {copiedId === log.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Body details */}
                <div className="p-4.5 space-y-4 text-xs font-medium text-slate-750">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Message d'Erreur Capturé</p>
                    <p className="text-slate-900 font-extrabold bg-rose-50/50 border border-rose-100/50 p-2.5 rounded-xl font-sans leading-relaxed text-xs">
                      {log.errorMessage}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Log details col 1 */}
                    <div className="space-y-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                          <Terminal className="h-3 w-3" /> Action Déclenchante
                        </p>
                        <p className="font-mono text-slate-800 font-bold bg-slate-50 px-2 py-1 rounded-md text-[10.5px]">
                          {log.action}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Composant Source
                        </p>
                        <p className="font-mono text-slate-800 font-bold bg-slate-50 px-2 py-1 rounded-md text-[10.5px]">
                          {log.component}
                        </p>
                      </div>
                    </div>

                    {/* Log details col 2 */}
                    <div className="space-y-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                          <User className="h-3 w-3" /> Utilisateur Demandeur
                        </p>
                        <div className="bg-slate-50 px-2 py-1.5 rounded-md space-y-0.5 text-[10.5px]">
                          <p className="font-bold text-slate-800 truncate">{log.userEmail || 'Visiteur Anonyme'}</p>
                          <p className="text-[9.5px] text-slate-450 font-mono truncate">UID: {log.userId || 'N/A'}</p>
                        </div>
                      </div>

                      {log.schoolName && (
                        <div className="space-y-0.5">
                          <p className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold">🏫 Établissement Cible</p>
                          <div className="bg-slate-50 px-2 py-1.5 rounded-md space-y-0.5 text-[10.5px]">
                            <p className="font-bold text-slate-800 truncate">{log.schoolName}</p>
                            {log.schoolId && <p className="text-[9.5px] text-slate-450 font-mono truncate">ID: {log.schoolId}</p>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Log details col 3 */}
                    <div className="space-y-2.5 md:col-span-2 lg:col-span-1">
                      <div className="space-y-0.5">
                        <p className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                          <Chrome className="h-3 w-3" /> Navigateur & Système (UA)
                        </p>
                        <p className="text-slate-600 bg-slate-50 p-2 rounded-md font-mono text-[9.5px] leading-normal break-all">
                          {log.userAgent || 'Indisponible'}
                        </p>
                      </div>

                      {log.details && (
                        <div className="space-y-0.5">
                          <p className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold">📝 Données Additionnelles</p>
                          <p className="text-slate-600 bg-slate-50 p-2 rounded-md font-mono text-[9.5px] leading-normal truncate">
                            {log.details}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
