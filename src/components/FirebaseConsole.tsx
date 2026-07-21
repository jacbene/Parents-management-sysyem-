import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/TranslationContext';
import { 
  googleAccessToken, 
  loginWithGoogle, 
  logout as firebaseLogout, 
  setGoogleAccessToken 
} from '../firebase';
import { 
  Database, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  ShieldAlert, 
  ShieldCheck, 
  Layers, 
  Globe, 
  Smartphone, 
  Copy, 
  Check, 
  Loader2, 
  LogOut, 
  Cloud, 
  Cpu, 
  FileCode,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FirebaseProject {
  name: string;
  projectId: string;
  projectNumber: string;
  displayName: string;
  resources?: {
    hostingSite?: string;
    realtimeDatabaseInstance?: string;
    storageBucket?: string;
    locationId?: string;
  };
  state?: string;
}

interface WebApp {
  name: string;
  appId: string;
  displayName: string;
  projectId: string;
  appPlatform?: string;
}

interface AndroidApp {
  name: string;
  appId: string;
  displayName: string;
  projectId: string;
  packageName: string;
}

interface AppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export default function FirebaseConsole() {
  const { language, t } = useLanguage();
  const [token, setToken] = useState<string | null>(googleAccessToken);
  const [projects, setProjects] = useState<FirebaseProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected project states
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [webApps, setWebApps] = useState<WebApp[]>([]);
  const [androidApps, setAndroidApps] = useState<AndroidApp[]>([]);
  const [isAppsLoading, setIsAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  
  // Selected App configuration states
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync state with firebase cached token
  useEffect(() => {
    setToken(googleAccessToken);
  }, [googleAccessToken]);

  // Load projects if authenticated
  useEffect(() => {
    if (token) {
      loadFirebaseProjects();
    } else {
      setProjects([]);
      setSelectedProjectId(null);
    }
  }, [token]);

  const loadFirebaseProjects = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/firebase/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects || []);
      } else {
        setError(data.error || 'Failed to retrieve Firebase projects');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching projects');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectApps = async (projectId: string) => {
    if (!token) return;
    setSelectedProjectId(projectId);
    setSelectedAppId(null);
    setAppConfig(null);
    setIsAppsLoading(true);
    setAppsError(null);
    setWebApps([]);
    setAndroidApps([]);

    try {
      // Load Web Apps
      const webResponse = await fetch(`/api/firebase/projects/${projectId}/web-apps`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const webData = await webResponse.json();
      if (webData.success) {
        setWebApps(webData.apps || []);
      } else {
        setAppsError(webData.error || 'Failed to fetch web apps');
      }

      // Load Android Apps
      const androidResponse = await fetch(`/api/firebase/projects/${projectId}/android-apps`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const androidData = await androidResponse.json();
      if (androidData.success) {
        setAndroidApps(androidData.apps || []);
      }
    } catch (err: any) {
      setAppsError(err.message || 'Error loading project assets');
    } finally {
      setIsAppsLoading(false);
    }
  };

  const loadAppConfig = async (projectId: string, appId: string) => {
    if (!token) return;
    setSelectedAppId(appId);
    setIsConfigLoading(true);
    setAppConfig(null);
    try {
      const response = await fetch(`/api/firebase/projects/${projectId}/web-apps/${appId}/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAppConfig(data.config);
      } else {
        setError('Failed to fetch web app configuration');
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsConfigLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await loginWithGoogle();
      if (user) {
        // googleAccessToken is updated internally by loginWithGoogle
        setToken(googleAccessToken);
      }
    } catch (err: any) {
      setError(err.message || 'Google Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await firebaseLogout();
    setGoogleAccessToken(null);
    setToken(null);
    setProjects([]);
    setSelectedProjectId(null);
    setSelectedAppId(null);
    setAppConfig(null);
  };

  const handleCopyConfig = () => {
    if (!appConfig) return;
    const configStr = `const firebaseConfig = {
  apiKey: "${appConfig.apiKey}",
  authDomain: "${appConfig.authDomain}",
  projectId: "${appConfig.projectId}",
  storageBucket: "${appConfig.storageBucket || ''}",
  messagingSenderId: "${appConfig.messagingSenderId}",
  appId: "${appConfig.appId}",
  measurementId: "${appConfig.measurementId || ''}"
};`;
    
    navigator.clipboard.writeText(configStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredProjects = projects.filter(project => {
    const query = (searchQuery || '').toLowerCase();
    return (
      (project.displayName || '').toLowerCase().includes(query) ||
      (project.projectId || '').toLowerCase().includes(query) ||
      (project.projectNumber ? String(project.projectNumber).includes(query) : false)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6" id="firebase-console-root">
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden" id="fc-header-panel">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500 rounded-full opacity-10 blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 -mb-24 w-80 h-80 bg-orange-600 rounded-full opacity-5 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Database className="h-3.5 w-3.5" /> Firebase Cloud API
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {language === 'en' ? 'Firebase Project Manager' : 'Console de Gestion Firebase'}
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              {language === 'en' 
                ? 'Securely connect to your Firebase Console. Fetch, explore, and analyze your cloud projects, associated web/android client applications, and deployment setups.'
                : 'Connectez-vous en toute sécurité à votre console Firebase. Récupérez, explorez et gérez vos projets cloud, vos applications clientes web/android et vos paramètres de déploiement.'
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            {token ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" /> Connected
                </span>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  id="fc-disconnect-btn"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {language === 'en' ? 'Disconnect' : 'Déconnexion'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="gsi-material-button relative flex items-center justify-center cursor-pointer transition shadow-md hover:shadow-lg rounded-xl overflow-hidden"
                style={{ background: 'white', color: '#1f1f1f', border: '1px solid #dadce0', padding: '0 16px', height: '40px' }}
                id="fc-connect-btn"
              >
                <div className="flex items-center gap-3">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  ) : (
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '18px', height: '18px' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  )}
                  <span className="text-xs font-semibold font-sans">
                    {language === 'en' ? 'Sign in with Google' : 'Se connecter avec Google'}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Console Layout */}
      {token ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="fc-main-dashboard">
          {/* Projects List Sidebar (4 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  {language === 'en' ? 'Available Projects' : 'Projets disponibles'}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                    {projects.length}
                  </span>
                </h2>
                <button
                  onClick={loadFirebaseProjects}
                  disabled={isLoading}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 active:bg-slate-50 rounded-lg border border-slate-100 transition cursor-pointer"
                  title={language === 'en' ? 'Reload' : 'Actualiser'}
                  id="fc-reload-btn"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={language === 'en' ? 'Filter by name or ID...' : 'Filtrer par nom ou ID...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              {/* Projects List Wrapper */}
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {isLoading && projects.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    <p className="text-xs font-medium">
                      {language === 'en' ? 'Fetching project list...' : 'Récupération des projets...'}
                    </p>
                  </div>
                ) : error ? (
                  <div className="p-4 border border-rose-100 bg-rose-50/50 rounded-2xl text-rose-700 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert className="h-4 w-4" />
                      <span>{language === 'en' ? 'Fetch Failed' : 'Échec de récupération'}</span>
                    </div>
                    <p className="leading-relaxed font-medium">{error}</p>
                    <p className="text-[10px] text-rose-500 mt-2">
                      {language === 'en' 
                        ? 'Please verify that Firebase Management API is enabled on your Google Cloud Console.'
                        : 'Veuillez vérifier que l\'API Firebase Management est activée sur votre console Google Cloud.'}
                    </p>
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    <Database className="h-8 w-8 mx-auto opacity-30 mb-2" />
                    <p className="text-xs font-semibold">
                      {searchQuery ? (language === 'en' ? 'No matching projects' : 'Aucun projet correspondant') : (language === 'en' ? 'No projects found' : 'Aucun projet trouvé')}
                    </p>
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const isSelected = selectedProjectId === project.projectId;
                    return (
                      <button
                        key={project.projectId}
                        onClick={() => loadProjectApps(project.projectId)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition relative overflow-hidden flex flex-col gap-1.5 cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-50/50 border-indigo-200 shadow-xs' 
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs truncate max-w-[80%]">
                            {project.displayName || project.projectId}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                            project.state === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {project.state || 'ACTIVE'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded-sm">ID: {project.projectId}</span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded-sm">Num: {project.projectNumber}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Project Details Panel (7 cols) */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {selectedProjectId ? (
                <motion.div
                  key={selectedProjectId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-xs space-y-6"
                >
                  {/* Selected Project General Info */}
                  {(() => {
                    const project = projects.find(p => p.projectId === selectedProjectId);
                    if (!project) return null;
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 gap-4">
                        <div className="space-y-1">
                          <h2 className="text-base font-extrabold text-slate-800">
                            {project.displayName || project.projectId}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                            <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded-lg">ID: {project.projectId}</span>
                            <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded-lg">Number: {project.projectNumber}</span>
                          </div>
                        </div>
                        
                        <a
                          href={`https://console.firebase.google.com/project/${project.projectId}/overview`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 transition"
                        >
                          Console Firebase <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    );
                  })()}

                  {/* Project Resources / Infrastructure metadata */}
                  {(() => {
                    const project = projects.find(p => p.projectId === selectedProjectId);
                    if (!project || !project.resources) return null;
                    return (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Default Storage Bucket</span>
                          <span className="text-xs font-mono text-slate-700 truncate block">
                            {project.resources.storageBucket || 'N/A'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Hosting Site / URL</span>
                          <span className="text-xs font-mono text-slate-700 truncate block">
                            {project.resources.hostingSite ? `https://${project.resources.hostingSite}.web.app` : 'N/A'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Realtime DB Instance</span>
                          <span className="text-xs font-mono text-slate-700 truncate block">
                            {project.resources.realtimeDatabaseInstance || 'N/A'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Cloud Location</span>
                          <span className="text-xs font-mono text-slate-700 font-bold text-slate-800">
                            {project.resources.locationId || 'global / us-central'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Project Apps Sections */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                      {language === 'en' ? 'Registered Applications' : 'Applications Enregistrées'}
                    </h3>

                    {isAppsLoading ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                        <span className="text-xs font-medium">Loading app registry...</span>
                      </div>
                    ) : appsError ? (
                      <div className="p-4 bg-amber-50 text-amber-800 border border-amber-100 rounded-2xl text-xs leading-relaxed">
                        {appsError}
                      </div>
                    ) : webApps.length === 0 && androidApps.length === 0 ? (
                      <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                        <p className="text-xs font-medium">No client apps registered in this Firebase project yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Web Apps */}
                        {webApps.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 pl-1">
                              <Globe className="h-3.5 w-3.5 text-sky-500" /> Web Applications ({webApps.length})
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {webApps.map((app) => (
                                <button
                                  key={app.appId}
                                  onClick={() => loadAppConfig(selectedProjectId!, app.appId)}
                                  className={`text-left p-3.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                                    selectedAppId === app.appId
                                      ? 'bg-sky-50/50 border-sky-200'
                                      : 'bg-white border-slate-100 hover:border-slate-200'
                                  }`}
                                >
                                  <div className="space-y-0.5 truncate max-w-[80%]">
                                    <span className="font-bold text-xs text-slate-800 block truncate">{app.displayName}</span>
                                    <span className="text-[9px] font-mono text-slate-400 truncate block">App ID: {app.appId}</span>
                                  </div>
                                  <FileCode className={`h-4 w-4 ${selectedAppId === app.appId ? 'text-sky-600 animate-pulse' : 'text-slate-300'}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Android Apps */}
                        {androidApps.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 pl-1">
                              <Smartphone className="h-3.5 w-3.5 text-emerald-500" /> Android Applications ({androidApps.length})
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {androidApps.map((app) => (
                                <div
                                  key={app.appId}
                                  className="bg-white border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between"
                                >
                                  <div className="space-y-0.5 truncate max-w-[85%]">
                                    <span className="font-bold text-xs text-slate-800 block truncate">{app.displayName}</span>
                                    <span className="text-[9px] font-mono text-slate-400 truncate block">Package: {app.packageName}</span>
                                    <span className="text-[9px] font-mono text-slate-400 truncate block">App ID: {app.appId}</span>
                                  </div>
                                  <Cpu className="h-4 w-4 text-emerald-500/60" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Config Block Display */}
                  <AnimatePresence>
                    {selectedAppId && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 pt-4 border-t border-slate-100 overflow-hidden"
                      >
                        <div className="flex items-center justify-between pl-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <FileCode className="h-4 w-4 text-sky-600" />
                            {language === 'en' ? 'Firebase SDK Config' : 'Configuration du SDK Firebase'}
                          </span>
                          {appConfig && (
                            <button
                              onClick={handleCopyConfig}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 active:bg-indigo-200 transition cursor-pointer"
                            >
                              {copied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" /> Copy Code
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {isConfigLoading ? (
                          <div className="py-12 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Generating configuration parameters...</span>
                          </div>
                        ) : appConfig ? (
                          <div className="relative">
                            <pre className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] text-amber-400/90 leading-relaxed overflow-x-auto whitespace-pre">
                              {`const firebaseConfig = {
  apiKey: "${appConfig.apiKey}",
  authDomain: "${appConfig.authDomain}",
  projectId: "${appConfig.projectId}",
  storageBucket: "${appConfig.storageBucket || ''}",
  messagingSenderId: "${appConfig.messagingSenderId}",
  appId: "${appConfig.appId}",
  measurementId: "${appConfig.measurementId || ''}"
};`}
                            </pre>
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl">
                            Failed to generate dynamic client parameters.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-4 shadow-xs h-full min-h-[400px]">
                  <Database className="h-16 w-16 text-indigo-100 animate-bounce" />
                  <div className="space-y-1.5 max-w-sm">
                    <h2 className="text-sm font-bold text-slate-800">
                      {language === 'en' ? 'Select a Cloud Project' : 'Sélectionnez un projet cloud'}
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {language === 'en'
                        ? 'Select any registered Firebase project from the sidebar list to inspect active apps, default buckets and API integrations.'
                        : 'Sélectionnez un projet Firebase enregistré dans la liste latérale pour inspecter les applications, les conteneurs de stockage et les configurations.'}
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* Not Logged In Informational Showcase */
        <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-10 shadow-xs max-w-4xl mx-auto space-y-8" id="fc-promo-panel">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h2 className="text-lg md:text-xl font-black text-slate-800 leading-tight">
                {language === 'en' 
                  ? 'Connect Your Google Cloud and Firebase Services'
                  : 'Connectez vos Services Google Cloud & Firebase'
                }
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed">
                {language === 'en'
                  ? 'Access live Firebase Console project information securely. This utility leverages Google OAuth to negotiate scopes so you can browse database containers, examine application properties, and copy initialization codes without manually accessing Google Console.'
                  : 'Accédez aux informations de vos projets Firebase directement et en toute sécurité. Cet outil utilise Google OAuth pour demander l\'accès afin de lister vos applications et copier les codes d\'intégration sans devoir vous connecter à la console Google Cloud.'}
              </p>
              
              <div className="space-y-2 pt-2">
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="p-1 rounded-full bg-indigo-50 text-indigo-600 mt-0.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Fully Secure Protocol</span>
                    <span className="text-[11px] text-slate-400">Tokens are cached purely in active memory and never committed to server databases.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="p-1 rounded-full bg-indigo-50 text-indigo-600 mt-0.5">
                    <Cloud className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Automatic Sync Overview</span>
                    <span className="text-[11px] text-slate-400">View real-time storage configurations, location regions, and web app configurations.</span>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="flex items-center gap-2.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {language === 'en' ? 'Get Started Now' : 'Démarrer maintenant'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-indigo-600" />
                {language === 'en' ? 'Required Developer Scopes' : 'Autorisations requises'}
              </h3>
              
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-white border border-slate-100 rounded-xl space-y-1">
                  <span className="font-mono text-[10px] text-slate-500 font-bold block">https://www.googleapis.com/auth/firebase</span>
                  <span className="text-[11px] text-slate-400">Allows this application to fetch project directories, read web app structures, and request SDK parameters.</span>
                </div>
                
                <div className="p-3 bg-white border border-slate-100 rounded-xl space-y-1">
                  <span className="font-mono text-[10px] text-slate-500 font-bold block">https://www.googleapis.com/auth/cloud-platform</span>
                  <span className="text-[11px] text-slate-400">Grants read-only access to discover linked Google Cloud resource hierarchies under your Google account.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
