import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Smartphone, Monitor, Share, X, CheckSquare, PlusSquare, ArrowUp, Sparkles, ExternalLink } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showGeneralGuide, setShowGeneralGuide] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    // Detect if inside an iframe
    const isInIframe = window.self !== window.top;
    setInIframe(isInIframe);

    // Check if already in standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Detect if device is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    setIsIosDevice(isIos);

    // If it's iOS and not standalone, it's installable via Safari Share menu
    if (isIos && !isStandalone) {
      setIsInstallable(true);
    }

    // Handler for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    // Handler for appinstalled
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
      setShowSuccessBanner(true);
      // Auto close success banner after 5 seconds
      setTimeout(() => setShowSuccessBanner(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (inIframe) {
      // Show general guide with iframe warning
      setShowGeneralGuide(true);
      return;
    }

    if (isIosDevice) {
      // Show iOS setup guide
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Show general manual installation guide
      setShowGeneralGuide(true);
      return;
    }
    
    // Show the native install prompt
    try {
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Résultat de l'installation de l'utilisateur: ${outcome}`);
      
      if (outcome === 'accepted') {
        // Clear the deferred prompt variable, it can only be used once
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } catch (err) {
      console.error("Erreur lors de l'activation du prompt PWA:", err);
      setShowGeneralGuide(true);
    }
  };

  if (isInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5 text-[10.5px] font-bold">
        <CheckSquare className="h-3.5 w-3.5 animate-pulse" /> Pasma-sys Connecté (PWA)
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Main triggering button in Navigation/Header */}
        <button
          id="btn_install_app"
          onClick={handleInstallClick}
          className="relative group inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-[11px] font-black px-4 py-1.5 rounded-xl shadow-sm transition hover:scale-103 active:scale-97 cursor-pointer"
        >
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
          </span>
          <Download className="h-3.5 w-3.5 animate-bounce-subtle" />
          <span className="hidden leading-none md:inline">Installer l'Application</span>
          <span className="inline md:hidden leading-none">Installer l'App</span>
        </button>

        {/* Small hint label for desktops */}
        <span className="hidden lg:inline-block text-[9.5px] text-slate-400 font-medium">
          (PC, Mac & Mobile)
        </span>
      </div>

      {/* Floating alert for Android / other mobile devices if they loaded for first time and native prompt is active */}
      <AnimatePresence>
        {isInstallable && !showIosGuide && !showGeneralGuide && !isInstalled && !inIframe && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-55 w-[92%] max-w-sm bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-2.5">
                <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold font-sans">Accès direct sur l'écran d'accueil</h4>
                  <p className="text-[10px] text-slate-300 leading-normal mt-0.5">
                    Installez le portail pour un accès direct, un chargement plus rapide et une navigation fluide sans barre d'adresse.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsInstallable(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-950 text-wrap font-black text-[11px] py-2 rounded-xl text-center shadow-xs transition cursor-pointer"
              >
                Installer maintenant (Gratuit)
              </button>
              <button
                onClick={() => setIsInstallable(false)}
                className="px-3 py-2 text-slate-400 hover:text-white font-bold text-[10.5px] rounded-xl text-center transition"
              >
                Plus tard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Safari Guide dialog */}
      <AnimatePresence>
        {showIosGuide && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-55 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              className="bg-white border border-slate-150 rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" /> Safari iOS & iPadOS PWA
                </div>
                <button
                  onClick={() => setShowIosGuide(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Installer sur iPhone / iPad</h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Apple Safari requiert deux clics simples pour installer l'application sur votre écran d'accueil d'iPhone :
                </p>
              </div>

              <div className="space-y-3.5 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <div className="flex items-start gap-3 text-xs text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-extrabold text-slate-800">1</span>
                  <div className="leading-normal">
                    Appuyez sur le bouton de <span className="font-extrabold flex inline-flex items-center gap-1 bg-white border px-1.5 py-0.5 rounded text-[11px]"><Share className="h-3 w-3 text-blue-500" /> Partager (Share)</span> dans la barre de navigation de Safari (en bas ou en haut).
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-extrabold text-slate-800">2</span>
                  <div className="leading-normal">
                    Faites défiler vers le bas et appuyez sur <span className="font-extrabold flex inline-flex items-center gap-1 bg-white border px-1.5 py-0.5 rounded text-[11px]"><PlusSquare className="h-3 w-3 text-slate-800" /> Sur l'écran d'accueil (Add to Home Screen)</span>.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIosGuide(false)}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs py-2.5 rounded-xl transition shadow-xs text-center cursor-pointer"
              >
                Compris, j'ai l'icône de partage !
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* General Manual Guide dialog */}
      <AnimatePresence>
        {showGeneralGuide && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-55 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              className="bg-white border border-slate-150 rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 text-slate-800"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" /> Guide de l'Installation
                </div>
                <button
                  onClick={() => setShowGeneralGuide(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {inIframe ? (
                <div className="space-y-4">
                  <div className="mx-auto h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
                    <ExternalLink className="h-6 w-6" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Ouvrir dans un nouvel onglet</h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Vous êtes actuellement dans l'éditeur de code (iframe). Les navigateurs bloquent l'installation des applications dans ce cadre.
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-xs text-amber-800 space-y-2 leading-relaxed">
                    <p className="font-bold">Comment procéder :</p>
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>Cliquez sur l'icône <strong>"Open in a new tab"</strong> en haut à droite de l'aperçu, ou copiez l'URL de prévisualisation.</li>
                      <li>Une fois sur l'onglet indépendant, cliquez sur ce même bouton <strong>"Installer l'Application"</strong> pour l'ajouter sur votre PC ou mobile !</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => setShowGeneralGuide(false)}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs py-2.5 rounded-xl transition shadow-xs text-center cursor-pointer"
                  >
                    D'accord, j'ai compris !
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto h-12 w-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                    <Monitor className="h-6 w-6" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Installation de l'Application</h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Si votre navigateur ne déclenche pas le prompt d'installation automatique, voici comment procéder :
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs">
                    <div className="flex gap-2 text-slate-700">
                      <span className="font-bold text-indigo-600 shrink-0">💻 PC / Mac :</span>
                      <span>
                        Regardez à droite de votre barre d'adresse de navigateur. Cliquez sur l'icône <strong>⊕</strong> ou <strong>Installer (Install)</strong>, puis validez.
                      </span>
                    </div>
                    <div className="flex gap-2 text-slate-700 border-t border-slate-150 pt-2.5">
                      <span className="font-bold text-indigo-600 shrink-0">📱 Android (Chrome) :</span>
                      <span>
                        Appuyez sur les <strong>trois petits points (⋮)</strong> en haut à droite du navigateur, puis sélectionnez <strong>"Ajouter à l'écran d'accueil"</strong> ou <strong>"Installer l'application"</strong>.
                      </span>
                    </div>
                    <div className="flex gap-2 text-slate-700 border-t border-slate-150 pt-2.5">
                      <span className="font-bold text-indigo-600 shrink-0">🍎 iPhone / iPad :</span>
                      <span>
                        Utilisez le navigateur <strong>Safari</strong>, appuyez sur l'icône de <strong>Partager (Share)</strong> et sélectionnez <strong>"Sur l'écran d'accueil"</strong>.
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowGeneralGuide(false)}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs py-2.5 rounded-xl transition shadow-xs text-center cursor-pointer"
                  >
                    Fermer le guide
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Standalone Success banner */}
      <AnimatePresence>
        {showSuccessBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-55 w-[92%] max-w-sm bg-emerald-600 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3.5"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 shrink-0" />
              <div>
                <h4 className="text-xs font-bold leading-none">Installation réussie !</h4>
                <p className="text-[10px] text-emerald-100 mt-1">Vous pouvez désormais lancer le portail directement depuis votre écran d'accueil.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowSuccessBanner(false)}
              className="p-1 hover:bg-emerald-700 rounded-lg transition shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
