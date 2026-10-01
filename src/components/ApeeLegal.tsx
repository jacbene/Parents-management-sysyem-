import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  FileText, 
  Cookie, 
  UserCheck, 
  Phone, 
  Mail, 
  Check, 
  Lock, 
  Scale, 
  Info, 
  AlertCircle,
  Clock
} from 'lucide-react';

interface CookiePreferences {
  essential: boolean;
  preferences: boolean;
  analytics: boolean;
}

interface ApeeLegalProps {
  initialTab?: 'policy' | 'terms' | 'rgpd' | 'cookies';
}

export default function ApeeLegal({ initialTab = 'policy' }: ApeeLegalProps = {}) {
  const [activeSubTab, setActiveSubTab] = useState<'policy' | 'terms' | 'rgpd' | 'cookies'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);
  
  // State for cookie toggles
  const [cookiePrefs, setCookiePrefs] = useState<CookiePreferences>({
    essential: true, // Always true
    preferences: true,
    analytics: false
  });
  
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPrefs = localStorage.getItem('cookie_preferences');
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setCookiePrefs({
          essential: true,
          preferences: parsed.preferences ?? true,
          analytics: parsed.analytics ?? false
        });
      } catch (e) {
        console.error("Failed to parse cookie preferences", e);
      }
    }
  }, []);

  const handleSaveCookiePreferences = () => {
    localStorage.setItem('cookie_preferences', JSON.stringify(cookiePrefs));
    localStorage.setItem('cookie_consent_decision', 'custom');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  return (
    <div id="content_apee_legal" className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-150 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            🛡️ Espace Droits, RGPD & Confidentialité
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Consultez notre politique de traitement des données, vérifiez nos engagements et configurez vos autorisations de cookies.
          </p>
        </div>
        <div className="mt-2 md:mt-0 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 text-[11px] font-mono text-slate-700">
          <Clock className="h-3.5 w-3.5 text-indigo-505" />
          <span>Vig. : 23 Mai 2026</span>
        </div>
      </div>

      {/* Organization Head Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 rounded-2xl border border-indigo-805 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
        <div className="space-y-1 md:max-w-xl">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
              ORGANISATION & RESPONSABILITÉ UNIQUE
            </span>
          </div>
          <h3 className="text-sm font-bold text-white">Directeur de la Publication & DPO</h3>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            Le portail **Pasma-sys ENT** et l'intégralité des solutions de trésorerie APEE sont placés sous la responsabilité juridique et technique exclusive de la personne suivante :
          </p>
        </div>

        <div className="bg-white/10 border border-white/10 rounded-xl p-3.5 text-xs space-y-2 shrink-0 md:w-80 backdrop-blur-xs font-mono">
          <div className="flex items-center gap-2 font-bold text-indigo-200 font-sans border-b border-white/10 pb-1.5">
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>M. Jacques Bene Mbama</span>
          </div>
          
          <div className="flex items-center gap-2 text-slate-200">
            <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Tél. : +237 656 454 053</span>
          </div>

          <div className="flex items-center gap-2 text-slate-200">
            <Mail className="h-3.5 w-3.5 text-cyan-405 shrink-0" />
            <a href="mailto:jacquesbene301@gmail.com" className="hover:underline hover:text-white truncate">
              jacquesbene301@gmail.com
            </a>
          </div>
        </div>
      </div>

      {/* Main Legal section tabs and content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Navigation Sidebar inside Legal */}
        <div className="lg:col-span-3 space-y-2">
          <button
            onClick={() => setActiveSubTab('policy')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeSubTab === 'policy' ? 'bg-indigo-650 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shield className="h-4 w-4 shrink-0" />
            <span>Confidentialité</span>
          </button>

          <button
            onClick={() => setActiveSubTab('terms')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeSubTab === 'terms' ? 'bg-indigo-650 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Scale className="h-4 w-4 shrink-0" />
            <span>Règles d'Utilisation (CGU)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('rgpd')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeSubTab === 'rgpd' ? 'bg-indigo-650 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>Conformité RGPD</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cookies')}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeSubTab === 'cookies' ? 'bg-indigo-650 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Cookie className="h-4 w-4 shrink-0" />
            <span>Gestion des Cookies</span>
          </button>
        </div>

        {/* Dynamic Legal Document Content Rendered */}
        <div className="lg:col-span-9 bg-slate-50 border border-slate-150 rounded-2xl p-5 select-text">
          {activeSubTab === 'policy' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-sans">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-550" /> Politique de Confidentialité du Portail
              </h3>
              <p>
                La protection de vos données personnelles est une priorité absolue. Cette politique de confidentialité détaille les pratiques relatives à la collecte, à l'utilisation, au traitement et à la sécurisation des données fournies par les parents, élèves, enseignants et personnels au sein du <strong>Portail Pasma-sys ENT & Solution de Trésorerie APEE</strong>.
              </p>

              <div>
                <h4 className="font-bold text-slate-800">1. Responsable de Traitement Unique</h4>
                <p>Jacques Bene Mbama — téléphone portable professionnel : <strong>+237 656 454 053</strong>, e-mail : <strong>jacquesbene301@gmail.com</strong>.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">2. Données Personnelles Collectées</h4>
                <p>Nous collectons uniquement le strict nécessaire pour la facilitation scolaire :</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Pour les parents :</strong> Nom réel, numéro de téléphone direct (important pour l'acheminement des notifications et alertes de solde), quartier de résidence, adresse e-mail (optionnelle pour les bilans).</li>
                  <li><strong>Pour les élèves :</strong> Nom complet, classe d'affectation, relevés de notes de l'ENT, devoirs d'apprentissage, et retards/absences.</li>
                  <li><strong>Pour la trésorerie :</strong> Solde exigible, montant libéré, statut des cotisations APEE et justificatifs de dépenses chiffrés.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">3. Finalités de votre traitement</h4>
                <p>Les données servent à éditer les reçus financiers automatiques de l'APEE, envoyer les rappels par SMS ou WhatsApp en cas d'impayé, et simplifier la messagerie avec les enseignants administratifs.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">4. Sécurité, Hébergement et Non-Partage des Données Mobiles</h4>
                <p>Vos renseignements sont conservés dans un environnement cloud sécurisé par des verrous logiques stricts (Firestore rules). Nous ne vendons, ne louons, ne commercialisons et ne prêtons aucune de vos données personnelles à des partenaires tiers.</p>
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 rounded-xl space-y-1">
                  <p className="font-bold text-amber-900 dark:text-amber-200 text-[11.5px]">
                    📱 Clause Spécifique de Confidentialité des Données Mobiles (Conformité Télécom & SMS / Twilio A2P) :
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                    <strong>Français :</strong> Aucune information relative à la téléphonie mobile ou donnée de consentement d'inscription SMS ne sera partagée avec des tiers ou des affiliés à des fins marketing ou promotionnelles. Toutes les catégories susmentionnées excluent formellement les données d'acceptation et de consentement des expéditeurs de SMS ; ces informations ne seront partagées avec aucun tiers.
                  </p>
                  <p className="text-[10.5px] text-amber-750 dark:text-amber-350 italic leading-normal">
                    <strong>English (Official Carrier Compliance Statement) :</strong> "No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties."
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-start gap-2.5">
                <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600">
                  Pour formuler une demande de correction de numéro de téléphone ou de suppression de vos données personnelles, vous pouvez envoyer votre courrier électronique motivé à <strong>jacquesbene301@gmail.com</strong> ou appeler le <strong>+237 656 454 053</strong>.
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'terms' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-sans">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Scale className="h-4 w-4 text-indigo-550" /> Conditions Générales d'Utilisation (CGU)
              </h3>
              <p>
                Le présent document définit les conditions générales d'utilisation applicables aux utilisateurs (parents d’élèves, enseignants, personnels administratifs) accédant au <strong>Portail Pasma-sys ENT</strong> ainsi qu'au module de <strong>Gestion de la Trésorerie APEE</strong> sous la responsabilité exclusive de <strong>Jacques Bene Mbama (+237 656 454 053)</strong>.
              </p>

              <div>
                <h4 className="font-bold text-slate-800">1. Acceptation Globale</h4>
                <p>L’accès et l’utilisation de ce portail informatique impliquent l'acceptation automatique et sans réserve des présentes CGU dans leur intégralité.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">2. Garantie des Données de Caisse</h4>
                <p>Le bureau de l'APEE s'engage à consigner fidèlement chaque tranche réglée. En cas de contestation ou de panne technique de synchronisation mobile, le reçu physique daté et signé par l'intendante fait preuve légale absolue.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">3. Obligations de l'Utilisateur</h4>
                <p>En tant que parent ou enseignant, vous vous engagez à renseigner un numéro de téléphone véridique et actif, à conserver la confidentialité de vos accès, et à ne pas perturber l'intégrité de l'ENT.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">4. Propriété intellectuelle</h4>
                <p>L'ensemble de la charte graphique de l'APEE, les codes, les logos de Pasma-sys et l'agencement fonctionnel de l'E.N.T. sont la propriété exclusive de Jacques Bene Mbama et des équipes de conception.</p>
              </div>

              <div className="mt-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-2">
                <h4 className="font-bold text-indigo-950 dark:text-indigo-200 text-xs flex items-center gap-1.5">
                  📲 5. Modalités du Service d'Alertes et Notifications SMS (Twilio Messaging Terms)
                </h4>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  En communiquant votre numéro de téléphone lors de l'inscription scolaire ou dans l'espace APEE, vous consentez à recevoir des SMS informatifs et administratifs relatifs à la vie scolaire de votre enfant :
                </p>
                <ul className="list-disc pl-5 text-[10.5px] text-slate-600 dark:text-slate-400 space-y-1">
                  <li><strong>Types de messages :</strong> Convocations aux assemblées APEE, rappels d'échéances de scolarité, alertes d'absences/retards et notifications de devoirs.</li>
                  <li><strong>Fréquence :</strong> La fréquence des messages varie selon le calendrier scolaire (en moyenne 1 à 4 SMS par mois).</li>
                  <li><strong>Frais applicables :</strong> Des frais standard de messagerie et de données de votre opérateur mobile peuvent s'appliquer (<em>Message and data rates may apply</em>).</li>
                  <li><strong>Assistance & Aide :</strong> Pour toute question ou assistance relative aux SMS, répondez <strong>HELP</strong> au SMS reçu ou écrivez à <strong>jacquesbene301@gmail.com</strong> (Tél : +237 656 454 053).</li>
                  <li><strong>Désabonnement & Retrait du consentement :</strong> Pour ne plus recevoir de messages SMS, répondez <strong>STOP</strong> à tout message ou contactez la direction de votre établissement pour mettre à jour vos préférences de communication.</li>
                </ul>
              </div>
            </div>
          )}

          {activeSubTab === 'rgpd' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-sans">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-550" /> Engagement de Conformité au RGPD
              </h3>
              <p>
                Le portail et son système de traitement de données s'aligne fidèlement aux recommandations européennes et internationales de protection des informations sensibles dans les environnements éducatifs.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900">1. Consentement Explicite Unilatéral</h4>
                  <p className="text-[11px] text-slate-600">Aucune fiche de rappel n'est envoyée par SMS/WhatsApp sans une notification préalable et les parents conservent à tout moment le droit de révoquer ce canal.</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900">2. Droit de Rectification & Retrait</h4>
                  <p className="text-[11px] text-slate-600">Vous conservez le droit d'accès et de modification permanente pour les numéros de téléphones et les liens entre parents et élèves de la classe.</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">3. Sécurisation Cloud</h4>
                <p>Les lectures de fiches bancaires et élèves sont sécurisées en Cloud Firestore de bout en bout. Seul l'administrateur scolaire authentifié possède la capacité d'injecter des données de caisse.</p>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-amber-950">
                  <h4 className="font-bold">Contactez Jacques Bene Mbama</h4>
                  <p className="text-[11px] leading-relaxed">
                    Pour toute information relative au registre RGPD ou pour demander l'effacement de vos fiches, contactez le délégué DPO unique au <strong>+237 656 454 053</strong> ou par e-mail en écrivant à <strong>jacquesbene301@gmail.com</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'cookies' && (
            <div className="space-y-5 text-xs text-slate-700 leading-relaxed font-sans">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Cookie className="h-4 w-4 text-indigo-550" /> Gestionnaire des Préférences de Cookies & Traceurs
              </h3>
              <p>
                Notre site utilise des fichiers cookies fonctionnels pour maintenir le jeton d'authentification ouvert et enregistrer vos filtres de recherche préférés sur la comptabilité APEE. Vous pouvez exercer un contrôle granulaire ci-dessous.
              </p>

              {/* Formular toggles */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      1. Cookies techniques de session (Indispensables)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Nécessaires pour mémoriser l'état authentifié de votre session Firebase et vos droits d'accès à l'ENT. Ils ne peuvent être débranchés.
                    </p>
                  </div>
                  <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-md cursor-not-allowed">
                    Toujours Actif
                  </span>
                </div>

                <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      2. Cookie de préférences d'affichage
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Permet de mémoriser vos choix d'onglets préférés (APEE vs pedagogique) et d'élèves consultés pour fluidifier votre navigation.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={cookiePrefs.preferences} 
                      onChange={(e) => setCookiePrefs({...cookiePrefs, preferences: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                  </label>
                </div>

                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      3. Traceurs statistiques & d'amélioration
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Trace de manière anonyme les lenteurs lors du chargement des fiches ou les échecs de synchronisation de base de données pour nous aider à optimiser l'app.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={cookiePrefs.analytics} 
                      onChange={(e) => setCookiePrefs({...cookiePrefs, analytics: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                  </label>
                </div>
              </div>

              {/* Action save */}
              <div className="flex justify-end pt-2 items-center gap-4">
                {savedSuccess && (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
                    <Check className="h-4 w-4" /> Préférences de cookies enregistrées !
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveCookiePreferences}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer transition"
                >
                  Enregistrer mes choix
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
