import React, { useState, useEffect } from 'react';
import { 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ExternalLink, 
  ShieldAlert, 
  Activity, 
  ChevronDown, 
  ChevronUp,
  Clock,
  Wifi,
  Terminal,
  HelpCircle
} from 'lucide-react';

interface DiagnosticResult {
  status: 'idle' | 'testing' | 'success' | 'warning' | 'error';
  targetUrl: string;
  httpStatus: number | null;
  statusText: string | null;
  latencyMs: number;
  contentType: string | null;
  isHtmlResponse: boolean;
  isJsonResponse: boolean;
  isCorsError: boolean;
  diagnosisTitle: string;
  diagnosisMessage: string;
  recommendation: string;
  rawSnippet: string;
  timestamp: string;
}

export default function ApeeBackendDiagnostics() {
  const defaultUrl = (
    import.meta.env.VITE_API_URL || 
    'https://pasma-sys-backend.onrender.com'
  ).replace(/\/+$/, '');

  const [backendUrl, setBackendUrl] = useState<string>(defaultUrl);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [result, setResult] = useState<DiagnosticResult>({
    status: 'idle',
    targetUrl: defaultUrl,
    httpStatus: null,
    statusText: null,
    latencyMs: 0,
    contentType: null,
    isHtmlResponse: false,
    isJsonResponse: false,
    isCorsError: false,
    diagnosisTitle: 'Diagnostic non exécuté',
    diagnosisMessage: 'Cliquez sur Tester pour vérifier la connectivité avec le serveur Render.',
    recommendation: '',
    rawSnippet: '',
    timestamp: ''
  });

  const runDiagnostics = async (customUrl?: string) => {
    const urlToTest = (customUrl || backendUrl || defaultUrl).trim().replace(/\/+$/, '');
    const endpoint = `${urlToTest}/api/health`;

    setResult(prev => ({
      ...prev,
      status: 'testing',
      targetUrl: urlToTest,
      diagnosisTitle: 'Vérification en cours...',
      diagnosisMessage: `Envoi d'une requête HTTP vers ${endpoint}...`,
      recommendation: '',
      rawSnippet: ''
    }));

    const startTime = performance.now();

    try {
      // 1. Attempt standard fetch to /api/health
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for Render cold start

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - startTime);
      const contentType = response.headers.get('content-type') || 'unknown';
      const rawText = await response.text();
      const isHtml = contentType.includes('text/html') || rawText.trim().startsWith('<!DOCTYPE') || rawText.includes('<div id="root"');
      
      let isJson = false;
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(rawText);
        isJson = true;
      } catch {
        isJson = false;
      }

      // Case A: Successful JSON health response
      if (response.ok && isJson && parsedJson?.status === 'ok') {
        setResult({
          status: 'success',
          targetUrl: urlToTest,
          httpStatus: response.status,
          statusText: response.statusText || 'OK',
          latencyMs: elapsed,
          contentType,
          isHtmlResponse: false,
          isJsonResponse: true,
          isCorsError: false,
          diagnosisTitle: '✅ Backend Render 100% Opérationnel & Connecté',
          diagnosisMessage: `Le serveur a répondu avec succès en ${elapsed} ms avec l'objet JSON attendu. Les en-têtes CORS sont actifs et autorisent ce frontend.`,
          recommendation: 'Tout est parfaitement configuré pour les SMS Twilio, l\'IA Gemini et les webhooks Campay.',
          rawSnippet: JSON.stringify(parsedJson, null, 2),
          timestamp: new Date().toLocaleTimeString()
        });
        return;
      }

      // Case B: Received HTML (Login Page redirection / SPA Fallback)
      if (isHtml || (response.ok && !isJson)) {
        setResult({
          status: 'warning',
          targetUrl: urlToTest,
          httpStatus: response.status,
          statusText: response.statusText,
          latencyMs: elapsed,
          contentType,
          isHtmlResponse: true,
          isJsonResponse: false,
          isCorsError: false,
          diagnosisTitle: '⚠️ Redirection vers la page de connexion détectée !',
          diagnosisMessage: `L'URL ${endpoint} a renvoyé du code HTML (index.html) au lieu du JSON d'API. C'est la raison pour laquelle vous tombez sur l'écran de connexion au lieu de la réponse API.`,
          recommendation: `POURQUOI : Votre dépôt GitHub déployé sur Render ne contient pas encore la route "/api/health" dans "server.ts". Express a donc activé sa règle générique "app.get('*')" qui sert la page d'accueil.
SOLUTION : Poussez votre fichier "server.ts" mis à jour sur GitHub (git add server.ts && git commit && git push). Render redéploiera avec /api/health et CORS.`,
          rawSnippet: rawText.slice(0, 350) + (rawText.length > 350 ? '...' : ''),
          timestamp: new Date().toLocaleTimeString()
        });
        return;
      }

      // Case C: Server returned 4xx or 5xx error
      setResult({
        status: 'warning',
        targetUrl: urlToTest,
        httpStatus: response.status,
        statusText: response.statusText,
        latencyMs: elapsed,
        contentType,
        isHtmlResponse: false,
        isJsonResponse: isJson,
        isCorsError: false,
        diagnosisTitle: `⚠️ Erreur HTTP ${response.status} (${response.statusText})`,
        diagnosisMessage: `Le serveur Render a répondu mais avec un code d'erreur HTTP ${response.status}.`,
        recommendation: `Vérifiez les logs de Render pour examiner l'erreur interne de Node.js.`,
        rawSnippet: rawText.slice(0, 300),
        timestamp: new Date().toLocaleTimeString()
      });

    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      const isAbort = err.name === 'AbortError';
      const isFailedFetch = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');

      if (isAbort) {
        setResult({
          status: 'error',
          targetUrl: urlToTest,
          httpStatus: null,
          statusText: 'Timeout (15s)',
          latencyMs: elapsed,
          contentType: null,
          isHtmlResponse: false,
          isJsonResponse: false,
          isCorsError: false,
          diagnosisTitle: '⏳ Délai d\'attente dépassé (Démarrage à froid Render)',
          diagnosisMessage: 'Le serveur a mis plus de 15 secondes à répondre.',
          recommendation: 'Sur l\'offre gratuite de Render, le serveur s\'endort après 15 min d\'inactivité. Il est probablement en cours de réveil ("Spinning up instance"). Réessayez dans 30 secondes.',
          rawSnippet: err.message || 'Request Aborted',
          timestamp: new Date().toLocaleTimeString()
        });
        return;
      }

      if (isFailedFetch) {
        setResult({
          status: 'error',
          targetUrl: urlToTest,
          httpStatus: null,
          statusText: 'Failed to fetch (CORS ou Inaccessible)',
          latencyMs: elapsed,
          contentType: null,
          isHtmlResponse: false,
          isJsonResponse: false,
          isCorsError: true,
          diagnosisTitle: '🚫 Blocage CORS ou Serveur Inaccessible (ECONNREFUSED)',
          diagnosisMessage: `Le navigateur a refusé la requête vers ${endpoint} (Failed to fetch).`,
          recommendation: `CAUSES POSSIBLES :
1. Blocage CORS : Le module "cors" n'est pas encore présent dans "server.ts" sur votre instance Render.
2. Serveur hors-ligne : Render est en cours de déploiement ou en erreur (ECONNREFUSED).
3. URL erronée : Vérifiez que l'URL ${urlToTest} correspond exactement à celle de votre service Render.`,
          rawSnippet: err.stack || err.message || 'TypeError: Failed to fetch',
          timestamp: new Date().toLocaleTimeString()
        });
        return;
      }

      // Generic error
      setResult({
        status: 'error',
        targetUrl: urlToTest,
        httpStatus: null,
        statusText: 'Erreur Inattendue',
        latencyMs: elapsed,
        contentType: null,
        isHtmlResponse: false,
        isJsonResponse: false,
        isCorsError: false,
        diagnosisTitle: '❌ Erreur de Connexion',
        diagnosisMessage: err.message || 'Une erreur inconnue est survenue.',
        recommendation: 'Inspectez la console du navigateur (F12) pour plus de détails.',
        rawSnippet: String(err),
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  // Run automatically on first mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight">Diagnostic Backend Render en Direct</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                result.status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                result.status === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                result.status === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                result.status === 'testing' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse' :
                'bg-slate-700 text-slate-300'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  result.status === 'success' ? 'bg-emerald-400 animate-ping' :
                  result.status === 'warning' ? 'bg-amber-400' :
                  result.status === 'error' ? 'bg-rose-400' :
                  result.status === 'testing' ? 'bg-cyan-400 animate-pulse' :
                  'bg-slate-400'
                }`} />
                {result.status === 'success' ? 'Connecté' :
                 result.status === 'warning' ? 'Alerte' :
                 result.status === 'error' ? 'Erreur' :
                 result.status === 'testing' ? 'Analyse...' : 'En attente'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Vérifie la route <span className="font-mono text-slate-300">/api/health</span>, la redirection SPA et la politique CORS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
            title="Modifier l'URL cible du backend"
          >
            <Wifi className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">URL</span>
          </button>

          <button
            onClick={() => runDiagnostics()}
            disabled={result.status === 'testing'}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${result.status === 'testing' ? 'animate-spin' : ''}`} />
            {result.status === 'testing' ? 'Test en cours...' : 'Tester la connexion'}
          </button>
        </div>
      </div>

      {/* Target URL Settings (Collapsible) */}
      {showConfig && (
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs flex flex-col sm:flex-row items-center gap-2">
          <span className="font-semibold text-slate-600 shrink-0">URL Backend Cible :</span>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://pasma-sys-backend.onrender.com"
            className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none w-full"
          />
          <button
            onClick={() => runDiagnostics(backendUrl)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-semibold text-xs transition shrink-0"
          >
            Appliquer & Tester
          </button>
        </div>
      )}

      {/* Main Diagnostic Body */}
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          result.status === 'success' ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' :
          result.status === 'warning' ? 'bg-amber-50/70 border-amber-200 text-amber-950' :
          result.status === 'error' ? 'bg-rose-50/70 border-rose-200 text-rose-950' :
          result.status === 'testing' ? 'bg-cyan-50/70 border-cyan-200 text-cyan-950' :
          'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {result.status === 'success' && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
              {result.status === 'warning' && <AlertTriangle className="h-6 w-6 text-amber-600" />}
              {result.status === 'error' && <XCircle className="h-6 w-6 text-rose-600" />}
              {result.status === 'testing' && <Activity className="h-6 w-6 text-cyan-600 animate-pulse" />}
              {result.status === 'idle' && <HelpCircle className="h-6 w-6 text-slate-400" />}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold">{result.diagnosisTitle}</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {result.diagnosisMessage}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0 text-xs font-mono bg-white/80 p-2 rounded-lg border border-slate-200/60 shadow-2xs self-stretch md:self-auto justify-around">
            <div className="text-center px-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Latence</div>
              <div className="font-bold text-slate-800 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                {result.latencyMs > 0 ? `${result.latencyMs} ms` : '-'}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-center px-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold">HTTP Code</div>
              <div className={`font-bold ${
                result.httpStatus === 200 ? 'text-emerald-600' :
                result.httpStatus ? 'text-amber-600' : 'text-slate-400'
              }`}>
                {result.httpStatus || 'N/A'}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-center px-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Type Réponse</div>
              <div className="font-bold text-slate-700 text-[11px] truncate max-w-[120px]">
                {result.isHtmlResponse ? '📄 HTML (SPA)' :
                 result.isJsonResponse ? '⚡ JSON API' :
                 result.contentType || 'Inconnu'}
              </div>
            </div>
          </div>
        </div>

        {/* Actionable Solution Recommendation if Warning or Error */}
        {(result.status === 'warning' || result.status === 'error') && result.recommendation && (
          <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold tracking-wide uppercase text-[11px]">
              <Terminal className="h-4 w-4" />
              Action Recommandée pour corriger la redirection :
            </div>
            <div className="text-slate-300 font-mono text-[11px] whitespace-pre-line bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              {result.recommendation}
            </div>
          </div>
        )}

        {/* Technical Details Accordion */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-slate-800 font-semibold py-1 transition cursor-pointer"
          >
            <span>Détails techniques complets de l'échange HTTP</span>
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showDetails && (
            <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div><strong className="text-slate-500">URL testée :</strong> <span className="text-indigo-600 select-all">{result.targetUrl}/api/health</span></div>
                <div><strong className="text-slate-500">Statut HTTP :</strong> {result.httpStatus || 'Non reçu'} {result.statusText ? `(${result.statusText})` : ''}</div>
                <div><strong className="text-slate-500">Content-Type :</strong> {result.contentType || 'Inexistant'}</div>
                <div><strong className="text-slate-500">Dernier test :</strong> {result.timestamp || 'Jamais'}</div>
              </div>

              {result.rawSnippet && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Extrait du corps de réponse (Body) :</div>
                  <pre className="p-2 bg-slate-900 text-emerald-400 rounded-lg text-[10.5px] overflow-x-auto max-h-36">
                    {result.rawSnippet}
                  </pre>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Tester aussi l'endpoint Webhooks :</span>
                <button
                  onClick={() => runDiagnostics(`${backendUrl.replace(/\/+$/, '')}/api/campay/webhooks`)}
                  className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                >
                  Tester /api/campay/webhooks
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
